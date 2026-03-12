import { describe, it, expect } from "vitest";
import { analyzeFinancials } from "../../../src/domain/resources/resource-analysis.js";
import type { ResourceSummary } from "../../../src/domain/resources/resource-types.js";

function resource(overrides: Partial<ResourceSummary> = {}): ResourceSummary {
	return {
		name: "Test", resourceType: "human", price: 100, amount: 1,
		consumed: 0, remaining: 1, totalCost: 100, consumedCost: 0, file: "test.md",
		...overrides,
	};
}

describe("analyzeFinancials", () => {
	it("returns zeroes for empty resources", () => {
		const result = analyzeFinancials([]);

		expect(result.totalBudget).toBe(0);
		expect(result.totalConsumed).toBe(0);
		expect(result.totalRemaining).toBe(0);
		expect(result.burnRate).toBe(0);
	});

	it("sums budget and consumed across resources", () => {
		const resources = [
			resource({ totalCost: 1000, consumedCost: 400 }),
			resource({ totalCost: 500, consumedCost: 250 }),
		];

		const result = analyzeFinancials(resources);

		expect(result.totalBudget).toBe(1500);
		expect(result.totalConsumed).toBe(650);
		expect(result.totalRemaining).toBe(850);
	});

	it("calculates burn rate as consumed / budget", () => {
		const resources = [
			resource({ totalCost: 1000, consumedCost: 500 }),
		];

		const result = analyzeFinancials(resources);

		expect(result.burnRate).toBe(0.5);
	});

	it("groups by resource type", () => {
		const resources = [
			resource({ resourceType: "human", totalCost: 1000, consumedCost: 400 }),
			resource({ resourceType: "material", totalCost: 500, consumedCost: 100 }),
			resource({ resourceType: "role", totalCost: 300, consumedCost: 150 }),
		];

		const result = analyzeFinancials(resources);

		expect(result.byType.human).toEqual({ budget: 1000, consumed: 400 });
		expect(result.byType.material).toEqual({ budget: 500, consumed: 100 });
		expect(result.byType.role).toEqual({ budget: 300, consumed: 150 });
	});

	it("handles multiple resources of same type", () => {
		const resources = [
			resource({ resourceType: "human", totalCost: 1000, consumedCost: 400 }),
			resource({ resourceType: "human", totalCost: 800, consumedCost: 200 }),
		];

		const result = analyzeFinancials(resources);

		expect(result.byType.human).toEqual({ budget: 1800, consumed: 600 });
	});
});
