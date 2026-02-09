/**
 * Feature 3: Deletion & Move Handling — Acceptance Tests
 *
 * Covers how the plugin handles file deletions and renames
 * in both sync directions.
 *
 * @see docs/testplan.md — UC-11 through UC-14
 */

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

// ===========================
// Feature 3: Deletion & Move Handling
// ===========================

describe("Feature 3: Deletion & Move Handling", () => {

	// ==========================================
	// UC-11: Deletion Handling — Ignore
	// ==========================================
	describe("UC-11: Deletion — Ignore", () => {

		it("Scenario 11.2: Deleted vault file stays in source when deletionHandling='ignore'", async () => {
			vi.useFakeTimers();
			const mockApp = createMockApp();
			const context = createMockVaultWatcherContext();
			const mapping = createMockMapping({
				targetFolder: "vault/imported",
				syncDirection: "bidirectional",
				deletionHandling: "ignore",
			});

			const watcher = new VaultWatcher(mockApp as any, context, mapping);
			watcher.start();

			const file = createTFile("vault/imported/file.md");
			mockApp._handlers.get("delete")!(file);

			await vi.advanceTimersByTimeAsync(3000);

			expect(context.fileSync.syncDeleteReverse).not.toHaveBeenCalled();

			await watcher.stop();
			vi.useRealTimers();
		});

		it.skip("Scenario 11.1: Deleted source file remains in vault when deletionHandling='ignore'", () => {
			// Requires MappingWatcher + chokidar integration
		});
	});

	// ==========================================
	// UC-12: Deletion Handling — Trash
	// ==========================================
	describe("UC-12: Deletion — Trash", () => {

		it("Scenario 12.2: Deleted vault file is trashed in source via syncDeleteReverse", async () => {
			vi.useFakeTimers();
			const mockApp = createMockApp();
			const context = createMockVaultWatcherContext();
			const mapping = createMockMapping({
				targetFolder: "vault/imported",
				syncDirection: "bidirectional",
				deletionHandling: "trash",
			});

			const watcher = new VaultWatcher(mockApp as any, context, mapping);
			watcher.start();

			const file = createTFile("vault/imported/deleted.md");
			mockApp._handlers.get("delete")!(file);

			await vi.advanceTimersByTimeAsync(2000);

			expect(context.fileSync.syncDeleteReverse).toHaveBeenCalledWith(
				mapping,
				"vault/imported/deleted.md",
			);

			await watcher.stop();
			vi.useRealTimers();
		});

		it.skip("Scenario 12.1: Deleted source file is trashed in vault via vault.trash()", () => {
			// Requires MappingWatcher + FileSyncService.syncDelete integration
		});
	});

	// ==========================================
	// UC-13: Move Detection
	// ==========================================
	describe("UC-13: Move Detection", () => {

		it("Scenario 13.5: Vault-side rename detected as move → syncMoveReverse", async () => {
			vi.useFakeTimers();
			const mockApp = createMockApp();
			const context = createMockVaultWatcherContext();
			const mapping = createMockMapping({
				targetFolder: "vault/imported",
				syncDirection: "bidirectional",
				deletionHandling: "trash",
			});

			const watcher = new VaultWatcher(mockApp as any, context, mapping);
			watcher.start();

			const file = createTFile("vault/imported/renamed.md");
			mockApp._handlers.get("rename")!(file, "vault/imported/original.md");

			await vi.advanceTimersByTimeAsync(2000);

			expect(context.fileSync.syncMoveReverse).toHaveBeenCalledWith(
				mapping,
				"vault/imported/original.md",
				"vault/imported/renamed.md",
			);

			await watcher.stop();
			vi.useRealTimers();
		});

		it("Scenario 13.6: File moved out of vault target folder → treated as delete", async () => {
			vi.useFakeTimers();
			const mockApp = createMockApp();
			const context = createMockVaultWatcherContext();
			const mapping = createMockMapping({
				targetFolder: "vault/imported",
				syncDirection: "bidirectional",
				deletionHandling: "trash",
			});

			const watcher = new VaultWatcher(mockApp as any, context, mapping);
			watcher.start();

			const file = createTFile("vault/other/moved.md");
			mockApp._handlers.get("rename")!(file, "vault/imported/moved.md");

			await vi.advanceTimersByTimeAsync(2000);

			expect(context.fileSync.syncDeleteReverse).toHaveBeenCalledWith(
				mapping,
				"vault/imported/moved.md",
			);

			await watcher.stop();
			vi.useRealTimers();
		});

		it("Scenario 13.7: File moved into vault target folder → treated as add", async () => {
			vi.useFakeTimers();
			const mockApp = createMockApp();
			const context = createMockVaultWatcherContext();
			const mapping = createMockMapping({
				targetFolder: "vault/imported",
				syncDirection: "bidirectional",
				deletionHandling: "trash",
			});

			const watcher = new VaultWatcher(mockApp as any, context, mapping);
			watcher.start();

			const file = createTFile("vault/imported/incoming.md");
			mockApp._handlers.get("rename")!(file, "vault/other/incoming.md");

			await vi.advanceTimersByTimeAsync(2000);

			expect(context.fileSync.syncFileReverse).toHaveBeenCalledWith(
				mapping,
				"vault/imported/incoming.md",
			);

			await watcher.stop();
			vi.useRealTimers();
		});

		it("Scenario 13: Rename ignored when deletionHandling='ignore'", async () => {
			vi.useFakeTimers();
			const mockApp = createMockApp();
			const context = createMockVaultWatcherContext();
			const mapping = createMockMapping({
				targetFolder: "vault/imported",
				syncDirection: "bidirectional",
				deletionHandling: "ignore",
			});

			const watcher = new VaultWatcher(mockApp as any, context, mapping);
			watcher.start();

			const file = createTFile("vault/imported/renamed.md");
			mockApp._handlers.get("rename")!(file, "vault/imported/original.md");

			await vi.advanceTimersByTimeAsync(2000);

			expect(context.fileSync.syncMoveReverse).not.toHaveBeenCalled();
			expect(context.fileSync.syncDeleteReverse).not.toHaveBeenCalled();
			expect(context.fileSync.syncFileReverse).not.toHaveBeenCalled();

			await watcher.stop();
			vi.useRealTimers();
		});

		it.skip("Scenario 13.1: File renamed in source detected as move (size+ext match within 2s)", () => {
			// Requires MappingWatcher.bufferDelete + tryMatchMove with chokidar
		});

		it.skip("Scenario 13.2: Same size but different extension NOT matched as move", () => {
			// Requires MappingWatcher.tryMatchMove with filesystem mocking
		});

		it.skip("Scenario 13.3: Move window expires → processed as regular deletion", () => {
			// Requires MappingWatcher with fake timers + MOVE_DETECT_WINDOW_MS
		});

		it.skip("Scenario 13.4: No size info falls back to delete (no move buffering)", () => {
			// Requires MappingWatcher with SyncStateService returning undefined
		});
	});

	// ==========================================
	// UC-14: Orphan Cleanup
	// ==========================================
	describe("UC-14: Orphan Cleanup", () => {

		it.skip("Scenario 14.1: Orphaned vault file is trashed during reconciliation", () => {
			// Requires FileSyncService.reconcileFolder with orphan cleanup logic
		});

		it.skip("Scenario 14.2: Files matching source are kept", () => {
			// Requires FileSyncService.reconcileFolder with both source and vault files
		});

		it.skip("Scenario 14.3: Extension filter is respected during cleanup", () => {
			// Requires FileSyncService.reconcileFolder with fileExtensions filter
		});

		it.skip("Scenario 14.4: Exclude patterns respected during cleanup", () => {
			// Requires FileSyncService.reconcileFolder with excludePatterns
		});

		it.skip("Scenario 14.5: Trash failure is handled gracefully", () => {
			// Requires vault.trash to throw + error count verification
		});
	});
});
