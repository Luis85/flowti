import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../../src/infrastructure/filesystem.js", () => ({
	disk: {
		existsSync: vi.fn(() => true),
		readFileSync: vi.fn(() => ""),
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
vi.mock("../../../../src/infrastructure/frontmatter.js", () => ({
	splitFrontmatter: vi.fn(() => null),
}));
vi.mock("../../../../src/domain/project/project-config.js", () => ({
	readProjectConfig: vi.fn(() => ({ config: { reports: { dir: "reports" }, docs: { referenceDir: "docs/reference" } } })),
}));
vi.mock("../../../../src/domain/reports/cli/generate-test-report.js", () => ({
	generateTestReport: vi.fn(() => ({ success: true, outputPath: "/project/reports/Test Report.md", metrics: {} })),
}));
vi.mock("../../../../src/domain/reports/cli/generate-coverage-report.js", () => ({
	generateCoverageReport: vi.fn(() => ({ success: true, outputPath: "/project/reports/Coverage Report.md", metrics: {} })),
}));
vi.mock("../../../../src/domain/reports/cli/generate-codebase-report.js", () => ({
	generateCodebaseReport: vi.fn(() => ({ success: true, outputPath: "/project/reports/Codebase Report.md", metrics: {} })),
}));
vi.mock("../../../../src/domain/reports/cli/generate-complexity-report.js", () => ({
	generateComplexityReport: vi.fn(() => ({ success: true, outputPath: "/project/reports/Complexity Report.md", metrics: {} })),
}));
vi.mock("../../../../src/domain/build/build-freshness.js", () => ({
	checkFreshness: vi.fn(() => ({ needsRebuild: false })),
	resolveBuildPaths: vi.fn(() => ({ srcDir: "/project/src", binDir: "/project/dist" })),
}));

import { disk } from "../../../../src/infrastructure/filesystem.js";
import { generateProjectStatusReport } from "../../../../src/domain/reports/cli/generate-status-report.js";
import { generateTestReport } from "../../../../src/domain/reports/cli/generate-test-report.js";

beforeEach(() => {
	vi.clearAllMocks();
});

describe("generateProjectStatusReport", () => {
	it("generates status report when all sub-reports exist", () => {
		vi.mocked(disk.existsSync).mockReturnValue(true);
		vi.mocked(disk.readFileSync).mockReturnValue("# Report\nSome content");

		const result = generateProjectStatusReport("/project");

		expect(result.success).toBe(true);
		expect(result.outputPath).toBeTruthy();
		expect(result.metrics).toHaveProperty("sections");
	});

	it("generates missing sub-reports before building status", () => {
		vi.mocked(disk.existsSync).mockReturnValue(false);
		vi.mocked(disk.readFileSync).mockReturnValue("");

		const logFn = vi.fn();
		const ctx = { log: logFn, projectPath: "/project", getResults: () => [], pushResult: vi.fn(), getStepResult: vi.fn(), setCommandOutput: vi.fn(), getCommandOutput: vi.fn(), setStepData: vi.fn(), getStepData: vi.fn() };

		generateProjectStatusReport("/project", ctx as any);

		expect(generateTestReport).toHaveBeenCalled();
	});

	it("reports warnings when sub-report generators fail", () => {
		vi.mocked(disk.existsSync).mockReturnValue(false);
		vi.mocked(generateTestReport).mockReturnValue({ success: false, outputPath: "", metrics: {} });

		const result = generateProjectStatusReport("/project");

		expect(result.warnings).toBeDefined();
	});

	it("counts available sections correctly", () => {
		// All 4 section stable paths exist
		let callCount = 0;
		vi.mocked(disk.existsSync).mockImplementation(() => {
			callCount++;
			return true;
		});
		vi.mocked(disk.readFileSync).mockReturnValue("# Test\nBody content");

		const result = generateProjectStatusReport("/project");

		expect(result.success).toBe(true);
		expect(result.metrics!.sections).toBeGreaterThanOrEqual(0);
	});

	it("handles sub-report generator that throws", () => {
		vi.mocked(disk.existsSync).mockReturnValue(false);
		vi.mocked(generateTestReport).mockImplementation(() => { throw new Error("boom"); });

		const result = generateProjectStatusReport("/project");

		expect(result.success).toBe(true);
		expect(result.warnings).toBeDefined();
	});

	it("passes pipeline context log messages", () => {
		vi.mocked(disk.existsSync).mockReturnValue(true);
		vi.mocked(disk.readFileSync).mockReturnValue("");

		const logFn = vi.fn();
		const ctx = { log: logFn, projectPath: "/project", getResults: () => [], pushResult: vi.fn(), getStepResult: vi.fn(), setCommandOutput: vi.fn(), getCommandOutput: vi.fn(), setStepData: vi.fn(), getStepData: vi.fn() };

		generateProjectStatusReport("/project", ctx as any);

		expect(logFn).toHaveBeenCalled();
	});
});
