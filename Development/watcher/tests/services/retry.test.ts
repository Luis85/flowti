import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
	PathTraversalError,
	isRetryableError,
	withRetry,
} from "../../src/services/retry";

// ===========================
// PathTraversalError
// ===========================
describe("PathTraversalError", () => {
	it("has correct name, message, sourcePath, and baseFolder", () => {
		const err = new PathTraversalError("/evil/../etc/passwd", "/safe");
		expect(err.name).toBe("PathTraversalError");
		expect(err.message).toContain("/evil/../etc/passwd");
		expect(err.message).toContain("/safe");
		expect(err.sourcePath).toBe("/evil/../etc/passwd");
		expect(err.baseFolder).toBe("/safe");
		expect(err).toBeInstanceOf(Error);
	});
});

// ===========================
// isRetryableError
// ===========================
describe("isRetryableError", () => {
	it("returns false for non-Error values", () => {
		expect(isRetryableError("string error")).toBe(false);
		expect(isRetryableError(null)).toBe(false);
		expect(isRetryableError(42)).toBe(false);
		expect(isRetryableError(undefined)).toBe(false);
	});

	it("returns true for transient error codes (EBUSY, ENOTEMPTY, EAGAIN, EMFILE, ENFILE)", () => {
		for (const code of ["EBUSY", "ENOTEMPTY", "EAGAIN", "EMFILE", "ENFILE"]) {
			const err = new Error("something") as NodeJS.ErrnoException;
			err.code = code;
			expect(isRetryableError(err)).toBe(true);
		}
	});

	it("returns false for permanent error codes (ENOENT, EACCES, EEXIST)", () => {
		for (const code of ["ENOENT", "EACCES", "EEXIST"]) {
			const err = new Error("something") as NodeJS.ErrnoException;
			err.code = code;
			expect(isRetryableError(err)).toBe(false);
		}
	});

	it("returns true for transient message patterns", () => {
		const patterns = [
			"resource busy or locked",
			"file is locked by another process",
			"in use by another process",
			"network error occurred",
			"operation timeout reached",
		];
		for (const msg of patterns) {
			expect(isRetryableError(new Error(msg))).toBe(true);
		}
	});

	it("returns false for generic Error without code or matching pattern", () => {
		expect(isRetryableError(new Error("something went wrong"))).toBe(false);
		expect(isRetryableError(new Error("file not found"))).toBe(false);
	});
});

// ===========================
// withRetry
// ===========================
describe("withRetry", () => {
	/** Use tiny real delays to avoid fake-timer unhandled-rejection noise */
	const FAST = { baseDelayMs: 1, maxDelayMs: 5 };

	function makeBusyError(): NodeJS.ErrnoException {
		const err = new Error("busy") as NodeJS.ErrnoException;
		err.code = "EBUSY";
		return err;
	}

	it("returns result on first success (no retry)", async () => {
		const op = vi.fn().mockResolvedValue("ok");
		const result = await withRetry(op);
		expect(result).toBe("ok");
		expect(op).toHaveBeenCalledTimes(1);
	});

	it("retries on retryable error and succeeds on 2nd attempt", async () => {
		const op = vi.fn()
			.mockRejectedValueOnce(makeBusyError())
			.mockResolvedValueOnce("ok");

		const result = await withRetry(op, { ...FAST, maxRetries: 3 });
		expect(result).toBe("ok");
		expect(op).toHaveBeenCalledTimes(2);
	});

	it("throws immediately on non-retryable error (no retry)", async () => {
		const noentErr = new Error("not found") as NodeJS.ErrnoException;
		noentErr.code = "ENOENT";

		const op = vi.fn().mockRejectedValue(noentErr);

		await expect(withRetry(op, { ...FAST, maxRetries: 3 })).rejects.toThrow("not found");
		expect(op).toHaveBeenCalledTimes(1);
	});

	it("throws after maxRetries exhausted", async () => {
		const op = vi.fn().mockRejectedValue(makeBusyError());

		await expect(withRetry(op, { ...FAST, maxRetries: 2 })).rejects.toThrow("busy");
		expect(op).toHaveBeenCalledTimes(3); // initial + 2 retries
	});

	it("calls onRetry callback with attempt number, error, and delay", async () => {
		const busyErr = makeBusyError();
		const op = vi.fn()
			.mockRejectedValueOnce(busyErr)
			.mockResolvedValueOnce("ok");

		const onRetry = vi.fn();
		await withRetry(op, { ...FAST, maxRetries: 3 }, onRetry);

		expect(onRetry).toHaveBeenCalledTimes(1);
		expect(onRetry).toHaveBeenCalledWith(1, busyErr, expect.any(Number));
	});

	it("respects maxRetries config", async () => {
		const op = vi.fn().mockRejectedValue(makeBusyError());

		await expect(withRetry(op, { ...FAST, maxRetries: 1 })).rejects.toThrow("busy");
		expect(op).toHaveBeenCalledTimes(2); // initial + 1 retry
	});

	it("applies exponential backoff (delay increases per attempt)", async () => {
		const delays: number[] = [];
		const onRetry = vi.fn((_attempt: number, _error: Error, delay: number) => {
			delays.push(delay);
		});

		const op = vi.fn().mockRejectedValue(makeBusyError());

		await expect(
			withRetry(
				op,
				{ maxRetries: 3, baseDelayMs: 100, maxDelayMs: 2000, exponentialBackoff: true },
				onRetry,
			),
		).rejects.toThrow();

		// With exponential backoff: attempt 0 → 100ms, attempt 1 → 200ms, attempt 2 → 400ms (±25% jitter)
		expect(delays).toHaveLength(3);
		expect(delays[0]).toBeGreaterThanOrEqual(75); // 100 - 25%
		expect(delays[0]).toBeLessThanOrEqual(125); // 100 + 25%
		expect(delays[1]).toBeGreaterThanOrEqual(150); // 200 - 25%
		expect(delays[1]).toBeLessThanOrEqual(250); // 200 + 25%
		expect(delays[2]).toBeGreaterThanOrEqual(300); // 400 - 25%
		expect(delays[2]).toBeLessThanOrEqual(500); // 400 + 25%
	});

	it("caps delay at maxDelayMs", async () => {
		const delays: number[] = [];
		const onRetry = vi.fn((_attempt: number, _error: Error, delay: number) => {
			delays.push(delay);
		});

		const op = vi.fn().mockRejectedValue(makeBusyError());

		await expect(
			withRetry(
				op,
				{ maxRetries: 3, baseDelayMs: 1000, maxDelayMs: 1500, exponentialBackoff: true },
				onRetry,
			),
		).rejects.toThrow();

		// attempt 0: min(1000*2^0, 1500) = 1000 ±25%
		// attempt 1: min(1000*2^1, 1500) = 1500 ±25%
		// attempt 2: min(1000*2^2, 1500) = 1500 ±25%
		for (const d of delays) {
			expect(d).toBeLessThanOrEqual(1500 * 1.25);
		}
	});

	it("uses linear delay when exponentialBackoff=false", async () => {
		const delays: number[] = [];
		const onRetry = vi.fn((_attempt: number, _error: Error, delay: number) => {
			delays.push(delay);
		});

		const op = vi.fn().mockRejectedValue(makeBusyError());

		await expect(
			withRetry(
				op,
				{ maxRetries: 3, baseDelayMs: 200, maxDelayMs: 2000, exponentialBackoff: false },
				onRetry,
			),
		).rejects.toThrow();

		// All delays should be around 200ms (±25% jitter)
		expect(delays).toHaveLength(3);
		for (const d of delays) {
			expect(d).toBeGreaterThanOrEqual(150); // 200 - 25%
			expect(d).toBeLessThanOrEqual(250); // 200 + 25%
		}
	});

	it("converts non-Error thrown values to Error", async () => {
		const op = vi.fn().mockRejectedValue("string error");

		await expect(withRetry(op, { maxRetries: 0 })).rejects.toThrow("string error");
	});
});
