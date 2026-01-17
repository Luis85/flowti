import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fsp from "fs/promises";
import * as path from "path";
import * as os from "os";
import { SyncStateService } from "../../src/services/SyncStateService";

// Mock App for testing
function createMockApp(basePath: string) {
	return {
		vault: {
			adapter: {
				basePath,
			},
		},
	} as any;
}

describe("SyncStateService", () => {
	let service: SyncStateService;
	let tempDir: string;
	let mockApp: any;
	const pluginId = "test-plugin";

	beforeEach(async () => {
		// Create temp directory for testing
		tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), "syncstate-test-"));
		mockApp = createMockApp(tempDir);
		service = new SyncStateService(mockApp, pluginId);
	});

	afterEach(async () => {
		// Cancel any pending saves
		service.cancelPendingSave();

		// Cleanup temp directory
		try {
			await fsp.rm(tempDir, { recursive: true, force: true });
		} catch {
			// Ignore cleanup errors
		}
	});

	describe("initialization", () => {
		it("should start with empty state", () => {
			expect(service.hasState()).toBe(false);
			expect(service.getStats()).toEqual({ mappingCount: 0, totalFiles: 0 });
		});

		it("should load empty state if no file exists", async () => {
			await service.load();
			expect(service.hasState()).toBe(false);
		});
	});

	describe("needsSync", () => {
		const mappingId = "mapping-1";
		const sourceFolder = "/source/folder";
		const relativePath = "file.md";
		const sourceStat = { mtimeMs: 1000000, size: 1024 };

		it("should return true for unknown mapping", () => {
			const result = service.needsSync(mappingId, sourceFolder, relativePath, sourceStat);
			expect(result).toBe(true);
		});

		it("should return true for unknown file", () => {
			// Record a different file
			service.recordSync(mappingId, sourceFolder, "other.md", sourceStat);

			const result = service.needsSync(mappingId, sourceFolder, relativePath, sourceStat);
			expect(result).toBe(true);
		});

		it("should return false for unchanged file", () => {
			service.recordSync(mappingId, sourceFolder, relativePath, sourceStat);

			const result = service.needsSync(mappingId, sourceFolder, relativePath, sourceStat);
			expect(result).toBe(false);
		});

		it("should return true if mtime changed", () => {
			service.recordSync(mappingId, sourceFolder, relativePath, sourceStat);

			const changedStat = { mtimeMs: 2000000, size: 1024 };
			const result = service.needsSync(mappingId, sourceFolder, relativePath, changedStat);
			expect(result).toBe(true);
		});

		it("should return true if size changed", () => {
			service.recordSync(mappingId, sourceFolder, relativePath, sourceStat);

			const changedStat = { mtimeMs: 1000000, size: 2048 };
			const result = service.needsSync(mappingId, sourceFolder, relativePath, changedStat);
			expect(result).toBe(true);
		});

		it("should return true if source folder changed", () => {
			service.recordSync(mappingId, sourceFolder, relativePath, sourceStat);

			const result = service.needsSync(mappingId, "/different/folder", relativePath, sourceStat);
			expect(result).toBe(true);
		});
	});

	describe("recordSync", () => {
		const mappingId = "mapping-1";
		const sourceFolder = "/source/folder";

		it("should record sync with correct metadata", () => {
			const relativePath = "docs/file.md";
			const stat = { mtimeMs: 1234567890, size: 512 };

			service.recordSync(mappingId, sourceFolder, relativePath, stat);

			// File should now be tracked
			expect(service.needsSync(mappingId, sourceFolder, relativePath, stat)).toBe(false);
			expect(service.getTrackedFileCount(mappingId)).toBe(1);
		});

		it("should update existing file record", () => {
			const relativePath = "file.md";
			const stat1 = { mtimeMs: 1000000, size: 100 };
			const stat2 = { mtimeMs: 2000000, size: 200 };

			service.recordSync(mappingId, sourceFolder, relativePath, stat1);
			service.recordSync(mappingId, sourceFolder, relativePath, stat2);

			// Should match new stat
			expect(service.needsSync(mappingId, sourceFolder, relativePath, stat2)).toBe(false);
			// Should not match old stat
			expect(service.needsSync(mappingId, sourceFolder, relativePath, stat1)).toBe(true);
			// Should still be only one file
			expect(service.getTrackedFileCount(mappingId)).toBe(1);
		});

		it("should track multiple files", () => {
			const stat = { mtimeMs: 1000000, size: 100 };

			service.recordSync(mappingId, sourceFolder, "file1.md", stat);
			service.recordSync(mappingId, sourceFolder, "file2.md", stat);
			service.recordSync(mappingId, sourceFolder, "subdir/file3.md", stat);

			expect(service.getTrackedFileCount(mappingId)).toBe(3);
		});
	});

	describe("recordReconcileComplete", () => {
		it("should record reconcile completion time", () => {
			const mappingId = "mapping-1";
			const sourceFolder = "/source";

			expect(service.getLastReconcileTime(mappingId)).toBeNull();

			const before = Date.now();
			service.recordReconcileComplete(mappingId, sourceFolder);
			const after = Date.now();

			const lastReconcile = service.getLastReconcileTime(mappingId);
			expect(lastReconcile).not.toBeNull();
			expect(lastReconcile).toBeGreaterThanOrEqual(before);
			expect(lastReconcile).toBeLessThanOrEqual(after);
		});
	});

	describe("pruneOrphans", () => {
		const mappingId = "mapping-1";
		const sourceFolder = "/source";
		const stat = { mtimeMs: 1000000, size: 100 };

		it("should remove entries for deleted files", () => {
			// Record some files
			service.recordSync(mappingId, sourceFolder, "keep1.md", stat);
			service.recordSync(mappingId, sourceFolder, "keep2.md", stat);
			service.recordSync(mappingId, sourceFolder, "delete1.md", stat);
			service.recordSync(mappingId, sourceFolder, "delete2.md", stat);

			expect(service.getTrackedFileCount(mappingId)).toBe(4);

			// Prune - only keep1 and keep2 exist
			const existing = new Set(["keep1.md", "keep2.md"]);
			const pruned = service.pruneOrphans(mappingId, existing);

			expect(pruned).toBe(2);
			expect(service.getTrackedFileCount(mappingId)).toBe(2);

			// Verify correct files remain
			expect(service.needsSync(mappingId, sourceFolder, "keep1.md", stat)).toBe(false);
			expect(service.needsSync(mappingId, sourceFolder, "keep2.md", stat)).toBe(false);
			expect(service.needsSync(mappingId, sourceFolder, "delete1.md", stat)).toBe(true);
		});

		it("should return 0 if nothing to prune", () => {
			service.recordSync(mappingId, sourceFolder, "file.md", stat);

			const existing = new Set(["file.md"]);
			const pruned = service.pruneOrphans(mappingId, existing);

			expect(pruned).toBe(0);
			expect(service.getTrackedFileCount(mappingId)).toBe(1);
		});

		it("should return 0 for unknown mapping", () => {
			const pruned = service.pruneOrphans("unknown", new Set(["file.md"]));
			expect(pruned).toBe(0);
		});
	});

	describe("clearMapping", () => {
		it("should remove all state for a mapping", () => {
			const mappingId = "mapping-1";
			const sourceFolder = "/source";
			const stat = { mtimeMs: 1000000, size: 100 };

			service.recordSync(mappingId, sourceFolder, "file1.md", stat);
			service.recordSync(mappingId, sourceFolder, "file2.md", stat);
			service.recordReconcileComplete(mappingId, sourceFolder);

			expect(service.getTrackedFileCount(mappingId)).toBe(2);
			expect(service.getLastReconcileTime(mappingId)).not.toBeNull();

			service.clearMapping(mappingId);

			expect(service.getTrackedFileCount(mappingId)).toBe(0);
			expect(service.getLastReconcileTime(mappingId)).toBeNull();
		});

		it("should not affect other mappings", () => {
			const stat = { mtimeMs: 1000000, size: 100 };

			service.recordSync("mapping-1", "/source1", "file.md", stat);
			service.recordSync("mapping-2", "/source2", "file.md", stat);

			service.clearMapping("mapping-1");

			expect(service.getTrackedFileCount("mapping-1")).toBe(0);
			expect(service.getTrackedFileCount("mapping-2")).toBe(1);
		});
	});

	describe("clearAll", () => {
		it("should remove all state", () => {
			const stat = { mtimeMs: 1000000, size: 100 };

			service.recordSync("mapping-1", "/source1", "file1.md", stat);
			service.recordSync("mapping-2", "/source2", "file2.md", stat);

			expect(service.hasState()).toBe(true);

			service.clearAll();

			expect(service.hasState()).toBe(false);
			expect(service.getStats()).toEqual({ mappingCount: 0, totalFiles: 0 });
		});
	});

	describe("persistence", () => {
		it("should save and load state correctly", async () => {
			const mappingId = "mapping-1";
			const sourceFolder = "/source/folder";
			const stat = { mtimeMs: 1234567890, size: 512 };

			// Record some state
			service.recordSync(mappingId, sourceFolder, "file1.md", stat);
			service.recordSync(mappingId, sourceFolder, "subdir/file2.md", stat);
			service.recordReconcileComplete(mappingId, sourceFolder);

			// Save
			await service.save();

			// Create new service and load
			const service2 = new SyncStateService(mockApp, pluginId);
			await service2.load();

			// Verify state was restored
			expect(service2.getTrackedFileCount(mappingId)).toBe(2);
			expect(service2.needsSync(mappingId, sourceFolder, "file1.md", stat)).toBe(false);
			expect(service2.needsSync(mappingId, sourceFolder, "subdir/file2.md", stat)).toBe(false);
			expect(service2.getLastReconcileTime(mappingId)).not.toBeNull();
		});

		it("should handle missing state file gracefully", async () => {
			await service.load();

			// Should not throw and state should be empty
			expect(service.hasState()).toBe(false);
		});

		it("should handle corrupted state file gracefully", async () => {
			// Write corrupted JSON
			const stateDir = path.join(tempDir, ".obsidian", "plugins", pluginId);
			await fsp.mkdir(stateDir, { recursive: true });
			await fsp.writeFile(path.join(stateDir, "sync-state.json"), "not valid json");

			await service.load();

			// Should not throw and state should be empty
			expect(service.hasState()).toBe(false);
		});

		it("should handle unknown version gracefully", async () => {
			// Write state with future version
			const stateDir = path.join(tempDir, ".obsidian", "plugins", pluginId);
			await fsp.mkdir(stateDir, { recursive: true });
			await fsp.writeFile(
				path.join(stateDir, "sync-state.json"),
				JSON.stringify({ version: 999, mappings: {} })
			);

			await service.load();

			// Should not throw and state should be empty (future version ignored)
			expect(service.hasState()).toBe(false);
		});
	});

	describe("getStats", () => {
		it("should return correct statistics", () => {
			const stat = { mtimeMs: 1000000, size: 100 };

			service.recordSync("mapping-1", "/source1", "file1.md", stat);
			service.recordSync("mapping-1", "/source1", "file2.md", stat);
			service.recordSync("mapping-2", "/source2", "file3.md", stat);

			const stats = service.getStats();

			expect(stats.mappingCount).toBe(2);
			expect(stats.totalFiles).toBe(3);
		});
	});
});
