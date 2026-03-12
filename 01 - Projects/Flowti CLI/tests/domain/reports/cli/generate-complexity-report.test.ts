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
	readProjectConfig: vi.fn(() => ({ config: { reports: { dir: "reports" }, docs: { referenceDir: "docs/reference" } } })),
}));
vi.mock("../../../../src/domain/devtools/run-analysis.js", () => ({
	generateAnalysisData: vi.fn(),
}));

import type { ReportDeps } from "../../../../src/infrastructure/deps.js";
import { disk } from "../../../../src/infrastructure/filesystem.js";
import { paths } from "../../../../src/infrastructure/paths.js";
import { clock } from "../../../../src/infrastructure/clock.js";
import { generateComplexityReport } from "../../../../src/domain/reports/cli/generate-complexity-report.js";

const mockShell = { run: vi.fn(() => ({ stdout: "", stderr: "", exitCode: 0, success: true })) };
const mockDeps: ReportDeps = { disk, paths, clock, shell: mockShell as any, log: () => {} };

beforeEach(() => {
	vi.clearAllMocks();
});

describe("generateComplexityReport", () => {
	it("returns failure when analysis.json does not exist", () => {
		vi.mocked(disk.existsSync).mockReturnValue(false);

		const result = generateComplexityReport("/project", mockDeps);

		expect(result.success).toBe(false);
		expect(result.outputPath).toBe("");
	});

	it("generates report from valid analysis data", () => {
		const data = {
			summary: {
				totalDecisionPoints: 42,
				filesWithDecisionPoints: 5,
				statements: 85.5,
				branches: 72.3,
				functions: 90.1,
				lines: 88.0,
			},
			files: [
				{
					file: "/project/src/main.ts",
					decisionPointCount: 10,
					decisionPoints: [
						{ line: 5, type: "if", functionLine: 1 },
						{ line: 10, type: "switch", functionLine: 1 },
					],
					statements: 90,
					branches: 80,
					functions: 100,
				},
			],
		};
		vi.mocked(disk.existsSync).mockReturnValue(true);
		vi.mocked(disk.readFileSync).mockReturnValue(JSON.stringify(data));

		const result = generateComplexityReport("/project", mockDeps);

		expect(result.success).toBe(true);
		expect(result.outputPath).toBeTruthy();
		expect(result.metrics).toEqual(expect.objectContaining({
			totalDecisionPoints: 42,
			filesWithDecisionPoints: 5,
		}));
	});

	it("warns about high complexity files exceeding threshold", () => {
		const data = {
			summary: { totalDecisionPoints: 55, filesWithDecisionPoints: 1 },
			files: [
				{ file: "/project/src/complex.ts", decisionPointCount: 55, decisionPoints: [] },
			],
		};
		vi.mocked(disk.existsSync).mockReturnValue(true);
		vi.mocked(disk.readFileSync).mockReturnValue(JSON.stringify(data));

		const result = generateComplexityReport("/project", mockDeps);

		expect(result.warnings).toBeDefined();
		expect(result.warnings![0]).toContain("exceed complexity threshold");
	});

	it("has no warnings when all files are below threshold", () => {
		const data = {
			summary: { totalDecisionPoints: 10, filesWithDecisionPoints: 2 },
			files: [
				{ file: "/project/src/a.ts", decisionPointCount: 5, decisionPoints: [] },
				{ file: "/project/src/b.ts", decisionPointCount: 5, decisionPoints: [] },
			],
		};
		vi.mocked(disk.existsSync).mockReturnValue(true);
		vi.mocked(disk.readFileSync).mockReturnValue(JSON.stringify(data));

		const result = generateComplexityReport("/project", mockDeps);

		expect(result.warnings).toBeUndefined();
	});

	it("filters out bin/ files from source files", () => {
		const data = {
			summary: { totalDecisionPoints: 5, filesWithDecisionPoints: 2 },
			files: [
				{ file: "/project/bin/cli.js", decisionPointCount: 3, decisionPoints: [] },
				{ file: "/project/src/main.ts", decisionPointCount: 2, decisionPoints: [] },
			],
		};
		vi.mocked(disk.existsSync).mockReturnValue(true);
		vi.mocked(disk.readFileSync).mockReturnValue(JSON.stringify(data));

		const result = generateComplexityReport("/project", mockDeps);

		expect(result.success).toBe(true);
	});

	it("handles data without coverage info", () => {
		const data = {
			summary: { totalDecisionPoints: 3, filesWithDecisionPoints: 1 },
			files: [
				{ file: "/project/src/a.ts", decisionPointCount: 3, decisionPoints: [] },
			],
		};
		vi.mocked(disk.existsSync).mockReturnValue(true);
		vi.mocked(disk.readFileSync).mockReturnValue(JSON.stringify(data));

		const result = generateComplexityReport("/project", mockDeps);

		expect(result.success).toBe(true);
	});

	it("adds low coverage section for files below 50%", () => {
		const data = {
			summary: {
				totalDecisionPoints: 5,
				filesWithDecisionPoints: 1,
				statements: 40,
				branches: 30,
				functions: 50,
				lines: 45,
			},
			files: [
				{
					file: "/project/src/a.ts",
					decisionPointCount: 5,
					decisionPoints: [],
					statements: 30,
					branches: 20,
					functions: 40,
				},
			],
		};
		vi.mocked(disk.existsSync).mockReturnValue(true);
		vi.mocked(disk.readFileSync).mockReturnValue(JSON.stringify(data));

		const result = generateComplexityReport("/project", mockDeps);

		expect(result.success).toBe(true);
	});

	it("passes pipeline context log messages", () => {
		const data = {
			summary: { totalDecisionPoints: 1, filesWithDecisionPoints: 1 },
			files: [{ file: "/project/src/a.ts", decisionPointCount: 1, decisionPoints: [] }],
		};
		vi.mocked(disk.existsSync).mockReturnValue(true);
		vi.mocked(disk.readFileSync).mockReturnValue(JSON.stringify(data));

		const logFn = vi.fn();
		const ctx = { log: logFn, projectPath: "/project", getResults: () => [], pushResult: vi.fn(), getStepResult: vi.fn(), setCommandOutput: vi.fn(), getCommandOutput: vi.fn(), setStepData: vi.fn(), getStepData: vi.fn() };

		generateComplexityReport("/project", mockDeps, ctx as any);

		expect(logFn).toHaveBeenCalled();
	});
});
