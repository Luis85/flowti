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

import {
	parseVitestCase, parseVitestSuite, buildJourneyStepMap,
	findMatchingJourney, reconcileCase, reconcileResults,
} from "../../../../../src/domain/reports/generators/e2e/e2e-report-vitest.js";
import type { VitestCase, JourneyEntry } from "../../../../../src/domain/reports/generators/e2e/e2e-report-types.js";
import { paths } from "../../../../../src/infrastructure/paths.js";

const mockPathsDeps = { paths };

describe("parseVitestCase", () => {
	it("parses a passing test case", () => {
		const result = parseVitestCase({
			fullName: "my test",
			status: "passed",
			duration: 42,
		});
		expect(result.name).toBe("my test");
		expect(result.status).toBe("passed");
		expect(result.durationMs).toBe(42);
		expect(result.error).toBeNull();
	});

	it("parses a failing test case with error", () => {
		const result = parseVitestCase({
			fullName: "failing test",
			status: "failed",
			duration: 10,
			failureMessages: ["Error: boom", "Stack trace"],
		});
		expect(result.error).toBe("Error: boom\nStack trace");
	});

	it("falls back to ancestorTitles when fullName is missing", () => {
		const result = parseVitestCase({
			ancestorTitles: ["Suite", "Nested"],
			status: "passed",
		});
		expect(result.name).toBe("Suite > Nested");
	});

	it("defaults to unknown when no name available", () => {
		const result = parseVitestCase({ status: "passed" });
		expect(result.name).toBe("unknown");
	});
});

describe("parseVitestSuite", () => {
	it("parses a suite with mixed results", () => {
		const { suite, passed, failed, skipped } = parseVitestSuite({
			name: "tests/my-suite.test.ts",
			status: "passed",
			assertionResults: [
				{ fullName: "test 1", status: "passed", duration: 10 },
				{ fullName: "test 2", status: "failed", duration: 5, failureMessages: ["Error"] },
				{ fullName: "test 3", status: "pending", duration: 0 },
			],
		}, mockPathsDeps);
		expect(suite.name).toBe("my-suite");
		expect(passed).toBe(1);
		expect(failed).toBe(1);
		expect(skipped).toBe(1);
	});

	it("handles suite hook failure with no case failures", () => {
		const { suite, failed } = parseVitestSuite({
			name: "tests/hook-fail.test.ts",
			status: "failed",
			message: "beforeAll hook failed",
			assertionResults: [
				{ fullName: "test 1", status: "passed", duration: 10 },
			],
		}, mockPathsDeps);
		expect(suite.suiteHookFailed).toBe(true);
		expect(suite.hookError).toBe("beforeAll hook failed");
		expect(failed).toBe(1);
	});
});

describe("buildJourneyStepMap", () => {
	it("builds map from journey entries", () => {
		const entries: JourneyEntry[] = [
			{
				dir: "/test",
				data: {
					journey: "Login Flow",
					steps: [
						{ step: { itBlock: "logs in", guideSection: "1", title: "Login" }, status: "pass", durationMs: 100 },
					],
				},
			},
		];
		const map = buildJourneyStepMap(entries);
		expect(map.has("Login Flow")).toBe(true);
		expect(map.get("Login Flow")?.[0].itBlock).toBe("logs in");
	});

	it("falls back to guideSection + title for itBlock", () => {
		const entries: JourneyEntry[] = [
			{
				dir: "/test",
				data: {
					journey: "Setup",
					steps: [
						{ step: { guideSection: "2", title: "Configure" }, status: "pass", durationMs: 50 },
					],
				},
			},
		];
		const map = buildJourneyStepMap(entries);
		expect(map.get("Setup")?.[0].itBlock).toBe("2 — Configure");
	});
});

describe("findMatchingJourney", () => {
	const map = new Map<string, Array<{ itBlock: string; status: string }>>([
		["Getting Started", [{ itBlock: "opens hub", status: "pass" }]],
	]);

	it("finds matching journey by slug", () => {
		expect(findMatchingJourney("getting-started", map)).not.toBeNull();
	});

	it("returns null when no match", () => {
		expect(findMatchingJourney("unknown-journey", map)).toBeNull();
	});
});

describe("reconcileCase", () => {
	it("overrides status from journey step data", () => {
		const c: VitestCase = { name: "test > opens hub", status: "passed", durationMs: 10, error: null };
		const result = reconcileCase(c, [{ itBlock: "opens hub", status: "skip" }]);
		expect(result).toBe("skipped");
		expect(c.reconciledStatus).toBe("skipped");
	});

	it("maps dev status", () => {
		const c: VitestCase = { name: "test > future feature", status: "passed", durationMs: 10, error: null };
		const result = reconcileCase(c, [{ itBlock: "future feature", status: "dev" }]);
		expect(result).toBe("dev");
	});

	it("uses original status when no match", () => {
		const c: VitestCase = { name: "unmatched test", status: "failed", durationMs: 10, error: "err" };
		const result = reconcileCase(c, [{ itBlock: "other test", status: "pass" }]);
		expect(result).toBe("failed");
	});
});

describe("reconcileResults", () => {
	it("returns vitest unchanged when no journeys", () => {
		const vitest = { totalPassed: 5, totalFailed: 0, totalSkipped: 0, totalTests: 5, durationMs: 100, suites: [] };
		expect(reconcileResults(vitest, [])).toBe(vitest);
	});

	it("returns null when vitest is null", () => {
		expect(reconcileResults(null, [])).toBeNull();
	});

	it("reconciles suite totals with journey data", () => {
		const vitest = {
			totalPassed: 3, totalFailed: 0, totalSkipped: 0, totalTests: 3, durationMs: 100,
			suites: [{
				name: "getting-started",
				file: "tests/getting-started.test.ts",
				cases: [
					{ name: "test > opens hub", status: "passed", durationMs: 10, error: null },
					{ name: "test > clicks button", status: "passed", durationMs: 5, error: null },
					{ name: "test > future feature", status: "passed", durationMs: 5, error: null },
				],
				hookError: null, suiteHookFailed: false, passed: 3, failed: 0, skipped: 0,
			}],
		};
		const journeys: JourneyEntry[] = [{
			dir: "/test",
			data: {
				journey: "Getting Started",
				steps: [
					{ step: { itBlock: "opens hub" }, status: "pass", durationMs: 10 },
					{ step: { itBlock: "clicks button" }, status: "skip", durationMs: 0 },
					{ step: { itBlock: "future feature" }, status: "dev", durationMs: 0 },
				],
			},
		}];
		const result = reconcileResults(vitest, journeys);
		expect(result).not.toBeNull();
		expect(result!.totalPassed).toBe(1);
		expect(result!.totalSkipped).toBe(1);
		expect(result!.totalDev).toBe(1);
	});
});
