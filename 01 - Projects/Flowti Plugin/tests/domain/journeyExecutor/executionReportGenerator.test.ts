import { describe, it, expect } from "vitest";
import { generateExecutionReport } from "../../../src/domain/journeyExecutor/executionReportGenerator";
import type { ExecutionResult, StepResult } from "../../../src/domain/journeyExecutor/types";

// ── Helpers ──────────────────────────────────────────────

function makeStep(overrides: Partial<StepResult> = {}): StepResult {
	return {
		stepIndex: 0,
		stepId: "s1",
		stepTitle: "Step 1",
		status: "pass",
		durationMs: 100,
		...overrides,
	};
}

function makeResult(overrides: Partial<ExecutionResult> = {}): ExecutionResult {
	return {
		journeyName: "Test Journey",
		totalSteps: 3,
		passed: 3,
		failed: 0,
		skipped: 0,
		durationMs: 500,
		steps: [],
		...overrides,
	};
}

// ── Tests ────────────────────────────────────────────────

describe("generateExecutionReport", () => {
	it("generates frontmatter with correct fields", () => {
		const { frontmatter } = generateExecutionReport(makeResult());
		expect(frontmatter.type).toBe("JourneyExecutionReport");
		expect(frontmatter.journey).toBe("Test Journey");
		expect(frontmatter.status).toBe("passed");
		expect(frontmatter.total_steps).toBe(3);
		expect(frontmatter.passed).toBe(3);
		expect(frontmatter.failed).toBe(0);
		expect(frontmatter.skipped).toBe(0);
		expect(frontmatter.duration_ms).toBe(500);
		expect(frontmatter.date).toBeDefined();
	});

	it("generates markdown with journey name header", () => {
		const { markdown } = generateExecutionReport(makeResult());
		expect(markdown).toContain("# Execution Report: Test Journey");
	});

	it("includes summary table with counts", () => {
		const { markdown } = generateExecutionReport(makeResult({ passed: 2, failed: 1, skipped: 0, totalSteps: 3 }));
		expect(markdown).toContain("| Total steps | 3 |");
		expect(markdown).toContain("| Passed | 2 |");
		expect(markdown).toContain("| Failed | 1 |");
	});

	it("handles all-pass journey", () => {
		const { frontmatter, markdown } = generateExecutionReport(makeResult());
		expect(frontmatter.status).toBe("passed");
		expect(markdown).toContain("**Status**: passed");
	});

	it("handles mixed pass/fail/skip", () => {
		const steps = [
			makeStep({ stepIndex: 0, status: "pass" }),
			makeStep({ stepIndex: 1, stepId: "s2", stepTitle: "Step 2", status: "fail", error: "Assertion failed" }),
			makeStep({ stepIndex: 2, stepId: "s3", stepTitle: "Step 3", status: "skip" }),
		];
		const { frontmatter, markdown } = generateExecutionReport(
			makeResult({ passed: 1, failed: 1, skipped: 1, steps }),
		);
		expect(frontmatter.status).toBe("failed");
		expect(markdown).toContain("✓ pass");
		expect(markdown).toContain("✗ fail");
		expect(markdown).toContain("– skip");
	});

	it("includes error details for failed steps", () => {
		const steps = [
			makeStep({ status: "fail", error: "Element not found: .missing-button" }),
		];
		const { markdown } = generateExecutionReport(makeResult({ failed: 1, passed: 0, steps }));
		expect(markdown).toContain("Element not found: .missing-button");
	});

	it("produces valid report for empty journey", () => {
		const result = makeResult({ totalSteps: 0, passed: 0, steps: [] });
		const { frontmatter, markdown } = generateExecutionReport(result);
		expect(frontmatter.total_steps).toBe(0);
		expect(markdown).toContain("# Execution Report:");
		expect(markdown).not.toContain("## Step Results");
	});

	it("formats duration correctly", () => {
		const { markdown: short } = generateExecutionReport(makeResult({ durationMs: 500 }));
		expect(short).toContain("500ms");

		const { markdown: long } = generateExecutionReport(makeResult({ durationMs: 2500 }));
		expect(long).toContain("2.5s");
	});
});
