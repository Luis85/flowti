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

import type { ReportDeps } from "../../../../src/infrastructure/deps.js";
import { disk } from "../../../../src/infrastructure/filesystem.js";
import { paths } from "../../../../src/infrastructure/paths.js";
import { clock } from "../../../../src/infrastructure/clock.js";
import { generateCoverageReport } from "../../../../src/domain/reports/cli/generate-coverage-report.js";

const mockShell = { run: vi.fn(() => ({ stdout: "", stderr: "", exitCode: 0, success: true })) };
const mockDeps: ReportDeps = { disk, paths, clock, shell: mockShell as any, log: () => {} };

beforeEach(() => {
	vi.clearAllMocks();
});

describe("generateCoverageReport", () => {
	it("returns failure when coverage-final.json does not exist", () => {
		vi.mocked(disk.existsSync).mockReturnValue(false);

		const result = generateCoverageReport("/project", mockDeps);

		expect(result.success).toBe(false);
		expect(result.outputPath).toBe("");
	});

	it("generates report from valid coverage data", () => {
		vi.mocked(disk.existsSync).mockReturnValue(true);
		vi.mocked(disk.readFileSync).mockReturnValue(JSON.stringify({
			"/project/src/a.ts": {
				path: "/project/src/a.ts",
				s: { "0": 1, "1": 1, "2": 0 },
				b: { "0": [1, 0] },
				f: { "0": 1, "1": 0 },
			},
		}) as never);

		const result = generateCoverageReport("/project", mockDeps);

		expect(result.success).toBe(true);
		expect(result.outputPath).toBeTruthy();
		expect(result.metrics).toHaveProperty("statements");
		expect(result.metrics).toHaveProperty("branches");
		expect(result.metrics).toHaveProperty("functions");
		expect(result.metrics).toHaveProperty("files");
	});

	it("computes correct coverage percentages", () => {
		vi.mocked(disk.existsSync).mockReturnValue(true);
		vi.mocked(disk.readFileSync).mockReturnValue(JSON.stringify({
			"/project/src/a.ts": {
				path: "/project/src/a.ts",
				s: { "0": 1, "1": 1 },
				b: { "0": [1, 1] },
				f: { "0": 1 },
			},
		}) as never);

		const result = generateCoverageReport("/project", mockDeps);

		expect(result.metrics!.statements).toBe(100);
		expect(result.metrics!.branches).toBe(100);
		expect(result.metrics!.functions).toBe(100);
	});

	it("warns when statement coverage is below 80%", () => {
		vi.mocked(disk.existsSync).mockReturnValue(true);
		vi.mocked(disk.readFileSync).mockReturnValue(JSON.stringify({
			"/project/src/a.ts": {
				path: "/project/src/a.ts",
				s: { "0": 1, "1": 0, "2": 0, "3": 0 },
				b: {},
				f: {},
			},
		}) as never);

		const result = generateCoverageReport("/project", mockDeps);

		expect(result.warnings).toBeDefined();
		expect(result.warnings!.some(w => w.includes("Statement coverage"))).toBe(true);
	});

	it("warns when branch coverage is below 70%", () => {
		vi.mocked(disk.existsSync).mockReturnValue(true);
		vi.mocked(disk.readFileSync).mockReturnValue(JSON.stringify({
			"/project/src/a.ts": {
				path: "/project/src/a.ts",
				s: { "0": 1, "1": 1, "2": 1, "3": 1, "4": 1 },
				b: { "0": [1, 0], "1": [0, 0], "2": [0, 0] },
				f: { "0": 1 },
			},
		}) as never);

		const result = generateCoverageReport("/project", mockDeps);

		expect(result.warnings).toBeDefined();
		expect(result.warnings!.some(w => w.includes("Branch coverage"))).toBe(true);
	});

	it("handles empty coverage entries", () => {
		vi.mocked(disk.existsSync).mockReturnValue(true);
		vi.mocked(disk.readFileSync).mockReturnValue(JSON.stringify({}) as never);

		const result = generateCoverageReport("/project", mockDeps);

		expect(result.success).toBe(true);
		expect(result.metrics!.files).toBe(0);
	});

	it("handles entries with missing s/b/f fields", () => {
		vi.mocked(disk.existsSync).mockReturnValue(true);
		vi.mocked(disk.readFileSync).mockReturnValue(JSON.stringify({
			"/project/src/a.ts": {
				path: "/project/src/a.ts",
			},
		}) as never);

		const result = generateCoverageReport("/project", mockDeps);

		expect(result.success).toBe(true);
	});

	it("passes pipeline context log messages", () => {
		vi.mocked(disk.existsSync).mockReturnValue(true);
		vi.mocked(disk.readFileSync).mockReturnValue(JSON.stringify({}) as never);

		const logFn = vi.fn();
		const ctx = { log: logFn, projectPath: "/project", getResults: () => [], pushResult: vi.fn(), getStepResult: vi.fn(), setCommandOutput: vi.fn(), getCommandOutput: vi.fn(), setStepData: vi.fn(), getStepData: vi.fn() };

		generateCoverageReport("/project", mockDeps, ctx as any);

		expect(logFn).toHaveBeenCalled();
	});
});
