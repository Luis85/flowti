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

	it("context initialises hunger to 70", () => {
		const bt = createPetBT("cat", 0, 120, 0.4);
		const pet = getPetContext(bt);
		expect(pet.context.hunger).toBe(70);
	});

	it("context initialises thirst to 70", () => {
		const bt = createPetBT("cat", 0, 120, 0.4);
		const pet = getPetContext(bt);
		expect(pet.context.thirst).toBe(70);
	});

	it("IsHungry returns false when hunger is above threshold", () => {
		const bt = createPetBT("cat", 0, 120, 0.4);
		const pet = getPetContext(bt);
		pet.context.hunger = 50;
		expect(pet.IsHungry()).toBe(false);
	});

	it("IsHungry returns true when hunger is below threshold", () => {
		const bt = createPetBT("cat", 0, 120, 0.4);
		const pet = getPetContext(bt);
		pet.context.hunger = 39;
		expect(pet.IsHungry()).toBe(true);
	});

	it("IsThirsty returns false when thirst is above threshold", () => {
		const bt = createPetBT("cat", 0, 120, 0.4);
		const pet = getPetContext(bt);
		pet.context.thirst = 50;
		expect(pet.IsThirsty()).toBe(false);
	});

	it("IsThirsty returns true when thirst is below threshold", () => {
		const bt = createPetBT("cat", 0, 120, 0.4);
		const pet = getPetContext(bt);
		pet.context.thirst = 34;
		expect(pet.IsThirsty()).toBe(true);
	});

	it("PetEat increases hunger by 30", () => {
		const bt = createPetBT("cat", 0, 120, 0.4);
		const pet = getPetContext(bt);
		pet.context.hunger = 30;
		pet.PetEat();
		expect(pet.context.hunger).toBe(60);
		expect(pet.collectedActions).toContainEqual(
			expect.objectContaining({ type: "pet-eat" }),
		);
	});

	it("PetDrink increases thirst by 25", () => {
		const bt = createPetBT("cat", 0, 120, 0.4);
		const pet = getPetContext(bt);
		pet.context.thirst = 20;
		pet.PetDrink();
		expect(pet.context.thirst).toBe(45);
		expect(pet.collectedActions).toContainEqual(
			expect.objectContaining({ type: "pet-drink" }),
		);
	});

	it("SeekFoodBowl collects pet-seek-food action", () => {
		const bt = createPetBT("cat", 0, 120, 0.4);
		const pet = getPetContext(bt);
		pet.SeekFoodBowl();
		expect(pet.collectedActions).toContainEqual(
			expect.objectContaining({ type: "pet-seek-food" }),
		);
	});

	it("SeekWaterBowl collects pet-seek-water action", () => {
		const bt = createPetBT("cat", 0, 120, 0.4);
		const pet = getPetContext(bt);
		pet.SeekWaterBowl();
		expect(pet.collectedActions).toContainEqual(
			expect.objectContaining({ type: "pet-seek-water" }),
		);
	});

	it("PetEat clamps hunger to 100", () => {
		const bt = createPetBT("cat", 0, 120, 0.4);
		const pet = getPetContext(bt);
		pet.context.hunger = 90;
		pet.PetEat();
		expect(pet.context.hunger).toBe(100);
	});

	it("PetDrink clamps thirst to 100", () => {
		const bt = createPetBT("cat", 0, 120, 0.4);
		const pet = getPetContext(bt);
		pet.context.thirst = 90;
		pet.PetDrink();
		expect(pet.context.thirst).toBe(100);
	});

	// ── Catalyst conditions ─────────────────────────────────

	it("HasNearbyAgents returns false when no nearby agents", () => {
		const bt = createPetBT("cat", 0, 120, 0.4);
		const pet = getPetContext(bt);
		expect(pet.HasNearbyAgents()).toBe(false);
	});

	it("HasNearbyAgents returns true when 2+ agents nearby", () => {
		const bt = createPetBT("cat", 0, 120, 0.4);
		const pet = getPetContext(bt);
		pet.context.nearbyAgentCount = 2;
		pet.context.nearbyAgents = ["Atlas", "Rex"];
		expect(pet.HasNearbyAgents()).toBe(true);
	});

	it("HasSadNearbyAgent returns true when morale below 30", () => {
		const bt = createPetBT("cat", 0, 120, 0.4);
		const pet = getPetContext(bt);
		pet.context.nearbyAgentMorale = 20;
		expect(pet.HasSadNearbyAgent()).toBe(true);
	});

	it("HasSadNearbyAgent returns false when morale is high", () => {
		const bt = createPetBT("cat", 0, 120, 0.4);
		const pet = getPetContext(bt);
		pet.context.nearbyAgentMorale = 80;
		expect(pet.HasSadNearbyAgent()).toBe(false);
	});

	it("CatalystChanceRoll returns false when not idle", () => {
		const bt = createPetBT("cat", 0, 120, 0.4);
		const pet = getPetContext(bt);
		pet.context.state = "wandering";
		expect(pet.CatalystChanceRoll()).toBe(false);
	});

	// ── Catalyst actions ────────────────────────────────────

	it("DragToy collects pet-drag-toy action when nearby agents present", () => {
		const bt = createPetBT("cat-whiskers", 0.3, 100, 2);
		const pet = getPetContext(bt);
		pet.context.nearbyAgentCount = 2;
		pet.context.nearbyAgents = ["Atlas", "Rex"];
		pet.DragToy();
		expect(pet.collectedActions).toContainEqual(
			expect.objectContaining({ type: "pet-drag-toy" }),
		);
	});

	it("SitBetween collects pet-sit-between action", () => {
		const bt = createPetBT("cat", 0, 120, 0.4);
		const pet = getPetContext(bt);
		pet.context.nearbyAgents = ["Atlas", "Rex"];
		pet.SitBetween();
		expect(pet.collectedActions).toContainEqual(
			expect.objectContaining({ type: "pet-sit-between" }),
		);
	});

	it("BringGift collects pet-bring-gift action", () => {
		const bt = createPetBT("cat", 0, 120, 0.4);
		const pet = getPetContext(bt);
		pet.context.nearbyAgents = ["Atlas"];
		pet.BringGift();
		expect(pet.collectedActions).toContainEqual(
			expect.objectContaining({ type: "pet-bring-gift" }),
		);
	});

	it("StealSpotlight collects pet-steal-spotlight action", () => {
		const bt = createPetBT("cat", 0, 120, 0.4);
		const pet = getPetContext(bt);
		pet.context.nearbyAgents = ["Atlas", "Rex"];
		pet.StealSpotlight();
		expect(pet.collectedActions).toContainEqual(
			expect.objectContaining({ type: "pet-steal-spotlight" }),
		);
	});

	it("ComfortSadAgent collects pet-comfort action with morale", () => {
		const bt = createPetBT("cat", 0, 120, 0.4);
		const pet = getPetContext(bt);
		pet.context.nearbyAgentMorale = 15;
		pet.context.nearbyAgents = ["Atlas"];
		pet.ComfortSadAgent();
		expect(pet.collectedActions).toContainEqual(
			expect.objectContaining({ type: "pet-comfort", data: expect.objectContaining({ morale: 15 }) }),
		);
	});

	it("PickSide collects pet-pick-side action", () => {
		const bt = createPetBT("cat", 0, 120, 0.4);
		const pet = getPetContext(bt);
		pet.context.nearbyAgents = ["Atlas", "Rex"];
		pet.PickSide();
		expect(pet.collectedActions).toContainEqual(
			expect.objectContaining({ type: "pet-pick-side" }),
		);
	});
});
