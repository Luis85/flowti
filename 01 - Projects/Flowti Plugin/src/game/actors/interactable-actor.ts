/**
 * interactable-actor.ts — Base class for environmental objects agents can interact with.
 *
 * Provides: interaction point (where agent stands), needs effects on arrival,
 * occupy/vacate tracking, and director click handling.
 */

import * as ex from "excalibur";

export interface InteractableConfig {
	readonly objectId: string;
	readonly objectType: string;
	readonly width: number;
	readonly height: number;
	readonly interactionOffset: { x: number; y: number };
	readonly needsEffects: Partial<{ energy: number; social: number; focus: number; morale: number; hunger: number; thirst: number }>;
}

export class InteractableActor extends ex.Actor {
	readonly objectId: string;
	readonly objectType: string;
	private readonly interactionOffset: { x: number; y: number };
	private readonly effects: Partial<{ energy: number; social: number; focus: number; morale: number; hunger: number; thirst: number }>;
	private occupant: string | null = null;

	constructor(config: InteractableConfig) {
		super({
			width: config.width,
			height: config.height,
			anchor: ex.vec(0.5, 0.5),
			collisionType: ex.CollisionType.PreventCollision,
		});
		this.objectId = config.objectId;
		this.objectType = config.objectType;
		this.interactionOffset = config.interactionOffset;
		this.effects = config.needsEffects;
	}

	/** World position where agent should stand when interacting. */
	getInteractionPoint(): { x: number; y: number } {
		return {
			x: this.pos.x + this.interactionOffset.x,
			y: this.pos.y + this.interactionOffset.y,
		};
	}

	getNeedsEffects(): Partial<{ energy: number; social: number; focus: number; morale: number; hunger: number; thirst: number }> {
		return this.effects;
	}

	isOccupied(): boolean {
		return this.occupant !== null;
	}

	getOccupant(): string | null {
		return this.occupant;
	}

	occupy(agentName: string): void {
		this.occupant = agentName;
	}

	vacate(): void {
		this.occupant = null;
	}
}
