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

	it("petType defaults from name prefix", () => {
		const bt = createPetBT("cat-hub", 0, 120, 0.4);
		const pet = getPetContext(bt);
		expect(pet.context.petType).toBe("cat");
	});

	it("petType uses explicit value when provided", () => {
		const bt = createPetBT("cat-hub", 0, 120, 0.4, "dog");
		const pet = getPetContext(bt);
		expect(pet.context.petType).toBe("dog");
	});

	it("ShouldFollowStressedAgent only triggers for cats", () => {
		const bt = createPetBT("dog-office", 0, 120, 0.4, "dog");
		const pet = getPetContext(bt);
		pet.context.nearbyAgentMorale = 10;
		expect(pet.ShouldFollowStressedAgent()).toBe(false);
	});

	it("ShouldFollowStressedAgent true for cat with low morale nearby", () => {
		const bt = createPetBT("cat-hub", 0, 120, 0.4, "cat");
		const pet = getPetContext(bt);
		pet.context.nearbyAgentMorale = 10;
		const origRandom = Math.random;
		Math.random = () => 0;
		try {
			expect(pet.ShouldFollowStressedAgent()).toBe(true);
		} finally {
			Math.random = origRandom;
		}
	});

	it("ShouldFollowStressedAgent false when morale above threshold", () => {
		const bt = createPetBT("cat-hub", 0, 120, 0.4, "cat");
		const pet = getPetContext(bt);
		pet.context.nearbyAgentMorale = 50;
		const origRandom = Math.random;
		Math.random = () => 0;
		try {
			expect(pet.ShouldFollowStressedAgent()).toBe(false);
		} finally {
			Math.random = origRandom;
		}
	});

	it("ShouldFollowStressedAgent false when not idle", () => {
		const bt = createPetBT("cat-hub", 0, 120, 0.4, "cat");
		const pet = getPetContext(bt);
		pet.context.nearbyAgentMorale = 10;
		pet.context.state = "wandering";
		const origRandom = Math.random;
		Math.random = () => 0;
		try {
			expect(pet.ShouldFollowStressedAgent()).toBe(false);
		} finally {
			Math.random = origRandom;
		}
	});

	it("ShouldFollowRandomAgent only triggers for dogs", () => {
		const bt = createPetBT("cat-hub", 0, 120, 0.4, "cat");
		const pet = getPetContext(bt);
		pet.context.nearbyIdleAgent = "Atlas";
		expect(pet.ShouldFollowRandomAgent()).toBe(false);
	});

	it("ShouldFollowRandomAgent true for dog with idle agent nearby", () => {
		const bt = createPetBT("dog-office", 0, 120, 0.4, "dog");
		const pet = getPetContext(bt);
		pet.context.nearbyIdleAgent = "Atlas";
		const origRandom = Math.random;
		Math.random = () => 0;
		try {
			expect(pet.ShouldFollowRandomAgent()).toBe(true);
		} finally {
			Math.random = origRandom;
		}
	});

	it("ShouldFollowRandomAgent false when no idle agent nearby", () => {
		const bt = createPetBT("dog-office", 0, 120, 0.4, "dog");
		const pet = getPetContext(bt);
		const origRandom = Math.random;
		Math.random = () => 0;
		try {
			expect(pet.ShouldFollowRandomAgent()).toBe(false);
		} finally {
			Math.random = origRandom;
		}
	});

	it("LostFollowTarget detects room mismatch", () => {
		const bt = createPetBT("cat-hub", 0, 120, 0.4, "cat");
		const pet = getPetContext(bt);
		pet.context.followTarget = "Atlas";
		pet.context.currentRoom = "hub";
		pet.context.targetRoom = "office";
		expect(pet.LostFollowTarget()).toBe(true);
	});

	it("LostFollowTarget false when same room", () => {
		const bt = createPetBT("cat-hub", 0, 120, 0.4, "cat");
		const pet = getPetContext(bt);
		pet.context.followTarget = "Atlas";
		pet.context.currentRoom = "hub";
		pet.context.targetRoom = "hub";
		expect(pet.LostFollowTarget()).toBe(false);
	});

	it("LostFollowTarget false when no follow target", () => {
		const bt = createPetBT("cat-hub", 0, 120, 0.4, "cat");
		const pet = getPetContext(bt);
		pet.context.followTarget = null;
		pet.context.currentRoom = "hub";
		pet.context.targetRoom = "office";
		expect(pet.LostFollowTarget()).toBe(false);
	});

	it("LostFollowTarget false when rooms undefined", () => {
		const bt = createPetBT("cat-hub", 0, 120, 0.4, "cat");
		const pet = getPetContext(bt);
		pet.context.followTarget = "Atlas";
		expect(pet.LostFollowTarget()).toBe(false);
	});
});
