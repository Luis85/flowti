import { describe, it, expect } from "vitest";
import { computeHabits } from "../../src/brain/agent-brain.js";
import { resolveIdleTarget, preferredWorkstation } from "../../src/brain/movement.js";
import type { AgentHabits } from "../../src/brain/brain-types.js";

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

// ── resolveIdleTarget tests ──────────────────────────────────────────

const defaultHabits: AgentHabits = {
	preferredWorkstationId: null,
	homeRoom: "office",
	movementStyle: "brisk",
	idleStyle: "restless",
	socialDrift: 0.5,
	focusDrift: 0.5,
	breakThreshold: 30,
	settlingPause: 500,
	idleResistanceMult: 1.0,
	speedMult: 1.0,
};

const bounds = { minX: 0, maxX: 400, minY: 0, maxY: 300 };

describe("resolveIdleTarget", () => {
	it("high socialDrift + nearby agent → targets near that agent", () => {
		const habits = { ...defaultHabits, socialDrift: 1.0, focusDrift: 0 };
		const nearby = [{ x: 200, y: 150 }];
		const result = resolveIdleTarget(habits, nearby, bounds, () => 0);
		expect(result).not.toBeNull();
		expect(Math.abs(result!.x - 200)).toBeLessThanOrEqual(30);
		expect(Math.abs(result!.y - 150)).toBeLessThanOrEqual(30);
	});

	it("socialDrift miss + high focusDrift → targets far corner", () => {
		const habits = { ...defaultHabits, socialDrift: 0, focusDrift: 1.0 };
		const nearby = [{ x: 200, y: 150 }];
		const result = resolveIdleTarget(habits, nearby, bounds, () => 0);
		expect(result).not.toBeNull();
		const distFromAgent = Math.sqrt((result!.x - 200) ** 2 + (result!.y - 150) ** 2);
		expect(distFromAgent).toBeGreaterThan(100);
	});

	it("both miss → falls back to random wander", () => {
		const habits = { ...defaultHabits, socialDrift: 0, focusDrift: 0 };
		const result = resolveIdleTarget(habits, [], bounds, () => 0.5);
		expect(result).not.toBeNull();
		expect(result!.x).toBeGreaterThanOrEqual(0);
		expect(result!.x).toBeLessThanOrEqual(400);
	});

	it("no nearby agents + socialDrift hit → falls through to wander", () => {
		const habits = { ...defaultHabits, socialDrift: 1.0, focusDrift: 0 };
		const result = resolveIdleTarget(habits, [], bounds, () => 0.5);
		expect(result).not.toBeNull();
	});
});

describe("preferredWorkstation", () => {
	it("returns preferred if available and not occupied", () => {
		const workstations = [
			{ id: "office-0", x: 100, y: 100, occupied: false },
			{ id: "office-1", x: 200, y: 100, occupied: false },
		];
		const result = preferredWorkstation({ x: 300, y: 300 }, workstations, "office-1");
		expect(result).toEqual({ x: 200, y: 100 });
	});

	it("falls back to nearest if preferred is occupied", () => {
		const workstations = [
			{ id: "office-0", x: 100, y: 100, occupied: false },
			{ id: "office-1", x: 200, y: 100, occupied: true },
		];
		const result = preferredWorkstation({ x: 150, y: 100 }, workstations, "office-1");
		expect(result).toEqual({ x: 100, y: 100 });
	});

	it("falls back to nearest when no preferred set", () => {
		const workstations = [
			{ id: "office-0", x: 100, y: 100, occupied: false },
			{ id: "office-1", x: 50, y: 50, occupied: false },
		];
		const result = preferredWorkstation({ x: 40, y: 40 }, workstations, null);
		expect(result).toEqual({ x: 50, y: 50 });
	});

	it("returns null when all occupied", () => {
		const workstations = [
			{ id: "office-0", x: 100, y: 100, occupied: true },
		];
		const result = preferredWorkstation({ x: 0, y: 0 }, workstations, null);
		expect(result).toBeNull();
	});
});
