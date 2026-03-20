/**
 * whiteboard-actor.ts — Whiteboard environmental object.
 * Used for collaborative brainstorming and diagram sessions.
 * Boosts social, focus, and morale on interaction.
 */

import { InteractableActor } from "./interactable-actor.js";

export class WhiteboardActor extends InteractableActor {
	constructor() {
		super({
			width: 64,
			height: 48,
			interactionOffset: { x: 0, y: 30 },
			needsEffects: { social: 5, focus: 3, morale: 2 },
		});
	}
}
