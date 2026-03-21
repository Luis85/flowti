import { describe, it, expect } from "vitest";
import { createPetBT, type PetBTObject } from "../../../../src/game/brain/behavior-tree/pet-bt.js";

function getPetContext(bt: ReturnType<typeof createPetBT>): PetBTObject {
	return bt.agent as unknown as PetBTObject;
}

describe("createPetBT", () => {
	it("creates a BT with idle initial state", () => {
		const bt = createPetBT("cat", 0.008, 120, 0.4);
		const pet = getPetContext(bt);
		expect(pet.context.name).toBe("cat");
		expect(pet.context.state).toBe("idle");
	});

	it("SleepChanceRoll returns false when not idle", () => {
		const bt = createPetBT("cat", 1.0, 120, 0.4);
		const pet = getPetContext(bt);
		pet.context.state = "wandering";
		expect(pet.SleepChanceRoll()).toBe(false);
	});

	it("HasFollowTarget returns true when following", () => {
		const bt = createPetBT("cat", 0, 120, 0.4);
		const pet = getPetContext(bt);
		pet.context.followTarget = "Atlas";
		pet.context.followTimer = 5000;
		expect(pet.HasFollowTarget()).toBe(true);
	});

	it("HasExitTarget returns true when exiting", () => {
		const bt = createPetBT("cat", 0, 120, 0.4);
		const pet = getPetContext(bt);
		pet.context.state = "exiting";
		expect(pet.HasExitTarget()).toBe(true);
	});

	it("Nap action sets sleeping state", () => {
		const bt = createPetBT("cat", 0, 120, 0.4);
		const pet = getPetContext(bt);
		pet.Nap();
		expect(pet.context.state).toBe("sleeping");
		expect(pet.collectedActions).toContainEqual(
			expect.objectContaining({ type: "pet-sleep" }),
		);
	});

	it("tree can be stepped without errors", () => {
		const bt = createPetBT("cat", 0, 120, 0.4);
		const pet = getPetContext(bt);
		pet.context.stateTimer = 0;
		expect(() => bt.tree.step()).not.toThrow();
	});
});
