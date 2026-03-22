import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/infrastructure/logger.js", () => ({ log: vi.fn() }));
vi.mock("../../../src/infrastructure/ui.js", () => ({
	RESET: "", BOLD: "", DIM: "", GREEN: "", RED: "", YELLOW: "", CYAN: "",
}));

import { log } from "../../../src/infrastructure/logger.js";
import {
	displayHealth,
	formatTrendLine,
	renderHealthDashboard,
	renderSnapshotSaved,
	renderHealthHistory,
	renderDebtEstimate,
} from "../../../src/ui/displays/health-display.js";
import type { HealthSnapshot } from "../../../src/domain/health/health.js";

const mockLog = log as ReturnType<typeof vi.fn>;
const output = () => mockLog.mock.calls.map((c: unknown[]) => c[0] ?? "").join("\n");

beforeEach(() => {
	vi.clearAllMocks();
});

const baseSnapshot: HealthSnapshot = {
	name: "test-project",
	components: 10,
	source: { files: 50, testFiles: 30 },
	tests: { total: 100, passed: 98, failed: 2, suites: 10 },
	coverage: { lines: 85.2, branches: 72.0, functions: 90.1 },
	build: { success: true, durationMs: 3500 },
	lint: { errors: 0, warnings: 2 },
	security: { total: 3, critical: 0, high: 0, moderate: 2, low: 1, info: 0 },
	git: { branch: "main", status: "clean" },
};

describe("displayHealth", () => {
	it("renders project name", () => {
		displayHealth(baseSnapshot, log);
		expect(output()).toContain("test-project");
	});

	it("renders test stats", () => {
		displayHealth(baseSnapshot, log);
		const out = output();
		expect(out).toContain("100");
		expect(out).toContain("10 suites");
		expect(out).toContain("98");
	});

	it("renders failed test count when > 0", () => {
		displayHealth(baseSnapshot, log);
		expect(output()).toContain("2");
	});

	it("renders coverage percentages", () => {
		displayHealth(baseSnapshot, log);
		const out = output();
		expect(out).toContain("85.2%");
		expect(out).toContain("72.0%");
		expect(out).toContain("90.1%");
	});

	it("renders build duration", () => {
		displayHealth(baseSnapshot, log);
		expect(output()).toContain("3.5s");
	});

	it("renders lint stats", () => {
		displayHealth(baseSnapshot, log);
		const out = output();
		expect(out).toContain("Errors");
		expect(out).toContain("Warnings");
	});

	it("renders security metrics", () => {
		displayHealth(baseSnapshot, log);
		expect(output()).toContain("Vulnerabilities");
	});

	it("renders git info", () => {
		displayHealth(baseSnapshot, log);
		const out = output();
		expect(out).toContain("main");
		expect(out).toContain("clean");
	});

	it("renders summary indicators", () => {
		displayHealth(baseSnapshot, log);
		expect(output()).toContain("Summary");
	});

	it("shows no-data message when all sections missing", () => {
		displayHealth({ name: "empty", components: 0 } as HealthSnapshot, log);
		expect(output()).toContain("No report data found");
	});

	it("renders dirty git status", () => {
		displayHealth({ ...baseSnapshot, git: { branch: "dev", status: "dirty" } }, log);
		expect(output()).toContain("dirty");
	});

	it("renders security with critical/high counts", () => {
		displayHealth({
			...baseSnapshot,
			security: { total: 5, critical: 1, high: 2, moderate: 1, low: 1, info: 0 },
		}, log);
		const out = output();
		expect(out).toContain("Critical");
		expect(out).toContain("High");
	});
});

describe("formatTrendLine", () => {
	it("formats trend deltas", () => {
		const result = formatTrendLine([
			{ metric: "tests.passed", delta: 5, indicator: "▲", previous: 93, current: 98 },
			{ metric: "coverage.lines", delta: -2.3, indicator: "▼", previous: 87.5, current: 85.2 },
		]);
		expect(result).toContain("+5");
		expect(result).toContain("-2.3");
	});

	it("limits to 5 entries", () => {
		const deltas = Array.from({ length: 10 }, (_, i) => ({
			metric: `m.${i}`,
			delta: i,
			indicator: "▲" as const,
			previous: 0,
			current: i,
		}));
		const result = formatTrendLine(deltas);
		const parts = result.split("  ");
		expect(parts.length).toBeLessThanOrEqual(5);
	});

	it("handles zero delta", () => {
		const result = formatTrendLine([
			{ metric: "tests.total", delta: 0, indicator: "=", previous: 50, current: 50 },
		]);
		expect(result).toContain("0");
	});
});

describe("renderHealthDashboard", () => {
	it("renders score and grade", () => {
		renderHealthDashboard({
			...baseSnapshot,
			score: { overall: 85, grade: "B+" },
			trend: [],
		} as never, log);
		const out = output();
		expect(out).toContain("85/100");
		expect(out).toContain("B+");
	});

	it("renders trend when present", () => {
		renderHealthDashboard({
			...baseSnapshot,
			score: { overall: 90, grade: "A" },
			trend: [{ metric: "tests.passed", delta: 10, indicator: "▲", previous: 88, current: 98 }],
		} as never, log);
		expect(output()).toContain("Trend");
	});
});

describe("renderSnapshotSaved", () => {
	it("renders saved path", () => {
		renderSnapshotSaved({ relativePath: "snapshots/2026-03-10.json" }, log);
		expect(output()).toContain("snapshots/2026-03-10.json");
	});
});

describe("renderHealthHistory", () => {
	it("renders empty message when no snapshots", () => {
		renderHealthHistory([], log);
		expect(output()).toContain("No health snapshots found");
	});

	it("renders snapshot entries", () => {
		renderHealthHistory([
			{
				timestamp: "2026-03-10T12:00:00Z",
				score: { overall: 85, grade: "B+" },
				snapshot: { ...baseSnapshot },
			} as never,
		], log);
		const out = output();
		expect(out).toContain("2026-03-10");
		expect(out).toContain("B+");
		expect(out).toContain("85/100");
	});

	it("shows overflow message for >10 entries", () => {
		const entries = Array.from({ length: 15 }, (_, i) => ({
			timestamp: `2026-03-${String(i + 1).padStart(2, "0")}T12:00:00Z`,
			score: { overall: 80, grade: "B" },
			snapshot: baseSnapshot,
		}));
		renderHealthHistory(entries as never, log);
		expect(output()).toContain("and 5 more");
	});

	it("uses singular for 1 snapshot", () => {
		renderHealthHistory([{
			timestamp: "2026-03-10T12:00:00Z",
			score: { overall: 85, grade: "B+" },
			snapshot: baseSnapshot,
		} as never], log);
		expect(output()).toContain("1 snapshot)");
	});
});

describe("renderDebtEstimate", () => {
	it("renders clean message when no items", () => {
		renderDebtEstimate({ items: [], totalHours: 0, summary: "No tech debt found" }, log);
		expect(output()).toContain("No tech debt found");
	});

	it("renders debt items with severity", () => {
		renderDebtEstimate({
			items: [
				{ category: "Testing", description: "Low coverage", severity: "high", estimatedHours: 4 },
				{ category: "Deps", description: "Outdated packages", severity: "medium", estimatedHours: 2 },
			],
			totalHours: 6,
			summary: "6 hours estimated",
		}, log);
		const out = output();
		expect(out).toContain("Testing");
		expect(out).toContain("Low coverage");
		expect(out).toContain("~4h");
		expect(out).toContain("~6h");
	});
});
