import * as fsp from "fs/promises";
import * as path from "path";
import type { App } from "obsidian";
import { LogService } from "./LogService";

/**
 * Metadata for a single synced file.
 * Stores enough information to determine if the source file has changed.
 */
export interface SyncedFileInfo {
	/** Source file modification time (milliseconds since epoch) */
	sourceMtimeMs: number;
	/** Source file size in bytes */
	sourceSize: number;
	/** Timestamp when this file was last successfully synced */
	lastSyncedAt: number;
}

/**
 * Sync state for a single folder mapping.
 */
export interface MappingSyncState {
	/** Mapping ID for validation */
	mappingId: string;
	/** Source folder path for validation */
	sourceFolder: string;
	/** Timestamp of last completed reconciliation */
	lastReconcileAt: number | null;
	/** Per-file sync state, keyed by relative path from source folder */
	files: Record<string, SyncedFileInfo>;
}

/**
 * Root structure for the persisted sync state.
 */
export interface SyncStateStore {
	/** Schema version for future migrations */
	version: 1;
	/** Per-mapping sync state, keyed by mapping ID */
	mappings: Record<string, MappingSyncState>;
}

/**
 * Service for tracking and persisting sync state.
 *
 * @remarks
 * The SyncStateService maintains metadata about which files have been
 * synchronized and when. This enables incremental reconciliation by
 * allowing the system to skip files that haven't changed since the
 * last successful sync.
 *
 * State is persisted to a JSON file in the plugin's data directory
 * and loaded on startup. The service handles:
 * - Recording successful file syncs with source file metadata
 * - Checking if a file needs to be synced (has changed since last sync)
 * - Recording completed reconciliations
 * - Cleaning up orphaned entries for deleted files
 *
 * @example
 * ```typescript
 * const syncState = new SyncStateService(app, pluginId);
 * await syncState.load();
 *
 * // Check if file needs sync
 * const needsSync = await syncState.needsSync(mappingId, relativePath, sourceStat);
 *
 * // Record successful sync
 * syncState.recordSync(mappingId, relativePath, sourceStat);
 *
 * // Save periodically
 * await syncState.save();
 * ```
 *
 * @category Services
 */
export class SyncStateService {
	private state: SyncStateStore = {
		version: 1,
		mappings: {},
	};

	/** Path to the persisted state file */
	private stateFilePath: string;

	/** Dirty flag to track unsaved changes */
	private dirty = false;

	/** Maximum files to track per mapping (prevents unbounded growth) */
	private static readonly MAX_FILES_PER_MAPPING = 100000;

	/** Debounce timer for auto-save */
	private saveTimer: ReturnType<typeof setTimeout> | null = null;

	/** Auto-save delay in milliseconds */
	private static readonly AUTO_SAVE_DELAY_MS = 5000;

	constructor(
		private app: App,
		private pluginId: string
	) {
		// State file lives in plugin data folder
		const configDir = (this.app.vault.adapter as any).basePath ?? "";
		this.stateFilePath = path.join(
			configDir,
			".obsidian",
			"plugins",
			this.pluginId,
			"sync-state.json"
		);
	}

	/**
	 * Load sync state from disk.
	 * Creates empty state if file doesn't exist.
	 */
	async load(): Promise<void> {
		try {
			const content = await fsp.readFile(this.stateFilePath, "utf-8");
			const parsed = JSON.parse(content);

			// Validate version
			if (parsed.version === 1) {
				this.state = parsed;
				LogService.debug("SyncState", "Loaded sync state", {
					details: {
						mappingCount: Object.keys(this.state.mappings).length,
					},
				});
			} else {
				LogService.warn("SyncState", "Unknown state version, starting fresh", {
					details: { version: parsed.version },
				});
			}
		} catch (e) {
			if ((e as NodeJS.ErrnoException).code === "ENOENT") {
				LogService.debug("SyncState", "No existing state file, starting fresh");
			} else {
				LogService.warn("SyncState", "Failed to load state, starting fresh", {
					details: { error: String(e) },
				});
			}
		}

		this.dirty = false;
	}

	/**
	 * Save sync state to disk.
	 */
	async save(): Promise<void> {
		if (!this.dirty) return;

		try {
			// Ensure directory exists
			const dir = path.dirname(this.stateFilePath);
			await fsp.mkdir(dir, { recursive: true });

			// Write atomically via temp file
			const tmpPath = `${this.stateFilePath}.tmp`;
			await fsp.writeFile(tmpPath, JSON.stringify(this.state, null, 2));
			await fsp.rename(tmpPath, this.stateFilePath);

			this.dirty = false;
			LogService.debug("SyncState", "Saved sync state");
		} catch (e) {
			LogService.error("SyncState", "Failed to save state", {
				details: { error: String(e) },
			});
		}
	}

	/**
	 * Schedule auto-save after a delay.
	 * Multiple calls within the delay window are coalesced.
	 */
	private scheduleSave(): void {
		if (this.saveTimer) return;

		this.saveTimer = setTimeout(async () => {
			this.saveTimer = null;
			await this.save();
		}, SyncStateService.AUTO_SAVE_DELAY_MS);
	}

	/**
	 * Cancel any pending auto-save.
	 */
	cancelPendingSave(): void {
		if (this.saveTimer) {
			clearTimeout(this.saveTimer);
			this.saveTimer = null;
		}
	}

	/**
	 * Get or create the sync state for a mapping.
	 */
	private getOrCreateMappingState(
		mappingId: string,
		sourceFolder: string
	): MappingSyncState {
		let state: MappingSyncState | undefined = this.state.mappings[mappingId];

		// If source folder changed, invalidate the old state
		if (state && state.sourceFolder !== sourceFolder) {
			LogService.info("SyncState", "Source folder changed, resetting state", {
				mappingId,
				details: {
					old: state.sourceFolder,
					new: sourceFolder,
				},
			});
			state = undefined;
		}

		if (!state) {
			state = {
				mappingId,
				sourceFolder,
				lastReconcileAt: null,
				files: {},
			};
			this.state.mappings[mappingId] = state;
			this.dirty = true;
		}

		return state;
	}

	/**
	 * Check if a file needs to be synced based on stored state.
	 *
	 * @param mappingId - The folder mapping ID
	 * @param sourceFolder - Absolute path to source folder (for validation)
	 * @param relativePath - Relative path from source folder
	 * @param sourceStat - Current source file stats
	 * @returns true if the file should be synced, false if unchanged
	 */
	needsSync(
		mappingId: string,
		sourceFolder: string,
		relativePath: string,
		sourceStat: { mtimeMs: number; size: number }
	): boolean {
		const mappingState = this.state.mappings[mappingId];

		// No state for this mapping - needs sync
		if (!mappingState) return true;

		// Source folder changed - needs sync
		if (mappingState.sourceFolder !== sourceFolder) return true;

		const fileInfo = mappingState.files[relativePath];

		// Never synced - needs sync
		if (!fileInfo) return true;

		// Check if source file changed
		if (
			fileInfo.sourceMtimeMs !== sourceStat.mtimeMs ||
			fileInfo.sourceSize !== sourceStat.size
		) {
			return true;
		}

		// File unchanged
		return false;
	}

	/**
	 * Record a successful file sync.
	 *
	 * @param mappingId - The folder mapping ID
	 * @param sourceFolder - Absolute path to source folder
	 * @param relativePath - Relative path from source folder
	 * @param sourceStat - Source file stats at time of sync
	 */
	recordSync(
		mappingId: string,
		sourceFolder: string,
		relativePath: string,
		sourceStat: { mtimeMs: number; size: number }
	): void {
		const state = this.getOrCreateMappingState(mappingId, sourceFolder);

		// Enforce size limit
		if (
			Object.keys(state.files).length >= SyncStateService.MAX_FILES_PER_MAPPING &&
			!state.files[relativePath]
		) {
			LogService.warn("SyncState", "Max files per mapping reached, not recording", {
				mappingId,
				details: { limit: SyncStateService.MAX_FILES_PER_MAPPING },
			});
			return;
		}

		state.files[relativePath] = {
			sourceMtimeMs: sourceStat.mtimeMs,
			sourceSize: sourceStat.size,
			lastSyncedAt: Date.now(),
		};

		this.dirty = true;
		this.scheduleSave();
	}

	/**
	 * Record completion of a full reconciliation.
	 *
	 * @param mappingId - The folder mapping ID
	 * @param sourceFolder - Absolute path to source folder
	 */
	recordReconcileComplete(mappingId: string, sourceFolder: string): void {
		const state = this.getOrCreateMappingState(mappingId, sourceFolder);
		state.lastReconcileAt = Date.now();
		this.dirty = true;
		this.scheduleSave();
	}

	/**
	 * Get the timestamp of the last completed reconciliation.
	 *
	 * @param mappingId - The folder mapping ID
	 * @returns Timestamp in ms, or null if never reconciled
	 */
	getLastReconcileTime(mappingId: string): number | null {
		return this.state.mappings[mappingId]?.lastReconcileAt ?? null;
	}

	/**
	 * Get the number of tracked files for a mapping.
	 */
	getTrackedFileCount(mappingId: string): number {
		return Object.keys(this.state.mappings[mappingId]?.files ?? {}).length;
	}

	/**
	 * Remove tracking for files that no longer exist in source.
	 * Call after reconciliation to clean up orphaned entries.
	 *
	 * @param mappingId - The folder mapping ID
	 * @param existingPaths - Set of relative paths that currently exist
	 */
	pruneOrphans(mappingId: string, existingPaths: Set<string>): number {
		const state = this.state.mappings[mappingId];
		if (!state) return 0;

		let pruned = 0;
		for (const relPath of Object.keys(state.files)) {
			if (!existingPaths.has(relPath)) {
				delete state.files[relPath];
				pruned++;
			}
		}

		if (pruned > 0) {
			this.dirty = true;
			LogService.debug("SyncState", "Pruned orphaned entries", {
				mappingId,
				details: { pruned },
			});
		}

		return pruned;
	}

	/**
	 * Remove a single file's tracking entry.
	 * Call after a file is deleted or moved.
	 */
	removeEntry(mappingId: string, relativePath: string): void {
		const state = this.state.mappings[mappingId];
		if (!state) return;
		if (state.files[relativePath]) {
			delete state.files[relativePath];
			this.dirty = true;
			this.scheduleSave();
		}
	}

	/**
	 * Get stored file info for a tracked file.
	 * Used by move detection to look up last known file size.
	 */
	getFileInfo(mappingId: string, relativePath: string): SyncedFileInfo | undefined {
		return this.state.mappings[mappingId]?.files[relativePath];
	}

	/**
	 * Clear all state for a mapping.
	 * Call when a mapping is deleted.
	 */
	clearMapping(mappingId: string): void {
		if (this.state.mappings[mappingId]) {
			delete this.state.mappings[mappingId];
			this.dirty = true;
			LogService.debug("SyncState", "Cleared mapping state", { mappingId });
		}
	}

	/**
	 * Clear all state.
	 * Useful for "force full reconcile" functionality.
	 */
	clearAll(): void {
		this.state = {
			version: 1,
			mappings: {},
		};
		this.dirty = true;
		LogService.info("SyncState", "Cleared all sync state");
	}

	/**
	 * Check if there is any stored state.
	 */
	hasState(): boolean {
		return Object.keys(this.state.mappings).length > 0;
	}

	/**
	 * Get summary statistics for debugging.
	 */
	getStats(): { mappingCount: number; totalFiles: number } {
		const mappingCount = Object.keys(this.state.mappings).length;
		const totalFiles = Object.values(this.state.mappings).reduce(
			(sum, m) => sum + Object.keys(m.files).length,
			0
		);
		return { mappingCount, totalFiles };
	}
}
