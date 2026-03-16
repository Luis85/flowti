/**
 * agent-actor.ts — Simple agent actor using ExcaliburJS Canvas graphic.
 *
 * Draws a colored circle (status color) with a name label below.
 * Click to open the agent panel.
 */

import * as ex from "excalibur";
import type { DashboardAgent } from "../data/types.js";
import type { BrainState, MovementTarget } from "../brain/brain-types.js";

// ── Status colors ────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
	busy: "#22c55e",
	idle: "#3b82f6",
	unassigned: "#6b7280",
	waiting: "#f59e0b",
};

// ── Dimensions ───────────────────────────────────────────────────────

const AVATAR_RADIUS = 16;
const ACTOR_SIZE = 64;

// ── AgentActor ───────────────────────────────────────────────────────

export interface AgentActorConfig {
	readonly agent: DashboardAgent;
	readonly x: number;
	readonly y: number;
	readonly onSelect: (agentName: string) => void;
}

export class AgentActor extends ex.Actor {
	public agentData: DashboardAgent;
	public brainState: BrainState = "idle";
	public facingLeft = false;

	private readonly onSelect: (agentName: string) => void;
	private statusColor: string;

	constructor(config: AgentActorConfig) {
		super({
			pos: ex.vec(config.x, config.y),
			width: ACTOR_SIZE,
			height: ACTOR_SIZE,
			anchor: ex.vec(0.5, 0.5),
		});
		this.agentData = config.agent;
		this.onSelect = config.onSelect;
		this.statusColor = STATUS_COLORS[config.agent.status] ?? STATUS_COLORS["unassigned"];
		this.buildGraphic();
	}

	onInitialize(_engine: ex.Engine): void {
		this.on("pointerdown", () => {
			this.onSelect(this.agentData.name);
		});
	}

	updateFromBrain(state: BrainState, target: MovementTarget): void {
		this.brainState = state;
		if (target.x !== undefined && (state === "walking-to" || state === "talking")) {
			this.facingLeft = target.x < this.pos.x;
		}
	}

	updateVisualStatus(status: string): void {
		this.statusColor = STATUS_COLORS[status] ?? STATUS_COLORS["unassigned"];
		this.buildGraphic();
	}

	private buildGraphic(): void {
		const color = ex.Color.fromHex(this.statusColor);
		const name = this.agentData.persona ?? this.agentData.name;
		const isAi = this.agentData.agentType === "ai";

		const canvas = new ex.Canvas({
			width: ACTOR_SIZE,
			height: ACTOR_SIZE,
			cache: true,
			draw: (ctx: CanvasRenderingContext2D) => {
				const cx = ACTOR_SIZE / 2;

				// ── Circle avatar ────────────────────────────
				ctx.fillStyle = color.toHex();
				ctx.beginPath();
				ctx.arc(cx, 18, AVATAR_RADIUS, 0, Math.PI * 2);
				ctx.fill();

				// ── Initials inside circle ──────────────────
				ctx.fillStyle = "#ffffff";
				ctx.font = "bold 12px system-ui, sans-serif";
				ctx.textAlign = "center";
				ctx.textBaseline = "middle";
				const initials = name.slice(0, 2).toUpperCase();
				ctx.fillText(initials, cx, 18);

				// ── AI/H badge ──────────────────────────────
				const badgeText = isAi ? "AI" : "H";
				const badgeColor = isAi ? "#8b5cf6" : "#10b981";
				ctx.fillStyle = badgeColor;
				ctx.beginPath();
				ctx.arc(cx + AVATAR_RADIUS - 2, 6, 7, 0, Math.PI * 2);
				ctx.fill();
				ctx.fillStyle = "#ffffff";
				ctx.font = "bold 7px system-ui, sans-serif";
				ctx.fillText(badgeText, cx + AVATAR_RADIUS - 2, 7);

				// ── Name label below ────────────────────────
				ctx.fillStyle = "#e2e8f0";
				ctx.font = "11px system-ui, sans-serif";
				ctx.textAlign = "center";
				ctx.textBaseline = "top";
				const displayName = name.length > 8 ? name.slice(0, 7) + "…" : name;
				ctx.fillText(displayName, cx, 38);

				// ── Status dot ──────────────────────────────
				ctx.fillStyle = color.toHex();
				ctx.beginPath();
				ctx.arc(cx, 52, 3, 0, Math.PI * 2);
				ctx.fill();
			},
		});

		this.graphics.use(canvas);
	}
}
