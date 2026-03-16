/**
 * doorway-actor.ts — Interactive doorway that navigates between scenes.
 *
 * Canvas-drawn arch shape with a label and glowing border effect.
 */

import * as ex from "excalibur";

// ── Dimensions ───────────────────────────────────────────────────────

const DOOR_WIDTH = 40;
const DOOR_HEIGHT = 56;
const ARCH_RADIUS = DOOR_WIDTH / 2;
const ACTOR_WIDTH = 52;
const ACTOR_HEIGHT = 68;

// ── DoorwayActor ─────────────────────────────────────────────────────

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
	private glowPhase = 0;

	constructor(config: DoorwayActorConfig) {
		super({
			pos: ex.vec(config.x, config.y),
			width: ACTOR_WIDTH,
			height: ACTOR_HEIGHT,
			anchor: ex.vec(0.5, 0.5),
		});
		this.targetScene = config.targetScene;
		this.label = config.label;
		this.onClick = config.onClick;
	}

	onInitialize(_engine: ex.Engine): void {
		this.on("pointerdown", () => {
			this.onClick(this.targetScene);
		});
	}

	onPreDraw(gfx: ex.ExcaliburGraphicsContext, _delta: number): void {
		this.glowPhase += 0.025;

		// ── Glow border (pulsing) ────────────────────────────
		const glowAlpha = 0.3 + 0.2 * Math.sin(this.glowPhase);
		const glowColor = ex.Color.fromHex("#f59e0b");
		glowColor.a = glowAlpha;
		gfx.drawRectangle(
			ex.vec(0, DOOR_HEIGHT / 2 - DOOR_HEIGHT / 2),
			DOOR_WIDTH + 6,
			DOOR_HEIGHT + 6,
			glowColor,
		);

		// ── Door frame ───────────────────────────────────────
		const frameColor = ex.Color.fromHex("#374151");
		gfx.drawRectangle(
			ex.vec(0, DOOR_HEIGHT / 2 - DOOR_HEIGHT / 2),
			DOOR_WIDTH,
			DOOR_HEIGHT,
			frameColor,
		);

		// ── Inner opening (darker) ───────────────────────────
		const openingColor = ex.Color.fromHex("#111827");
		gfx.drawRectangle(
			ex.vec(0, DOOR_HEIGHT / 2 - DOOR_HEIGHT / 2 + 2),
			DOOR_WIDTH - 6,
			DOOR_HEIGHT - 4,
			openingColor,
		);

		// ── Arch top (semicircle approximated with circle) ───
		const archY = -DOOR_HEIGHT / 2;
		gfx.drawCircle(
			ex.vec(0, archY),
			ARCH_RADIUS,
			frameColor,
		);
		// Inner arch
		gfx.drawCircle(
			ex.vec(0, archY),
			ARCH_RADIUS - 3,
			openingColor,
		);

		// ── Label below doorway ──────────────────────────────
		const labelFont = new ex.Font({
			family: "system-ui, sans-serif",
			size: 10,
			unit: ex.FontUnit.Px,
			color: ex.Color.fromHex("#e2e8f0"),
			textAlign: ex.TextAlign.Center,
		});
		const labelText = new ex.Text({ text: this.label, font: labelFont });
		labelText.draw(gfx, -labelText.width / 2, DOOR_HEIGHT / 2 + 8);

		// ── Arrow hint inside doorway ────────────────────────
		const arrowColor = ex.Color.fromHex("#9ca3af");
		arrowColor.a = 0.6 + 0.3 * Math.sin(this.glowPhase * 1.5);
		const arrowY = 0;
		gfx.drawLine(ex.vec(-4, arrowY - 4), ex.vec(0, arrowY - 8), arrowColor, 1.5);
		gfx.drawLine(ex.vec(4, arrowY - 4), ex.vec(0, arrowY - 8), arrowColor, 1.5);
		gfx.drawLine(ex.vec(0, arrowY + 4), ex.vec(0, arrowY - 8), arrowColor, 1.5);
	}
}
