/**
 * User Journey — Happy Path Tests
 *
 * End-to-end journeys that cross multiple features and validate
 * that components work together correctly.
 *
 * @see docs/testplan.md — Top 3 User Journeys
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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
import {
	isTempFile,
	isAllowedByExtensions,
	matchesExcludePattern,
	createIgnoredMatcher,
	validateSourcePath,
	validateTargetPath,
	toVaultPath,
} from "../../src/utils";
import { ConflictResolver } from "../../src/services/ConflictResolver";
import { SyncStateService } from "../../src/services/SyncStateService";
import { SyncLoopDetector } from "../../src/services/SyncLoopDetector";
import { ReconcileService } from "../../src/services/ReconcileService";
import { VaultWatcher } from "../../src/watcher/VaultWatcher";
import {
	createMockVaultAdapter,
	createMockVault,
	createMockApp as createMockAppFactory,
	createMockMapping,
	createMockSettings,
	createMockVaultWatcherContext,
	createMockReconcileContext,
	createMockFileSyncService,
	createMockNoticeService,
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
// Journey 1: Import External Notes into Obsidian
// ===========================

describe("Journey 1: Import External Notes into Obsidian", () => {

	it("Happy path: file passes filter pipeline → validates → resolves conflict → records state → skips on re-check", async () => {
		// --- Step 1: Set up a source-only mapping ---
		const mapping = createMockMapping({
			id: "import-notes",
			sourceFolder: "/external/notes",
			targetFolder: "vault/imported",
			syncDirection: "source-only",
			fileExtensions: [".md", ".txt"],
			excludePatterns: ["*.log", "build/**"],
			conflictResolution: "overwrite",
		});

		// --- Step 2: A new file appears ---
		const sourceFile = "/external/notes/report.md";
		const targetFile = "vault/imported/report.md";

		// --- Step 3: Filter out temp files and dotfiles ---
		const ignoredMatcher = createIgnoredMatcher(true);
		expect(ignoredMatcher("~$report.docx")).toBe(true);   // Office lock → filtered
		expect(ignoredMatcher(".DS_Store")).toBe(true);         // macOS system → filtered
		expect(ignoredMatcher("report.md")).toBe(false);        // Our file → passes

		// --- Step 4: Extension filter allows .md but blocks .exe ---
		expect(isAllowedByExtensions("report.md", mapping.fileExtensions!)).toBe(true);
		expect(isAllowedByExtensions("malware.exe", mapping.fileExtensions!)).toBe(false);

		// Exclude patterns block .log and build/ files
		expect(matchesExcludePattern("debug.log", mapping.excludePatterns!)).toBe(true);
		expect(matchesExcludePattern("build/output/bundle.js", mapping.excludePatterns!)).toBe(true);
		expect(matchesExcludePattern("report.md", mapping.excludePatterns!)).toBe(false);

		// --- Step 5: Path validation ---
		expect(() => validateSourcePath(sourceFile, mapping.sourceFolder)).not.toThrow();
		expect(() => validateTargetPath(targetFile, mapping.targetFolder)).not.toThrow();

		// --- Step 6: Conflict resolution (first sync → overwrite) ---
		const adapter = createMockVaultAdapter();
		const vault = createMockVault(adapter);
		const app = createMockAppFactory(vault);
		const resolver = new ConflictResolver(app as any);

		const decision = await resolver.resolveForward(mapping, sourceFile, targetFile);
		expect(decision.action).toBe("overwrite");
		expect(decision.targetPath).toBe(targetFile);

		// --- Step 7 & 8: Sync state records the file ---
		const syncState = new SyncStateService(
			{ vault: { adapter: { basePath: "/tmp" } } } as any,
			"test",
		);
		syncState.recordSync("import-notes", "/external/notes", "report.md", {
			mtimeMs: 1700000000000,
			size: 2048,
		});

		// --- Step 9: Subsequent re-check skips unchanged file ---
		expect(
			syncState.needsSync("import-notes", "/external/notes", "report.md", {
				mtimeMs: 1700000000000,
				size: 2048,
			}),
		).toBe(false);

		// A modified version IS detected
		expect(
			syncState.needsSync("import-notes", "/external/notes", "report.md", {
				mtimeMs: 1700000001000,
				size: 2100,
			}),
		).toBe(true);
	});

	it("Rejects files that fail the filter pipeline", () => {
		const mapping = createMockMapping({
			fileExtensions: [".md"],
			excludePatterns: ["node_modules"],
		});

		// Temp file → rejected at step 3
		expect(isTempFile("~$document.docx")).toBe(true);

		// Wrong extension → rejected at step 4
		expect(isAllowedByExtensions("image.png", mapping.fileExtensions!)).toBe(false);

		// Excluded pattern → rejected at step 4
		expect(matchesExcludePattern("node_modules/pkg/index.js", mapping.excludePatterns!)).toBe(true);
	});
});

// ===========================
// Journey 2: Edit from Both Obsidian and VS Code
// ===========================

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

// ===========================
// Journey 3: Catch Up After a Weekend Away
// ===========================

describe("Journey 3: Catch Up After a Weekend Away", () => {

	it("Happy path: reconcile enabled mappings → skip unchanged → sync modified → concurrent guard → cancel", async () => {
		// --- Step 1: Settings with syncOnStart ---
		const m1 = createMockMapping({
			id: "notes",
			enabled: true,
			reconcileOnStart: true,
			sourceFolder: "/dropbox/notes",
			targetFolder: "vault/notes",
		});
		const m2 = createMockMapping({
			id: "docs",
			enabled: true,
			reconcileOnStart: true,
			sourceFolder: "/dropbox/docs",
			targetFolder: "vault/docs",
		});
		const disabled = createMockMapping({
			id: "disabled-map",
			enabled: false,
			reconcileOnStart: true,
		});

		// --- Step 2: ReconcileService processes only enabled mappings ---
		const ctx = createMockReconcileContext({
			settings: createMockSettings({
				syncOnStart: true,
				folderMappings: [m1, m2, disabled],
			}),
		});
		const fileSync = createMockFileSyncService({
			reconcileMapping: vi.fn().mockResolvedValue({
				scanned: 20,
				processed: 5,
				skipped: 15,
				errors: 0,
				deleted: 0,
			}),
		});

		const service = new ReconcileService(ctx, fileSync);
		await service.reconcileOnStart();

		// Only enabled mappings are reconciled (2 of 3)
		expect(fileSync.reconcileMapping).toHaveBeenCalledTimes(2);
		expect(ctx.applyReconcileStats).toHaveBeenCalledWith("notes", expect.any(Object));
		expect(ctx.applyReconcileStats).toHaveBeenCalledWith("docs", expect.any(Object));

		// --- Steps 3 & 4: SyncStateService differentiates unchanged vs modified ---
		const syncState = new SyncStateService(
			{ vault: { adapter: { basePath: "/tmp" } } } as any,
			"test",
		);

		// Record files from last week
		syncState.recordSync("notes", "/dropbox/notes", "unchanged.md", {
			mtimeMs: 1700000000000,
			size: 500,
		});
		syncState.recordSync("notes", "/dropbox/notes", "modified.md", {
			mtimeMs: 1700000000000,
			size: 500,
		});

		// Step 3: Unchanged file → skip
		expect(
			syncState.needsSync("notes", "/dropbox/notes", "unchanged.md", {
				mtimeMs: 1700000000000,
				size: 500,
			}),
		).toBe(false);

		// Step 4: Modified file → needs sync
		expect(
			syncState.needsSync("notes", "/dropbox/notes", "modified.md", {
				mtimeMs: 1700000086400, // weekend edit
				size: 800,
			}),
		).toBe(true);

		// Step 5: New file → needs sync (no prior state)
		expect(
			syncState.needsSync("notes", "/dropbox/notes", "brand-new.md", {
				mtimeMs: 1700000000000,
				size: 100,
			}),
		).toBe(true);

		// --- Step 6: Concurrent guard ---
		let resolveReconcile: (() => void) | undefined;
		const fileSync2 = createMockFileSyncService({
			reconcileMapping: vi.fn().mockImplementation(
				() =>
					new Promise<any>((resolve) => {
						resolveReconcile = () =>
							resolve({ scanned: 10, processed: 5, skipped: 3, errors: 0, deleted: 0 });
					}),
			),
		});

		const notice = createMockNoticeService();
		const service2 = new ReconcileService(
			createMockReconcileContext({
				settings: createMockSettings({
					syncOnStart: true,
					folderMappings: [m1],
				}),
			}),
			fileSync2,
			notice,
		);

		// Start first reconciliation
		const first = service2.reconcileAll();
		expect(service2.isRunning()).toBe(true);

		// Second attempt is rejected (concurrent guard)
		const second = await service2.reconcileAll();
		expect(second).toBe(false);
		expect(notice.calls.some((c) => c.message.includes("already in progress"))).toBe(true);

		// Complete first
		resolveReconcile!();
		await first;
		expect(service2.isRunning()).toBe(false);

		// --- Step 7: Cancel stops processing ---
		const m3 = createMockMapping({ id: "m3", enabled: true });
		const m4 = createMockMapping({ id: "m4", enabled: true });
		const fileSync3 = createMockFileSyncService({
			reconcileMapping: vi.fn().mockResolvedValue({
				scanned: 10,
				processed: 5,
				skipped: 3,
				errors: 0,
				deleted: 0,
			}),
		});

		const service3 = new ReconcileService(
			createMockReconcileContext({
				settings: createMockSettings({ folderMappings: [m3, m4] }),
			}),
			fileSync3,
		);

		const promise = service3.reconcileMappings([m3, m4], {
			onProgress: (p) => {
				if (p.mappingId === "m3" && p.phase === "done") {
					service3.cancel();
				}
			},
			onMappingDone: vi.fn(),
		});

		await promise;

		// First mapping processed, second cancelled
		expect(fileSync3.reconcileMapping).toHaveBeenCalledTimes(1);
		expect(service3.isRunning()).toBe(false);
	});

	it("Disabled mappings and syncOnStart=false are respected", async () => {
		const mapping = createMockMapping({
			id: "m1",
			enabled: true,
			reconcileOnStart: true,
		});
		const ctx = createMockReconcileContext({
			settings: createMockSettings({
				syncOnStart: false,
				folderMappings: [mapping],
			}),
		});
		const fileSync = createMockFileSyncService();

		const service = new ReconcileService(ctx, fileSync);
		await service.reconcileOnStart();

		expect(fileSync.reconcileMapping).not.toHaveBeenCalled();
	});
});
