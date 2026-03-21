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

import { FoodBowl } from "../../../src/game/actors/food-bowl.js";

describe("FoodBowl", () => {
	it("needsEffects includes hunger: 30", () => {
		const bowl = new FoodBowl();
		expect(bowl.getNeedsEffects()).toEqual({ hunger: 30 });
	});

	it("objectType is food", () => {
		const bowl = new FoodBowl();
		expect(bowl.objectType).toBe("food");
	});

	it("occupy/vacate works", () => {
		const bowl = new FoodBowl();
		expect(bowl.isOccupied()).toBe(false);
		bowl.occupy("Biscuit");
		expect(bowl.isOccupied()).toBe(true);
		expect(bowl.getOccupant()).toBe("Biscuit");
		bowl.vacate();
		expect(bowl.isOccupied()).toBe(false);
	});
});
