/**
 * progress.test.ts — Tests for spinner and progress bar.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { startSpinner, createProgressBar } from "../../src/infrastructure/progress.js";

describe("startSpinner", () => {
	let writeSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		writeSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
		Object.defineProperty(process.stderr, "isTTY", { value: true, configurable: true });
	});

	afterEach(() => {
		writeSpy.mockRestore();
	});

	it("returns a spinner with update and stop methods", () => {
		const spinner = startSpinner("Loading...");
		expect(spinner).toHaveProperty("update");
		expect(spinner).toHaveProperty("stop");
		spinner.stop();
	});

	it("stop clears the spinner line", () => {
		const spinner = startSpinner("Loading...");
		spinner.stop("Done!");
		// Should have written the final message
		const calls = writeSpy.mock.calls.map(c => c[0] as string);
		const lastCalls = calls.slice(-2);
		expect(lastCalls.some(c => c.includes("Done!"))).toBe(true);
	});

	it("returns no-op when enabled is false", () => {
		const spinner = startSpinner("Loading...", false);
		spinner.update("New label");
		spinner.stop("Final");
		// No writes should have happened
		expect(writeSpy).not.toHaveBeenCalled();
	});

	it("returns no-op when not a TTY", () => {
		Object.defineProperty(process.stderr, "isTTY", { value: false, configurable: true });
		const spinner = startSpinner("Loading...");
		spinner.stop();
		expect(writeSpy).not.toHaveBeenCalled();
	});

	it("update changes the label without error", () => {
		const spinner = startSpinner("Loading...");
		spinner.update("Still loading...");
		spinner.stop("Updated");
		const calls = writeSpy.mock.calls.map(c => c[0] as string);
		expect(calls.some(c => c.includes("Updated"))).toBe(true);
	});
});

describe("createProgressBar", () => {
	let writeSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		writeSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
		Object.defineProperty(process.stderr, "isTTY", { value: true, configurable: true });
	});

	afterEach(() => {
		writeSpy.mockRestore();
	});

	it("returns a bar with tick and complete methods", () => {
		const bar = createProgressBar(10, "Processing...");
		expect(bar).toHaveProperty("tick");
		expect(bar).toHaveProperty("complete");
		bar.complete();
	});

	it("tick advances the progress", () => {
		const bar = createProgressBar(2, "Working...");
		bar.tick("Step 1");
		bar.tick("Step 2");
		bar.complete("All done!");
		const calls = writeSpy.mock.calls.map(c => c[0] as string);
		expect(calls.some(c => c.includes("All done!"))).toBe(true);
	});

	it("returns no-op when enabled is false", () => {
		const bar = createProgressBar(10, "Processing...", false);
		bar.tick();
		bar.complete();
		expect(writeSpy).not.toHaveBeenCalled();
	});

	it("returns no-op when total is zero", () => {
		const bar = createProgressBar(0, "Processing...");
		bar.tick();
		bar.complete();
		expect(writeSpy).not.toHaveBeenCalled();
	});

	it("renders initial state on creation", () => {
		createProgressBar(5, "Loading...");
		expect(writeSpy).toHaveBeenCalled();
		const firstCall = writeSpy.mock.calls[0][0] as string;
		expect(firstCall).toContain("0%");
		expect(firstCall).toContain("Loading...");
	});

	it("shows 100% after all ticks", () => {
		const bar = createProgressBar(2, "X");
		bar.tick();
		bar.tick();
		const calls = writeSpy.mock.calls.map(c => c[0] as string);
		expect(calls.some(c => c.includes("100%"))).toBe(true);
	});
});
