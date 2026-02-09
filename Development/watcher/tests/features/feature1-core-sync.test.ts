/**
 * Feature 1: Core Synchronization — Acceptance Tests
 *
 * Covers the three sync directions (source-only, vault-only, bidirectional),
 * subfolder depth, and new directory detection.
 *
 * @see docs/testplan.md — UC-01 through UC-05
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TFile, TAbstractFile } from "obsidian";

// Mock LogService before importing modules that use it
vi.mock("../../src/services/LogService", () => ({
	LogService: {
		debug: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
	},
}));

import { VaultWatcher } from "../../src/watcher/VaultWatcher";
import { WatcherManager } from "../../src/watcher/WatcherManager";
import {
	createMockVaultWatcherContext,
	createMockWatcherManagerContext,
	createMockMapping,
	createMockSettings,
} from "../mocks/factories";

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
// Feature 1: Core Synchronization
// ===========================

describe("Feature 1: Core Synchronization", () => {

	// ===========================================
	// UC-01: Source-Only Sync (external → vault)
	// ===========================================
	describe("UC-01: Source-Only Sync (external → vault)", () => {

		// Scenario 1.1 & 1.2 — MappingWatcher processes file add/change events.
		// These require chokidar to be running so they're tested via integration.
		// Here we verify the WatcherManager creates only a source watcher for "source-only".

		it("Scenario 1.4: VaultWatcher should NOT be started for source-only mapping", () => {
			const mockApp = createMockApp();
			const context = createMockVaultWatcherContext();
			const mapping = createMockMapping({
				targetFolder: "vault/imported",
				syncDirection: "source-only",
			});

			const watcher = new VaultWatcher(mockApp as any, context, mapping);
			watcher.start();

			// source-only → VaultWatcher should not register any event handlers
			expect(mockApp.vault.on).not.toHaveBeenCalled();
		});

		it.skip("Scenario 1.1: New file appears in source folder → synced to vault", () => {
			// Requires chokidar integration (MappingWatcher + real filesystem)
		});

		it.skip("Scenario 1.2: Existing file modified in source → vault file updated", () => {
			// Requires chokidar integration (MappingWatcher + real filesystem)
		});

		it.skip("Scenario 1.3: File in subfolder is synced with intermediate folders", () => {
			// Requires chokidar + vault.createFolder integration
		});
	});

	// =============================================
	// UC-02: Vault-Only Sync (vault → external)
	// =============================================
	describe("UC-02: Vault-Only Sync (vault → external)", () => {
		let mockApp: ReturnType<typeof createMockApp>;
		let context: ReturnType<typeof createMockVaultWatcherContext>;

		beforeEach(() => {
			vi.useFakeTimers();
			mockApp = createMockApp();
			context = createMockVaultWatcherContext();
		});

		afterEach(() => {
			vi.useRealTimers();
		});

		it("Scenario 2.1: File modified in vault is exported via syncFileReverse", async () => {
			const mapping = createMockMapping({
				targetFolder: "vault/export",
				sourceFolder: "/external/output",
				syncDirection: "vault-only",
			});

			const watcher = new VaultWatcher(mockApp as any, context, mapping);
			watcher.start();

			// VaultWatcher should register event handlers for vault-only
			expect(mockApp.vault.on).toHaveBeenCalledTimes(4);

			const file = createTFile("vault/export/notes.md");
			mockApp._handlers.get("modify")!(file);

			await vi.advanceTimersByTimeAsync(2000);

			expect(context.fileSync.syncFileReverse).toHaveBeenCalledWith(
				mapping,
				"vault/export/notes.md",
			);

			await watcher.stop();
		});

		it("Scenario 2.2: New file created in vault is exported", async () => {
			const mapping = createMockMapping({
				targetFolder: "vault/export",
				sourceFolder: "/external/output",
				syncDirection: "vault-only",
			});

			const watcher = new VaultWatcher(mockApp as any, context, mapping);
			watcher.start();

			const file = createTFile("vault/export/new.md");
			mockApp._handlers.get("create")!(file);

			await vi.advanceTimersByTimeAsync(2000);

			expect(context.fileSync.syncFileReverse).toHaveBeenCalledWith(
				mapping,
				"vault/export/new.md",
			);

			await watcher.stop();
		});

		it.skip("Scenario 2.3: External changes are NOT pulled into vault (MappingWatcher not started)", () => {
			// Requires WatcherManager integration with real MappingWatcher
			// Verifying that vault-only doesn't create a MappingWatcher
		});
	});

	// ==========================================
	// UC-03: Bidirectional Sync
	// ==========================================
	describe("UC-03: Bidirectional Sync", () => {
		let mockApp: ReturnType<typeof createMockApp>;
		let context: ReturnType<typeof createMockVaultWatcherContext>;

		beforeEach(() => {
			vi.useFakeTimers();
			mockApp = createMockApp();
			context = createMockVaultWatcherContext();
		});

		afterEach(() => {
			vi.useRealTimers();
		});

		it("Scenario 3.2: Vault change syncs to source via syncFileReverse", async () => {
			const mapping = createMockMapping({
				targetFolder: "vault/imported",
				sourceFolder: "/external/notes",
				syncDirection: "bidirectional",
			});

			const watcher = new VaultWatcher(mockApp as any, context, mapping);
			watcher.start();

			// Both directions → VaultWatcher should register
			expect(mockApp.vault.on).toHaveBeenCalledTimes(4);

			const file = createTFile("vault/imported/file.md");
			mockApp._handlers.get("modify")!(file);

			await vi.advanceTimersByTimeAsync(2000);

			expect(context.fileSync.syncFileReverse).toHaveBeenCalledWith(
				mapping,
				"vault/imported/file.md",
			);

			await watcher.stop();
		});

		it("Scenario 3.3: Recently synced files are blocked by loop detector", async () => {
			context.fileSync.isRecentlySynced = vi.fn().mockReturnValue(true);
			const mapping = createMockMapping({
				targetFolder: "vault/imported",
				syncDirection: "bidirectional",
			});

			const watcher = new VaultWatcher(mockApp as any, context, mapping);
			watcher.start();

			const file = createTFile("vault/imported/file.md");
			mockApp._handlers.get("modify")!(file);

			await vi.advanceTimersByTimeAsync(3000);

			// Loop detector should block the reverse sync
			expect(context.fileSync.syncFileReverse).not.toHaveBeenCalled();

			await watcher.stop();
		});

		it.skip("Scenario 3.1: Source change syncs to vault (requires MappingWatcher + chokidar)", () => {
			// Requires MappingWatcher with real chokidar
		});
	});

	// ==========================================
	// UC-04: Subfolder Watching
	// ==========================================
	describe("UC-04: Subfolder Watching", () => {

		it.skip("Scenario 4.1: Subfolders included when watchSubfolders=true (chokidar depth: undefined)", () => {
			// Requires chokidar config verification through MappingWatcher
		});

		it.skip("Scenario 4.2: Subfolders excluded when watchSubfolders=false (chokidar depth: 0)", () => {
			// Requires chokidar config verification through MappingWatcher
		});
	});

	// ==========================================
	// UC-05: New Directory Detection
	// ==========================================
	describe("UC-05: New Directory Detection", () => {

		it.skip("Scenario 5.1: New directory triggers incremental reconcile", () => {
			// Requires MappingWatcher.onDirAdded + reconcileNewDir with chokidar
		});

		it.skip("Scenario 5.2: Directory events are debounced (min 250ms)", () => {
			// Requires MappingWatcher.onDirAdded with fake timers
		});

		it.skip("Scenario 5.3: Directory queue has backpressure limit (MAX_PENDING_DIRS=100)", () => {
			// Requires MappingWatcher with 100+ directory events
		});
	});

	// ==========================================
	// WatcherManager: Sync Direction Routing
	// ==========================================
	describe("WatcherManager: Sync Direction Routing", () => {

		it.skip("source-only mapping creates MappingWatcher but not VaultWatcher", () => {
			// Requires WatcherManager with chokidar mocking — deferred
		});

		it.skip("vault-only mapping creates VaultWatcher but not MappingWatcher", () => {
			// Requires WatcherManager with chokidar mocking — deferred
		});

		it.skip("bidirectional mapping creates both MappingWatcher and VaultWatcher", () => {
			// Requires WatcherManager with chokidar mocking — deferred
		});
	});
});
