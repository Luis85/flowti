import { describe, it, expect } from "vitest";
import {
	parseTestReport,
	parseCoverageReport,
	toFrontmatter,
	generateTestReportMarkdown,
	generateCoverageReportMarkdown,
} from "../../../src/domain/docs/reportParser";
import type {
	VitestJsonReport,
	CoverageFinalJson,
} from "../../../src/domain/docs/reportParser";

const DATE = "2026-02-27T12:00:00.000Z";

describe("parseTestReport", () => {
	it("extracts all fields from a valid Vitest JSON report", () => {
		const json: VitestJsonReport = {
			numPassedTests: 5400,
			numFailedTests: 3,
			numPendingTests: 30,
			numTotalTests: 5433,
			numTotalTestSuites: 230,
			success: false,
			startTime: Date.now() - 5000,
			testResults: new Array(230),
		};

		const result = parseTestReport(json, DATE);

		expect(result.type).toBe("TestReport");
		expect(result.date).toBe(DATE);
		expect(result.passed).toBe(5400);
		expect(result.failed).toBe(3);
		expect(result.skipped).toBe(30);
		expect(result.total).toBe(5433);
		expect(result.suites).toBe(230);
		expect(result.success).toBe(false);
		expect(result.duration_ms).toBeGreaterThan(0);
	});

	it("defaults missing fields to zero", () => {
		const result = parseTestReport({}, DATE);

		expect(result.passed).toBe(0);
		expect(result.failed).toBe(0);
		expect(result.skipped).toBe(0);
		expect(result.total).toBe(0);
		expect(result.suites).toBe(0);
		expect(result.duration_ms).toBe(0);
		expect(result.success).toBe(true);
	});

	it("prefers testResults.length for suite count", () => {
		const json: VitestJsonReport = {
			numTotalTestSuites: 1500,
			testResults: new Array(220),
		};

		const result = parseTestReport(json, DATE);
		expect(result.suites).toBe(220);
	});

	it("falls back to numTotalTestSuites when testResults missing", () => {
		const json: VitestJsonReport = {
			numTotalTestSuites: 1500,
		};

		const result = parseTestReport(json, DATE);
		expect(result.suites).toBe(1500);
	});

	it("computes total from individual counts when numTotalTests is missing", () => {
		const json: VitestJsonReport = {
			numPassedTests: 10,
			numFailedTests: 2,
			numPendingTests: 1,
		};

		const result = parseTestReport(json, DATE);
		expect(result.total).toBe(13);
	});

	it("defaults success to true when no failures and field is missing", () => {
		const json: VitestJsonReport = {
			numPassedTests: 100,
			numFailedTests: 0,
		};

		const result = parseTestReport(json, DATE);
		expect(result.success).toBe(true);
	});

	it("defaults success to false when failures exist and field is missing", () => {
		const json: VitestJsonReport = {
			numPassedTests: 100,
			numFailedTests: 5,
		};

		const result = parseTestReport(json, DATE);
		expect(result.success).toBe(false);
	});
});

describe("parseCoverageReport", () => {
	it("computes coverage percentages from V8 data", () => {
		const json: CoverageFinalJson = {
			"src/main.ts": {
				s: { "0": 1, "1": 0, "2": 1, "3": 1 },
				b: { "0": [1, 0], "1": [1, 1] },
				f: { "0": 1, "1": 1 },
			},
		};

		const result = parseCoverageReport(json, DATE);

		expect(result.type).toBe("CoverageReport");
		expect(result.date).toBe(DATE);
		expect(result.statements_pct).toBe(75);
		expect(result.branches_pct).toBe(75);
		expect(result.functions_pct).toBe(100);
		expect(result.lines_pct).toBe(75);
		expect(result.files_covered).toBe(1);
	});

	it("handles empty coverage JSON", () => {
		const result = parseCoverageReport({}, DATE);

		expect(result.statements_pct).toBe(0);
		expect(result.branches_pct).toBe(0);
		expect(result.functions_pct).toBe(0);
		expect(result.files_covered).toBe(0);
	});

	it("handles files with no statements/branches/functions", () => {
		const json: CoverageFinalJson = {
			"src/empty.ts": {},
		};

		const result = parseCoverageReport(json, DATE);

		expect(result.statements_pct).toBe(0);
		expect(result.branches_pct).toBe(0);
		expect(result.functions_pct).toBe(0);
		expect(result.files_covered).toBe(1);
	});

	it("aggregates coverage across multiple files", () => {
		const json: CoverageFinalJson = {
			"src/a.ts": {
				s: { "0": 1, "1": 1 },
				b: {},
				f: { "0": 1 },
			},
			"src/b.ts": {
				s: { "0": 0, "1": 0 },
				b: {},
				f: { "0": 0 },
			},
		};

		const result = parseCoverageReport(json, DATE);

		expect(result.statements_pct).toBe(50);
		expect(result.functions_pct).toBe(50);
		expect(result.files_covered).toBe(2);
	});
});

describe("toFrontmatter", () => {
	it("generates valid YAML frontmatter", () => {
		const result = toFrontmatter({ type: "TestReport", count: 42, ok: true });

		expect(result).toContain("---");
		expect(result).toContain("type: TestReport");
		expect(result).toContain("count: 42");
		expect(result).toContain("ok: true");
	});

	it("escapes values with special characters", () => {
		const result = toFrontmatter({ title: "test: value" });
		expect(result).toContain('"test: value"');
	});
});

describe("generateTestReportMarkdown", () => {
	it("includes frontmatter and summary callout", () => {
		const fm = parseTestReport(
			{ numPassedTests: 100, numFailedTests: 0, numPendingTests: 5, success: true },
			DATE,
		);
		const md = generateTestReportMarkdown(fm);

		expect(md).toContain("---");
		expect(md).toContain("type: TestReport");
		expect(md).toContain("# Test Report");
		expect(md).toContain("Total: 105");
		expect(md).toContain("Passed: 100");
		expect(md).toContain("Result: PASS");
	});

	it("shows FAIL when success is false", () => {
		const fm = parseTestReport({ numFailedTests: 1, success: false }, DATE);
		const md = generateTestReportMarkdown(fm);

		expect(md).toContain("Result: FAIL");
	});
});

describe("generateCoverageReportMarkdown", () => {
	it("includes frontmatter and summary callout", () => {
		const fm = parseCoverageReport(
			{
				"src/a.ts": {
					s: { "0": 1 },
					b: { "0": [1] },
					f: { "0": 1 },
				},
			},
			DATE,
		);
		const md = generateCoverageReportMarkdown(fm);

		expect(md).toContain("---");
		expect(md).toContain("type: CoverageReport");
		expect(md).toContain("# Coverage Report");
		expect(md).toContain("Statements: 100%");
		expect(md).toContain("Files: 1");
	});
});
