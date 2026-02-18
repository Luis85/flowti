import type { IEventBus } from "../../infrastructure/events/types";
import { isSkippedEvent } from "../../infrastructure/events/catalog";
import type { ITypedStorage } from "../../utils/TypedStorage";
import { generateUUID, extractSettingsBoolean, extractStringField } from "../../utils/helpers";
import { JobQueue } from "./JobQueue";
import type {
	IngestionConfig,
	IngestionJob,
	IngestionPersistentState,
	IngestionStats,
} from "./types";
import { DEFAULT_INGESTION_CONFIG, MAX_LEDGER_SIZE } from "./types";

/**
 * Configuration options for the IngestionService.
 */
export interface IngestionServiceOptions {
	storage: ITypedStorage<IngestionPersistentState>;
	eventBus?: IEventBus;
	config?: Partial<IngestionConfig>;
}

/**
 * Generates a unique job ID.
 */
function generateJobId(): string {
	return `job_${generateUUID()}`;
}

/** Extra prefixes to skip beyond the shared INTERNAL_EVENT_PREFIXES. */
const EXTRA_SKIP_PREFIXES = ["ingestion."] as const;

/**
 * Service for managing the ingestion pipeline.
 *
 * Watches configured event types, queues them as jobs, and processes
 * them with concurrency control and time-windowed batching. Failed
 * jobs are retried with exponential backoff.
 *
 * The actual processing logic is intentionally minimal (emit events).
 * Subclasses or external services can listen to ingestion events to
 * implement domain-specific processing.
 */
export class IngestionService {
	private config: IngestionConfig;
	private storage: ITypedStorage<IngestionPersistentState>;
	private eventBus?: IEventBus;
	private unsubscribes: (() => void)[] = [];
	private jobQueue: JobQueue<IngestionJob>;
	private batchBuffer: IngestionJob[] = [];
	private batchTimer: ReturnType<typeof setTimeout> | null = null;

	// Master toggle (responds to settings.changed / settings.loaded)
	private enabled = true;

	// Idempotency ledger
	private processedKeys: Set<string> = new Set();

	// Stats
	private processedCount = 0;
	private failedCount = 0;

	constructor(options: IngestionServiceOptions) {
		this.storage = options.storage;
		this.eventBus = options.eventBus;
		this.config = { ...DEFAULT_INGESTION_CONFIG, ...options.config };

		this.jobQueue = new JobQueue<IngestionJob>(
			this.config.concurrency,
			(job) => this.processJob(job)
		);

		if (this.eventBus) {
			// Listen for settings changes to update the enabled flag
			this.unsubscribes.push(
				this.eventBus.on("settings.changed", (event) => {
					const flag = extractSettingsBoolean(event.payload, "eventSystemEnabled");
					if (flag !== undefined) this.enabled = flag;
				})
			);
			this.unsubscribes.push(
				this.eventBus.on("settings.loaded", (event) => {
					const flag = extractSettingsBoolean(event.payload, "eventSystemEnabled");
					if (flag !== undefined) this.enabled = flag;
				})
			);

			// Wildcard listener to capture watched event types
			this.unsubscribes.push(
				this.eventBus.on("*", (event) => {
					if (!this.enabled) return;
					const type = event.type;
					if (isSkippedEvent(type, EXTRA_SKIP_PREFIXES)) return;
					if (!this.config.watchEventTypes.includes(type)) return;
					this.enqueueEvent(type, event.payload as Record<string, unknown>);
				})
			);
		}
	}

	/**
	 * Loads the idempotency ledger and recovers pending jobs from storage.
	 */
	async load(): Promise<void> {
		const saved = await this.storage.safeLoad();
		if (saved?.processedKeys) {
			this.processedKeys = new Set(saved.processedKeys);
		}

		// Crash recovery: re-enqueue pending jobs from previous session
		const pendingJobs = saved?.pendingJobs;
		if (pendingJobs && pendingJobs.length > 0) {
			let recoveredCount = 0;
			for (const job of pendingJobs) {
				const path = extractStringField(job.payload, "path");
				const key = this.generateEventKey(job.eventType, path);
				if (this.processedKeys.has(key)) continue;

				job.status = "queued";
				job.retryCount = 0;
				this.batchBuffer.push(job);
				recoveredCount++;
			}
			if (recoveredCount > 0) {
				void this.eventBus?.emit("ingestion.recovery.completed", { recoveredCount });
				// Flush recovered jobs immediately
				if (this.batchTimer !== null) {
					clearTimeout(this.batchTimer);
				}
				this.batchTimer = setTimeout(() => {
					this.flushBatch();
				}, this.config.batchWindowMs);
			}
		}
	}

	/**
	 * Returns current pipeline statistics.
	 */
	getStats(): IngestionStats {
		return {
			processedCount: this.processedCount,
			failedCount: this.failedCount,
			queuedCount: this.jobQueue.size,
			activeCount: this.jobQueue.activeCount,
		};
	}

	/**
	 * Generates a deterministic key for deduplication.
	 * Combines event type with file path (if present), or falls back
	 * to a hash of the event type for pathless events (TD-62 fix).
	 */
	generateEventKey(eventType: string, path?: string): string {
		return path ? `${eventType}::${path}` : `${eventType}::no-path`;
	}

	/**
	 * Checks if an event key has already been processed.
	 */
	isProcessed(key: string): boolean {
		return this.processedKeys.has(key);
	}

	/**
	 * Scans the given folders for files and enqueues any that aren't
	 * in the idempotency ledger. The `listFiles` callback is injected
	 * so the service stays Obsidian-free.
	 *
	 * @param watchFolders - Folder paths to scan
	 * @param listFiles - Callback that returns file paths for a folder
	 */
	async runCatchUp(
		watchFolders: string[],
		listFiles: (folder: string) => Promise<string[]>
	): Promise<void> {
		void this.eventBus?.emit("catchup.started", {
			folderCount: watchFolders.length,
		});

		let scannedCount = 0;
		let newCount = 0;

		for (const folder of watchFolders) {
			const files = await listFiles(folder);
			for (const filePath of files) {
				scannedCount++;
				const key = this.generateEventKey("file.created", filePath);
				if (this.processedKeys.has(key)) continue;

				newCount++;
				void this.eventBus?.emit("catchup.file.found", { path: filePath });
				this.enqueueEvent("file.created", { path: filePath, source: "catchup" });
			}
		}

		void this.eventBus?.emit("catchup.completed", { scannedCount, newCount });
	}

	/**
	 * Creates a job from an event and adds it to the batch buffer.
	 * The buffer flushes after batchWindowMs of inactivity.
	 * Skips events whose key is already in the idempotency ledger.
	 */
	private enqueueEvent(
		eventType: string,
		payload: Record<string, unknown>
	): void {
		// Idempotency check
		const path = extractStringField(payload, "path");
		const key = this.generateEventKey(eventType, path);
		if (this.processedKeys.has(key)) return;

		const job: IngestionJob = {
			id: generateJobId(),
			eventType,
			payload,
			status: "queued",
			retryCount: 0,
			queuedAt: new Date().toISOString(),
		};

		this.batchBuffer.push(job);
		void this.eventBus?.emit("ingestion.job.queued", {
			jobId: job.id,
			eventType: job.eventType,
		});

		// Reset the batch timer
		if (this.batchTimer !== null) {
			clearTimeout(this.batchTimer);
		}
		this.batchTimer = setTimeout(() => {
			this.flushBatch();
		}, this.config.batchWindowMs);
	}

	/**
	 * Flushes the batch buffer into the job queue.
	 */
	private flushBatch(): void {
		this.batchTimer = null;

		// Persist pending jobs before processing (crash recovery)
		void this.saveState();

		const jobs = this.batchBuffer.splice(0);
		if (jobs.length === 0) return;

		void this.eventBus?.emit("ingestion.batch.started", {
			jobCount: jobs.length,
		});

		for (const job of jobs) {
			this.jobQueue.enqueue(job);
		}

		// When all jobs are done, emit batch.completed
		void this.jobQueue.drain().then(() => {
			void this.eventBus?.emit("ingestion.batch.completed", {
				processedCount: this.processedCount,
				failedCount: this.failedCount,
			});
			void this.emitStats();
		});
	}

	/**
	 * Processes a single job. On failure, retries with exponential backoff.
	 */
	private async processJob(job: IngestionJob): Promise<void> {
		job.status = "processing";
		job.startedAt = new Date().toISOString();

		void this.eventBus?.emit("ingestion.job.started", {
			jobId: job.id,
			eventType: job.eventType,
		});

		try {
			await this.processJobPayload(job);
			job.status = "completed";
			job.completedAt = new Date().toISOString();
			this.processedCount++;

			// Record in idempotency ledger
			const path = extractStringField(job.payload, "path");
			const key = this.generateEventKey(job.eventType, path);
			this.addToLedger(key);
			void this.saveState();

			void this.eventBus?.emit("ingestion.job.completed", {
				jobId: job.id,
				eventType: job.eventType,
				payload: job.payload,
			});
		} catch (err) {
			job.retryCount++;
			const willRetry = job.retryCount < this.config.maxRetries;
			const errorMessage = err instanceof Error ? err.message : String(err);

			void this.eventBus?.emit("ingestion.job.failed", {
				jobId: job.id,
				eventType: job.eventType,
				error: errorMessage,
				retryCount: job.retryCount,
				willRetry,
			});

			if (willRetry) {
				const delay =
					this.config.baseRetryDelayMs * Math.pow(2, job.retryCount - 1);
				await this.sleep(delay);
				await this.processJob(job);
			} else {
				job.status = "failed";
				job.completedAt = new Date().toISOString();
				this.failedCount++;
			}
		}
	}

	/**
	 * Override point for actual processing logic.
	 * Default implementation is a no-op — external services should
	 * listen to ingestion events to implement domain-specific behavior.
	 */
	protected async processJobPayload(_job: IngestionJob): Promise<void> {
		// No-op by default. Override or listen to events.
	}

	/**
	 * Emits current stats.
	 */
	private async emitStats(): Promise<void> {
		await this.eventBus?.emit("ingestion.stats", {
			stats: this.getStats(),
		});
	}

	/**
	 * Sleeps for the specified milliseconds.
	 */
	private sleep(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	/**
	 * Adds a key to the ledger, evicting oldest entries if over limit.
	 */
	private addToLedger(key: string): void {
		this.processedKeys.add(key);
		if (this.processedKeys.size > MAX_LEDGER_SIZE) {
			// Evict oldest entries (Sets iterate in insertion order)
			const excess = this.processedKeys.size - MAX_LEDGER_SIZE;
			let count = 0;
			for (const k of this.processedKeys) {
				if (count >= excess) break;
				this.processedKeys.delete(k);
				count++;
			}
		}
	}

	/**
	 * Persists the idempotency ledger and pending jobs to storage.
	 */
	private async saveState(): Promise<void> {
		const pendingJobs = this.batchBuffer
			.filter((j) => j.status === "queued")
			.map((j) => ({ ...j }));
		const state: IngestionPersistentState = {
			processedKeys: [...this.processedKeys],
			pendingJobs: pendingJobs.length > 0 ? pendingJobs : undefined,
		};
		await this.storage.safeSave(state);
	}

	/**
	 * Unsubscribes from event bus listeners and clears timers.
	 */
	dispose(): void {
		if (this.batchTimer !== null) {
			clearTimeout(this.batchTimer);
			this.batchTimer = null;
		}
		for (const unsub of this.unsubscribes) {
			unsub();
		}
		this.unsubscribes = [];
	}
}
