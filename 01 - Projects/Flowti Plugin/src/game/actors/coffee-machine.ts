/**
 * coffee-machine.ts — Coffee machine environmental object.
 * Agents visit when energy is low or during morning/slump phases.
 * Boosts energy and focus on interaction.
 */

import { InteractableActor } from "./interactable-actor.js";

export class CoffeeMachine extends InteractableActor {
	constructor() {
		super({
			width: 32,
			height: 40,
			interactionOffset: { x: 0, y: 24 },
			needsEffects: { energy: 15, focus: 5 },
		});
	}
}
