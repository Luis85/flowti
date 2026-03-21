// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest";

vi.mock("excalibur", () => {
	function MockActor(this: Record<string, unknown>) {
		this.pos = { x: 0, y: 0 };
		this.on = vi.fn();
		this.graphics = { use: vi.fn(), opacity: 1 };
	}
	return {
		Actor: MockActor,
		vec: vi.fn((x: number, y: number) => ({ x, y })),
		CollisionType: { PreventCollision: 0 },
		Canvas: function MockCanvas() { return; },
	};
});

import { WaterBowl } from "../../../src/game/actors/water-bowl.js";

describe("WaterBowl", () => {
	it("needsEffects includes thirst: 25", () => {
		const bowl = new WaterBowl();
		expect(bowl.getNeedsEffects()).toEqual({ thirst: 25 });
	});

	it("objectType is drink", () => {
		const bowl = new WaterBowl();
		expect(bowl.objectType).toBe("drink");
	});

	it("occupy/vacate works", () => {
		const bowl = new WaterBowl();
		expect(bowl.isOccupied()).toBe(false);
		bowl.occupy("Puddles");
		expect(bowl.isOccupied()).toBe(true);
		expect(bowl.getOccupant()).toBe("Puddles");
		bowl.vacate();
		expect(bowl.isOccupied()).toBe(false);
	});
});
