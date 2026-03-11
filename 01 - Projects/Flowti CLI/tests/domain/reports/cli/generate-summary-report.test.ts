import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../../src/infrastructure/filesystem.js", () => ({
	disk: {
		existsSync: vi.fn(() => true),
		readFileSync: vi.fn(() => "{}"),
		writeFileSync: vi.fn(),
		mkdirSync: vi.fn(),
		copyFileSync: vi.fn(),
	},
}));
vi.mock("../../../../src/infrastructure/paths.js", () => ({
	paths: {
		join: (...args: string[]) => args.join("/"),
		basename: (p: string) => p.split("/").pop() || "",
		resolve: (...args: string[]) => args.join("/"),
		dirname: (p: string) => p.split("/").slice(0, -1).join("/"),
	},
}));
vi.mock("../../../../src/infrastructure/config.js", () => ({
	CLI_PROJECT: "/project",
}));
vi.mock("../../../../src/infrastructure/clock.js", () => ({
	clock: {
		iso: () => "2026-01-01T00:00:00.000Z",
		ms: () => 1000000,
		now: () => new Date("2026-01-01T00:00:00.000Z"),
		safeIso: () => "2026-01-01T00-00-00.000Z",
	},
}));
vi.mock("../../../../src/domain/project/project-config.js", () => ({
	readProjectConfig: vi.fn(() => ({ config: { reports: { dir: "reports", thresholds: {} }, docs: { referenceDir: "docs/reference" } } })),
}));
vi.mock("../../../../src/domain/reports/cli/summary-loaders.js", () => ({
	resolveThresholds: vi.fn(() => ({
		coverageLines: 80,
		coverageBranches: 70,
		maxComplexity: 15,
		complexityAboveThresholdPct: 5,
		startupMs: 5000,
		eslintWarnings: 0,
		lintCommand: undefined,
		typedocCommand: undefined,
		typedocWarnings: 0,
	})),
	discoverReports: vi.fn(() => []),
	loadJsonDataSources: vi.fn(() => ({ tests: null, coverage: null })),
	loadDetailedSources: vi.fn(() => ({ perFile: [], complexity: null, perDomain: [] })),
	collectLintWarnings: vi.fn(() => ({ errors: 0, warnings: 0, breakdown: {}, issues: [] })),
	collectTypedocWarnings: vi.fn(() => ({ errors: 0, warnings: 0, issues: [] })),
}));
vi.mock("../../../../src/domain/reports/cli/summary-analyzers-ext.js", () => ({
	analyzeReports: vi.fn(() => []),
}));
vi.mock("../../../../src/domain/reports/cli/summary-renderers.js", () => ({
	promoteFrontmatter: vi.fn(() => ({})),
	renderOverview: vi.fn(),
	renderRisks: vi.fn(),
	renderImprovements: vi.fn(),
	renderWarnings: vi.fn(),
	renderDomainMetrics: vi.fn(),
	renderTopFilesByLoc: vi.fn(),
}));
vi.mock("../../../../src/domain/reports/cli/summary-formatters.js", () => ({
	n: vi.fn((v: number) => String(v)),
	d: vi.fn(() => "Jan 1, 2026"),
}));

import type { ReportDeps } from "../../../../src/infrastructure/deps.js";
import { disk } from "../../../../src/infrastructure/filesystem.js";
import { paths } from "../../../../src/infrastructure/paths.js";
import { clock } from "../../../../src/infrastructure/clock.js";
import { discoverReports, loadJsonDataSources, loadDetailedSources } from "../../../../src/domain/reports/cli/summary-loaders.js";
import { analyzeReports } from "../../../../src/domain/reports/cli/summary-analyzers-ext.js";
import { generateSummaryReport } from "../../../../src/domain/reports/cli/generate-summary-report.js";

const mockShell = { run: vi.fn(() => ({ stdout: "", stderr: "", exitCode: 0, success: true })) };
const mockDeps: ReportDeps = { disk, paths, clock, shell: mockShell as any, log: () => {} };

beforeEach(() => {
	vi.clearAllMocks();
});

describe("generateSummaryReport", () => {
	it("generates summary report with no reports found", () => {
		vi.mocked(discoverReports).mockReturnValue([]);

		const result = generateSummaryReport("/project", mockDeps);

		expect(result.success).toBe(true);
		expect(result.outputPath).toBeTruthy();
		expect(result.metrics).toEqual(expect.objectContaining({ reportsAnalyzed: 0 }));
	});

	it("warns when no reports found", () => {
		vi.mocked(discoverReports).mockReturnValue([]);

		const result = generateSummaryReport("/project", mockDeps);

		expect(result.warnings).toBeDefined();
		expect(result.warnings!.some(w => w.includes("No reports found"))).toBe(true);
	});

	it("generates summary with discovered reports", () => {
		vi.mocked(discoverReports).mockReturnValue([
			{ label: "Test", file: "Test Report.md", frontmatter: { type: "TestReport" } },
			{ label: "Coverage", file: "Coverage Report.md", frontmatter: { type: "CoverageReport" } },
		]);

		const result = generateSummaryReport("/project", mockDeps);

		expect(result.success).toBe(true);
		expect(result.metrics!.reportsAnalyzed).toBe(2);
	});

	it("reports risks from findings", () => {
		vi.mocked(discoverReports).mockReturnValue([
			{ label: "Test", file: "Test Report.md", frontmatter: {} },
		]);
		vi.mocked(analyzeReports).mockReturnValue([
			{ category: "risk", message: "Coverage too low" },
			{ category: "risk", message: "Tests failing" },
			{ category: "improvement", message: "Add more tests" },
		]);

		const result = generateSummaryReport("/project", mockDeps);

		expect(result.metrics!.risks).toBe(2);
		expect(result.metrics!.improvements).toBe(1);
		expect(result.warnings).toBeDefined();
		expect(result.warnings!.some(w => w.includes("2 risk(s)"))).toBe(true);
	});

	it("writes stable and timestamped markdown plus JSON", () => {
		vi.mocked(discoverReports).mockReturnValue([]);

		generateSummaryReport("/project", mockDeps);

		// Should call writeFileSync for JSON
		expect(disk.writeFileSync).toHaveBeenCalled();
		// Should call mkdirSync for directory creation
		expect(disk.mkdirSync).toHaveBeenCalled();
	});

	it("includes generator run results from pipeline context", () => {
		vi.mocked(discoverReports).mockReturnValue([]);

		const ctx = {
			log: vi.fn(),
			projectPath: "/project",
			getResults: () => [
				{ id: "test", label: "Test", success: true, durationMs: 100, output: null },
				{ id: "coverage", label: "Coverage", success: false, durationMs: 200, output: null, error: "no data" },
			],
			pushResult: vi.fn(),
			getStepResult: vi.fn(),
			setCommandOutput: vi.fn(),
			getCommandOutput: vi.fn(),
			setStepData: vi.fn(),
			getStepData: vi.fn(),
		};

		const result = generateSummaryReport("/project", mockDeps, ctx as any);

		expect(result.success).toBe(true);
	});

	it("passes pipeline context log messages", () => {
		vi.mocked(discoverReports).mockReturnValue([]);

		const logFn = vi.fn();
		const ctx = {
			log: logFn,
			projectPath: "/project",
			getResults: () => [],
			pushResult: vi.fn(),
			getStepResult: vi.fn(),
			setCommandOutput: vi.fn(),
			getCommandOutput: vi.fn(),
			setStepData: vi.fn(),
			getStepData: vi.fn(),
		};

		generateSummaryReport("/project", mockDeps, ctx as any);

		expect(logFn).toHaveBeenCalled();
	});

	it("has no risk warnings when findings are all positive", () => {
		vi.mocked(discoverReports).mockReturnValue([
			{ label: "Test", file: "Test Report.md", frontmatter: {} },
		]);
		vi.mocked(analyzeReports).mockReturnValue([
			{ category: "positive", message: "All tests passing" },
		]);

		const result = generateSummaryReport("/project", mockDeps);

		expect(result.metrics!.risks).toBe(0);
		expect(result.metrics!.positives).toBe(1);
	});
});
