/**
 * plant-actor.ts — Decorative plant environmental object.
 * Adds visual warmth to the office. No direct needs effects,
 * but may trigger comment bubbles from plant-parent agents.
 */

import { InteractableActor } from "./interactable-actor.js";

export class PlantActor extends InteractableActor {
	constructor() {
		super({
			width: 20,
			height: 28,
			interactionOffset: { x: 0, y: 16 },
			needsEffects: {},
		});
	}
}
