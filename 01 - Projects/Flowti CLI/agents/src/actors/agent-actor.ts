/**
 * agent-actor.ts — Agent actor using pixel-art sprite poses.
 *
 * Draws a pixel-art character with pose-specific graphics that swap
 * based on brain state. Includes name label and AI/H badge.
 * Click to open the agent panel.
 */

import * as ex from "excalibur";
import type { DashboardAgent } from "../data/types.js";
import type { BrainState, MovementTarget } from "../brain/brain-types.js";
import {
	hashColor,
	statusPalette,
	drawIdlePose,
	drawWalkFrame,
	drawWorkingPose,
	drawTalkingPose,
	drawWaitingPose,
	drawLookAroundPose,
	drawStretchPose,
} from "./pixel-sprites.js";
import type { SpritePalette } from "./pixel-sprites.js";

// ── Dimensions ───────────────────────────────────────────────────────

/** Full canvas size including name label area below the sprite. */
const CANVAS_WIDTH = 48;
const CANVAS_HEIGHT = 56;

/** Sprite drawing area within the canvas. */
const SPRITE_WIDTH = 24;
const SPRITE_HEIGHT = 32;

// ── Pose names ───────────────────────────────────────────────────────

const POSE_IDLE = "idle";
const POSE_WANDERING = "wandering";
const POSE_WALKING_TO = "walking-to";
const POSE_WORKING = "working";
const POSE_TALKING = "talking";
const POSE_WAITING = "waiting";
const POSE_LOOK_AROUND = "look-around";
const POSE_STRETCH = "stretch";

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
	private palette: SpritePalette;
	private currentPoseName: string = POSE_IDLE;
	private bobPhase = 0;
	private baseY: number;

	constructor(config: AgentActorConfig) {
		super({
			pos: ex.vec(config.x, config.y),
			width: CANVAS_WIDTH,
			height: CANVAS_HEIGHT,
			anchor: ex.vec(0.5, 0.5),
		});
		this.agentData = config.agent;
		this.onSelect = config.onSelect;
		this.baseY = config.y;
		this.palette = this.buildPalette();
		this.buildAllPoses();
		this.graphics.use(POSE_IDLE);
	}

	onInitialize(_engine: ex.Engine): void {
		this.on("pointerdown", () => {
			this.onSelect(this.agentData.name);
		});
	}

	onPreUpdate(_engine: ex.Engine, delta: number): void {
		// Idle bob: gentle +-1px sine oscillation
		if (this.brainState === "idle" || this.brainState === "waiting" || this.brainState === "on-break") {
			this.bobPhase += delta * 0.003;
			this.pos.y = this.baseY + Math.sin(this.bobPhase) * 1;
		} else {
			this.pos.y = this.baseY;
		}
	}

	updateFromBrain(state: BrainState, target: MovementTarget): void {
		this.brainState = state;

		// Determine flip direction
		const prevFlip = this.facingLeft;
		if (target.x !== undefined && (state === "walking-to" || state === "talking")) {
			this.facingLeft = target.x < this.pos.x;
		}

		// If flip direction changed, rebuild all poses
		if (prevFlip !== this.facingLeft) {
			this.buildAllPoses();
		}

		// Switch to the appropriate pose graphic
		const poseName = this.brainStateToPose(state);
		if (poseName !== this.currentPoseName) {
			this.currentPoseName = poseName;
			this.graphics.use(poseName);
		}
	}

	/** Switch to a specific idle sub-pose (used by brain system for idle cycling). */
	setIdlePose(poseName: string): void {
		if (this.brainState !== "idle" && this.brainState !== "on-break") return;
		const validPoses = [POSE_IDLE, POSE_LOOK_AROUND, POSE_STRETCH];
		if (!validPoses.includes(poseName)) return;
		this.currentPoseName = poseName;
		this.graphics.use(poseName);
	}

	updateVisualStatus(status: string): void {
		const prev = this.palette;
		this.palette = this.buildPalette(status);
		if (prev.body !== this.palette.body || prev.limb !== this.palette.limb) {
			this.buildAllPoses();
			this.graphics.use(this.currentPoseName);
		}
	}

	// ── Private helpers ──────────────────────────────────────────────

	private buildPalette(statusOverride?: string): SpritePalette {
		const status = statusOverride ?? this.agentData.status;
		const sp = statusPalette(status);
		return {
			body: sp.body,
			limb: sp.limb,
			hair: hashColor(this.agentData.name),
		};
	}

	private brainStateToPose(state: BrainState): string {
		switch (state) {
			case "idle": return POSE_IDLE;
			case "wandering": return POSE_WANDERING;
			case "walking-to": return POSE_WALKING_TO;
			case "working": return POSE_WORKING;
			case "talking": return POSE_TALKING;
			case "waiting": return POSE_WAITING;
			case "on-break": return POSE_IDLE;
			default: return POSE_IDLE;
		}
	}

	private buildAllPoses(): void {
		const pal = this.palette;
		const mood = this.agentData.mood ?? "neutral";
		const flip = this.facingLeft;
		const name = this.agentData.persona ?? this.agentData.name;
		const isAi = this.agentData.agentType === "ai";

		// Static poses
		this.graphics.add(POSE_IDLE, this.makePoseCanvas(
			(ctx) => drawIdlePose(ctx, pal, mood, flip),
			name, isAi, pal,
		));

		this.graphics.add(POSE_WORKING, this.makePoseCanvas(
			(ctx) => drawWorkingPose(ctx, pal, mood, flip),
			name, isAi, pal,
		));

		this.graphics.add(POSE_TALKING, this.makePoseCanvas(
			(ctx) => drawTalkingPose(ctx, pal, mood, flip),
			name, isAi, pal,
		));

		this.graphics.add(POSE_WAITING, this.makePoseCanvas(
			(ctx) => drawWaitingPose(ctx, pal, mood, flip),
			name, isAi, pal,
		));

		this.graphics.add(POSE_LOOK_AROUND, this.makePoseCanvas(
			(ctx) => drawLookAroundPose(ctx, pal, mood, flip),
			name, isAi, pal,
		));

		this.graphics.add(POSE_STRETCH, this.makePoseCanvas(
			(ctx) => drawStretchPose(ctx, pal, mood, flip),
			name, isAi, pal,
		));

		// Walk animations (2 frames)
		const walkFrame0 = this.makePoseCanvas(
			(ctx) => drawWalkFrame(ctx, pal, mood, flip, 0),
			name, isAi, pal,
		);
		const walkFrame1 = this.makePoseCanvas(
			(ctx) => drawWalkFrame(ctx, pal, mood, flip, 1),
			name, isAi, pal,
		);

		// Wandering: slower walk (300ms per frame)
		const wanderAnim = new ex.Animation({
			frames: [
				{ graphic: walkFrame0, duration: 300 },
				{ graphic: walkFrame1, duration: 300 },
			],
			strategy: ex.AnimationStrategy.Loop,
		});
		this.graphics.add(POSE_WANDERING, wanderAnim);

		// Walking-to: faster walk (200ms per frame)
		const walkToFrame0 = this.makePoseCanvas(
			(ctx) => drawWalkFrame(ctx, pal, mood, flip, 0),
			name, isAi, pal,
		);
		const walkToFrame1 = this.makePoseCanvas(
			(ctx) => drawWalkFrame(ctx, pal, mood, flip, 1),
			name, isAi, pal,
		);
		const walkToAnim = new ex.Animation({
			frames: [
				{ graphic: walkToFrame0, duration: 200 },
				{ graphic: walkToFrame1, duration: 200 },
			],
			strategy: ex.AnimationStrategy.Loop,
		});
		this.graphics.add(POSE_WALKING_TO, walkToAnim);
	}

	private makePoseCanvas(
		drawPose: (ctx: CanvasRenderingContext2D) => void,
		displayName: string,
		isAi: boolean,
		palette: SpritePalette,
	): ex.Canvas {
		return new ex.Canvas({
			width: CANVAS_WIDTH,
			height: CANVAS_HEIGHT,
			cache: true,
			draw: (ctx: CanvasRenderingContext2D) => {
				// Center the 24x32 sprite in the canvas
				const offsetX = (CANVAS_WIDTH - SPRITE_WIDTH) / 2;
				const offsetY = 0;
				ctx.save();
				ctx.translate(offsetX, offsetY);
				drawPose(ctx);
				ctx.restore();

				// AI/H badge at top-right of sprite area
				const badgeX = offsetX + SPRITE_WIDTH - 2;
				const badgeY = 2;
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

				// Name label below sprite
				const labelY = SPRITE_HEIGHT + 4;
				ctx.fillStyle = "#e2e8f0";
				ctx.font = "9px system-ui, sans-serif";
				ctx.textAlign = "center";
				ctx.textBaseline = "top";
				const truncName = displayName.length > 8 ? displayName.slice(0, 7) + "\u2026" : displayName;
				ctx.fillText(truncName, CANVAS_WIDTH / 2, labelY);

				// Status dot below name
				ctx.fillStyle = palette.body;
				ctx.beginPath();
				ctx.arc(CANVAS_WIDTH / 2, labelY + 14, 2, 0, Math.PI * 2);
				ctx.fill();
			},
		});
	}
}
