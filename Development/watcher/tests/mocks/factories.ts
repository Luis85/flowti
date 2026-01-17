/**
 * Centralized mock factories for testing.
 * Provides consistent mock creation across all test files.
 */

import { vi } from "vitest";
import type { ILogService, LogLevel, LogEntry, LogCategory, LogFilter, LogOptions } from "../../src/services/LogService";
import type { IMappingWatcherContext } from "../../src/watcher/MappingWatcher";
import type { IReconcileContext, IStatusBarContext, IFileSyncService } from "../../src/services/types";
import type { IWatcherManagerContext } from "../../src/watcher/WatcherManager";
import type { FolderMapping, WatcherStats, ReconcileProgress } from "../../src/types";
import type { FileWatcherSettings } from "../../src/settings/types";

// ===========================
// Obsidian Mocks
// ===========================

/**
 * Create a mock Obsidian Vault Adapter with in-memory file storage
 */
export function createMockVaultAdapter() {
	const files = new Map<string, { content: ArrayBuffer; mtime: number; size: number }>();
	const folders = new Set<string>();

	return {
		files,
		folders,

		exists: vi.fn(async (path: string) => {
			return files.has(path) || folders.has(path);
		}),

		stat: vi.fn(async (path: string) => {
			const file = files.get(path);
			if (!file) return null;
			return { mtime: file.mtime, size: file.size, ctime: file.mtime };
		}),

		list: vi.fn(async (path: string) => {
			const fileList: string[] = [];
			const folderList: string[] = [];

			for (const f of files.keys()) {
				if (f.startsWith(path + "/") || path === "") {
					fileList.push(f);
				}
			}

			for (const f of folders) {
				if (f.startsWith(path + "/") || path === "") {
					folderList.push(f);
				}
			}

			return { files: fileList, folders: folderList };
		}),

		writeBinary: vi.fn(async (path: string, data: ArrayBuffer) => {
			files.set(path, {
				content: data,
				mtime: Date.now(),
				size: data.byteLength,
			});
		}),

		read: vi.fn(async (path: string) => {
			const file = files.get(path);
			if (!file) throw new Error("File not found");
			return new TextDecoder().decode(file.content);
		}),

		readBinary: vi.fn(async (path: string) => {
			const file = files.get(path);
			if (!file) throw new Error("File not found");
			return file.content;
		}),
	};
}

/**
 * Create a mock Obsidian Vault
 */
export function createMockVault(adapter = createMockVaultAdapter()) {
	return {
		adapter,

		createFolder: vi.fn(async (path: string) => {
			adapter.folders.add(path);
		}),

		getAbstractFileByPath: vi.fn((path: string) => {
			if (adapter.files.has(path)) {
				return { path, name: path.split("/").pop() };
			}
			if (adapter.folders.has(path)) {
				return { path, name: path.split("/").pop(), children: [] };
			}
			return null;
		}),
	};
}

/**
 * Create a mock Obsidian App
 */
export function createMockApp(vault = createMockVault()) {
	return {
		vault,
	};
}

// ===========================
// Settings Mocks
// ===========================

type MockSettingsOverrides = Partial<FileWatcherSettings>;

/**
 * Create mock FileWatcher settings
 */
export function createMockSettings(overrides: MockSettingsOverrides = {}): FileWatcherSettings {
	return {
		folderMappings: [],
		ignoreOneDriveTemp: true,
		verifyFileStability: false,
		stabilityCheckInterval: 500,
		stabilityChecks: 3,
		syncOnStart: true,
		debugMode: false,
		reconcile: {
			parallelism: 4,
			progressThrottleMs: 250,
			fastSkipUnchanged: true,
			disableStabilityCheckDuringReconcile: true,
			notifyOnMappingDone: false,
		},
		...overrides,
	};
}

// ===========================
// FolderMapping Mocks
// ===========================

type MockMappingOverrides = Partial<FolderMapping>;

/**
 * Create a mock FolderMapping
 */
export function createMockMapping(overrides: MockMappingOverrides = {}): FolderMapping {
	return {
		id: "test-mapping",
		enabled: true,
		sourceFolder: "/source",
		targetFolder: "target",
		watchSubfolders: true,
		fileExtensions: [],
		conflictResolution: "overwrite",
		debounceDelay: 500,
		description: "Test Mapping",
		reconcileOnStart: true,
		...overrides,
	};
}

// ===========================
// Stats Mocks
// ===========================

/**
 * Create mock WatcherStats
 */
export function createMockStats(overrides: Partial<WatcherStats> = {}): WatcherStats {
	return {
		filesProcessed: 0,
		filesSkipped: 0,
		errors: 0,
		lastProcessed: null,
		perMappingStats: {},
		...overrides,
	};
}

// ===========================
// Context Mocks
// ===========================

/**
 * Create a mock IMappingWatcherContext for testing MappingWatcher
 */
export function createMockMappingWatcherContext(
	overrides: Partial<IMappingWatcherContext> = {}
): IMappingWatcherContext {
	return {
		settings: createMockSettings(),
		stats: createMockStats(),
		bumpProcessed: vi.fn(),
		bumpSkipped: vi.fn(),
		bumpError: vi.fn(),
		applyReconcileStats: vi.fn(),
		syncFile: vi.fn().mockResolvedValue(undefined),
		fileSync: {
			reconcileFolder: vi.fn().mockResolvedValue({
				scanned: 0,
				processed: 0,
				skipped: 0,
				errors: 0,
			}),
		},
		...overrides,
	};
}

/**
 * Create a mock IReconcileContext for testing ReconcileService
 */
export function createMockReconcileContext(
	overrides: Partial<IReconcileContext> = {}
): IReconcileContext {
	return {
		settings: createMockSettings(),
		applyReconcileStats: vi.fn(),
		setReconcileSnapshot: vi.fn(),
		statusbar: {
			setReconcileProgress: vi.fn(),
			clearReconcileProgress: vi.fn(),
			onStatsChanged: vi.fn(),
		},
		...overrides,
	};
}

/**
 * Create a mock IStatusBarContext for testing StatusBarService
 */
export function createMockStatusBarContext(
	overrides: Partial<IStatusBarContext> = {}
): IStatusBarContext {
	const mockElement = {
		addClass: vi.fn(),
		setText: vi.fn(),
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
		detach: vi.fn(),
	} as unknown as HTMLElement;

	return {
		settings: createMockSettings(),
		stats: createMockStats(),
		getActiveWatcherCount: vi.fn().mockReturnValue(0),
		openDashboard: vi.fn(),
		addStatusBarItem: vi.fn().mockReturnValue(mockElement),
		...overrides,
	};
}

/**
 * Create a mock IWatcherManagerContext for testing WatcherManager
 */
export function createMockWatcherManagerContext(
	overrides: Partial<IWatcherManagerContext> = {}
): IWatcherManagerContext {
	return {
		app: createMockApp() as any,
		settings: createMockSettings(),
		statusbar: {
			onStatsChanged: vi.fn(),
			setReconcileProgress: vi.fn(),
			clearReconcileProgress: vi.fn(),
		},
		watcherContext: createMockMappingWatcherContext(),
		...overrides,
	};
}

/**
 * Create a mock IFileSyncService for testing ReconcileService
 */
export function createMockFileSyncService(
	overrides: Partial<IFileSyncService> = {}
): IFileSyncService {
	return {
		reconcileMapping: vi.fn().mockResolvedValue({
			scanned: 0,
			processed: 0,
			skipped: 0,
			errors: 0,
		}),
		getOperationLock: vi.fn().mockReturnValue({
			acquireReconcile: vi.fn().mockResolvedValue(() => {}),
			acquireWatcher: vi.fn().mockResolvedValue(() => {}),
		}),
		...overrides,
	};
}

// ===========================
// LogService Mocks
// ===========================

/**
 * Create a mock ILogService that records all calls for verification
 */
export function createMockLogService(): ILogService & { calls: LogEntry[] } {
	const calls: LogEntry[] = [];
	let nextId = 1;

	const createEntry = (level: LogLevel, category: LogCategory, message: string, options?: LogOptions): LogEntry => {
		const entry: LogEntry = {
			id: nextId++,
			timestamp: new Date(),
			level,
			category,
			message,
			details: options?.details,
			mappingId: options?.mappingId,
			filePath: options?.filePath,
		};
		calls.push(entry);
		return entry;
	};

	return {
		calls,
		configure: vi.fn(),
		isDebugEnabled: vi.fn().mockReturnValue(false),
		setDebugEnabled: vi.fn(),
		log: vi.fn((level, category, message, options) => createEntry(level, category, message, options)),
		debug: vi.fn((category, message, options) => createEntry("debug", category, message, options)),
		info: vi.fn((category, message, options) => createEntry("info", category, message, options)),
		warn: vi.fn((category, message, options) => createEntry("warn", category, message, options)),
		error: vi.fn((category, message, options) => createEntry("error", category, message, options)),
		getLogs: vi.fn((filter?: LogFilter) => {
			if (!filter) return [...calls];
			return calls.filter(e => {
				if (filter.levels && !filter.levels.includes(e.level)) return false;
				if (filter.categories && !filter.categories.includes(e.category)) return false;
				if (filter.mappingId && e.mappingId !== filter.mappingId) return false;
				return true;
			});
		}),
		getRecentLogs: vi.fn((count: number) => calls.slice(-count).reverse()),
		getCounts: vi.fn(() => {
			const counts = { debug: 0, info: 0, warn: 0, error: 0 };
			for (const e of calls) counts[e.level]++;
			return counts;
		}),
		getErrorCountSince: vi.fn((since: Date) =>
			calls.filter(e => e.level === "error" && e.timestamp >= since).length
		),
		clear: vi.fn(() => { calls.length = 0; }),
		subscribe: vi.fn(() => () => {}),
		exportAsJson: vi.fn(() => JSON.stringify(calls)),
		dumpHistory: vi.fn(),
		count: 0,
	};
}

/**
 * Create a no-op ILogService that does nothing (for tests that don't care about logging)
 */
export function createNoOpLogService(): ILogService {
	return {
		configure: () => {},
		isDebugEnabled: () => false,
		setDebugEnabled: () => {},
		log: () => null,
		debug: () => null,
		info: () => null,
		warn: () => null,
		error: () => null,
		getLogs: () => [],
		getRecentLogs: () => [],
		getCounts: () => ({ debug: 0, info: 0, warn: 0, error: 0 }),
		getErrorCountSince: () => 0,
		clear: () => {},
		subscribe: () => () => {},
		exportAsJson: () => "[]",
		dumpHistory: () => {},
		count: 0,
	};
}

// ===========================
// File System Mock Helpers
// ===========================

/**
 * In-memory file system mock state
 */
export interface MockFileSystem {
	files: Map<string, { content: Buffer; mtime: number; size: number }>;
	dirs: Set<string>;
}

/**
 * Create a new in-memory file system
 */
export function createMockFileSystem(): MockFileSystem {
	return {
		files: new Map(),
		dirs: new Set(),
	};
}

/**
 * Add a file to the mock file system
 */
export function addMockFile(
	fs: MockFileSystem,
	path: string,
	content: string,
	mtime = Date.now()
) {
	const buffer = Buffer.from(content);
	fs.files.set(path, { content: buffer, mtime, size: buffer.length });
}

/**
 * Add a directory to the mock file system
 */
export function addMockDir(fs: MockFileSystem, path: string) {
	fs.dirs.add(path);
}

/**
 * Clear all files and directories from the mock file system
 */
export function clearMockFileSystem(fs: MockFileSystem) {
	fs.files.clear();
	fs.dirs.clear();
}
