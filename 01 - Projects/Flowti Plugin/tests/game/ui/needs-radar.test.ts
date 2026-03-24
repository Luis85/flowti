// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest";

vi.mock("lit", () => ({
	html: (strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values }),
	css: () => ({}),
	nothing: Symbol("nothing"),
}));

vi.mock("../../../src/game/ui/game-styles.js", () => ({
	resetStyles: {}, colorStyles: {}, fontStyles: {}, buttonStyles: {}, scrollStyles: {},
}));

vi.mock("../../../src/game/ui/game-ui-constants.js", () => ({
	NEED_META: [
		{ label: "Energy", key: "energy", color: "#22c55e" },
		{ label: "Hunger", key: "hunger", color: "#f97316" },
		{ label: "Thirst", key: "thirst", color: "#06b6d4" },
		{ label: "Focus", key: "focus", color: "#a855f7" },
		{ label: "Social", key: "social", color: "#f59e0b" },
		{ label: "Morale", key: "morale", color: "#ec4899" },
	],
	NEED_WARN_THRESHOLD: 60,
	NEED_CRITICAL_THRESHOLD: 25,
}));

import { renderNeedsRadar, getRadarHealthColor } from "../../../src/game/ui/needs-radar.js";

describe("getRadarHealthColor", () => {
	it("returns green when all needs >= 60", () => {
		const needs = { energy: 80, hunger: 70, thirst: 90, focus: 60, social: 75, morale: 65 };
		expect(getRadarHealthColor(needs)).toBe("green");
	});

	it("returns amber when any need is 25-59", () => {
		const needs = { energy: 80, hunger: 40, thirst: 90, focus: 60, social: 75, morale: 65 };
		expect(getRadarHealthColor(needs)).toBe("amber");
	});

	it("returns red when any need < 25", () => {
		const needs = { energy: 80, hunger: 10, thirst: 90, focus: 60, social: 75, morale: 65 };
		expect(getRadarHealthColor(needs)).toBe("red");
	});

	it("returns red when need is exactly 0", () => {
		const needs = { energy: 0, hunger: 50, thirst: 50, focus: 50, social: 50, morale: 50 };
		expect(getRadarHealthColor(needs)).toBe("red");
	});

	it("returns green when all needs are exactly 60", () => {
		const needs = { energy: 60, hunger: 60, thirst: 60, focus: 60, social: 60, morale: 60 };
		expect(getRadarHealthColor(needs)).toBe("green");
	});

	it("returns amber when need is exactly 25", () => {
		const needs = { energy: 25, hunger: 80, thirst: 80, focus: 80, social: 80, morale: 80 };
		expect(getRadarHealthColor(needs)).toBe("amber");
	});
});

describe("renderNeedsRadar", () => {
	it("returns a template result", () => {
		const needs = { energy: 80, hunger: 70, thirst: 90, focus: 60, social: 75, morale: 65 };
		const result = renderNeedsRadar(needs, 30);
		expect(result).toBeDefined();
		expect(result.strings).toBeDefined();
	});

	it("includes svg element in template", () => {
		const needs = { energy: 50, hunger: 50, thirst: 50, focus: 50, social: 50, morale: 50 };
		const result = renderNeedsRadar(needs, 30);
		const joined = result.strings.join("");
		expect(joined).toContain("<svg");
		expect(joined).toContain("polygon");
	});

	it("passes size parameter as template values", () => {
		const needs = { energy: 50, hunger: 50, thirst: 50, focus: 50, social: 50, morale: 50 };
		const result = renderNeedsRadar(needs, 40);
		expect(result.values).toContain(40);
	});

	it("handles undefined needs gracefully", () => {
		const result = renderNeedsRadar(undefined as any, 30);
		expect(result).toBeDefined();
	});
});
