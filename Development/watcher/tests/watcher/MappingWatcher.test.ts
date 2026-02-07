import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock fs module - must be before other imports
vi.mock("fs", () => ({
	existsSync: vi.fn(() => true),
	readFileSync: vi.fn(() => Buffer.from("test content")),
	statSync: vi.fn(() => ({ mtimeMs: Date.now(), size: 12 })),
	readdirSync: vi.fn(() => []),
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

// Note: obsidian and src/main are mocked in setup.ts

import { MappingWatcher } from "../../src/watcher/MappingWatcher";
import { LogService } from "../../src/services/LogService";

// Helper to create mock mapping inline
function createMockMapping(overrides: any = {}) {
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

describe("MappingWatcher", () => {
	let mockPlugin: any;
	let mockApp: any;
	let watcher: MappingWatcher;

	beforeEach(() => {
		vi.useFakeTimers();

		mockApp = {};

		mockPlugin = {
			app: mockApp,
			settings: {
				ignoreOneDriveTemp: true,
			},
			syncFile: vi.fn().mockResolvedValue({ ok: true, action: "processed" }),
			bumpProcessed: vi.fn(),
			bumpSkipped: vi.fn(),
			bumpError: vi.fn(),
			fileSync: {
				reconcileFolder: vi.fn().mockResolvedValue({
					scanned: 0,
					processed: 0,
					skipped: 0,
					errors: 0,
				}),
				isRecentlySynced: vi.fn().mockReturnValue(false),
			},
		};
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.clearAllMocks();
	});

	describe("getQueueStats", () => {
		it("should return initial queue stats", () => {
			const mapping = createMockMapping({
				sourceFolder: "/source",
				targetFolder: "vault/target",
			});

			watcher = new MappingWatcher(mockApp, mockPlugin, mapping as any);

			const stats = watcher.getQueueStats();

			expect(stats.pendingFiles).toBe(0);
			expect(stats.pendingDirs).toBe(0);
			expect(stats.droppedJobs).toBe(0);
			expect(stats.maxPendingFiles).toBe(1000);
			expect(stats.maxPendingDirs).toBe(100);
		});
	});

	describe("debouncing", () => {
		it("should debounce rapid file changes", async () => {
			const mapping = createMockMapping({
				sourceFolder: "/source",
				targetFolder: "vault/target",
				debounceDelay: 500,
			});

			watcher = new MappingWatcher(mockApp, mockPlugin, mapping as any);
			watcher.start();

			// Simulate rapid changes via internal method (accessing private via any)
			const enqueue = (watcher as any).enqueue.bind(watcher);

			enqueue("/source/file1.md", "changed");
			enqueue("/source/file1.md", "changed");
			enqueue("/source/file1.md", "changed");

			// Queue should have only 1 entry (debounced)
			expect(watcher.getQueueStats().pendingFiles).toBe(1);

			// Advance time past debounce
			vi.advanceTimersByTime(600);

			// Wait for async processing
			await vi.runAllTimersAsync();

			// Should have called syncFile only once
			expect(mockPlugin.syncFile).toHaveBeenCalledTimes(1);
		});

		it("should process each unique file separately", async () => {
			const mapping = createMockMapping({
				sourceFolder: "/source",
				targetFolder: "vault/target",
				debounceDelay: 500,
			});

			watcher = new MappingWatcher(mockApp, mockPlugin, mapping as any);
			watcher.start();

			const enqueue = (watcher as any).enqueue.bind(watcher);

			enqueue("/source/file1.md", "changed");
			enqueue("/source/file2.md", "changed");

			expect(watcher.getQueueStats().pendingFiles).toBe(2);

			vi.advanceTimersByTime(600);
			await vi.runAllTimersAsync();

			expect(mockPlugin.syncFile).toHaveBeenCalledTimes(2);
		});
	});

	describe("backpressure", () => {
		it("should drop new jobs when queue is full", () => {
			const mapping = createMockMapping({
				sourceFolder: "/source",
				targetFolder: "vault/target",
				debounceDelay: 5000, // Long delay to keep jobs in queue
			});

			watcher = new MappingWatcher(mockApp, mockPlugin, mapping as any);
			watcher.start();

			const enqueue = (watcher as any).enqueue.bind(watcher);

			// Fill queue to max (1000)
			for (let i = 0; i < 1000; i++) {
				enqueue(`/source/file${i}.md`, "added");
			}

			expect(watcher.getQueueStats().pendingFiles).toBe(1000);
			expect(watcher.getQueueStats().droppedJobs).toBe(0);

			// Try to add one more
			enqueue("/source/overflow.md", "added");

			// Should be dropped
			expect(watcher.getQueueStats().pendingFiles).toBe(1000);
			expect(watcher.getQueueStats().droppedJobs).toBe(1);
			expect(mockPlugin.bumpSkipped).toHaveBeenCalled();
		});

		it("should allow updates to existing queued jobs even when full", () => {
			const mapping = createMockMapping({
				sourceFolder: "/source",
				targetFolder: "vault/target",
				debounceDelay: 5000,
			});

			watcher = new MappingWatcher(mockApp, mockPlugin, mapping as any);
			watcher.start();

			const enqueue = (watcher as any).enqueue.bind(watcher);

			// Fill queue
			for (let i = 0; i < 1000; i++) {
				enqueue(`/source/file${i}.md`, "added");
			}

			// Update an existing job (should not be dropped)
			enqueue("/source/file0.md", "changed");

			// Queue size should still be 1000, no dropped jobs
			expect(watcher.getQueueStats().pendingFiles).toBe(1000);
			expect(watcher.getQueueStats().droppedJobs).toBe(0);
		});

		it("should log warning when dropping jobs", () => {
			const mapping = createMockMapping({
				sourceFolder: "/source",
				targetFolder: "vault/target",
				debounceDelay: 5000,
			});

			watcher = new MappingWatcher(mockApp, mockPlugin, mapping as any);
			watcher.start();

			const enqueue = (watcher as any).enqueue.bind(watcher);

			// Fill queue
			for (let i = 0; i < 1000; i++) {
				enqueue(`/source/file${i}.md`, "added");
			}

			vi.clearAllMocks();

			// Add one more (will be dropped)
			enqueue("/source/overflow.md", "added");

			expect(LogService.warn).toHaveBeenCalledWith(
				"Watcher",
				"Queue full, dropping job",
				expect.objectContaining({
					mappingId: "test-mapping",
					filePath: "/source/overflow.md",
					details: expect.objectContaining({
						queueSize: 1000,
					}),
				})
			);
		});
	});

	describe("directory backpressure", () => {
		it("should drop directory reconciles when dir queue is full", () => {
			const mapping = createMockMapping({
				sourceFolder: "/source",
				targetFolder: "vault/target",
				watchSubfolders: true,
				debounceDelay: 5000,
			});

			watcher = new MappingWatcher(mockApp, mockPlugin, mapping as any);
			watcher.start();

			const onDirAdded = (watcher as any).onDirAdded.bind(watcher);

			// Fill dir queue to max (100)
			for (let i = 0; i < 100; i++) {
				onDirAdded(`/source/dir${i}`);
			}

			expect(watcher.getQueueStats().pendingDirs).toBe(100);
			expect(watcher.getQueueStats().droppedJobs).toBe(0);

			// Try to add one more
			onDirAdded("/source/overflow");

			expect(watcher.getQueueStats().pendingDirs).toBe(100);
			expect(watcher.getQueueStats().droppedJobs).toBe(1);
		});
	});

	describe("extension filtering", () => {
		it("should filter files by extension", () => {
			const mapping = createMockMapping({
				sourceFolder: "/source",
				targetFolder: "vault/target",
				fileExtensions: [".md"],
			});

			watcher = new MappingWatcher(mockApp, mockPlugin, mapping as any);
			watcher.start();

			const enqueue = (watcher as any).enqueue.bind(watcher);

			enqueue("/source/file.md", "added");
			enqueue("/source/file.txt", "added");
			enqueue("/source/file.png", "added");

			// Only .md file should be queued
			expect(watcher.getQueueStats().pendingFiles).toBe(1);
		});

		it("should allow all files when no extension filter", () => {
			const mapping = createMockMapping({
				sourceFolder: "/source",
				targetFolder: "vault/target",
				fileExtensions: [],
			});

			watcher = new MappingWatcher(mockApp, mockPlugin, mapping as any);
			watcher.start();

			const enqueue = (watcher as any).enqueue.bind(watcher);

			enqueue("/source/file.md", "added");
			enqueue("/source/file.txt", "added");
			enqueue("/source/file.png", "added");

			expect(watcher.getQueueStats().pendingFiles).toBe(3);
		});
	});

	describe("delete events", () => {
		it("should skip delete events", () => {
			const mapping = createMockMapping({
				sourceFolder: "/source",
				targetFolder: "vault/target",
			});

			watcher = new MappingWatcher(mockApp, mockPlugin, mapping as any);
			watcher.start();

			const enqueue = (watcher as any).enqueue.bind(watcher);

			enqueue("/source/file.md", "deleted");

			expect(watcher.getQueueStats().pendingFiles).toBe(0);
			expect(mockPlugin.bumpSkipped).toHaveBeenCalled();
		});
	});

	describe("stop", () => {
		it("should clear pending jobs on stop", async () => {
			const mapping = createMockMapping({
				sourceFolder: "/source",
				targetFolder: "vault/target",
				debounceDelay: 5000,
			});

			watcher = new MappingWatcher(mockApp, mockPlugin, mapping as any);
			watcher.start();

			const enqueue = (watcher as any).enqueue.bind(watcher);

			enqueue("/source/file1.md", "added");
			enqueue("/source/file2.md", "added");

			expect(watcher.getQueueStats().pendingFiles).toBe(2);

			await watcher.stop();

			expect(watcher.getQueueStats().pendingFiles).toBe(0);
		});

		it("should clear pending dir reconciles on stop", async () => {
			const mapping = createMockMapping({
				sourceFolder: "/source",
				targetFolder: "vault/target",
				watchSubfolders: true,
				debounceDelay: 5000,
			});

			watcher = new MappingWatcher(mockApp, mockPlugin, mapping as any);
			watcher.start();

			const onDirAdded = (watcher as any).onDirAdded.bind(watcher);

			onDirAdded("/source/dir1");
			onDirAdded("/source/dir2");

			expect(watcher.getQueueStats().pendingDirs).toBe(2);

			await watcher.stop();

			expect(watcher.getQueueStats().pendingDirs).toBe(0);
		});
	});

	describe("error handling", () => {
		it("should bump error count on sync failure", async () => {
			mockPlugin.syncFile.mockRejectedValueOnce(new Error("Sync failed"));

			const mapping = createMockMapping({
				sourceFolder: "/source",
				targetFolder: "vault/target",
				debounceDelay: 100,
			});

			watcher = new MappingWatcher(mockApp, mockPlugin, mapping as any);
			watcher.start();

			const enqueue = (watcher as any).enqueue.bind(watcher);
			enqueue("/source/file1.md", "added");

			vi.advanceTimersByTime(200);
			await vi.runAllTimersAsync();

			expect(mockPlugin.bumpError).toHaveBeenCalled();
		});
	});
});
