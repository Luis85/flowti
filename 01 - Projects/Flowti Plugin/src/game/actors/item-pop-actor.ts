/**
 * item-pop-actor.ts — Item sprite that floats up from a station on consumption.
 *
 * Spawned at station position, floats up 20px over 600ms with ease-out,
 * fades to transparent, then self-destructs.
 */

import * as ex from "excalibur";

const FLOAT_DISTANCE = -20;
const FLOAT_DURATION_MS = 600;
const ITEM_POP_Z = 40;

export class ItemPopActor extends ex.Actor {
	readonly spritePath: string;

	constructor(spritePath: string, x: number, y: number) {
		super({ x, y, z: ITEM_POP_Z });
		this.spritePath = spritePath;
	}

	/** Apply a pre-loaded sprite. Called by render adapter before play(). */
	applySprite(sprite: ex.Sprite): void {
		this.graphics.use(sprite.clone());
	}

	/** Start the float-up-and-fade animation. Self-destructs on completion. */
	play(): void {
		this.actions
			.moveBy(ex.vec(0, FLOAT_DISTANCE), FLOAT_DURATION_MS)
			.fade(0, FLOAT_DURATION_MS)
			.die();
	}
}
