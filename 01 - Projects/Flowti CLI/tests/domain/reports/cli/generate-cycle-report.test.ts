import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../../src/infrastructure/filesystem.js", () => ({
	disk: {
		existsSync: vi.fn(() => true),
		readFileSync: vi.fn(() => "{}"),
		writeFileSync: vi.fn(),
		mkdirSync: vi.fn(),
		copyFileSync: vi.fn(),
		readdirSync: vi.fn(() => []),
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
	PLUGIN_ROOT: "/plugin",
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
vi.mock("../../../../src/infrastructure/frontmatter.js", () => ({
	parseFrontmatterContent: vi.fn(() => null),
}));

import type { ReportDeps } from "../../../../src/infrastructure/deps.js";
import { disk } from "../../../../src/infrastructure/filesystem.js";
import { paths } from "../../../../src/infrastructure/paths.js";
import { clock } from "../../../../src/infrastructure/clock.js";
import { parseFrontmatterContent } from "../../../../src/infrastructure/frontmatter.js";
import { generateCycleReport } from "../../../../src/domain/reports/cli/generate-cycle-report.js";

const mockShell = { run: vi.fn(() => ({ stdout: "", stderr: "", exitCode: 0, success: true })) };
const mockDeps: ReportDeps = { disk, paths, clock, shell: mockShell as any, log: () => {} };

beforeEach(() => {
	vi.clearAllMocks();
});

describe("generateCycleReport", () => {
	it("returns failure when cycles dir doesn't exist", () => {
		vi.mocked(disk.existsSync).mockReturnValue(false);

		const result = generateCycleReport("/project", mockDeps);

		expect(result.success).toBe(false);
		expect(result.outputPath).toBe("");
		expect((result as { error?: string }).error).toBeTruthy();
	});

	it("returns failure when no 'done' cycle found", () => {
		vi.mocked(disk.existsSync).mockReturnValue(true);
		vi.mocked(disk.readdirSync).mockReturnValue(["Cycle 10.md"] as any as never);
		vi.mocked(parseFrontmatterContent).mockReturnValue({ cycle: 10, stage: "in-progress" });

		const result = generateCycleReport("/project", mockDeps);

		expect(result.success).toBe(false);
		expect(result.outputPath).toBe("");
		expect((result as { error?: string }).error).toBeTruthy();
	});

	it("generates report from latest done cycle", () => {
		vi.mocked(disk.existsSync).mockReturnValue(true);
		vi.mocked(disk.readdirSync).mockReturnValue(["Cycle 5.md"] as any as never);
		vi.mocked(disk.readFileSync).mockReturnValue("---\ncycle: 5\nstage: done\n---" as never);
		vi.mocked(parseFrontmatterContent).mockReturnValue({
			cycle: 5,
			stage: "done",
			pre_cycle_tests: 1000,
			total_tests_after: 1050,
			pre_cycle_suites: 40,
			total_test_files_after: 42,
			actual_increments: 8,
			estimated_increments: 10,
			date_planned: "2026-01-01",
			date_completed: "2026-01-03",
			pbis: ["PBI-1", "PBI-2"],
			tech_debt: ["TD-1"],
		});

		const result = generateCycleReport("/project", mockDeps);

		expect(result.success).toBe(true);
		expect(result.outputPath).toBeTruthy();
		expect(result.metrics).toEqual(expect.objectContaining({
			cycle: 5,
			increments: 8,
			tests_added: 50,
			total_tests: 1050,
			pbis_delivered: 2,
		}));
	});

	it("picks highest cycle number when multiple done cycles exist", () => {
		vi.mocked(disk.existsSync).mockReturnValue(true);
		vi.mocked(disk.readdirSync).mockReturnValue(["Cycle 3.md", "Cycle 7.md", "Cycle 5.md"] as any as never);
		vi.mocked(disk.readFileSync).mockReturnValue("---\nstage: done\n---" as never);
		vi.mocked(parseFrontmatterContent).mockImplementation((content: string) => {
			if (content === "---\nstage: done\n---") {
				// Called three times, return cycle values matching file order
				return null;
			}
			return null;
		});

		// Return different frontmatter based on file path by using mockImplementation on readFileSync
		vi.mocked(disk.readFileSync).mockImplementation((filePath: string) => {
			if (String(filePath).includes("Cycle 3.md")) return "cycle3";
			if (String(filePath).includes("Cycle 7.md")) return "cycle7";
			if (String(filePath).includes("Cycle 5.md")) return "cycle5";
			return "{}";
		});
		vi.mocked(parseFrontmatterContent).mockImplementation((content: string) => {
			if (content === "cycle3") return { cycle: 3, stage: "done", pbis: [], tech_debt: [] };
			if (content === "cycle7") return { cycle: 7, stage: "done", pbis: [], tech_debt: [] };
			if (content === "cycle5") return { cycle: 5, stage: "done", pbis: [], tech_debt: [] };
			return null;
		});

		const result = generateCycleReport("/project", mockDeps);

		expect(result.success).toBe(true);
		expect(result.metrics?.cycle).toBe(7);
	});

	it("includes PBIs and tech debt in metrics", () => {
		vi.mocked(disk.existsSync).mockReturnValue(true);
		vi.mocked(disk.readdirSync).mockReturnValue(["Cycle 12.md"] as any as never);
		vi.mocked(disk.readFileSync).mockReturnValue("cycle12" as never);
		vi.mocked(parseFrontmatterContent).mockReturnValue({
			cycle: 12,
			stage: "done",
			pre_cycle_tests: 500,
			total_tests_after: 560,
			pre_cycle_suites: 20,
			total_test_files_after: 23,
			actual_increments: 6,
			estimated_increments: 6,
			pbis: ["PBI-A", "PBI-B", "PBI-C"],
			tech_debt: ["TD-X", "TD-Y"],
		});

		const result = generateCycleReport("/project", mockDeps);

		expect(result.success).toBe(true);
		expect(result.metrics?.pbis_delivered).toBe(3);
		expect(result.metrics?.tests_added).toBe(60);
		expect(result.metrics?.total_tests).toBe(560);
	});

	it("passes pipeline context log messages", () => {
		vi.mocked(disk.existsSync).mockReturnValue(true);
		vi.mocked(disk.readdirSync).mockReturnValue(["Cycle 1.md"] as any as never);
		vi.mocked(disk.readFileSync).mockReturnValue("cycle1" as never);
		vi.mocked(parseFrontmatterContent).mockReturnValue({
			cycle: 1,
			stage: "done",
			pbis: [],
			tech_debt: [],
		});

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

		generateCycleReport("/project", mockDeps, ctx as any);

		expect(logFn).toHaveBeenCalled();
	});
});
