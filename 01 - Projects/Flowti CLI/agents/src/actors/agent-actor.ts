/**
 * agent-actor.ts — Humanoid agent actor with mood expression and brain-driven visuals.
 *
 * Replaces the circle-and-icon MVP with a stick-figure humanoid silhouette.
 * Head shows mood face, body colored by status, limbs animate based on brain state.
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

const HEAD_RADIUS = 8;
const BODY_WIDTH = 12;
const BODY_HEIGHT = 16;
const LEG_LENGTH = 12;
const ARM_LENGTH = 10;
const ACTOR_TOTAL_WIDTH = 32;
const ACTOR_TOTAL_HEIGHT = 56;

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
	private pulsePhase = Math.random() * Math.PI * 2;
	private workingDots = 0;
	private workingTimer = 0;

	constructor(config: AgentActorConfig) {
		super({
			pos: ex.vec(config.x, config.y),
			width: ACTOR_TOTAL_WIDTH,
			height: ACTOR_TOTAL_HEIGHT,
			anchor: ex.vec(0.5, 0.5),
		});
		this.agentData = config.agent;
		this.onSelect = config.onSelect;
		this.statusColor = STATUS_COLORS[config.agent.status] ?? STATUS_COLORS["unassigned"];
	}

	onInitialize(_engine: ex.Engine): void {
		this.on("pointerdown", () => {
			this.onSelect(this.agentData.name);
		});
	}

	/** Update visual state from the brain system. */
	updateFromBrain(state: BrainState, target: MovementTarget): void {
		this.brainState = state;
		// Face toward target if walking/talking
		if (target.x !== undefined && (state === "walking-to" || state === "talking")) {
			this.facingLeft = target.x < this.pos.x;
		}
	}

	/** Change the status color dynamically. */
	updateVisualStatus(status: string): void {
		this.statusColor = STATUS_COLORS[status] ?? STATUS_COLORS["unassigned"];
	}

	onPreDraw(gfx: ex.ExcaliburGraphicsContext, delta: number): void {
		const flip = this.facingLeft ? -1 : 1;

		// ── Waiting glow pulse ───────────────────────────────
		if (this.brainState === "waiting") {
			this.pulsePhase += 0.04;
			const alpha = 0.15 + 0.15 * Math.sin(this.pulsePhase);
			const glowColor = ex.Color.fromHex(this.statusColor);
			glowColor.a = alpha;
			gfx.drawCircle(ex.vec(0, -8), 24, glowColor);
		}

		// ── Head ─────────────────────────────────────────────
		const headY = -(BODY_HEIGHT / 2 + HEAD_RADIUS + 2);
		gfx.drawCircle(
			ex.vec(0, headY),
			HEAD_RADIUS,
			ex.Color.fromHex(this.statusColor),
		);

		// ── Mood face ────────────────────────────────────────
		this.drawFace(gfx, 0, headY, flip);

		// ── Body ─────────────────────────────────────────────
		const bodyTop = -(BODY_HEIGHT / 2);
		gfx.drawRectangle(
			ex.vec(0, bodyTop + BODY_HEIGHT / 2),
			BODY_WIDTH,
			BODY_HEIGHT,
			ex.Color.fromHex(this.statusColor),
		);

		// ── Arms ─────────────────────────────────────────────
		const shoulderY = bodyTop + 3;
		const armColor = ex.Color.fromHex(this.statusColor);

		if (this.brainState === "working") {
			// Arms forward (typing pose)
			gfx.drawLine(
				ex.vec(-BODY_WIDTH / 2, shoulderY),
				ex.vec(-BODY_WIDTH / 2 - ARM_LENGTH * 0.5 * flip, shoulderY + ARM_LENGTH * 0.7),
				armColor, 2,
			);
			gfx.drawLine(
				ex.vec(BODY_WIDTH / 2, shoulderY),
				ex.vec(BODY_WIDTH / 2 + ARM_LENGTH * 0.5 * flip, shoulderY + ARM_LENGTH * 0.7),
				armColor, 2,
			);
		} else {
			// Arms at sides
			gfx.drawLine(
				ex.vec(-BODY_WIDTH / 2, shoulderY),
				ex.vec(-BODY_WIDTH / 2 - ARM_LENGTH * 0.6, shoulderY + ARM_LENGTH),
				armColor, 2,
			);
			gfx.drawLine(
				ex.vec(BODY_WIDTH / 2, shoulderY),
				ex.vec(BODY_WIDTH / 2 + ARM_LENGTH * 0.6, shoulderY + ARM_LENGTH),
				armColor, 2,
			);
		}

		// ── Legs ─────────────────────────────────────────────
		const hipY = bodyTop + BODY_HEIGHT;
		const legColor = ex.Color.fromHex(this.statusColor);
		gfx.drawLine(
			ex.vec(-BODY_WIDTH / 4, hipY),
			ex.vec(-BODY_WIDTH / 4 - 3, hipY + LEG_LENGTH),
			legColor, 2,
		);
		gfx.drawLine(
			ex.vec(BODY_WIDTH / 4, hipY),
			ex.vec(BODY_WIDTH / 4 + 3, hipY + LEG_LENGTH),
			legColor, 2,
		);

		// ── Working dots (typing indicator) ──────────────────
		if (this.brainState === "working") {
			this.workingTimer += delta;
			if (this.workingTimer > 400) {
				this.workingTimer = 0;
				this.workingDots = (this.workingDots + 1) % 4;
			}
			const dotY = shoulderY + ARM_LENGTH * 0.7 + 4;
			const dotBaseX = BODY_WIDTH / 2 + ARM_LENGTH * 0.5 * flip + 2 * flip;
			for (let i = 0; i < this.workingDots; i++) {
				gfx.drawCircle(
					ex.vec(dotBaseX + i * 4 * flip, dotY),
					1.5,
					ex.Color.White,
				);
			}
		}

		// ── AI/H badge above head ────────────────────────────
		const badgeY = headY - HEAD_RADIUS - 10;
		const badgeText = this.agentData.agentType === "ai" ? "AI" : "H";
		const badgeFont = new ex.Font({
			family: "system-ui, sans-serif",
			size: 9,
			unit: ex.FontUnit.Px,
			color: ex.Color.fromHex("#94a3b8"),
			textAlign: ex.TextAlign.Center,
		});
		const badge = new ex.Text({ text: badgeText, font: badgeFont });
		badge.draw(gfx, -badge.width / 2, badgeY);

		// ── Name label below ─────────────────────────────────
		const displayName = this.agentData.persona ?? this.agentData.name;
		const nameFont = new ex.Font({
			family: "system-ui, sans-serif",
			size: 11,
			unit: ex.FontUnit.Px,
			color: ex.Color.fromHex("#e2e8f0"),
			textAlign: ex.TextAlign.Center,
		});
		const nameText = new ex.Text({ text: displayName, font: nameFont });
		const nameY = hipY + LEG_LENGTH + 6;
		nameText.draw(gfx, -nameText.width / 2, nameY);
	}

	private drawFace(gfx: ex.ExcaliburGraphicsContext, cx: number, cy: number, _flip: number): void {
		const mood = this.agentData.mood ?? "neutral";
		const eyeColor = ex.Color.White;

		// Eyes
		gfx.drawCircle(ex.vec(cx - 3, cy - 2), 1.5, eyeColor);
		gfx.drawCircle(ex.vec(cx + 3, cy - 2), 1.5, eyeColor);

		// Mouth varies by mood
		if (mood === "happy" || mood === "enthusiastic" || mood === "excited") {
			// Smile — two-segment arc
			gfx.drawLine(
				ex.vec(cx - 3, cy + 3),
				ex.vec(cx, cy + 4),
				eyeColor, 1,
			);
			gfx.drawLine(
				ex.vec(cx, cy + 4),
				ex.vec(cx + 3, cy + 3),
				eyeColor, 1,
			);
		} else if (mood === "frustrated" || mood === "angry" || mood === "stressed") {
			// Frown
			gfx.drawLine(
				ex.vec(cx - 3, cy + 4),
				ex.vec(cx, cy + 3),
				eyeColor, 1,
			);
			gfx.drawLine(
				ex.vec(cx, cy + 3),
				ex.vec(cx + 3, cy + 4),
				eyeColor, 1,
			);
		} else if (mood === "focused" || mood === "determined") {
			// Flat line mouth
			gfx.drawLine(
				ex.vec(cx - 2, cy + 3),
				ex.vec(cx + 2, cy + 3),
				eyeColor, 1,
			);
		} else {
			// Neutral — small dot
			gfx.drawCircle(ex.vec(cx, cy + 3), 1, eyeColor);
		}

		// Talking: pupil dots shift toward face direction
		if (this.brainState === "talking") {
			const pupilShift = this.facingLeft ? -1 : 1;
			gfx.drawCircle(ex.vec(cx - 3 + pupilShift, cy - 2), 0.8, ex.Color.fromHex("#0a0a0f"));
			gfx.drawCircle(ex.vec(cx + 3 + pupilShift, cy - 2), 0.8, ex.Color.fromHex("#0a0a0f"));
		}
	}
}
