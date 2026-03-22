import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../../../src/infrastructure/filesystem.js", () => ({
	disk: {
		existsSync: vi.fn(() => false),
		readFileSync: vi.fn(() => ""),
		writeFileSync: vi.fn(),
		mkdirSync: vi.fn(),
	},
}));

vi.mock("../../../../../src/infrastructure/paths.js", () => ({
	paths: {
		join: (...args: string[]) => args.join("/"),
		resolve: (...args: string[]) => args.join("/"),
		dirname: (p: string) => p.split("/").slice(0, -1).join("/") || "/",
		basename: (p: string) => p.split("/").pop() ?? "",
	},
}));

vi.mock("../../../../../src/infrastructure/config.js", () => ({
	PLUGIN_ROOT: "/plugin",
}));

vi.mock("../../../../../src/infrastructure/proc.js", () => ({
	proc: {
		argv: () => [] as string[],
		env: () => ({}),
	},
}));

vi.mock("../../../../../src/infrastructure/clock.js", () => ({
	clock: {
		now: () => new Date("2026-03-10T12:00:00Z"),
		iso: () => "2026-03-10T12:00:00.000Z",
		safeIso: () => "2026-03-10T12-00-00",
		ms: () => 1741608000000,
	},
}));

import { buildE2EFrontmatter } from "../../../../../src/domain/reports/generators/e2e/e2e-report-frontmatter.js";
import { Document } from "../../../../../src/infrastructure/document.js";
import { proc } from "../../../../../src/infrastructure/proc.js";

const mockProcDeps = { proc };

beforeEach(() => {
	vi.clearAllMocks();
});

function makeAggregate(overrides: Partial<{
	total: number; screenshots: number; assertions: number; manual_checks: number;
	manual_passed: number; manual_failed: number; visual_inspections: number;
	notices: number; theme_changes: number; create_files: number; delete_files: number;
	open_files: number; close_leaves: number; tools: string[];
}> = {}) {
	return {
		total: 0, screenshots: 0, assertions: 0, manual_checks: 0,
		manual_passed: 0, manual_failed: 0, visual_inspections: 0,
		notices: 0, theme_changes: 0, create_files: 0, delete_files: 0,
		open_files: 0, close_leaves: 0, tools: [],
		...overrides,
	};
}

describe("e2e-report-frontmatter", () => {
	describe("buildE2EFrontmatter", () => {
		it("sets basic frontmatter fields", () => {
			const doc = Document.create("Test");
			buildE2EFrontmatter(doc, {
				date: "2026-03-10T12:00:00.000Z",
				totalTests: 100,
				totalPassed: 90,
				totalFailed: 5,
				totalSkipped: 5,
				totalDev: 0,
				totalDurationMs: 30000,
				overallStatus: "pass",
				aggregate: makeAggregate(),
				allTools: [],
				testSuiteLinks: [],
				journeyReportLinks: [],
				journeyCanvasLinks: [],
				journeyCount: 3,
				trace: null,
				startupPerf: null,
			}, mockProcDeps);

			const output = doc.toString();
			expect(output).toContain("type: E2EReport");
			expect(output).toContain("total_tests: 100");
			expect(output).toContain("passed: 90");
			expect(output).toContain("failed: 5");
			expect(output).toContain("skipped: 5");
			expect(output).toContain("success: true");
		});

		it("sets dev count when > 0", () => {
			const doc = Document.create("Test");
			buildE2EFrontmatter(doc, {
				date: "2026-03-10",
				totalTests: 10,
				totalPassed: 5,
				totalFailed: 0,
				totalSkipped: 2,
				totalDev: 3,
				totalDurationMs: 1000,
				overallStatus: "partial-pass",
				aggregate: makeAggregate(),
				allTools: [],
				testSuiteLinks: [],
				journeyReportLinks: [],
				journeyCanvasLinks: [],
				journeyCount: 1,
				trace: null,
				startupPerf: null,
			}, mockProcDeps);

			const output = doc.toString();
			expect(output).toContain("dev: 3");
			expect(output).toContain("success: true"); // partial-pass is truthy
		});

		it("sets action frontmatter from aggregate", () => {
			const doc = Document.create("Test");
			buildE2EFrontmatter(doc, {
				date: "2026-03-10",
				totalTests: 10,
				totalPassed: 10,
				totalFailed: 0,
				totalSkipped: 0,
				totalDev: 0,
				totalDurationMs: 1000,
				overallStatus: "pass",
				aggregate: makeAggregate({ total: 50, screenshots: 10, assertions: 20 }),
				allTools: ["screenshot", "click"],
				testSuiteLinks: [],
				journeyReportLinks: [],
				journeyCanvasLinks: [],
				journeyCount: 1,
				trace: null,
				startupPerf: null,
			}, mockProcDeps);

			const output = doc.toString();
			expect(output).toContain("total_actions: 50");
			expect(output).toContain("total_screenshots: 10");
			expect(output).toContain("total_assertions: 20");
			expect(output).toContain("tools:");
		});

		it("sets empty tools array as raw frontmatter", () => {
			const doc = Document.create("Test");
			buildE2EFrontmatter(doc, {
				date: "2026-03-10",
				totalTests: 1,
				totalPassed: 1,
				totalFailed: 0,
				totalSkipped: 0,
				totalDev: 0,
				totalDurationMs: 100,
				overallStatus: "pass",
				aggregate: makeAggregate(),
				allTools: [],
				testSuiteLinks: [],
				journeyReportLinks: [],
				journeyCanvasLinks: [],
				journeyCount: 0,
				trace: null,
				startupPerf: null,
			}, mockProcDeps);

			const output = doc.toString();
			expect(output).toContain("tools: []");
		});

		it("sets manual passed/failed only when > 0", () => {
			const doc = Document.create("Test");
			buildE2EFrontmatter(doc, {
				date: "2026-03-10",
				totalTests: 1,
				totalPassed: 1,
				totalFailed: 0,
				totalSkipped: 0,
				totalDev: 0,
				totalDurationMs: 100,
				overallStatus: "pass",
				aggregate: makeAggregate({ manual_passed: 3, manual_failed: 1 }),
				allTools: [],
				testSuiteLinks: [],
				journeyReportLinks: [],
				journeyCanvasLinks: [],
				journeyCount: 0,
				trace: null,
				startupPerf: null,
			}, mockProcDeps);

			const output = doc.toString();
			expect(output).toContain("total_manual_passed: 3");
			expect(output).toContain("total_manual_failed: 1");
		});

		it("sets link frontmatter fields", () => {
			const doc = Document.create("Test");
			buildE2EFrontmatter(doc, {
				date: "2026-03-10",
				totalTests: 1,
				totalPassed: 1,
				totalFailed: 0,
				totalSkipped: 0,
				totalDev: 0,
				totalDurationMs: 100,
				overallStatus: "pass",
				aggregate: makeAggregate(),
				allTools: [],
				testSuiteLinks: ["[[Suite A]]"],
				journeyReportLinks: ["[[Journey 1]]"],
				journeyCanvasLinks: ["[[Canvas 1]]"],
				journeyCount: 1,
				trace: null,
				startupPerf: null,
			}, mockProcDeps);

			const output = doc.toString();
			expect(output).toContain("test_suites:");
			expect(output).toContain("journey_reports:");
			expect(output).toContain("journey_canvases:");
			expect(output).toContain("event_trace:");
		});

		it("adds partial tag for partial-pass status", () => {
			const doc = Document.create("Test");
			buildE2EFrontmatter(doc, {
				date: "2026-03-10",
				totalTests: 10,
				totalPassed: 8,
				totalFailed: 2,
				totalSkipped: 0,
				totalDev: 0,
				totalDurationMs: 1000,
				overallStatus: "partial-pass",
				aggregate: makeAggregate(),
				allTools: [],
				testSuiteLinks: [],
				journeyReportLinks: [],
				journeyCanvasLinks: [],
				journeyCount: 1,
				trace: null,
				startupPerf: null,
			}, mockProcDeps);

			const output = doc.toString();
			expect(output).toContain("partial");
		});

		it("includes trace metrics when available", () => {
			const doc = Document.create("Test");
			buildE2EFrontmatter(doc, {
				date: "2026-03-10",
				totalTests: 1,
				totalPassed: 1,
				totalFailed: 0,
				totalSkipped: 0,
				totalDev: 0,
				totalDurationMs: 100,
				overallStatus: "pass",
				aggregate: makeAggregate(),
				allTools: [],
				testSuiteLinks: [],
				journeyReportLinks: [],
				journeyCanvasLinks: [],
				journeyCount: 1,
				trace: { summary: { totalEvents: 500, perfEvents: 50 } },
				startupPerf: null,
			}, mockProcDeps);

			const output = doc.toString();
			expect(output).toContain("trace_events: 500");
			expect(output).toContain("trace_perf_events: 50");
		});

		it("computes startup_p50 from startupPerf", () => {
			const doc = Document.create("Test");
			buildE2EFrontmatter(doc, {
				date: "2026-03-10",
				totalTests: 1,
				totalPassed: 1,
				totalFailed: 0,
				totalSkipped: 0,
				totalDev: 0,
				totalDurationMs: 100,
				overallStatus: "pass",
				aggregate: makeAggregate(),
				allTools: [],
				testSuiteLinks: [],
				journeyReportLinks: [],
				journeyCanvasLinks: [],
				journeyCount: 1,
				trace: null,
				startupPerf: { history: [100, 200, 300], sizeBytes: 5000 },
			}, mockProcDeps);

			const output = doc.toString();
			expect(output).toContain("startup_p50:");
		});
	});
});
