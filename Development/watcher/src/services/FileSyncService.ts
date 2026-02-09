import * as fs from "fs";
import * as fsp from "fs/promises";
import * as path from "path";
import type { App } from "obsidian";
import type {
	FolderMapping,
	SyncResult,
	ReconcileStats,
} from "../types";
import { toVaultPath, isTempFile, isAllowedByExtensions, isPathExcluded, isSymlinkSync, walkExternalFiles, validateSourcePath, validateTargetPath } from "../utils";
import { FileWatcherSettings } from "../settings/types";
import { LogService } from "./LogService";
import { KeyedMutex, OperationLock } from "./AsyncMutex";
import type { SyncStateService } from "./SyncStateService";
import type {
	ReconcileMappingProgress,
	EnsuredFolderCache,
	TargetIndex,
	SyncInternalOpts,
} from "./types";
import { withRetry, PathTraversalError } from "./retry";
import { runReconcileWorkerPool } from "./ReconcileWorkerPool";
import { ConflictResolver } from "./ConflictResolver";
import { OrphanCleanup } from "./OrphanCleanup";
import { SyncLoopDetector } from "./SyncLoopDetector";

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

	/** Conflict resolution delegate */
	private conflicts: ConflictResolver;

	/** Orphan cleanup delegate */
	private orphanCleanup: OrphanCleanup;

	/** Loop detection delegate */
	private loopDetector = new SyncLoopDetector();

	constructor(private app: App, settings: FileWatcherSettings) {
		this.settings = settings;
		this.conflicts = new ConflictResolver(app);
		this.orphanCleanup = new OrphanCleanup(app);
	}

	/**
	 * Cleanup resources when the service is destroyed.
	 * Call this when the plugin is unloaded.
	 */
	destroy(): void {
		this.loopDetector.destroy();
	}

	/**
	 * Checks if a file was recently modified by a sync operation.
	 * Used to prevent sync loops in bidirectional mode.
	 */
	isRecentlySynced(filePath: string): boolean {
		return this.loopDetector.isRecentlySynced(filePath);
	}

	/**
	 * Records a sync operation for loop detection.
	 */
	private recordSync(filePath: string): void {
		this.loopDetector.recordSync(filePath);
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
	 * @returns A {@link SyncResult} indicating success/failure and action taken
	 *
	 * @example
	 * ```typescript
	 * const result = await fileSync.syncFile(mapping, '/external/doc.md');
	 * if (result.ok) {
	 *   console.log(`Synced to ${result.targetPath}`);
	 * }
	 * ```
	 */
	async syncFile(
		mapping: FolderMapping,
		sourceFilePath: string
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
	 * @returns A SyncResult indicating success/failure and action taken
	 */
	async syncFileReverse(
		mapping: FolderMapping,
		vaultFilePath: string
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

	// ===========================
	// Delete sync
	// ===========================

	/**
	 * Deletes the vault target file corresponding to a deleted source file.
	 * The vault file is moved to the system recycle bin for safety.
	 */
	async syncDelete(
		mapping: FolderMapping,
		sourceFilePath: string
	): Promise<SyncResult> {
		// Acquire watcher operation lock
		let releaseOp: (() => void) | undefined;
		try {
			releaseOp = await this.operationLock.acquireWatcher();
		} catch {
			return { ok: false, error: new Error("Operation lock unavailable") };
		}

		try {
			const rel = path.relative(mapping.sourceFolder, sourceFilePath);
			const targetPath = toVaultPath(path.join(mapping.targetFolder, rel));

			const tFile = this.app.vault.getAbstractFileByPath(targetPath);
			if (!tFile) {
				LogService.debug("Sync", `syncDelete: target not found, skipping`, {
					mappingId: mapping.id,
					details: { sourceFilePath, targetPath },
				});
				return { ok: true, action: "skipped", targetPath, reason: "target_not_found" };
			}

			await this.app.vault.trash(tFile, true);

			// Record sync for loop prevention
			this.recordSync(targetPath);
			this.recordSync(sourceFilePath);

			// Remove from sync state
			if (this.syncState) {
				this.syncState.removeEntry(mapping.id, rel);
			}

			LogService.info("Sync", `File trashed in vault`, {
				mappingId: mapping.id,
				filePath: targetPath,
			});

			return { ok: true, action: "deleted", targetPath };
		} catch (e) {
			const err = e instanceof Error ? e : new Error(String(e));
			LogService.error("Sync", `syncDelete failed: ${err.message}`, {
				mappingId: mapping.id,
				filePath: sourceFilePath,
			});
			return { ok: false, error: err };
		} finally {
			if (releaseOp) releaseOp();
		}
	}

	/**
	 * Deletes the source file corresponding to a deleted vault file.
	 * The source file is moved to .sync-trash/ in the source root for safety.
	 */
	async syncDeleteReverse(
		mapping: FolderMapping,
		vaultFilePath: string
	): Promise<SyncResult> {
		// Check loop prevention
		if (this.isRecentlySynced(vaultFilePath)) {
			return { ok: true, action: "skipped", targetPath: vaultFilePath, reason: "loop_prevention" };
		}

		let releaseOp: (() => void) | undefined;
		try {
			releaseOp = await this.operationLock.acquireWatcher();
		} catch {
			return { ok: false, error: new Error("Operation lock unavailable") };
		}

		try {
			const vaultPath = toVaultPath(vaultFilePath);
			const targetBase = toVaultPath(mapping.targetFolder);
			const relativePath = vaultPath.slice(targetBase.length).replace(/^\//, "");
			if (!relativePath) {
				return { ok: false, error: new Error("Invalid relative path") };
			}

			const externalPath = path.join(mapping.sourceFolder, relativePath);

			// Check if source file exists
			try {
				await fsp.access(externalPath);
			} catch {
				LogService.debug("Sync", `syncDeleteReverse: source not found, skipping`, {
					mappingId: mapping.id,
					details: { vaultFilePath, externalPath },
				});
				return { ok: true, action: "skipped", targetPath: externalPath, reason: "source_not_found" };
			}

			// Move to .sync-trash/ in source root
			const trashDir = path.join(mapping.sourceFolder, ".sync-trash");
			const trashTarget = path.join(trashDir, relativePath);
			const trashParent = path.dirname(trashTarget);

			await fsp.mkdir(trashParent, { recursive: true });

			// Handle name collision: append timestamp if target exists
			let finalTrashPath = trashTarget;
			try {
				await fsp.access(finalTrashPath);
				// File exists in trash, add timestamp
				const ext = path.extname(trashTarget);
				const base = trashTarget.slice(0, trashTarget.length - ext.length);
				const stamp = Date.now();
				finalTrashPath = `${base}.${stamp}${ext}`;
			} catch {
				// No collision
			}

			await fsp.rename(externalPath, finalTrashPath);

			// Record sync for loop prevention
			this.recordSync(externalPath);
			this.recordSync(vaultFilePath);

			// Remove from sync state
			if (this.syncState) {
				this.syncState.removeEntry(mapping.id, relativePath);
			}

			LogService.info("Sync", `File moved to .sync-trash/`, {
				mappingId: mapping.id,
				details: { externalPath, trashPath: finalTrashPath },
			});

			return { ok: true, action: "deleted", targetPath: externalPath };
		} catch (e) {
			const err = e instanceof Error ? e : new Error(String(e));
			LogService.error("Sync", `syncDeleteReverse failed: ${err.message}`, {
				mappingId: mapping.id,
				filePath: vaultFilePath,
			});
			return { ok: false, error: err };
		} finally {
			if (releaseOp) releaseOp();
		}
	}

	// ===========================
	// Move sync
	// ===========================

	/**
	 * Moves/renames a vault file when the corresponding source file was moved.
	 */
	async syncMove(
		mapping: FolderMapping,
		oldSourcePath: string,
		newSourcePath: string
	): Promise<SyncResult> {
		let releaseOp: (() => void) | undefined;
		try {
			releaseOp = await this.operationLock.acquireWatcher();
		} catch {
			return { ok: false, error: new Error("Operation lock unavailable") };
		}

		try {
			const oldRel = path.relative(mapping.sourceFolder, oldSourcePath);
			const newRel = path.relative(mapping.sourceFolder, newSourcePath);
			const oldVaultPath = toVaultPath(path.join(mapping.targetFolder, oldRel));
			const newVaultPath = toVaultPath(path.join(mapping.targetFolder, newRel));

			const tFile = this.app.vault.getAbstractFileByPath(oldVaultPath);
			if (!tFile) {
				// Old vault file doesn't exist — fall back to syncing the new file
				LogService.debug("Sync", `syncMove: old vault file not found, falling back to syncFile`, {
					mappingId: mapping.id,
					details: { oldVaultPath, newSourcePath },
				});
				const result = await this.syncFile(mapping, newSourcePath);
				return result;
			}

			// Ensure parent folder exists for new path
			const newParent = toVaultPath(path.dirname(newVaultPath));
			if (newParent && !(await this.app.vault.adapter.exists(newParent))) {
				await this.app.vault.createFolder(newParent);
			}

			await this.app.vault.rename(tFile, newVaultPath);

			// Record sync for loop prevention on all paths
			this.recordSync(oldSourcePath);
			this.recordSync(newSourcePath);
			this.recordSync(oldVaultPath);
			this.recordSync(newVaultPath);

			// Update sync state
			if (this.syncState) {
				this.syncState.removeEntry(mapping.id, oldRel);
				try {
					const stat = await fsp.stat(newSourcePath);
					this.syncState.recordSync(mapping.id, mapping.sourceFolder, newRel, {
						mtimeMs: stat.mtimeMs,
						size: stat.size,
					});
				} catch (e) {
					LogService.debug("Sync", `Stat after move failed`, {
						mappingId: mapping.id,
						filePath: newSourcePath,
						details: { error: String(e) },
					});
				}
			}

			LogService.info("Sync", `File moved in vault`, {
				mappingId: mapping.id,
				details: { oldVaultPath, newVaultPath },
			});

			return { ok: true, action: "moved", targetPath: newVaultPath };
		} catch (e) {
			const err = e instanceof Error ? e : new Error(String(e));
			LogService.error("Sync", `syncMove failed: ${err.message}`, {
				mappingId: mapping.id,
				details: { oldSourcePath, newSourcePath },
			});
			return { ok: false, error: err };
		} finally {
			if (releaseOp) releaseOp();
		}
	}

	/**
	 * Moves/renames a source file when the corresponding vault file was moved.
	 */
	async syncMoveReverse(
		mapping: FolderMapping,
		oldVaultPath: string,
		newVaultPath: string
	): Promise<SyncResult> {
		// Check loop prevention
		if (this.isRecentlySynced(oldVaultPath) || this.isRecentlySynced(newVaultPath)) {
			return { ok: true, action: "skipped", reason: "loop_prevention" };
		}

		let releaseOp: (() => void) | undefined;
		try {
			releaseOp = await this.operationLock.acquireWatcher();
		} catch {
			return { ok: false, error: new Error("Operation lock unavailable") };
		}

		try {
			const targetBase = toVaultPath(mapping.targetFolder);
			const oldRelative = toVaultPath(oldVaultPath).slice(targetBase.length).replace(/^\//, "");
			const newRelative = toVaultPath(newVaultPath).slice(targetBase.length).replace(/^\//, "");

			if (!oldRelative || !newRelative) {
				return { ok: false, error: new Error("Invalid relative path") };
			}

			const oldExternalPath = path.join(mapping.sourceFolder, oldRelative);
			const newExternalPath = path.join(mapping.sourceFolder, newRelative);

			// Check if old source file exists
			try {
				await fsp.access(oldExternalPath);
			} catch {
				// Old source doesn't exist — fall back to reverse sync the new file
				LogService.debug("Sync", `syncMoveReverse: old source not found, falling back`, {
					mappingId: mapping.id,
					details: { oldExternalPath, newVaultPath },
				});
				return await this.syncFileReverse(mapping, newVaultPath);
			}

			// Ensure parent directory exists for new path
			const newParent = path.dirname(newExternalPath);
			await fsp.mkdir(newParent, { recursive: true });

			await fsp.rename(oldExternalPath, newExternalPath);

			// Record sync for loop prevention
			this.recordSync(oldVaultPath);
			this.recordSync(newVaultPath);
			this.recordSync(oldExternalPath);
			this.recordSync(newExternalPath);

			// Update sync state
			if (this.syncState) {
				this.syncState.removeEntry(mapping.id, oldRelative);
				try {
					const stat = await fsp.stat(newExternalPath);
					this.syncState.recordSync(mapping.id, mapping.sourceFolder, newRelative, {
						mtimeMs: stat.mtimeMs,
						size: stat.size,
					});
				} catch (e) {
					LogService.debug("Sync", `Stat after reverse move failed`, {
						mappingId: mapping.id,
						filePath: newExternalPath,
						details: { error: String(e) },
					});
				}
			}

			LogService.info("Sync", `File moved in source`, {
				mappingId: mapping.id,
				details: { oldExternalPath, newExternalPath },
			});

			return { ok: true, action: "moved", targetPath: newExternalPath };
		} catch (e) {
			const err = e instanceof Error ? e : new Error(String(e));
			LogService.error("Sync", `syncMoveReverse failed: ${err.message}`, {
				mappingId: mapping.id,
				details: { oldVaultPath, newVaultPath },
			});
			return { ok: false, error: err };
		} finally {
			if (releaseOp) releaseOp();
		}
	}

	/**
	 * Expose the sync state service for move detection size lookups.
	 */
	getSyncStateService(): SyncStateService | undefined {
		return this.syncState;
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
				const decision = await this.conflicts.resolveReverse(
					mapping,
					vaultFilePath,
					externalPath
				);
				if (decision.action === "skip") {
					return { ok: true, action: "skipped", targetPath: externalPath, reason: "conflict_skip" };
				}
				finalExternalPath = decision.targetPath;
			}

			// Guard: skip files that are too large to prevent OOM
			const vaultStat = await this.app.vault.adapter.stat(vaultPath);
			if (vaultStat && vaultStat.size > FileSyncService.MAX_FILE_SIZE_BYTES) {
				LogService.warn("Sync", `Vault file too large for reverse sync, skipping`, {
					mappingId: mapping.id,
					filePath: vaultFilePath,
					details: {
						sizeBytes: vaultStat.size,
						maxBytes: FileSyncService.MAX_FILE_SIZE_BYTES,
					},
				});
				return {
					ok: true,
					action: "skipped",
					targetPath: externalPath,
					reason: "file_too_large",
				};
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
		onProgress?: (p: ReconcileMappingProgress) => void
	): Promise<ReconcileStats> {
		// Safety: folder must be inside mapping.sourceFolder
		const rel = path.relative(mapping.sourceFolder, folderAbsPath);
		if (
			rel.startsWith("..") ||
			(path.isAbsolute(rel) === false && rel.includes(":"))
		) {
			return { scanned: 0, processed: 0, skipped: 0, errors: 0, deleted: 0 };
		}

		// We reuse reconcileMapping logic but scan only this folder subtree.
		const stats: ReconcileStats = {
			scanned: 0,
			processed: 0,
			skipped: 0,
			errors: 0,
			deleted: 0,
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

		const all = await walkExternalFiles(folderAbsPath, true);

		// Pre-filter files and optionally check sync state
		const filesToProcess: Array<{ filePath: string; relativePath: string; stat?: fs.Stats }> = [];

		for (const filePath of all) {
			if (!isAllowedByExtensions(filePath, mapping.fileExtensions ?? [])) continue;
			if (this.settings.ignoreOneDriveTemp && isTempFile(filePath)) continue;

			// Skip symlinks to prevent infinite loops
			if (isSymlinkSync(filePath)) continue;

			const relativePath = path.relative(mapping.sourceFolder, filePath);

			// Check exclusion patterns
			if (isPathExcluded(relativePath, mapping.excludePatterns ?? [])) continue;

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
				} catch (e) {
					LogService.debug("Reconcile", `Stat failed during incremental check, including file anyway`, {
						mappingId: mapping.id,
						filePath,
						details: { error: String(e) },
					});
					filesToProcess.push({ filePath, relativePath });
				}
			} else {
				filesToProcess.push({ filePath, relativePath });
			}
		}

		const ensuredFolders = this.createEnsuredFolderCache();
		const targetIndex = await this.tryBuildTargetIndex(mapping);

		return runReconcileWorkerPool({
			filesToProcess,
			initialSkipped: stats.skipped,
			mapping,
			concurrency: reconcileConcurrency,
			progressThrottleMs,
			onProgress,
			syncFile: (m, fp, opts) => this.syncFileInternal(m, fp, opts),
			syncOpts: {
				verifyStability:
					verifyStabilityOnReconcile &&
					this.settings.verifyFileStability === true,
				skipUnchanged: skipUnchangedOnReconcile,
				ensuredFolders,
				targetIndex,
			},
			syncState: this.syncState,
		});
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
		onProgress?: (p: ReconcileMappingProgress) => void
	): Promise<ReconcileStats> {
		const stats: ReconcileStats = {
			scanned: 0,
			processed: 0,
			skipped: 0,
			errors: 0,
			deleted: 0,
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
		const all = await walkExternalFiles(
			mapping.sourceFolder,
			mapping.watchSubfolders
		);

		// Pre-filter files and collect stats for incremental mode
		const filesToProcess: Array<{ filePath: string; relativePath: string; stat?: fs.Stats }> = [];
		const existingPaths = new Set<string>();

		for (const filePath of all) {
			if (!isAllowedByExtensions(filePath, mapping.fileExtensions ?? [])) continue;
			if (this.settings.ignoreOneDriveTemp && isTempFile(filePath)) continue;

			// Skip symlinks to prevent infinite loops
			if (isSymlinkSync(filePath)) continue;

			const relativePath = path.relative(mapping.sourceFolder, filePath);

			// Check exclusion patterns
			if (isPathExcluded(relativePath, mapping.excludePatterns ?? [])) continue;

			existingPaths.add(relativePath.replace(/\\/g, "/"));

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
				} catch (e) {
					LogService.debug("Reconcile", `Stat failed during reverse incremental check, including file anyway`, {
						mappingId: mapping.id,
						filePath,
						details: { error: String(e) },
					});
					filesToProcess.push({ filePath, relativePath });
				}
			} else {
				filesToProcess.push({ filePath, relativePath });
			}
		}

		if (useIncrementalMode) {
			LogService.info("Reconcile", `Incremental mode: ${filesToProcess.length} files to sync, ${stats.skipped} skipped`, {
				mappingId: mapping.id,
				details: { total: all.length, toProcess: filesToProcess.length, skipped: stats.skipped },
			});
		}

		// ---- Reconcile caches ----
		const ensuredFolders = this.createEnsuredFolderCache();
		const targetIndex = await this.tryBuildTargetIndex(mapping);

		// ---- Worker pool ----
		const poolStats = await runReconcileWorkerPool({
			filesToProcess,
			initialSkipped: stats.skipped,
			mapping,
			concurrency: reconcileConcurrency,
			progressThrottleMs,
			onProgress,
			syncFile: (m, fp, opts) => this.syncFileInternal(m, fp, opts),
			syncOpts: {
				verifyStability:
					verifyStabilityOnReconcile &&
					this.settings.verifyFileStability === true,
				skipUnchanged: skipUnchangedOnReconcile,
				ensuredFolders,
				targetIndex,
			},
			syncState: this.syncState,
		});

		// Merge pool stats into our stats object
		stats.scanned = poolStats.scanned;
		stats.processed = poolStats.processed;
		stats.skipped = poolStats.skipped;
		stats.errors = poolStats.errors;

		// Reverse reconciliation: sync vault-only files to source (bidirectional only)
		const syncDirection = mapping.syncDirection ?? "source-only";
		if (syncDirection === "bidirectional") {
			try {
				const reverseResult = await this.reverseReconcileVaultFiles(mapping, existingPaths);
				stats.processed += reverseResult.processed;
				stats.skipped += reverseResult.skipped;
				stats.errors += reverseResult.errors;
			} catch (e) {
				LogService.error("Reconcile", `Reverse reconciliation failed: ${String(e)}`, {
					mappingId: mapping.id,
				});
			}
		}

		// Orphan cleanup: remove vault files that no longer exist in source
		const deletionHandling = mapping.deletionHandling ?? "ignore";
		if (deletionHandling !== "ignore" && syncDirection !== "vault-only") {
			try {
				const orphanResult = await this.orphanCleanup.cleanupOrphans(mapping, existingPaths);
				stats.deleted = orphanResult.deleted;
				stats.errors += orphanResult.errors;
				if (orphanResult.deleted > 0) {
					LogService.info("Reconcile", `Cleaned up ${orphanResult.deleted} orphaned vault files`, {
						mappingId: mapping.id,
					});
				}
			} catch (e) {
				LogService.error("Reconcile", `Orphan cleanup failed: ${String(e)}`, {
					mappingId: mapping.id,
				});
			}
		}

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

		return stats;
	}

	// ===========================
	// Internal: core sync
	// ===========================
	private async syncFileInternal(
		mapping: FolderMapping,
		sourceFilePath: string,
		opts: SyncInternalOpts
	): Promise<SyncResult> {
		// Validate source path is within mapping's source folder (prevents path traversal)
		try {
			validateSourcePath(sourceFilePath, mapping.sourceFolder);
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
			validateTargetPath(targetPath, mapping.targetFolder);
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
				const decision = await this.conflicts.resolveForward(
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

			// Guard: skip files that are too large to prevent OOM
			const sourceStat = await fsp.stat(sourceFilePath);
			if (sourceStat.size > FileSyncService.MAX_FILE_SIZE_BYTES) {
				LogService.warn("Sync", `File too large, skipping`, {
					mappingId: mapping.id,
					filePath: sourceFilePath,
					details: {
						sizeBytes: sourceStat.size,
						maxBytes: FileSyncService.MAX_FILE_SIZE_BYTES,
					},
				});
				return {
					ok: true,
					action: "skipped",
					targetPath,
					reason: "file_too_large",
				};
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
				} catch (e) {
					LogService.debug("Sync", `Post-write stat failed for target index update`, {
						mappingId: mapping.id,
						filePath: sourceFilePath,
						details: { error: String(e) },
					});
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

	/** Maximum file size to sync (100 MB). Files larger than this are skipped to prevent OOM. */
	private static readonly MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024;

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
	// Reverse reconciliation (bidirectional)
	// ===========================

	/**
	 * Walks all files in a vault target folder recursively.
	 * Used by reverse reconciliation to find vault-only files.
	 */
	private async walkVaultTargetFiles(basePath: string): Promise<string[]> {
		const out: string[] = [];
		const stack: string[] = [basePath];

		while (stack.length > 0) {
			const dir = stack.pop()!;
			try {
				const listing = await this.app.vault.adapter.list(dir);
				if (listing?.files) {
					out.push(...listing.files);
				}
				if (listing?.folders) {
					stack.push(...listing.folders);
				}
			} catch {
				continue;
			}
		}

		return out;
	}

	/**
	 * Reverse reconciliation for bidirectional mappings.
	 * Finds vault files without a corresponding source file and syncs them to the source.
	 * Updates existingSourcePaths so orphan cleanup won't delete reverse-synced files.
	 */
	private async reverseReconcileVaultFiles(
		mapping: FolderMapping,
		existingSourcePaths: Set<string>
	): Promise<{ processed: number; skipped: number; errors: number }> {
		let processed = 0;
		let skipped = 0;
		let errors = 0;

		const targetBase = toVaultPath(mapping.targetFolder);
		const vaultFiles = await this.walkVaultTargetFiles(targetBase);

		for (const vaultFilePath of vaultFiles) {
			const normalizedVaultPath = toVaultPath(vaultFilePath);

			// Calculate relative path from target folder
			const prefix = targetBase.endsWith("/") ? targetBase : targetBase + "/";
			if (!normalizedVaultPath.startsWith(prefix)) continue;
			const relativePath = normalizedVaultPath.slice(prefix.length);
			if (!relativePath) continue;

			// Check extension filter
			if (!isAllowedByExtensions(relativePath, mapping.fileExtensions ?? [])) continue;

			// Check exclusion patterns
			if (isPathExcluded(relativePath, mapping.excludePatterns ?? [])) continue;

			// Skip files that already exist in source
			if (existingSourcePaths.has(relativePath)) continue;

			// This vault file doesn't exist in source — reverse sync it
			try {
				const result = await this.syncFileReverseInternal(mapping, normalizedVaultPath);
				if (result.ok && result.action === "processed") {
					processed++;
					existingSourcePaths.add(relativePath);
					LogService.debug("Reconcile", `Reverse-synced vault-only file to source`, {
						mappingId: mapping.id,
						filePath: normalizedVaultPath,
					});
				} else if (result.ok) {
					skipped++;
					// Still protect from orphan cleanup
					existingSourcePaths.add(relativePath);
				} else {
					errors++;
					LogService.warn("Reconcile", `Failed to reverse-sync: ${result.error?.message}`, {
						mappingId: mapping.id,
						filePath: normalizedVaultPath,
					});
				}
			} catch (e) {
				errors++;
				LogService.error("Reconcile", `Reverse reconcile error: ${String(e)}`, {
					mappingId: mapping.id,
					filePath: normalizedVaultPath,
				});
			}
		}

		if (processed > 0) {
			LogService.info("Reconcile", `Reverse-synced ${processed} vault-only files to source`, {
				mappingId: mapping.id,
			});
		}

		return { processed, skipped, errors };
	}

	// ===========================
	// Utilities: misc
	// ===========================
	private clampNumber(n: number, min: number, max: number): number {
		if (!Number.isFinite(n)) return min;
		return Math.max(min, Math.min(max, n));
	}

}

// Re-export for backwards compatibility
export { PathTraversalError, type RetryConfig } from "./retry";
