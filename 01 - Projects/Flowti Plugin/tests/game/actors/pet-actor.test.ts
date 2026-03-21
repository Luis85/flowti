// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest";

vi.mock("excalibur", () => {
	function MockActor(this: Record<string, unknown>) {
		const self = this;
		self.pos = { x: 100, y: 100 };
		self.scale = { x: 1, y: 1 };
		self.graphics = { use: vi.fn(), opacity: 1 };
		self.on = vi.fn();
		self.z = 0;
	}
	return {
		Actor: MockActor,
		vec: vi.fn((x: number, y: number) => ({ x, y })),
		CollisionType: { PreventCollision: 0 },
		Canvas: function MockCanvas() { return; },
	};
});

import { PetActor } from "../../../src/game/actors/pet-actor.js";
import { PET_DEFINITIONS } from "../../../src/game/data/pet-definitions.js";

describe("PetActor", () => {
	const catDef = PET_DEFINITIONS.find((p) => p.type === "cat")!;
	const fishDef = PET_DEFINITIONS.find((p) => p.type === "fish")!;

	it("starts in idle state", () => {
		const pet = new PetActor(catDef, 100, 100, "cat-test");
		expect(pet.getState()).toBe("idle");
	});

	it("fish pet is stationary", () => {
		const pet = new PetActor(fishDef, 200, 200, "fish-test");
		pet.updateBehavior(1000);
		// Fish should stay idle (speed = 0)
		expect(pet.getState()).toBe("idle");
	});

	it("can set follow target", () => {
		const pet = new PetActor(catDef, 100, 100, "cat-test");
		pet.setFollowTarget("Atlas");
		expect(pet.getState()).toBe("following");
		expect(pet.getFollowTarget()).toBe("Atlas");
	});

	it("returns needs effects from definition", () => {
		const pet = new PetActor(catDef, 100, 100, "cat-test");
		expect(pet.getNeedsEffects().morale).toBe(5);
	});

	it("has correct pet type", () => {
		const pet = new PetActor(catDef, 100, 100, "cat-test");
		expect(pet.petType).toBe("cat");
	});

	it("every pet definition has phrases", () => {
		for (const def of PET_DEFINITIONS) {
			expect(def.phrases.length).toBeGreaterThanOrEqual(8);
		}
	});

	it("has 4 pet definitions", () => {
		expect(PET_DEFINITIONS).toHaveLength(4);
	});

	it("getHunger returns default value of 70", () => {
		const pet = new PetActor(catDef, 100, 100, "cat-test");
		expect(pet.getHunger()).toBe(70);
	});

	it("getThirst returns default value of 70", () => {
		const pet = new PetActor(catDef, 100, 100, "cat-test");
		expect(pet.getThirst()).toBe(70);
	});

	it("setHunger clamps to 0 minimum", () => {
		const pet = new PetActor(catDef, 100, 100, "cat-test");
		pet.setHunger(-10);
		expect(pet.getHunger()).toBe(0);
	});

	it("setHunger clamps to 100 maximum", () => {
		const pet = new PetActor(catDef, 100, 100, "cat-test");
		pet.setHunger(150);
		expect(pet.getHunger()).toBe(100);
	});

	it("setThirst clamps to 0 minimum", () => {
		const pet = new PetActor(catDef, 100, 100, "cat-test");
		pet.setThirst(-5);
		expect(pet.getThirst()).toBe(0);
	});

	it("setThirst clamps to 100 maximum", () => {
		const pet = new PetActor(catDef, 100, 100, "cat-test");
		pet.setThirst(200);
		expect(pet.getThirst()).toBe(100);
	});
});
