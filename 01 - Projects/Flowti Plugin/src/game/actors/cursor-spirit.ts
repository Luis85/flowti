/**
 * cursor-spirit.ts — Visual cursor presence in the agent world.
 *
 * A subtle radial gradient glow that follows the user's mouse position
 * in world-space. Fades in/out over 300ms on canvas enter/leave.
 * Acts as the Director's visual "spirit" — agents can detect proximity.
 */

import * as ex from "excalibur";

export class CursorSpirit extends ex.Actor {
	private targetX = 0;
	private targetY = 0;
	private isVisible = false;
	private currentOpacity = 0;

	constructor() {
		super({ width: 24, height: 24, anchor: ex.vec(0.5, 0.5) });
		this.graphics.opacity = 0;
		this.z = 999;

		const canvas = new ex.Canvas({
			width: 24,
			height: 24,
			draw: (ctx) => {
				const gradient = ctx.createRadialGradient(12, 12, 0, 12, 12, 12);
				gradient.addColorStop(0, "rgba(124, 58, 237, 0.3)");
				gradient.addColorStop(1, "rgba(124, 58, 237, 0)");
				ctx.fillStyle = gradient;
				ctx.beginPath();
				ctx.arc(12, 12, 12, 0, Math.PI * 2);
				ctx.fill();
			},
		});
		this.graphics.use(canvas);
	}

	show(x: number, y: number): void {
		this.targetX = x;
		this.targetY = y;
		this.isVisible = true;
	}

	hide(): void {
		this.isVisible = false;
	}

	moveTo(x: number, y: number): void {
		this.targetX = x;
		this.targetY = y;
	}

	onPreUpdate(_engine: ex.Engine, deltaMs: number): void {
		const fadeSpeed = deltaMs / 300;
		this.currentOpacity = this.isVisible
			? Math.min(1, this.currentOpacity + fadeSpeed)
			: Math.max(0, this.currentOpacity - fadeSpeed);
		this.graphics.opacity = this.currentOpacity;

		const lerp = Math.min(1, deltaMs / 50);
		this.pos.x += (this.targetX - this.pos.x) * lerp;
		this.pos.y += (this.targetY - this.pos.y) * lerp;
	}
}
