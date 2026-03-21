import { describe, it, expect } from "vitest";
import { scoreTaskFit } from "../../../src/domain/tasks/task-scoring.js";

describe("scoreTaskFit", () => {
	it("high INT scores better on analysis tasks", () => {
		const high = scoreTaskFit({ int: 18 }, { domain: "analysis" });
		const low = scoreTaskFit({ int: 8 }, { domain: "analysis" });
		expect(high).toBeGreaterThan(low);
		expect(high).toBeGreaterThan(50);
	});

	it("high CHA scores better on management tasks", () => {
		const high = scoreTaskFit({ cha: 16 }, { domain: "management" });
		const low = scoreTaskFit({ cha: 6 }, { domain: "management" });
		expect(high).toBeGreaterThan(low);
		expect(high).toBeGreaterThan(50);
	});

	it("low energy applies penalty", () => {
		const normal = scoreTaskFit({ int: 14 }, { domain: "engineering" });
		const tired = scoreTaskFit({ int: 14 }, { domain: "engineering" }, 10);
		expect(tired).toBeLessThan(normal);
	});

	it("unknown domain returns baseline score of 50", () => {
		const score = scoreTaskFit({ int: 15, cha: 12 }, { domain: "unknowndomain" });
		expect(score).toBe(50);
	});

	it("no domain returns baseline score of 50", () => {
		const score = scoreTaskFit({ int: 15 }, {});
		expect(score).toBe(50);
	});

	it("score clamped to 0 at minimum", () => {
		const score = scoreTaskFit({ cha: 1 }, { domain: "management" }, 10);
		expect(score).toBeGreaterThanOrEqual(0);
	});

	it("score clamped to 100 at maximum", () => {
		const score = scoreTaskFit({ int: 30 }, { domain: "engineering" });
		expect(score).toBeLessThanOrEqual(100);
	});
});
