import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/infrastructure/filesystem.js", () => ({
	disk: { writeFileSync: vi.fn(), existsSync: vi.fn(() => false) },
}));

vi.mock("../../../src/infrastructure/paths.js", () => ({
	paths: {
		join: (...args: string[]) => args.join("/"),
		resolve: (...args: string[]) => args.join("/"),
	},
}));

vi.mock("../../../src/infrastructure/logger.js", () => ({
	log: vi.fn(),
}));

import {
	extractMetrics,
	buildUnitTestsSection,
	buildCoverageSection,
	buildE2eSection,
	buildPerformanceSection,
	buildBuildTable,
	buildTraceabilitySection,
	buildStateReportFrontmatter,
	buildStateReportHeader,
	buildE2eFrontmatterLines,
	buildPerfFrontmatterLines,
	buildTraceFrontmatterLines,
	generateIncrementStateReport,
	generatePublishStateReport,
} from "../../../src/domain/e2e/e2e-state-reports.js";
import { disk } from "../../../src/infrastructure/filesystem.js";
import type { BuildStats, TestStats } from "../../../src/domain/e2e/e2e-types.js";
import type { E2EPaths } from "../../../src/domain/e2e/e2e-paths.js";

const emptyStats: BuildStats = {
	build: null, test: null, coverage: null, performance: null,
	cycle: null, e2e: null, traceability: null,
	unitTests: { totalTests: 0, passed: 0, failed: 0, skipped: 0 },
};

// ── extractMetrics ──────────────────────────────────────────────────

describe("extractMetrics", () => {
	it("returns zero metrics for empty stats", () => {
		const m = extractMetrics(emptyStats);
		expect(m.sizeKb).toBe(0);
		expect(m.linesPct).toBe(0);
		expect(m.branchesPct).toBe(0);
		expect(m.functionsPct).toBe(0);
		expect(m.cycle).toBe("");
	});

	it("extracts bundle size from build total_bytes", () => {
		const stats: BuildStats = {
			...emptyStats,
			build: { total_bytes: 102400 },
		};
		const m = extractMetrics(stats);
		expect(m.sizeKb).toBe(100);
	});

	it("extracts coverage percentages", () => {
		const stats: BuildStats = {
			...emptyStats,
			coverage: { lines_pct: 85.5, branches_pct: 72.3, functions_pct: 90.1 },
		};
		const m = extractMetrics(stats);
		expect(m.linesPct).toBe(85.5);
		expect(m.branchesPct).toBe(72.3);
		expect(m.functionsPct).toBe(90.1);
	});

	it("supports alternative coverage field names", () => {
		const stats: BuildStats = {
			...emptyStats,
			coverage: { line_pct: 80 },
		};
		const m = extractMetrics(stats);
		expect(m.linesPct).toBe(80);
	});

	it("extracts cycle number", () => {
		const stats: BuildStats = {
			...emptyStats,
			cycle: { cycle: 42 },
		};
		const m = extractMetrics(stats);
		expect(m.cycle).toBe(42);
	});

	it("maps all report categories to short keys", () => {
		const stats: BuildStats = {
			...emptyStats,
			build: { key: "b" },
			test: { key: "t" },
			coverage: { key: "c" },
			e2e: { key: "e" },
			performance: { key: "p" },
			cycle: { key: "cy" },
		};
		const m = extractMetrics(stats);
		expect(m.b).toEqual({ key: "b" });
		expect(m.t).toEqual({ key: "t" });
		expect(m.c).toEqual({ key: "c" });
		expect(m.e).toEqual({ key: "e" });
		expect(m.p).toEqual({ key: "p" });
		expect(m.cy).toEqual({ key: "cy" });
	});
});

// ── Markdown section builders ───────────────────────────────────────

describe("buildUnitTestsSection", () => {
	it("renders table when tests exist", () => {
		const ut: TestStats = { totalTests: 10, passed: 9, failed: 1, skipped: 0 };
		const lines = buildUnitTestsSection(ut, { suites: 3, duration_ms: 5000 });
		expect(lines[0]).toBe("## Unit Tests");
		expect(lines.join("\n")).toContain("9/10 passed");
		expect(lines.join("\n")).toContain("danger");
		expect(lines.join("\n")).toContain("5s");
	});

	it("renders success callout when all pass", () => {
		const ut: TestStats = { totalTests: 5, passed: 5, failed: 0, skipped: 0 };
		const lines = buildUnitTestsSection(ut, {});
		expect(lines.join("\n")).toContain("success");
	});

	it("renders fallback when no tests", () => {
		const ut: TestStats = { totalTests: 0, passed: 0, failed: 0, skipped: 0 };
		const lines = buildUnitTestsSection(ut, {});
		expect(lines.join("\n")).toContain("No unit test data");
	});
});

describe("buildCoverageSection", () => {
	it("renders table when coverage > 0", () => {
		const lines = buildCoverageSection(85, 70, 90, { files_covered: 42 });
		expect(lines.join("\n")).toContain("85%");
		expect(lines.join("\n")).toContain("Files | 42");
	});

	it("renders fallback when no coverage", () => {
		const lines = buildCoverageSection(0, 0, 0, {});
		expect(lines.join("\n")).toContain("No coverage data");
	});
});

describe("buildE2eSection", () => {
	it("renders table when e2e tests exist", () => {
		const lines = buildE2eSection({ total_tests: 20, passed: 18, failed: 2, journeys: 5, total_actions: 100 });
		expect(lines.join("\n")).toContain("18/20 passed");
		expect(lines.join("\n")).toContain("danger");
	});

	it("renders success when all pass", () => {
		const lines = buildE2eSection({ total_tests: 10, passed: 10, failed: 0, journeys: 3, total_actions: 50 });
		expect(lines.join("\n")).toContain("success");
	});

	it("renders fallback when no e2e data", () => {
		const lines = buildE2eSection({});
		expect(lines.join("\n")).toContain("No E2E data");
	});
});

describe("buildPerformanceSection", () => {
	it("renders table when p50 exists", () => {
		const lines = buildPerformanceSection({ startup_p50: 120, startup_p95: 300, startup_max: 500 }, {});
		expect(lines.join("\n")).toContain("120 ms");
		expect(lines.join("\n")).toContain("300 ms");
	});

	it("falls back to test stats for p50", () => {
		const lines = buildPerformanceSection({}, { startup_p50: 80 });
		expect(lines.join("\n")).toContain("80 ms");
	});

	it("renders data.json size in MB", () => {
		const lines = buildPerformanceSection({ startup_p50: 100, data_json_size_bytes: 2097152 }, {});
		expect(lines.join("\n")).toContain("2.0 MB");
	});

	it("renders fallback when no perf data", () => {
		const lines = buildPerformanceSection({}, {});
		expect(lines.join("\n")).toContain("No performance data");
	});
});

describe("buildBuildTable", () => {
	it("renders build metrics table", () => {
		const lines = buildBuildTable(512, { duration_ms: 1200, plugin_version: "2.0.0", warnings_count: 1, errors_count: 0 });
		expect(lines.join("\n")).toContain("512 KB");
		expect(lines.join("\n")).toContain("2.0.0");
		expect(lines.join("\n")).toContain("1200 ms");
	});

	it("uses ? for missing values", () => {
		const lines = buildBuildTable(0, {});
		expect(lines.join("\n")).toContain("?");
	});
});

describe("buildTraceabilitySection", () => {
	it("renders table when events exist", () => {
		const lines = buildTraceabilitySection({ total_events: 100, linked: 95, unlinked: 5 });
		expect(lines.join("\n")).toContain("95/100 linked");
		expect(lines.join("\n")).toContain("95%");
		expect(lines.join("\n")).toContain("warning");
	});

	it("renders success when all linked", () => {
		const lines = buildTraceabilitySection({ total_events: 50, linked: 50, unlinked: 0 });
		expect(lines.join("\n")).toContain("success");
	});

	it("renders fallback when no trace data", () => {
		const lines = buildTraceabilitySection({});
		expect(lines.join("\n")).toContain("No traceability data");
	});
});

// ── Frontmatter builders ────────────────────────────────────────────

describe("buildStateReportFrontmatter", () => {
	it("includes all required fields", () => {
		const now = new Date("2026-03-08T12:00:00Z");
		const m = extractMetrics(emptyStats);
		const ut: TestStats = { totalTests: 10, passed: 10, failed: 0, skipped: 0 };
		const lines = buildStateReportFrontmatter("IncrementStateReport", "pass", "12.5", now, m, ut);
		expect(lines[0]).toBe("---");
		expect(lines.join("\n")).toContain("type: IncrementStateReport");
		expect(lines.join("\n")).toContain("status: pass");
		expect(lines.join("\n")).toContain("unit_total: 10");
	});

	it("includes cycle when present", () => {
		const now = new Date();
		const stats: BuildStats = { ...emptyStats, cycle: { cycle: 59 } };
		const m = extractMetrics(stats);
		const ut = emptyStats.unitTests;
		const lines = buildStateReportFrontmatter("Test", "pass", "1", now, m, ut);
		expect(lines.join("\n")).toContain("cycle: 59");
	});
});

describe("buildStateReportHeader", () => {
	it("renders pass header with success callout", () => {
		const now = new Date("2026-03-08T12:00:00Z");
		const m = extractMetrics(emptyStats);
		const lines = buildStateReportHeader("Test Report", "pass", "5.0", now, m);
		expect(lines.join("\n")).toContain("# Test Report");
		expect(lines.join("\n")).toContain("success");
		expect(lines.join("\n")).toContain("PASS");
	});

	it("renders fail header with danger callout", () => {
		const now = new Date("2026-03-08T12:00:00Z");
		const m = extractMetrics(emptyStats);
		const lines = buildStateReportHeader("Test Report", "fail", "5.0", now, m);
		expect(lines.join("\n")).toContain("danger");
		expect(lines.join("\n")).toContain("FAIL");
	});
});

describe("buildE2eFrontmatterLines", () => {
	it("renders e2e frontmatter lines", () => {
		const lines = buildE2eFrontmatterLines({ total_tests: 20, passed: 18, failed: 2, journeys: 5, total_actions: 100 });
		expect(lines).toContain("e2e_total: 20");
		expect(lines).toContain("e2e_passed: 18");
		expect(lines).toContain("e2e_journeys: 5");
	});

	it("defaults to 0 for missing fields", () => {
		const lines = buildE2eFrontmatterLines({});
		expect(lines).toContain("e2e_total: 0");
	});
});

describe("buildPerfFrontmatterLines", () => {
	it("renders perf frontmatter from perf stats", () => {
		const lines = buildPerfFrontmatterLines({ startup_p50: 100, startup_p95: 200 }, {});
		expect(lines).toContain("startup_p50_ms: 100");
		expect(lines).toContain("startup_p95_ms: 200");
	});

	it("falls back to test stats", () => {
		const lines = buildPerfFrontmatterLines({}, { startup_p50: 80, startup_p95: 150 });
		expect(lines).toContain("startup_p50_ms: 80");
	});
});

describe("buildTraceFrontmatterLines", () => {
	it("renders trace frontmatter", () => {
		const lines = buildTraceFrontmatterLines({ total_events: 100, linked: 90, unlinked: 10 });
		expect(lines).toContain("trace_total: 100");
		expect(lines).toContain("trace_linked: 90");
		expect(lines).toContain("trace_unlinked: 10");
	});
});

// ── Full report generation ──────────────────────────────────────────

beforeEach(() => {
	vi.clearAllMocks();
});

const mockE2e: E2EPaths = {
	projectRoot: "/project",
	pluginId: "flowti-ibde",
	journeysDir: "/project/tests/e2e/journeys",
	testVault: "/vault-e2e",
	vaultName: "vault-e2e",
	pluginDir: "/vault-e2e/.obsidian/plugins/flowti-ibde",
	dataJsonPath: "/vault-e2e/.obsidian/plugins/flowti-ibde/data.json",
	pluginArtifacts: ["main.js", "manifest.json", "styles.css"],
	testDataCsv: "/vault-e2e/data.csv",
	reportsDir: "/project/docs/reports",
	devRunsDir: "/project/docs/reports/e2e/runs",
	devTracesDir: "/project/docs/reports/e2e/traces",
	devJourneysDir: "/project/docs/journeys",
	vitestResults: "/project/docs/reports/e2e/e2e-results.json",
	dataJsonCandidates: [],
};

describe("generateIncrementStateReport", () => {
	it("writes report to both test vault and dev vault", () => {
		const stats: BuildStats = {
			...emptyStats,
			build: { plugin_version: "1.0.0", total_bytes: 51200 },
		};

		const result = generateIncrementStateReport(0, "10.5", stats, mockE2e);
		expect(disk.writeFileSync).toHaveBeenCalledTimes(2);
		expect(result.testPath).toContain("Increment State Report.md");
		expect(result.devPath).toContain("Increment State Report.md");
	});

	it("includes increment and state-report tags", () => {
		const result = generateIncrementStateReport(0, "5", emptyStats, mockE2e);
		const content = vi.mocked(disk.writeFileSync).mock.calls[0][1] as string;
		expect(content).toContain("  - increment");
		expect(content).toContain("  - state-report");
	});
});

describe("generatePublishStateReport", () => {
	it("writes report to dev vault", () => {
		const result = generatePublishStateReport(0, "20.0", emptyStats, mockE2e);
		expect(disk.writeFileSync).toHaveBeenCalledTimes(1);
		expect(result.devPath).toContain("Publish State Report.md");
	});

	it("includes traceability section", () => {
		const stats: BuildStats = {
			...emptyStats,
			traceability: { total_events: 50, linked: 48, unlinked: 2 },
		};
		generatePublishStateReport(0, "5", stats, mockE2e);
		const content = vi.mocked(disk.writeFileSync).mock.calls[0][1] as string;
		expect(content).toContain("## Traceability");
	});
});
