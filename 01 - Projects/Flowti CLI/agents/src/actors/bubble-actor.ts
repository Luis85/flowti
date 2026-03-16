/**
 * bubble-actor.ts — Speech, thought, and question bubble using Canvas graphic.
 */

import * as ex from "excalibur";

const BUBBLE_WIDTH = 120;
const BUBBLE_HEIGHT = 40;
const DEFAULT_DURATION = 5000;

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
}

export class BubbleActor extends ex.Actor {
	public readonly text: string;
	public readonly kind: BubbleKind;
	public readonly duration: number;
	private elapsed = 0;

	constructor(config: BubbleActorConfig) {
		super({
			pos: ex.vec(config.x, config.y - 40),
			width: BUBBLE_WIDTH,
			height: BUBBLE_HEIGHT,
			anchor: ex.vec(0.5, 1),
			z: 100,
		});
		this.text = config.text;
		this.kind = config.kind;
		this.duration = config.duration ?? DEFAULT_DURATION;
		this.buildGraphic();
	}

	onPreUpdate(_engine: ex.Engine, delta: number): void {
		this.elapsed += delta;
		if (this.elapsed >= this.duration) {
			this.kill();
		}
	}

	private buildGraphic(): void {
		const style = KIND_STYLES[this.kind] ?? KIND_STYLES["speech"];
		const displayText = this.kind === "question" ? "?" : this.text.slice(0, 40);

		const canvas = new ex.Canvas({
			width: BUBBLE_WIDTH,
			height: BUBBLE_HEIGHT,
			cache: true,
			draw: (ctx: CanvasRenderingContext2D) => {
				const cx = BUBBLE_WIDTH / 2;
				const bh = 28;
				const by = 2;

				// Bubble background
				ctx.fillStyle = style.bg;
				ctx.beginPath();
				ctx.roundRect(4, by, BUBBLE_WIDTH - 8, bh, 6);
				ctx.fill();

				// Tail
				if (this.kind === "speech") {
					ctx.beginPath();
					ctx.moveTo(cx - 4, by + bh);
					ctx.lineTo(cx, by + bh + 6);
					ctx.lineTo(cx + 4, by + bh);
					ctx.fill();
				} else if (this.kind === "thought") {
					ctx.fillStyle = style.bg;
					ctx.beginPath();
					ctx.arc(cx, by + bh + 4, 3, 0, Math.PI * 2);
					ctx.fill();
					ctx.beginPath();
					ctx.arc(cx - 2, by + bh + 9, 2, 0, Math.PI * 2);
					ctx.fill();
				}

				// Text
				ctx.fillStyle = style.fg;
				ctx.font = this.kind === "question" ? "bold 14px system-ui" : "11px system-ui";
				ctx.textAlign = "center";
				ctx.textBaseline = "middle";
				ctx.fillText(displayText, cx, by + bh / 2);
			},
		});

		this.graphics.use(canvas);
	}
}
