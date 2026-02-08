import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
	createMockApp,
	createMockSettings,
	createMockMapping,
	createMockVaultAdapter,
	createMockVault,
} from "../mocks/factories";

// Create mock filesystem data using vi.hoisted so mocks can access them
const { mockFiles, mockDirs } = vi.hoisted(() => ({
	mockFiles: new Map<string, { content: Buffer; mtime: number; size: number }>(),
	mockDirs: new Set<string>(),
}));

// Mock the fs module
vi.mock("fs", () => ({
	existsSync: vi.fn((path: string) => mockFiles.has(path) || mockDirs.has(path)),
	readFileSync: vi.fn((path: string) => {
		const file = mockFiles.get(path);
		if (!file) throw new Error(`ENOENT: no such file: ${path}`);
		return file.content;
	}),
	statSync: vi.fn((path: string) => {
		const file = mockFiles.get(path);
		if (!file) throw new Error(`ENOENT: no such file: ${path}`);
		return { mtimeMs: file.mtime, size: file.size, isFile: () => true, isDirectory: () => false };
	}),
	readdirSync: vi.fn((path: string) => {
		const entries: any[] = [];
		for (const [filePath] of mockFiles) {
			if (filePath.startsWith(path + "/") || filePath.startsWith(path + "\\")) {
				const relativePath = filePath.slice(path.length + 1);
				const firstPart = relativePath.split(/[/\\]/)[0];
				if (!relativePath.includes("/") && !relativePath.includes("\\")) {
					entries.push({
						name: firstPart,
						isFile: () => true,
						isDirectory: () => false,
					});
				}
			}
		}
		for (const dirPath of mockDirs) {
			if (dirPath.startsWith(path + "/") || dirPath.startsWith(path + "\\")) {
				const relativePath = dirPath.slice(path.length + 1);
				const firstPart = relativePath.split(/[/\\]/)[0];
				if (!entries.some(e => e.name === firstPart)) {
					entries.push({
						name: firstPart,
						isFile: () => false,
						isDirectory: () => true,
					});
				}
			}
		}
		return entries;
	}),
}));

// Mock the fs/promises module
vi.mock("fs/promises", () => ({
	readFile: vi.fn(async (path: string) => {
		const file = mockFiles.get(path);
		if (!file) throw new Error(`ENOENT: no such file or directory, open '${path}'`);
		return file.content;
	}),
	stat: vi.fn(async (path: string) => {
		const file = mockFiles.get(path);
		if (!file) throw new Error(`ENOENT: no such file or directory, stat '${path}'`);
		return { mtimeMs: file.mtime, size: file.size, isFile: () => true, isDirectory: () => false };
	}),
	readdir: vi.fn(async (path: string) => {
		const entries: any[] = [];
		for (const [filePath] of mockFiles) {
			if (filePath.startsWith(path + "/") || filePath.startsWith(path + "\\")) {
				const relativePath = filePath.slice(path.length + 1);
				const firstPart = relativePath.split(/[/\\]/)[0];
				if (!relativePath.includes("/") && !relativePath.includes("\\")) {
					entries.push({
						name: firstPart,
						isFile: () => true,
						isDirectory: () => false,
					});
				}
			}
		}
		for (const dirPath of mockDirs) {
			if (dirPath.startsWith(path + "/") || dirPath.startsWith(path + "\\")) {
				const relativePath = dirPath.slice(path.length + 1);
				const firstPart = relativePath.split(/[/\\]/)[0];
				if (!entries.some(e => e.name === firstPart)) {
					entries.push({
						name: firstPart,
						isFile: () => false,
						isDirectory: () => true,
					});
				}
			}
		}
		return entries;
	}),
}));

// Mock the Debug service
vi.mock("../../src/services/DebugService", () => ({
	Debug: {
		debug: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
		setEnabled: vi.fn(),
	},
}));

// Import after mocks are set up
import { FileSyncService } from "../../src/services/FileSyncService";

// Helper to set up mock files
function setupMockFile(path: string, content: string, mtime = Date.now()) {
	const buffer = Buffer.from(content);
	mockFiles.set(path, { content: buffer, mtime, size: buffer.length });
}

function setupMockDir(path: string) {
	mockDirs.add(path);
}

function clearMockFs() {
	mockFiles.clear();
	mockDirs.clear();
}

// Use Windows-style paths consistently
const SOURCE_ROOT = "C:\\source";
const SOURCE_FILE1 = "C:\\source\\file1.md";
const SOURCE_FILE2 = "C:\\source\\file2.txt";
const SOURCE_SUBFOLDER = "C:\\source\\subfolder";
const SOURCE_FILE3 = "C:\\source\\subfolder\\file3.md";
const SOURCE_NONEXISTENT = "C:\\source\\nonexistent.md";

describe("FileSyncService", () => {
	let service: FileSyncService;
	let mockApp: ReturnType<typeof createMockApp>;
	let mockSettings: ReturnType<typeof createMockSettings>;
	let mockAdapter: ReturnType<typeof createMockVaultAdapter>;

	beforeEach(() => {
		// Reset mock filesystem
		clearMockFs();

		// Set up mock filesystem
		setupMockFile(SOURCE_FILE1, "# Test File 1");
		setupMockFile(SOURCE_FILE2, "Test content");
		setupMockDir(SOURCE_SUBFOLDER);
		setupMockFile(SOURCE_FILE3, "# Nested file");

		// Set up mocks
		mockAdapter = createMockVaultAdapter();
		const mockVault = createMockVault(mockAdapter);
		mockApp = createMockApp(mockVault);
		mockSettings = createMockSettings();

		service = new FileSyncService(mockApp as any, mockSettings as any);
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe("syncFile", () => {
		it("should sync a file from source to target", async () => {
			const mapping = createMockMapping({
				sourceFolder: SOURCE_ROOT,
				targetFolder: "vault/imported",
			});

			const result = await service.syncFile(mapping as any, SOURCE_FILE1);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.action).toBe("processed");
				expect(result.targetPath).toBe("vault/imported/file1.md");
			}

			// Verify file was written to vault
			expect(mockAdapter.writeBinary).toHaveBeenCalled();
		});

		it("should handle nested files correctly", async () => {
			const mapping = createMockMapping({
				sourceFolder: SOURCE_ROOT,
				targetFolder: "vault/imported",
				watchSubfolders: true,
			});

			const result = await service.syncFile(
				mapping as any,
				SOURCE_FILE3
			);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.targetPath).toBe("vault/imported/subfolder/file3.md");
			}
		});

		it("should return error for non-existent source file", async () => {
			const mapping = createMockMapping({
				sourceFolder: SOURCE_ROOT,
				targetFolder: "vault/imported",
			});

			const result = await service.syncFile(
				mapping as any,
				SOURCE_NONEXISTENT
			);

			expect(result.ok).toBe(false);
		});
	});

	describe("conflict resolution", () => {
		beforeEach(() => {
			// Pre-populate target with existing file
			mockAdapter.files.set("vault/imported/file1.md", {
				content: new TextEncoder().encode("Existing content").buffer as ArrayBuffer,
				mtime: Date.now() - 10000, // 10 seconds ago
				size: 16,
			});
		});

		it("should overwrite when strategy is 'overwrite'", async () => {
			const mapping = createMockMapping({
				sourceFolder: SOURCE_ROOT,
				targetFolder: "vault/imported",
				conflictResolution: "overwrite",
			});

			const result = await service.syncFile(mapping as any, SOURCE_FILE1);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.action).toBe("processed");
			}
			expect(mockAdapter.writeBinary).toHaveBeenCalled();
		});

		it("should skip when strategy is 'skip'", async () => {
			const mapping = createMockMapping({
				sourceFolder: SOURCE_ROOT,
				targetFolder: "vault/imported",
				conflictResolution: "skip",
			});

			const result = await service.syncFile(mapping as any, SOURCE_FILE1);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.action).toBe("skipped");
				expect(result.reason).toBe("conflict_skip");
			}
		});

		it("should keep newer when strategy is 'keepNewer' and source is newer", async () => {
			// Update source file to be newer
			setupMockFile(SOURCE_FILE1, "Updated content", Date.now());

			const mapping = createMockMapping({
				sourceFolder: SOURCE_ROOT,
				targetFolder: "vault/imported",
				conflictResolution: "keepNewer",
			});

			const result = await service.syncFile(mapping as any, SOURCE_FILE1);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.action).toBe("processed");
			}
		});

		it("should skip when strategy is 'keepNewer' and target is newer", async () => {
			// Make target newer
			mockAdapter.files.set("vault/imported/file1.md", {
				content: new TextEncoder().encode("Newer content").buffer as ArrayBuffer,
				mtime: Date.now() + 10000, // Future
				size: 13,
			});

			const mapping = createMockMapping({
				sourceFolder: SOURCE_ROOT,
				targetFolder: "vault/imported",
				conflictResolution: "keepNewer",
			});

			const result = await service.syncFile(mapping as any, SOURCE_FILE1);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.action).toBe("skipped");
			}
		});

		it("should rename when strategy is 'rename'", async () => {
			const mapping = createMockMapping({
				sourceFolder: SOURCE_ROOT,
				targetFolder: "vault/imported",
				conflictResolution: "rename",
			});

			const result = await service.syncFile(mapping as any, SOURCE_FILE1);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.action).toBe("processed");
				expect(result.targetPath).toContain("conflict");
				expect(result.targetPath).toContain(".md");
			}
		});
	});

	describe("operation lock", () => {
		it("should expose operation lock for external coordination", () => {
			const lock = service.getOperationLock();

			expect(lock).toBeDefined();
			expect(typeof lock.acquireWatcher).toBe("function");
			expect(typeof lock.acquireReconcile).toBe("function");
		});

		it("should acquire watcher lock during syncFile", async () => {
			const lock = service.getOperationLock();

			// Start reconcile to block watchers
			const releaseReconcile = await lock.acquireReconcile();

			const mapping = createMockMapping({
				sourceFolder: SOURCE_ROOT,
				targetFolder: "vault/imported",
			});

			// syncFile should wait for reconcile to complete
			const syncPromise = service.syncFile(mapping as any, SOURCE_FILE1);

			// Verify it's waiting
			let resolved = false;
			syncPromise.then(() => {
				resolved = true;
			});

			await Promise.resolve();
			expect(resolved).toBe(false);

			// Release reconcile
			releaseReconcile();

			const result = await syncPromise;
			expect(result.ok).toBe(true);
		});
	});

	describe("file-level locking", () => {
		it("should prevent concurrent writes to same file", async () => {
			const mapping = createMockMapping({
				sourceFolder: SOURCE_ROOT,
				targetFolder: "vault/imported",
			});

			// Start two syncs to the same file simultaneously
			const promise1 = service.syncFile(mapping as any, SOURCE_FILE1);
			const promise2 = service.syncFile(mapping as any, SOURCE_FILE1);

			const [result1, result2] = await Promise.all([promise1, promise2]);

			// Both should succeed (one waits for the other)
			expect(result1.ok).toBe(true);
			expect(result2.ok).toBe(true);

			// writeBinary should have been called twice (sequentially)
			expect(mockAdapter.writeBinary).toHaveBeenCalledTimes(2);
		});

		it("should allow concurrent writes to different files", async () => {
			const mapping = createMockMapping({
				sourceFolder: SOURCE_ROOT,
				targetFolder: "vault/imported",
			});

			// Start two syncs to different files
			const promise1 = service.syncFile(mapping as any, SOURCE_FILE1);
			const promise2 = service.syncFile(mapping as any, SOURCE_FILE2);

			const [result1, result2] = await Promise.all([promise1, promise2]);

			expect(result1.ok).toBe(true);
			expect(result2.ok).toBe(true);
		});
	});

	describe("updateSettings", () => {
		it("should update settings", () => {
			const newSettings = createMockSettings({
				verifyFileStability: true,
				stabilityCheckInterval: 1000,
			});

			service.updateSettings(newSettings as any);

			// Settings should be updated (verify through behavior)
			// Since verifyFileStability is now true, sync should attempt stability check
		});
	});
});

describe("path traversal protection", () => {
	let service: FileSyncService;
	let mockApp: ReturnType<typeof createMockApp>;
	let mockSettings: ReturnType<typeof createMockSettings>;
	let mockAdapter: ReturnType<typeof createMockVaultAdapter>;

	beforeEach(() => {
		clearMockFs();
		setupMockFile(SOURCE_FILE1, "# Test File 1");
		mockAdapter = createMockVaultAdapter();
		const mockVault = createMockVault(mockAdapter);
		mockApp = createMockApp(mockVault);
		mockSettings = createMockSettings();
		service = new FileSyncService(mockApp as any, mockSettings as any);
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	it("should reject source paths outside source folder", async () => {
		const mapping = createMockMapping({
			sourceFolder: SOURCE_ROOT,
			targetFolder: "vault/imported",
		});

		// Try to sync a file that's outside the source folder
		const result = await service.syncFile(
			mapping as any,
			"C:\\other\\secret.md"
		);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error?.message).toContain("Path traversal");
		}
	});

	it("should reject paths with .. traversal", async () => {
		const mapping = createMockMapping({
			sourceFolder: SOURCE_ROOT,
			targetFolder: "vault/imported",
		});

		// Try to use .. to escape the source folder
		const result = await service.syncFile(
			mapping as any,
			"C:\\source\\..\\secret.md"
		);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error?.message).toContain("Path traversal");
		}
	});

	it("should allow valid paths within source folder", async () => {
		const mapping = createMockMapping({
			sourceFolder: SOURCE_ROOT,
			targetFolder: "vault/imported",
		});

		const result = await service.syncFile(mapping as any, SOURCE_FILE1);

		expect(result.ok).toBe(true);
	});
});

describe("FileSyncService - reconcileMapping edge cases", () => {
	let service: FileSyncService;
	let mockApp: ReturnType<typeof createMockApp>;
	let mockSettings: ReturnType<typeof createMockSettings>;
	let mockAdapter: ReturnType<typeof createMockVaultAdapter>;

	beforeEach(() => {
		clearMockFs();
		mockAdapter = createMockVaultAdapter();
		const mockVault = createMockVault(mockAdapter);
		mockApp = createMockApp(mockVault);
		mockSettings = createMockSettings();
		service = new FileSyncService(mockApp as any, mockSettings as any);
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	it("should skip disabled mappings", async () => {
		const mapping = createMockMapping({
			enabled: false,
			sourceFolder: SOURCE_ROOT,
			targetFolder: "vault/imported",
		});

		const stats = await service.reconcileMapping(mapping as any);

		expect(stats.scanned).toBe(0);
		expect(stats.processed).toBe(0);
	});

	it("should handle missing source folder", async () => {
		// Source folder doesn't exist in mock
		const mapping = createMockMapping({
			sourceFolder: "C:\\nonexistent",
			targetFolder: "vault/imported",
		});

		const stats = await service.reconcileMapping(mapping as any);

		expect(stats.scanned).toBe(0);
		expect(stats.processed).toBe(0);
	});

	it("should handle empty source folder", async () => {
		// Source folder exists but is empty (no files in mock)
		setupMockDir("C:\\empty");

		const mapping = createMockMapping({
			sourceFolder: "C:\\empty",
			targetFolder: "vault/imported",
		});

		const stats = await service.reconcileMapping(mapping as any);

		expect(stats.scanned).toBe(0);
		expect(stats.processed).toBe(0);
	});
});
