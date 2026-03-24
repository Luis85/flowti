/**
 * engine-objects.ts — Environmental object and pet creation for the game engine.
 *
 * Extracted from engine.ts to reduce file size. Creates and positions
 * environmental interactable objects and office pets.
 */

import * as ex from "excalibur";
import { CoffeeMachine } from "./actors/coffee-machine.js";
import { WhiteboardActor } from "./actors/whiteboard-actor.js";
import { SnackTable } from "./actors/snack-table.js";
import { WaterCooler } from "./actors/water-cooler.js";
import { CouchActor } from "./actors/couch-actor.js";
import { PlantActor } from "./actors/plant-actor.js";
import { NoticeBoard } from "./actors/notice-board.js";
import { MerchantStall } from "./actors/merchant-stall.js";
import { FoodBowl } from "./actors/food-bowl.js";
import { WaterBowl } from "./actors/water-bowl.js";
import { PetActor } from "./actors/pet-actor.js";
import { PET_DEFINITIONS } from "./data/pet-definitions.js";
import { OBJECT_POSITIONS, OBJECT_SCENE_ASSIGNMENTS } from "./engine-config.js";
import type { SceneRegistry } from "./systems/scene-registry.js";

// ── Environmental objects ────────────────────────────────────────────

export interface EnvironmentalObjects {
	readonly coffeeMachine: CoffeeMachine;
	readonly whiteboard: WhiteboardActor;
	readonly snackTable: SnackTable;
	readonly waterCooler: WaterCooler;
	readonly couch: CouchActor;
	readonly plant: PlantActor;
	readonly noticeBoard: NoticeBoard;
	readonly merchantStall: MerchantStall;
	readonly foodBowlHub: FoodBowl;
	readonly foodBowlVillage: FoodBowl;
	readonly waterBowlOffice: WaterBowl;
	readonly waterBowlStation: WaterBowl;
}

/** Create all environmental objects, positioned from engine-config. */
export function createEnvironmentalObjects(): EnvironmentalObjects {
	const coffeeMachine = new CoffeeMachine();
	coffeeMachine.pos = ex.vec(OBJECT_POSITIONS.coffeeMachine.x, OBJECT_POSITIONS.coffeeMachine.y);
	const whiteboard = new WhiteboardActor();
	whiteboard.pos = ex.vec(OBJECT_POSITIONS.whiteboard.x, OBJECT_POSITIONS.whiteboard.y);
	const snackTable = new SnackTable();
	snackTable.pos = ex.vec(OBJECT_POSITIONS.snackTable.x, OBJECT_POSITIONS.snackTable.y);
	const waterCooler = new WaterCooler();
	waterCooler.pos = ex.vec(OBJECT_POSITIONS.waterCooler.x, OBJECT_POSITIONS.waterCooler.y);
	const couch = new CouchActor();
	couch.pos = ex.vec(OBJECT_POSITIONS.couch.x, OBJECT_POSITIONS.couch.y);
	const plant = new PlantActor();
	plant.pos = ex.vec(OBJECT_POSITIONS.plant.x, OBJECT_POSITIONS.plant.y);
	const noticeBoard = new NoticeBoard();
	noticeBoard.pos = ex.vec(OBJECT_POSITIONS.noticeBoard.x, OBJECT_POSITIONS.noticeBoard.y);
	const merchantStall = new MerchantStall();
	merchantStall.pos = ex.vec(OBJECT_POSITIONS.merchantStall.x, OBJECT_POSITIONS.merchantStall.y);
	const foodBowlHub = new FoodBowl("food-bowl-hub");
	foodBowlHub.pos = ex.vec(OBJECT_POSITIONS.foodBowlHub.x, OBJECT_POSITIONS.foodBowlHub.y);
	const foodBowlVillage = new FoodBowl("food-bowl-village");
	foodBowlVillage.pos = ex.vec(OBJECT_POSITIONS.foodBowlVillage.x, OBJECT_POSITIONS.foodBowlVillage.y);
	const waterBowlOffice = new WaterBowl("water-bowl-office");
	waterBowlOffice.pos = ex.vec(OBJECT_POSITIONS.waterBowlOffice.x, OBJECT_POSITIONS.waterBowlOffice.y);
	const waterBowlStation = new WaterBowl("water-bowl-station");
	waterBowlStation.pos = ex.vec(OBJECT_POSITIONS.waterBowlStation.x, OBJECT_POSITIONS.waterBowlStation.y);

	return { coffeeMachine, whiteboard, snackTable, waterCooler, couch, plant, noticeBoard, merchantStall, foodBowlHub, foodBowlVillage, waterBowlOffice, waterBowlStation };
}

/** Register all environmental objects in the scene registry. */
export function registerEnvironmentalObjects(objects: EnvironmentalObjects, registry: SceneRegistry): void {
	const assignments = OBJECT_SCENE_ASSIGNMENTS;
	for (const [key, room] of Object.entries(assignments)) {
		const obj = objects[key as keyof EnvironmentalObjects];
		if (obj) registry.registerObject(obj.objectId, room, obj.objectType, obj.pos);
	}
}

// ── Pets ─────────────────────────────────────────────────────────────

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
