/**
 * intent-icon-actor.ts — Floating item sprite above an agent during seek intent.
 *
 * Added as a child of the agent actor. Fades in on intent start,
 * bobs gently, fades out on arrival or intent change.
 */

import * as ex from "excalibur";

const OFFSET_X = 8;
const OFFSET_Y = -14;
const BOB_AMPLITUDE = 1;
const BOB_PERIOD_MS = 2000;
const FADE_DURATION_MS = 200;
const ICON_Z = 35;

export class IntentIconActor extends ex.Actor {
	readonly spritePath: string;
	private bobPhase = 0;
	private readonly baseY: number;

	constructor(spritePath: string) {
		super({ x: OFFSET_X, y: OFFSET_Y, z: ICON_Z });
		this.spritePath = spritePath;
		this.baseY = OFFSET_Y;
		this.graphics.opacity = 0;
	}

	/** Apply a pre-loaded sprite to this actor. Called by render adapter. */
	applySprite(sprite: ex.Sprite): void {
		this.graphics.use(sprite.clone());
	}

	/** Advance the bob animation. Called each frame by the render adapter. */
	tickBob(deltaMs: number): void {
		this.bobPhase += deltaMs;
		const t = (this.bobPhase % BOB_PERIOD_MS) / BOB_PERIOD_MS;
		this.pos.y = this.baseY + Math.sin(t * Math.PI * 2) * BOB_AMPLITUDE;
	}

	fadeIn(): void {
		this.actions.fade(1, FADE_DURATION_MS);
	}

	fadeOut(thenKill = true): void {
		const chain = this.actions.fade(0, FADE_DURATION_MS);
		if (thenKill) chain.die();
	}
}
