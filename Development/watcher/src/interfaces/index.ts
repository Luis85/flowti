// Plugin context interfaces
export type {
	IStatsTracker,
	IReconcileProgressReporter,
	ISettingsProvider,
	IFileSyncOperations,
	IStatusBar,
	IPluginContext,
	IPluginContextWithFileSync,
	IFileSyncServiceExtended,
} from "./IPluginContext";

// File system interfaces
export type { IFileSystem, IFileStat, IDirent } from "./IFileSystem";
export { NodeFileSystem, defaultFileSystem } from "./IFileSystem";
