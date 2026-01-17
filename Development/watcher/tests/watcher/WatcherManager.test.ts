import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock fs module
vi.mock("fs", () => ({
	existsSync: vi.fn(() => true),
}));

// Mock chokidar
vi.mock("chokidar", () => ({
	default: {
		watch: vi.fn(() => ({
			on: vi.fn().mockReturnThis(),
			close: vi.fn().mockResolvedValue(undefined),
		})),
	},
}));

// Mock LogService
vi.mock("../../src/services/LogService", () => ({
	LogService: {
		debug: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
		configure: vi.fn(),
		clear: vi.fn(),
	},
}));

import { WatcherManager } from "../../src/watcher/WatcherManager";
import {
	createMockWatcherManagerContext,
	createMockMapping,
	createMockSettings,
	createMockMappingWatcherContext,
} from "../mocks/factories";
import { LogService } from "../../src/services/LogService";

describe("WatcherManager", () => {
	let ctx: ReturnType<typeof createMockWatcherManagerContext>;
	let manager: WatcherManager;

	beforeEach(() => {
		vi.clearAllMocks();
		ctx = createMockWatcherManagerContext();
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe("constructor", () => {
		it("should create a manager with provided context", () => {
			manager = new WatcherManager(ctx);
			expect(manager).toBeDefined();
			expect(manager.activeCount()).toBe(0);
		});
	});

	describe("startAll", () => {
		it("should start watchers for enabled mappings", async () => {
			const mapping1 = createMockMapping({ id: "m1", enabled: true, sourceFolder: "/source1" });
			const mapping2 = createMockMapping({ id: "m2", enabled: true, sourceFolder: "/source2" });

			ctx = createMockWatcherManagerContext({
				settings: createMockSettings({ folderMappings: [mapping1, mapping2] }),
			});
			manager = new WatcherManager(ctx);

			await manager.startAll();

			expect(manager.activeCount()).toBe(2);
			expect(LogService.info).toHaveBeenCalledWith(
				"Manager",
				"Starting all watchers",
				expect.any(Object)
			);
		});

		it("should skip disabled mappings", async () => {
			const mapping1 = createMockMapping({ id: "m1", enabled: true, sourceFolder: "/source1" });
			const mapping2 = createMockMapping({ id: "m2", enabled: false, sourceFolder: "/source2" });

			ctx = createMockWatcherManagerContext({
				settings: createMockSettings({ folderMappings: [mapping1, mapping2] }),
			});
			manager = new WatcherManager(ctx);

			await manager.startAll();

			expect(manager.activeCount()).toBe(1);
			expect(LogService.debug).toHaveBeenCalledWith(
				"Manager",
				expect.stringContaining("Skipping disabled mapping"),
				expect.any(Object)
			);
		});

		it("should stop existing watchers before starting new ones", async () => {
			const mapping = createMockMapping({ id: "m1", enabled: true, sourceFolder: "/source" });

			ctx = createMockWatcherManagerContext({
				settings: createMockSettings({ folderMappings: [mapping] }),
			});
			manager = new WatcherManager(ctx);

			// Start once
			await manager.startAll();
			expect(manager.activeCount()).toBe(1);

			// Start again (should stop first then restart)
			await manager.startAll();
			expect(manager.activeCount()).toBe(1);
		});

		it("should prevent concurrent startAll calls", async () => {
			const mapping = createMockMapping({ id: "m1", enabled: true, sourceFolder: "/source" });

			ctx = createMockWatcherManagerContext({
				settings: createMockSettings({ folderMappings: [mapping] }),
			});
			manager = new WatcherManager(ctx);

			// Start two concurrent calls
			const promise1 = manager.startAll();
			const promise2 = manager.startAll();

			await Promise.all([promise1, promise2]);

			// Second call should have been skipped
			expect(LogService.warn).toHaveBeenCalledWith(
				"Manager",
				"startAll() already in progress, skipping"
			);
		});

		it("should notify statusbar when done", async () => {
			const mapping = createMockMapping({ id: "m1", enabled: true, sourceFolder: "/source" });

			ctx = createMockWatcherManagerContext({
				settings: createMockSettings({ folderMappings: [mapping] }),
			});
			manager = new WatcherManager(ctx);

			await manager.startAll();

			expect(ctx.statusbar?.onStatsChanged).toHaveBeenCalled();
		});
	});

	describe("stopAll", () => {
		it("should stop all active watchers", async () => {
			const mapping = createMockMapping({ id: "m1", enabled: true, sourceFolder: "/source" });

			ctx = createMockWatcherManagerContext({
				settings: createMockSettings({ folderMappings: [mapping] }),
			});
			manager = new WatcherManager(ctx);

			await manager.startAll();
			expect(manager.activeCount()).toBe(1);

			await manager.stopAll();
			expect(manager.activeCount()).toBe(0);
		});

		it("should handle empty watcher list gracefully", async () => {
			ctx = createMockWatcherManagerContext({
				settings: createMockSettings({ folderMappings: [] }),
			});
			manager = new WatcherManager(ctx);

			await manager.stopAll();
			expect(manager.activeCount()).toBe(0);
		});
	});

	describe("startWatcher", () => {
		it("should start a single watcher by ID", async () => {
			const mapping = createMockMapping({ id: "m1", enabled: true, sourceFolder: "/source" });

			ctx = createMockWatcherManagerContext({
				settings: createMockSettings({ folderMappings: [mapping] }),
			});
			manager = new WatcherManager(ctx);

			const result = await manager.startWatcher("m1");

			expect(result).toBe(true);
			expect(manager.activeCount()).toBe(1);
			expect(manager.isWatcherRunning("m1")).toBe(true);
		});

		it("should return false for non-existent mapping", async () => {
			ctx = createMockWatcherManagerContext({
				settings: createMockSettings({ folderMappings: [] }),
			});
			manager = new WatcherManager(ctx);

			const result = await manager.startWatcher("nonexistent");

			expect(result).toBe(false);
			expect(LogService.warn).toHaveBeenCalledWith(
				"Manager",
				"Mapping not found: nonexistent"
			);
		});

		it("should stop existing watcher before starting new one", async () => {
			const mapping = createMockMapping({ id: "m1", enabled: true, sourceFolder: "/source" });

			ctx = createMockWatcherManagerContext({
				settings: createMockSettings({ folderMappings: [mapping] }),
			});
			manager = new WatcherManager(ctx);

			// Start watcher
			await manager.startWatcher("m1");
			expect(manager.activeCount()).toBe(1);

			// Start again (should replace)
			await manager.startWatcher("m1");
			expect(manager.activeCount()).toBe(1);
		});
	});

	describe("stopWatcher", () => {
		it("should stop a single watcher by ID", async () => {
			const mapping = createMockMapping({ id: "m1", enabled: true, sourceFolder: "/source" });

			ctx = createMockWatcherManagerContext({
				settings: createMockSettings({ folderMappings: [mapping] }),
			});
			manager = new WatcherManager(ctx);

			await manager.startWatcher("m1");
			expect(manager.isWatcherRunning("m1")).toBe(true);

			const result = await manager.stopWatcher("m1");

			expect(result).toBe(true);
			expect(manager.isWatcherRunning("m1")).toBe(false);
		});

		it("should return true for already stopped watcher", async () => {
			const mapping = createMockMapping({ id: "m1", enabled: true, sourceFolder: "/source" });

			ctx = createMockWatcherManagerContext({
				settings: createMockSettings({ folderMappings: [mapping] }),
			});
			manager = new WatcherManager(ctx);

			const result = await manager.stopWatcher("m1");

			expect(result).toBe(true);
		});
	});

	describe("isWatcherRunning", () => {
		it("should return false for non-running watcher", () => {
			ctx = createMockWatcherManagerContext();
			manager = new WatcherManager(ctx);

			expect(manager.isWatcherRunning("nonexistent")).toBe(false);
		});

		it("should return true for running watcher", async () => {
			const mapping = createMockMapping({ id: "m1", enabled: true, sourceFolder: "/source" });

			ctx = createMockWatcherManagerContext({
				settings: createMockSettings({ folderMappings: [mapping] }),
			});
			manager = new WatcherManager(ctx);

			await manager.startWatcher("m1");

			expect(manager.isWatcherRunning("m1")).toBe(true);
		});
	});

	describe("getWatcherInfos", () => {
		it("should return info for all mappings", async () => {
			const mapping1 = createMockMapping({
				id: "m1",
				enabled: true,
				description: "Test 1",
				sourceFolder: "/source1",
				targetFolder: "target1",
			});
			const mapping2 = createMockMapping({
				id: "m2",
				enabled: false,
				description: "Test 2",
				sourceFolder: "/source2",
				targetFolder: "target2",
			});

			ctx = createMockWatcherManagerContext({
				settings: createMockSettings({ folderMappings: [mapping1, mapping2] }),
			});
			manager = new WatcherManager(ctx);

			await manager.startAll();

			const infos = manager.getWatcherInfos();

			expect(infos).toHaveLength(2);
			expect(infos[0]).toMatchObject({
				mappingId: "m1",
				mappingDescription: "Test 1",
				sourceFolder: "/source1",
				targetFolder: "target1",
				state: "running",
			});
			expect(infos[1]).toMatchObject({
				mappingId: "m2",
				mappingDescription: "Test 2",
				state: "stopped",
			});
		});

		it("should include queue stats for running watchers", async () => {
			const mapping = createMockMapping({ id: "m1", enabled: true, sourceFolder: "/source" });

			ctx = createMockWatcherManagerContext({
				settings: createMockSettings({ folderMappings: [mapping] }),
			});
			manager = new WatcherManager(ctx);

			await manager.startAll();

			const infos = manager.getWatcherInfos();

			expect(infos[0].queueStats).toBeDefined();
			expect(infos[0].queueStats.maxPendingFiles).toBe(1000);
			expect(infos[0].queueStats.maxPendingDirs).toBe(100);
		});
	});

	describe("getTotalQueueStats", () => {
		it("should aggregate stats from all watchers", async () => {
			const mapping1 = createMockMapping({ id: "m1", enabled: true, sourceFolder: "/source1" });
			const mapping2 = createMockMapping({ id: "m2", enabled: true, sourceFolder: "/source2" });

			ctx = createMockWatcherManagerContext({
				settings: createMockSettings({ folderMappings: [mapping1, mapping2] }),
			});
			manager = new WatcherManager(ctx);

			await manager.startAll();

			const stats = manager.getTotalQueueStats();

			expect(stats).toMatchObject({
				pendingFiles: 0,
				pendingDirs: 0,
				droppedJobs: 0,
			});
		});

		it("should return zeros when no watchers active", () => {
			ctx = createMockWatcherManagerContext();
			manager = new WatcherManager(ctx);

			const stats = manager.getTotalQueueStats();

			expect(stats).toMatchObject({
				pendingFiles: 0,
				pendingDirs: 0,
				droppedJobs: 0,
			});
		});
	});

	describe("updateMappings", () => {
		it("should trigger startAll", async () => {
			const mapping = createMockMapping({ id: "m1", enabled: true, sourceFolder: "/source" });

			ctx = createMockWatcherManagerContext({
				settings: createMockSettings({ folderMappings: [mapping] }),
			});
			manager = new WatcherManager(ctx);

			manager.updateMappings();

			// Wait for async startAll
			await vi.waitFor(() => {
				expect(manager.activeCount()).toBe(1);
			});
		});
	});
});
