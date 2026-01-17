import { ReconcileProgress, FolderMapping, ReconcileStats, WatcherStats } from "src/types";
import { OperationLock } from "./AsyncMutex";
import { FileWatcherSettings } from "src/settings/types";

export type ReconcileCallbacks = {
	onProgress?: (
		p: ReconcileProgress,
		meta: { mappingIndex: number; mappingTotal: number }
	) => void;
	onMappingDone?: (mapping: FolderMapping, stats: ReconcileStats) => void;
};

/** Progress data emitted by FileSyncService during reconcile */
export type ReconcileMappingProgress = {
	total: number;
	scanned: number;
	processed: number;
	skipped: number;
	errors: number;
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
		stats: { processed: number; skipped: number; errors: number }
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
