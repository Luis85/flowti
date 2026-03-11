import { describe, it, expect } from "vitest";
import { analyzeGeneratorRun } from "../../../src/domain/reports/cli/summary-analyzers-ext.js";
import type { GeneratorResult } from "../../../src/domain/reports/pipeline/report-runner.js";

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

describe("analyzeGeneratorRun", () => {
	it("returns empty findings when no results", () => {
		expect(analyzeGeneratorRun([])).toHaveLength(0);
	});

	it("returns a positive finding when all generators pass", () => {
		const results = [
			makeResult({ id: "test", label: "Test Report" }),
			makeResult({ id: "coverage", label: "Coverage Report" }),
		];

		const findings = analyzeGeneratorRun(results);

		expect(findings).toHaveLength(1);
		expect(findings[0].category).toBe("positive");
		expect(findings[0].message).toContain("2 report generator(s) completed successfully");
	});

	it("returns a risk finding when generators fail", () => {
		const results = [
			makeResult({ id: "test", success: true }),
			makeResult({ id: "coverage", label: "Coverage Report", success: false, error: "No coverage data" }),
			makeResult({ id: "codebase", label: "Codebase Report", success: false, error: "Prerequisite failed" }),
		];

		const findings = analyzeGeneratorRun(results);

		const risk = findings.find((f) => f.category === "risk");
		expect(risk).toBeDefined();
		expect(risk!.message).toContain("2 report generator(s) failed");
		expect(risk!.details).toHaveLength(2);
		expect(risk!.details![0]).toContain("Coverage Report");
		expect(risk!.details![0]).toContain("No coverage data");
		expect(risk!.details![1]).toContain("Codebase Report");
	});

	it("returns an improvement finding for generator warnings", () => {
		const results = [
			makeResult({
				id: "coverage",
				label: "Coverage Report",
				success: true,
				output: { success: true, outputPath: "", metrics: {} },
				warnings: ["Statement coverage 55% (< 80%)", "Branch coverage 45% (< 70%)"],
			}),
		];

		const findings = analyzeGeneratorRun(results);

		const improvement = findings.find((f) => f.category === "improvement");
		expect(improvement).toBeDefined();
		expect(improvement!.message).toContain("2 warning(s)");
		expect(improvement!.details).toHaveLength(2);
		expect(improvement!.details![0]).toContain("Coverage Report");
		expect(improvement!.details![0]).toContain("Statement coverage");
	});

	it("returns both risk and improvement findings when there are failures and warnings", () => {
		const results = [
			makeResult({ id: "test", label: "Test Report", success: false, error: "Crashed" }),
			makeResult({
				id: "coverage",
				label: "Coverage Report",
				success: true,
				warnings: ["Low coverage"],
			}),
		];

		const findings = analyzeGeneratorRun(results);

		expect(findings.some((f) => f.category === "risk")).toBe(true);
		expect(findings.some((f) => f.category === "improvement")).toBe(true);
		// No positive because there are failures
		expect(findings.some((f) => f.category === "positive")).toBe(false);
	});

	it("uses 'unknown error' when error field is missing", () => {
		const results = [
			makeResult({ id: "test", label: "Test Report", success: false }),
		];

		const findings = analyzeGeneratorRun(results);

		const risk = findings.find((f) => f.category === "risk");
		expect(risk!.details![0]).toContain("unknown error");
	});

	it("does not count warnings-only generators as failed", () => {
		const results = [
			makeResult({
				id: "test",
				success: true,
				warnings: ["Some warning"],
			}),
		];

		const findings = analyzeGeneratorRun(results);

		// Should have positive (all passed) and improvement (warnings)
		expect(findings.some((f) => f.category === "positive")).toBe(true);
		expect(findings.some((f) => f.category === "risk")).toBe(false);
	});
});
