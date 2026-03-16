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
	readonly style?: "desk" | "workbench" | "console";
	readonly workstationId?: string;
}

export class WorkstationActor extends ex.Actor {
	public occupied = false;
	public occupantName: string | null = null;
	public toolName: string | null = null;
	public readonly workstationId: string;
	private readonly workstationColor: string;
	private readonly style: "desk" | "workbench" | "console";

	constructor(config: WorkstationActorConfig) {
		super({
			pos: ex.vec(config.x, config.y),
			width: ACTOR_WIDTH,
			height: ACTOR_HEIGHT,
			anchor: ex.vec(0.5, 0.5),
		});
		this.workstationId = config.workstationId ?? `ws-${config.x}-${config.y}`;
		this.workstationColor = config.workstationColor;
		this.style = config.style ?? "desk";
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
		const style = this.style;

		const canvas = new ex.Canvas({
			width: ACTOR_WIDTH,
			height: ACTOR_HEIGHT,
			cache: true,
			draw: (ctx: CanvasRenderingContext2D) => {
				const cx = ACTOR_WIDTH / 2;
				const deskY = 8;
				const deskH = 20;

				switch (style) {
					case "workbench":
						drawWorkbench(ctx, cx, deskY, deskH, color);
						break;
					case "console":
						drawConsole(ctx, cx, deskY, deskH, color);
						break;
					default:
						drawDesk(ctx, cx, deskY, deskH, color);
						break;
				}

				// Occupancy dot (shared across all styles)
				if (occupied) {
					const halfW = style === "workbench" ? 28 : 24;
					ctx.fillStyle = "#22c55e";
					ctx.beginPath();
					ctx.arc(cx + halfW - 4, deskY + 4, 3, 0, Math.PI * 2);
					ctx.fill();
				}

				// Tool label (shared across all styles)
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

// ── Style drawing helpers ───────────────────────────────────────────

function drawDesk(
	ctx: CanvasRenderingContext2D,
	cx: number, deskY: number, deskH: number,
	color: string,
): void {
	const deskW = 48;

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

	// Small monitor on top of desk
	ctx.fillStyle = "#3b82f6";
	ctx.fillRect(cx - 2, deskY - 3, 4, 3);
}

function drawWorkbench(
	ctx: CanvasRenderingContext2D,
	cx: number, deskY: number, deskH: number,
	color: string,
): void {
	const benchW = 56;

	// Workbench surface — wider, wood-toned
	ctx.fillStyle = "#5c4033";
	ctx.beginPath();
	ctx.roundRect(cx - benchW / 2, deskY, benchW, deskH, 4);
	ctx.fill();

	// Darker border for rounded look
	ctx.strokeStyle = "#3d2a1e";
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.roundRect(cx - benchW / 2, deskY, benchW, deskH, 4);
	ctx.stroke();

	// Top edge highlight
	ctx.strokeStyle = "#ffffff18";
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.moveTo(cx - benchW / 2 + 2, deskY);
	ctx.lineTo(cx + benchW / 2 - 2, deskY);
	ctx.stroke();

	// Legs — use room color for subtle theme tint
	ctx.strokeStyle = color;
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.moveTo(cx - benchW / 2 + 6, deskY + deskH);
	ctx.lineTo(cx - benchW / 2 + 6, deskY + deskH + 10);
	ctx.moveTo(cx + benchW / 2 - 6, deskY + deskH);
	ctx.lineTo(cx + benchW / 2 - 6, deskY + deskH + 10);
	ctx.stroke();
}

function drawConsole(
	ctx: CanvasRenderingContext2D,
	cx: number, deskY: number, deskH: number,
	color: string,
): void {
	const deskW = 48;

	// Console surface
	ctx.fillStyle = color;
	ctx.beginPath();
	ctx.roundRect(cx - deskW / 2, deskY, deskW, deskH, 3);
	ctx.fill();

	// Cyan top accent line
	ctx.strokeStyle = "#06b6d4";
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.moveTo(cx - deskW / 2, deskY);
	ctx.lineTo(cx + deskW / 2, deskY);
	ctx.stroke();

	// Small indicator dots on surface
	ctx.fillStyle = "#06b6d4";
	ctx.beginPath();
	ctx.arc(cx - 8, deskY + deskH / 2, 1.5, 0, Math.PI * 2);
	ctx.fill();
	ctx.beginPath();
	ctx.arc(cx, deskY + deskH / 2, 1.5, 0, Math.PI * 2);
	ctx.fill();
	ctx.beginPath();
	ctx.arc(cx + 8, deskY + deskH / 2, 1.5, 0, Math.PI * 2);
	ctx.fill();

	// Legs
	ctx.strokeStyle = "#1a1a2e";
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.moveTo(cx - deskW / 2 + 6, deskY + deskH);
	ctx.lineTo(cx - deskW / 2 + 6, deskY + deskH + 10);
	ctx.moveTo(cx + deskW / 2 - 6, deskY + deskH);
	ctx.lineTo(cx + deskW / 2 - 6, deskY + deskH + 10);
	ctx.stroke();
}
