/**
 * workstation-actor.ts — Desk/workstation using Canvas graphic.
 */

import * as ex from "excalibur";

const ACTOR_WIDTH = 56;
const ACTOR_HEIGHT = 44;

export interface WorkstationActorConfig {
	readonly x: number;
	readonly y: number;
	readonly workstationColor: string;
}

export class WorkstationActor extends ex.Actor {
	public occupied = false;
	public occupantName: string | null = null;
	public toolName: string | null = null;
	private readonly workstationColor: string;

	constructor(config: WorkstationActorConfig) {
		super({
			pos: ex.vec(config.x, config.y),
			width: ACTOR_WIDTH,
			height: ACTOR_HEIGHT,
			anchor: ex.vec(0.5, 0.5),
		});
		this.workstationColor = config.workstationColor;
		this.buildGraphic();
	}

	occupy(agentName: string): void {
		this.occupied = true;
		this.occupantName = agentName;
		this.buildGraphic();
	}

	vacate(): void {
		this.occupied = false;
		this.occupantName = null;
		this.buildGraphic();
	}

	showTool(name: string): void {
		this.toolName = name;
		this.buildGraphic();
	}

	clearTool(): void {
		this.toolName = null;
		this.buildGraphic();
	}

	private buildGraphic(): void {
		const color = this.workstationColor;
		const occupied = this.occupied;
		const toolName = this.toolName;

		const canvas = new ex.Canvas({
			width: ACTOR_WIDTH,
			height: ACTOR_HEIGHT,
			cache: true,
			draw: (ctx: CanvasRenderingContext2D) => {
				const cx = ACTOR_WIDTH / 2;
				const deskW = 48;
				const deskH = 20;
				const deskY = 8;

				// Desk surface
				ctx.fillStyle = color;
				ctx.beginPath();
				ctx.roundRect(cx - deskW / 2, deskY, deskW, deskH, 3);
				ctx.fill();

				// Top edge highlight
				ctx.strokeStyle = "#ffffff22";
				ctx.lineWidth = 1;
				ctx.beginPath();
				ctx.moveTo(cx - deskW / 2, deskY);
				ctx.lineTo(cx + deskW / 2, deskY);
				ctx.stroke();

				// Legs
				ctx.strokeStyle = "#1a1a2e";
				ctx.lineWidth = 2;
				ctx.beginPath();
				ctx.moveTo(cx - deskW / 2 + 6, deskY + deskH);
				ctx.lineTo(cx - deskW / 2 + 6, deskY + deskH + 10);
				ctx.moveTo(cx + deskW / 2 - 6, deskY + deskH);
				ctx.lineTo(cx + deskW / 2 - 6, deskY + deskH + 10);
				ctx.stroke();

				// Occupancy dot
				if (occupied) {
					ctx.fillStyle = "#22c55e";
					ctx.beginPath();
					ctx.arc(cx + deskW / 2 - 4, deskY + 4, 3, 0, Math.PI * 2);
					ctx.fill();
				}

				// Tool label
				if (toolName) {
					ctx.fillStyle = "#94a3b8";
					ctx.font = "9px system-ui, sans-serif";
					ctx.textAlign = "center";
					ctx.fillText(toolName, cx, deskY - 4);
				}
			},
		});

		this.graphics.use(canvas);
	}
}
