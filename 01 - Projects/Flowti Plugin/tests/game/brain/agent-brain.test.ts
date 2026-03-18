import { describe, it, expect } from "vitest";
import { transition, computeParams, computeHabits } from "../../../src/game/brain/agent-brain.js";

describe("transition", () => {
	it("idle → walking-to on task-started event", () => {
		expect(transition("idle", { type: "task-started" }).state).toBe("walking-to");
	});
	it("idle → working on thinking event", () => {
		expect(transition("idle", { type: "thinking" }).state).toBe("working");
	});
	it("working → idle on idle event", () => {
		expect(transition("working", { type: "idle" }).state).toBe("idle");
	});
	it("returns current state for unknown event", () => {
		expect(transition("idle", { type: "queued" }).state).toBe("waiting");
	});
	it("waiting → working on permission-granted", () => {
		expect(transition("waiting", { type: "permission-granted" }).state).toBe("working");
	});
	it("waiting → idle on permission-denied", () => {
		expect(transition("waiting", { type: "permission-denied" }).state).toBe("idle");
	});
});

describe("computeParams", () => {
	it("returns default params with no attributes", () => {
		const params = computeParams({});
		expect(params.speedMultiplier).toBeGreaterThan(0);
		expect(params.socialRadius).toBeGreaterThan(0);
	});
	it("high CHA increases social radius", () => {
		const low = computeParams({ cha: 5 });
		const high = computeParams({ cha: 20 });
		expect(high.socialRadius).toBeGreaterThan(low.socialRadius);
	});
	it("high DEX increases speed multiplier", () => {
		const low = computeParams({ dex: 5 });
		const high = computeParams({ dex: 20 });
		expect(high.speedMultiplier).toBeGreaterThan(low.speedMultiplier);
	});
});

describe("computeHabits", () => {
	it("returns habits object", () => {
		const habits = computeHabits({}, "neutral", "engineering");
		expect(habits).toBeDefined();
	});
	it("engineering domain maps to office home room", () => {
		const habits = computeHabits({}, "neutral", "engineering");
		expect(habits.homeRoom).toBe("office");
	});
	it("unknown domain maps to hub home room", () => {
		const habits = computeHabits({}, "neutral", "unknown-domain");
		expect(habits.homeRoom).toBe("hub");
	});
	it("happy mood increases idle resistance multiplier", () => {
		const habits = computeHabits({}, "happy", "engineering");
		expect(habits.idleResistanceMult).toBeGreaterThan(1.0);
	});
	it("frustrated mood decreases idle resistance multiplier", () => {
		const habits = computeHabits({}, "frustrated", "engineering");
		expect(habits.idleResistanceMult).toBeLessThan(1.0);
	});
});
