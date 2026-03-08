import { describe, it, expect, vi } from "vitest";

vi.mock("../../../../../src/infrastructure/filesystem.js", () => ({
	disk: { existsSync: vi.fn(() => false), readFileSync: vi.fn(() => ""), mkdirSync: vi.fn(), writeFileSync: vi.fn(), readdirSync: vi.fn(() => []), rmSync: vi.fn(), copyFileSync: vi.fn() },
}));
vi.mock("../../../../../src/infrastructure/paths.js", () => ({
	paths: { join: (...args: string[]) => args.join("/"), relative: (from: string, to: string) => to, sep: "/" },
}));
vi.mock("../../../../../src/infrastructure/logger.js", () => ({ log: vi.fn() }));
vi.mock("../../../../../src/infrastructure/clock.js", () => ({
	clock: { iso: () => "2026-01-01T00:00:00Z", now: () => new Date("2026-01-01T00:00:00Z"), ms: () => 1000000 },
}));
vi.mock("../../../../../src/infrastructure/config.js", () => ({ PLUGIN_ROOT: "/mock" }));

import {
	collectFailedSteps,
	aggregateJourneyStats,
} from "../../../../../src/domain/reports/generators/e2e/e2e-report-summary.js";
import {
	collectVitestFailures,
	collectWarningItBlocks,
	caseMarkAndSuffix,
	buildCompactTraceLines,
	buildJourneyStatsLine,
	resolveJourneyStatus,
} from "../../../../../src/domain/reports/generators/e2e/e2e-report-sections.js";
import type { ErrorContext, StepResult, VitestResults } from "../../../../../src/domain/reports/generators/e2e/e2e-report-types.js";

// ── caseMarkAndSuffix ───────────────────────────────────────────────

describe("caseMarkAndSuffix", () => {
	it("returns checked mark for passed", () => {
		const { mark } = caseMarkAndSuffix("passed", "test", new Set(), false);
		expect(mark).toBe("[x]");
	});

	it("returns warning mark when passed with warnings", () => {
		const { mark } = caseMarkAndSuffix("passed", "some test", new Set(["some test"]), false);
		expect(mark).toBe("[~]");
	});

	it("returns fail mark for failed", () => {
		const { mark } = caseMarkAndSuffix("failed", "test", new Set(), false);
		expect(mark).toBe("[!]");
	});

	it("returns skip mark for skipped", () => {
		const { mark, suffix } = caseMarkAndSuffix("skipped", "test", new Set(), false);
		expect(mark).toBe("[-]");
		expect(suffix).toContain("Skipped");
	});

	it("returns dev mark for dev", () => {
		const { mark, suffix } = caseMarkAndSuffix("dev", "test", new Set(), false);
		expect(mark).toBe("[-]");
		expect(suffix).toContain("Dev");
	});

	it("returns empty mark for unknown when hook failed", () => {
		const { mark } = caseMarkAndSuffix("pending", "test", new Set(), true);
		expect(mark).toBe("[ ]");
	});
});

// ── collectVitestFailures ───────────────────────────────────────────

describe("collectVitestFailures", () => {
	it("returns empty for null vitest", () => {
		expect(collectVitestFailures(null)).toEqual([]);
	});

	it("collects failed test cases", () => {
		const vitest: VitestResults = {
			suites: [{
				name: "Suite A", file: "a.test.ts",
				passed: 1, failed: 1, skipped: 0, total: 2,
				suiteHookFailed: false, hookError: null,
				cases: [
					{ name: "passes", status: "passed", durationMs: 10 },
					{ name: "fails", status: "failed", durationMs: 20, error: "boom" },
				],
			}],
			totalPassed: 1, totalFailed: 1, totalSkipped: 0, totalTests: 2, durationMs: 100,
		};

		const failures = collectVitestFailures(vitest);
		expect(failures).toHaveLength(1);
		expect(failures[0].testCase.name).toBe("fails");
		expect(failures[0].suite).toBe("Suite A");
	});

	it("collects hook-only failures", () => {
		const vitest: VitestResults = {
			suites: [{
				name: "Suite B", file: "b.test.ts",
				passed: 0, failed: 0, skipped: 1, total: 1,
				suiteHookFailed: true, hookError: "setup failed",
				cases: [
					{ name: "test", status: "skipped", durationMs: 0 },
				],
			}],
			totalPassed: 0, totalFailed: 0, totalSkipped: 1, totalTests: 1, durationMs: 50,
		};

		const failures = collectVitestFailures(vitest);
		expect(failures).toHaveLength(1);
		expect(failures[0].testCase.name).toContain("Hook failure");
	});
});

// ── collectFailedSteps ──────────────────────────────────────────────

describe("collectFailedSteps", () => {
	it("returns empty for no failures", () => {
		const journeys = [{ title: "J1", data: { steps: [{ status: "pass", step: { guideSection: "1", title: "OK" }, durationMs: 100 }] } }];
		expect(collectFailedSteps(journeys)).toEqual([]);
	});

	it("collects failed steps across journeys", () => {
		const failStep: StepResult = { status: "fail", step: { guideSection: "2", title: "Bad" } as any, durationMs: 200, error: "oops" };
		const journeys = [
			{ title: "J1", data: { steps: [failStep] } },
		];
		const result = collectFailedSteps(journeys);
		expect(result).toHaveLength(1);
		expect(result[0].journeyTitle).toBe("J1");
	});
});

// ── resolveJourneyStatus ────────────────────────────────────────────

describe("resolveJourneyStatus", () => {
	it("returns pass for all steps passed", () => {
		const result = resolveJourneyStatus({ passed: 5, failed: 0, totalSteps: 5, skipped: 0 });
		expect(result.status).toBe("pass");
		expect(result.suffix).toBe("");
	});

	it("returns fail suffix when failures exist", () => {
		const result = resolveJourneyStatus({ passed: 3, failed: 2, totalSteps: 5, skipped: 0 });
		expect(result.status).toBe("fail");
	});

	it("returns dev-stopped status", () => {
		const result = resolveJourneyStatus({ passed: 2, failed: 0, totalSteps: 5, skipped: 3, devStopped: true });
		expect(result.status).toBe("dev-stopped");
		expect(result.suffix).toBe(" (Dev)");
	});
});

// ── collectWarningItBlocks ──────────────────────────────────────────

describe("collectWarningItBlocks", () => {
	it("returns empty set for no warnings", () => {
		const result = collectWarningItBlocks([{ title: "J", data: { steps: [{ status: "pass", warnings: [], step: { guideSection: "1", title: "OK" } }] } }]);
		expect(result.size).toBe(0);
	});

	it("collects warning it blocks", () => {
		const step = { status: "pass", warnings: ["visual mismatch"], step: { guideSection: "1", title: "Check", itBlock: "1 — Check" } } as unknown as StepResult;
		const result = collectWarningItBlocks([{ title: "J", data: { steps: [step] } }]);
		expect(result.has("1 — Check")).toBe(true);
	});
});

// ── buildCompactTraceLines ──────────────────────────────────────────

describe("buildCompactTraceLines", () => {
	it("returns empty for empty context", () => {
		expect(buildCompactTraceLines({} as ErrorContext)).toEqual([]);
	});

	it("includes DOM snapshot info", () => {
		const ctx: ErrorContext = {
			domSnapshot: { activeViewType: "markdown", leafCount: 3, hasModal: false },
		};
		const lines = buildCompactTraceLines(ctx);
		expect(lines.some((l) => l.includes("markdown"))).toBe(true);
		expect(lines.some((l) => l.includes("Leaves: 3"))).toBe(true);
	});

	it("includes recent events", () => {
		const ctx: ErrorContext = {
			recentEvents: [{ type: "click", relativeMs: 100 }],
		};
		const lines = buildCompactTraceLines(ctx);
		expect(lines.some((l) => l.includes("click"))).toBe(true);
	});

	it("includes console errors", () => {
		const ctx: ErrorContext = {
			consoleErrors: ["TypeError: boom"],
		};
		const lines = buildCompactTraceLines(ctx);
		expect(lines.some((l) => l.includes("TypeError"))).toBe(true);
	});
});

// ── buildJourneyStatsLine ───────────────────────────────────────────

describe("buildJourneyStatsLine", () => {
	it("builds stats line with basic counts", () => {
		const stats = {
			total: 10, screenshots: 3, assertions: 5, manual_checks: 2, manual_passed: 2, manual_failed: 0,
			visual_inspections: 0, notices: 1, theme_changes: 0,
			create_files: 0, delete_files: 0, open_files: 0, close_leaves: 0,
			tools: ["screenshot", "assert"],
		};
		const line = buildJourneyStatsLine(stats);
		expect(line).toContain("Actions: 10");
		expect(line).toContain("Screenshots: 3");
		expect(line).toContain("Assertions: 5");
		expect(line).toContain("Manual: 2");
		expect(line).toContain("Notices: 1");
		expect(line).not.toContain("Visual");
		expect(line).not.toContain("Themes");
	});

	it("includes visual and theme counts when non-zero", () => {
		const stats = {
			total: 5, screenshots: 1, assertions: 1, manual_checks: 0, manual_passed: 0, manual_failed: 0,
			visual_inspections: 2, notices: 0, theme_changes: 1,
			create_files: 0, delete_files: 0, open_files: 0, close_leaves: 0,
			tools: [],
		};
		const line = buildJourneyStatsLine(stats);
		expect(line).toContain("Visual: 2");
		expect(line).toContain("Themes: 1");
	});

	it("includes lifecycle count when non-zero", () => {
		const stats = {
			total: 3, screenshots: 0, assertions: 0, manual_checks: 0, manual_passed: 0, manual_failed: 0,
			visual_inspections: 0, notices: 0, theme_changes: 0,
			create_files: 1, delete_files: 1, open_files: 1, close_leaves: 0,
			tools: [],
		};
		const line = buildJourneyStatsLine(stats);
		expect(line).toContain("Lifecycle: 3");
	});
});
