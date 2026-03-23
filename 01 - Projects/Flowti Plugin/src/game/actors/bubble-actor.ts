/**
 * bubble-actor.ts — Speech, thought, and question bubble using Canvas graphic.
 *
 * Auto-sizes width and wraps text to fit naturally.
 */

import * as ex from "excalibur";

const MAX_BUBBLE_WIDTH = 200;
const MIN_BUBBLE_WIDTH = 60;
const LINE_HEIGHT = 14;
const PADDING_X = 12;
const PADDING_Y = 8;
const FONT_SIZE = 11;
const DEFAULT_DURATION = 5000;
const MAX_LINES = 3;

export type BubbleKind = "speech" | "thought" | "question";

const KIND_STYLES: Record<string, { bg: string; fg: string }> = {
	speech: { bg: "#ffffff", fg: "#1e293b" },
	thought: { bg: "#374151", fg: "#d1d5db" },
	question: { bg: "#f59e0b", fg: "#1e293b" },
};

export interface BubbleActorConfig {
	readonly text: string;
	readonly kind: BubbleKind;
	readonly x: number;
	readonly y: number;
	readonly duration?: number;
	readonly scale?: number;
	readonly iconPath?: string;
}

/** Wrap text to fit within maxWidth, return lines. */
function wrapText(text: string, maxWidth: number, font: string): string[] {
	const canvas = document.createElement("canvas");
	const ctx = canvas.getContext("2d")!;
	ctx.font = font;

	const words = text.split(/\s+/);
	const lines: string[] = [];
	let currentLine = "";

	for (const word of words) {
		const test = currentLine ? `${currentLine} ${word}` : word;
		if (ctx.measureText(test).width > maxWidth && currentLine) {
			lines.push(currentLine);
			currentLine = word;
			if (lines.length >= MAX_LINES) break;
		} else {
			currentLine = test;
		}
	}
	if (currentLine && lines.length < MAX_LINES) {
		lines.push(currentLine);
	} else if (lines.length >= MAX_LINES) {
		// Truncate last line with ellipsis
		lines[MAX_LINES - 1] = lines[MAX_LINES - 1].slice(0, -1) + "\u2026";
	}

	return lines.length > 0 ? lines : [text.slice(0, 20)];
}

export class BubbleActor extends ex.Actor {
	public readonly text: string;
	public readonly kind: BubbleKind;
	public readonly duration: number;
	private elapsed = 0;

	constructor(config: BubbleActorConfig) {
		const font = `${FONT_SIZE}px system-ui, sans-serif`;
		const displayText = config.kind === "question" ? "?" : config.text;
		const lines = config.kind === "question" ? ["?"] : wrapText(displayText, MAX_BUBBLE_WIDTH - PADDING_X * 2, font);

		// Measure actual width needed
		const measureCanvas = document.createElement("canvas");
		const measureCtx = measureCanvas.getContext("2d")!;
		measureCtx.font = config.kind === "question" ? `bold 14px system-ui` : font;
		const maxLineWidth = Math.max(...lines.map((l) => measureCtx.measureText(l).width));
		const bubbleW = Math.max(MIN_BUBBLE_WIDTH, Math.min(MAX_BUBBLE_WIDTH, maxLineWidth + PADDING_X * 2));
		const bubbleH = PADDING_Y * 2 + lines.length * LINE_HEIGHT + 10; // +10 for tail space

		const s = config.scale ?? 1;
		super({
			pos: ex.vec(config.x, config.y),
			width: bubbleW,
			height: bubbleH,
			anchor: ex.vec(0.5, 1),
			z: 100,
			scale: ex.vec(s, s),
			collisionType: ex.CollisionType.PreventCollision,
		});
		this.text = config.text;
		this.kind = config.kind;
		this.duration = config.duration ?? DEFAULT_DURATION;
		this.buildGraphic(lines, bubbleW, bubbleH);
	}

	onPreUpdate(_engine: ex.Engine, delta: number): void {
		this.elapsed += delta;
		if (this.elapsed >= this.duration) {
			this.kill();
		}
	}

	private buildGraphic(lines: readonly string[], bubbleW: number, bubbleH: number): void {
		const style = KIND_STYLES[this.kind] ?? KIND_STYLES["speech"];
		const bodyH = bubbleH - 10; // space for tail

		const canvas = new ex.Canvas({
			width: bubbleW,
			height: bubbleH,
			cache: true,
			draw: (ctx: CanvasRenderingContext2D) => {
				const cx = bubbleW / 2;

				// Bubble background
				ctx.fillStyle = style.bg;
				ctx.beginPath();
				ctx.roundRect(2, 2, bubbleW - 4, bodyH - 2, 6);
				ctx.fill();

				// Tail
				if (this.kind === "speech") {
					ctx.beginPath();
					ctx.moveTo(cx - 4, bodyH);
					ctx.lineTo(cx, bodyH + 6);
					ctx.lineTo(cx + 4, bodyH);
					ctx.fill();
				} else if (this.kind === "thought") {
					ctx.fillStyle = style.bg;
					ctx.beginPath();
					ctx.arc(cx, bodyH + 3, 3, 0, Math.PI * 2);
					ctx.fill();
					ctx.beginPath();
					ctx.arc(cx - 2, bodyH + 8, 2, 0, Math.PI * 2);
					ctx.fill();
				}

				// Text
				ctx.fillStyle = style.fg;
				ctx.font = this.kind === "question" ? "bold 14px system-ui" : `${FONT_SIZE}px system-ui, sans-serif`;
				ctx.textAlign = "center";
				ctx.textBaseline = "middle";

				if (lines.length === 1) {
					ctx.fillText(lines[0], cx, bodyH / 2 + 1);
				} else {
					const totalTextH = lines.length * LINE_HEIGHT;
					const startY = (bodyH - totalTextH) / 2 + LINE_HEIGHT / 2;
					for (let i = 0; i < lines.length; i++) {
						ctx.fillText(lines[i], cx, startY + i * LINE_HEIGHT);
					}
				}
			},
		});

		this.graphics.use(canvas);
	}
}
