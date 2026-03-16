/**
 * agent-actor.ts — Agent actor using Ninja Adventure sprite animations.
 *
 * Receives pre-loaded AgentSprites (idle + 4 directional walks) and switches
 * between them based on brain state. Name label is a child actor positioned
 * below the sprite so it stays visible during animation switches.
 */

import * as ex from "excalibur";
import type { DashboardAgent } from "../data/types.js";
import type { BrainState, MovementTarget } from "../brain/brain-types.js";
import type { AgentSprites } from "../sprites/sprite-loader.js";

// ── Dimensions ───────────────────────────────────────────────────────

const SCALE = 4;

// ── Direction ────────────────────────────────────────────────────────

type Direction = "down" | "left" | "right" | "up";

function resolveDirection(dx: number, dy: number): Direction {
	if (Math.abs(dx) > Math.abs(dy)) {
		return dx > 0 ? "right" : "left";
	}
	return dy > 0 ? "down" : "up";
}

// ── Pose names ───────────────────────────────────────────────────────

const POSE_IDLE = "idle";
const POSE_WALK_DOWN = "walk-down";
const POSE_WALK_LEFT = "walk-left";
const POSE_WALK_RIGHT = "walk-right";
const POSE_WALK_UP = "walk-up";

const WALK_POSES: Record<Direction, string> = {
	down: POSE_WALK_DOWN,
	left: POSE_WALK_LEFT,
	right: POSE_WALK_RIGHT,
	up: POSE_WALK_UP,
};

// ── AgentActor ───────────────────────────────────────────────────────

export interface AgentActorConfig {
	readonly agent: DashboardAgent;
	readonly x: number;
	readonly y: number;
	readonly onSelect: (agentName: string) => void;
	readonly sprites: AgentSprites;
}

export class AgentActor extends ex.Actor {
	public agentData: DashboardAgent;
	public brainState: BrainState = "idle";

	private readonly onSelect: (agentName: string) => void;
	private currentPoseName: string = POSE_IDLE;
	private bobPhase = 0;
	private baseY: number;
	private direction: Direction = "down";

	constructor(config: AgentActorConfig) {
		super({
			pos: ex.vec(config.x, config.y),
			width: 16,
			height: 16,
			anchor: ex.vec(0.5, 0.5),
		});
		this.agentData = config.agent;
		this.onSelect = config.onSelect;
		this.baseY = config.y;
		this.scale = ex.vec(SCALE, SCALE);

		this.registerAnimations(config.sprites);
		this.buildLabelChild();
		this.graphics.use(POSE_IDLE);
	}

	onInitialize(_engine: ex.Engine): void {
		this.on("pointerdown", () => {
			this.onSelect(this.agentData.name);
		});
	}

	onPreUpdate(_engine: ex.Engine, delta: number): void {
		if (this.brainState === "idle" || this.brainState === "waiting" || this.brainState === "on-break") {
			this.bobPhase += delta * 0.003;
			this.pos.y = this.baseY + Math.sin(this.bobPhase) * 1;
		} else {
			this.pos.y = this.baseY;
		}
	}

	updateFromBrain(state: BrainState, target: MovementTarget): void {
		this.brainState = state;

		// Resolve direction only for walking states
		if (target.x !== undefined && target.y !== undefined &&
			(state === "walking-to" || state === "wandering")) {
			const dx = target.x - this.pos.x;
			const dy = target.y - this.pos.y;
			if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
				this.direction = resolveDirection(dx, dy);
			}
		}

		const poseName = this.brainStateToPose(state);
		if (poseName !== this.currentPoseName) {
			this.currentPoseName = poseName;
			this.graphics.use(poseName);
		}
	}

	/** No-op: real sprites handle idle animation internally. */
	setIdlePose(_poseName: string): void {
		// No-op
	}

	updateVisualStatus(_status: string): void {
		// Status is set at creation time via the label child.
	}

	// ── Private ──────────────────────────────────────────────────────

	private registerAnimations(sprites: AgentSprites): void {
		this.graphics.add(POSE_IDLE, sprites.idle);
		this.graphics.add(POSE_WALK_DOWN, sprites.walkDown);
		this.graphics.add(POSE_WALK_LEFT, sprites.walkLeft);
		this.graphics.add(POSE_WALK_RIGHT, sprites.walkRight);
		this.graphics.add(POSE_WALK_UP, sprites.walkUp);
	}

	private brainStateToPose(state: BrainState): string {
		switch (state) {
			case "wandering":
			case "walking-to":
				return WALK_POSES[this.direction];
			case "idle":
			case "working":
			case "talking":
			case "waiting":
			case "on-break":
			default:
				return POSE_IDLE;
		}
	}

	private buildLabelChild(): void {
		const name = this.agentData.persona ?? this.agentData.name;
		const isAi = this.agentData.agentType === "ai";
		const status = this.agentData.status;

		const STATUS_COLORS: Record<string, string> = {
			busy: "#22c55e", idle: "#3b82f6", unassigned: "#6b7280",
		};

		const labelCanvas = new ex.Canvas({
			width: 48,
			height: 16,
			cache: true,
			draw: (ctx: CanvasRenderingContext2D) => {
				// Name label
				ctx.fillStyle = "#e2e8f0";
				ctx.font = "9px system-ui, sans-serif";
				ctx.textAlign = "center";
				ctx.textBaseline = "top";
				const truncName = name.length > 8 ? name.slice(0, 7) + "\u2026" : name;
				ctx.fillText(truncName, 24, 0);

				// Status dot
				ctx.fillStyle = STATUS_COLORS[status] ?? "#6b7280";
				ctx.beginPath();
				ctx.arc(24, 12, 2, 0, Math.PI * 2);
				ctx.fill();

				// AI/H badge
				const badgeX = 42;
				const badgeY = 4;
				const badgeText = isAi ? "AI" : "H";
				const badgeColor = isAi ? "#8b5cf6" : "#10b981";
				ctx.fillStyle = badgeColor;
				ctx.beginPath();
				ctx.arc(badgeX, badgeY, 5, 0, Math.PI * 2);
				ctx.fill();
				ctx.fillStyle = "#ffffff";
				ctx.font = "bold 5px system-ui, sans-serif";
				ctx.textAlign = "center";
				ctx.textBaseline = "middle";
				ctx.fillText(badgeText, badgeX, badgeY + 1);
			},
		});

		// Add as named graphic "label" for test verification
		this.graphics.add("label", labelCanvas);

		// Create child actor for the label so it renders independently
		const labelActor = new ex.Actor({
			pos: ex.vec(0, 12),
			anchor: ex.vec(0.5, 0),
			z: 1,
		});
		labelActor.graphics.use(labelCanvas);
		this.addChild(labelActor);
	}
}
