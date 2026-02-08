import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SyncLoopDetector } from "../../src/services/SyncLoopDetector";

describe("SyncLoopDetector", () => {
	let detector: SyncLoopDetector;

	beforeEach(() => {
		vi.useFakeTimers();
		detector = new SyncLoopDetector();
	});

	afterEach(() => {
		detector.destroy();
		vi.useRealTimers();
	});

	it("returns false for unknown paths", () => {
		expect(detector.isRecentlySynced("/some/file.md")).toBe(false);
	});

	it("returns true within cooldown after recordSync", () => {
		detector.recordSync("/some/file.md");
		expect(detector.isRecentlySynced("/some/file.md")).toBe(true);
	});

	it("returns false after cooldown expires", () => {
		detector.recordSync("/some/file.md");
		// Advance past 5s cooldown
		vi.advanceTimersByTime(5001);
		expect(detector.isRecentlySynced("/some/file.md")).toBe(false);
	});

	it("normalizes paths — backslash to forward slash, case-insensitive", () => {
		detector.recordSync("C:\\Users\\Name\\File.MD");
		expect(detector.isRecentlySynced("c:/users/name/file.md")).toBe(true);
	});

	it("destroy clears timer and map", () => {
		detector.recordSync("/file.md");
		detector.destroy();
		expect(detector.isRecentlySynced("/file.md")).toBe(false);
	});
});
