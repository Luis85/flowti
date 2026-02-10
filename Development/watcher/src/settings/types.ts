import { FolderMapping } from "src/types";

export interface ReconcileOptions {
	// How many files to process in parallel during reconcile (I/O bound)
	parallelism: number; // e.g. 4..16

	// UI update throttle (ms). Lower = smoother UI, higher = faster reconcile
	progressThrottleMs: number; // e.g. 100..1000

	// If enabled, only copy when source is newer OR target missing (fast path)
	fastSkipUnchanged: boolean;

	// If enabled, skip stability checks during reconcile (usually safe & huge speedup)
	disableStabilityCheckDuringReconcile: boolean;

	// If enabled, show per-mapping done notice
	notifyOnMappingDone: boolean;

	// If enabled, use incremental reconciliation (only sync files changed since last reconcile)
	incrementalMode: boolean;
}

export interface FileWatcherSettings {
	folderMappings: FolderMapping[];
	ignoreOneDriveTemp: boolean;
	verifyFileStability: boolean;
	stabilityCheckInterval: number;
	stabilityChecks: number;
	syncOnStart: boolean;
	reconcile: ReconcileOptions;
	debugMode: boolean;
	/** When true, plugin notifications (notices) are displayed */
	showNotifications: boolean;
}

export const DEFAULT_SETTINGS: FileWatcherSettings = {
	folderMappings: [],
	ignoreOneDriveTemp: true,
	verifyFileStability: true,
	stabilityCheckInterval: 500,
	stabilityChecks: 3,
	syncOnStart: true,
	debugMode: false,
	showNotifications: true,

	reconcile: {
		parallelism: 8,
		progressThrottleMs: 250,
		fastSkipUnchanged: true,
		disableStabilityCheckDuringReconcile: true,
		notifyOnMappingDone: true,
		incrementalMode: true,
	},
};
