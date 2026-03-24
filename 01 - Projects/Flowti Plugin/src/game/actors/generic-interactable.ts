/**
 * generic-interactable.ts — Universal interactable actor driven by SceneObjectConfig.
 *
 * Replaces all 10 hardcoded actor subclasses (CoffeeMachine, WhiteboardActor, etc.)
 * with a single class that reads config from scene-objects.json and resolves
 * its visual from the graphic registry.
 */

import { InteractableActor } from "./interactable-actor.js";
import { getGraphic } from "./graphic-registry.js";
import type { SceneObjectConfig } from "../data/scene-object-schema.js";

export class GenericInteractable extends InteractableActor {
	private readonly graphicName: string | undefined;
	private hovered = false;

	constructor(config: SceneObjectConfig) {
		super({
			objectId: config.id,
			objectType: config.type,
			width: config.size.width,
			height: config.size.height,
			interactionOffset: config.interactionOffset ?? { x: 0, y: 0 },
			needsEffects: config.needsEffects ?? {},
		});
		this.graphicName = config.graphic;
		this.rebuildGraphic();
	}

	setHovered(hovered: boolean): void {
		if (this.hovered === hovered) return;
		this.hovered = hovered;
		this.rebuildGraphic();
	}

	private rebuildGraphic(): void {
		if (!this.graphicName) return;
		const drawFn = getGraphic(this.graphicName);
		if (!drawFn) return;
		const canvas = drawFn(this.width, this.height, this.hovered);
		this.graphics.use(canvas);
	}
}
