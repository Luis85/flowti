/**
 * Feature 6: Reliability & Performance — Acceptance Tests
 *
 * Covers stability checks, retry logic, loop prevention, debounce,
 * and backpressure/queue limits.
 *
 * @see docs/testplan.md — UC-25 through UC-29
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

import { SyncLoopDetector } from "../../src/services/SyncLoopDetector";
import { isRetryableError, withRetry, PathTraversalError } from "../../src/services/retry";
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

function createErrnoError(code: string, message: string): NodeJS.ErrnoException {
	const err = new Error(message) as NodeJS.ErrnoException;
	err.code = code;
	return err;
}

// ===========================
// Feature 6: Reliability & Performance
// ===========================

describe("Feature 6: Reliability & Performance", () => {

	// ==========================================
	// UC-25: File Stability Checks
	// ==========================================
	describe("UC-25: File Stability Checks", () => {

		it.skip("Scenario 25.1: Unstable file is delayed until stable", () => {
			// Requires FileSyncService.verifyStability with multi-stat mocking
		});

		it.skip("Scenario 25.2: File that never stabilizes is skipped", () => {
			// Requires FileSyncService.verifyStability returning not_stable
		});

		it.skip("Scenario 25.3: Stability checks disabled during reconciliation", () => {
			// Requires integration with ReconcileService + disableStabilityCheckDuringReconcile
		});
	});

	// ==========================================
	// UC-26: Retry on Transient Errors
	// ==========================================
	describe("UC-26: Retry on Transient Errors", () => {

		it("Scenario 26.1: EBUSY is retryable", () => {
			expect(isRetryableError(createErrnoError("EBUSY", "file locked"))).toBe(true);
			expect(isRetryableError(createErrnoError("EAGAIN", "resource temporarily unavailable"))).toBe(true);
			expect(isRetryableError(createErrnoError("EMFILE", "too many open files"))).toBe(true);
			expect(isRetryableError(createErrnoError("ENFILE", "too many open files in system"))).toBe(true);
			expect(isRetryableError(createErrnoError("ENOTEMPTY", "directory not empty"))).toBe(true);
		});

		it("Scenario 26.2: ENOENT is NOT retryable (permanent error)", () => {
			expect(isRetryableError(createErrnoError("ENOENT", "file not found"))).toBe(false);
			expect(isRetryableError(createErrnoError("EACCES", "permission denied"))).toBe(false);
			expect(isRetryableError(createErrnoError("EEXIST", "already exists"))).toBe(false);
		});

		it("Scenario 26.1b: Message-based patterns are retryable", () => {
			expect(isRetryableError(new Error("resource busy or locked"))).toBe(true);
			expect(isRetryableError(new Error("file is locked by another process"))).toBe(true);
			expect(isRetryableError(new Error("in use by another process"))).toBe(true);
			expect(isRetryableError(new Error("network error occurred"))).toBe(true);
			expect(isRetryableError(new Error("operation timeout"))).toBe(true);
		});

		it("Non-Error values are not retryable", () => {
			expect(isRetryableError("string error")).toBe(false);
			expect(isRetryableError(null)).toBe(false);
			expect(isRetryableError(42)).toBe(false);
		});

		it("Scenario 26.3: Retry succeeds on second attempt", async () => {
			let callCount = 0;
			const operation = vi.fn(async () => {
				callCount++;
				if (callCount === 1) {
					throw createErrnoError("EBUSY", "file locked");
				}
				return "success";
			});

			const result = await withRetry(operation, {
				baseDelayMs: 1,
				maxDelayMs: 5,
			});

			expect(result).toBe("success");
			expect(operation).toHaveBeenCalledTimes(2);
		});

		it("Throws immediately on non-retryable error (no retry)", async () => {
			const operation = vi.fn(async () => {
				throw createErrnoError("ENOENT", "file not found");
			});

			await expect(withRetry(operation, {
				baseDelayMs: 1,
				maxDelayMs: 5,
			})).rejects.toThrow("file not found");

			// Only called once — no retry
			expect(operation).toHaveBeenCalledTimes(1);
		});

		it("Throws after maxRetries exhausted", async () => {
			const operation = vi.fn(async () => {
				throw createErrnoError("EBUSY", "still locked");
			});

			await expect(withRetry(operation, {
				maxRetries: 2,
				baseDelayMs: 1,
				maxDelayMs: 5,
			})).rejects.toThrow("still locked");

			// 1 initial + 2 retries = 3 calls
			expect(operation).toHaveBeenCalledTimes(3);
		});

		it("Calls onRetry callback with attempt, error, and delay", async () => {
			let callCount = 0;
			const operation = vi.fn(async () => {
				callCount++;
				if (callCount <= 2) {
					throw createErrnoError("EBUSY", "locked");
				}
				return "ok";
			});

			const onRetry = vi.fn();

			await withRetry(operation, {
				maxRetries: 3,
				baseDelayMs: 1,
				maxDelayMs: 5,
			}, onRetry);

			expect(onRetry).toHaveBeenCalledTimes(2);
			expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error), expect.any(Number));
			expect(onRetry).toHaveBeenCalledWith(2, expect.any(Error), expect.any(Number));
		});
	});

	// ==========================================
	// UC-27: Sync Loop Prevention
	// ==========================================
	describe("UC-27: Sync Loop Prevention", () => {
		let detector: SyncLoopDetector;

		beforeEach(() => {
			detector = new SyncLoopDetector();
		});

		afterEach(() => {
			detector.destroy();
		});

		it("Scenario 27.1: Forward sync blocks immediate reverse", () => {
			detector.recordSync("/source/file.md");
			expect(detector.isRecentlySynced("/source/file.md")).toBe(true);
		});

		it("Scenario 27.3: After cooldown expires, sync resumes", () => {
			// Record sync, then simulate time passing beyond 5000ms cooldown
			const now = Date.now();
			vi.spyOn(Date, "now").mockReturnValue(now);

			detector.recordSync("/source/file.md");
			expect(detector.isRecentlySynced("/source/file.md")).toBe(true);

			// Advance past cooldown (5000ms)
			vi.spyOn(Date, "now").mockReturnValue(now + 6000);
			expect(detector.isRecentlySynced("/source/file.md")).toBe(false);

			vi.restoreAllMocks();
		});

		it("Scenario 27.4: Path normalization ensures consistent matching", () => {
			// Record with Windows-style path and uppercase
			detector.recordSync("C:\\Users\\Name\\File.MD");

			// Check with forward-slash lowercase
			expect(detector.isRecentlySynced("c:/users/name/file.md")).toBe(true);
		});

		it("Scenario 27.5: Stale entries are cleaned up (2x COOLDOWN_MS)", () => {
			const now = Date.now();
			vi.spyOn(Date, "now").mockReturnValue(now);

			detector.recordSync("/old/file.md");

			// Advance time past 2x cooldown (10 seconds)
			vi.spyOn(Date, "now").mockReturnValue(now + 11000);

			// Manually trigger cleanup (normally fires every 60s)
			// Access private method via any cast for testing
			(detector as any).cleanup();

			// Entry should have been cleaned
			vi.spyOn(Date, "now").mockReturnValue(now + 3000); // Back within cooldown
			expect(detector.isRecentlySynced("/old/file.md")).toBe(false);

			vi.restoreAllMocks();
		});
	});

	// ==========================================
	// UC-28: Debounce Behavior
	// ==========================================
	describe("UC-28: Debounce Behavior", () => {

		it("Scenario 28.1: Multiple rapid edits produce one sync (debounce)", async () => {
			vi.useFakeTimers();
			const mockApp = createMockApp();
			const context = createMockVaultWatcherContext();
			const mapping = createMockMapping({
				targetFolder: "vault/imported",
				syncDirection: "bidirectional",
				debounceDelay: 800,
			});

			const watcher = new VaultWatcher(mockApp as any, context, mapping);
			watcher.start();

			// Rapid edits to the same file
			const file = createTFile("vault/imported/file.md");
			for (let i = 0; i < 5; i++) {
				mockApp._handlers.get("modify")!(file);
				await vi.advanceTimersByTimeAsync(100);
			}

			// After last edit + debounce
			await vi.advanceTimersByTimeAsync(2000);

			// Should only have been called once
			expect(context.fileSync.syncFileReverse).toHaveBeenCalledTimes(1);

			await watcher.stop();
			vi.useRealTimers();
		});

		it("Scenario 28.2: Reverse sync uses minimum 1500ms debounce", async () => {
			vi.useFakeTimers();
			const mockApp = createMockApp();
			const context = createMockVaultWatcherContext();
			const mapping = createMockMapping({
				targetFolder: "vault/imported",
				syncDirection: "bidirectional",
				debounceDelay: 200, // Less than MIN_REVERSE_DEBOUNCE_MS (1500)
			});

			const watcher = new VaultWatcher(mockApp as any, context, mapping);
			watcher.start();

			const file = createTFile("vault/imported/file.md");
			mockApp._handlers.get("modify")!(file);

			// At 200ms — not yet processed (MIN is 1500)
			await vi.advanceTimersByTimeAsync(200);
			expect(context.fileSync.syncFileReverse).not.toHaveBeenCalled();

			// At 1500ms — should be processed
			await vi.advanceTimersByTimeAsync(1300);
			expect(context.fileSync.syncFileReverse).toHaveBeenCalledTimes(1);

			await watcher.stop();
			vi.useRealTimers();
		});
	});

	// ==========================================
	// UC-29: Backpressure / Queue Limits
	// ==========================================
	describe("UC-29: Backpressure / Queue Limits", () => {

		it("Scenario 29.1: Queue at capacity drops new jobs (MAX_PENDING_JOBS=1000)", () => {
			vi.useFakeTimers();
			const mockApp = createMockApp();
			const context = createMockVaultWatcherContext();
			const mapping = createMockMapping({
				targetFolder: "vault/imported",
				syncDirection: "bidirectional",
			});

			const watcher = new VaultWatcher(mockApp as any, context, mapping);
			watcher.start();

			// Fill queue to 1000
			for (let i = 0; i < 1000; i++) {
				const file = createTFile(`vault/imported/file${i}.md`);
				mockApp._handlers.get("modify")!(file);
			}
			expect(watcher.getQueueStats().pendingFiles).toBe(1000);

			// 1001st should be dropped
			const extra = createTFile("vault/imported/extra.md");
			mockApp._handlers.get("modify")!(extra);
			expect(watcher.getQueueStats().droppedJobs).toBe(1);
			expect(context.bumpSkipped).toHaveBeenCalled();

			watcher.stop();
			vi.useRealTimers();
		});

		it("Scenario 29.2: Existing job in queue is updated (not duplicated)", () => {
			vi.useFakeTimers();
			const mockApp = createMockApp();
			const context = createMockVaultWatcherContext();
			const mapping = createMockMapping({
				targetFolder: "vault/imported",
				syncDirection: "bidirectional",
			});

			const watcher = new VaultWatcher(mockApp as any, context, mapping);
			watcher.start();

			// First event
			const file = createTFile("vault/imported/file.md");
			mockApp._handlers.get("modify")!(file);
			expect(watcher.getQueueStats().pendingFiles).toBe(1);

			// Second event for same file — timer resets, queue size stays the same
			mockApp._handlers.get("modify")!(file);
			expect(watcher.getQueueStats().pendingFiles).toBe(1);

			watcher.stop();
			vi.useRealTimers();
		});
	});
});
