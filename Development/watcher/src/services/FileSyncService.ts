import * as fs from "fs";
import * as fsp from "fs/promises";
import * as path from "path";
import type { App } from "obsidian";
import type {
	FolderMapping,
	ChangeType,
	SyncResult,
	ConflictDecision,
	ReconcileStats,
} from "../types";
import { toVaultPath, isTempFile, matchesExcludePattern, isSymlinkSync } from "../utils";
import { FileWatcherSettings } from "../settings/types";
import { LogService } from "./LogService";
import { AsyncMutex, KeyedMutex, OperationLock } from "./AsyncMutex";
import type { SyncStateService } from "./SyncStateService";

/**
 * Core service responsible for synchronizing files from external folders into the Obsidian vault.
 *
 * @remarks
 * The FileSyncService handles two main operations:
 * - **Single file sync**: Triggered by watch events when files change in monitored folders
 * - **Reconcile**: Bulk scan and sync of entire folder mappings with performance optimizations
 *
 * Performance optimizations include:
 * - Throttled progress callbacks to reduce UI overhead
 * - Cached folder existence checks to avoid redundant filesystem calls
 * - Skip unchanged files based on size + mtime comparison
 * - Concurrent worker pool for parallel file processing
 * - Optional stability checks for cloud-synced files (OneDrive, Dropbox)
 * - Pre-indexing of target folders for faster existence checks
 *
 * Thread safety is ensured through:
 * - Per-file mutex to prevent concurrent writes to the same target
 * - Operation lock to coordinate watchers vs reconciliation (readers-writer pattern)
 *
 * @example
 * ```typescript
 * const fileSync = new FileSyncService(app, settings);
 *
 * // Single file sync (from watcher)
 * const result = await fileSync.syncFile(mapping, '/path/to/file.md', 'add');
 *
 * // Reconcile entire mapping
 * const stats = await fileSync.reconcileMapping(mapping, (progress) => {
 *   console.log(`${progress.scanned}/${progress.total} files processed`);
 * });
 * ```
 *
 * @category Services
 */
export class FileSyncService {
	private settings: FileWatcherSettings;

	/** Per-file mutex to prevent concurrent writes to the same target file */
	private fileLock = new KeyedMutex();

	/** Operation lock to coordinate watchers vs reconciliation */
	private operationLock = new OperationLock();

	/** Lock timeout in ms - prevents deadlocks */
	private static readonly LOCK_TIMEOUT_MS = 30000;

	/** Optional sync state service for incremental reconciliation */
	private syncState?: SyncStateService;

	/** Tracks recent syncs to prevent sync loops (path → timestamp) */
	private recentSyncs = new Map<string, number>();

	/** Cooldown period for loop detection (ms) - 5s to accommodate cloud sync delays */
	private static readonly LOOP_COOLDOWN_MS = 5000;

	/** Cleanup interval for recentSyncs map */
	private static readonly SYNC_CLEANUP_INTERVAL_MS = 60000;

	/** Interval ID for cleanup timer (for proper cleanup on destroy) */
	private cleanupIntervalId?: ReturnType<typeof setInterval>;

	constructor(private app: App, settings: FileWatcherSettings) {
		this.settings = settings;
		// Periodically clean up old entries from recentSyncs
		this.cleanupIntervalId = setInterval(
			() => this.cleanupRecentSyncs(),
			FileSyncService.SYNC_CLEANUP_INTERVAL_MS
		);
	}

	/**
	 * Cleanup resources when the service is destroyed.
	 * Call this when the plugin is unloaded.
	 */
	destroy(): void {
		if (this.cleanupIntervalId) {
			clearInterval(this.cleanupIntervalId);
			this.cleanupIntervalId = undefined;
		}
		this.recentSyncs.clear();
	}

	/**
	 * Normalizes a path for consistent loop detection (lowercase, forward slashes).
	 */
	private normalizeSyncPath(filePath: string): string {
		return filePath.replace(/\\/g, "/").toLowerCase();
	}

	/**
	 * Checks if a file was recently modified by a sync operation.
	 * Used to prevent sync loops in bidirectional mode.
	 */
	isRecentlySynced(filePath: string): boolean {
		const normalized = this.normalizeSyncPath(filePath);
		const lastSync = this.recentSyncs.get(normalized);
		if (!lastSync) return false;
		return Date.now() - lastSync < FileSyncService.LOOP_COOLDOWN_MS;
	}

	/**
	 * Records a sync operation for loop detection.
	 */
	private recordSync(filePath: string): void {
		const normalized = this.normalizeSyncPath(filePath);
		this.recentSyncs.set(normalized, Date.now());
	}

	/**
	 * Cleans up old entries from the recentSyncs map.
	 */
	private cleanupRecentSyncs(): void {
		const now = Date.now();
		for (const [path, timestamp] of this.recentSyncs.entries()) {
			if (now - timestamp > FileSyncService.LOOP_COOLDOWN_MS * 2) {
				this.recentSyncs.delete(path);
			}
		}
	}

	/**
	 * Set the sync state service for incremental reconciliation.
	 * @param syncState - The sync state service instance
	 */
	setSyncStateService(syncState: SyncStateService): void {
		this.syncState = syncState;
	}

	/**
	 * Get the operation lock for external coordination.
	 * Used by ReconcileService to acquire exclusive access.
	 */
	getOperationLock(): OperationLock {
		return this.operationLock;
	}

	/**
	 * Updates the settings reference. Call this after settings change.
	 * @param settings - The new settings object
	 */
	updateSettings(settings: FileWatcherSettings) {
		this.settings = settings;
	}

	/**
	 * Synchronizes a single file from an external source folder to the vault.
	 *
	 * @remarks
	 * This method is typically called by watchers when a file change is detected.
	 * It handles:
	 * - Operation locking (blocks during reconciliation)
	 * - Optional file stability verification
	 * - Conflict resolution based on mapping settings
	 * - Retry logic for transient filesystem errors
	 *
	 * @param mapping - The folder mapping configuration
	 * @param sourceFilePath - Absolute path to the source file
	 * @param _changeType - Type of change ('add', 'change', 'unlink')
	 * @returns A {@link SyncResult} indicating success/failure and action taken
	 *
	 * @example
	 * ```typescript
	 * const result = await fileSync.syncFile(mapping, '/external/doc.md', 'change');
	 * if (result.ok) {
	 *   console.log(`Synced to ${result.targetPath}`);
	 * }
	 * ```
	 */
	async syncFile(
		mapping: FolderMapping,
		sourceFilePath: string,
		_changeType: ChangeType
	): Promise<SyncResult> {
		LogService.debug("Sync", `syncFile() called`, {
			mappingId: mapping.id,
			details: {
				mappingDescription: mapping.description,
				sourceFolder: mapping.sourceFolder,
				targetFolder: mapping.targetFolder,
				sourceFilePath,
			},
		});

		// Acquire watcher operation lock (allows concurrent watchers, blocks during reconcile)
		let releaseOp: (() => void) | undefined;
		try {
			releaseOp = await this.operationLock.acquireWatcher();
		} catch (e) {
			LogService.warn("Sync", `Could not acquire watcher lock`, {
				filePath: sourceFilePath,
			});
			return { ok: false, error: new Error("Operation lock unavailable") };
		}

		try {
			// for watch events we keep behavior conservative (stability check if enabled)
			const result = await this.syncFileInternal(mapping, sourceFilePath, {
				verifyStability: this.settings.verifyFileStability === true,
				skipUnchanged: false, // watcher event should sync (conflict strategy decides)
				ensuredFolders: this.createEnsuredFolderCache(),
				targetIndex: undefined,
			});

			// Record sync for loop detection (record BOTH paths to prevent loops from either watcher)
			if (result.ok && result.action === "processed" && result.targetPath) {
				this.recordSync(result.targetPath);     // Vault path - for VaultWatcher
				this.recordSync(sourceFilePath);        // External path - for MappingWatcher
			}

			return result;
		} finally {
			// CRITICAL: Always release operation lock, even on error
			if (releaseOp) {
				releaseOp();
			}
		}
	}

	/**
	 * Synchronizes a single file from the vault to an external source folder.
	 * This is the reverse of syncFile() and is used for vault-only or bidirectional sync.
	 *
	 * @param mapping - The folder mapping configuration
	 * @param vaultFilePath - Vault-relative path to the file (e.g., "imported/docs/file.md")
	 * @param _changeType - Type of change ('added', 'changed')
	 * @returns A SyncResult indicating success/failure and action taken
	 */
	async syncFileReverse(
		mapping: FolderMapping,
		vaultFilePath: string,
		_changeType: ChangeType
	): Promise<SyncResult> {
		LogService.debug("Sync", `syncFileReverse() called`, {
			mappingId: mapping.id,
			details: {
				mappingDescription: mapping.description,
				sourceFolder: mapping.sourceFolder,
				targetFolder: mapping.targetFolder,
				vaultFilePath,
			},
		});

		// Check for sync loop
		if (this.isRecentlySynced(vaultFilePath)) {
			LogService.debug("Sync", `Skipping reverse sync - recently synced (loop prevention)`, {
				mappingId: mapping.id,
				filePath: vaultFilePath,
			});
			return { ok: true, action: "skipped", targetPath: vaultFilePath, reason: "loop_prevention" };
		}

		// Acquire watcher operation lock
		let releaseOp: (() => void) | undefined;
		try {
			releaseOp = await this.operationLock.acquireWatcher();
		} catch (e) {
			LogService.warn("Sync", `Could not acquire watcher lock for reverse sync`, {
				filePath: vaultFilePath,
			});
			return { ok: false, error: new Error("Operation lock unavailable") };
		}

		try {
			return await this.syncFileReverseInternal(mapping, vaultFilePath);
		} finally {
			if (releaseOp) {
				releaseOp();
			}
		}
	}

	/**
	 * Internal implementation of reverse sync (vault → external).
	 */
	private async syncFileReverseInternal(
		mapping: FolderMapping,
		vaultFilePath: string
	): Promise<SyncResult> {
		// Calculate relative path from vault target folder
		const vaultPath = toVaultPath(vaultFilePath);
		const targetBase = toVaultPath(mapping.targetFolder);

		// Ensure the file is within the mapping's target folder
		if (!vaultPath.startsWith(targetBase)) {
			LogService.warn("Sync", `File not in target folder`, {
				mappingId: mapping.id,
				filePath: vaultFilePath,
				details: { targetFolder: mapping.targetFolder },
			});
			return { ok: false, error: new Error("File not in target folder") };
		}

		// Get relative path within the mapping
		const relativePath = vaultPath.slice(targetBase.length).replace(/^\//, "");
		if (!relativePath) {
			return { ok: false, error: new Error("Invalid relative path") };
		}

		// Calculate external target path
		const externalPath = path.join(mapping.sourceFolder, relativePath);

		// Acquire file-level lock
		let releaseFile: (() => void) | undefined;
		try {
			releaseFile = await this.fileLock.acquire(
				externalPath,
				FileSyncService.LOCK_TIMEOUT_MS
			);
		} catch (e) {
			LogService.warn("Sync", `File lock timeout for reverse sync: ${externalPath}`, {
				mappingId: mapping.id,
				filePath: vaultFilePath,
			});
			return { ok: false, error: new Error(`File lock timeout: ${externalPath}`) };
		}

		try {
			LogService.debug("Sync", `syncFileReverseInternal() path calculation`, {
				mappingId: mapping.id,
				details: {
					vaultFilePath,
					relativePath,
					externalPath,
				},
			});

			// Ensure parent folder exists in external location
			const parentFolder = path.dirname(externalPath);
			try {
				await fsp.mkdir(parentFolder, { recursive: true });
			} catch (e) {
				// Ignore if already exists
				if ((e as NodeJS.ErrnoException).code !== "EEXIST") {
					throw e;
				}
			}

			// Check if external target is a symlink (skip to prevent unexpected overwrites)
			if (isSymlinkSync(externalPath)) {
				LogService.debug("Sync", `Skipping reverse sync to symlink target`, {
					mappingId: mapping.id,
					filePath: vaultFilePath,
					details: { externalPath },
				});
				return {
					ok: true,
					action: "skipped",
					targetPath: externalPath,
					reason: "target_is_symlink",
				};
			}

			// Check if external file exists for conflict resolution
			let externalExists = false;
			try {
				await fsp.access(externalPath);
				externalExists = true;
			} catch {
				externalExists = false;
			}

			let finalExternalPath = externalPath;

			if (externalExists) {
				const decision = await this.resolveConflictReverse(
					mapping,
					vaultFilePath,
					externalPath
				);
				if (decision.action === "skip") {
					return { ok: true, action: "skipped", targetPath: externalPath, reason: "conflict_skip" };
				}
				finalExternalPath = decision.targetPath;
			}

			// Read from vault
			const vaultContent = await this.app.vault.adapter.readBinary(vaultPath);

			// Write to external location
			await withRetry(
				() => fsp.writeFile(finalExternalPath, Buffer.from(vaultContent)),
				{ maxRetries: 3 },
				(attempt, error, delay) => {
					LogService.debug("Sync", `Retrying external write (attempt ${attempt})`, {
						mappingId: mapping.id,
						filePath: finalExternalPath,
						details: { error: error.message, delayMs: delay },
					});
				}
			);

			LogService.debug("Sync", `File written to external: ${finalExternalPath}`);

			// Record sync for loop detection (record BOTH paths to prevent loops from either watcher)
			this.recordSync(externalPath);    // External path - for MappingWatcher
			this.recordSync(vaultFilePath);   // Vault path - for VaultWatcher

			return { ok: true, action: "processed", targetPath: finalExternalPath };
		} catch (e) {
			const err = e instanceof Error ? e : new Error(String(e));
			LogService.error("Sync", `Failed to reverse sync file: ${err.message}`, {
				mappingId: mapping.id,
				filePath: vaultFilePath,
				details: { externalPath, error: err.message },
			});
			return { ok: false, error: err, targetPath: externalPath };
		} finally {
			// Guard against undefined in case of early returns
			if (releaseFile) {
				releaseFile();
			}
		}
	}

	/**
	 * Resolves conflict for reverse sync (vault → external).
	 * Uses reverseConflictResolution if set, otherwise falls back to conflictResolution.
	 */
	private async resolveConflictReverse(
		mapping: FolderMapping,
		vaultFilePath: string,
		externalPath: string
	): Promise<ConflictDecision> {
		const strategy = mapping.reverseConflictResolution ?? mapping.conflictResolution;

		if (strategy === "overwrite") {
			return { action: "overwrite", targetPath: externalPath };
		}
		if (strategy === "skip") {
			return { action: "skip", targetPath: externalPath };
		}

		if (strategy === "keepNewer") {
			const vaultStat = await this.app.vault.adapter.stat(toVaultPath(vaultFilePath));
			let externalStat: fs.Stats | null = null;
			try {
				externalStat = await fsp.stat(externalPath);
			} catch {
				// External doesn't exist, overwrite
				return { action: "overwrite", targetPath: externalPath };
			}

			if (!vaultStat) {
				return { action: "skip", targetPath: externalPath };
			}

			if (vaultStat.mtime > externalStat.mtimeMs) {
				return { action: "overwrite", targetPath: externalPath };
			}
			return { action: "skip", targetPath: externalPath };
		}

		// rename - create unique filename
		const renamed = await this.makeRenamedExternalPath(externalPath);
		return { action: "rename", targetPath: renamed };
	}

	/**
	 * Creates a renamed path for conflict resolution in external filesystem.
	 */
	private async makeRenamedExternalPath(externalPath: string): Promise<string> {
		const dir = path.dirname(externalPath);
		const base = path.basename(externalPath);
		const ext = path.extname(base);
		const name = base.slice(0, base.length - ext.length);

		const stamp = new Date()
			.toISOString()
			.replace(/[:.]/g, "-")
			.replace("T", " ")
			.slice(0, 19);

		let candidate = path.join(dir, `${name} (conflict ${stamp})${ext}`);

		let i = 2;
		while (true) {
			try {
				await fsp.access(candidate);
				// File exists, try next
				candidate = path.join(dir, `${name} (conflict ${stamp} ${i})${ext}`);
				i++;
			} catch {
				// File doesn't exist, use this path
				break;
			}
		}
		return candidate;
	}

	/**
	 * Reconciles a specific subfolder within a mapping.
	 *
	 * @remarks
	 * Similar to {@link reconcileMapping} but scans only a specific subfolder.
	 * Used when a new directory is detected by watchers to sync its contents.
	 *
	 * @param mapping - The folder mapping configuration
	 * @param folderAbsPath - Absolute path to the folder to reconcile
	 * @param onProgress - Optional callback for progress updates
	 * @returns Statistics about the reconciliation operation
	 */
	async reconcileFolder(
		mapping: FolderMapping,
		folderAbsPath: string,
		onProgress?: (p: {
			total: number;
			scanned: number;
			processed: number;
			skipped: number;
			errors: number;
			current?: string;
		}) => void
	): Promise<ReconcileStats> {
		// Safety: folder must be inside mapping.sourceFolder
		const rel = path.relative(mapping.sourceFolder, folderAbsPath);
		if (
			rel.startsWith("..") ||
			(path.isAbsolute(rel) === false && rel.includes(":"))
		) {
			return { scanned: 0, processed: 0, skipped: 0, errors: 0 };
		}

		// We reuse reconcileMapping logic but scan only this folder subtree.
		const stats: ReconcileStats = {
			scanned: 0,
			processed: 0,
			skipped: 0,
			errors: 0,
		};

		if (!mapping.enabled) return stats;
		if (!folderAbsPath || !fs.existsSync(folderAbsPath)) return stats;

		const global = this.settings.reconcile;

		const reconcileConcurrency = this.clampNumber(
			global.parallelism ?? 8,
			1,
			16
		);
		const progressThrottleMs = this.clampNumber(
			global.progressThrottleMs ?? 250,
			25,
			2000
		);

		const verifyStabilityOnReconcile =
			!global.disableStabilityCheckDuringReconcile;

		const skipUnchangedOnReconcile = global.fastSkipUnchanged ?? true;

		// Incremental mode: use sync state to skip unchanged files
		const useIncrementalMode =
			(global.incrementalMode ?? true) && this.syncState !== undefined;

		const all = await this.walkFiles(folderAbsPath, true);

		// Pre-filter files and optionally check sync state
		const filesToProcess: Array<{ filePath: string; relativePath: string; stat?: fs.Stats }> = [];

		for (const filePath of all) {
			if (!this.isAllowedByExtension(mapping, filePath)) continue;
			if (this.settings.ignoreOneDriveTemp && isTempFile(filePath)) continue;

			// Skip symlinks to prevent infinite loops
			if (isSymlinkSync(filePath)) continue;

			const relativePath = path.relative(mapping.sourceFolder, filePath);

			// Check exclusion patterns
			if (matchesExcludePattern(relativePath, mapping.excludePatterns ?? [])) continue;

			// In incremental mode, check if file needs sync
			if (useIncrementalMode && this.syncState) {
				try {
					const stat = await fsp.stat(filePath);
					const sourceNeedsSync = this.syncState.needsSync(
						mapping.id,
						mapping.sourceFolder,
						relativePath,
						{ mtimeMs: stat.mtimeMs, size: stat.size }
					);

					// Also check if target file exists in vault
					const targetPath = path.join(mapping.targetFolder, relativePath);
					const targetExists = await this.app.vault.adapter.exists(targetPath);

					if (!sourceNeedsSync && targetExists) {
						stats.skipped++;
						continue;
					}

					filesToProcess.push({ filePath, relativePath, stat });
				} catch {
					// If stat fails, include the file anyway
					filesToProcess.push({ filePath, relativePath });
				}
			} else {
				filesToProcess.push({ filePath, relativePath });
			}
		}

		const total = filesToProcess.length + stats.skipped;

		const progress = this.createProgressEmitter(
			onProgress,
			progressThrottleMs
		);
		progress.emit({ total, ...stats }, true);

		const ensuredFolders = this.createEnsuredFolderCache();
		const targetIndex = await this.tryBuildTargetIndex(mapping);

		// Atomic cursor for concurrent workers
		const cursor = { value: 0 };
		const cursorLock = new AsyncMutex();

		const getNextIndex = async (): Promise<number> => {
			const release = await cursorLock.acquire();
			try {
				return cursor.value++;
			} finally {
				release();
			}
		};

		const worker = async () => {
			while (true) {
				const i = await getNextIndex();
				if (i >= filesToProcess.length) return;

				const { filePath, relativePath, stat } = filesToProcess[i];
				stats.scanned++;

				const res = await this.syncFileInternal(mapping, filePath, {
					verifyStability:
						verifyStabilityOnReconcile &&
						this.settings.verifyFileStability === true,
					skipUnchanged: skipUnchangedOnReconcile,
					ensuredFolders,
					targetIndex,
				});

				if (!res.ok) {
					stats.errors++;
				} else if (res.action === "skipped") {
					stats.skipped++;
				} else {
					stats.processed++;

					// Record successful sync in state
					if (this.syncState) {
						try {
							const fileStat = stat ?? await fsp.stat(filePath);
							this.syncState.recordSync(
								mapping.id,
								mapping.sourceFolder,
								relativePath,
								{ mtimeMs: fileStat.mtimeMs, size: fileStat.size }
							);
						} catch {
							// Ignore stat errors
						}
					}
				}

				progress.emit({ total, ...stats, current: filePath });
			}
		};

		await Promise.all(Array.from({ length: reconcileConcurrency }, worker));

		progress.emit({ total, ...stats }, true);
		return stats;
	}

	/**
	 * Reconciles an entire folder mapping by scanning and syncing all files.
	 *
	 * @remarks
	 * This is the main bulk sync operation, typically called:
	 * - On plugin startup (if reconcileOnStart is enabled)
	 * - Manually by the user via the dashboard
	 *
	 * The reconciliation process:
	 * 1. Scans all files in the source folder (respecting subfolder settings)
	 * 2. Filters by allowed extensions and excludes temp files
	 * 3. In incremental mode, skips files unchanged since last sync
	 * 4. Processes files in parallel using a worker pool
	 * 5. Skips unchanged files based on size/mtime comparison
	 * 6. Reports progress via callback
	 *
	 * @param mapping - The folder mapping to reconcile
	 * @param onProgress - Optional callback for progress updates, called periodically
	 * @returns Statistics about the reconciliation: scanned, processed, skipped, errors
	 *
	 * @example
	 * ```typescript
	 * const stats = await fileSync.reconcileMapping(mapping, (p) => {
	 *   const pct = Math.round((p.scanned / p.total) * 100);
	 *   console.log(`Progress: ${pct}% - ${p.current}`);
	 * });
	 * console.log(`Done: ${stats.processed} synced, ${stats.skipped} skipped`);
	 * ```
	 */
	async reconcileMapping(
		mapping: FolderMapping,
		onProgress?: (p: {
			total: number;
			scanned: number;
			processed: number;
			skipped: number;
			errors: number;
			current?: string;
		}) => void
	): Promise<ReconcileStats> {
		const stats: ReconcileStats = {
			scanned: 0,
			processed: 0,
			skipped: 0,
			errors: 0,
		};

		if (!mapping.enabled) return stats;
		if (!mapping.sourceFolder) return stats;
		if (!fs.existsSync(mapping.sourceFolder)) return stats;

		// ---- Tuning from global settings ----
		const global = this.settings.reconcile;

		const reconcileConcurrency = this.clampNumber(
			global.parallelism ?? 8,
			1,
			64
		);
		const progressThrottleMs = this.clampNumber(
			global.progressThrottleMs ?? 250,
			0,
			5000
		);

		// Reconcile defaults:
		// - stability checks OFF (files are usually stable at start)
		// - skipUnchanged ON (massive win)
		const verifyStabilityOnReconcile =
			!global.disableStabilityCheckDuringReconcile;
		const skipUnchangedOnReconcile = global.fastSkipUnchanged ?? true;

		// Incremental mode: use sync state to skip unchanged files
		const useIncrementalMode =
			(global.incrementalMode ?? true) && this.syncState !== undefined;

		if (useIncrementalMode) {
			LogService.debug("Reconcile", "Using incremental mode", {
				mappingId: mapping.id,
			});
		}

		// ---- Scan once -> stable total ----
		const all = await this.walkFiles(
			mapping.sourceFolder,
			mapping.watchSubfolders
		);

		// Pre-filter files and collect stats for incremental mode
		const filesToProcess: Array<{ filePath: string; relativePath: string; stat?: fs.Stats }> = [];
		const existingPaths = new Set<string>();

		for (const filePath of all) {
			if (!this.isAllowedByExtension(mapping, filePath)) continue;
			if (this.settings.ignoreOneDriveTemp && isTempFile(filePath)) continue;

			// Skip symlinks to prevent infinite loops
			if (isSymlinkSync(filePath)) continue;

			const relativePath = path.relative(mapping.sourceFolder, filePath);

			// Check exclusion patterns
			if (matchesExcludePattern(relativePath, mapping.excludePatterns ?? [])) continue;

			existingPaths.add(relativePath);

			// In incremental mode, check if file needs sync
			if (useIncrementalMode && this.syncState) {
				try {
					const stat = await fsp.stat(filePath);
					const sourceNeedsSync = this.syncState.needsSync(
						mapping.id,
						mapping.sourceFolder,
						relativePath,
						{ mtimeMs: stat.mtimeMs, size: stat.size }
					);

					// Also check if target file exists in vault
					// If target was deleted, we need to re-sync even if source unchanged
					const targetPath = path.join(mapping.targetFolder, relativePath);
					const targetExists = await this.app.vault.adapter.exists(targetPath);

					if (!sourceNeedsSync && targetExists) {
						stats.skipped++;
						continue;
					}

					if (!targetExists && !sourceNeedsSync) {
						LogService.debug("Reconcile", "Target file missing, will re-sync", {
							mappingId: mapping.id,
							filePath: relativePath,
						});
					}

					filesToProcess.push({ filePath, relativePath, stat });
				} catch {
					// If stat fails, include the file anyway
					filesToProcess.push({ filePath, relativePath });
				}
			} else {
				filesToProcess.push({ filePath, relativePath });
			}
		}

		const total = filesToProcess.length + stats.skipped;

		if (useIncrementalMode) {
			LogService.info("Reconcile", `Incremental mode: ${filesToProcess.length} files to sync, ${stats.skipped} skipped`, {
				mappingId: mapping.id,
				details: { total: all.length, toProcess: filesToProcess.length, skipped: stats.skipped },
			});
		}

		// ---- Progress throttling ----
		const progress = this.createProgressEmitter(
			onProgress,
			progressThrottleMs
		);
		progress.emit({ total, ...stats }, true);

		// ---- Reconcile caches ----
		const ensuredFolders = this.createEnsuredFolderCache();
		const targetIndex = await this.tryBuildTargetIndex(mapping);

		// ---- Concurrency worker pool with atomic cursor ----
		// Use an object to ensure atomic-like increment across async workers
		const cursor = { value: 0 };
		const cursorLock = new AsyncMutex();

		const getNextIndex = async (): Promise<number> => {
			const release = await cursorLock.acquire();
			try {
				return cursor.value++;
			} finally {
				release();
			}
		};

		const worker = async () => {
			while (true) {
				const i = await getNextIndex();
				if (i >= filesToProcess.length) return;

				const { filePath, relativePath, stat } = filesToProcess[i];
				stats.scanned++;
				progress.emit({ total, ...stats, current: filePath });

				const res = await this.syncFileInternal(mapping, filePath, {
					verifyStability:
						verifyStabilityOnReconcile &&
						this.settings.verifyFileStability === true,
					skipUnchanged: skipUnchangedOnReconcile,
					ensuredFolders,
					targetIndex,
				});

				if (!res.ok) {
					stats.errors++;
					progress.emit({ total, ...stats, current: filePath });
					continue;
				}

				if (res.action === "skipped") {
					stats.skipped++;
				} else {
					stats.processed++;

					// Record successful sync in state
					if (this.syncState) {
						try {
							const fileStat = stat ?? await fsp.stat(filePath);
							this.syncState.recordSync(
								mapping.id,
								mapping.sourceFolder,
								relativePath,
								{ mtimeMs: fileStat.mtimeMs, size: fileStat.size }
							);
						} catch {
							// Ignore stat errors
						}
					}
				}

				progress.emit({ total, ...stats, current: filePath });
			}
		};

		await Promise.all(Array.from({ length: reconcileConcurrency }, worker));

		// Prune orphaned entries (files deleted from source)
		if (this.syncState) {
			const pruned = this.syncState.pruneOrphans(mapping.id, existingPaths);
			if (pruned > 0) {
				LogService.debug("Reconcile", `Pruned ${pruned} orphaned entries`, {
					mappingId: mapping.id,
				});
			}
			this.syncState.recordReconcileComplete(mapping.id, mapping.sourceFolder);
		}

		progress.emit({ total, ...stats }, true);
		return stats;
	}

	// ===========================
	// Internal: core sync
	// ===========================
	private async syncFileInternal(
		mapping: FolderMapping,
		sourceFilePath: string,
		opts: {
			verifyStability: boolean;
			skipUnchanged: boolean;
			ensuredFolders: EnsuredFolderCache;
			targetIndex?: TargetIndex;
		}
	): Promise<SyncResult> {
		// Validate source path is within mapping's source folder (prevents path traversal)
		try {
			this.validateSourcePath(sourceFilePath, mapping.sourceFolder);
		} catch (e) {
			if (e instanceof PathTraversalError) {
				LogService.warn("Sync", `Path traversal attempt blocked`, {
					mappingId: mapping.id,
					filePath: sourceFilePath,
					details: { baseFolder: mapping.sourceFolder },
				});
				return { ok: false, error: e };
			}
			throw e;
		}

		// Calculate target path first (needed for file-level lock)
		const rel = path.relative(mapping.sourceFolder, sourceFilePath);
		const targetPathRaw = path.join(mapping.targetFolder, rel);
		const targetPath = toVaultPath(targetPathRaw);

		// Validate target path stays within vault's target folder
		try {
			this.validateTargetPath(targetPath, mapping.targetFolder);
		} catch (e) {
			if (e instanceof PathTraversalError) {
				LogService.warn("Sync", `Target path traversal blocked`, {
					mappingId: mapping.id,
					filePath: sourceFilePath,
					details: { targetPath, targetFolder: mapping.targetFolder },
				});
				return { ok: false, error: e };
			}
			throw e;
		}

		// Acquire file-level lock to prevent concurrent writes to same target
		let releaseFile: (() => void) | undefined;
		try {
			releaseFile = await this.fileLock.acquire(
				targetPath,
				FileSyncService.LOCK_TIMEOUT_MS
			);
		} catch (e) {
			LogService.warn("Sync", `File lock timeout for ${targetPath}`, {
				mappingId: mapping.id,
				filePath: sourceFilePath,
			});
			return {
				ok: false,
				error: new Error(`File lock timeout: ${targetPath}`),
			};
		}

		try {
			LogService.debug("Sync", `syncFileInternal() path calculation`, {
				mappingId: mapping.id,
				details: {
					mappingSourceFolder: mapping.sourceFolder,
					mappingTargetFolder: mapping.targetFolder,
					sourceFilePath,
					relativePath: rel,
					targetPathRaw,
					targetPath,
				},
			});

			// Skip symlinks to prevent infinite loops and unexpected behavior
			if (isSymlinkSync(sourceFilePath)) {
				LogService.debug("Sync", `Skipping symlink`, {
					mappingId: mapping.id,
					filePath: sourceFilePath,
				});
				return {
					ok: true,
					action: "skipped",
					targetPath,
					reason: "symlink",
				};
			}

			// Ensure parent folder exists (cached)
			const parentFolder = path.posix.dirname(targetPath);
			LogService.debug("Sync", `Ensuring parent folder: ${parentFolder}`);
			await this.ensureFolderCached(parentFolder, opts.ensuredFolders);

			// Optional stability check (OneDrive/Dropbox cloud sync)
			if (opts.verifyStability) {
				const stable = await this.waitForStability(sourceFilePath);
				if (!stable) {
					LogService.debug("Sync", `File skipped: stability check failed (still syncing?)`, {
						filePath: sourceFilePath,
						details: {
							stabilityChecks: this.settings.stabilityChecks,
							interval: this.settings.stabilityCheckInterval,
						},
					});
					return {
						ok: true,
						action: "skipped",
						targetPath,
						reason: "not_stable",
					};
				}
			}

			// Skip unchanged (reconcile)
			if (opts.skipUnchanged) {
				const same = await this.isUnchangedQuick(
					sourceFilePath,
					targetPath,
					opts.targetIndex
				);
				if (same) {
					return {
						ok: true,
						action: "skipped",
						targetPath,
						reason: "unchanged",
					};
				}
			}

			// Conflict resolution
			const targetExists = await this.existsFast(
				targetPath,
				opts.targetIndex
			);
			let finalTargetPath = targetPath;

			if (targetExists) {
				const decision = await this.resolveConflict(
					mapping,
					sourceFilePath,
					targetPath,
					opts.targetIndex
				);
				if (decision.action === "skip") {
					return {
						ok: true,
						action: "skipped",
						targetPath,
						reason: "conflict_skip",
					};
				}
				finalTargetPath = decision.targetPath;
			}

			// Read + write with retry logic for transient errors
			LogService.debug("Sync", `Writing file to vault`, {
				mappingId: mapping.id,
				filePath: sourceFilePath,
				details: { finalTargetPath },
			});

			const buf = await withRetry(
				() => fsp.readFile(sourceFilePath),
				{ maxRetries: 3 },
				(attempt, error, delay) => {
					LogService.debug("Sync", `Retrying file read (attempt ${attempt})`, {
						mappingId: mapping.id,
						filePath: sourceFilePath,
						details: { error: error.message, delayMs: delay },
					});
				}
			);
			const ab = buf.buffer.slice(
				buf.byteOffset,
				buf.byteOffset + buf.byteLength
			);

			await withRetry(
				() => this.app.vault.adapter.writeBinary(finalTargetPath, ab),
				{ maxRetries: 3 },
				(attempt, error, delay) => {
					LogService.debug("Sync", `Retrying vault write (attempt ${attempt})`, {
						mappingId: mapping.id,
						filePath: sourceFilePath,
						details: { targetPath: finalTargetPath, error: error.message, delayMs: delay },
					});
				}
			);

			LogService.debug("Sync", `File written successfully: ${finalTargetPath}`);

			// Update index (best effort) so later checks get faster
			if (opts.targetIndex) {
				try {
					const srcStat = await fsp.stat(sourceFilePath);
					// Respect size limits to prevent unbounded memory growth
					if (opts.targetIndex.statByPath.size < FileSyncService.MAX_TARGET_INDEX_SIZE) {
						opts.targetIndex.statByPath.set(finalTargetPath, {
							mtimeMs: srcStat.mtimeMs,
							size: srcStat.size,
						});
					}
					if (opts.targetIndex.exists.size < FileSyncService.MAX_TARGET_INDEX_SIZE) {
						opts.targetIndex.exists.add(finalTargetPath);
					}
				} catch {
					// ignore
				}
			}

			return {
				ok: true,
				action: "processed",
				targetPath: finalTargetPath,
			};
		} catch (e) {
			const err = e instanceof Error ? e : new Error(String(e));
			LogService.error("Sync", `Failed to sync file: ${err.message}`, {
				mappingId: mapping.id,
				filePath: sourceFilePath,
				details: {
					targetPath,
					error: err.message,
					stack: err.stack?.split("\n").slice(0, 3).join(" | "),
				},
			});
			return { ok: false, error: err, targetPath };
		} finally {
			// Always release file lock
			releaseFile();
		}
	}

	// ===========================
	// Target indexing (best effort)
	// ===========================
	/** Maximum target index entries to prevent unbounded memory growth */
	private static readonly MAX_TARGET_INDEX_SIZE = 50000;

	private async tryBuildTargetIndex(
		mapping: FolderMapping
	): Promise<TargetIndex | undefined> {
		// Build an index only when reconcile is expected to be large.
		// If adapter doesn't support listing, we just skip indexing.
		const idx: TargetIndex = {
			exists: new Set<string>(),
			statByPath: new Map<string, { mtimeMs: number; size: number }>(),
		};

		// Many Obsidian adapters implement list(). If not, this will throw.
		// list() returns: { files: string[]; folders: string[] } (depending on adapter)
		try {
			const base = toVaultPath(mapping.targetFolder);
			const listing = await this.app.vault.adapter.list(base);

			if (!listing) return undefined;

			const files: string[] = Array.isArray(listing.files)
				? listing.files
				: [];
			for (const p of files) idx.exists.add(toVaultPath(p));

			// NOTE: We do NOT stat every file (can be expensive). We'll stat lazily on demand.
			return idx;
		} catch {
			return undefined;
		}
	}

	private async existsFast(
		vaultPath: string,
		idx?: TargetIndex
	): Promise<boolean> {
		const p = toVaultPath(vaultPath);
		if (idx?.exists.has(p)) return true;
		return this.app.vault.adapter.exists(p);
	}

	private async statFast(
		vaultPath: string,
		idx?: TargetIndex
	): Promise<{ mtimeMs: number; size: number } | null> {
		const p = toVaultPath(vaultPath);
		const cached = idx?.statByPath.get(p);
		if (cached) return cached;

		const s = await this.safeStat(p);
		// Cache with size limit to prevent unbounded memory growth
		if (s && idx && idx.statByPath.size < FileSyncService.MAX_TARGET_INDEX_SIZE) {
			idx.statByPath.set(p, s);
		}
		return s;
	}

	/**
	 * Quick "unchanged" check:
	 * - if target doesn't exist => not unchanged
	 * - if size differs => changed
	 * - if mtime is within tolerance => unchanged
	 */
	private async isUnchangedQuick(
		sourceFilePath: string,
		targetPath: string,
		idx?: TargetIndex
	): Promise<boolean> {
		const p = toVaultPath(targetPath);

		// Fast exists
		const exists = await this.existsFast(p, idx);
		if (!exists) return false;

		// Source stat
		let src: fs.Stats;
		try {
			src = await fsp.stat(sourceFilePath);
		} catch {
			return false;
		}

		// Target stat (lazy)
		const tgt = await this.statFast(p, idx);
		if (!tgt) return false;

		if (tgt.size !== src.size) return false;

		// Vault mtime can be off slightly; tolerate.
		const MTIME_TOLERANCE_MS = 1500;
		const dt = Math.abs(tgt.mtimeMs - src.mtimeMs);
		if (dt <= MTIME_TOLERANCE_MS) return true;

		return false;
	}

	// ===========================
	// Conflicts
	// ===========================
	private async resolveConflict(
		mapping: FolderMapping,
		sourceFilePath: string,
		targetPath: string,
		idx?: TargetIndex
	): Promise<ConflictDecision> {
		const strategy = mapping.conflictResolution;

		if (strategy === "overwrite")
			return { action: "overwrite", targetPath };
		if (strategy === "skip") return { action: "skip", targetPath };

		if (strategy === "keepNewer") {
			const srcStat = await fsp.stat(sourceFilePath);
			const targetStat = await this.statFast(targetPath, idx);

			// If we can't stat target, default overwrite
			if (!targetStat) return { action: "overwrite", targetPath };

			if (srcStat.mtimeMs > targetStat.mtimeMs) {
				return { action: "overwrite", targetPath };
			}
			return { action: "skip", targetPath };
		}

		// rename
		const renamed = await this.makeRenamedTarget(targetPath, idx);
		return { action: "rename", targetPath: renamed };
	}

	private async makeRenamedTarget(
		vaultPath: string,
		idx?: TargetIndex
	): Promise<string> {
		const dir = path.posix.dirname(vaultPath);
		const base = path.posix.basename(vaultPath);
		const ext = path.posix.extname(base);
		const name = base.slice(0, base.length - ext.length);

		const stamp = new Date()
			.toISOString()
			.replace(/[:.]/g, "-")
			.replace("T", " ")
			.slice(0, 19);

		let candidate = `${dir}/${name} (conflict ${stamp})${ext}`.replace(
			/\/+/g,
			"/"
		);

		let i = 2;
		while (await this.existsFast(candidate, idx)) {
			candidate = `${dir}/${name} (conflict ${stamp} ${i})${ext}`.replace(
				/\/+/g,
				"/"
			);
			i++;
		}
		return candidate;
	}

	// ===========================
	// Utilities: folder ensure cache
	// ===========================
	/** Maximum cache entries to prevent unbounded memory growth */
	private static readonly MAX_ENSURED_FOLDERS_CACHE_SIZE = 10000;

	private createEnsuredFolderCache(): EnsuredFolderCache {
		return { ensured: new Set<string>() };
	}

	private async ensureFolderCached(
		folderPath: string,
		cache: EnsuredFolderCache
	) {
		const fp = folderPath.replace(/\\/g, "/");
		if (cache.ensured.has(fp)) return;

		const parts = fp.split("/").filter(Boolean);
		let current = "";
		for (const part of parts) {
			current = current ? `${current}/${part}` : part;
			if (cache.ensured.has(current)) continue;

			if (!(await this.app.vault.adapter.exists(current))) {
				try {
					await this.app.vault.createFolder(current);
				} catch (e) {
					// Race condition: another worker may have created it between exists() and createFolder()
					// "Folder already exists" is expected and not an error
					const msg = e instanceof Error ? e.message : String(e);
					if (!msg.includes("Folder already exists")) {
						throw e;
					}
				}
			}

			// Add to cache with size limit to prevent unbounded growth
			if (cache.ensured.size < FileSyncService.MAX_ENSURED_FOLDERS_CACHE_SIZE) {
				cache.ensured.add(current);
			}
		}

		if (cache.ensured.size < FileSyncService.MAX_ENSURED_FOLDERS_CACHE_SIZE) {
			cache.ensured.add(fp);
		}
	}

	// ===========================
	// Utilities: walk + filters
	// ===========================
	private isAllowedByExtension(
		mapping: FolderMapping,
		filePath: string
	): boolean {
		const list = mapping.fileExtensions ?? [];
		if (list.length === 0) return true;
		const ext = path.extname(filePath).toLowerCase();
		return list.includes(ext);
	}

	private async walkFiles(
		root: string,
		includeSubfolders: boolean
	): Promise<string[]> {
		const out: string[] = [];
		const stack: string[] = [root];

		while (stack.length) {
			const dir = stack.pop()!;
			let entries: fs.Dirent[];
			try {
				entries = await fsp.readdir(dir, { withFileTypes: true });
			} catch {
				continue;
			}

			for (const ent of entries) {
				const full = path.join(dir, ent.name);

				// ignore dotfiles/dirs
				if (ent.name.startsWith(".")) continue;

				if (ent.isDirectory()) {
					if (includeSubfolders) stack.push(full);
					continue;
				}
				if (ent.isFile()) out.push(full);
			}
		}

		return out;
	}

	// ===========================
	// Utilities: stat/stability
	// ===========================
	private async safeStat(
		vaultPath: string
	): Promise<{ mtimeMs: number; size: number } | null> {
		try {
			const s = await this.app.vault.adapter.stat(vaultPath);
			if (!s) return null;
			return { mtimeMs: s.mtime, size: s.size };
		} catch {
			return null;
		}
	}

	private async waitForStability(filePath: string): Promise<boolean> {
		const interval = Math.max(100, this.settings.stabilityCheckInterval);
		const checks = Math.max(1, this.settings.stabilityChecks);

		let lastSize = -1;
		let lastMtime = -1;
		let stableCount = 0;

		for (let i = 0; i < checks * 3; i++) {
			try {
				const st = await fsp.stat(filePath);
				if (st.size === lastSize && st.mtimeMs === lastMtime) {
					stableCount++;
					if (stableCount >= checks) return true;
				} else {
					stableCount = 0;
					lastSize = st.size;
					lastMtime = st.mtimeMs;
				}
			} catch {
				stableCount = 0;
			}

			await new Promise((r) => window.setTimeout(r, interval));
		}
		return false;
	}

	// ===========================
	// Utilities: path validation
	// ===========================
	/**
	 * Validates that a source file path is within the expected source folder.
	 * Prevents path traversal attacks via "../" or absolute path manipulation.
	 */
	private validateSourcePath(
		sourceFilePath: string,
		sourceFolder: string
	): void {
		// Normalize both paths (resolve symlinks, "..", etc.)
		const normalizedSource = path.normalize(sourceFilePath);
		const normalizedBase = path.normalize(sourceFolder);

		// Get relative path and check it doesn't escape
		const relative = path.relative(normalizedBase, normalizedSource);

		// If relative path starts with ".." or is absolute, it's outside the base
		if (
			relative.startsWith("..") ||
			path.isAbsolute(relative)
		) {
			throw new PathTraversalError(sourceFilePath, sourceFolder);
		}
	}

	/**
	 * Validates that the computed target path stays within the vault's target folder.
	 * Prevents path traversal in target paths.
	 */
	private validateTargetPath(
		targetPath: string,
		targetFolder: string
	): void {
		// Normalize to forward slashes for vault paths
		const normalizedTarget = toVaultPath(path.normalize(targetPath));
		const normalizedBase = toVaultPath(path.normalize(targetFolder));

		// Ensure target starts with target folder
		if (!normalizedTarget.startsWith(normalizedBase)) {
			throw new PathTraversalError(targetPath, targetFolder);
		}
	}

	// ===========================
	// Utilities: misc
	// ===========================
	private clampNumber(n: number, min: number, max: number): number {
		if (!Number.isFinite(n)) return min;
		return Math.max(min, Math.min(max, n));
	}

	private createProgressEmitter(
		onProgress: ((p: any) => void) | undefined,
		throttleMs: number
	): {
		emit: (p: any, force?: boolean) => void;
	} {
		let lastEmit = 0;
		return {
			emit: (p: any, force = false) => {
				if (!onProgress) return;
				const now = Date.now();
				if (!force && now - lastEmit < throttleMs) return;
				lastEmit = now;
				onProgress(p);
			},
		};
	}
}

// ===========================
// Internal types (no "any")
// ===========================
type EnsuredFolderCache = {
	ensured: Set<string>;
};

type TargetIndex = {
	exists: Set<string>;
	statByPath: Map<string, { mtimeMs: number; size: number }>;
};

// ===========================
// Path validation error
// ===========================
export class PathTraversalError extends Error {
	constructor(
		public readonly sourcePath: string,
		public readonly baseFolder: string
	) {
		super(
			`Path traversal detected: "${sourcePath}" is outside base folder "${baseFolder}"`
		);
		this.name = "PathTraversalError";
	}
}

// ===========================
// Retry configuration
// ===========================
export interface RetryConfig {
	/** Maximum number of retry attempts (default: 3) */
	maxRetries: number;
	/** Base delay between retries in ms (default: 100) */
	baseDelayMs: number;
	/** Maximum delay between retries in ms (default: 2000) */
	maxDelayMs: number;
	/** Whether to use exponential backoff (default: true) */
	exponentialBackoff: boolean;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
	maxRetries: 3,
	baseDelayMs: 100,
	maxDelayMs: 2000,
	exponentialBackoff: true,
};

/**
 * Determines if an error is retryable (transient).
 * Retryable errors include: EBUSY, ENOTEMPTY, EPERM (temporary), network errors.
 */
function isRetryableError(error: unknown): boolean {
	if (!(error instanceof Error)) return false;

	const msg = error.message.toLowerCase();
	const code = (error as NodeJS.ErrnoException).code;

	// File system transient errors
	if (code === "EBUSY") return true; // File locked
	if (code === "ENOTEMPTY") return true; // Directory not empty (race)
	if (code === "EAGAIN") return true; // Resource temporarily unavailable
	if (code === "EMFILE") return true; // Too many open files
	if (code === "ENFILE") return true; // Too many open files in system

	// Common transient error patterns
	if (msg.includes("resource busy")) return true;
	if (msg.includes("locked")) return true;
	if (msg.includes("in use by another process")) return true;
	if (msg.includes("network")) return true;
	if (msg.includes("timeout")) return true;

	// Non-retryable errors
	if (code === "ENOENT") return false; // File not found - won't magically appear
	if (code === "EACCES") return false; // Permission denied - permanent
	if (code === "EEXIST") return false; // Already exists - permanent

	return false;
}

/**
 * Executes an async operation with retry logic.
 */
async function withRetry<T>(
	operation: () => Promise<T>,
	config: Partial<RetryConfig> = {},
	onRetry?: (attempt: number, error: Error, delayMs: number) => void
): Promise<T> {
	const cfg = { ...DEFAULT_RETRY_CONFIG, ...config };
	let lastError: Error | undefined;

	for (let attempt = 0; attempt <= cfg.maxRetries; attempt++) {
		try {
			return await operation();
		} catch (e) {
			const error = e instanceof Error ? e : new Error(String(e));
			lastError = error;

			// Don't retry on last attempt or non-retryable errors
			if (attempt >= cfg.maxRetries || !isRetryableError(error)) {
				throw error;
			}

			// Calculate delay with exponential backoff
			let delay = cfg.baseDelayMs;
			if (cfg.exponentialBackoff) {
				delay = Math.min(
					cfg.baseDelayMs * Math.pow(2, attempt),
					cfg.maxDelayMs
				);
			}

			// Add jitter (±25%) to prevent thundering herd
			const jitter = delay * 0.25 * (Math.random() * 2 - 1);
			delay = Math.round(delay + jitter);

			if (onRetry) {
				onRetry(attempt + 1, error, delay);
			}

			await new Promise((r) => setTimeout(r, delay));
		}
	}

	throw lastError ?? new Error("Retry failed");
}
