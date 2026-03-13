import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../../../src/infrastructure/document.js", () => ({
	Document: vi.fn().mockImplementation(() => ({
		heading: vi.fn().mockReturnThis(),
		addBlank: vi.fn().mockReturnThis(),
		callout: vi.fn().mockReturnThis(),
		text: vi.fn().mockReturnThis(),
		addSeparator: vi.fn().mockReturnThis(),
		table: vi.fn().mockReturnThis(),
	})),
}));

vi.mock("../../../../../src/domain/reports/generators/e2e/e2e-report-utils.js", () => ({
	buildStepsSummary: vi.fn((...args: unknown[]) => `${args[0]}/${args[1]} steps`),
	formatDuration: vi.fn((ms: number) => `${ms}ms`),
	resolveStatus: vi.fn(() => "pass"),
	statusCallout: vi.fn(() => "success"),
	statusLabel: vi.fn(() => "Pass"),
}));

import {
	resolveStatus as mockResolveStatus,
	statusCallout as mockStatusCallout,
	statusLabel as mockStatusLabel,
} from "../../../../../src/domain/reports/generators/e2e/e2e-report-utils.js";
import {
	buildCompactTraceLines,
	collectVitestFailures,
	buildJourneyStatsLine,
	caseMarkAndSuffix,
	collectWarningItBlocks,
	resolveJourneyStatus,
	renderFailuresSection,
	renderWarningsSection,
	renderActionCoverageSection,
	renderTestSuitesSection,
	renderJourneysSummarySection,
} from "../../../../../src/domain/reports/generators/e2e/e2e-report-sections.js";
import type {
	ActionStatsReturn,
	ErrorContext,
	VitestCase,
	VitestResults,
	VitestSuite,
} from "../../../../../src/domain/reports/generators/e2e/e2e-report-types.js";

interface MockDoc {
	heading: ReturnType<typeof vi.fn>;
	addBlank: ReturnType<typeof vi.fn>;
	callout: ReturnType<typeof vi.fn>;
	text: ReturnType<typeof vi.fn>;
	addSeparator: ReturnType<typeof vi.fn>;
	table: ReturnType<typeof vi.fn>;
}

function createDoc(): MockDoc {
	const doc: MockDoc = {
		heading: vi.fn(),
		addBlank: vi.fn(),
		callout: vi.fn(),
		text: vi.fn(),
		addSeparator: vi.fn(),
		table: vi.fn(),
	};
	doc.heading.mockReturnValue(doc);
	doc.addBlank.mockReturnValue(doc);
	doc.callout.mockReturnValue(doc);
	doc.text.mockReturnValue(doc);
	doc.addSeparator.mockReturnValue(doc);
	doc.table.mockReturnValue(doc);
	return doc;
}

function makeStats(overrides: Partial<ActionStatsReturn> = {}): ActionStatsReturn {
	return {
		total: 0,
		screenshots: 0,
		assertions: 0,
		manual_checks: 0,
		manual_passed: 0,
		manual_failed: 0,
		visual_inspections: 0,
		notices: 0,
		theme_changes: 0,
		create_files: 0,
		delete_files: 0,
		open_files: 0,
		close_leaves: 0,
		tools: [],
		...overrides,
	};
}

function makeSuite(overrides: Partial<VitestSuite> = {}): VitestSuite {
	return {
		name: "Suite A",
		file: "suite-a.test.ts",
		cases: [],
		hookError: null,
		suiteHookFailed: false,
		passed: 0,
		failed: 0,
		skipped: 0,
		...overrides,
	};
}

function makeCase(overrides: Partial<VitestCase> = {}): VitestCase {
	return {
		name: "test case",
		status: "passed",
		durationMs: 100,
		error: null,
		...overrides,
	};
}

function makeVitestResults(overrides: Partial<VitestResults> = {}): VitestResults {
	return {
		totalPassed: 0,
		totalFailed: 0,
		totalSkipped: 0,
		totalTests: 0,
		durationMs: 0,
		suites: [],
		...overrides,
	};
}

// ── buildCompactTraceLines ──────────────────────────────────────

describe("buildCompactTraceLines", () => {
	it("returns empty array for empty context", () => {
		expect(buildCompactTraceLines({})).toEqual([]);
	});

	it("returns view/leaf/modal line with domSnapshot", () => {
		const ctx: ErrorContext = {
			domSnapshot: { activeViewType: "markdown", leafCount: 3, hasModal: false },
		};
		const lines = buildCompactTraceLines(ctx);
		expect(lines).toHaveLength(1);
		expect(lines[0]).toContain("View: `markdown`");
		expect(lines[0]).toContain("Leaves: 3");
		expect(lines[0]).toContain("Modal: no");
	});

	it("shows Modal: yes when hasModal is true", () => {
		const ctx: ErrorContext = {
			domSnapshot: { activeViewType: "canvas", leafCount: 1, hasModal: true },
		};
		const lines = buildCompactTraceLines(ctx);
		expect(lines[0]).toContain("Modal: yes");
	});

	it("appends notice line when domSnapshot has notices", () => {
		const ctx: ErrorContext = {
			domSnapshot: { activeViewType: "md", leafCount: 1, hasModal: false, notices: ["Something went wrong"] },
		};
		const lines = buildCompactTraceLines(ctx);
		expect(lines).toHaveLength(2);
		expect(lines[1]).toContain("Notices:");
		expect(lines[1]).toContain("`Something went wrong`");
	});

	it("truncates long notices to 80 chars", () => {
		const longNotice = "A".repeat(120);
		const ctx: ErrorContext = {
			domSnapshot: { activeViewType: "md", leafCount: 1, hasModal: false, notices: [longNotice] },
		};
		const lines = buildCompactTraceLines(ctx);
		expect(lines[1]).toContain(`\`${"A".repeat(80)}\``);
	});

	it("does not append notices line when notices array is empty", () => {
		const ctx: ErrorContext = {
			domSnapshot: { activeViewType: "md", leafCount: 1, hasModal: false, notices: [] },
		};
		const lines = buildCompactTraceLines(ctx);
		expect(lines).toHaveLength(1);
	});

	it("appends recent events", () => {
		const ctx: ErrorContext = {
			recentEvents: [
				{ type: "click", relativeMs: 50 },
				{ type: "keydown", relativeMs: 30 },
			],
		};
		const lines = buildCompactTraceLines(ctx);
		expect(lines).toContain("**Recent Events**:");
		expect(lines).toContain("- `click` (50ms ago)");
		expect(lines).toContain("- `keydown` (30ms ago)");
	});

	it("does not append events when array is empty", () => {
		const ctx: ErrorContext = { recentEvents: [] };
		expect(buildCompactTraceLines(ctx)).toEqual([]);
	});

	it("appends console errors", () => {
		const ctx: ErrorContext = {
			consoleErrors: ["TypeError: undefined is not a function"],
		};
		const lines = buildCompactTraceLines(ctx);
		expect(lines).toContain("**Console Errors**:");
		expect(lines).toContain("- `TypeError: undefined is not a function`");
	});

	it("truncates long console errors to 120 chars", () => {
		const longErr = "E".repeat(200);
		const ctx: ErrorContext = { consoleErrors: [longErr] };
		const lines = buildCompactTraceLines(ctx);
		const errorLine = lines.find((l) => l.startsWith("- `E"));
		expect(errorLine).toBe(`- \`${"E".repeat(120)}\``);
	});

	it("does not append errors when array is empty", () => {
		const ctx: ErrorContext = { consoleErrors: [] };
		expect(buildCompactTraceLines(ctx)).toEqual([]);
	});

	it("appends plugin state", () => {
		const ctx: ErrorContext = {
			pluginState: { loaded: true, serviceCount: 5 },
		};
		const lines = buildCompactTraceLines(ctx);
		expect(lines).toContain("Plugin: loaded=true, services=5");
	});

	it("returns all lines for full context", () => {
		const ctx: ErrorContext = {
			domSnapshot: { activeViewType: "md", leafCount: 2, hasModal: true, notices: ["Notice1"] },
			recentEvents: [{ type: "evt", relativeMs: 10 }],
			consoleErrors: ["err1"],
			pluginState: { loaded: false, serviceCount: 0 },
		};
		const lines = buildCompactTraceLines(ctx);
		expect(lines.some((l) => l.includes("View:"))).toBe(true);
		expect(lines.some((l) => l.includes("Notices:"))).toBe(true);
		expect(lines.some((l) => l.includes("**Recent Events**:"))).toBe(true);
		expect(lines.some((l) => l.includes("**Console Errors**:"))).toBe(true);
		expect(lines.some((l) => l.includes("Plugin:"))).toBe(true);
	});
});

// ── collectVitestFailures ───────────────────────────────────────

describe("collectVitestFailures", () => {
	it("returns empty array for null input", () => {
		expect(collectVitestFailures(null)).toEqual([]);
	});

	it("returns empty array when no failures exist", () => {
		const vitest = makeVitestResults({
			suites: [
				makeSuite({
					cases: [makeCase({ status: "passed" }), makeCase({ status: "skipped" })],
				}),
			],
		});
		expect(collectVitestFailures(vitest)).toEqual([]);
	});

	it("collects failed cases with suite name", () => {
		const failedCase = makeCase({ name: "fails here", status: "failed", error: "boom" });
		const vitest = makeVitestResults({
			suites: [makeSuite({ name: "MySuite", cases: [makeCase(), failedCase] })],
		});
		const result = collectVitestFailures(vitest);
		expect(result).toHaveLength(1);
		expect(result[0].suite).toBe("MySuite");
		expect(result[0].testCase.name).toBe("fails here");
		expect(result[0].hookError).toBeNull();
	});

	it("includes hookError from suite", () => {
		const failedCase = makeCase({ status: "failed" });
		const vitest = makeVitestResults({
			suites: [makeSuite({ name: "S", cases: [failedCase], hookError: "hook broke" })],
		});
		const result = collectVitestFailures(vitest);
		expect(result[0].hookError).toBe("hook broke");
	});

	it("includes hook-only failures when no regular failures exist", () => {
		const vitest = makeVitestResults({
			suites: [
				makeSuite({
					name: "HookSuite",
					suiteHookFailed: true,
					hookError: "beforeAll crash",
					cases: [makeCase({ status: "skipped" })],
				}),
			],
		});
		const result = collectVitestFailures(vitest);
		expect(result).toHaveLength(1);
		expect(result[0].testCase.name).toBe("Hook failure (beforeAll)");
		expect(result[0].testCase.status).toBe("failed");
		expect(result[0].hookError).toBe("beforeAll crash");
	});

	it("does not add hook-only failure when regular failures exist", () => {
		const failedCase = makeCase({ name: "real failure", status: "failed" });
		const vitest = makeVitestResults({
			suites: [
				makeSuite({
					name: "Mixed",
					suiteHookFailed: true,
					hookError: "hook err",
					cases: [failedCase],
				}),
			],
		});
		const result = collectVitestFailures(vitest);
		expect(result).toHaveLength(1);
		expect(result[0].testCase.name).toBe("real failure");
	});

	it("collects failures from multiple suites", () => {
		const vitest = makeVitestResults({
			suites: [
				makeSuite({ name: "A", cases: [makeCase({ status: "failed" })] }),
				makeSuite({ name: "B", cases: [makeCase({ status: "failed" }), makeCase({ status: "failed" })] }),
			],
		});
		expect(collectVitestFailures(vitest)).toHaveLength(3);
	});
});

// ── buildJourneyStatsLine ───────────────────────────────────────

describe("buildJourneyStatsLine", () => {
	it("returns formatted stats string", () => {
		const stats = makeStats({ total: 10, screenshots: 3, assertions: 2, manual_checks: 1, notices: 1 });
		const line = buildJourneyStatsLine(stats);
		expect(line).toContain("Actions: 10");
		expect(line).toContain("Screenshots: 3");
		expect(line).toContain("Assertions: 2");
		expect(line).toContain("Manual: 1");
		expect(line).toContain("Notices: 1");
	});

	it("includes Visual when > 0", () => {
		const stats = makeStats({ total: 5, visual_inspections: 2 });
		const line = buildJourneyStatsLine(stats);
		expect(line).toContain("Visual: 2");
	});

	it("excludes Visual when 0", () => {
		const stats = makeStats({ total: 5, visual_inspections: 0 });
		const line = buildJourneyStatsLine(stats);
		expect(line).not.toContain("Visual");
	});

	it("includes Themes when > 0", () => {
		const stats = makeStats({ total: 5, theme_changes: 3 });
		const line = buildJourneyStatsLine(stats);
		expect(line).toContain("Themes: 3");
	});

	it("excludes Themes when 0", () => {
		const stats = makeStats({ total: 5, theme_changes: 0 });
		const line = buildJourneyStatsLine(stats);
		expect(line).not.toContain("Themes");
	});

	it("includes Lifecycle when > 0", () => {
		const stats = makeStats({ total: 5, create_files: 1, delete_files: 2, open_files: 0, close_leaves: 1 });
		const line = buildJourneyStatsLine(stats);
		expect(line).toContain("Lifecycle: 4");
	});

	it("excludes Lifecycle when all zero", () => {
		const stats = makeStats({ total: 5 });
		const line = buildJourneyStatsLine(stats);
		expect(line).not.toContain("Lifecycle");
	});
});

// ── caseMarkAndSuffix ───────────────────────────────────────────

describe("caseMarkAndSuffix", () => {
	it("passed returns [x]", () => {
		const result = caseMarkAndSuffix("passed", "my test", new Set(), false);
		expect(result.mark).toBe("[x]");
		expect(result.suffix).toBe("");
	});

	it("passed with matching warning returns [~]", () => {
		const warnings = new Set(["my test"]);
		const result = caseMarkAndSuffix("passed", "my test case", warnings, false);
		expect(result.mark).toBe("[~]");
	});

	it("passed with non-matching warning returns [x]", () => {
		const warnings = new Set(["other test"]);
		const result = caseMarkAndSuffix("passed", "my test", warnings, false);
		expect(result.mark).toBe("[x]");
	});

	it("failed returns [!]", () => {
		const result = caseMarkAndSuffix("failed", "test", new Set(), false);
		expect(result.mark).toBe("[!]");
		expect(result.suffix).toBe("");
	});

	it("skipped returns [-] with suffix", () => {
		const result = caseMarkAndSuffix("skipped", "test", new Set(), false);
		expect(result.mark).toBe("[-]");
		expect(result.suffix).toContain("Skipped");
	});

	it("dev returns [-] with dev suffix", () => {
		const result = caseMarkAndSuffix("dev", "test", new Set(), false);
		expect(result.mark).toBe("[-]");
		expect(result.suffix).toContain("Dev");
	});

	it("unknown status with hookFailed returns [ ]", () => {
		const result = caseMarkAndSuffix("unknown", "test", new Set(), true);
		expect(result.mark).toBe("[ ]");
		expect(result.suffix).toBe("");
	});

	it("unknown status without hookFailed returns [-]", () => {
		const result = caseMarkAndSuffix("unknown", "test", new Set(), false);
		expect(result.mark).toBe("[-]");
		expect(result.suffix).toBe("");
	});
});

// ── collectWarningItBlocks ──────────────────────────────────────

describe("collectWarningItBlocks", () => {
	it("returns empty set for empty input", () => {
		const result = collectWarningItBlocks([]);
		expect(result.size).toBe(0);
	});

	it("returns empty set when no steps have warnings", () => {
		const journeys = [
			{
				title: "J1",
				data: {
					steps: [
						{ step: { id: "1", guideSection: "1.1", title: "Step One" }, status: "pass", durationMs: 100 },
					],
				},
			},
		];
		expect(collectWarningItBlocks(journeys).size).toBe(0);
	});

	it("collects itBlock names from steps with warnings", () => {
		const journeys = [
			{
				title: "J1",
				data: {
					steps: [
						{
							step: { id: "1", guideSection: "1.1", title: "Step One", itBlock: "it does something" },
							status: "pass",
							durationMs: 100,
							warnings: ["slow response"],
						},
					],
				},
			},
		];
		const result = collectWarningItBlocks(journeys);
		expect(result.has("it does something")).toBe(true);
	});

	it("uses guideSection + title fallback when no itBlock", () => {
		const journeys = [
			{
				title: "J1",
				data: {
					steps: [
						{
							step: { id: "1", guideSection: "2.1", title: "Setup" },
							status: "pass",
							durationMs: 100,
							warnings: ["minor issue"],
						},
					],
				},
			},
		];
		const result = collectWarningItBlocks(journeys);
		expect(result.has("2.1 — Setup")).toBe(true);
	});

	it("handles journeys with no steps data", () => {
		const journeys = [{ title: "J1", data: {} }];
		expect(collectWarningItBlocks(journeys).size).toBe(0);
	});

	it("collects from multiple journeys and steps", () => {
		const journeys = [
			{
				title: "J1",
				data: {
					steps: [
						{
							step: { id: "1", guideSection: "1.1", title: "A", itBlock: "block-a" },
							status: "pass", durationMs: 10, warnings: ["w1"],
						},
						{
							step: { id: "2", guideSection: "1.2", title: "B" },
							status: "pass", durationMs: 10, warnings: ["w2"],
						},
					],
				},
			},
			{
				title: "J2",
				data: {
					steps: [
						{
							step: { id: "3", guideSection: "2.1", title: "C", itBlock: "block-c" },
							status: "pass", durationMs: 10, warnings: ["w3"],
						},
					],
				},
			},
		];
		const result = collectWarningItBlocks(journeys);
		expect(result.size).toBe(3);
		expect(result.has("block-a")).toBe(true);
		expect(result.has("1.2 — B")).toBe(true);
		expect(result.has("block-c")).toBe(true);
	});
});

// ── resolveJourneyStatus ────────────────────────────────────────

describe("resolveJourneyStatus", () => {
	beforeEach(() => {
		vi.mocked(mockResolveStatus).mockReturnValue("pass");
	});

	it("resolves pass status with empty suffix", () => {
		const data = { passed: 5, failed: 0, totalSteps: 5, skipped: 0, dev: 0, devStopped: false };
		const result = resolveJourneyStatus(data);
		expect(result.status).toBe("pass");
		expect(result.suffix).toBe("");
		expect(result.stepsSummary).toBe("5/5 steps");
	});

	it("resolves partial-pass with (Partial) suffix", () => {
		vi.mocked(mockResolveStatus).mockReturnValue("partial-pass");
		const data = { passed: 3, failed: 0, totalSteps: 5, skipped: 2 };
		const result = resolveJourneyStatus(data);
		expect(result.suffix).toBe(" (Partial)");
	});

	it("resolves dev-stopped with (Dev) suffix", () => {
		vi.mocked(mockResolveStatus).mockReturnValue("dev-stopped");
		const data = { passed: 2, failed: 0, totalSteps: 5, devStopped: true };
		const result = resolveJourneyStatus(data);
		expect(result.suffix).toBe(" (Dev)");
	});

	it("resolves fail status with empty suffix", () => {
		vi.mocked(mockResolveStatus).mockReturnValue("fail");
		const data = { passed: 3, failed: 2, totalSteps: 5 };
		const result = resolveJourneyStatus(data);
		expect(result.status).toBe("fail");
		expect(result.suffix).toBe("");
	});

	it("handles missing data fields with defaults", () => {
		const result = resolveJourneyStatus({});
		expect(result.stepsSummary).toBe("0/0 steps");
	});

	it("passes devStopped flag to resolveStatus", () => {
		const data = { passed: 2, failed: 0, totalSteps: 3, skipped: 0, devStopped: true };
		resolveJourneyStatus(data);
		expect(mockResolveStatus).toHaveBeenCalledWith(2, 0, 3, 0, false, true);
	});
});

// ── renderFailuresSection ───────────────────────────────────────

describe("renderFailuresSection", () => {
	let doc: MockDoc;

	beforeEach(() => {
		doc = createDoc();
	});

	it("does nothing when no failures", () => {
		renderFailuresSection(doc, [], []);
		expect(doc.heading).not.toHaveBeenCalled();
		expect(doc.addSeparator).not.toHaveBeenCalled();
	});

	it("renders section heading with total count", () => {
		const failedSteps = [
			{
				journeyTitle: "Journey A",
				stepResult: {
					step: { id: "1", guideSection: "1.1", title: "Do thing" },
					status: "failed",
					durationMs: 200,
					error: "Timeout",
				},
			},
		];
		renderFailuresSection(doc, failedSteps, []);
		expect(doc.addSeparator).toHaveBeenCalled();
		expect(doc.heading).toHaveBeenCalledWith(2, "Failures (1)");
	});

	it("renders journey failure entries with error callout", () => {
		const failedSteps = [
			{
				journeyTitle: "Journey B",
				stepResult: {
					step: { id: "1", guideSection: "2.1", title: "Click button" },
					status: "failed",
					durationMs: 500,
					error: "Element not found",
				},
			},
		];
		renderFailuresSection(doc, failedSteps, []);
		expect(doc.heading).toHaveBeenCalledWith(3, "Step 2.1: Click button [FAIL]");
		expect(doc.callout).toHaveBeenCalledWith(
			"danger",
			expect.stringContaining("Journey B"),
			expect.arrayContaining([expect.stringContaining("Element not found")]),
		);
	});

	it("renders trace callout when errorContext is present", () => {
		const failedSteps = [
			{
				journeyTitle: "J",
				stepResult: {
					step: { id: "1", guideSection: "1.1", title: "S" },
					status: "failed",
					durationMs: 100,
					errorContext: { pluginState: { loaded: true, serviceCount: 3 } },
				},
			},
		];
		renderFailuresSection(doc, failedSteps, []);
		expect(doc.callout).toHaveBeenCalledWith("bug", "Trace", expect.any(Array));
	});

	it("renders vitest failures", () => {
		const vitestFailures = [
			{
				suite: "SuiteX",
				testCase: makeCase({ name: "test one", status: "failed", durationMs: 50, error: "assert fail" }),
				hookError: null,
			},
		];
		renderFailuresSection(doc, [], vitestFailures);
		expect(doc.heading).toHaveBeenCalledWith(2, "Failures (1)");
		expect(doc.heading).toHaveBeenCalledWith(3, "Test Runner Failures");
		expect(doc.callout).toHaveBeenCalledWith(
			"danger",
			expect.stringContaining("SuiteX"),
			expect.arrayContaining([expect.stringContaining("assert fail")]),
		);
	});

	it("renders vitest sub-heading differently when journey failures also present", () => {
		const failedSteps = [
			{
				journeyTitle: "J",
				stepResult: {
					step: { id: "1", guideSection: "1.1", title: "S" },
					status: "failed",
					durationMs: 100,
					error: "err",
				},
			},
		];
		const vitestFailures = [
			{ suite: "S", testCase: makeCase({ status: "failed", error: "vt err" }), hookError: null },
		];
		renderFailuresSection(doc, failedSteps, vitestFailures);
		expect(doc.heading).toHaveBeenCalledWith(3, "Vitest Failures (not captured by journey runner)");
	});

	it("renders hook error when testCase has no error", () => {
		const vitestFailures = [
			{
				suite: "HookSuite",
				testCase: makeCase({ name: "hook fail", status: "failed", durationMs: 0, error: null }),
				hookError: "beforeAll broke",
			},
		];
		renderFailuresSection(doc, [], vitestFailures);
		expect(doc.callout).toHaveBeenCalledWith(
			"danger",
			expect.stringContaining("HookSuite"),
			expect.arrayContaining([expect.stringContaining("Hook error")]),
		);
	});

	it("renders details link with wikilink format", () => {
		const failedSteps = [
			{
				journeyTitle: "My Journey",
				stepResult: {
					step: { id: "1", guideSection: "3.1", title: "Verify" },
					status: "failed",
					durationMs: 100,
				},
			},
		];
		renderFailuresSection(doc, failedSteps, []);
		expect(doc.text).toHaveBeenCalledWith(expect.stringContaining("[[My Journey#"));
	});

	it("omits duration for vitest failures with 0ms", () => {
		const vitestFailures = [
			{ suite: "S", testCase: makeCase({ name: "t", status: "failed", durationMs: 0, error: "e" }), hookError: null },
		];
		renderFailuresSection(doc, [], vitestFailures);
		expect(doc.callout).toHaveBeenCalledWith("danger", "S — t", expect.any(Array));
	});
});

// ── renderWarningsSection ───────────────────────────────────────

describe("renderWarningsSection", () => {
	let doc: MockDoc;

	beforeEach(() => {
		doc = createDoc();
	});

	it("does nothing when no warnings", () => {
		const journeys = [
			{
				title: "J1",
				data: {
					steps: [
						{ step: { id: "1", guideSection: "1.1", title: "OK Step" }, status: "pass", durationMs: 100 },
					],
				},
			},
		];
		renderWarningsSection(doc, journeys);
		expect(doc.heading).not.toHaveBeenCalled();
	});

	it("does nothing when journeys have no steps", () => {
		renderWarningsSection(doc, [{ title: "J", data: {} }]);
		expect(doc.heading).not.toHaveBeenCalled();
	});

	it("renders steps with warnings", () => {
		const journeys = [
			{
				title: "Journey A",
				data: {
					steps: [
						{
							step: { id: "1", guideSection: "1.1", title: "Step One" },
							status: "pass",
							durationMs: 50,
							warnings: ["Slow response time"],
						},
					],
				},
			},
		];
		renderWarningsSection(doc, journeys);
		expect(doc.heading).toHaveBeenCalledWith(2, "Warnings (1)");
		expect(doc.callout).toHaveBeenCalledWith(
			"warning",
			"Journey A — Step 1.1: Step One",
			["Slow response time"],
		);
	});

	it("extracts reason from warning with Reason line", () => {
		const journeys = [
			{
				title: "J",
				data: {
					steps: [
						{
							step: { id: "1", guideSection: "1.1", title: "S" },
							status: "pass",
							durationMs: 10,
							warnings: ["Some check failed\nReason: timeout exceeded"],
						},
					],
				},
			},
		];
		renderWarningsSection(doc, journeys);
		expect(doc.callout).toHaveBeenCalledWith("warning", expect.any(String), ["timeout exceeded"]);
	});

	it("renders warnings from multiple journeys", () => {
		const journeys = [
			{
				title: "J1",
				data: {
					steps: [
						{
							step: { id: "1", guideSection: "1.1", title: "A" },
							status: "pass", durationMs: 10, warnings: ["w1"],
						},
					],
				},
			},
			{
				title: "J2",
				data: {
					steps: [
						{
							step: { id: "2", guideSection: "2.1", title: "B" },
							status: "pass", durationMs: 10, warnings: ["w2"],
						},
					],
				},
			},
		];
		renderWarningsSection(doc, journeys);
		expect(doc.heading).toHaveBeenCalledWith(2, "Warnings (2)");
	});
});

// ── renderActionCoverageSection ─────────────────────────────────

describe("renderActionCoverageSection", () => {
	let doc: MockDoc;

	beforeEach(() => {
		doc = createDoc();
	});

	it("does nothing when aggregate total is 0", () => {
		const stats = makeStats({ total: 0 });
		renderActionCoverageSection(doc, stats, [], 0, [], new Map());
		expect(doc.heading).not.toHaveBeenCalled();
	});

	it("renders summary callout with action counts", () => {
		const aggregate = makeStats({ total: 20, screenshots: 5, assertions: 8, manual_checks: 3, notices: 2 });
		renderActionCoverageSection(doc, aggregate, ["screenshot", "assert"], 2, [], new Map());
		expect(doc.heading).toHaveBeenCalledWith(2, "Action Coverage");
		expect(doc.callout).toHaveBeenCalledWith(
			"abstract",
			"20 actions across 2 journeys",
			expect.any(Array),
		);
	});

	it("includes visual/theme/lifecycle in summary when > 0", () => {
		const aggregate = makeStats({
			total: 10, screenshots: 1, assertions: 1, manual_checks: 0, notices: 0,
			visual_inspections: 2, theme_changes: 3, create_files: 1, delete_files: 1, open_files: 0, close_leaves: 0,
		});
		renderActionCoverageSection(doc, aggregate, [], 1, [], new Map());
		const calloutArgs = vi.mocked(doc.callout).mock.calls[0];
		const summaryLines = calloutArgs[2] as string[];
		expect(summaryLines[0]).toContain("Visual:");
		expect(summaryLines[0]).toContain("Themes:");
		expect(summaryLines[0]).toContain("Lifecycle:");
	});

	it("renders tools list in callout", () => {
		const aggregate = makeStats({ total: 5 });
		renderActionCoverageSection(doc, aggregate, ["screenshot", "assert"], 1, [], new Map());
		const calloutArgs = vi.mocked(doc.callout).mock.calls[0];
		const lines = calloutArgs[2] as string[];
		expect(lines[1]).toContain("`screenshot`");
		expect(lines[1]).toContain("`assert`");
	});

	it("renders per-journey table when multiple journeys", () => {
		const aggregate = makeStats({ total: 10 });
		const journeyStats = makeStats({ total: 5, screenshots: 1, assertions: 2, manual_checks: 1, notices: 0, tools: ["screenshot"] });
		const perJourneyStats = new Map([["j1", journeyStats]]);
		const journeys = [
			{ title: "Journey 1", data: { journey: "j1" } },
			{ title: "Journey 2", data: { journey: "j2" } },
		];
		renderActionCoverageSection(doc, aggregate, [], 2, journeys, perJourneyStats);
		expect(doc.table).toHaveBeenCalledWith(
			["Journey", "Actions", "Screenshots", "Assertions", "Manual", "Notices", "Lifecycle", "Tools"],
			expect.any(Array),
		);
	});

	it("does not render table for single journey", () => {
		const aggregate = makeStats({ total: 5 });
		const journeys = [{ title: "J1", data: { journey: "j1" } }];
		renderActionCoverageSection(doc, aggregate, [], 1, journeys, new Map());
		expect(doc.table).not.toHaveBeenCalled();
	});

	it("skips journeys with no stats in table", () => {
		const aggregate = makeStats({ total: 10 });
		const journeys = [
			{ title: "J1", data: { journey: "j1" } },
			{ title: "J2", data: { journey: "j2" } },
		];
		renderActionCoverageSection(doc, aggregate, [], 2, journeys, new Map());
		const tableArgs = vi.mocked(doc.table).mock.calls[0];
		const rows = tableArgs[1] as string[][];
		expect(rows).toHaveLength(0);
	});
});

// ── renderTestSuitesSection ─────────────────────────────────────

describe("renderTestSuitesSection", () => {
	let doc: MockDoc;

	beforeEach(() => {
		doc = createDoc();
		vi.mocked(mockResolveStatus).mockReturnValue("pass");
		vi.mocked(mockStatusCallout).mockReturnValue("success");
		vi.mocked(mockStatusLabel).mockReturnValue("Pass");
	});

	it("renders section heading", () => {
		const reconciled = makeVitestResults({ suites: [] });
		renderTestSuitesSection(doc, reconciled, []);
		expect(doc.heading).toHaveBeenCalledWith(2, "Test Suites");
	});

	it("renders suite headers with pass/total summary", () => {
		const reconciled = makeVitestResults({
			suites: [
				makeSuite({
					name: "Auth Suite",
					cases: [makeCase(), makeCase()],
					passed: 2,
					failed: 0,
					skipped: 0,
				}),
			],
		});
		renderTestSuitesSection(doc, reconciled, []);
		expect(doc.heading).toHaveBeenCalledWith(3, "Auth Suite");
		expect(doc.callout).toHaveBeenCalledWith(
			"success",
			expect.stringContaining("2/2 passed"),
			expect.any(Array),
		);
	});

	it("uses reconciled counts when available", () => {
		const reconciled = makeVitestResults({
			suites: [
				makeSuite({
					name: "S",
					cases: [makeCase(), makeCase(), makeCase()],
					passed: 1,
					failed: 2,
					reconciledPassed: 3,
					reconciledFailed: 0,
					reconciledSkipped: 0,
				}),
			],
		});
		renderTestSuitesSection(doc, reconciled, []);
		expect(doc.callout).toHaveBeenCalledWith(
			"success",
			expect.stringContaining("3/3 passed"),
			expect.any(Array),
		);
	});

	it("includes skipped and dev counts in summary", () => {
		const reconciled = makeVitestResults({
			suites: [
				makeSuite({
					name: "S",
					cases: [makeCase(), makeCase(), makeCase(), makeCase()],
					passed: 2,
					skipped: 1,
					reconciledDev: 1,
				}),
			],
		});
		renderTestSuitesSection(doc, reconciled, []);
		expect(doc.callout).toHaveBeenCalledWith(
			"success",
			expect.stringContaining("1 skipped"),
			expect.any(Array),
		);
		expect(doc.callout).toHaveBeenCalledWith(
			"success",
			expect.stringContaining("1 dev"),
			expect.any(Array),
		);
	});

	it("renders hook error in callout lines", () => {
		const reconciled = makeVitestResults({
			suites: [
				makeSuite({
					name: "S",
					cases: [],
					hookError: "beforeAll crashed hard",
				}),
			],
		});
		renderTestSuitesSection(doc, reconciled, []);
		const calloutCalls = vi.mocked(doc.callout).mock.calls;
		const hookCallout = calloutCalls.find((c) => {
			const lines = c[2] as string[];
			return lines.some((l: string) => l.includes("Hook failure"));
		});
		expect(hookCallout).toBeDefined();
	});

	it("renders cases with marks and durations", () => {
		const reconciled = makeVitestResults({
			suites: [
				makeSuite({
					name: "S",
					cases: [
						makeCase({ name: "passes", status: "passed", durationMs: 50 }),
						makeCase({ name: "fails", status: "failed", durationMs: 200, error: "boom" }),
					],
				}),
			],
		});
		renderTestSuitesSection(doc, reconciled, []);
		expect(doc.text).toHaveBeenCalledWith(expect.stringContaining("[x] passes"));
		expect(doc.text).toHaveBeenCalledWith(expect.stringContaining("[!] fails"));
		expect(doc.text).toHaveBeenCalledWith(expect.stringContaining("Error: boom"));
	});

	it("strips suite prefix from case names with >", () => {
		const reconciled = makeVitestResults({
			suites: [
				makeSuite({
					name: "S",
					cases: [makeCase({ name: "Suite > Nested > actual test", status: "passed", durationMs: 10 })],
				}),
			],
		});
		renderTestSuitesSection(doc, reconciled, []);
		expect(doc.text).toHaveBeenCalledWith(expect.stringContaining("actual test"));
	});

	it("marks blocked cases in hook-failed suites", () => {
		const reconciled = makeVitestResults({
			suites: [
				makeSuite({
					name: "S",
					suiteHookFailed: true,
					cases: [makeCase({ name: "blocked test", status: "pending", durationMs: 0 })],
				}),
			],
		});
		renderTestSuitesSection(doc, reconciled, []);
		expect(doc.text).toHaveBeenCalledWith(expect.stringContaining("blocked"));
	});

	it("omits duration for 0ms cases", () => {
		const reconciled = makeVitestResults({
			suites: [
				makeSuite({
					name: "S",
					cases: [makeCase({ name: "no-dur", status: "passed", durationMs: 0 })],
				}),
			],
		});
		renderTestSuitesSection(doc, reconciled, []);
		const textCalls = vi.mocked(doc.text).mock.calls.map((c) => c[0]);
		const caseLine = textCalls.find((t) => typeof t === "string" && t.includes("no-dur"));
		expect(caseLine).not.toContain("0ms");
	});

	it("uses reconciledStatus when available", () => {
		const reconciled = makeVitestResults({
			suites: [
				makeSuite({
					name: "S",
					cases: [makeCase({ name: "was-failed", status: "failed", durationMs: 10, reconciledStatus: "passed" })],
				}),
			],
		});
		renderTestSuitesSection(doc, reconciled, []);
		expect(doc.text).toHaveBeenCalledWith(expect.stringContaining("[x] was-failed"));
	});

	it("applies warning mark from collected warning itBlocks", () => {
		const journeys = [
			{
				title: "J",
				data: {
					steps: [
						{
							step: { id: "1", guideSection: "1.1", title: "T", itBlock: "warn-case" },
							status: "pass", durationMs: 10, warnings: ["w"],
						},
					],
				},
			},
		];
		const reconciled = makeVitestResults({
			suites: [
				makeSuite({
					name: "S",
					cases: [makeCase({ name: "warn-case thing", status: "passed", durationMs: 10 })],
				}),
			],
		});
		renderTestSuitesSection(doc, reconciled, journeys);
		expect(doc.text).toHaveBeenCalledWith(expect.stringContaining("[~]"));
	});
});

// ── renderJourneysSummarySection ────────────────────────────────

describe("renderJourneysSummarySection", () => {
	let doc: MockDoc;

	beforeEach(() => {
		doc = createDoc();
		vi.mocked(mockResolveStatus).mockReturnValue("pass");
		vi.mocked(mockStatusCallout).mockReturnValue("success");
		vi.mocked(mockStatusLabel).mockReturnValue("Pass");
	});

	it("does nothing for empty journeys", () => {
		renderJourneysSummarySection(doc, [], new Map());
		expect(doc.heading).not.toHaveBeenCalled();
	});

	it("renders section heading", () => {
		const journeys = [{ title: "J1", data: { journey: "j1", passed: 5, totalSteps: 5, durationMs: 1000 } }];
		renderJourneysSummarySection(doc, journeys, new Map());
		expect(doc.heading).toHaveBeenCalledWith(2, "Journeys");
	});

	it("renders journey heading with title", () => {
		const journeys = [{ title: "Getting Started", data: { journey: "gs", passed: 3, totalSteps: 3, durationMs: 500 } }];
		renderJourneysSummarySection(doc, journeys, new Map());
		expect(doc.heading).toHaveBeenCalledWith(3, "Journey: Getting Started");
	});

	it("appends suffix for partial-pass", () => {
		vi.mocked(mockResolveStatus).mockReturnValue("partial-pass");
		const journeys = [{ title: "J", data: { journey: "j", passed: 3, totalSteps: 5, skipped: 2, durationMs: 100 } }];
		renderJourneysSummarySection(doc, journeys, new Map());
		expect(doc.heading).toHaveBeenCalledWith(3, "Journey: J (Partial)");
	});

	it("appends suffix for dev-stopped", () => {
		vi.mocked(mockResolveStatus).mockReturnValue("dev-stopped");
		const journeys = [{ title: "J", data: { journey: "j", passed: 2, totalSteps: 5, devStopped: true, durationMs: 100 } }];
		renderJourneysSummarySection(doc, journeys, new Map());
		expect(doc.heading).toHaveBeenCalledWith(3, "Journey: J (Dev)");
	});

	it("renders callout with status and steps summary", () => {
		const journeys = [{ title: "J", data: { journey: "j", passed: 5, totalSteps: 5, durationMs: 2000 } }];
		renderJourneysSummarySection(doc, journeys, new Map());
		expect(doc.callout).toHaveBeenCalledWith(
			"success",
			expect.stringContaining("5/5 steps"),
			expect.any(Array),
		);
	});

	it("includes journey stats line when stats exist", () => {
		const stats = makeStats({ total: 10, screenshots: 3, assertions: 2, manual_checks: 1, notices: 1 });
		const perJourneyStats = new Map([["j1", stats]]);
		const journeys = [{ title: "J", data: { journey: "j1", passed: 5, totalSteps: 5, durationMs: 100 } }];
		renderJourneysSummarySection(doc, journeys, perJourneyStats);
		const calloutArgs = vi.mocked(doc.callout).mock.calls[0];
		const lines = calloutArgs[2] as string[];
		expect(lines.length).toBeGreaterThan(0);
		expect(lines[0]).toContain("Actions: 10");
	});

	it("renders wikilinks for details and canvas", () => {
		const journeys = [{ title: "My Journey", data: { journey: "mj", passed: 1, totalSteps: 1, durationMs: 50 } }];
		renderJourneysSummarySection(doc, journeys, new Map());
		expect(doc.text).toHaveBeenCalledWith(expect.stringContaining("[[My Journey]]"));
		expect(doc.text).toHaveBeenCalledWith(expect.stringContaining("[[My Journey.canvas|Canvas]]"));
	});

	it("renders multiple journeys", () => {
		const journeys = [
			{ title: "J1", data: { journey: "j1", passed: 3, totalSteps: 3, durationMs: 100 } },
			{ title: "J2", data: { journey: "j2", passed: 5, totalSteps: 5, durationMs: 200 } },
		];
		renderJourneysSummarySection(doc, journeys, new Map());
		expect(doc.heading).toHaveBeenCalledWith(3, "Journey: J1");
		expect(doc.heading).toHaveBeenCalledWith(3, "Journey: J2");
	});

	it("does not include stats line when stats total is 0", () => {
		const stats = makeStats({ total: 0 });
		const perJourneyStats = new Map([["j1", stats]]);
		const journeys = [{ title: "J", data: { journey: "j1", passed: 1, totalSteps: 1, durationMs: 10 } }];
		renderJourneysSummarySection(doc, journeys, perJourneyStats);
		const calloutArgs = vi.mocked(doc.callout).mock.calls[0];
		const lines = calloutArgs[2] as string[];
		expect(lines).toHaveLength(0);
	});
});
