/**
 * agent-actor.ts — Agent as an ExcaliburJS Actor with label and status glow.
 *
 * Uses canvas-drawn graphics (circles with icons) instead of sprite images
 * for the MVP. Human agents get a person icon, AI agents get a gear icon.
 */

import * as ex from "excalibur";
import type { AgentStatus } from "./data-loader.js";

// ── Status colors ────────────────────────────────────────────────────

const STATUS_COLORS: Record<AgentStatus, ex.Color> = {
	busy: ex.Color.fromHex("#22c55e"),       // green
	idle: ex.Color.fromHex("#3b82f6"),        // blue
	unassigned: ex.Color.fromHex("#6b7280"),  // gray
};

const GLOW_COLORS: Record<AgentStatus, ex.Color> = {
	busy: ex.Color.fromHex("#22c55e80"),
	idle: ex.Color.fromHex("#3b82f680"),
	unassigned: ex.Color.fromHex("#6b728050"),
};

// ── Agent Actor ──────────────────────────────────────────────────────

const AGENT_RADIUS = 28;
const LABEL_OFFSET_Y = 46;

export interface AgentActorOptions {
	readonly name: string;
	readonly agentType: string;
	readonly status: AgentStatus;
	readonly project?: string;
	readonly iteration?: string;
	readonly pos: ex.Vector;
}

export class AgentActor extends ex.Actor {
	private readonly agentName: string;
	private readonly agentType: string;
	private readonly status: AgentStatus;
	private readonly statusColor: ex.Color;
	private readonly glowColor: ex.Color;
	private pulsePhase = Math.random() * Math.PI * 2;

	constructor(opts: AgentActorOptions) {
		super({
			pos: opts.pos,
			width: AGENT_RADIUS * 2,
			height: AGENT_RADIUS * 2,
			anchor: ex.vec(0.5, 0.5),
		});
		this.agentName = opts.name;
		this.agentType = opts.agentType;
		this.status = opts.status;
		this.statusColor = STATUS_COLORS[opts.status];
		this.glowColor = GLOW_COLORS[opts.status];
	}

	onInitialize(engine: ex.Engine): void {
		// Name label below the agent
		const label = new ex.Label({
			text: this.agentName,
			pos: ex.vec(0, LABEL_OFFSET_Y),
			font: new ex.Font({
				family: "system-ui, sans-serif",
				size: 13,
				unit: ex.FontUnit.Px,
				color: ex.Color.fromHex("#e2e8f0"),
				textAlign: ex.TextAlign.Center,
			}),
			anchor: ex.vec(0.5, 0),
		});
		this.addChild(label);

		// Type indicator label (small, above)
		const typeLabel = new ex.Label({
			text: this.agentType === "ai" ? "AI" : "H",
			pos: ex.vec(0, -AGENT_RADIUS - 12),
			font: new ex.Font({
				family: "system-ui, sans-serif",
				size: 10,
				unit: ex.FontUnit.Px,
				color: ex.Color.fromHex("#94a3b8"),
				textAlign: ex.TextAlign.Center,
			}),
			anchor: ex.vec(0.5, 0.5),
		});
		this.addChild(typeLabel);

		void engine; // satisfy lint
	}

	onPreDraw(gfx: ex.ExcaliburGraphicsContext, _delta: number): void {
		// Glow ring for busy agents (pulsing)
		if (this.status === "busy") {
			this.pulsePhase += 0.03;
			const pulseScale = 1.0 + 0.15 * Math.sin(this.pulsePhase);
			const glowRadius = AGENT_RADIUS * pulseScale + 8;
			gfx.drawCircle(ex.vec(0, 0), glowRadius, this.glowColor);
		}

		// Main circle
		gfx.drawCircle(ex.vec(0, 0), AGENT_RADIUS, this.statusColor);

		// Inner circle (darker)
		const inner = this.statusColor.clone();
		inner.a = 0.3;
		gfx.drawCircle(ex.vec(0, 0), AGENT_RADIUS - 6, inner);

		// Icon in center — simple text character
		const icon = this.agentType === "ai" ? "⚙" : "👤";
		const font = new ex.Font({
			family: "system-ui, sans-serif",
			size: 22,
			unit: ex.FontUnit.Px,
			color: ex.Color.White,
			textAlign: ex.TextAlign.Center,
		});
		const text = new ex.Text({ text: icon, font });
		text.draw(gfx, -11, -13);
	}
}
