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
	readonly style?: "desk" | "workbench" | "console" | "scroll-table" | "craft-stall" | "forge-station";
	readonly workstationId?: string;
}

export class WorkstationActor extends ex.Actor {
	public occupied = false;
	public occupantName: string | null = null;
	public toolName: string | null = null;
	public readonly workstationId: string;
	private readonly workstationColor: string;
	private readonly style: "desk" | "workbench" | "console" | "scroll-table" | "craft-stall" | "forge-station";
	private glowPhase = 0;

	constructor(config: WorkstationActorConfig) {
		super({
			pos: ex.vec(config.x, config.y),
			width: ACTOR_WIDTH,
			height: ACTOR_HEIGHT,
			anchor: ex.vec(0.5, 0.5),
			collisionType: ex.CollisionType.PreventCollision,
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

	/** Call each frame to pulse the glow when occupied. */
	updateGlow(deltaMs: number): void {
		if (!this.occupied) return;
		this.glowPhase += deltaMs * 0.003;
		this.buildGraphic();
	}

	private buildGraphic(): void {
		const color = this.workstationColor;
		const occupied = this.occupied;
		const toolName = this.toolName;
		const style = this.style;
		const glowPhase = this.glowPhase;

		const canvas = new ex.Canvas({
			width: ACTOR_WIDTH,
			height: ACTOR_HEIGHT,
			cache: false,
			draw: (ctx: CanvasRenderingContext2D) => {
				const cx = ACTOR_WIDTH / 2;
				const deskY = 8;
				const deskH = 20;

				// Radial glow behind monitor when occupied
				if (occupied) {
					const glowAlpha = 0.3 + 0.5 * ((Math.sin(glowPhase) + 1) / 2);
					const hexAlpha = Math.round(glowAlpha * 255).toString(16).padStart(2, "0");
					const glowGrad = ctx.createRadialGradient(cx, deskY - 2, 2, cx, deskY - 2, 22);
					glowGrad.addColorStop(0, color + hexAlpha);
					glowGrad.addColorStop(1, color + "00");
					ctx.fillStyle = glowGrad;
					ctx.beginPath();
					ctx.arc(cx, deskY - 2, 22, 0, Math.PI * 2);
					ctx.fill();
				}

				switch (style) {
					case "workbench":
						drawWorkbench(ctx, cx, deskY, deskH, color);
						break;
					case "console":
						drawConsole(ctx, cx, deskY, deskH, color);
						break;
					case "scroll-table":
						drawScrollTable(ctx, cx, deskY, deskH, color);
						break;
					case "craft-stall":
						drawCraftStall(ctx, cx, deskY, deskH, color);
						break;
					case "forge-station":
						drawForgeStation(ctx, cx, deskY, deskH, color);
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

function drawScrollTable(
	ctx: CanvasRenderingContext2D,
	cx: number, deskY: number, deskH: number,
	_color: string,
): void {
	const tableW = 50;
	const halfW = tableW / 2;

	// Low wooden table surface
	ctx.fillStyle = "#5c4a35";
	ctx.beginPath();
	ctx.roundRect(cx - halfW, deskY + 4, tableW, deskH - 4, 3);
	ctx.fill();

	// Darker wood edge
	ctx.strokeStyle = "#4e3d2a";
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.roundRect(cx - halfW, deskY + 4, tableW, deskH - 4, 3);
	ctx.stroke();

	// Scroll / parchment on table surface
	ctx.fillStyle = "#d4c4a0";
	ctx.beginPath();
	ctx.roundRect(cx - 14, deskY + 7, 28, 12, 2);
	ctx.fill();
	ctx.strokeStyle = "#c4b090";
	ctx.lineWidth = 0.5;
	ctx.beginPath();
	ctx.roundRect(cx - 14, deskY + 7, 28, 12, 2);
	ctx.stroke();

	// Ink pot — small dark circle
	ctx.fillStyle = "#1a1a2a";
	ctx.beginPath();
	ctx.arc(cx + halfW - 10, deskY + 12, 3, 0, Math.PI * 2);
	ctx.fill();

	// Brush — thin line from ink pot
	ctx.strokeStyle = "#4e3d2a";
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.moveTo(cx + halfW - 8, deskY + 10);
	ctx.lineTo(cx + halfW - 3, deskY + 6);
	ctx.stroke();

	// Squat wooden legs
	ctx.strokeStyle = "#4e3d2a";
	ctx.lineWidth = 3;
	ctx.beginPath();
	ctx.moveTo(cx - halfW + 6, deskY + deskH);
	ctx.lineTo(cx - halfW + 6, deskY + deskH + 7);
	ctx.moveTo(cx + halfW - 6, deskY + deskH);
	ctx.lineTo(cx + halfW - 6, deskY + deskH + 7);
	ctx.stroke();
}

function drawCraftStall(
	ctx: CanvasRenderingContext2D,
	cx: number, deskY: number, deskH: number,
	color: string,
): void {
	const stallW = 52;
	const halfW = stallW / 2;

	// Sturdy wooden posts
	ctx.strokeStyle = "#5c4033";
	ctx.lineWidth = 3;
	ctx.beginPath();
	ctx.moveTo(cx - halfW + 4, deskY - 6);
	ctx.lineTo(cx - halfW + 4, deskY + deskH + 10);
	ctx.moveTo(cx + halfW - 4, deskY - 6);
	ctx.lineTo(cx + halfW - 4, deskY + deskH + 10);
	ctx.stroke();

	// Canopy / awning strip at top — alternating slats
	const awningColors = [color || "#7b2d8b", "#3b82f6"];
	const slats = 6;
	const slotW = (stallW - 8) / slats;
	for (let i = 0; i < slats; i++) {
		ctx.fillStyle = awningColors[i % 2];
		ctx.fillRect(cx - halfW + 4 + i * slotW, deskY - 6, slotW, 5);
	}

	// Stall counter — wood surface
	ctx.fillStyle = "#5c4033";
	ctx.beginPath();
	ctx.roundRect(cx - halfW, deskY + 2, stallW, deskH - 2, 3);
	ctx.fill();

	// Lighter counter top
	ctx.fillStyle = "#7a6a50";
	ctx.fillRect(cx - halfW + 2, deskY + 2, stallW - 4, 4);

	// Display items — small colored rectangles suggesting wares
	ctx.fillStyle = "#e67e22";
	ctx.fillRect(cx - 12, deskY + 10, 6, 5);
	ctx.fillStyle = "#22c55e";
	ctx.fillRect(cx - 3, deskY + 10, 6, 5);
	ctx.fillStyle = "#3b82f6";
	ctx.fillRect(cx + 6, deskY + 10, 6, 5);
}

function drawForgeStation(
	ctx: CanvasRenderingContext2D,
	cx: number, deskY: number, deskH: number,
	_color: string,
): void {
	const baseW = 50;
	const halfW = baseW / 2;

	// Ember glow underneath
	const emberGrad = ctx.createRadialGradient(cx, deskY + deskH + 4, 1, cx, deskY + deskH + 4, 18);
	emberGrad.addColorStop(0, "#e67e22");
	emberGrad.addColorStop(1, "transparent");
	ctx.fillStyle = emberGrad;
	ctx.beginPath();
	ctx.arc(cx, deskY + deskH + 4, 18, 0, Math.PI * 2);
	ctx.fill();

	// Tool rack behind — vertical rectangle
	ctx.fillStyle = "#3a3a3a";
	ctx.fillRect(cx - halfW + 2, deskY - 4, baseW - 4, 6);
	// Small tool silhouettes on rack
	ctx.fillStyle = "#6a6a6a";
	ctx.fillRect(cx - 10, deskY - 3, 2, 4);
	ctx.fillRect(cx - 4, deskY - 3, 2, 4);
	ctx.fillRect(cx + 2, deskY - 3, 2, 4);
	ctx.fillRect(cx + 8, deskY - 3, 2, 4);

	// Dark metal base
	ctx.fillStyle = "#2a2a2a";
	ctx.beginPath();
	ctx.roundRect(cx - halfW, deskY + 2, baseW, deskH - 2, 3);
	ctx.fill();
	ctx.strokeStyle = "#3a3a3a";
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.roundRect(cx - halfW, deskY + 2, baseW, deskH - 2, 3);
	ctx.stroke();

	// Anvil shape — trapezoidal, dark iron
	ctx.fillStyle = "#4a4a4a";
	ctx.beginPath();
	ctx.moveTo(cx - 10, deskY + 6);
	ctx.lineTo(cx + 10, deskY + 6);
	ctx.lineTo(cx + 14, deskY + 16);
	ctx.lineTo(cx - 14, deskY + 16);
	ctx.closePath();
	ctx.fill();

	// Anvil highlight edge
	ctx.strokeStyle = "#6a6a6a";
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.moveTo(cx - 10, deskY + 6);
	ctx.lineTo(cx + 10, deskY + 6);
	ctx.stroke();
}
