import { describe, it, expect, vi } from "vitest";

vi.mock("../../../../../src/infrastructure/filesystem.js", () => ({
	disk: {
		existsSync: vi.fn(() => false),
		readFileSync: vi.fn(() => "{}"),
		readdirSync: vi.fn(() => []),
	},
}));

vi.mock("../../../../../src/infrastructure/paths.js", () => ({
	paths: {
		join: (...args: string[]) => args.join("/"),
		basename: (p: string, ext?: string) => {
			const base = p.split("/").pop() ?? "";
			return ext && base.endsWith(ext) ? base.slice(0, -ext.length) : base;
		},
	},
}));

vi.mock("../../../../../src/infrastructure/clock.js", () => ({
	clock: { ms: () => 1000000 },
}));

vi.mock("../../../../../src/infrastructure/proc.js", () => ({
	proc: { env: () => ({}) },
}));

import {
	buildErrorContextLines,
	extractJourneyFields,
	generateJourneyReport,
} from "../../../../../src/domain/reports/generators/e2e/e2e-report-journey.js";
import type { ErrorContext } from "../../../../../src/domain/reports/generators/e2e/e2e-report-types.js";

// ── buildErrorContextLines ──────────────────────────────────────────

describe("buildErrorContextLines", () => {
	it("returns empty for empty context", () => {
		expect(buildErrorContextLines({} as ErrorContext)).toEqual([]);
	});

	it("includes DOM snapshot info", () => {
		const ctx: ErrorContext = {
			domSnapshot: {
				activeViewType: "hub-view",
				leafCount: 3,
				hasModal: true,
				notices: ["Notice 1"],
				visibleElements: [".nav", ".sidebar"],
			},
		};
		const lines = buildErrorContextLines(ctx);
		expect(lines.some((l) => l.includes("hub-view"))).toBe(true);
		expect(lines.some((l) => l.includes("Modal: yes"))).toBe(true);
		expect(lines.some((l) => l.includes("Notice 1"))).toBe(true);
		expect(lines.some((l) => l.includes(".nav"))).toBe(true);
	});

	it("includes recent events", () => {
		const ctx: ErrorContext = {
			recentEvents: [
				{ type: "hub.tab.changed", relativeMs: 100 },
				{ type: "settings.loaded", relativeMs: 250 },
			],
		};
		const lines = buildErrorContextLines(ctx);
		expect(lines.some((l) => l.includes("hub.tab.changed"))).toBe(true);
		expect(lines.some((l) => l.includes("100ms ago"))).toBe(true);
	});

	it("includes console errors", () => {
		const ctx: ErrorContext = {
			consoleErrors: ["TypeError: x is not a function"],
		};
		const lines = buildErrorContextLines(ctx);
		expect(lines.some((l) => l.includes("TypeError"))).toBe(true);
	});

	it("includes available variables", () => {
		const ctx: ErrorContext = {
			availableVariables: ["hubId", "tabName"],
		};
		const lines = buildErrorContextLines(ctx);
		expect(lines.some((l) => l.includes("hubId"))).toBe(true);
	});

	it("includes plugin state", () => {
		const ctx: ErrorContext = {
			pluginState: { loaded: true, serviceCount: 5 },
		};
		const lines = buildErrorContextLines(ctx);
		expect(lines.some((l) => l.includes("loaded=true"))).toBe(true);
		expect(lines.some((l) => l.includes("services=5"))).toBe(true);
	});

	it("combines all context types", () => {
		const ctx: ErrorContext = {
			domSnapshot: { activeViewType: "test", leafCount: 1, hasModal: false },
			recentEvents: [{ type: "ev", relativeMs: 10 }],
			consoleErrors: ["err"],
			availableVariables: ["v1"],
			pluginState: { loaded: false, serviceCount: 0 },
		};
		const lines = buildErrorContextLines(ctx);
		expect(lines.length).toBeGreaterThanOrEqual(5);
	});
});

// ── extractJourneyFields ────────────────────────────────────────────

describe("extractJourneyFields", () => {
	it("extracts basic journey fields", () => {
		const data = {
			journey: "getting-started",
			totalSteps: 5,
			passed: 4,
			failed: 1,
			skipped: 0,
			dev: 0,
			durationMs: 5000,
			steps: [],
		};
		const fields = extractJourneyFields(data);
		expect(fields.journeySlug).toBe("getting-started");
		expect(fields.journeyTitle).toBe("Getting Started");
		expect(fields.totalSteps).toBe(5);
		expect(fields.passedSteps).toBe(4);
		expect(fields.failedSteps).toBe(1);
		expect(fields.skippedSteps).toBe(0);
		expect(fields.devSteps).toBe(0);
		expect(fields.durationMs).toBe(5000);
		expect(fields.journeyStatus).toBe("fail");
	});

	it("resolves pass status when all pass", () => {
		const data = {
			journey: "installer",
			totalSteps: 3,
			passed: 3,
			failed: 0,
			skipped: 0,
			dev: 0,
			durationMs: 1000,
			steps: [],
		};
		const fields = extractJourneyFields(data);
		expect(fields.journeyStatus).toBe("pass");
	});

	it("resolves partial-pass for skipped steps", () => {
		const data = {
			journey: "components",
			totalSteps: 5,
			passed: 3,
			failed: 0,
			skipped: 2,
			dev: 0,
			durationMs: 2000,
			steps: [],
		};
		const fields = extractJourneyFields(data);
		expect(fields.journeyStatus).toBe("partial-pass");
	});

	it("resolves dev-stopped status", () => {
		const data = {
			journey: "test-flow",
			totalSteps: 4,
			passed: 2,
			failed: 0,
			skipped: 0,
			dev: 0,
			devStopped: true,
			durationMs: 3000,
			steps: [],
		};
		const fields = extractJourneyFields(data);
		expect(fields.journeyStatus).toBe("dev-stopped");
		expect(fields.isDevStopped).toBe(true);
	});

	it("handles missing data with defaults", () => {
		const fields = extractJourneyFields({});
		expect(fields.journeySlug).toBe("unknown");
		expect(fields.totalSteps).toBe(0);
		expect(fields.durationMs).toBe(0);
	});

	it("capitalizes multi-word journey titles", () => {
		const data = { journey: "my-cool-journey", steps: [] };
		const fields = extractJourneyFields(data);
		expect(fields.journeyTitle).toBe("My Cool Journey");
	});

	it("computes action stats from steps", () => {
		const data = {
			journey: "test",
			steps: [
				{ step: { actions: [{ tool: "screenshot" }, { tool: "assert" }] }, status: "pass", durationMs: 100 },
				{ step: { actions: [{ tool: "screenshot" }] }, status: "pass", durationMs: 50 },
			],
		};
		const fields = extractJourneyFields(data);
		expect(fields.actionStats.total).toBe(3);
		expect(fields.actionStats.screenshots).toBe(2);
		expect(fields.actionStats.assertions).toBe(1);
	});
});

// ── generateJourneyReport ───────────────────────────────────────────

describe("generateJourneyReport", () => {
	it("generates a journey report with title and frontmatter", () => {
		const data = {
			journey: "getting-started",
			totalSteps: 2,
			passed: 2,
			failed: 0,
			skipped: 0,
			dev: 0,
			durationMs: 1500,
			steps: [
				{
					step: { guideSection: "1", title: "Open Hub", phase: "journey", actions: [] },
					status: "pass",
					durationMs: 800,
				},
				{
					step: { guideSection: "2", title: "Click Button", phase: "journey", actions: [] },
					status: "pass",
					durationMs: 700,
				},
			],
		};
		const result = generateJourneyReport(data, "2026-01-01T00:00:00Z");
		expect(result.title).toBe("Getting Started");
		expect(result.status).toBe("pass");
		expect(result.content).toContain("Journey: Getting Started");
		expect(result.content).toContain("type: JourneyReport");
		expect(result.content).toContain("passed: 2");
		expect(result.content).toContain("Step 1: Open Hub");
		expect(result.content).toContain("Step 2: Click Button");
	});

	it("includes error context in report", () => {
		const data = {
			journey: "fail-test",
			totalSteps: 1,
			passed: 0,
			failed: 1,
			skipped: 0,
			dev: 0,
			durationMs: 500,
			steps: [
				{
					step: { guideSection: "1", title: "Broken Step", phase: "journey", actions: [] },
					status: "fail",
					durationMs: 500,
					error: "Element not found",
					errorContext: {
						domSnapshot: { activeViewType: "hub", leafCount: 1, hasModal: false },
					},
				},
			],
		};
		const result = generateJourneyReport(data, "2026-01-01T00:00:00Z");
		expect(result.status).toBe("fail");
		expect(result.content).toContain("Element not found");
		expect(result.content).toContain("Error Context");
	});

	it("handles dev-stopped status in frontmatter", () => {
		const data = {
			journey: "dev-flow",
			totalSteps: 2,
			passed: 1,
			failed: 0,
			skipped: 0,
			dev: 1,
			devStopped: true,
			durationMs: 1000,
			steps: [],
		};
		const result = generateJourneyReport(data, "2026-01-01T00:00:00Z");
		expect(result.content).toContain("dev_stopped: true");
		expect(result.content).toContain("(Dev)");
	});

	it("separates setup and teardown phases", () => {
		const data = {
			journey: "phased",
			totalSteps: 3,
			passed: 3,
			failed: 0,
			skipped: 0,
			dev: 0,
			durationMs: 2000,
			steps: [
				{ step: { guideSection: "0", title: "Init", phase: "setup", actions: [] }, status: "pass", durationMs: 200 },
				{ step: { guideSection: "1", title: "Test", phase: "journey", actions: [] }, status: "pass", durationMs: 1600 },
				{ step: { guideSection: "2", title: "Clean", phase: "teardown", actions: [] }, status: "pass", durationMs: 200 },
			],
		};
		const result = generateJourneyReport(data, "2026-01-01T00:00:00Z");
		expect(result.content).toContain("Setup (1/1)");
		expect(result.content).toContain("Teardown (1/1)");
	});

	it("renders screenshots", () => {
		const data = {
			journey: "screenshot-test",
			totalSteps: 1,
			passed: 1,
			failed: 0,
			skipped: 0,
			dev: 0,
			durationMs: 500,
			steps: [
				{
					step: { guideSection: "1", title: "Visual Step", phase: "journey", actions: [] },
					status: "pass",
					durationMs: 500,
					screenshotFiles: ["step-1-before.png", "step-1-after.png"],
				},
			],
		};
		const result = generateJourneyReport(data, "2026-01-01T00:00:00Z");
		expect(result.content).toContain("![[step-1-before.png]]");
		expect(result.content).toContain("![[step-1-after.png]]");
	});
});
