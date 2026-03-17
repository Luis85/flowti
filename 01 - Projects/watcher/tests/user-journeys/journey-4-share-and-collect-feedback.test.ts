/**
 * Journey 4: Share Drafts and Collect Feedback
 *
 * Persona: The Collaborator (Chris)
 * @see docs/journeys/journey-4-share-and-collect-feedback.md
 */

import { describe, it, expect, vi } from "vitest";
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

import {
	isTempFile,
	createIgnoredMatcher,
} from "../../src/utils";
import { ConflictResolver } from "../../src/services/ConflictResolver";
import { SyncLoopDetector } from "../../src/services/SyncLoopDetector";
import { ReconcileService } from "../../src/services/ReconcileService";
import { withRetry, isRetryableError } from "../../src/services/retry";
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

describe("Journey 4: Share Drafts and Collect Feedback", () => {

	it("Happy path: vault edit → reverse sync → lock files filtered → rename conflict preserves both → retry on EBUSY → loop detector → reconcile", async () => {
		vi.useFakeTimers();

		// --- Step 1: Bidirectional mapping with rename conflict strategy ---
		const mapping = createMockMapping({
			id: "team-share",
			sourceFolder: "/shared/team",
			targetFolder: "vault/team",
			syncDirection: "bidirectional",
			conflictResolution: "rename",
			debounceDelay: 800,
		});

		// --- Steps 2 & 3: Chris writes proposal.md in Obsidian, VaultWatcher picks it up ---
		const mockApp = createMockApp();
		const context = createMockVaultWatcherContext();
		const watcher = new VaultWatcher(mockApp as any, context, mapping);
		watcher.start();

		const file = createTFile("vault/team/proposal.md");
		mockApp._handlers.get("modify")!(file);

		// After debounce (MIN_REVERSE_DEBOUNCE_MS = 1500ms), reverse sync fires
		await vi.advanceTimersByTimeAsync(2000);
		expect(context.fileSync.syncFileReverse).toHaveBeenCalledTimes(1);

		await watcher.stop();
		vi.useRealTimers();

		// --- Steps 4 & 5: Colleague opens file in Word → lock file filtered out ---
		const ignoredMatcher = createIgnoredMatcher(true);
		expect(ignoredMatcher("~$proposal.docx")).toBe(true);   // Office lock → filtered
		expect(ignoredMatcher("~$proposal.md")).toBe(true);     // Office lock for .md → filtered
		expect(ignoredMatcher("proposal.md")).toBe(false);       // Actual file → passes

		// --- Steps 6 & 7: Concurrent edit → rename conflict preserves both versions ---
		const adapter = createMockVaultAdapter();
		// proposal.md already exists in vault (Chris's version)
		adapter.files.set("vault/team/proposal.md", {
			content: new ArrayBuffer(100),
			mtime: 1700000000000,
			size: 100,
		});
		const vault = createMockVault(adapter);
		const app = createMockAppFactory(vault);
		const resolver = new ConflictResolver(app as any);

		const decision = await resolver.resolveForward(
			mapping,
			"/shared/team/proposal.md",
			"vault/team/proposal.md",
		);
		// Rename strategy → creates a conflict copy, original untouched
		expect(decision.action).toBe("rename");
		expect(decision.targetPath).toContain("proposal (conflict");
		expect(decision.targetPath).toContain(").md");

		// --- Step 8: Source file is locked by colleague (EBUSY) → retry succeeds ---
		const ebusyError = new Error("EBUSY: resource busy") as NodeJS.ErrnoException;
		ebusyError.code = "EBUSY";
		expect(isRetryableError(ebusyError)).toBe(true);

		// Non-retryable errors are not retried
		const enoentError = new Error("ENOENT: no such file") as NodeJS.ErrnoException;
		enoentError.code = "ENOENT";
		expect(isRetryableError(enoentError)).toBe(false);

		// withRetry succeeds on second attempt after EBUSY
		let attempt = 0;
		const result = await withRetry(
			async () => {
				attempt++;
				if (attempt === 1) throw ebusyError;
				return "synced";
			},
			{ maxRetries: 3, baseDelayMs: 1, maxDelayMs: 5 },
		);
		expect(result).toBe("synced");
		expect(attempt).toBe(2);

		// --- Step 9: Loop detector prevents bounce-back ---
		const loopDetector = new SyncLoopDetector();
		const syncedPath = "/shared/team/proposal.md";
		loopDetector.recordSync(syncedPath);

		// Forward sync just happened → reverse should be blocked
		expect(loopDetector.isRecentlySynced(syncedPath)).toBe(true);

		loopDetector.destroy();

		// --- Step 10: Next morning — reconciliation catches missed changes ---
		const ctx = createMockReconcileContext({
			settings: createMockSettings({
				syncOnStart: true,
				folderMappings: [
					createMockMapping({
						id: "team-share",
						enabled: true,
						reconcileOnStart: true,
						sourceFolder: "/shared/team",
						targetFolder: "vault/team",
					}),
				],
			}),
		});
		const fileSync = createMockFileSyncService({
			reconcileMapping: vi.fn().mockResolvedValue({
				scanned: 30,
				processed: 3,
				skipped: 27,
				errors: 0,
				deleted: 0,
			}),
		});

		const reconcileService = new ReconcileService(ctx, fileSync);
		await reconcileService.reconcileOnStart();

		expect(fileSync.reconcileMapping).toHaveBeenCalledTimes(1);
		expect(ctx.applyReconcileStats).toHaveBeenCalledWith("team-share", expect.any(Object));
	});

	it("Office lock files and temp files from colleagues are always filtered", () => {
		const ignoredMatcher = createIgnoredMatcher(true);

		// Word lock files
		expect(ignoredMatcher("~$report.docx")).toBe(true);
		expect(ignoredMatcher("~$notes.doc")).toBe(true);

		// Excel lock files
		expect(ignoredMatcher("~$budget.xlsx")).toBe(true);

		// Temp files from cloud sync
		expect(isTempFile("document.tmp")).toBe(true);
		expect(isTempFile("download.partial")).toBe(true);
		expect(isTempFile("file.crdownload")).toBe(true);

		// Actual files pass through
		expect(ignoredMatcher("proposal.md")).toBe(false);
		expect(ignoredMatcher("feedback.txt")).toBe(false);
	});

	it("Rename conflict generates unique filenames for multiple colleague edits", async () => {
		const mapping = createMockMapping({
			conflictResolution: "rename",
		});

		const adapter = createMockVaultAdapter();
		// Original file exists
		adapter.files.set("vault/team/proposal.md", {
			content: new ArrayBuffer(50),
			mtime: 1700000000000,
			size: 50,
		});
		const vault = createMockVault(adapter);
		const app = createMockAppFactory(vault);
		const resolver = new ConflictResolver(app as any);

		// First colleague edit → creates conflict copy
		const d1 = await resolver.resolveForward(
			mapping,
			"/shared/team/proposal.md",
			"vault/team/proposal.md",
		);
		expect(d1.action).toBe("rename");
		expect(d1.targetPath).toContain("proposal (conflict");

		// Simulate that the first conflict copy also exists now
		adapter.files.set(d1.targetPath, {
			content: new ArrayBuffer(60),
			mtime: 1700000001000,
			size: 60,
		});

		// Second colleague edit → creates another unique conflict copy
		const d2 = await resolver.resolveForward(
			mapping,
			"/shared/team/proposal.md",
			"vault/team/proposal.md",
		);
		expect(d2.action).toBe("rename");
		expect(d2.targetPath).toContain("proposal (conflict");
		// Both conflict copies have unique names
		expect(d2.targetPath).not.toBe(d1.targetPath);
	});
});
