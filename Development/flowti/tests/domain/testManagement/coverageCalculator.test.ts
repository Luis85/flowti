import { describe, it, expect } from "vitest";
import { computeCoverage, computeDomainCoverage, findGaps } from "../../../src/domain/testManagement/coverageCalculator";
import type { JourneyRegistryEntry } from "../../../src/domain/testManagement/types";

function makeJourney(name: string, domain?: string, prd?: string, failed = 0): JourneyRegistryEntry {
	return {
		name,
		type: "functional",
		domain,
		prd,
		actors: [],
		services: [],
		stepCount: 1,
		tools: [],
		jsonPath: `${name}.json`,
		complianceTags: [],
		lastRunResult: { date: new Date().toISOString(), totalSteps: 3, passed: 3 - failed, failed, skipped: 0, durationMs: 1000 },
		runHistory: [],
	};
}

describe("computeCoverage", () => {
	it("marks PRD as covered when a passing journey matches by domain", () => {
		const prds = [{ name: "Analytics PRD", stage: "done", domain: "analytics" }];
		const journeys = [makeJourney("Analytics E2E", "analytics")];
		const result = computeCoverage(prds, journeys);

		expect(result).toHaveLength(1);
		expect(result[0].status).toBe("covered");
		expect(result[0].journeyCount).toBe(1);
		expect(result[0].journeyNames).toEqual(["Analytics E2E"]);
	});

	it("marks PRD as uncovered when no journeys match", () => {
		const prds = [{ name: "Settings PRD", stage: "in-progress", domain: "settings" }];
		const journeys = [makeJourney("Analytics E2E", "analytics")];
		const result = computeCoverage(prds, journeys);

		expect(result[0].status).toBe("uncovered");
		expect(result[0].journeyCount).toBe(0);
	});

	it("marks PRD as partial when journeys exist but none passing", () => {
		const prds = [{ name: "Signal PRD", stage: "done", domain: "signal" }];
		const journeys = [makeJourney("Signal E2E", "signal", undefined, 2)];
		const result = computeCoverage(prds, journeys);

		expect(result[0].status).toBe("partial");
	});

	it("links by explicit prd field over domain", () => {
		const prds = [{ name: "Analytics PRD", stage: "done", domain: "analytics" }];
		const journeys = [
			makeJourney("Cross-Domain Test", "other-domain", "Analytics PRD"),
		];
		const result = computeCoverage(prds, journeys);

		expect(result[0].status).toBe("covered");
		expect(result[0].journeyNames).toEqual(["Cross-Domain Test"]);
	});

	it("counts multiple journeys for a single PRD", () => {
		const prds = [{ name: "Hub PRD", stage: "done", domain: "hub" }];
		const journeys = [
			makeJourney("Hub Smoke", "hub"),
			makeJourney("Hub Regression", "hub"),
		];
		const result = computeCoverage(prds, journeys);

		expect(result[0].journeyCount).toBe(2);
	});

	it("handles empty PRD list", () => {
		const result = computeCoverage([], [makeJourney("A")]);
		expect(result).toEqual([]);
	});

	it("handles empty journey list", () => {
		const prds = [{ name: "PRD", stage: "done", domain: "test" }];
		const result = computeCoverage(prds, []);
		expect(result[0].status).toBe("uncovered");
	});
});

describe("computeDomainCoverage", () => {
	it("aggregates coverage per domain", () => {
		const entries = [
			{ prdName: "A", prdStage: "done", domain: "analytics", journeyCount: 2, journeyNames: [], status: "covered" as const },
			{ prdName: "B", prdStage: "done", domain: "analytics", journeyCount: 0, journeyNames: [], status: "uncovered" as const },
			{ prdName: "C", prdStage: "done", domain: "hub", journeyCount: 1, journeyNames: [], status: "covered" as const },
		];
		const result = computeDomainCoverage(entries);

		expect(result.analytics).toEqual({ total: 2, covered: 1 });
		expect(result.hub).toEqual({ total: 1, covered: 1 });
	});

	it("uses 'unknown' for entries with no domain", () => {
		const entries = [
			{ prdName: "X", prdStage: "done", domain: "", journeyCount: 0, journeyNames: [], status: "uncovered" as const },
		];
		const result = computeDomainCoverage(entries);
		expect(result.unknown).toEqual({ total: 1, covered: 0 });
	});
});

describe("findGaps", () => {
	it("returns uncovered PRDs that are in-progress or done", () => {
		const entries = [
			{ prdName: "A", prdStage: "done", domain: "a", journeyCount: 0, journeyNames: [], status: "uncovered" as const },
			{ prdName: "B", prdStage: "in-progress", domain: "b", journeyCount: 0, journeyNames: [], status: "uncovered" as const },
			{ prdName: "C", prdStage: "draft", domain: "c", journeyCount: 0, journeyNames: [], status: "uncovered" as const },
			{ prdName: "D", prdStage: "done", domain: "d", journeyCount: 1, journeyNames: ["D"], status: "covered" as const },
		];
		const gaps = findGaps(entries);

		expect(gaps).toHaveLength(2);
		expect(gaps.map((g) => g.prdName)).toEqual(["A", "B"]);
	});

	it("returns empty array when no gaps", () => {
		const entries = [
			{ prdName: "A", prdStage: "done", domain: "a", journeyCount: 1, journeyNames: ["A"], status: "covered" as const },
		];
		expect(findGaps(entries)).toEqual([]);
	});
});
