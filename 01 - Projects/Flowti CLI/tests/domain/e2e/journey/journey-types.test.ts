import { describe, it, expect } from "vitest";
import { isRefStep, RISK_PRIORITY } from "../../../../src/domain/e2e/journey/journey-types.js";
import type { JourneyStep, JourneyRefStep, StepOrRef } from "../../../../src/domain/e2e/journey/journey-types.js";

// ── Fixtures ────────────────────────────────────────────────────────

const inlineStep: JourneyStep = {
	id: "step-1",
	title: "Open dashboard",
	description: "Navigate to the main dashboard",
	actions: [{ tool: "command", cmd: "echo hello" }],
};

const refStep: JourneyRefStep = { $ref: "login-journey#verify-auth" };

// ── Tests ───────────────────────────────────────────────────────────

describe("isRefStep", () => {
	it("returns true for a $ref step", () => {
		expect(isRefStep(refStep)).toBe(true);
	});

	it("returns false for an inline step", () => {
		expect(isRefStep(inlineStep)).toBe(false);
	});

	it("returns false when $ref is not a string", () => {
		const bad = { $ref: 42 } as unknown as StepOrRef;
		expect(isRefStep(bad)).toBe(false);
	});

	it("returns false for an empty object", () => {
		const empty = {} as unknown as StepOrRef;
		expect(isRefStep(empty)).toBe(false);
	});

	it("returns true even if extra fields are present alongside $ref", () => {
		const hybrid = { $ref: "other#step-1", extra: true } as unknown as StepOrRef;
		expect(isRefStep(hybrid)).toBe(true);
	});
});

describe("RISK_PRIORITY", () => {
	it("has four risk levels in order", () => {
		expect(RISK_PRIORITY).toEqual(["critical", "high", "medium", "low"]);
	});

	it("critical has the lowest index (highest priority)", () => {
		expect(RISK_PRIORITY.indexOf("critical")).toBe(0);
	});

	it("low has the highest index (lowest priority)", () => {
		expect(RISK_PRIORITY.indexOf("low")).toBe(3);
	});
});
