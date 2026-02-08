import type * as fs from "fs";
import { ReconcileProgress, FolderMapping, ReconcileStats, SyncResult, WatcherStats } from "src/types";
import { OperationLock } from "./AsyncMutex";
import { FileWatcherSettings } from "src/settings/types";

export type ReconcileCallbacks = {
	onProgress?: (
		p: ReconcileProgress,
		meta: { mappingIndex: number; mappingTotal: number }
	) => void;
	onMappingDone?: (mapping: FolderMapping, stats: ReconcileStats) => void;
};

/** Progress data emitted by FileSyncService during reconcile.
 * Extends ReconcileStats with total count and current file info.
 */
export type ReconcileMappingProgress = ReconcileStats & {
	total: number;
	current?: string;
};

/** Interface for the file sync service used by ReconcileService */
export interface IFileSyncService {
	reconcileMapping(
		mapping: FolderMapping,
		onProgress?: (p: ReconcileMappingProgress) => void
	): Promise<ReconcileStats>;

	/** Get the operation lock for coordinating with watchers */
	getOperationLock(): OperationLock;
}

/**
 * Context required by ReconcileService.
 * Allows for better testability by injecting only what's needed.
 */
export interface IReconcileContext {
	/** Plugin settings (read-only access) */
	readonly settings: FileWatcherSettings;

	/** Apply stats from reconcile operation to plugin stats */
	applyReconcileStats(
		mappingId: string,
		stats: { processed: number; skipped: number; errors: number; deleted?: number }
	): void;

	/** Set the current reconcile progress snapshot (for UI) */
	setReconcileSnapshot?(p: ReconcileProgress | null): void;

	/** Optional status bar service for progress display */
	statusbar?: {
		setReconcileProgress?(
			p: ReconcileProgress,
			meta: { mappingIndex: number; mappingTotal: number }
		): void;
		clearReconcileProgress?(): void;
		onStatsChanged(): void;
	};
}

/**
 * Context required by StatusBarService.
 * Allows for better testability by injecting only what's needed.
 */
export interface IStatusBarContext {
	/** Plugin settings (read-only access) */
	readonly settings: FileWatcherSettings;

	/** Plugin stats (read-only access) */
	readonly stats: WatcherStats;

	/** Get the active watcher count */
	getActiveWatcherCount(): number;

	/** Open the dashboard modal */
	openDashboard?(): void;

	/** Add a status bar item to the plugin */
	addStatusBarItem(): HTMLElement;
}

// ===========================
// Shared internal types for FileSyncService & ReconcileWorkerPool
// ===========================

/** Cache of already-ensured vault folders to avoid redundant exists checks */
export type EnsuredFolderCache = {
	ensured: Set<string>;
};

/** Pre-built index of target folder contents for fast exists/stat lookups */
export type TargetIndex = {
	exists: Set<string>;
	statByPath: Map<string, { mtimeMs: number; size: number }>;
};

/** Options passed to the internal sync function during reconciliation */
export interface SyncInternalOpts {
	verifyStability: boolean;
	skipUnchanged: boolean;
	ensuredFolders: EnsuredFolderCache;
	targetIndex?: TargetIndex;
}

/** A file entry queued for reconcile processing */
export interface ReconcileFileEntry {
	filePath: string;
	relativePath: string;
	stat?: fs.Stats;
}
