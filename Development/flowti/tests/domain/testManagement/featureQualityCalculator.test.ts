import { describe, it, expect } from "vitest";
import { computeFeatureQuality, computeFeatureTestHistory } from "../../../src/domain/testManagement/featureQualityCalculator";
import type { JourneyRegistryEntry } from "../../../src/domain/testManagement/types";

function makeJourney(overrides: Partial<JourneyRegistryEntry> & { name: string }): JourneyRegistryEntry {
	return {
		type: "functional",
		actors: [],
		services: [],
		stepCount: 5,
		tools: [],
		jsonPath: "",
		complianceTags: [],
		runHistory: [],
		...overrides,
	};
}

describe("computeFeatureQuality", () => {
	it("returns empty array when no feature names provided", () => {
		const result = computeFeatureQuality([], []);
		expect(result).toEqual([]);
	});

	it("returns zero metrics when feature has no linked journeys", () => {
		const result = computeFeatureQuality([], ["Unlinked Feature"]);
		expect(result).toHaveLength(1);
		expect(result[0].featureName).toBe("Unlinked Feature");
		expect(result[0].journeyCount).toBe(0);
		expect(result[0].passRate).toBe(0);
	});

	it("links journeys by feature field", () => {
		const journeys = [
			makeJourney({ name: "J1", feature: "Feature A" }),
			makeJourney({ name: "J2", feature: "Feature B" }),
		];
		const result = computeFeatureQuality(journeys, ["Feature A"]);
		expect(result[0].journeyCount).toBe(1);
		expect(result[0].journeyNames).toEqual(["J1"]);
	});

	it("links journeys by prd field", () => {
		const journeys = [
			makeJourney({ name: "J1", prd: "Feature A" }),
		];
		const result = computeFeatureQuality(journeys, ["Feature A"]);
		expect(result[0].journeyCount).toBe(1);
	});

	it("links journeys by domain field", () => {
		const journeys = [
			makeJourney({ name: "J1", domain: "Feature A" }),
		];
		const result = computeFeatureQuality(journeys, ["Feature A"]);
		expect(result[0].journeyCount).toBe(1);
	});

	it("computes pass rate from latest run results", () => {
		const journeys = [
			makeJourney({
				name: "J1",
				feature: "F1",
				lastRunResult: { date: "2026-03-06", totalSteps: 10, passed: 8, failed: 2, skipped: 0, durationMs: 100 },
			}),
			makeJourney({
				name: "J2",
				feature: "F1",
				lastRunResult: { date: "2026-03-06", totalSteps: 10, passed: 10, failed: 0, skipped: 0, durationMs: 50 },
			}),
		];
		const result = computeFeatureQuality(journeys, ["F1"]);
		// 18/20 = 90%
		expect(result[0].passRate).toBe(90);
		expect(result[0].passedSteps).toBe(18);
		expect(result[0].failedSteps).toBe(2);
	});

	it("uses stepCount when no run results available", () => {
		const journeys = [
			makeJourney({ name: "J1", feature: "F1", stepCount: 8 }),
		];
		const result = computeFeatureQuality(journeys, ["F1"]);
		expect(result[0].totalSteps).toBe(8);
		expect(result[0].passRate).toBe(0);
	});

	it("falls back to last runHistory entry when no lastRunResult", () => {
		const journeys = [
			makeJourney({
				name: "J1",
				feature: "F1",
				runHistory: [
					{ date: "2026-03-05", totalSteps: 5, passed: 5, failed: 0, skipped: 0, durationMs: 50 },
				],
			}),
		];
		const result = computeFeatureQuality(journeys, ["F1"]);
		expect(result[0].passRate).toBe(100);
	});

	it("sorts results by feature name", () => {
		const result = computeFeatureQuality([], ["Zebra", "Alpha", "Middle"]);
		expect(result.map((r) => r.featureName)).toEqual(["Alpha", "Middle", "Zebra"]);
	});

	describe("trend computation", () => {
		it("returns unknown when fewer than 2 runs", () => {
			const journeys = [
				makeJourney({ name: "J1", feature: "F1", runHistory: [
					{ date: "2026-03-06", totalSteps: 5, passed: 5, failed: 0, skipped: 0, durationMs: 50 },
				]}),
			];
			const result = computeFeatureQuality(journeys, ["F1"]);
			expect(result[0].trend).toBe("unknown");
		});

		it("returns improving when newer runs have higher pass rate", () => {
			const journeys = [
				makeJourney({ name: "J1", feature: "F1", runHistory: [
					{ date: "2026-03-01", totalSteps: 10, passed: 3, failed: 7, skipped: 0, durationMs: 50 },
					{ date: "2026-03-02", totalSteps: 10, passed: 4, failed: 6, skipped: 0, durationMs: 50 },
					{ date: "2026-03-03", totalSteps: 10, passed: 8, failed: 2, skipped: 0, durationMs: 50 },
					{ date: "2026-03-04", totalSteps: 10, passed: 9, failed: 1, skipped: 0, durationMs: 50 },
				]}),
			];
			const result = computeFeatureQuality(journeys, ["F1"]);
			expect(result[0].trend).toBe("improving");
		});

		it("returns degrading when newer runs have lower pass rate", () => {
			const journeys = [
				makeJourney({ name: "J1", feature: "F1", runHistory: [
					{ date: "2026-03-01", totalSteps: 10, passed: 9, failed: 1, skipped: 0, durationMs: 50 },
					{ date: "2026-03-02", totalSteps: 10, passed: 8, failed: 2, skipped: 0, durationMs: 50 },
					{ date: "2026-03-03", totalSteps: 10, passed: 4, failed: 6, skipped: 0, durationMs: 50 },
					{ date: "2026-03-04", totalSteps: 10, passed: 3, failed: 7, skipped: 0, durationMs: 50 },
				]}),
			];
			const result = computeFeatureQuality(journeys, ["F1"]);
			expect(result[0].trend).toBe("degrading");
		});

		it("returns stable when pass rate is consistent", () => {
			const journeys = [
				makeJourney({ name: "J1", feature: "F1", runHistory: [
					{ date: "2026-03-01", totalSteps: 10, passed: 8, failed: 2, skipped: 0, durationMs: 50 },
					{ date: "2026-03-02", totalSteps: 10, passed: 8, failed: 2, skipped: 0, durationMs: 50 },
					{ date: "2026-03-03", totalSteps: 10, passed: 8, failed: 2, skipped: 0, durationMs: 50 },
					{ date: "2026-03-04", totalSteps: 10, passed: 8, failed: 2, skipped: 0, durationMs: 50 },
				]}),
			];
			const result = computeFeatureQuality(journeys, ["F1"]);
			expect(result[0].trend).toBe("stable");
		});
	});

	it("handles multiple features correctly", () => {
		const journeys = [
			makeJourney({ name: "J1", feature: "F1", lastRunResult: { date: "2026-03-06", totalSteps: 5, passed: 5, failed: 0, skipped: 0, durationMs: 50 } }),
			makeJourney({ name: "J2", feature: "F2", lastRunResult: { date: "2026-03-06", totalSteps: 5, passed: 3, failed: 2, skipped: 0, durationMs: 50 } }),
			makeJourney({ name: "J3", feature: "F1", lastRunResult: { date: "2026-03-06", totalSteps: 5, passed: 4, failed: 1, skipped: 0, durationMs: 50 } }),
		];
		const result = computeFeatureQuality(journeys, ["F1", "F2"]);
		expect(result).toHaveLength(2);

		const f1 = result.find((r) => r.featureName === "F1")!;
		expect(f1.journeyCount).toBe(2);
		expect(f1.passRate).toBe(90); // 9/10

		const f2 = result.find((r) => r.featureName === "F2")!;
		expect(f2.journeyCount).toBe(1);
		expect(f2.passRate).toBe(60); // 3/5
	});
});

describe("computeFeatureTestHistory", () => {
	it("returns empty history when no linked journeys", () => {
		const result = computeFeatureTestHistory([], "Unknown Feature");
		expect(result.featureName).toBe("Unknown Feature");
		expect(result.entries).toHaveLength(0);
		expect(result.dateGroups).toHaveLength(0);
		expect(result.trend).toBe("unknown");
	});

	it("aggregates runs from multiple journeys", () => {
		const journeys = [
			makeJourney({ name: "J1", feature: "F1", runHistory: [
				{ date: "2026-03-05T10:00:00Z", totalSteps: 5, passed: 5, failed: 0, skipped: 0, durationMs: 50 },
			]}),
			makeJourney({ name: "J2", feature: "F1", runHistory: [
				{ date: "2026-03-05T14:00:00Z", totalSteps: 3, passed: 2, failed: 1, skipped: 0, durationMs: 30 },
			]}),
		];
		const result = computeFeatureTestHistory(journeys, "F1");
		expect(result.entries).toHaveLength(2);
	});

	it("sorts entries newest first", () => {
		const journeys = [
			makeJourney({ name: "J1", feature: "F1", runHistory: [
				{ date: "2026-03-01T10:00:00Z", totalSteps: 5, passed: 3, failed: 2, skipped: 0, durationMs: 50 },
				{ date: "2026-03-03T10:00:00Z", totalSteps: 5, passed: 5, failed: 0, skipped: 0, durationMs: 50 },
				{ date: "2026-03-02T10:00:00Z", totalSteps: 5, passed: 4, failed: 1, skipped: 0, durationMs: 50 },
			]}),
		];
		const result = computeFeatureTestHistory(journeys, "F1");
		expect(result.entries[0].date).toBe("2026-03-03T10:00:00Z");
		expect(result.entries[1].date).toBe("2026-03-02T10:00:00Z");
		expect(result.entries[2].date).toBe("2026-03-01T10:00:00Z");
	});

	it("groups entries by date", () => {
		const journeys = [
			makeJourney({ name: "J1", feature: "F1", runHistory: [
				{ date: "2026-03-05T10:00:00Z", totalSteps: 5, passed: 5, failed: 0, skipped: 0, durationMs: 50 },
				{ date: "2026-03-05T14:00:00Z", totalSteps: 5, passed: 4, failed: 1, skipped: 0, durationMs: 50 },
				{ date: "2026-03-04T10:00:00Z", totalSteps: 5, passed: 3, failed: 2, skipped: 0, durationMs: 50 },
			]}),
		];
		const result = computeFeatureTestHistory(journeys, "F1");
		expect(result.dateGroups).toHaveLength(2);
		expect(result.dateGroups[0].date).toBe("2026-03-05");
		expect(result.dateGroups[0].entries).toHaveLength(2);
		expect(result.dateGroups[1].date).toBe("2026-03-04");
		expect(result.dateGroups[1].entries).toHaveLength(1);
	});

	it("computes pass rate per entry", () => {
		const journeys = [
			makeJourney({ name: "J1", feature: "F1", runHistory: [
				{ date: "2026-03-05T10:00:00Z", totalSteps: 10, passed: 7, failed: 3, skipped: 0, durationMs: 50 },
			]}),
		];
		const result = computeFeatureTestHistory(journeys, "F1");
		expect(result.entries[0].passRate).toBe(70);
	});

	it("includes lastRunResult in history", () => {
		const journeys = [
			makeJourney({ name: "J1", feature: "F1",
				runHistory: [
					{ date: "2026-03-04T10:00:00Z", totalSteps: 5, passed: 3, failed: 2, skipped: 0, durationMs: 50 },
				],
				lastRunResult: { date: "2026-03-05T10:00:00Z", totalSteps: 5, passed: 5, failed: 0, skipped: 0, durationMs: 50 },
			}),
		];
		const result = computeFeatureTestHistory(journeys, "F1");
		expect(result.entries).toHaveLength(2);
		expect(result.entries[0].passRate).toBe(100); // Latest
	});

	it("includes journey name in each entry", () => {
		const journeys = [
			makeJourney({ name: "Getting Started", feature: "F1", runHistory: [
				{ date: "2026-03-05T10:00:00Z", totalSteps: 5, passed: 5, failed: 0, skipped: 0, durationMs: 50 },
			]}),
		];
		const result = computeFeatureTestHistory(journeys, "F1");
		expect(result.entries[0].journeyName).toBe("Getting Started");
	});

	it("computes trend from linked journeys", () => {
		const journeys = [
			makeJourney({ name: "J1", feature: "F1", runHistory: [
				{ date: "2026-03-01", totalSteps: 10, passed: 3, failed: 7, skipped: 0, durationMs: 50 },
				{ date: "2026-03-02", totalSteps: 10, passed: 5, failed: 5, skipped: 0, durationMs: 50 },
				{ date: "2026-03-03", totalSteps: 10, passed: 8, failed: 2, skipped: 0, durationMs: 50 },
				{ date: "2026-03-04", totalSteps: 10, passed: 9, failed: 1, skipped: 0, durationMs: 50 },
			]}),
		];
		const result = computeFeatureTestHistory(journeys, "F1");
		expect(result.trend).toBe("improving");
	});

	it("handles zero totalSteps gracefully", () => {
		const journeys = [
			makeJourney({ name: "J1", feature: "F1", runHistory: [
				{ date: "2026-03-05", totalSteps: 0, passed: 0, failed: 0, skipped: 0, durationMs: 0 },
			]}),
		];
		const result = computeFeatureTestHistory(journeys, "F1");
		expect(result.entries[0].passRate).toBe(0);
	});
});
