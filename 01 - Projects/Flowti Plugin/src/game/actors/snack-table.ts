/**
 * snack-table.ts — Snack table environmental object.
 * A communal food station that draws agents during breaks.
 * Boosts energy, social, and morale on interaction.
 */

import { InteractableActor } from "./interactable-actor.js";

export class SnackTable extends InteractableActor {
	constructor() {
		super({
			width: 48,
			height: 40,
			interactionOffset: { x: 0, y: 24 },
			needsEffects: { energy: 10, social: 8, morale: 3 },
		});
	}
}
