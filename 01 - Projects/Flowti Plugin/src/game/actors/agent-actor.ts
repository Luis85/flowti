/**
 * agent-actor.ts — Agent actor with a static forward-facing sprite.
 *
 * Uses frame 0 of the idle spritesheet as a single static graphic.
 * All animation/direction logic is removed — focus is on movement & behavior first.
 */

import * as ex from "excalibur";
import type { DashboardAgent } from "../data/types.js";
import type { BrainState } from "../brain/brain-types.js";
import type { AgentSprites } from "../sprites/sprite-loader.js";

// ── Dimensions ───────────────────────────────────────────────────────

const SCALE = 2;

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
	private bobPhase = 0;
	private bulbActor: ex.Actor | null = null;
	private bulbPhase = 0;
	private llmActive = false;
	private toolActor: ex.Actor | null = null;
	private toolActive = false;
	private toolPhase = 0;

	constructor(config: AgentActorConfig) {
		super({
			pos: ex.vec(config.x, config.y),
			width: 16,
			height: 16,
			anchor: ex.vec(0.5, 0.5),
			collisionType: ex.CollisionType.PreventCollision,
		});
		this.agentData = config.agent;
		this.onSelect = config.onSelect;
		this.scale = ex.vec(SCALE, SCALE);

		// Use frame 0 of the idle spritesheet as a static forward-facing sprite
		const frame = config.sprites.idle.frames[0]?.graphic;
		if (frame) {
			this.graphics.use(frame);
		}

		this.buildLabelChild();
		this.buildBulbChild();
		this.buildToolChild();
	}

	onInitialize(engine: ex.Engine): void {
		this.on("pointerdown", () => {
			this.onSelect(this.agentData.name);
		});
		this.on("pointerenter", () => {
			engine.canvas.style.cursor = "pointer";
		});
		this.on("pointerleave", () => {
			engine.canvas.style.cursor = "default";
		});
	}

	onPreUpdate(_engine: ex.Engine, delta: number): void {
		// Gentle bob when idle — offset only the sprite graphic, not the actor
		// position, so child actors (label, badge) stay still.
		if (this.brainState === "idle" || this.brainState === "waiting" || this.brainState === "on-break") {
			this.bobPhase += delta * 0.0015;
			this.graphics.offset = ex.vec(0, Math.sin(this.bobPhase) * 0.5);
		} else {
			this.graphics.offset = ex.vec(0, 0);
		}

		// Lightbulb pulse when LLM is active
		if (this.bulbActor) {
			if (this.llmActive) {
				this.bulbPhase += delta * 0.004;
				const pulse = 0.6 + 0.4 * Math.sin(this.bulbPhase);
				this.bulbActor.graphics.opacity = pulse;
				this.bulbActor.pos = ex.vec(0, -12 + Math.sin(this.bulbPhase * 0.7) * 0.5);
			}
			this.bulbActor.graphics.visible = this.llmActive && !this.toolActive;
		}

		// Tool icon spin when using a tool
		if (this.toolActor) {
			if (this.toolActive) {
				this.toolPhase += delta * 0.003;
				this.toolActor.rotation = Math.sin(this.toolPhase) * 0.3;
			}
			this.toolActor.graphics.visible = this.toolActive;
		}
	}

	/** Snap to idle. Called when selected. */
	focus(): void {
		this.brainState = "idle";
	}

	/** No-op — direction logic removed for now. */
	setWalkDirection(_targetX: number, _targetY: number): void {
		// Will be re-added with proper animation system
	}

	/** Update brain state for idle bob logic. No animation switching. */
	updateFromBrain(state: BrainState): void {
		if (state !== this.brainState) {
			this.bobPhase = 0;
		}
		this.brainState = state;
	}

	/** Show lightbulb indicator — LLM is thinking. */
	showLlmIndicator(): void {
		this.llmActive = true;
		this.bulbPhase = 0;
	}

	/** Hide lightbulb indicator — LLM response arrived. */
	hideLlmIndicator(): void {
		this.llmActive = false;
	}

	/** Show tool icon — agent is using a tool. */
	showToolIndicator(): void {
		this.toolActive = true;
		this.toolPhase = 0;
	}

	/** Hide tool icon — tool call complete. */
	hideToolIndicator(): void {
		this.toolActive = false;
	}

	/** No-op stubs kept for API compatibility. */
	setIdlePose(_poseName: string): void { /* no-op */ }
	updateVisualStatus(_status: string): void { /* no-op */ }

	// ── Private ──────────────────────────────────────────────────────

	private buildLabelChild(): void {
		const name = this.agentData.persona ?? this.agentData.name;
		const status = this.agentData.status;

		const STATUS_COLORS: Record<string, string> = {
			busy: "#22c55e", idle: "#3b82f6", unassigned: "#6b7280",
		};

		const LABEL_W = 100;
		const LABEL_H = 28;

		const labelCanvas = new ex.Canvas({
			width: LABEL_W,
			height: LABEL_H,
			cache: true,
			draw: (ctx: CanvasRenderingContext2D) => {
				const cx = LABEL_W / 2;

				ctx.fillStyle = "#e2e8f0";
				ctx.font = "11px system-ui, sans-serif";
				ctx.textAlign = "center";
				ctx.textBaseline = "top";
				const truncName = name.length > 12 ? name.slice(0, 11) + "\u2026" : name;
				ctx.fillText(truncName, cx, 2);

				ctx.fillStyle = STATUS_COLORS[status] ?? "#6b7280";
				ctx.beginPath();
				ctx.arc(cx, 22, 3, 0, Math.PI * 2);
				ctx.fill();
			},
		});

		this.graphics.add("label", labelCanvas);

		const labelActor = new ex.Actor({
			pos: ex.vec(0, 12),
			anchor: ex.vec(0.5, 0),
			z: 1,
			collisionType: ex.CollisionType.PreventCollision,
		});
		labelActor.scale = ex.vec(1 / SCALE, 1 / SCALE);
		labelActor.graphics.use(labelCanvas);
		this.addChild(labelActor);
	}

	private buildBadgeChild(): void {
		const isAi = this.agentData.agentType === "ai";
		const badgeText = isAi ? "AI" : "H";
		const badgeColor = isAi ? "#8b5cf6" : "#10b981";
		const BADGE_SIZE = 18;

		const badgeCanvas = new ex.Canvas({
			width: BADGE_SIZE,
			height: BADGE_SIZE,
			cache: true,
			draw: (ctx: CanvasRenderingContext2D) => {
				const cx = BADGE_SIZE / 2;
				const cy = BADGE_SIZE / 2;
				ctx.fillStyle = badgeColor;
				ctx.beginPath();
				ctx.arc(cx, cy, 7, 0, Math.PI * 2);
				ctx.fill();
				ctx.fillStyle = "#ffffff";
				ctx.font = "bold 8px system-ui, sans-serif";
				ctx.textAlign = "center";
				ctx.textBaseline = "middle";
				ctx.fillText(badgeText, cx, cy + 1);
			},
		});

		const badgeActor = new ex.Actor({
			pos: ex.vec(7, -7),
			anchor: ex.vec(0.5, 0.5),
			z: 20,
			collisionType: ex.CollisionType.PreventCollision,
		});
		badgeActor.scale = ex.vec(1 / SCALE, 1 / SCALE);
		badgeActor.graphics.use(badgeCanvas);
		this.addChild(badgeActor);
	}

	private buildToolChild(): void {
		const TOOL_SIZE = 20;

		const toolCanvas = new ex.Canvas({
			width: TOOL_SIZE,
			height: TOOL_SIZE,
			cache: true,
			draw: (ctx: CanvasRenderingContext2D) => {
				const cx = TOOL_SIZE / 2;

				// Glow halo
				const gradient = ctx.createRadialGradient(cx, cx, 2, cx, cx, 9);
				gradient.addColorStop(0, "rgba(59, 130, 246, 0.4)");
				gradient.addColorStop(1, "rgba(59, 130, 246, 0)");
				ctx.fillStyle = gradient;
				ctx.beginPath();
				ctx.arc(cx, cx, 9, 0, Math.PI * 2);
				ctx.fill();

				// Gear body
				ctx.fillStyle = "#3b82f6";
				ctx.beginPath();
				ctx.arc(cx, cx, 5, 0, Math.PI * 2);
				ctx.fill();

				// Gear teeth (4 notches)
				ctx.strokeStyle = "#3b82f6";
				ctx.lineWidth = 2;
				for (let i = 0; i < 4; i++) {
					const angle = (i * Math.PI) / 2;
					ctx.beginPath();
					ctx.moveTo(cx + Math.cos(angle) * 4, cx + Math.sin(angle) * 4);
					ctx.lineTo(cx + Math.cos(angle) * 7, cx + Math.sin(angle) * 7);
					ctx.stroke();
				}

				// Center hole
				ctx.fillStyle = "#1e3a5f";
				ctx.beginPath();
				ctx.arc(cx, cx, 2, 0, Math.PI * 2);
				ctx.fill();
			},
		});

		this.toolActor = new ex.Actor({
			pos: ex.vec(-8, -12),
			anchor: ex.vec(0.5, 0.5),
			z: 31,
			collisionType: ex.CollisionType.PreventCollision,
		});
		this.toolActor.scale = ex.vec(1 / SCALE, 1 / SCALE);
		this.toolActor.graphics.use(toolCanvas);
		this.toolActor.graphics.visible = false;
		this.addChild(this.toolActor);
	}

	private buildBulbChild(): void {
		const BULB_SIZE = 20;

		const bulbCanvas = new ex.Canvas({
			width: BULB_SIZE,
			height: BULB_SIZE,
			cache: true,
			draw: (ctx: CanvasRenderingContext2D) => {
				const cx = BULB_SIZE / 2;

				// Glow halo
				const gradient = ctx.createRadialGradient(cx, cx - 2, 2, cx, cx - 2, 9);
				gradient.addColorStop(0, "rgba(250, 204, 21, 0.4)");
				gradient.addColorStop(1, "rgba(250, 204, 21, 0)");
				ctx.fillStyle = gradient;
				ctx.beginPath();
				ctx.arc(cx, cx - 2, 9, 0, Math.PI * 2);
				ctx.fill();

				// Bulb body
				ctx.fillStyle = "#facc15";
				ctx.beginPath();
				ctx.arc(cx, cx - 2, 5, 0, Math.PI * 2);
				ctx.fill();

				// Filament highlight
				ctx.fillStyle = "#fef9c3";
				ctx.beginPath();
				ctx.arc(cx - 1, cx - 4, 1.5, 0, Math.PI * 2);
				ctx.fill();

				// Base
				ctx.fillStyle = "#a16207";
				ctx.fillRect(cx - 2, cx + 3, 4, 3);
			},
		});

		this.bulbActor = new ex.Actor({
			pos: ex.vec(0, -12),
			anchor: ex.vec(0.5, 0.5),
			z: 30,
			collisionType: ex.CollisionType.PreventCollision,
		});
		this.bulbActor.scale = ex.vec(1 / SCALE, 1 / SCALE);
		this.bulbActor.graphics.use(bulbCanvas);
		this.bulbActor.graphics.visible = false;
		this.addChild(this.bulbActor);
	}
}
