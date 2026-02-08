import chokidar, { ChokidarOptions, FSWatcher } from "chokidar";
import { App } from "obsidian";
import { PendingJob, FolderMapping, ChangeType } from "../types";
import { createIgnoredMatcher, matchesExcludePattern, isSymlinkSync } from "../utils";
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

	/** Timestamp of last file event activity */
	private _lastActivity: number | null = null;

	/** Timeout for watcher close operation (prevents hanging) */
	private static readonly CLOSE_TIMEOUT_MS = 5000;

	/** Buffered deletes for move detection (filePath → { relativePath, size, timer }) */
	private pendingDeletes = new Map<string, {
		relativePath: string;
		size: number;
		timer: ReturnType<typeof setTimeout>;
	}>();

	/** Time window to match a delete+add pair as a move */
	private static readonly MOVE_DETECT_WINDOW_MS = 2000;

	/** Guard against post-stop event processing */
	private stopped = false;

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

	/**
	 * Get timestamp of last file event activity.
	 * Returns null if no activity has occurred yet.
	 */
	getLastActivity(): number | null {
		return this._lastActivity;
	}

	start() {
		this.stopped = false;
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

		const ignored = createIgnoredMatcher(this.context.settings.ignoreOneDriveTemp);

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
		this.stopped = true;
		for (const j of this.pending.values()) {
			if (j.timer) clearTimeout(j.timer);
		}
		this.pending.clear();

		for (const t of this.pendingDirs.values()) clearTimeout(t);
		this.pendingDirs.clear();

		for (const entry of this.pendingDeletes.values()) clearTimeout(entry.timer);
		this.pendingDeletes.clear();

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
		if (this.stopped) return;

		// Track activity timestamp for health monitoring
		this._lastActivity = Date.now();

		LogService.debug("Watcher", `enqueue() ${changeType}`, {
			mappingId: this.mapping.id,
			filePath,
			details: { mappingTarget: this.mapping.targetFolder },
		});

		// Handle delete events based on deletionHandling setting
		if (changeType === "deleted") {
			const handling = this.mapping.deletionHandling ?? "ignore";
			if (handling === "ignore") {
				LogService.debug("Watcher", `Skipping delete event (deletionHandling=ignore)`, {
					mappingId: this.mapping.id,
					filePath,
				});
				this.context.bumpSkipped(this.mapping.id);
				return;
			}
			// If move detection is enabled, buffer the delete
			if (this.mapping.detectMoves) {
				this.bufferDelete(filePath);
				return;
			}
			// Otherwise fall through to normal debounce+process
		}

		// Check for sync loop (file was recently written by reverse sync)
		if (this.context.fileSync?.isRecentlySynced(filePath)) {
			LogService.debug("Watcher", `Skipping - recently synced (loop prevention)`, {
				mappingId: this.mapping.id,
				filePath,
			});
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

		// Check exclusion patterns
		if (this.isExcluded(filePath)) {
			LogService.debug("Watcher", `File excluded by pattern`, {
				mappingId: this.mapping.id,
				filePath,
				details: { excludePatterns: this.mapping.excludePatterns },
			});
			return;
		}

		// Skip symlinks to prevent infinite loops (not for deleted files — they no longer exist)
		if (changeType !== "deleted" && isSymlinkSync(filePath)) {
			LogService.debug("Watcher", `Skipping symlink`, {
				mappingId: this.mapping.id,
				filePath,
			});
			this.context.bumpSkipped(this.mapping.id);
			return;
		}

		// Move detection: check if an "added" event matches a buffered delete
		if (changeType === "added" && this.mapping.detectMoves && this.pendingDeletes.size > 0) {
			const matched = this.tryMatchMove(filePath);
			if (matched) return; // Enqueued as a "moved" job
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

	/**
	 * Buffer a delete event for move detection.
	 * If no matching add arrives within the time window, process as a regular delete.
	 */
	private bufferDelete(filePath: string) {
		const relativePath = path.relative(this.mapping.sourceFolder, filePath);

		// Look up last known size from SyncStateService
		let size = 0;
		const syncState = this.context.fileSync?.getSyncStateService?.();
		if (syncState) {
			const info = syncState.getFileInfo(this.mapping.id, relativePath);
			if (info) {
				size = info.sourceSize;
			}
		}

		// If we have no size info, process as regular delete immediately
		if (size === 0) {
			LogService.debug("Watcher", `bufferDelete: no size info, processing as delete`, {
				mappingId: this.mapping.id,
				filePath,
			});
			const delay = Math.max(0, this.mapping.debounceDelay ?? 500);
			const job: PendingJob = { filePath, changeType: "deleted" };
			job.timer = setTimeout(() => {
				this.pending.delete(filePath);
				void this.process(job);
			}, delay);
			this.pending.set(filePath, job);
			return;
		}

		const timer = setTimeout(() => {
			this.pendingDeletes.delete(filePath);
			// Timeout: no matching add found, process as regular delete
			LogService.debug("Watcher", `Move detection timeout, processing as delete`, {
				mappingId: this.mapping.id,
				filePath,
			});
			const job: PendingJob = { filePath, changeType: "deleted" };
			void this.process(job);
		}, MappingWatcher.MOVE_DETECT_WINDOW_MS);

		this.pendingDeletes.set(filePath, { relativePath, size, timer });
	}

	/**
	 * Try to match an "added" file with a buffered delete of the same size.
	 * Returns true if a match was found and a "moved" job was enqueued.
	 */
	private tryMatchMove(filePath: string): boolean {
		try {
			const stat = fs.statSync(filePath);
			for (const [deletedPath, entry] of this.pendingDeletes) {
				if (entry.size === stat.size) {
					// Match found
					clearTimeout(entry.timer);
					this.pendingDeletes.delete(deletedPath);

					LogService.info("Watcher", `Move detected`, {
						mappingId: this.mapping.id,
						details: { from: deletedPath, to: filePath, size: stat.size },
					});

					const delay = Math.max(0, this.mapping.debounceDelay ?? 500);
					const job: PendingJob = {
						filePath,
						changeType: "moved",
						oldPath: deletedPath,
					};
					job.timer = setTimeout(() => {
						this.pending.delete(filePath);
						void this.process(job);
					}, delay);
					this.pending.set(filePath, job);
					return true;
				}
			}
		} catch {
			// stat failed, process as normal add
		}
		return false;
	}

	private async process(job: PendingJob) {
		if (this.stopped) return;

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
			if (job.changeType === "deleted") {
				await this.context.syncDelete(this.mapping, job.filePath);
			} else if (job.changeType === "moved" && job.oldPath) {
				await this.context.syncMove(this.mapping, job.oldPath, job.filePath);
			} else {
				await this.context.syncFile(this.mapping, job.filePath, job.changeType);
			}

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

		// Skip symlinked directories to prevent infinite loops
		if (isSymlinkSync(dirPath)) {
			LogService.debug("Watcher", `Skipping symlinked directory`, {
				mappingId: m.id,
				details: { dirPath },
			});
			return;
		}

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

	private isExcluded(filePath: string): boolean {
		const patterns = this.mapping.excludePatterns ?? [];
		if (patterns.length === 0) return false;

		// Calculate relative path from source folder
		const sourceFolder = this.mapping.sourceFolder.replace(/\\/g, "/");
		const normalizedPath = filePath.replace(/\\/g, "/");

		let relativePath = normalizedPath;
		if (normalizedPath.startsWith(sourceFolder)) {
			relativePath = normalizedPath.slice(sourceFolder.length).replace(/^\//, "");
		}

		return matchesExcludePattern(relativePath, patterns);
	}
}
