/**
 * doorway-actor.ts — Interactive doorway using Canvas graphic.
 */

import * as ex from "excalibur";

const ACTOR_SIZE = 64;

export interface DoorwayActorConfig {
	readonly x: number;
	readonly y: number;
	readonly targetScene: string;
	readonly label: string;
	readonly onClick: (targetScene: string) => void;
}

export class DoorwayActor extends ex.Actor {
	public readonly targetScene: string;
	public readonly label: string;
	private readonly onClick: (targetScene: string) => void;
	private glowPhase = Math.random() * Math.PI * 2;
	private hovered = false;

	constructor(config: DoorwayActorConfig) {
		super({
			pos: ex.vec(config.x, config.y),
			width: ACTOR_SIZE,
			height: ACTOR_SIZE + 16,
			anchor: ex.vec(0.5, 0.5),
			collisionType: ex.CollisionType.PreventCollision,
		});
		this.targetScene = config.targetScene;
		this.label = config.label;
		this.onClick = config.onClick;
		this.buildGraphic();
	}

	onInitialize(engine: ex.Engine): void {
		this.on("pointerdown", () => {
			this.onClick(this.targetScene);
		});
		this.on("pointerenter", () => {
			this.hovered = true;
			engine.canvas.style.cursor = "pointer";
		});
		this.on("pointerleave", () => {
			this.hovered = false;
			engine.canvas.style.cursor = "default";
		});
	}

	onPreUpdate(_engine: ex.Engine, _delta: number): void {
		this.glowPhase += 0.03;
		// Rebuild graphic periodically for glow animation
		if (Math.floor(this.glowPhase * 10) % 3 === 0) {
			this.buildGraphic();
		}
	}

	private buildGraphic(): void {
		const baseAlpha = this.hovered ? 0.8 : 0.4;
		const glowAlpha = baseAlpha + 0.2 * Math.sin(this.glowPhase);

		const canvas = new ex.Canvas({
			width: ACTOR_SIZE,
			height: ACTOR_SIZE + 16,
			cache: false,
			draw: (ctx: CanvasRenderingContext2D) => {
				const cx = ACTOR_SIZE / 2;
				const doorW = 40;
				const doorH = 52;
				const doorX = cx - doorW / 2;
				const doorY = 4;

				// Glow border
				ctx.shadowColor = "#f59e0b";
				ctx.shadowBlur = 8 * glowAlpha;
				ctx.fillStyle = "#374151";
				ctx.beginPath();
				ctx.roundRect(doorX - 2, doorY - 2, doorW + 4, doorH + 4, 8);
				ctx.fill();
				ctx.shadowBlur = 0;

				// Door frame
				ctx.fillStyle = this.hovered ? "#374151" : "#1f2937";
				ctx.beginPath();
				ctx.roundRect(doorX, doorY, doorW, doorH, 6);
				ctx.fill();

				// Inner dark opening
				ctx.fillStyle = "#0a0a0f";
				ctx.beginPath();
				ctx.roundRect(doorX + 4, doorY + 4, doorW - 8, doorH - 8, 4);
				ctx.fill();

				// Arrow inside
				ctx.strokeStyle = `rgba(156, 163, 175, ${0.5 + 0.3 * Math.sin(this.glowPhase * 1.5)})`;
				ctx.lineWidth = 2;
				ctx.beginPath();
				ctx.moveTo(cx - 6, doorY + doorH / 2 + 4);
				ctx.lineTo(cx, doorY + doorH / 2 - 4);
				ctx.lineTo(cx + 6, doorY + doorH / 2 + 4);
				ctx.stroke();

				// Label below
				ctx.fillStyle = "#e2e8f0";
				ctx.font = "11px system-ui, sans-serif";
				ctx.textAlign = "center";
				ctx.textBaseline = "top";
				ctx.fillText(this.label, cx, doorY + doorH + 6);
			},
		});

		this.graphics.use(canvas);
	}
}
