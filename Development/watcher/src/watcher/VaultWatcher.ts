import * as path from "path";
import { App, EventRef, TAbstractFile, TFile } from "obsidian";
import { FolderMapping, ChangeType, PendingJob, SyncResult } from "../types";
import { toVaultPath, matchesExcludePattern } from "../utils";
import { LogService } from "../services/LogService";
import type { FileWatcherSettings } from "../settings/types";
import type { INoticeService } from "../services/NoticeService";
import type { FileSyncService } from "../services/FileSyncService";

/**
 * Context required by VaultWatcher.
 * Allows for better testability by injecting only what's needed.
 */
export interface IVaultWatcherContext {
	/** Get current settings */
	readonly settings: FileWatcherSettings;
	/** Increment processed count for a mapping */
	bumpProcessed(mappingId: string, filePath?: string): void;
	/** Increment skipped count for a mapping */
	bumpSkipped(mappingId: string): void;
	/** Increment error count for a mapping */
	bumpError(mappingId: string): void;
	/** Optional notice service for user notifications */
	readonly noticeService?: INoticeService;
	/** File sync service for reverse sync operations */
	readonly fileSync: FileSyncService;
}

/**
 * Watches for changes in the Obsidian vault's target folder and syncs them back to the source.
 * Used for vault-only and bidirectional sync modes.
 */
export class VaultWatcher {
	private modifyRef: EventRef | null = null;
	private createRef: EventRef | null = null;
	private pending = new Map<string, PendingJob>();

	/** Maximum pending jobs to prevent memory issues */
	private static readonly MAX_PENDING_JOBS = 1000;

	/**
	 * Minimum debounce delay for reverse sync (ms).
	 * Higher than source watcher to avoid rapid sync loops and reduce chattiness.
	 */
	private static readonly MIN_REVERSE_DEBOUNCE_MS = 1500;

	/** Stats for monitoring backpressure */
	private droppedJobs = 0;

	/** Timestamp of last file event activity */
	private _lastActivity: number | null = null;

	constructor(
		private app: App,
		private context: IVaultWatcherContext,
		public mapping: FolderMapping
	) {}

	/**
	 * Get current queue stats for monitoring/debugging.
	 */
	getQueueStats() {
		return {
			pendingFiles: this.pending.size,
			droppedJobs: this.droppedJobs,
			maxPendingFiles: VaultWatcher.MAX_PENDING_JOBS,
		};
	}

	/**
	 * Get timestamp of last file event activity.
	 */
	getLastActivity(): number | null {
		return this._lastActivity;
	}

	start() {
		const m = this.mapping;

		LogService.info("VaultWatcher", `start() called for mapping`, {
			mappingId: m.id,
			details: {
				description: m.description,
				enabled: m.enabled,
				syncDirection: m.syncDirection,
				targetFolder: m.targetFolder,
			},
		});

		// Only start if sync direction allows reverse sync
		if (m.syncDirection === "source-only") {
			LogService.debug("VaultWatcher", `Mapping ${m.id} is source-only, skipping vault watcher`, {
				mappingId: m.id,
			});
			return;
		}

		if (!m.enabled) {
			LogService.debug("VaultWatcher", `Mapping ${m.id} is disabled, skipping`, {
				mappingId: m.id,
			});
			return;
		}

		if (!m.targetFolder) {
			LogService.warn("VaultWatcher", `Target folder missing for ${m.id}`, {
				mappingId: m.id,
			});
			return;
		}

		// Register vault event handlers
		this.modifyRef = this.app.vault.on("modify", this.onFileModify.bind(this));
		this.createRef = this.app.vault.on("create", this.onFileCreate.bind(this));

		LogService.info("VaultWatcher", `Vault watcher started for ${m.description || m.id}`, {
			mappingId: m.id,
		});
	}

	async stop() {
		// Clear pending jobs
		for (const j of this.pending.values()) {
			if (j.timer) clearTimeout(j.timer);
		}
		this.pending.clear();

		// Unregister event handlers
		if (this.modifyRef) {
			this.app.vault.offref(this.modifyRef);
			this.modifyRef = null;
		}
		if (this.createRef) {
			this.app.vault.offref(this.createRef);
			this.createRef = null;
		}

		LogService.debug("VaultWatcher", `Vault watcher stopped`, {
			mappingId: this.mapping.id,
		});
	}

	private onFileModify(file: TAbstractFile) {
		if (!(file instanceof TFile)) return;
		this.enqueue(file.path, "changed");
	}

	private onFileCreate(file: TAbstractFile) {
		if (!(file instanceof TFile)) return;
		this.enqueue(file.path, "added");
	}

	private enqueue(filePath: string, changeType: ChangeType) {
		// Track activity timestamp
		this._lastActivity = Date.now();

		const vaultPath = toVaultPath(filePath);
		const targetBase = toVaultPath(this.mapping.targetFolder);

		// Check if file is within the mapping's target folder
		if (!vaultPath.startsWith(targetBase + "/") && vaultPath !== targetBase) {
			return; // Not in our target folder
		}

		// Check file extension filter
		if (!this.isAllowed(filePath)) {
			LogService.debug("VaultWatcher", `File not allowed by extension filter`, {
				mappingId: this.mapping.id,
				filePath,
				details: { extensions: this.mapping.fileExtensions },
			});
			return;
		}

		// Check exclusion patterns
		if (this.isExcluded(vaultPath, targetBase)) {
			LogService.debug("VaultWatcher", `File excluded by pattern`, {
				mappingId: this.mapping.id,
				filePath,
				details: { excludePatterns: this.mapping.excludePatterns },
			});
			return;
		}

		// Check for sync loop
		if (this.context.fileSync.isRecentlySynced(vaultPath)) {
			LogService.debug("VaultWatcher", `Skipping - recently synced (loop prevention)`, {
				mappingId: this.mapping.id,
				filePath,
			});
			return;
		}

		LogService.debug("VaultWatcher", `enqueue() ${changeType}`, {
			mappingId: this.mapping.id,
			filePath,
			details: { sourceFolder: this.mapping.sourceFolder },
		});

		// Ignore delete (we don't sync deletes)
		if (changeType === "deleted") {
			LogService.debug("VaultWatcher", `Skipping delete event`, {
				mappingId: this.mapping.id,
				filePath,
			});
			this.context.bumpSkipped(this.mapping.id);
			return;
		}

		const key = filePath;
		const existing = this.pending.get(key);

		// Backpressure: if queue is full and this is a NEW job, drop it
		if (!existing && this.pending.size >= VaultWatcher.MAX_PENDING_JOBS) {
			this.droppedJobs++;
			LogService.warn("VaultWatcher", `Queue full, dropping job`, {
				mappingId: this.mapping.id,
				filePath,
				details: {
					queueSize: this.pending.size,
					droppedTotal: this.droppedJobs,
				},
			});
			this.context.bumpSkipped(this.mapping.id);
			return;
		}

		if (existing?.timer) clearTimeout(existing.timer);

		// Use longer debounce for reverse sync to reduce chattiness and avoid loops
		const configuredDelay = this.mapping.debounceDelay ?? 800;
		const delay = Math.max(VaultWatcher.MIN_REVERSE_DEBOUNCE_MS, configuredDelay);
		const job: PendingJob = { filePath, changeType };

		job.timer = setTimeout(() => {
			this.pending.delete(key);
			void this.process(job);
		}, delay);

		this.pending.set(key, job);
	}

	private async process(job: PendingJob) {
		LogService.debug("VaultWatcher", `process() syncing file to external`, {
			mappingId: this.mapping.id,
			filePath: job.filePath,
			details: {
				mappingDescription: this.mapping.description,
				sourceFolder: this.mapping.sourceFolder,
				changeType: job.changeType,
			},
		});

		try {
			const result: SyncResult = await this.context.fileSync.syncFileReverse(
				this.mapping,
				job.filePath,
				job.changeType
			);

			if (!result.ok) {
				LogService.error("VaultWatcher", `Reverse sync failed: ${result.error?.message}`, {
					mappingId: this.mapping.id,
					filePath: job.filePath,
				});
				this.context.bumpError(this.mapping.id);
				this.context.noticeService?.error(
					`[${this.mapping.description || this.mapping.id}] sync failed: ${job.filePath}`
				);
			} else if (result.action === "skipped") {
				LogService.debug("VaultWatcher", `File skipped: ${result.reason}`, {
					mappingId: this.mapping.id,
					filePath: job.filePath,
				});
				this.context.bumpSkipped(this.mapping.id);
			} else {
				// Only log, don't show notification for successful reverse sync
				// This reduces chattiness in bidirectional mode
				LogService.debug("VaultWatcher", `File synced to external: ${job.changeType}`, {
					mappingId: this.mapping.id,
					filePath: job.filePath,
					details: { targetPath: result.targetPath },
				});
				this.context.bumpProcessed(this.mapping.id, job.filePath);
			}
		} catch (e) {
			LogService.error("VaultWatcher", `Reverse sync error: ${String(e)}`, {
				mappingId: this.mapping.id,
				filePath: job.filePath,
				details: { error: String(e) },
			});
			this.context.bumpError(this.mapping.id);
		}
	}

	private isAllowed(filePath: string): boolean {
		const ext = path.extname(filePath).toLowerCase();
		const list = this.mapping.fileExtensions ?? [];
		if (list.length === 0) return true;
		if (!ext) return false;
		return list.includes(ext);
	}

	private isExcluded(vaultPath: string, targetBase: string): boolean {
		const patterns = this.mapping.excludePatterns ?? [];
		if (patterns.length === 0) return false;

		// Calculate relative path from target folder
		let relativePath = vaultPath;
		if (vaultPath.startsWith(targetBase + "/")) {
			relativePath = vaultPath.slice(targetBase.length + 1);
		} else if (vaultPath.startsWith(targetBase)) {
			relativePath = vaultPath.slice(targetBase.length).replace(/^\//, "");
		}

		return matchesExcludePattern(relativePath, patterns);
	}
}
