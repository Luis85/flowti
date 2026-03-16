/**
 * workstation-actor.ts — Desk/workstation actor for agent seating.
 *
 * Canvas-drawn desk surface with optional tool label and occupancy tracking.
 */

import * as ex from "excalibur";

// ── Dimensions ───────────────────────────────────────────────────────

const DESK_WIDTH = 48;
const DESK_HEIGHT = 24;
const DESK_LEG_HEIGHT = 12;
const ACTOR_WIDTH = 56;
const ACTOR_HEIGHT = 44;

// ── WorkstationActor ─────────────────────────────────────────────────

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
	}

	/** Mark this workstation as occupied by an agent. */
	occupy(agentName: string): void {
		this.occupied = true;
		this.occupantName = agentName;
	}

	/** Free this workstation. */
	vacate(): void {
		this.occupied = false;
		this.occupantName = null;
	}

	/** Show a tool name label above the workstation. */
	showTool(name: string): void {
		this.toolName = name;
	}

	/** Clear the tool label. */
	clearTool(): void {
		this.toolName = null;
	}

	onPreDraw(gfx: ex.ExcaliburGraphicsContext, _delta: number): void {
		const color = ex.Color.fromHex(this.workstationColor);
		const surfaceColor = color.clone();

		// ── Desk surface ─────────────────────────────────────
		gfx.drawRectangle(
			ex.vec(0, 0),
			DESK_WIDTH,
			DESK_HEIGHT,
			surfaceColor,
		);

		// ── Desk edge highlight ──────────────────────────────
		const edgeColor = color.lighten(0.15);
		gfx.drawLine(
			ex.vec(-DESK_WIDTH / 2, -DESK_HEIGHT / 2),
			ex.vec(DESK_WIDTH / 2, -DESK_HEIGHT / 2),
			edgeColor, 2,
		);

		// ── Legs ─────────────────────────────────────────────
		const legColor = color.darken(0.2);
		const legTop = DESK_HEIGHT / 2;
		const legBottom = legTop + DESK_LEG_HEIGHT;
		// Left leg
		gfx.drawLine(
			ex.vec(-DESK_WIDTH / 2 + 4, legTop),
			ex.vec(-DESK_WIDTH / 2 + 4, legBottom),
			legColor, 2,
		);
		// Right leg
		gfx.drawLine(
			ex.vec(DESK_WIDTH / 2 - 4, legTop),
			ex.vec(DESK_WIDTH / 2 - 4, legBottom),
			legColor, 2,
		);

		// ── Occupancy indicator ──────────────────────────────
		if (this.occupied) {
			const dotColor = ex.Color.fromHex("#22c55e");
			dotColor.a = 0.7;
			gfx.drawCircle(ex.vec(DESK_WIDTH / 2 - 2, -DESK_HEIGHT / 2 + 2), 3, dotColor);
		}

		// ── Tool label above desk ────────────────────────────
		if (this.toolName) {
			const toolFont = new ex.Font({
				family: "system-ui, sans-serif",
				size: 9,
				unit: ex.FontUnit.Px,
				color: ex.Color.fromHex("#94a3b8"),
				textAlign: ex.TextAlign.Center,
			});
			const toolText = new ex.Text({ text: this.toolName, font: toolFont });
			toolText.draw(gfx, -toolText.width / 2, -DESK_HEIGHT / 2 - 14);
		}
	}
}
