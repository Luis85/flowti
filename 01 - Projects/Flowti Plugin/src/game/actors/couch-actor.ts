/**
 * couch-actor.ts — Couch environmental object.
 * A comfortable rest spot where agents recover energy during downtime.
 * Boosts energy and morale on interaction.
 */

import { InteractableActor } from "./interactable-actor.js";

export class CouchActor extends InteractableActor {
	constructor() {
		super({
			width: 64,
			height: 36,
			interactionOffset: { x: 0, y: 20 },
			needsEffects: { energy: 20, morale: 5 },
		});
	}
}
