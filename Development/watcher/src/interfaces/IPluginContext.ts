import type { App } from "obsidian";
import type {
	FolderMapping,
	ChangeType,
	WatcherStats,
	ReconcileProgress,
	ReconcileStats,
} from "../types";
import type { ReconcileMappingProgress } from "../services/types";
import type { FileWatcherSettings } from "../settings/types";

/**
 * Stats tracking interface for the plugin.
 * Allows services to update statistics without direct plugin coupling.
 */
export interface IStatsTracker {
	/** Increment processed count for a mapping */
	bumpProcessed(mappingId: string, filePath?: string): void;

	/** Increment skipped count for a mapping */
	bumpSkipped(mappingId: string): void;

	/** Increment error count for a mapping */
	bumpError(mappingId: string): void;

	/** Apply bulk stats from a reconcile operation */
	applyReconcileStats(
		mappingId: string,
		stats: { processed: number; skipped: number; errors: number }
	): void;

	/** Get current stats (read-only) */
	readonly stats: WatcherStats;
}

/**
 * Reconcile snapshot management interface.
 * Used by services to report reconcile progress.
 */
export interface IReconcileProgressReporter {
	/** Set the current reconcile progress snapshot */
	setReconcileSnapshot(p: ReconcileProgress | null): void;

	/** Get the current reconcile progress snapshot */
	getReconcileSnapshot(): ReconcileProgress | null;
}

/**
 * Settings provider interface.
 * Provides read-only access to plugin settings.
 */
export interface ISettingsProvider {
	/** Get current settings (read-only access recommended) */
	readonly settings: FileWatcherSettings;
}

/**
 * File sync operation interface.
 * Used by MappingWatcher to sync individual files.
 */
export interface IFileSyncOperations {
	/** Sync a single file from source to vault */
	syncFile(
		mapping: FolderMapping,
		sourceFilePath: string,
		changeType: ChangeType
	): Promise<void>;
}

/**
 * Status bar service interface.
 * Abstracts UI updates for testability.
 */
export interface IStatusBar {
	/** Notify that stats have changed */
	onStatsChanged(): void;

	/** Set reconcile progress display */
	setReconcileProgress?(
		p: ReconcileProgress,
		meta: { mappingIndex: number; mappingTotal: number }
	): void;

	/** Clear reconcile progress display */
	clearReconcileProgress?(): void;
}

/**
 * Combined plugin context for services that need multiple capabilities.
 * This is the main interface services should depend on instead of the concrete plugin.
 */
export interface IPluginContext
	extends IStatsTracker,
		IReconcileProgressReporter,
		ISettingsProvider,
		IFileSyncOperations {
	/** Obsidian App instance (for vault access) */
	readonly app: App;

	/** Optional status bar service */
	readonly statusbar?: IStatusBar;
}

/**
 * Extended plugin context for services that need file sync service access.
 * Used by MappingWatcher for reconcileFolder operations.
 */
export interface IPluginContextWithFileSync extends IPluginContext {
	/** Direct access to file sync service for reconcileFolder */
	readonly fileSync: IFileSyncServiceExtended;
}

/**
 * Extended file sync service interface with reconcileFolder support.
 */
export interface IFileSyncServiceExtended {
	/** Reconcile a specific folder within a mapping */
	reconcileFolder(
		mapping: FolderMapping,
		folderAbsPath: string,
		onProgress?: (p: ReconcileMappingProgress) => void
	): Promise<ReconcileStats>;

	/** Check if a file was recently synced (for loop prevention) */
	isRecentlySynced(filePath: string): boolean;
}
