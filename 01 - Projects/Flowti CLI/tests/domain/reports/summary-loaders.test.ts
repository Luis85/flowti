import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockFs } from "../../mocks/mock-fs.js";

vi.mock("../../../src/infrastructure/filesystem.js", () => ({
	disk: {},
}));

vi.mock("../../../src/infrastructure/paths.js", async () => {
	const path = await import("node:path");
	return { paths: { ...path, sep: "/" } };
});

vi.mock("../../../src/infrastructure/shell.js", async () => {
	const { mockShellPreset } = await import("../../mocks/mock-presets.js");
	return mockShellPreset();
});

vi.mock("../../../src/domain/project/project-config.js", () => ({
	readProjectConfig: vi.fn(),
}));

vi.mock("../../../src/infrastructure/config.js", () => ({
	CLI_PROJECT: "/mock/cli",
}));

import * as fsMod from "../../../src/infrastructure/filesystem.js";
import * as pathsMod from "../../../src/infrastructure/paths.js";
import {
	parseFrontmatter,
	parseLintOutput,
	parseLintSummary,
	discoverReports,
	readTestReportJson,
	aggregateCoverageJson,
	loadAnalysisTopFiles,
	loadComplexityFunctions,
	findLatestMd,
	DEFAULT_THRESHOLDS,
	resolveThresholds,
	parseTypedocOutput,
} from "../../../src/domain/reports/cli/summary-loaders.js";
import { readProjectConfig } from "../../../src/domain/project/project-config.js";

const mockReadConfig = readProjectConfig as ReturnType<typeof vi.fn>;

function setDisk(fs: ReturnType<typeof createMockFs>): void {
	Object.assign(fsMod, { disk: fs });
}

function loaderDeps() { return { disk: fsMod.disk, paths: pathsMod.paths } as const; }

beforeEach(() => {
	vi.clearAllMocks();
	mockReadConfig.mockReturnValue({ config: null, warnings: [] });
});

// ── parseFrontmatter ─────────────────────────────────────────────────

describe("parseFrontmatter", () => {
	it("parses YAML frontmatter between --- delimiters", () => {
		const content = "---\ntype: TestReport\ntotal: 42\n---\n# Body";
		const fm = parseFrontmatter(content);
		expect(fm.type).toBe("TestReport");
		expect(fm.total).toBe("42");
	});

	it("returns empty object when no frontmatter", () => {
		expect(parseFrontmatter("# Just a heading")).toEqual({});
	});

	it("returns empty object when only opening delimiter", () => {
		expect(parseFrontmatter("---\nkey: value\nno closing")).toEqual({});
	});

	it("strips quotes from values", () => {
		const fm = parseFrontmatter('---\nname: "hello"\nother: \'world\'\n---');
		expect(fm.name).toBe("hello");
		expect(fm.other).toBe("world");
	});

	it("handles keys with underscores", () => {
		const fm = parseFrontmatter("---\nmax_complexity: 15\n---");
		expect(fm.max_complexity).toBe("15");
	});

	it("ignores lines without key-value pattern", () => {
		const fm = parseFrontmatter("---\nvalid: yes\n  indented: no\n---");
		expect(fm.valid).toBe("yes");
		expect(fm.indented).toBeUndefined();
	});
});

// ── parseLintSummary ─────────────────────────────────────────────────

describe("parseLintSummary", () => {
	it("extracts errors and warnings from ESLint summary line", () => {
		const result = parseLintSummary("5 problems (2 errors, 3 warnings)");
		expect(result).toEqual({ errors: 2, warnings: 3 });
	});

	it("falls back to counting keywords when no summary line", () => {
		const result = parseLintSummary("some error here\nanother error\nwarning about thing");
		expect(result).toEqual({ errors: 2, warnings: 1 });
	});

	it("returns zeros for empty input", () => {
		expect(parseLintSummary("")).toEqual({ errors: 0, warnings: 0 });
	});

	it("handles singular problem", () => {
		const result = parseLintSummary("1 problem (1 error, 0 warnings)");
		expect(result).toEqual({ errors: 1, warnings: 0 });
	});
});

// ── parseLintOutput ──────────────────────────────────────────────────

describe("parseLintOutput", () => {
	it("parses ESLint summary line", () => {
		const output = "\n\n✖ 5 problems (2 errors, 3 warnings)\n";
		const result = parseLintOutput(output);
		expect(result.errors).toBe(2);
		expect(result.warnings).toBe(3);
	});

	it("parses individual issue lines with file context", () => {
		const output = [
			"/project/src/foo.ts",
			"  10:5  warning  Unexpected console statement  no-console",
			"  20:1  error    Missing return type            @typescript-eslint/explicit-function-return-type",
			"",
			"✖ 2 problems (1 error, 1 warning)",
		].join("\n");

		const result = parseLintOutput(output, "/project/");
		expect(result.issues).toHaveLength(2);
		expect(result.issues[0].file).toBe("src/foo.ts");
		expect(result.issues[0].line).toBe(10);
		expect(result.issues[0].severity).toBe("warning");
		expect(result.issues[0].rule).toBe("no-console");
		expect(result.issues[1].severity).toBe("error");
	});

	it("returns breakdown sorted by count", () => {
		const output = [
			"/src/a.ts",
			"  1:1  warning  msg  rule-a",
			"  2:1  warning  msg  rule-b",
			"  3:1  warning  msg  rule-a",
			"",
			"✖ 3 problems (0 errors, 3 warnings)",
		].join("\n");

		const result = parseLintOutput(output);
		expect(result.breakdown[0]).toEqual({ rule: "rule-a", count: 2 });
		expect(result.breakdown[1]).toEqual({ rule: "rule-b", count: 1 });
	});

	it("handles empty output", () => {
		const result = parseLintOutput("");
		expect(result.errors).toBe(0);
		expect(result.warnings).toBe(0);
		expect(result.issues).toHaveLength(0);
	});

	it("handles Windows paths in file headers", () => {
		const output = [
			"C:\\Projects\\src\\bar.ts",
			"  5:3  warning  Some warning  complexity",
			"",
			"✖ 1 problem (0 errors, 1 warning)",
		].join("\n");

		const result = parseLintOutput(output);
		expect(result.issues).toHaveLength(1);
		expect(result.issues[0].file).toContain("bar.ts");
	});
});

// ── readTestReportJson ───────────────────────────────────────────────

describe("readTestReportJson", () => {
	it("returns parsed test data when file exists", () => {
		const fs = createMockFs({
			"/reports/tests/testreport.json": JSON.stringify({
				numTotalTests: 100,
				numPassedTests: 98,
				numFailedTests: 2,
				success: false,
			}),
		});
		setDisk(fs);

		const result = readTestReportJson("/reports", loaderDeps());
		expect(result).toBeDefined();
		expect(result!.numTotalTests).toBe(100);
		expect(result!.numPassedTests).toBe(98);
		expect(result!.numFailedTests).toBe(2);
		expect(result!.success).toBe(false);
	});

	it("returns undefined when file does not exist", () => {
		setDisk(createMockFs());
		expect(readTestReportJson("/reports", loaderDeps())).toBeUndefined();
	});

	it("fills defaults for missing fields", () => {
		const fs = createMockFs({
			"/reports/tests/testreport.json": JSON.stringify({ numTotalTests: 5 }),
		});
		setDisk(fs);

		const result = readTestReportJson("/reports", loaderDeps());
		expect(result!.numTotalTests).toBe(5);
		expect(result!.numPendingTests).toBe(0);
		expect(result!.success).toBe(false);
	});
});

// ── aggregateCoverageJson ────────────────────────────────────────────

describe("aggregateCoverageJson", () => {
	it("aggregates coverage from Istanbul format", () => {
		const coverage = {
			"/src/a.ts": {
				s: { "0": 1, "1": 1, "2": 0 },
				b: { "0": [1, 0] },
				f: { "0": 1, "1": 0 },
				statementMap: {}, branchMap: {}, fnMap: {},
			},
		};
		const fs = createMockFs({
			"/reports/coverage/coverage-final.json": JSON.stringify(coverage),
		});
		setDisk(fs);

		const result = aggregateCoverageJson("/reports", loaderDeps());
		expect(result).toBeDefined();
		expect(result!.statementsPct).toBeCloseTo(66.67, 1);
		expect(result!.branchesPct).toBe(50);
		expect(result!.functionsPct).toBe(50);
		expect(result!.filesCovered).toBe(1);
	});

	it("returns undefined when file does not exist", () => {
		setDisk(createMockFs());
		expect(aggregateCoverageJson("/reports", loaderDeps())).toBeUndefined();
	});
});

// ── findLatestMd ─────────────────────────────────────────────────────

describe("findLatestMd", () => {
	it("returns latest timestamped markdown file", () => {
		const fs = createMockFs({
			"/reports/tests/2026-01-01-test.md": "old",
			"/reports/tests/2026-03-08-test.md": "new",
		});
		setDisk(fs);

		const result = findLatestMd("/reports/tests", loaderDeps());
		expect(result).toContain("2026-03-08-test.md");
	});

	it("returns null for empty directory", () => {
		setDisk(createMockFs());
		expect(findLatestMd("/nonexistent", loaderDeps())).toBeNull();
	});

	it("ignores non-timestamped files", () => {
		const fs = createMockFs({
			"/reports/tests/README.md": "readme",
		});
		setDisk(fs);

		expect(findLatestMd("/reports/tests", loaderDeps())).toBeNull();
	});
});

// ── discoverReports ──────────────────────────────────────────────────

describe("discoverReports", () => {
	it("discovers reports from timestamped files", () => {
		const fs = createMockFs({
			"/reports/tests/2026-03-08-test-report.md": "---\ntotal: 100\n---\n# Tests",
			"/reports/coverage/2026-03-08-coverage.md": "---\nlines_pct: 85\n---\n# Coverage",
		});
		setDisk(fs);

		const snapshots = discoverReports("/reports", loaderDeps());
		expect(snapshots).toHaveLength(2);
		expect(snapshots[0].label).toBe("Test");
		expect(snapshots[0].frontmatter.total).toBe("100");
		expect(snapshots[1].label).toBe("Coverage");
	});

	it("prefers stable name over timestamped for configured reports", () => {
		const fs = createMockFs({
			"/reports/complexity/Complexity Report.md": "---\nmax_complexity: 12\n---\n# Complexity",
			"/reports/complexity/2026-01-01-old.md": "---\nmax_complexity: 5\n---\n# Old",
		});
		setDisk(fs);

		const snapshots = discoverReports("/reports", loaderDeps());
		const complexity = snapshots.find((s) => s.label === "Complexity");
		expect(complexity).toBeDefined();
		expect(complexity!.frontmatter.max_complexity).toBe("12");
	});

	it("returns empty array when no reports exist", () => {
		setDisk(createMockFs());
		expect(discoverReports("/reports", loaderDeps())).toEqual([]);
	});
});

// ── loadAnalysisTopFiles ─────────────────────────────────────────────

describe("loadAnalysisTopFiles", () => {
	it("loads and sorts files by decision point count", () => {
		const data = {
			summary: { totalDecisionPoints: 20 },
			files: [
				{ file: "src/a.ts", decisionPointCount: 5 },
				{ file: "src/b.ts", decisionPointCount: 15 },
				{ file: "src/c.ts", decisionPointCount: 0 },
			],
		};
		const fs = createMockFs({
			"/reports/coverage/analysis.json": JSON.stringify(data),
		});
		setDisk(fs);

		const result = loadAnalysisTopFiles("/reports", 10, loaderDeps());
		expect(result).toHaveLength(2); // c.ts filtered out (0 DPs)
		expect(result[0].file).toBe("src/b.ts");
		expect(result[0].decisionPointCount).toBe(15);
	});

	it("returns empty array when file does not exist", () => {
		setDisk(createMockFs());
		expect(loadAnalysisTopFiles("/reports", 10, loaderDeps())).toEqual([]);
	});
});

// ── loadComplexityFunctions ──────────────────────────────────────────

describe("loadComplexityFunctions", () => {
	it("loads complexity functions data", () => {
		const data = {
			summary: { totalFunctions: 10, maxComplexity: 8, avgComplexity: 3.2, medianComplexity: 2, totalComplexity: 32, aboveThreshold10: 0, aboveThreshold15: 0 },
			functions: [{ file: "src/a.ts", functionName: "foo", line: 10, complexity: 8 }],
		};
		const fs = createMockFs({
			"/reports/coverage/complexity-functions.json": JSON.stringify(data),
		});
		setDisk(fs);

		const result = loadComplexityFunctions("/reports", loaderDeps());
		expect(result).toBeDefined();
		expect(result!.summary.maxComplexity).toBe(8);
		expect(result!.functions).toHaveLength(1);
	});

	it("returns undefined when file does not exist", () => {
		setDisk(createMockFs());
		expect(loadComplexityFunctions("/reports", loaderDeps())).toBeUndefined();
	});
});

// ── resolveThresholds ────────────────────────────────────────────────

describe("resolveThresholds", () => {
	it("returns defaults when no config", () => {
		mockReadConfig.mockReturnValue({ config: null, warnings: [] });
		const t = resolveThresholds("/project", loaderDeps());
		expect(t).toEqual(DEFAULT_THRESHOLDS);
	});

	it("merges config overrides with defaults", () => {
		mockReadConfig.mockReturnValue({ config: { reports: { thresholds: { coverageLines: 90 } } }, warnings: [] });
		const t = resolveThresholds("/project", loaderDeps());
		expect(t.coverageLines).toBe(90);
		expect(t.maxComplexity).toBe(15); // default preserved
	});
});

// ── parseTypedocOutput ──────────────────────────────────────────────

describe("parseTypedocOutput", () => {
	it("parses warnings from typedoc output", () => {
		const output = [
			"[warning] SomeType, defined in src/a.ts, is referenced but not included",
			"[info] json generated at ./reports/codebase/codebase.json",
			"[warning] Found 0 errors and 1 warnings",
		].join("\n");
		const result = parseTypedocOutput(output);
		expect(result.warnings).toBe(1);
		expect(result.errors).toBe(0);
		expect(result.issues).toHaveLength(1);
		expect(result.issues[0].severity).toBe("warning");
		expect(result.issues[0].message).toContain("SomeType");
	});

	it("parses errors from typedoc output", () => {
		const output = [
			"[error] Unable to resolve module src/missing.ts",
			"[warning] Unused type in src/b.ts",
			"[warning] Found 1 errors and 1 warnings",
		].join("\n");
		const result = parseTypedocOutput(output);
		expect(result.errors).toBe(1);
		expect(result.warnings).toBe(1);
		expect(result.issues).toHaveLength(2);
	});

	it("returns zeros for empty output", () => {
		const result = parseTypedocOutput("");
		expect(result.warnings).toBe(0);
		expect(result.errors).toBe(0);
		expect(result.issues).toHaveLength(0);
	});

	it("skips summary line (Found N errors and M warnings)", () => {
		const output = "[warning] Found 0 errors and 3 warnings";
		const result = parseTypedocOutput(output);
		expect(result.issues).toHaveLength(0);
	});

	it("returns zeros for clean output (info only)", () => {
		const output = "[info] json generated at ./reports/codebase.json";
		const result = parseTypedocOutput(output);
		expect(result.warnings).toBe(0);
		expect(result.errors).toBe(0);
	});

	it("parses TypeScript compilation errors from typedoc", () => {
		const output = [
			"src/domain/make/component/component-registry.ts:32:2 - error TS2352: Conversion of type ...",
			"src/domain/make/component/storybook-service.ts:46:7 - error TS2554: Expected 3 arguments",
			"[info] Found 2 errors and 0 warnings",
		].join("\n");
		const result = parseTypedocOutput(output);
		expect(result.errors).toBe(2);
		expect(result.warnings).toBe(0);
		expect(result.issues).toHaveLength(2);
		expect(result.issues[0].severity).toBe("error");
		expect(result.issues[0].message).toContain("TS2352");
		expect(result.issues[0].message).toContain("component-registry.ts:32:2");
		expect(result.issues[1].message).toContain("TS2554");
	});

	it("combines TypeDoc warnings and TS compilation errors", () => {
		const output = [
			"[warning] SomeType is not exported",
			"src/file.ts:10:5 - error TS2345: Argument of type ...",
		].join("\n");
		const result = parseTypedocOutput(output);
		expect(result.errors).toBe(1);
		expect(result.warnings).toBe(1);
		expect(result.issues).toHaveLength(2);
	});
});
