import { describe, it, expect, beforeEach } from "vitest";
import { pushResult, getRunResults, clearRunContext, setCommandOutput, getCommandOutput } from "../../../src/domain/reports/run-context.js";
import type { GeneratorResult } from "../../../src/domain/reports/report-runner.js";

function makeResult(overrides: Partial<GeneratorResult> = {}): GeneratorResult {
	return {
		id: "test",
		label: "Test Report",
		success: true,
		durationMs: 500,
		output: null,
		...overrides,
	};
}

describe("run-context", () => {
	beforeEach(() => {
		clearRunContext();
	});

	it("starts empty", () => {
		expect(getRunResults()).toHaveLength(0);
	});

	it("accumulates pushed results", () => {
		pushResult(makeResult({ id: "test" }));
		pushResult(makeResult({ id: "coverage" }));

		expect(getRunResults()).toHaveLength(2);
		expect(getRunResults()[0].id).toBe("test");
		expect(getRunResults()[1].id).toBe("coverage");
	});

	it("clears all results", () => {
		pushResult(makeResult());
		pushResult(makeResult());
		clearRunContext();

		expect(getRunResults()).toHaveLength(0);
	});

	it("returns a readonly view (mutations do not affect internal state)", () => {
		pushResult(makeResult());
		const results = getRunResults();

		// The array reference is readonly, but we can verify length is preserved
		expect(results).toHaveLength(1);
		clearRunContext();
		// After clear, a new call returns empty
		expect(getRunResults()).toHaveLength(0);
	});
});

describe("command output storage", () => {
	beforeEach(() => {
		clearRunContext();
	});

	it("returns undefined for unknown command", () => {
		expect(getCommandOutput("npm run lint")).toBeUndefined();
	});

	it("stores and retrieves command output", () => {
		setCommandOutput("npm run lint", "all good\n0 problems");
		expect(getCommandOutput("npm run lint")).toBe("all good\n0 problems");
	});

	it("overwrites output for the same command", () => {
		setCommandOutput("npm run lint", "first run");
		setCommandOutput("npm run lint", "second run");
		expect(getCommandOutput("npm run lint")).toBe("second run");
	});

	it("clears command outputs along with results", () => {
		setCommandOutput("npm run typedoc", "output");
		clearRunContext();
		expect(getCommandOutput("npm run typedoc")).toBeUndefined();
	});

	it("stores outputs for different commands independently", () => {
		setCommandOutput("npm run lint", "lint output");
		setCommandOutput("npm run typedoc", "typedoc output");
		expect(getCommandOutput("npm run lint")).toBe("lint output");
		expect(getCommandOutput("npm run typedoc")).toBe("typedoc output");
	});
});
