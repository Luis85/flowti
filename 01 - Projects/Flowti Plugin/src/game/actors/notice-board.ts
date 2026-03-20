/**
 * notice-board.ts — Notice board environmental object.
 * Displays project metrics and announcements on click.
 * No direct needs effects — serves as an information hub.
 */

import { InteractableActor } from "./interactable-actor.js";

export class NoticeBoard extends InteractableActor {
	constructor() {
		super({
			width: 48,
			height: 40,
			interactionOffset: { x: 0, y: 24 },
			needsEffects: {},
		});
	}
}
