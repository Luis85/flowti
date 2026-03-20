/**
 * water-cooler.ts — Water cooler environmental object.
 * The classic social gathering spot for casual conversations.
 * Boosts social on interaction.
 */

import { InteractableActor } from "./interactable-actor.js";

export class WaterCooler extends InteractableActor {
	constructor() {
		super({
			width: 24,
			height: 40,
			interactionOffset: { x: 0, y: 24 },
			needsEffects: { social: 10 },
		});
	}
}
