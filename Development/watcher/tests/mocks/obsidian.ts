import { vi } from "vitest";

/**
 * Mock Obsidian Vault Adapter
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
 * Mock Obsidian Vault
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
 * Mock Obsidian App
 */
export function createMockApp(vault = createMockVault()) {
	return {
		vault,
	};
}

/**
 * Mock FileWatcher Settings
 */
export function createMockSettings(overrides: Partial<MockSettings> = {}): MockSettings {
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

type MockSettings = {
	folderMappings: any[];
	ignoreOneDriveTemp: boolean;
	verifyFileStability: boolean;
	stabilityCheckInterval: number;
	stabilityChecks: number;
	syncOnStart: boolean;
	debugMode: boolean;
	reconcile: {
		parallelism: number;
		progressThrottleMs: number;
		fastSkipUnchanged: boolean;
		disableStabilityCheckDuringReconcile: boolean;
		notifyOnMappingDone: boolean;
	};
};

/**
 * Create a mock FolderMapping
 */
export function createMockMapping(overrides: Partial<MockMapping> = {}): MockMapping {
	return {
		id: "test-mapping",
		enabled: true,
		sourceFolder: "/source",
		targetFolder: "target",
		watchSubfolders: true,
		fileExtensions: [],
		conflictResolution: "overwrite" as const,
		debounceDelay: 500,
		description: "Test Mapping",
		reconcileOnStart: true,
		...overrides,
	};
}

type MockMapping = {
	id: string;
	enabled: boolean;
	sourceFolder: string;
	targetFolder: string;
	watchSubfolders: boolean;
	fileExtensions: string[];
	conflictResolution: "overwrite" | "rename" | "skip" | "keepNewer";
	debounceDelay: number;
	description: string;
	reconcileOnStart: boolean;
	usePolling?: boolean;
	pollingInterval?: number;
};
