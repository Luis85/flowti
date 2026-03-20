import { describe, it, expect } from "vitest";
import { OPINION_TOPICS, assignOpinions, checkOpinionClash } from "../../../src/game/data/opinion-topics.js";

describe("opinion-topics", () => {
	it("has 15 topics", () => {
		expect(OPINION_TOPICS).toHaveLength(15);
	});

	it("every topic has unique id, sideA, sideB", () => {
		const ids = OPINION_TOPICS.map((t) => t.id);
		expect(new Set(ids).size).toBe(ids.length);
		for (const t of OPINION_TOPICS) {
			expect(t.sideA).toBeTruthy();
			expect(t.sideB).toBeTruthy();
			expect(t.sideA).not.toBe(t.sideB);
		}
	});

	it("assignOpinions returns 2-3 opinions", () => {
		const opinions = assignOpinions();
		expect(opinions.length).toBeGreaterThanOrEqual(2);
		expect(opinions.length).toBeLessThanOrEqual(3);
	});

	it("assignOpinions returns opinions with valid topic ids", () => {
		const opinions = assignOpinions();
		const validIds = new Set(OPINION_TOPICS.map((t) => t.id));
		for (const o of opinions) {
			expect(validIds.has(o.topic)).toBe(true);
			expect(o.side === "A" || o.side === "B").toBe(true);
		}
	});

	it("checkOpinionClash detects opposing opinions", () => {
		const a = [{ topic: "tabs-vs-spaces", side: "A" as const }];
		const b = [{ topic: "tabs-vs-spaces", side: "B" as const }];
		expect(checkOpinionClash(a, b)).toBe(true);
	});

	it("checkOpinionClash returns false for same side", () => {
		const a = [{ topic: "tabs-vs-spaces", side: "A" as const }];
		const b = [{ topic: "tabs-vs-spaces", side: "A" as const }];
		expect(checkOpinionClash(a, b)).toBe(false);
	});

	it("checkOpinionClash returns false for no shared topics", () => {
		const a = [{ topic: "tabs-vs-spaces", side: "A" as const }];
		const b = [{ topic: "coffee-vs-tea", side: "B" as const }];
		expect(checkOpinionClash(a, b)).toBe(false);
	});
});
