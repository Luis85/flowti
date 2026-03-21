/**
 * engine-pet-share.ts — Pet share interaction logic extracted from engine-simulation.ts.
 *
 * When a pet is near an occupied food/drink station, both the pet and the agent benefit.
 */

import type { EngineContext } from "./engine-types.js";
import type { InteractableActor } from "./actors/interactable-actor.js";
import {
	FOOD_DRINK_OBJECT_TYPES,
	PET_SHARE_COOLDOWN, PET_SHARE_EFFECT_RATIO, PET_SHARE_SOCIAL_BONUS,
} from "./engine-config.js";

type PetActor = import("./actors/pet-actor.js").PetActor;

function applyPetEffects(pet: PetActor, obj: InteractableActor): void {
	const effects = obj.getNeedsEffects();
	const scaledHunger = (effects.hunger ?? 0) * PET_SHARE_EFFECT_RATIO;
	const scaledThirst = (effects.thirst ?? 0) * PET_SHARE_EFFECT_RATIO;
	const scaledEnergy = (effects.energy ?? 0) * PET_SHARE_EFFECT_RATIO;
	if (scaledHunger !== 0) pet.setHunger(pet.getHunger() + scaledHunger);
	if (scaledThirst !== 0) pet.setThirst(pet.getThirst() + scaledThirst);
	if (scaledEnergy !== 0) pet.setHunger(pet.getHunger() + scaledEnergy);
}

function findShareTarget(ctx: EngineContext, pet: PetActor, petRoom: string): { obj: InteractableActor; occupant: string } | null {
	const allObjects: InteractableActor[] = [
		ctx.coffeeMachine, ctx.snackTable, ctx.waterCooler,
		ctx.foodBowlHub, ctx.foodBowlVillage,
		ctx.waterBowlOffice, ctx.waterBowlStation,
	];
	for (const obj of allObjects) {
		if (!FOOD_DRINK_OBJECT_TYPES.has(obj.objectType)) continue;
		const occupant = obj.getOccupant();
		if (!occupant || ctx.registry.getEntityRoom(occupant) !== petRoom) continue;
		const point = obj.getInteractionPoint();
		const dx = pet.pos.x - point.x;
		const dy = pet.pos.y - point.y;
		if (Math.sqrt(dx * dx + dy * dy) >= pet.getInteractRadius()) continue;
		const cooldownKey = `share:${occupant}:${pet.entityId}`;
		if (performance.now() - (ctx.petShareCooldowns.get(cooldownKey) ?? 0) <= PET_SHARE_COOLDOWN) continue;
		return { obj, occupant };
	}
	return null;
}

/** Pet share — when a pet is near an occupied food/drink station, both benefit. */
export function checkPetShareInteraction(ctx: EngineContext, pet: PetActor, petRoom: string | undefined): void {
	if (pet.getState() === "sleeping" || !petRoom) return;
	const target = findShareTarget(ctx, pet, petRoom);
	if (!target) return;

	const { obj, occupant } = target;
	ctx.petShareCooldowns.set(`share:${occupant}:${pet.entityId}`, performance.now());

	applyPetEffects(pet, obj);
	ctx.needs.applyEffect(occupant, { social: PET_SHARE_SOCIAL_BONUS });

	const agentPos = ctx.brain.getPosition(occupant);
	if (agentPos) {
		ctx.particlePool.spawnPreset("hearts", (pet.pos.x + agentPos.x) / 2, (pet.pos.y + agentPos.y) / 2);
	}
}
