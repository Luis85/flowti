/**
 * Journey 2: Edit from Both Obsidian and VS Code
 *
 * Persona: The Developer (Sam)
 * @see docs/journeys/journey-2-edit-from-both-sides.md
 */

import { describe, it, expect, vi } from "vitest";
import { TFile, TAbstractFile } from "obsidian";

// Mock fs/promises at module level (ESM exports can't be spied on)
vi.mock("fs/promises", async (importOriginal) => {
	const actual = await importOriginal<typeof import("fs/promises")>();
	return {
		...actual,
		stat: vi.fn(),
	};
});

// Mock LogService
vi.mock("../../src/services/LogService", () => ({
	LogService: {
		debug: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
	},
}));

import * as fsp from "fs/promises";
import { ConflictResolver } from "../../src/services/ConflictResolver";
import { SyncLoopDetector } from "../../src/services/SyncLoopDetector";
import { VaultWatcher } from "../../src/watcher/VaultWatcher";
import {
	createMockVaultAdapter,
	createMockVault,
	createMockApp as createMockAppFactory,
	createMockMapping,
	createMockVaultWatcherContext,
} from "../mocks/factories";

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

describe("Journey 2: Edit from Both Obsidian and VS Code", () => {

	it("Happy path: vault edit → debounced reverse sync → loop detector blocks bounce → cooldown → forward sync", async () => {
		vi.useFakeTimers();

		// --- Step 1: Bidirectional mapping ---
		const mapping = createMockMapping({
			id: "bidir-dev",
			sourceFolder: "/external/dev",
			targetFolder: "vault/imported",
			syncDirection: "bidirectional",
			conflictResolution: "keepNewer",
			debounceDelay: 800,
		});

		// --- Step 2 & 3: VaultWatcher debounces vault edits ---
		const mockApp = createMockApp();
		const context = createMockVaultWatcherContext();
		const watcher = new VaultWatcher(mockApp as any, context, mapping);
		watcher.start();

		const file = createTFile("vault/imported/file.md");

		// Rapid edits (simulate typing in Obsidian)
		for (let i = 0; i < 3; i++) {
			mockApp._handlers.get("modify")!(file);
			await vi.advanceTimersByTimeAsync(200);
		}

		// Not yet synced (debounce hasn't fired — MIN_REVERSE_DEBOUNCE_MS = 1500ms)
		expect(context.fileSync.syncFileReverse).not.toHaveBeenCalled();

		// --- Step 4: After debounce, reverse sync fires ---
		await vi.advanceTimersByTimeAsync(2000);
		expect(context.fileSync.syncFileReverse).toHaveBeenCalledTimes(1);

		// --- Step 5 & 6: SyncLoopDetector prevents bounce-back ---
		const loopDetector = new SyncLoopDetector();
		const syncedPath = "/external/dev/file.md";
		loopDetector.recordSync(syncedPath);

		// Source watcher would check this — file IS recently synced → blocked
		expect(loopDetector.isRecentlySynced(syncedPath)).toBe(true);
		// Also test path normalization (Windows-style)
		expect(loopDetector.isRecentlySynced("\\external\\dev\\file.md")).toBe(true);

		// --- Step 7: After 5s cooldown, genuine edit is allowed ---
		const now = Date.now();
		vi.spyOn(Date, "now").mockReturnValue(now + 6000);
		expect(loopDetector.isRecentlySynced(syncedPath)).toBe(false);

		// --- Step 8: Forward sync resolves with keepNewer ---
		vi.spyOn(Date, "now").mockReturnValue(now); // reset for ConflictResolver
		const adapter = createMockVaultAdapter();
		adapter.files.set("vault/imported/file.md", {
			content: new ArrayBuffer(0),
			mtime: 1000000, // older vault version
			size: 100,
		});
		const vault = createMockVault(adapter);
		const app = createMockAppFactory(vault);
		const resolver = new ConflictResolver(app as any);

		vi.mocked(fsp.stat).mockResolvedValueOnce({
			mtimeMs: 2000000, // newer source
			size: 150,
		} as any);

		const decision = await resolver.resolveForward(
			mapping,
			syncedPath,
			"vault/imported/file.md",
		);
		expect(decision.action).toBe("overwrite"); // source is newer → overwrite

		// Cleanup
		loopDetector.destroy();
		await watcher.stop();
		vi.restoreAllMocks();
		vi.useRealTimers();
	});
});
