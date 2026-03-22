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
	writeJourneyOutputs,
	generateE2EReport,
} from "../../../../../src/domain/reports/generators/e2e/e2e-report-summary.js";
import { reconcileResults, readVitestResults, readJourneyResults } from "../../../../../src/domain/reports/generators/e2e/e2e-report-vitest.js";
import { generateJourneyReport } from "../../../../../src/domain/reports/generators/e2e/e2e-report-journey.js";
import { generateJourneyCanvas } from "../../../../../src/domain/reports/generators/e2e/e2e-report-canvas.js";
import { buildE2EFrontmatter } from "../../../../../src/domain/reports/generators/e2e/e2e-report-frontmatter.js";
import type { E2EPaths } from "../../../../../src/domain/review/e2e-paths.js";

beforeEach(() => {
	vi.clearAllMocks();
	// Restore default implementations that may be overridden by specific tests
	vi.mocked(disk.existsSync).mockReturnValue(false);
	vi.mocked(disk.readFileSync).mockReturnValue("" as never);
	vi.mocked(disk.writeFileSync).mockImplementation(() => {});
	vi.mocked(disk.mkdirSync).mockImplementation(() => "");
	vi.mocked(disk.rmSync).mockImplementation(() => {});
	vi.mocked(disk.readdirSync).mockReturnValue([] as unknown as ReturnType<typeof disk.readdirSync> as never);
	vi.mocked(disk.copyFileSync).mockImplementation(() => {});
	vi.mocked(generateJourneyReport).mockReturnValue({ title: "Journey Test", status: "pass", content: "# Journey" });
	vi.mocked(generateJourneyCanvas).mockReturnValue({ nodes: [], edges: [], metadata: { version: "1", frontmatter: {}, startNode: "" } });
	vi.mocked(reconcileResults).mockReturnValue(null);
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

	describe("writeJourneyOutputs", () => {
		const mockE2E: E2EPaths = {
			projectRoot: "/project",
			pluginId: "flowti-ibde",
			journeysDir: "/project/tests/e2e/journeys",
			testVault: "/test-vault",
			vaultName: "flowti-e2e",
			pluginDir: "/test-vault/.obsidian/plugins/flowti-ibde",
			dataJsonPath: "/test-vault/.obsidian/plugins/flowti-ibde/data.json",
			pluginArtifacts: ["main.js", "manifest.json", "styles.css"],
			testDataCsv: "/test-vault/03 - Resources/Test Data/Analytics/Suppliers.csv",
			reportsDir: "/project/docs/reports",
			devRunsDir: "/project/docs/reports/e2e/runs",
			devTracesDir: "/project/docs/reports/e2e/traces",
			devJourneysDir: "/project/docs/journeys",
			vitestResults: "/project/docs/reports/e2e/e2e-results.json",
			dataJsonCandidates: ["/project/data.json"],
		};

		it("writes journey report and canvas to the test vault directory", () => {
			vi.mocked(disk.existsSync).mockReturnValue(false);

			const result = writeJourneyOutputs(
				"/results/journey-a",
				{ journey: "journey-a", steps: [] },
				"2026-01-01T00:00:00Z",
				new Date("2026-01-01T00:00:00Z"),
				null,
				mockE2E,
				mockDeps,
			);

			expect(result.title).toBe("Journey Test");
			expect(result.status).toBe("pass");
			expect(result.content).toBe("# Journey");

			// Should call generateJourneyReport with the data
			expect(generateJourneyReport).toHaveBeenCalledWith(
				{ journey: "journey-a", steps: [] },
				"2026-01-01T00:00:00Z",
				mockDeps,
			);

			// Should write report to test vault dir
			expect(disk.mkdirSync).toHaveBeenCalledWith("/results/journey-a", { recursive: true });
			expect(disk.writeFileSync).toHaveBeenCalledWith(
				"/results/journey-a/Journey Test.md",
				"# Journey",
				"utf-8",
			);

			// Should write canvas
			expect(generateJourneyCanvas).toHaveBeenCalled();
			expect(disk.writeFileSync).toHaveBeenCalledWith(
				"/results/journey-a/Journey Test.canvas",
				expect.any(String),
				"utf-8",
			);
		});

		it("mirrors report to dev journeys directory", () => {
			vi.mocked(disk.existsSync).mockReturnValue(false);

			writeJourneyOutputs(
				"/results/journey-a",
				{ journey: "journey-a", steps: [] },
				"2026-01-01T00:00:00Z",
				new Date("2026-01-01T00:00:00Z"),
				null,
				mockE2E,
				mockDeps,
			);

			const devJourneyDir = "/project/docs/journeys/Journey Test";
			expect(disk.mkdirSync).toHaveBeenCalledWith(devJourneyDir, { recursive: true });
			expect(disk.writeFileSync).toHaveBeenCalledWith(
				`${devJourneyDir}/Journey Test.md`,
				expect.any(String),
				"utf-8",
			);
		});

		it("writes archived report to past-tests directory", () => {
			vi.mocked(disk.existsSync).mockReturnValue(false);

			writeJourneyOutputs(
				"/results/journey-a",
				{ journey: "journey-a", steps: [] },
				"2026-01-01T00:00:00Z",
				new Date("2026-01-01T00:00:00Z"),
				null,
				mockE2E,
				mockDeps,
			);

			const pastTestsDir = "/project/docs/journeys/Journey Test/past-tests";
			expect(disk.mkdirSync).toHaveBeenCalledWith(pastTestsDir, { recursive: true });
			// Archived filename includes ISO timestamp with colons replaced
			expect(disk.writeFileSync).toHaveBeenCalledWith(
				expect.stringContaining("2026-01-01T00-00-00.000Z-Journey Test.md"),
				expect.any(String),
				"utf-8",
			);
		});

		it("copies config file to dev directory when it exists", () => {
			vi.mocked(disk.existsSync).mockImplementation((p: string) => {
				if (p === "/results/journey-a/Journey Test-config.json") return true;
				return false;
			});
			vi.mocked(disk.readFileSync).mockReturnValue('{"config": true}' as never);

			writeJourneyOutputs(
				"/results/journey-a",
				{ journey: "journey-a", steps: [] },
				"2026-01-01T00:00:00Z",
				new Date("2026-01-01T00:00:00Z"),
				null,
				mockE2E,
				mockDeps,
			);

			expect(disk.readFileSync).toHaveBeenCalledWith(
				"/results/journey-a/Journey Test-config.json",
				"utf-8",
			);
			expect(disk.writeFileSync).toHaveBeenCalledWith(
				"/project/docs/journeys/Journey Test/Journey Test-config.json",
				'{"config": true}',
				"utf-8",
			);
		});

		it("adds (Partial) suffix to archived file when status is partial-pass", () => {
			vi.mocked(generateJourneyReport).mockReturnValue({
				title: "Journey Test",
				status: "partial-pass",
				content: "# Journey Partial",
			});
			vi.mocked(disk.existsSync).mockReturnValue(false);

			writeJourneyOutputs(
				"/results/journey-a",
				{ journey: "journey-a", steps: [] },
				"2026-01-01T00:00:00Z",
				new Date("2026-01-01T00:00:00Z"),
				null,
				mockE2E,
				mockDeps,
			);

			expect(disk.writeFileSync).toHaveBeenCalledWith(
				expect.stringContaining("(Partial).md"),
				expect.any(String),
				"utf-8",
			);
		});

		it("copies screenshots from source to dev directory", () => {
			vi.mocked(disk.existsSync).mockImplementation((p: string) => {
				if (p === "/results/journey-a/screenshots") return true;
				return false;
			});
			vi.mocked(disk.readdirSync).mockImplementation((dir: string) => {
				if (dir === "/results/journey-a/screenshots") return ["step1.png", "step2.png"] as unknown as ReturnType<typeof disk.readdirSync>;
				if (dir === "/project/docs/journeys/Journey Test/screenshots") return ["old.png"] as unknown as ReturnType<typeof disk.readdirSync>;
				return [] as unknown as ReturnType<typeof disk.readdirSync>;
			});

			writeJourneyOutputs(
				"/results/journey-a",
				{ journey: "journey-a", steps: [] },
				"2026-01-01T00:00:00Z",
				new Date("2026-01-01T00:00:00Z"),
				null,
				mockE2E,
				mockDeps,
			);

			// Should remove stale screenshots
			expect(disk.rmSync).toHaveBeenCalledWith(
				"/project/docs/journeys/Journey Test/screenshots/old.png",
				{ force: true },
			);

			// Should copy new screenshots
			expect(disk.copyFileSync).toHaveBeenCalledWith(
				"/results/journey-a/screenshots/step1.png",
				"/project/docs/journeys/Journey Test/screenshots/step1.png",
			);
			expect(disk.copyFileSync).toHaveBeenCalledWith(
				"/results/journey-a/screenshots/step2.png",
				"/project/docs/journeys/Journey Test/screenshots/step2.png",
			);
		});
	});

	describe("generateE2EReport", () => {
		const mockE2E: E2EPaths = {
			projectRoot: "/project",
			pluginId: "flowti-ibde",
			journeysDir: "/project/tests/e2e/journeys",
			testVault: "/test-vault",
			vaultName: "flowti-e2e",
			pluginDir: "/test-vault/.obsidian/plugins/flowti-ibde",
			dataJsonPath: "/test-vault/.obsidian/plugins/flowti-ibde/data.json",
			pluginArtifacts: ["main.js", "manifest.json", "styles.css"],
			testDataCsv: "/test-vault/03 - Resources/Test Data/Analytics/Suppliers.csv",
			reportsDir: "/project/docs/reports",
			devRunsDir: "/project/docs/reports/e2e/runs",
			devTracesDir: "/project/docs/reports/e2e/traces",
			devJourneysDir: "/project/docs/journeys",
			vitestResults: "/project/docs/reports/e2e/e2e-results.json",
			dataJsonCandidates: ["/project/data.json"],
		};

		const mockClock = {
			now: () => new Date("2026-01-01T00:00:00Z"),
			iso: () => "2026-01-01T00:00:00.000Z",
			ms: () => 1000000,
			safeIso: () => "2026-01-01T00-00-00.000Z",
		};

		const fullDeps = { disk, paths, proc, clock: mockClock };

		it("returns early when no vitest results and no journeys", () => {
			vi.mocked(readVitestResults).mockReturnValue(null);
			vi.mocked(readJourneyResults).mockReturnValue([]);

			generateE2EReport(mockE2E, fullDeps);

			// Should not write any reports
			expect(disk.writeFileSync).not.toHaveBeenCalled();
			expect(buildE2EFrontmatter).not.toHaveBeenCalled();
		});

		it("generates full report when vitest results exist", () => {
			vi.mocked(readVitestResults).mockReturnValue({
				totalPassed: 10, totalFailed: 0, totalSkipped: 2, totalTests: 12,
				durationMs: 5000, suites: [],
			});
			vi.mocked(readJourneyResults).mockReturnValue([]);
			vi.mocked(reconcileResults).mockReturnValue(null);
			vi.mocked(disk.existsSync).mockReturnValue(false);

			generateE2EReport(mockE2E, fullDeps);

			// Should build frontmatter
			expect(buildE2EFrontmatter).toHaveBeenCalled();

			// Should write E2E Report.md to test vault
			expect(disk.writeFileSync).toHaveBeenCalledWith(
				"/test-vault/E2E Report.md",
				expect.any(String),
				"utf-8",
			);

			// Should write current report to project docs
			expect(disk.writeFileSync).toHaveBeenCalledWith(
				"/project/docs/reports/e2e/E2E Report.md",
				expect.any(String),
				"utf-8",
			);

			// Should archive report to runs directory
			expect(disk.writeFileSync).toHaveBeenCalledWith(
				expect.stringContaining("/project/docs/reports/e2e/runs/"),
				expect.any(String),
				"utf-8",
			);
		});

		it("generates journey reports when journeys exist", () => {
			vi.mocked(readVitestResults).mockReturnValue(null);
			vi.mocked(readJourneyResults).mockReturnValue([
				{ dir: "/results/journey-a", data: { journey: "journey-a", steps: [] } },
			]);
			vi.mocked(reconcileResults).mockReturnValue(null);
			vi.mocked(disk.existsSync).mockReturnValue(false);

			generateE2EReport(mockE2E, fullDeps);

			// Should generate a journey report
			expect(generateJourneyReport).toHaveBeenCalled();

			// Should build E2E summary frontmatter
			expect(buildE2EFrontmatter).toHaveBeenCalled();

			// Should write E2E Report.md
			expect(disk.writeFileSync).toHaveBeenCalledWith(
				"/test-vault/E2E Report.md",
				expect.any(String),
				"utf-8",
			);
		});

		it("cleans up result files after report generation", () => {
			vi.mocked(readVitestResults).mockReturnValue({
				totalPassed: 5, totalFailed: 0, totalSkipped: 0, totalTests: 5,
				durationMs: 1000, suites: [],
			});
			const journeys = [
				{ dir: "/results/journey-a", data: { journey: "journey-a", steps: [] } },
			];
			vi.mocked(readJourneyResults).mockReturnValue(journeys);
			vi.mocked(reconcileResults).mockReturnValue(null);
			vi.mocked(disk.existsSync).mockReturnValue(false);

			generateE2EReport(mockE2E, fullDeps);

			// Should attempt to remove journey result files
			expect(disk.rmSync).toHaveBeenCalledWith(
				"/results/journey-a/journey-a-results.json",
				{ force: true },
			);
		});
	});

	describe("collectFailedSteps (edge cases)", () => {
		it("handles journeys with undefined steps", () => {
			const journeyReportNames = [
				{ title: "Journey A", data: {} },
			];

			const result = collectFailedSteps(journeyReportNames);

			expect(result).toEqual([]);
		});

		it("handles journeys with null steps", () => {
			const journeyReportNames = [
				{ title: "Journey A", data: { steps: null } },
			];

			const result = collectFailedSteps(journeyReportNames);

			expect(result).toEqual([]);
		});
	});

	describe("computeReconciledTotals (edge cases)", () => {
		it("uses vitest durationMs when provided", () => {
			vi.mocked(reconcileResults).mockReturnValue({
				totalPassed: 10, totalFailed: 0, totalSkipped: 0, totalDev: 0, totalTests: 10, suites: [],
			});

			const vitest = {
				totalPassed: 10, totalFailed: 0, totalSkipped: 0, totalTests: 10,
				durationMs: 9999, suites: [],
			};

			const result = computeReconciledTotals(vitest, [], mockDeps);

			expect(result.totalDurationMs).toBe(9999);
		});

		it("defaults durationMs to 0 when vitest is null", () => {
			vi.mocked(reconcileResults).mockReturnValue(null);

			const result = computeReconciledTotals(null, [], mockDeps);

			expect(result.totalDurationMs).toBe(0);
		});

		it("detects journey warnings in steps", () => {
			vi.mocked(reconcileResults).mockReturnValue({
				totalPassed: 5, totalFailed: 0, totalSkipped: 0, totalDev: 0, totalTests: 5, suites: [],
			});

			const journeys = [
				{
					dir: "/results/journey-a",
					data: {
						journey: "journey-a",
						steps: [
							{ step: { id: "s1", guideSection: "setup", title: "Step 1" }, status: "pass", durationMs: 100, warnings: ["some warning"] },
						],
					},
				},
			];

			const vitest = {
				totalPassed: 5, totalFailed: 0, totalSkipped: 0, totalTests: 5,
				durationMs: 2000, suites: [],
			};

			const result = computeReconciledTotals(vitest, journeys, mockDeps);

			// resolveStatus is mocked, so we just confirm it was called
			expect(result.overallStatus).toBe("pass"); // mocked resolveStatus returns "pass"
		});
	});

	describe("aggregateJourneyStats (edge cases)", () => {
		it("handles single journey correctly", () => {
			const journeys = [
				{ dir: "/results/journey-a", data: { journey: "journey-a", steps: [] } },
			];

			const { aggregate, perJourney } = aggregateJourneyStats(journeys);

			expect(aggregate.total).toBe(10);
			expect(aggregate.screenshots).toBe(2);
			expect(perJourney.size).toBe(1);
			expect(perJourney.has("journey-a")).toBe(true);
		});
	});
});
