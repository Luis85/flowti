/**
 * bubble-actor.ts — Speech, thought, and question bubble actors.
 *
 * Positioned above the owning agent. Auto-dismiss after a configurable duration.
 */

import * as ex from "excalibur";

// ── Dimensions ───────────────────────────────────────────────────────

const BUBBLE_PADDING_X = 8;
const BUBBLE_PADDING_Y = 6;
const BUBBLE_MAX_WIDTH = 100;
const TAIL_SIZE = 6;
const DEFAULT_DURATION = 5000;

// ── Bubble kind colors ───────────────────────────────────────────────

const KIND_STYLES: Record<string, { bg: string; fg: string; border: string }> = {
	speech: { bg: "#ffffff", fg: "#1e293b", border: "#e2e8f0" },
	thought: { bg: "#374151", fg: "#d1d5db", border: "#4b5563" },
	question: { bg: "#f59e0b", fg: "#1e293b", border: "#d97706" },
};

// ── BubbleActor ──────────────────────────────────────────────────────

export type BubbleKind = "speech" | "thought" | "question";

export interface BubbleActorConfig {
	readonly text: string;
	readonly kind: BubbleKind;
	readonly x: number;
	readonly y: number;
	readonly duration?: number;
}

export class BubbleActor extends ex.Actor {
	public readonly text: string;
	public readonly kind: BubbleKind;
	public readonly duration: number;

	private elapsed = 0;
	private fadeAlpha = 1;

	constructor(config: BubbleActorConfig) {
		super({
			pos: ex.vec(config.x, config.y),
			width: BUBBLE_MAX_WIDTH + BUBBLE_PADDING_X * 2,
			height: 30,
			anchor: ex.vec(0.5, 1),
			z: 100, // render above other actors
		});
		this.text = config.text;
		this.kind = config.kind;
		this.duration = config.duration ?? DEFAULT_DURATION;
	}

	onPreUpdate(_engine: ex.Engine, delta: number): void {
		this.elapsed += delta;

		// Fade out in the last 500ms
		const fadeStart = this.duration - 500;
		if (this.elapsed >= fadeStart) {
			this.fadeAlpha = Math.max(0, 1 - (this.elapsed - fadeStart) / 500);
		}

		// Remove after duration
		if (this.elapsed >= this.duration) {
			this.kill();
		}
	}

	onPreDraw(gfx: ex.ExcaliburGraphicsContext, _delta: number): void {
		const style = KIND_STYLES[this.kind] ?? KIND_STYLES["speech"];

		// Measure text to size the bubble
		const font = new ex.Font({
			family: "system-ui, sans-serif",
			size: 11,
			unit: ex.FontUnit.Px,
			color: ex.Color.fromHex(style.fg),
			textAlign: ex.TextAlign.Center,
		});

		const displayText = this.kind === "question" ? "?" : this.text;
		const textGraphic = new ex.Text({ text: displayText, font });
		const textWidth = Math.min(textGraphic.width, BUBBLE_MAX_WIDTH);
		const bubbleWidth = textWidth + BUBBLE_PADDING_X * 2;
		const bubbleHeight = 20 + BUBBLE_PADDING_Y * 2;

		// ── Bubble background ────────────────────────────────
		const bgColor = ex.Color.fromHex(style.bg);
		bgColor.a = this.fadeAlpha;
		const borderColor = ex.Color.fromHex(style.border);
		borderColor.a = this.fadeAlpha;

		// Border (slightly larger rectangle behind)
		gfx.drawRectangle(
			ex.vec(0, -bubbleHeight / 2 - TAIL_SIZE),
			bubbleWidth + 2,
			bubbleHeight + 2,
			borderColor,
		);

		// Main bubble body
		gfx.drawRectangle(
			ex.vec(0, -bubbleHeight / 2 - TAIL_SIZE),
			bubbleWidth,
			bubbleHeight,
			bgColor,
		);

		// ── Tail / trail ─────────────────────────────────────
		if (this.kind === "speech") {
			// Downward-pointing triangle tail
			const tailY = -TAIL_SIZE;
			gfx.drawLine(ex.vec(-TAIL_SIZE / 2, tailY), ex.vec(0, 0), bgColor, 3);
			gfx.drawLine(ex.vec(TAIL_SIZE / 2, tailY), ex.vec(0, 0), bgColor, 3);
		} else if (this.kind === "thought") {
			// Small circles trailing downward
			const trailColor = ex.Color.fromHex(style.bg);
			trailColor.a = this.fadeAlpha * 0.6;
			gfx.drawCircle(ex.vec(0, -3), 3, trailColor);
			gfx.drawCircle(ex.vec(-2, 2), 2, trailColor);
			gfx.drawCircle(ex.vec(-3, 6), 1.5, trailColor);
		}
		// question kind: no tail, just the amber bubble with "?"

		// ── Text ─────────────────────────────────────────────
		const drawFont = new ex.Font({
			family: "system-ui, sans-serif",
			size: this.kind === "question" ? 14 : 11,
			unit: ex.FontUnit.Px,
			color: ex.Color.fromHex(style.fg),
			textAlign: ex.TextAlign.Center,
			bold: this.kind === "question",
		});
		drawFont.color.a = this.fadeAlpha;
		const drawText = new ex.Text({ text: displayText, font: drawFont });
		drawText.draw(gfx, -drawText.width / 2, -bubbleHeight / 2 - TAIL_SIZE - 6);
	}
}
