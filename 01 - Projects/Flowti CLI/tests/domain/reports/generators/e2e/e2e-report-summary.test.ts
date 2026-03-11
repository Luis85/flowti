import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../../../src/infrastructure/filesystem.js", () => ({
	disk: {
		existsSync: vi.fn(() => false),
		readFileSync: vi.fn(() => ""),
		writeFileSync: vi.fn(),
		mkdirSync: vi.fn(),
		rmSync: vi.fn(),
		readdirSync: vi.fn(() => []),
		copyFileSync: vi.fn(),
	},
}));
vi.mock("../../../../../src/infrastructure/paths.js", () => ({
	paths: {
		join: (...args: string[]) => args.join("/"),
		resolve: (...args: string[]) => args.join("/"),
		dirname: (p: string) => p.split("/").slice(0, -1).join("/"),
		basename: (p: string) => p.split("/").pop() ?? "",
		relative: (from: string, to: string) => to.replace(from + "/", ""),
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
		now: () => new Date("2026-01-01T00:00:00Z"),
		iso: () => "2026-01-01T00:00:00.000Z",
		ms: () => 1000000,
		safeIso: () => "2026-01-01T00-00-00.000Z",
	},
}));
// Mock the dependent e2e report modules
vi.mock("../../../../../src/domain/reports/generators/e2e/e2e-report-vitest.js", () => ({
	readVitestResults: vi.fn(() => null),
	readJourneyResults: vi.fn(() => []),
	reconcileResults: vi.fn(() => null),
}));
vi.mock("../../../../../src/domain/reports/generators/e2e/e2e-report-perf.js", () => ({
	readLatestEventTrace: vi.fn(() => null),
	readStartupPerf: vi.fn(() => null),
	buildPerfLines: vi.fn(),
	buildEventTraceLines: vi.fn(),
}));
vi.mock("../../../../../src/domain/reports/generators/e2e/e2e-report-sections.js", () => ({
	collectVitestFailures: vi.fn(() => []),
	renderActionCoverageSection: vi.fn(),
	renderFailuresSection: vi.fn(),
	renderJourneysSummarySection: vi.fn(),
	renderTestSuitesSection: vi.fn(),
	renderWarningsSection: vi.fn(),
}));
vi.mock("../../../../../src/domain/reports/generators/e2e/e2e-report-frontmatter.js", () => ({
	buildE2EFrontmatter: vi.fn(),
}));
vi.mock("../../../../../src/domain/reports/generators/e2e/e2e-report-journey.js", () => ({
	generateJourneyReport: vi.fn(() => ({ title: "Journey Test", status: "pass", content: "# Journey" })),
}));
vi.mock("../../../../../src/domain/reports/generators/e2e/e2e-report-canvas.js", () => ({
	generateJourneyCanvas: vi.fn(() => ({ nodes: [], edges: [] })),
}));
vi.mock("../../../../../src/domain/reports/generators/e2e/e2e-report-utils.js", () => ({
	computeActionStats: vi.fn(() => ({
		total: 10, screenshots: 2, assertions: 3, manual_checks: 1, manual_passed: 1, manual_failed: 0,
		visual_inspections: 0, notices: 1, theme_changes: 0, create_files: 0, delete_files: 0,
		open_files: 0, close_leaves: 0, tools: ["screenshot", "assert"],
	})),
	formatDuration: vi.fn((ms: number) => `${ms}ms`),
	resolveMode: vi.fn(() => "full"),
	resolveStatus: vi.fn(() => "pass"),
	statusCallout: vi.fn(() => "success"),
	statusLabel: vi.fn(() => "Pass"),
	TOOL_COUNTER_MAP: {
		screenshot: "screenshots", assert: "assertions", manual: "manual_checks",
		"visual-inspection": "visual_inspections", notice: "notices", theme: "theme_changes",
		"create-file": "create_files", "delete-file": "delete_files",
		"open-file": "open_files", "close-leaves": "close_leaves",
	},
}));

import { disk } from "../../../../../src/infrastructure/filesystem.js";
import { paths } from "../../../../../src/infrastructure/paths.js";
import { proc } from "../../../../../src/infrastructure/proc.js";
import {
	aggregateJourneyStats,
	computeReconciledTotals,
	collectFailedSteps,
	cleanupResults,
} from "../../../../../src/domain/reports/generators/e2e/e2e-report-summary.js";
import { reconcileResults } from "../../../../../src/domain/reports/generators/e2e/e2e-report-vitest.js";

beforeEach(() => {
	vi.clearAllMocks();
});

const mockDeps = { disk, paths, proc };

describe("e2e-report-summary", () => {
	describe("aggregateJourneyStats", () => {
		it("returns zero aggregates for empty journeys array", () => {
			const { aggregate, perJourney } = aggregateJourneyStats([]);

			expect(aggregate.total).toBe(0);
			expect(aggregate.screenshots).toBe(0);
			expect(aggregate.assertions).toBe(0);
			expect(aggregate.manual_checks).toBe(0);
			expect(aggregate.manual_passed).toBe(0);
			expect(aggregate.manual_failed).toBe(0);
			expect(aggregate.visual_inspections).toBe(0);
			expect(aggregate.notices).toBe(0);
			expect(aggregate.theme_changes).toBe(0);
			expect(aggregate.create_files).toBe(0);
			expect(aggregate.delete_files).toBe(0);
			expect(aggregate.open_files).toBe(0);
			expect(aggregate.close_leaves).toBe(0);
			expect(aggregate.tools).toEqual([]);
			expect(aggregate.tools_set.size).toBe(0);
			expect(perJourney.size).toBe(0);
		});

		it("aggregates stats across multiple journeys", () => {
			// computeActionStats is mocked to return { total: 10, screenshots: 2, assertions: 3, ... tools: ["screenshot", "assert"] }
			const journeys = [
				{ dir: "/results/journey-a", data: { journey: "journey-a", steps: [] } },
				{ dir: "/results/journey-b", data: { journey: "journey-b", steps: [] } },
			];

			const { aggregate, perJourney } = aggregateJourneyStats(journeys);

			// Two journeys, each contributing 10 total and 2 screenshots + 3 assertions
			expect(aggregate.total).toBe(20);
			expect(aggregate.screenshots).toBe(4);
			expect(aggregate.assertions).toBe(6);
			expect(aggregate.manual_checks).toBe(2);
			expect(aggregate.manual_passed).toBe(2);
			expect(aggregate.manual_failed).toBe(0);
			expect(aggregate.notices).toBe(2);

			// tools_set deduplicates across journeys
			expect(aggregate.tools_set.has("screenshot")).toBe(true);
			expect(aggregate.tools_set.has("assert")).toBe(true);
			expect(aggregate.tools).toEqual(["assert", "screenshot"]); // sorted

			// per-journey map has an entry for each journey
			expect(perJourney.size).toBe(2);
			expect(perJourney.has("journey-a")).toBe(true);
			expect(perJourney.has("journey-b")).toBe(true);
		});
	});

	describe("computeReconciledTotals", () => {
		it("returns empty counts when reconcileResults returns null", () => {
			vi.mocked(reconcileResults).mockReturnValue(null);

			const result = computeReconciledTotals(null, [], mockDeps);

			expect(result.totalPassed).toBe(0);
			expect(result.totalFailed).toBe(0);
			expect(result.totalSkipped).toBe(0);
			expect(result.totalDev).toBe(0);
			expect(result.totalTests).toBe(0);
			expect(result.totalDurationMs).toBe(0);
			expect(typeof result.overallStatus).toBe("string");
		});

		it("computes totals from reconciled results", () => {
			vi.mocked(reconcileResults).mockReturnValue({
				totalPassed: 42,
				totalFailed: 3,
				totalSkipped: 5,
				totalDev: 2,
				totalTests: 52,
				suites: [],
			});

			const vitest = {
				totalPassed: 42, totalFailed: 3, totalSkipped: 5, totalTests: 52,
				totalDev: 2, durationMs: 12345, suites: [],
			};

			const result = computeReconciledTotals(vitest, [], mockDeps);

			expect(result.totalPassed).toBe(42);
			expect(result.totalFailed).toBe(3);
			expect(result.totalSkipped).toBe(5);
			expect(result.totalDev).toBe(2);
			expect(result.totalTests).toBe(52);
			expect(result.totalDurationMs).toBe(12345);
			expect(typeof result.overallStatus).toBe("string");
		});
	});

	describe("collectFailedSteps", () => {
		it("returns empty array when no failed steps", () => {
			const journeyReportNames = [
				{
					title: "Journey A",
					data: {
						steps: [
							{ step: { id: "s1", guideSection: "setup", title: "Step 1" }, status: "pass", durationMs: 100 },
							{ step: { id: "s2", guideSection: "setup", title: "Step 2" }, status: "skip", durationMs: 0 },
						],
					},
				},
			];

			const result = collectFailedSteps(journeyReportNames);

			expect(result).toEqual([]);
		});

		it("collects failed steps from multiple journeys", () => {
			const journeyReportNames = [
				{
					title: "Journey A",
					data: {
						steps: [
							{ step: { id: "s1", guideSection: "setup", title: "Step 1" }, status: "pass", durationMs: 100 },
							{ step: { id: "s2", guideSection: "core", title: "Step 2" }, status: "fail", durationMs: 200, error: "Assertion failed" },
						],
					},
				},
				{
					title: "Journey B",
					data: {
						steps: [
							{ step: { id: "s3", guideSection: "teardown", title: "Step 3" }, status: "fail", durationMs: 50, error: "Timeout" },
						],
					},
				},
			];

			const result = collectFailedSteps(journeyReportNames);

			expect(result).toHaveLength(2);
			expect(result[0].journeyTitle).toBe("Journey A");
			expect(result[0].stepResult.status).toBe("fail");
			expect(result[0].stepResult.error).toBe("Assertion failed");
			expect(result[1].journeyTitle).toBe("Journey B");
			expect(result[1].stepResult.status).toBe("fail");
			expect(result[1].stepResult.error).toBe("Timeout");
		});
	});

	describe("cleanupResults", () => {
		it("removes vitest results file when it exists", () => {
			vi.mocked(disk.existsSync).mockReturnValue(true);

			cleanupResults([], "/tmp/vitest-results.json", mockDeps);

			expect(disk.existsSync).toHaveBeenCalledWith("/tmp/vitest-results.json");
			expect(disk.rmSync).toHaveBeenCalledWith("/tmp/vitest-results.json", { force: true });
		});

		it("removes journey result files for each journey", () => {
			vi.mocked(disk.existsSync).mockReturnValue(false);

			const journeys = [
				{ dir: "/results/journey-a", data: { journey: "journey-a", steps: [] } },
				{ dir: "/results/journey-b", data: { journey: "journey-b", steps: [] } },
			];

			cleanupResults(journeys, "/tmp/vitest-results.json", mockDeps);

			expect(disk.rmSync).toHaveBeenCalledWith("/results/journey-a/journey-a-results.json", { force: true });
			expect(disk.rmSync).toHaveBeenCalledWith("/results/journey-b/journey-b-results.json", { force: true });
		});

		it("handles missing files gracefully without throwing", () => {
			vi.mocked(disk.existsSync).mockReturnValue(true);
			vi.mocked(disk.rmSync).mockImplementation(() => { throw new Error("ENOENT: no such file"); });

			expect(() => cleanupResults(
				[{ dir: "/results/journey-a", data: { journey: "journey-a", steps: [] } }],
				"/tmp/vitest-results.json",
				mockDeps,
			)).not.toThrow();
		});
	});
});
