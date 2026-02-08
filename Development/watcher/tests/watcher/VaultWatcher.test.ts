import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TFile, TAbstractFile } from "obsidian";

// Mock LogService
vi.mock("../../src/services/LogService", () => ({
	LogService: {
		debug: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
	},
}));

import { VaultWatcher } from "../../src/watcher/VaultWatcher";
import { createMockVaultWatcherContext, createMockMapping } from "../mocks/factories";

// ===========================
// Helpers
// ===========================

type VaultEventHandler = (file: TAbstractFile, oldPath?: string) => void;

function createMockApp() {
	const handlers = new Map<string, VaultEventHandler>();
	return {
		vault: {
			on: vi.fn((event: string, handler: VaultEventHandler) => {
				handlers.set(event, handler);
				return { id: event };
			}),
			offref: vi.fn(),
		},
		_handlers: handlers,
	};
}

function createTFile(filePath: string): TFile {
	const f = new TFile();
	f.path = filePath;
	f.name = filePath.split("/").pop() ?? "";
	return f;
}

function createNonTFile(filePath: string): TAbstractFile {
	// Use a plain object that matches the shape but is NOT instanceof TFile
	return { path: filePath, name: filePath.split("/").pop() ?? "" } as unknown as TAbstractFile;
}

// ===========================
// Tests
// ===========================

describe("VaultWatcher", () => {
	let mockApp: ReturnType<typeof createMockApp>;
	let context: ReturnType<typeof createMockVaultWatcherContext>;
	let watcher: VaultWatcher;

	beforeEach(() => {
		vi.useFakeTimers();
		mockApp = createMockApp();
		context = createMockVaultWatcherContext();
	});

	afterEach(async () => {
		if (watcher) await watcher.stop();
		vi.useRealTimers();
	});

	function createWatcher(mappingOverrides: any = {}) {
		const mapping = createMockMapping({
			targetFolder: "vault/imported",
			syncDirection: "bidirectional",
			debounceDelay: 800,
			...mappingOverrides,
		});
		watcher = new VaultWatcher(mockApp as any, context, mapping);
		return watcher;
	}

	// ===========================
	// start()/stop() lifecycle
	// ===========================
	describe("start()/stop() lifecycle", () => {
		it("registers 4 event refs on start", () => {
			createWatcher();
			watcher.start();

			expect(mockApp.vault.on).toHaveBeenCalledTimes(4);
			expect(mockApp._handlers.has("modify")).toBe(true);
			expect(mockApp._handlers.has("create")).toBe(true);
			expect(mockApp._handlers.has("delete")).toBe(true);
			expect(mockApp._handlers.has("rename")).toBe(true);
		});

		it("skips registration for source-only syncDirection", () => {
			createWatcher({ syncDirection: "source-only" });
			watcher.start();

			expect(mockApp.vault.on).not.toHaveBeenCalled();
		});

		it("skips registration for disabled mappings", () => {
			createWatcher({ enabled: false });
			watcher.start();

			expect(mockApp.vault.on).not.toHaveBeenCalled();
		});

		it("skips registration when targetFolder is empty", () => {
			createWatcher({ targetFolder: "" });
			watcher.start();

			expect(mockApp.vault.on).not.toHaveBeenCalled();
		});

		it("unregisters all event refs and clears pending on stop", async () => {
			createWatcher();
			watcher.start();

			// Enqueue a file so pending is non-empty
			const file = createTFile("vault/imported/file.md");
			mockApp._handlers.get("modify")!(file);

			await watcher.stop();

			expect(mockApp.vault.offref).toHaveBeenCalledTimes(4);
			expect(watcher.getQueueStats().pendingFiles).toBe(0);
		});

		it("does not process events after stop", async () => {
			createWatcher();
			watcher.start();
			await watcher.stop();

			// Try to trigger a modify after stop
			const file = createTFile("vault/imported/file.md");
			mockApp._handlers.get("modify")!(file);

			// Advance timers — nothing should happen
			await vi.advanceTimersByTimeAsync(3000);

			expect(context.fileSync.syncFileReverse).not.toHaveBeenCalled();
		});
	});

	// ===========================
	// enqueue filtering
	// ===========================
	describe("enqueue filtering", () => {
		it("ignores files outside target folder", async () => {
			createWatcher();
			watcher.start();

			const file = createTFile("other/folder/file.md");
			mockApp._handlers.get("modify")!(file);

			await vi.advanceTimersByTimeAsync(3000);

			expect(context.fileSync.syncFileReverse).not.toHaveBeenCalled();
		});

		it("ignores files not matching fileExtensions", async () => {
			createWatcher({ fileExtensions: [".md"] });
			watcher.start();

			const file = createTFile("vault/imported/file.txt");
			mockApp._handlers.get("modify")!(file);

			await vi.advanceTimersByTimeAsync(3000);

			expect(context.fileSync.syncFileReverse).not.toHaveBeenCalled();
		});

		it("ignores files matching excludePatterns", async () => {
			createWatcher({ excludePatterns: ["*.log"] });
			watcher.start();

			const file = createTFile("vault/imported/debug.log");
			mockApp._handlers.get("modify")!(file);

			await vi.advanceTimersByTimeAsync(3000);

			expect(context.fileSync.syncFileReverse).not.toHaveBeenCalled();
		});

		it("ignores recently synced files (loop prevention)", async () => {
			context.fileSync.isRecentlySynced = vi.fn().mockReturnValue(true);
			createWatcher();
			watcher.start();

			const file = createTFile("vault/imported/file.md");
			mockApp._handlers.get("modify")!(file);

			await vi.advanceTimersByTimeAsync(3000);

			expect(context.fileSync.syncFileReverse).not.toHaveBeenCalled();
		});

		it("drops jobs when queue is at MAX_PENDING_JOBS", () => {
			createWatcher();
			watcher.start();

			// Fill queue to 1000
			for (let i = 0; i < 1000; i++) {
				const file = createTFile(`vault/imported/file${i}.md`);
				mockApp._handlers.get("modify")!(file);
			}

			expect(watcher.getQueueStats().pendingFiles).toBe(1000);

			// 1001st file should be dropped
			const extra = createTFile("vault/imported/extra.md");
			mockApp._handlers.get("modify")!(extra);

			expect(watcher.getQueueStats().droppedJobs).toBe(1);
			expect(context.bumpSkipped).toHaveBeenCalled();
		});
	});

	// ===========================
	// enqueue → process (debounce)
	// ===========================
	describe("enqueue → process", () => {
		it("debounces at MIN_REVERSE_DEBOUNCE_MS (1500ms) minimum", async () => {
			createWatcher({ debounceDelay: 100 }); // less than 1500
			watcher.start();

			const file = createTFile("vault/imported/file.md");
			mockApp._handlers.get("modify")!(file);

			// At 100ms — not yet processed (MIN is 1500)
			await vi.advanceTimersByTimeAsync(100);
			expect(context.fileSync.syncFileReverse).not.toHaveBeenCalled();

			// At 1500ms — should be processed
			await vi.advanceTimersByTimeAsync(1400);
			expect(context.fileSync.syncFileReverse).toHaveBeenCalledTimes(1);
		});

		it("processes file change via syncFileReverse", async () => {
			createWatcher();
			watcher.start();

			const file = createTFile("vault/imported/file.md");
			mockApp._handlers.get("modify")!(file);

			await vi.advanceTimersByTimeAsync(2000);

			expect(context.fileSync.syncFileReverse).toHaveBeenCalledWith(
				watcher.mapping,
				"vault/imported/file.md",
			);
		});

		it("processes file create via syncFileReverse", async () => {
			createWatcher();
			watcher.start();

			const file = createTFile("vault/imported/new.md");
			mockApp._handlers.get("create")!(file);

			await vi.advanceTimersByTimeAsync(2000);

			expect(context.fileSync.syncFileReverse).toHaveBeenCalledWith(
				watcher.mapping,
				"vault/imported/new.md",
			);
		});

		it("processes file delete via syncDeleteReverse", async () => {
			createWatcher({ deletionHandling: "trash" });
			watcher.start();

			const file = createTFile("vault/imported/deleted.md");
			mockApp._handlers.get("delete")!(file);

			await vi.advanceTimersByTimeAsync(2000);

			expect(context.fileSync.syncDeleteReverse).toHaveBeenCalledWith(
				watcher.mapping,
				"vault/imported/deleted.md",
			);
		});

		it("bumps processed count on success", async () => {
			createWatcher();
			watcher.start();

			const file = createTFile("vault/imported/file.md");
			mockApp._handlers.get("modify")!(file);

			await vi.advanceTimersByTimeAsync(2000);

			expect(context.bumpProcessed).toHaveBeenCalledWith(
				watcher.mapping.id,
				"vault/imported/file.md",
			);
		});

		it("bumps error count on failure", async () => {
			context.fileSync.syncFileReverse = vi.fn().mockResolvedValue({
				ok: false,
				error: new Error("sync failed"),
			});
			createWatcher();
			watcher.start();

			const file = createTFile("vault/imported/file.md");
			mockApp._handlers.get("modify")!(file);

			await vi.advanceTimersByTimeAsync(2000);

			expect(context.bumpError).toHaveBeenCalledWith(watcher.mapping.id);
		});

		it("bumps skipped count when result.action === 'skipped'", async () => {
			context.fileSync.syncFileReverse = vi.fn().mockResolvedValue({
				ok: true,
				action: "skipped",
				reason: "conflict_skip",
			});
			createWatcher();
			watcher.start();

			const file = createTFile("vault/imported/file.md");
			mockApp._handlers.get("modify")!(file);

			await vi.advanceTimersByTimeAsync(2000);

			expect(context.bumpSkipped).toHaveBeenCalledWith(watcher.mapping.id);
		});

		it("bumps error count on thrown exception", async () => {
			context.fileSync.syncFileReverse = vi.fn().mockRejectedValue(new Error("crash"));
			createWatcher();
			watcher.start();

			const file = createTFile("vault/imported/file.md");
			mockApp._handlers.get("modify")!(file);

			await vi.advanceTimersByTimeAsync(2000);

			expect(context.bumpError).toHaveBeenCalledWith(watcher.mapping.id);
		});
	});

	// ===========================
	// onFileRename
	// ===========================
	describe("onFileRename", () => {
		it("rename within target → calls syncMoveReverse", async () => {
			createWatcher({ deletionHandling: "trash" });
			watcher.start();

			const file = createTFile("vault/imported/renamed.md");
			mockApp._handlers.get("rename")!(file, "vault/imported/original.md");

			await vi.advanceTimersByTimeAsync(2000);

			expect(context.fileSync.syncMoveReverse).toHaveBeenCalledWith(
				watcher.mapping,
				"vault/imported/original.md",
				"vault/imported/renamed.md",
			);
		});

		it("rename out of target → enqueue as deleted", async () => {
			createWatcher({ deletionHandling: "trash" });
			watcher.start();

			const file = createTFile("other/folder/moved.md");
			mockApp._handlers.get("rename")!(file, "vault/imported/moved.md");

			await vi.advanceTimersByTimeAsync(2000);

			expect(context.fileSync.syncDeleteReverse).toHaveBeenCalledWith(
				watcher.mapping,
				"vault/imported/moved.md",
			);
		});

		it("rename into target → enqueue as added", async () => {
			createWatcher({ deletionHandling: "trash" });
			watcher.start();

			const file = createTFile("vault/imported/incoming.md");
			mockApp._handlers.get("rename")!(file, "other/folder/incoming.md");

			await vi.advanceTimersByTimeAsync(2000);

			expect(context.fileSync.syncFileReverse).toHaveBeenCalledWith(
				watcher.mapping,
				"vault/imported/incoming.md",
			);
		});

		it("ignores rename when deletionHandling is 'ignore'", async () => {
			createWatcher({ deletionHandling: "ignore" });
			watcher.start();

			const file = createTFile("vault/imported/renamed.md");
			mockApp._handlers.get("rename")!(file, "vault/imported/original.md");

			await vi.advanceTimersByTimeAsync(2000);

			expect(context.fileSync.syncMoveReverse).not.toHaveBeenCalled();
			expect(context.fileSync.syncDeleteReverse).not.toHaveBeenCalled();
			expect(context.fileSync.syncFileReverse).not.toHaveBeenCalled();
		});
	});

	// ===========================
	// onFileDelete
	// ===========================
	describe("onFileDelete", () => {
		it("ignores delete when deletionHandling is 'ignore'", async () => {
			createWatcher({ deletionHandling: "ignore" });
			watcher.start();

			const file = createTFile("vault/imported/deleted.md");
			mockApp._handlers.get("delete")!(file);

			await vi.advanceTimersByTimeAsync(2000);

			expect(context.fileSync.syncDeleteReverse).not.toHaveBeenCalled();
		});

		it("processes delete when deletionHandling is 'trash'", async () => {
			createWatcher({ deletionHandling: "trash" });
			watcher.start();

			const file = createTFile("vault/imported/deleted.md");
			mockApp._handlers.get("delete")!(file);

			await vi.advanceTimersByTimeAsync(2000);

			expect(context.fileSync.syncDeleteReverse).toHaveBeenCalledTimes(1);
		});
	});

	// ===========================
	// Edge cases
	// ===========================
	describe("edge cases", () => {
		it("ignores TAbstractFile that is not TFile", async () => {
			createWatcher();
			watcher.start();

			const folder = createNonTFile("vault/imported/subfolder");
			mockApp._handlers.get("modify")!(folder);

			await vi.advanceTimersByTimeAsync(2000);

			expect(context.fileSync.syncFileReverse).not.toHaveBeenCalled();
		});

		it("getQueueStats returns correct values", () => {
			createWatcher();
			expect(watcher.getQueueStats()).toEqual({
				pendingFiles: 0,
				droppedJobs: 0,
				maxPendingFiles: 1000,
			});
		});

		it("getLastActivity returns null initially, then updates on event", () => {
			createWatcher();
			expect(watcher.getLastActivity()).toBeNull();

			watcher.start();
			const file = createTFile("vault/imported/file.md");
			mockApp._handlers.get("modify")!(file);

			expect(watcher.getLastActivity()).toBeTypeOf("number");
		});

		it("getWatchedFileCount returns 0 (event-based, not per-file)", () => {
			createWatcher();
			expect(watcher.getWatchedFileCount()).toBe(0);
		});
	});
});
