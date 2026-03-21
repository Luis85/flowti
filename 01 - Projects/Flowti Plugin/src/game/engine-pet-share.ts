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

/** Pet share — when a pet is near an occupied food/drink station, both benefit. */
export function checkPetShareInteraction(ctx: EngineContext, pet: import("./actors/pet-actor.js").PetActor, petRoom: string | undefined): void {
	if (pet.getState() === "sleeping" || !petRoom) return;

	const allObjects: InteractableActor[] = [
		ctx.coffeeMachine, ctx.snackTable, ctx.waterCooler,
		ctx.foodBowlHub, ctx.foodBowlVillage,
		ctx.waterBowlOffice, ctx.waterBowlStation,
	];
	for (const obj of allObjects) {
		if (!FOOD_DRINK_OBJECT_TYPES.has(obj.objectType)) continue;
		const occupant = obj.getOccupant();
		if (!occupant) continue;
		if (ctx.registry.getEntityRoom(occupant) !== petRoom) continue;
		const point = obj.getInteractionPoint();
		const dx = pet.pos.x - point.x;
		const dy = pet.pos.y - point.y;
		const dist = Math.sqrt(dx * dx + dy * dy);
		if (dist >= pet.getInteractRadius()) continue;
		const cooldownKey = `share:${occupant}:${pet.entityId}`;
		const lastShare = ctx.petShareCooldowns.get(cooldownKey) ?? 0;
		if (performance.now() - lastShare <= PET_SHARE_COOLDOWN) continue;

		ctx.petShareCooldowns.set(cooldownKey, performance.now());

		// Pet gets 50% of the station's effects
		const effects = obj.getNeedsEffects();
		const scaledEffects: Partial<{ energy: number; social: number; focus: number; morale: number; hunger: number; thirst: number }> = {};
		for (const [key, val] of Object.entries(effects)) {
			if (typeof val === "number") {
				(scaledEffects as Record<string, number>)[key] = val * PET_SHARE_EFFECT_RATIO;
			}
		}
		ctx.needs.applyEffect(pet.entityId, scaledEffects);

		// Agent gets social bonus
		ctx.needs.applyEffect(occupant, { social: PET_SHARE_SOCIAL_BONUS });

		// Heart particles between agent and pet
		const agentPos = ctx.brain.getPosition(occupant);
		if (agentPos) {
			ctx.particlePool.spawnPreset("hearts", (pet.pos.x + agentPos.x) / 2, (pet.pos.y + agentPos.y) / 2);
		}
		break; // one share interaction per pet per frame
	}
}
