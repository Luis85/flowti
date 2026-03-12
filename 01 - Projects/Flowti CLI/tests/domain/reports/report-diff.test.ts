import { describe, it, expect } from "vitest";
import { extractMetrics, compareMetrics, diffReports } from "../../../src/domain/reports/export/report-diff.js";

// ── extractMetrics ──────────────────────────────────────────────────

describe("extractMetrics", () => {
	it("extracts numeric values from frontmatter", () => {
		const content = [
			"---",
			"type: TestReport",
			"project: flowti-cli",
			"date: 2026-03-09",
			"passed: 1852",
			"failed: 0",
			"total: 1857",
			"suites: 114",
			"---",
			"# Test Report",
		].join("\n");

		const metrics = extractMetrics(content);
		expect(metrics).toEqual({
			passed: 1852,
			failed: 0,
			total: 1857,
			suites: 114,
		});
	});

	it("skips type, project, date, schema_version", () => {
		const content = [
			"---",
			"type: CodebaseReport",
			"project: flowti-cli",
			"date: 2026-03-09",
			"schema_version: 2",
			"modules: 173",
			"---",
		].join("\n");

		const metrics = extractMetrics(content);
		expect(metrics).toEqual({ modules: 173 });
		expect(metrics.type).toBeUndefined();
		expect(metrics.project).toBeUndefined();
	});

	it("converts boolean values to 0/1", () => {
		const content = [
			"---",
			"success: true",
			"failed_flag: false",
			"---",
		].join("\n");

		const metrics = extractMetrics(content);
		expect(metrics.success).toBe(1);
		expect(metrics.failed_flag).toBe(0);
	});

	it("handles float values", () => {
		const content = [
			"---",
			"statements_pct: 57.91",
			"branches_pct: 54.86",
			"---",
		].join("\n");

		const metrics = extractMetrics(content);
		expect(metrics.statements_pct).toBe(57.91);
		expect(metrics.branches_pct).toBe(54.86);
	});

	it("returns empty object when no frontmatter", () => {
		expect(extractMetrics("# Just a heading")).toEqual({});
	});
});

// ── compareMetrics ──────────────────────────────────────────────────

describe("compareMetrics", () => {
	it("identifies changed metrics with deltas", () => {
		const prev = { passed: 1800, failed: 2, total: 1802 };
		const curr = { passed: 1914, failed: 0, total: 1914 };

		const { deltas, unchanged } = compareMetrics(prev, curr);
		expect(deltas).toHaveLength(3);
		expect(unchanged).toHaveLength(0);

		const passedDelta = deltas.find((d) => d.key === "passed")!;
		expect(passedDelta.previous).toBe(1800);
		expect(passedDelta.current).toBe(1914);
		expect(passedDelta.delta).toBe(114);
		expect(passedDelta.formatted).toBe("+114");

		const failedDelta = deltas.find((d) => d.key === "failed")!;
		expect(failedDelta.delta).toBe(-2);
		expect(failedDelta.formatted).toBe("-2");
	});

	it("identifies unchanged metrics", () => {
		const prev = { passed: 100, failed: 0 };
		const curr = { passed: 100, failed: 0 };

		const { deltas, unchanged } = compareMetrics(prev, curr);
		expect(deltas).toHaveLength(0);
		expect(unchanged).toEqual(["passed", "failed"]);
	});

	it("skips metrics only in one report", () => {
		const prev = { passed: 100 };
		const curr = { passed: 110, newMetric: 5 };

		const { deltas } = compareMetrics(prev, curr);
		expect(deltas).toHaveLength(1);
		expect(deltas[0].key).toBe("passed");
	});

	it("sorts deltas by absolute delta descending", () => {
		const prev = { a: 10, b: 100, c: 50 };
		const curr = { a: 12, b: 200, c: 45 };

		const { deltas } = compareMetrics(prev, curr);
		expect(deltas[0].key).toBe("b"); // |+100|
		expect(deltas[1].key).toBe("c"); // |-5|
		expect(deltas[2].key).toBe("a"); // |+2|
	});

	it("formats float deltas with 2 decimal places", () => {
		const prev = { coverage: 57.91 };
		const curr = { coverage: 62.50 };

		const { deltas } = compareMetrics(prev, curr);
		expect(deltas[0].formatted).toBe("+4.59");
	});
});

// ── diffReports ─────────────────────────────────────────────────────

describe("diffReports", () => {
	it("produces full diff between two report contents", () => {
		const prev = [
			"---",
			"type: TestReport",
			"passed: 1800",
			"failed: 2",
			"suites: 100",
			"---",
		].join("\n");

		const curr = [
			"---",
			"type: TestReport",
			"passed: 1914",
			"failed: 0",
			"suites: 111",
			"---",
		].join("\n");

		const diff = diffReports("Test", "2026-03-08-test.md", prev, "2026-03-09-test.md", curr);

		expect(diff.category).toBe("Test");
		expect(diff.previousFile).toBe("2026-03-08-test.md");
		expect(diff.currentFile).toBe("2026-03-09-test.md");
		expect(diff.deltas.length).toBeGreaterThan(0);

		const passedDelta = diff.deltas.find((d) => d.key === "passed")!;
		expect(passedDelta.delta).toBe(114);
	});

	it("reports unchanged metrics", () => {
		const content = [
			"---",
			"type: TestReport",
			"passed: 100",
			"---",
		].join("\n");

		const diff = diffReports("Test", "a.md", content, "b.md", content);
		expect(diff.deltas).toHaveLength(0);
		expect(diff.unchanged).toContain("passed");
	});
});
