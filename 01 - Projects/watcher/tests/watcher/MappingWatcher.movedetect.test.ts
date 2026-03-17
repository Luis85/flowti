import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import { createMockMappingWatcherContext, createMockMapping } from "../mocks/factories";
import type { FolderMapping } from "../../src/types";

// Track chokidar handlers per test via hoisted variable
const { watchHandlers } = vi.hoisted(() => ({
	watchHandlers: new Map<string, (...args: any[]) => void>(),
}));

// Mock chokidar to capture event handlers (must chain properly)
vi.mock("chokidar", () => ({
	default: {
		watch: vi.fn(() => {
			const instance: any = {
				close: vi.fn().mockResolvedValue(undefined),
			};
			instance.on = vi.fn((event: string, handler: (...args: any[]) => void) => {
				watchHandlers.set(event, handler);
				return instance; // self-reference for chaining
			});
			return instance;
		}),
	},
}));

// Mock fs — simple sync factory like the main MappingWatcher tests
vi.mock("fs", () => ({
	existsSync: vi.fn(() => true),
	statSync: vi.fn(() => ({ mtimeMs: Date.now(), size: 12 })),
	lstatSync: vi.fn(() => ({ isSymbolicLink: () => false })),
	readFileSync: vi.fn(() => Buffer.from("test")),
	readdirSync: vi.fn(() => []),
}));

vi.mock("../../src/services/LogService", () => ({
	LogService: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { MappingWatcher } from "../../src/watcher/MappingWatcher";

describe("MappingWatcher move detection", () => {
	let mapping: FolderMapping;
	let context: ReturnType<typeof createMockMappingWatcherContext>;

	beforeEach(() => {
		vi.useFakeTimers();
		watchHandlers.clear();
		mapping = createMockMapping({
			sourceFolder: "/source",
			targetFolder: "target",
			debounceDelay: 100,
			deletionHandling: "trash",
			detectMoves: true,
		});
		context = createMockMappingWatcherContext();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	async function createAndStartWatcher() {
		const watcher = new MappingWatcher({} as any, context, mapping);
		watcher.start();
		return watcher;
	}

	describe("bufferDelete", () => {
		it("should process as regular delete when size=0 (no SyncState info)", async () => {
			context.fileSync!.getSyncStateService = vi.fn().mockReturnValue(undefined);

			const watcher = await createAndStartWatcher();
			const unlinkHandler = watchHandlers.get("unlink");

			expect(unlinkHandler).toBeDefined();
			unlinkHandler!("/source/file.md");

			// With size=0 it should create a pending job with debounce
			await vi.advanceTimersByTimeAsync(200);
			expect(context.syncDelete).toHaveBeenCalled();

			await watcher.stop();
		});

		it("should buffer delete with known size for move detection window", async () => {
			const mockSyncState = {
				getFileInfo: vi.fn().mockReturnValue({ sourceSize: 1024, sourceMtimeMs: 1000 }),
			};
			context.fileSync!.getSyncStateService = vi.fn().mockReturnValue(mockSyncState);

			const watcher = await createAndStartWatcher();
			const unlinkHandler = watchHandlers.get("unlink");

			expect(unlinkHandler).toBeDefined();
			unlinkHandler!("/source/file.md");

			// Should NOT immediately process as delete — it's buffered for move detection
			await vi.advanceTimersByTimeAsync(100);
			expect(context.syncDelete).not.toHaveBeenCalled();

			await watcher.stop();
		});

		it("should timeout and process as delete when no matching add arrives", async () => {
			const mockSyncState = {
				getFileInfo: vi.fn().mockReturnValue({ sourceSize: 1024, sourceMtimeMs: 1000 }),
			};
			context.fileSync!.getSyncStateService = vi.fn().mockReturnValue(mockSyncState);

			const watcher = await createAndStartWatcher();
			const unlinkHandler = watchHandlers.get("unlink");

			expect(unlinkHandler).toBeDefined();
			unlinkHandler!("/source/file.md");

			// Wait for MOVE_DETECT_WINDOW_MS (2000ms) + processing
			await vi.advanceTimersByTimeAsync(2500);
			expect(context.syncDelete).toHaveBeenCalled();

			await watcher.stop();
		});
	});

	describe("tryMatchMove", () => {
		it("should match add with buffered delete of same size", async () => {
			const mockSyncState = {
				getFileInfo: vi.fn().mockReturnValue({ sourceSize: 512, sourceMtimeMs: 1000 }),
			};
			context.fileSync!.getSyncStateService = vi.fn().mockReturnValue(mockSyncState);
			// statSync for the new file must return the same size
			vi.mocked(fs.statSync).mockReturnValue({ size: 512, isFile: () => true } as any);

			const watcher = await createAndStartWatcher();
			const unlinkHandler = watchHandlers.get("unlink");
			const addHandler = watchHandlers.get("add");

			expect(unlinkHandler).toBeDefined();
			expect(addHandler).toBeDefined();

			// Delete old file — buffered for move detection
			unlinkHandler!("/source/old.md");

			// Add new file with same size (within the move detection window)
			await vi.advanceTimersByTimeAsync(100);
			addHandler!("/source/new.md");

			// Wait for debounce (100ms)
			await vi.advanceTimersByTimeAsync(200);

			expect(context.syncMove).toHaveBeenCalledWith(
				mapping,
				"/source/old.md",
				"/source/new.md"
			);
			expect(context.syncDelete).not.toHaveBeenCalled();

			await watcher.stop();
		});

		it("should not match when sizes differ", async () => {
			const mockSyncState = {
				getFileInfo: vi.fn().mockReturnValue({ sourceSize: 512, sourceMtimeMs: 1000 }),
			};
			context.fileSync!.getSyncStateService = vi.fn().mockReturnValue(mockSyncState);
			// Different size
			vi.mocked(fs.statSync).mockReturnValue({ size: 1024, isFile: () => true } as any);

			const watcher = await createAndStartWatcher();
			const unlinkHandler = watchHandlers.get("unlink");
			const addHandler = watchHandlers.get("add");

			expect(unlinkHandler).toBeDefined();
			expect(addHandler).toBeDefined();

			unlinkHandler!("/source/old.md");
			await vi.advanceTimersByTimeAsync(100);
			addHandler!("/source/new.md");

			// Wait for MOVE_DETECT_WINDOW_MS (2000ms) + processing
			await vi.advanceTimersByTimeAsync(2500);

			expect(context.syncMove).not.toHaveBeenCalled();
			expect(context.syncDelete).toHaveBeenCalled();

			await watcher.stop();
		});

		it("should handle stat failure gracefully", async () => {
			const mockSyncState = {
				getFileInfo: vi.fn().mockReturnValue({ sourceSize: 512, sourceMtimeMs: 1000 }),
			};
			context.fileSync!.getSyncStateService = vi.fn().mockReturnValue(mockSyncState);
			vi.mocked(fs.statSync).mockImplementation(() => {
				throw new Error("ENOENT");
			});

			const watcher = await createAndStartWatcher();
			const unlinkHandler = watchHandlers.get("unlink");
			const addHandler = watchHandlers.get("add");

			expect(unlinkHandler).toBeDefined();
			expect(addHandler).toBeDefined();

			unlinkHandler!("/source/old.md");
			await vi.advanceTimersByTimeAsync(100);
			addHandler!("/source/new.md");

			// Wait for MOVE_DETECT_WINDOW_MS (2000ms) + processing
			await vi.advanceTimersByTimeAsync(2500);

			// stat failed — move not detected
			expect(context.syncMove).not.toHaveBeenCalled();

			await watcher.stop();
		});
	});
});
