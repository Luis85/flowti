import chokidar, { ChokidarOptions, FSWatcher } from "chokidar";
import { App } from "obsidian";
import { PendingJob, FolderMapping, ChangeType } from "../types";
import { LogService } from "../services/LogService";
import * as fs from "fs";
import * as path from "path";
import type {
	ISettingsProvider,
	IStatsTracker,
	IFileSyncOperations,
	IFileSyncServiceExtended,
} from "../interfaces/IPluginContext";
import type { INoticeService } from "../services/NoticeService";

/**
 * Minimal context required by MappingWatcher.
 * This allows for better testability by injecting only what's needed.
 */
export interface IMappingWatcherContext
	extends IStatsTracker,
		ISettingsProvider,
		IFileSyncOperations {
	/** Optional file sync service for reconcileFolder */
	readonly fileSync?: IFileSyncServiceExtended;
	/** Notice service for user notifications */
	readonly noticeService?: INoticeService;
}

export class MappingWatcher {
	private watcher: FSWatcher | null = null;
	private pending = new Map<string, PendingJob>();

	// separate debounce for directories (prevents tons of scans)
	private pendingDirs = new Map<string, ReturnType<typeof setTimeout>>();

	/** Maximum pending jobs to prevent memory issues on chatty folders */
	private static readonly MAX_PENDING_JOBS = 1000;

	/** Maximum pending directory reconciles */
	private static readonly MAX_PENDING_DIRS = 100;

	/** Stats for monitoring backpressure */
	private droppedJobs = 0;

	/** Timeout for watcher close operation (prevents hanging) */
	private static readonly CLOSE_TIMEOUT_MS = 5000;

	constructor(
		private app: App,
		private context: IMappingWatcherContext,
		public mapping: FolderMapping
	) {}

	/**
	 * Get current queue stats for monitoring/debugging.
	 */
	getQueueStats() {
		return {
			pendingFiles: this.pending.size,
			pendingDirs: this.pendingDirs.size,
			droppedJobs: this.droppedJobs,
			maxPendingFiles: MappingWatcher.MAX_PENDING_JOBS,
			maxPendingDirs: MappingWatcher.MAX_PENDING_DIRS,
		};
	}

	start() {
		const m = this.mapping;

		LogService.info("Watcher", `start() called for mapping`, {
			mappingId: m.id,
			details: {
				description: m.description,
				enabled: m.enabled,
				sourceFolder: m.sourceFolder,
				targetFolder: m.targetFolder,
			},
		});

		if (!m.enabled) {
			LogService.debug("Watcher", `Mapping ${m.id} is disabled, skipping`, {
				mappingId: m.id,
			});
			return;
		}

		if (!m.sourceFolder || !fs.existsSync(m.sourceFolder)) {
			LogService.warn("Watcher", `Source folder missing for ${m.id}`, {
				mappingId: m.id,
				details: { sourceFolder: m.sourceFolder },
			});
			this.context.bumpError(m.id);
			this.context.noticeService?.error(
				`Mapping "${m.description || m.id}": source folder missing`
			);
			return;
		}

		const ignored = this.buildIgnoredMatcher();

		const watchOptions: ChokidarOptions = {
			ignored,
			persistent: true,
			ignoreInitial: true,

			// IMPORTANT: watch subfolders when enabled
			depth: m.watchSubfolders ? undefined : 0,

			// OneDrive / network folders
			usePolling: m.usePolling ?? false,
			interval: m.pollingInterval ?? 300,

			// Avoid chokidar "atomic" rename confusion on some FS
			atomic: true,

			// Let our own stability check handle it if desired
			awaitWriteFinish: false,
		};

		LogService.debug("Watcher", `Creating chokidar watcher`, {
			mappingId: m.id,
			details: {
				sourceFolder: m.sourceFolder,
				watchOptions: { ...watchOptions, ignored: "(function)" },
			},
		});

		this.watcher = chokidar.watch(m.sourceFolder, watchOptions);

		this.watcher
			.on("add", (p) => this.enqueue(p, "added"))
			.on("change", (p) => this.enqueue(p, "changed"))
			.on("unlink", (p) => this.enqueue(p, "deleted"))
			.on("addDir", (dir) => this.onDirAdded(dir))
			.on("error", (err) => {
				LogService.error("Watcher", `Chokidar error for ${m.id}`, {
					mappingId: m.id,
					details: { error: String(err) },
				});
				this.context.bumpError(m.id);
				this.context.noticeService?.error(
					`Watcher error (${m.description || m.id}): ${String(err)}`
				);
			});

		LogService.info("Watcher", `Watcher started for ${m.description || m.id}`, {
			mappingId: m.id,
		});
	}

	async stop() {
		for (const j of this.pending.values()) {
			if (j.timer) clearTimeout(j.timer);
		}
		this.pending.clear();

		for (const t of this.pendingDirs.values()) clearTimeout(t);
		this.pendingDirs.clear();

		if (!this.watcher) return;
		const w = this.watcher;
		this.watcher = null;

		// Close watcher with timeout to prevent hanging on unresponsive filesystem
		try {
			await Promise.race([
				w.close(),
				new Promise<void>((_, reject) =>
					setTimeout(
						() => reject(new Error("Watcher close timeout")),
						MappingWatcher.CLOSE_TIMEOUT_MS
					)
				),
			]);
		} catch (e) {
			LogService.warn("Watcher", `Error closing watcher: ${String(e)}`, {
				mappingId: this.mapping.id,
			});
		}
	}

	private enqueue(filePath: string, changeType: ChangeType) {
		LogService.debug("Watcher", `enqueue() ${changeType}`, {
			mappingId: this.mapping.id,
			filePath,
			details: { mappingTarget: this.mapping.targetFolder },
		});

		// ignore delete (we don't delete inside vault)
		if (changeType === "deleted") {
			LogService.debug("Watcher", `Skipping delete event`, {
				mappingId: this.mapping.id,
				filePath,
			});
			this.context.bumpSkipped(this.mapping.id);
			return;
		}

		if (!this.isAllowed(filePath)) {
			LogService.debug("Watcher", `File not allowed by extension filter`, {
				mappingId: this.mapping.id,
				filePath,
				details: { extensions: this.mapping.fileExtensions },
			});
			return;
		}

		const key = filePath;
		const existing = this.pending.get(key);

		// Backpressure: if queue is full and this is a NEW job, drop it
		if (!existing && this.pending.size >= MappingWatcher.MAX_PENDING_JOBS) {
			this.droppedJobs++;
			LogService.warn("Watcher", `Queue full, dropping job`, {
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

		const delay = Math.max(0, this.mapping.debounceDelay ?? 500);
		const job: PendingJob = { filePath, changeType };

		job.timer = setTimeout(() => {
			this.pending.delete(key);
			void this.process(job);
		}, delay);

		this.pending.set(key, job);
	}

	private async process(job: PendingJob) {
		LogService.debug("Watcher", `process() syncing file`, {
			mappingId: this.mapping.id,
			filePath: job.filePath,
			details: {
				mappingDescription: this.mapping.description,
				targetFolder: this.mapping.targetFolder,
				changeType: job.changeType,
			},
		});

		try {
			// IMPORTANT: plugin.syncFile already updates stats + notices in your main.ts
			await this.context.syncFile(
				this.mapping,
				job.filePath,
				job.changeType
			);
			LogService.debug("Watcher", `process() completed for ${job.filePath}`, {
				mappingId: this.mapping.id,
				filePath: job.filePath,
			});

			LogService.info("Watcher", `File synced: ${job.changeType}`, {
				mappingId: this.mapping.id,
				filePath: job.filePath,
				details: { changeType: job.changeType },
			});
		} catch (e) {
			LogService.error("Watcher", `Sync failed: ${String(e)}`, {
				mappingId: this.mapping.id,
				filePath: job.filePath,
				details: { error: String(e) },
			});
			this.context.bumpError(this.mapping.id);
		}
	}

	private onDirAdded(dirPath: string) {
		const m = this.mapping;

		if (!m.watchSubfolders) return;
		if (!dirPath) return;

		// Debounce directory reconcile
		const key = dirPath;
		const existing = this.pendingDirs.get(key);

		// Backpressure: if dir queue is full and this is a NEW entry, drop it
		if (!existing && this.pendingDirs.size >= MappingWatcher.MAX_PENDING_DIRS) {
			this.droppedJobs++;
			LogService.warn("Watcher", `Dir queue full, dropping`, {
				mappingId: m.id,
				details: {
					dirPath,
					queueSize: this.pendingDirs.size,
					droppedTotal: this.droppedJobs,
				},
			});
			return;
		}

		if (existing) clearTimeout(existing);

		const delay = Math.max(250, m.debounceDelay ?? 500);

		const t = setTimeout(() => {
			this.pendingDirs.delete(key);
			void this.reconcileNewDir(dirPath);
		}, delay);

		this.pendingDirs.set(key, t);
	}

	private async reconcileNewDir(dirPath: string) {
		// IMPORTANT: Timer was already deleted from pendingDirs before this is called
		// We need to ensure we don't leak timers on error
		try {
			// Reconcile only the new folder subtree (FAST + correct)
			// Requires FileSyncService.reconcileFolder(..)
			if (!this.context.fileSync?.reconcileFolder) return;

			await this.context.fileSync.reconcileFolder(
				this.mapping,
				dirPath,
				(_progress) => {
					// Optional: feed your statusbar snapshot
					// this.context.setReconcileSnapshot?.({ ... })
				}
			);
		} catch (e) {
			LogService.error("Watcher", `reconcileNewDir error: ${String(e)}`, {
				mappingId: this.mapping.id,
				details: { dirPath, error: String(e) },
			});
			this.context.bumpError(this.mapping.id);
		}
	}

	private isAllowed(filePath: string): boolean {
		const ext = path.extname(filePath).toLowerCase();
		const list = this.mapping.fileExtensions ?? [];
		if (list.length > 0 && !list.includes(ext)) return false;
		return true;
	}

	private buildIgnoredMatcher():
		| ((p: string) => boolean)
		| RegExp
		| undefined {
		const ignoreDotfiles = /(^|[\/\\])\../;

		if (!this.context.settings.ignoreOneDriveTemp) return ignoreDotfiles;

		const officeLock = /(^|[\/\\])~\$/; // "~$file.docx"
		const tmpExt = /\.(tmp|temp|partial|crdownload)$/i;
		const onedriveTmpNames = /(^|[\/\\])(desktop\.ini|thumbs\.db)$/i;

		return (p: string) => {
			if (ignoreDotfiles.test(p)) return true;
			if (officeLock.test(p)) return true;
			if (tmpExt.test(p)) return true;
			if (onedriveTmpNames.test(p)) return true;
			return false;
		};
	}
}
