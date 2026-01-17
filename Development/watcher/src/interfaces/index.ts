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

// Re-export LogService interface and factories from services
export type { ILogService, LogLevel, LogCategory, LogEntry, LogFilter, LogOptions } from "../services/LogService";
export { createLogService, createNoOpLogService } from "../services/LogService";

// Re-export NoticeService interface and factories from services
export type { INoticeService } from "../services/NoticeService";
export { createNoticeService, createNoOpNoticeService, createMockNoticeService } from "../services/NoticeService";
