import { describe, it, expect } from "vitest";
import { computePyramid, computeTrend, applyTrends } from "../../../src/domain/testManagement/pyramidCalculator";
import type { JourneyRegistryEntry, TestPyramidState } from "../../../src/domain/testManagement/types";

function makeJourney(name: string, failed = 0): JourneyRegistryEntry {
	return {
		name,
		type: "functional",
		actors: [],
		services: [],
		stepCount: 3,
		tools: [],
		jsonPath: `${name}.json`,
		complianceTags: [],
		lastRunResult: { date: new Date().toISOString(), totalSteps: 3, passed: 3 - failed, failed, skipped: 0, durationMs: 1000 },
		runHistory: [],
	};
}

describe("computePyramid", () => {
	it("computes E2E layer from journey registry", () => {
		const journeys = [makeJourney("A"), makeJourney("B"), makeJourney("C", 1)];
		const result = computePyramid(journeys);

		expect(result.e2e.count).toBe(3);
		expect(result.e2e.passRate).toBe(67); // 2/3 = 66.67 → 67
	});

	it("returns zero E2E pass rate for empty journeys", () => {
		const result = computePyramid([]);
		expect(result.e2e.count).toBe(0);
		expect(result.e2e.passRate).toBe(0);
	});

	it("uses provided flow and unit metrics", () => {
		const result = computePyramid([], 42, 95, 284, 100);
		expect(result.flow.count).toBe(42);
		expect(result.flow.passRate).toBe(95);
		expect(result.unit.count).toBe(284);
		expect(result.unit.passRate).toBe(100);
	});

	it("defaults flow/unit to zero when not provided", () => {
		const result = computePyramid([]);
		expect(result.flow.count).toBe(0);
		expect(result.flow.passRate).toBe(0);
		expect(result.unit.count).toBe(0);
		expect(result.unit.passRate).toBe(0);
	});

	it("handles journeys with no run results", () => {
		const journey: JourneyRegistryEntry = {
			name: "No Run",
			type: "functional",
			actors: [],
			services: [],
			stepCount: 1,
			tools: [],
			jsonPath: "test.json",
			complianceTags: [],
			runHistory: [],
		};
		const result = computePyramid([journey]);
		expect(result.e2e.count).toBe(1);
		expect(result.e2e.passRate).toBe(0);
	});

	it("100% pass rate when all journeys pass", () => {
		const journeys = [makeJourney("A"), makeJourney("B")];
		const result = computePyramid(journeys);
		expect(result.e2e.passRate).toBe(100);
	});
});

describe("computeTrend", () => {
	it("returns up when current exceeds baseline", () => {
		expect(computeTrend(10, 5)).toBe("up");
	});

	it("returns down when current is below baseline", () => {
		expect(computeTrend(3, 8)).toBe("down");
	});

	it("returns stable when values are equal", () => {
		expect(computeTrend(5, 5)).toBe("stable");
	});
});

describe("applyTrends", () => {
	it("applies trend indicators from baseline comparison", () => {
		const current: TestPyramidState = {
			e2e: { count: 10, passRate: 90, trend: "stable" },
			flow: { count: 40, passRate: 95, trend: "stable" },
			unit: { count: 280, passRate: 100, trend: "stable" },
		};
		const baseline: TestPyramidState = {
			e2e: { count: 8, passRate: 88, trend: "stable" },
			flow: { count: 40, passRate: 95, trend: "stable" },
			unit: { count: 300, passRate: 100, trend: "stable" },
		};
		const result = applyTrends(current, baseline);
		expect(result.e2e.trend).toBe("up");
		expect(result.flow.trend).toBe("stable");
		expect(result.unit.trend).toBe("down");
	});
});
