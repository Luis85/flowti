/**
 * engine-pets.ts — Pet creation for the game engine.
 *
 * Extracted from engine.ts to reduce file size. Creates and positions
 * office pets across rooms.
 */

import { PetActor } from "./actors/pet-actor.js";
import { PET_DEFINITIONS } from "./data/pet-definitions.js";

/** Create all office pets distributed across rooms. */
export function createPets(): PetActor[] {
	const catDef = PET_DEFINITIONS.find((p) => p.type === "cat")!;
	const dogDef = PET_DEFINITIONS.find((p) => p.type === "dog")!;
	const birdDef = PET_DEFINITIONS.find((p) => p.type === "bird")!;
	const fishDef = PET_DEFINITIONS.find((p) => p.type === "fish")!;

	return [
		new PetActor(catDef, 300, 250, "cat-hub"),
		new PetActor(catDef, 350, 300, "cat-office"),
		new PetActor(catDef, 400, 280, "cat-village"),
		new PetActor(dogDef, 500, 350, "dog-office"),
		new PetActor(dogDef, 300, 200, "dog-village"),
		new PetActor(dogDef, 450, 300, "dog-station"),
		new PetActor(birdDef, 200, 80, "bird-village"),
		new PetActor(fishDef, 680, 380, "fish-station"),
	];
}

/** Pet-BT registration pairs: mobile pets and their definitions. */
export function getPetBTPairs(pets: readonly PetActor[]): ReadonlyArray<readonly [PetActor, { behaviors: { sleepChance: number; wanderRadius: number }; speed: number }]> {
	const catDef = PET_DEFINITIONS.find((p) => p.type === "cat")!;
	const dogDef = PET_DEFINITIONS.find((p) => p.type === "dog")!;
	const birdDef = PET_DEFINITIONS.find((p) => p.type === "bird")!;

	// Match pets to defs by type — skip fish (stationary, speed=0)
	const defMap: Record<string, typeof catDef> = { cat: catDef, dog: dogDef, bird: birdDef };
	return pets
		.filter((p) => defMap[p.petType])
		.map((p) => [p, defMap[p.petType]] as const);
}
