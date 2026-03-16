import { describe, it, expect } from "vitest";
import { computeHabits } from "../../src/brain/agent-brain.js";

describe("computeHabits", () => {
	it("low DEX (1-7) → deliberate movement", () => {
		const habits = computeHabits({ str: 10, int: 10, wis: 10, cha: 10, dex: 5, con: 10 }, "neutral", "engineering");
		expect(habits.movementStyle).toBe("deliberate");
	});

	it("mid DEX (8-13) → brisk movement", () => {
		const habits = computeHabits({ str: 10, int: 10, wis: 10, cha: 10, dex: 10, con: 10 }, "neutral", "engineering");
		expect(habits.movementStyle).toBe("brisk");
	});

	it("high DEX (14-20) → darting movement", () => {
		const habits = computeHabits({ str: 10, int: 10, wis: 10, cha: 10, dex: 18, con: 10 }, "neutral", "engineering");
		expect(habits.movementStyle).toBe("darting");
	});

	it("low CON → fidgety idle", () => {
		const habits = computeHabits({ str: 10, int: 10, wis: 10, cha: 10, dex: 10, con: 3 }, "neutral", "engineering");
		expect(habits.idleStyle).toBe("fidgety");
	});

	it("mid CON → restless idle", () => {
		const habits = computeHabits({ str: 10, int: 10, wis: 10, cha: 10, dex: 10, con: 10 }, "neutral", "engineering");
		expect(habits.idleStyle).toBe("restless");
	});

	it("high CON → calm idle", () => {
		const habits = computeHabits({ str: 10, int: 10, wis: 10, cha: 10, dex: 10, con: 18 }, "neutral", "engineering");
		expect(habits.idleStyle).toBe("calm");
	});

	it("CHA drives socialDrift (0-1 range)", () => {
		const low = computeHabits({ str: 10, int: 10, wis: 10, cha: 2, dex: 10, con: 10 }, "neutral", "engineering");
		const high = computeHabits({ str: 10, int: 10, wis: 10, cha: 20, dex: 10, con: 10 }, "neutral", "engineering");
		expect(low.socialDrift).toBeLessThan(0.2);
		expect(high.socialDrift).toBe(1.0);
	});

	it("INT drives focusDrift (0-1 range)", () => {
		const low = computeHabits({ str: 10, int: 2, wis: 10, cha: 10, dex: 10, con: 10 }, "neutral", "engineering");
		const high = computeHabits({ str: 10, int: 20, wis: 10, cha: 10, dex: 10, con: 10 }, "neutral", "engineering");
		expect(low.focusDrift).toBeLessThan(0.2);
		expect(high.focusDrift).toBe(1.0);
	});

	it("CON drives breakThreshold (12-50s)", () => {
		const low = computeHabits({ str: 10, int: 10, wis: 10, cha: 10, dex: 10, con: 1 }, "neutral", "engineering");
		const high = computeHabits({ str: 10, int: 10, wis: 10, cha: 10, dex: 10, con: 20 }, "neutral", "engineering");
		expect(low.breakThreshold).toBe(12);
		expect(high.breakThreshold).toBe(50);
	});

	it("WIS drives settlingPause (250-1200ms)", () => {
		const low = computeHabits({ str: 10, int: 10, wis: 1, cha: 10, dex: 10, con: 10 }, "neutral", "engineering");
		const high = computeHabits({ str: 10, int: 10, wis: 20, cha: 10, dex: 10, con: 10 }, "neutral", "engineering");
		expect(low.settlingPause).toBe(250);
		expect(high.settlingPause).toBe(1200);
	});

	it("preferredWorkstationId starts as null", () => {
		const habits = computeHabits({ str: 10, int: 10, wis: 10, cha: 10, dex: 10, con: 10 }, "neutral", "engineering");
		expect(habits.preferredWorkstationId).toBeNull();
	});

	it("domain maps to homeRoom via resolveSettingForDomain", () => {
		expect(computeHabits({}, "neutral", "engineering").homeRoom).toBe("office");
		expect(computeHabits({}, "neutral", "design").homeRoom).toBe("village");
		expect(computeHabits({}, "neutral", "management").homeRoom).toBe("station");
	});
});

describe("computeHabits — mood multipliers", () => {
	const baseAttrs = { str: 10, int: 10, wis: 10, cha: 10, dex: 10, con: 10 };

	it("happy mood increases idleResistanceMult by 20%", () => {
		const happy = computeHabits(baseAttrs, "happy", "engineering");
		expect(happy.idleResistanceMult).toBeCloseTo(1.2, 2);
	});

	it("frustrated mood decreases idleResistanceMult by 30%", () => {
		const frustrated = computeHabits(baseAttrs, "frustrated", "engineering");
		expect(frustrated.idleResistanceMult).toBeCloseTo(0.7, 2);
	});

	it("frustrated mood increases speedMult by 15%", () => {
		const frustrated = computeHabits(baseAttrs, "frustrated", "engineering");
		expect(frustrated.speedMult).toBeCloseTo(1.15, 2);
	});

	it("focused mood decreases socialDrift by 50%", () => {
		const neutral = computeHabits(baseAttrs, "neutral", "engineering");
		const focused = computeHabits(baseAttrs, "focused", "engineering");
		expect(focused.socialDrift).toBeCloseTo(neutral.socialDrift * 0.5, 2);
	});

	it("focused mood increases breakThreshold by 40%", () => {
		const neutral = computeHabits(baseAttrs, "neutral", "engineering");
		const focused = computeHabits(baseAttrs, "focused", "engineering");
		expect(focused.breakThreshold).toBeCloseTo(neutral.breakThreshold * 1.4, 1);
	});

	it("neutral mood has baseline multipliers", () => {
		const neutral = computeHabits(baseAttrs, "neutral", "engineering");
		expect(neutral.idleResistanceMult).toBe(1.0);
		expect(neutral.speedMult).toBe(1.0);
	});
});
