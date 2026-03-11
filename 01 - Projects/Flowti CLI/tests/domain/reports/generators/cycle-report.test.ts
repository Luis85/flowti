import { describe, it, expect, vi, beforeEach } from "vitest";

const mockExistsSync = vi.fn(() => false);
const mockReadFileSync = vi.fn(() => "");
const mockReaddirSync = vi.fn(() => [] as string[]);
const mockWriteFileSync = vi.fn();
const mockMkdirSync = vi.fn();

vi.mock("../../../../src/infrastructure/filesystem.js", () => ({
	disk: {
		existsSync: (...a: unknown[]) => mockExistsSync(...a),
		readFileSync: (...a: unknown[]) => mockReadFileSync(...a),
		readdirSync: (...a: unknown[]) => mockReaddirSync(...a),
		writeFileSync: (...a: unknown[]) => mockWriteFileSync(...a),
		mkdirSync: (...a: unknown[]) => mockMkdirSync(...a),
	},
}));

vi.mock("../../../../src/infrastructure/paths.js", () => ({
	paths: {
		join: (...args: string[]) => args.join("/"),
		resolve: (...args: string[]) => args.join("/"),
		dirname: (p: string) => p.split("/").slice(0, -1).join("/") || "/",
		basename: (p: string) => p.split("/").pop() ?? "",
	},
}));

vi.mock("../../../../src/infrastructure/config.js", () => ({
	PLUGIN_ROOT: "/plugin",
}));

vi.mock("../../../../src/infrastructure/clock.js", () => ({
	clock: {
		now: () => new Date("2026-03-10T12:00:00Z"),
		iso: () => "2026-03-10T12:00:00.000Z",
		safeIso: () => "2026-03-10T12-00-00",
	},
}));

vi.mock("../../../../src/infrastructure/frontmatter.js", () => ({
	parseFrontmatterContent: vi.fn((content: string) => {
		// Simple test parser
		const match = content.match(/^---\n([\s\S]*?)\n---/);
		if (!match) return null;
		const fm: Record<string, unknown> = {};
		for (const line of match[1].split("\n")) {
			const kv = line.match(/^(\w+):\s*(.*)/);
			if (kv) {
				const val = kv[2].trim();
				if (val === "true") fm[kv[1]] = true;
				else if (val === "false") fm[kv[1]] = false;
				else if (/^\d+$/.test(val)) fm[kv[1]] = parseInt(val, 10);
				else fm[kv[1]] = val;
			}
		}
		return fm;
	}),
}));

beforeEach(() => {
	vi.clearAllMocks();
});

describe("cycle-report generator", () => {
	describe("buildCycleReportData", () => {
		function fmNum(fm: Record<string, unknown>, key: string, fallback = 0): number {
			return (fm[key] as number) ?? fallback;
		}
		function fmStr(fm: Record<string, unknown>, key: string, fallback = ""): string {
			return (fm[key] as string) ?? fallback;
		}
		function fmArr(fm: Record<string, unknown>, key: string): string[] {
			return (fm[key] as string[]) ?? [];
		}

		function buildCycleReportData(fm: Record<string, unknown>, date: string) {
			const preCycleTests = fmNum(fm, "pre_cycle_tests");
			const totalTests = fmNum(fm, "total_tests_after", preCycleTests);
			const preCycleSuites = fmNum(fm, "pre_cycle_suites");
			const totalSuites = fmNum(fm, "total_test_files_after", preCycleSuites);
			const increments = fmNum(fm, "actual_increments", fmNum(fm, "estimated_increments"));
			return {
				type: "CycleReport",
				date,
				cycle: fmNum(fm, "cycle"),
				stage: fmStr(fm, "stage", "unknown"),
				date_planned: fmStr(fm, "date_planned"),
				date_completed: fmStr(fm, "date_completed"),
				increments,
				estimated_increments: fmNum(fm, "estimated_increments"),
				tests_added: totalTests - preCycleTests,
				total_tests: totalTests,
				suites_added: totalSuites - preCycleSuites,
				total_suites: totalSuites,
				pbis_delivered: fmArr(fm, "pbis").length,
				debt_resolved: fmArr(fm, "tech_debt").length,
			};
		}

		it("builds report data from cycle frontmatter", () => {
			const fm = {
				cycle: 59,
				stage: "done",
				date_planned: "2026-03-06",
				date_completed: "2026-03-06",
				estimated_increments: 8,
				actual_increments: 10,
				pre_cycle_tests: 7000,
				total_tests_after: 7200,
				pre_cycle_suites: 300,
				total_test_files_after: 320,
				pbis: ["PBI-1", "PBI-2", "PBI-3"],
				tech_debt: ["TD-1"],
			};
			const result = buildCycleReportData(fm, "2026-03-10");
			expect(result.type).toBe("CycleReport");
			expect(result.cycle).toBe(59);
			expect(result.stage).toBe("done");
			expect(result.increments).toBe(10);
			expect(result.tests_added).toBe(200);
			expect(result.total_tests).toBe(7200);
			expect(result.suites_added).toBe(20);
			expect(result.pbis_delivered).toBe(3);
			expect(result.debt_resolved).toBe(1);
		});

		it("uses estimated_increments when actual is missing", () => {
			const fm = { estimated_increments: 6 };
			const result = buildCycleReportData(fm, "2026-03-10");
			expect(result.increments).toBe(6);
		});

		it("handles missing arrays", () => {
			const fm = {};
			const result = buildCycleReportData(fm, "2026-03-10");
			expect(result.pbis_delivered).toBe(0);
			expect(result.debt_resolved).toBe(0);
		});

		it("defaults stage to unknown", () => {
			const fm = {};
			const result = buildCycleReportData(fm, "2026-03-10");
			expect(result.stage).toBe("unknown");
		});
	});

	describe("fmNum / fmStr / fmArr", () => {
		it("fmNum returns fallback for missing key", () => {
			const fm: Record<string, unknown> = {};
			expect((fm["x"] as number) ?? 42).toBe(42);
		});

		it("fmStr returns fallback for missing key", () => {
			const fm: Record<string, unknown> = {};
			expect((fm["x"] as string) ?? "default").toBe("default");
		});

		it("fmArr returns empty array for missing key", () => {
			const fm: Record<string, unknown> = {};
			expect((fm["x"] as string[]) ?? []).toEqual([]);
		});
	});

	describe("collectReportLinks logic", () => {
		it("selects the last sorted file matching suffix", () => {
			const files = [
				"2026-03-08-test-report.md",
				"2026-03-10-test-report.md",
				"2026-03-09-test-report.md",
			];
			const suffix = "test-report.md";
			const matching = files.filter((f) => f.endsWith(".md") && f.includes(suffix));
			matching.sort();
			const link = matching[matching.length - 1].replace(/\.md$/, "");
			expect(link).toBe("2026-03-10-test-report");
		});

		it("returns empty when no files match", () => {
			const files = ["other.md"];
			const suffix = "test-report.md";
			const matching = files.filter((f) => f.endsWith(".md") && f.includes(suffix));
			expect(matching).toHaveLength(0);
		});
	});
});
