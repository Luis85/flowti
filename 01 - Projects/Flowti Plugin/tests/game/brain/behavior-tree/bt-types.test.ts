import { describe, it, expect } from "vitest";
import {
	createDefaultNeeds,
	createIdleLLMSlot,
	parseGoalType,
} from "../../../../src/game/brain/behavior-tree/bt-types.js";

describe("bt-types", () => {
	describe("createDefaultNeeds", () => {
		it("returns needs at default levels", () => {
			const needs = createDefaultNeeds();
			expect(needs).toEqual({ energy: 80, social: 60, focus: 70, morale: 75, hunger: 80, thirst: 80 });
		});
	});

	describe("createIdleLLMSlot", () => {
		it("returns idle slot with no process or result", () => {
			const slot = createIdleLLMSlot();
			expect(slot).toEqual({ state: "idle", process: null, result: null });
		});
	});

	describe("parseGoalType", () => {
		it("extracts known goal type from goal name", () => {
			expect(parseGoalType("review iteration plan")).toBe("review");
			expect(parseGoalType("summarize health report")).toBe("summarize");
			expect(parseGoalType("plan next sprint")).toBe("plan");
			expect(parseGoalType("implement auth module")).toBe("implement");
			expect(parseGoalType("monitor test results")).toBe("monitor");
			expect(parseGoalType("report on progress")).toBe("report");
		});

		it("returns undefined for unrecognized goal names", () => {
			expect(parseGoalType("do something random")).toBeUndefined();
			expect(parseGoalType("")).toBeUndefined();
		});

		it("is case-insensitive", () => {
			expect(parseGoalType("Review the spec")).toBe("review");
			expect(parseGoalType("SUMMARIZE findings")).toBe("summarize");
		});
	});
});
