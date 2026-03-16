/**
 * hub-scene.ts — RPG hub scene: central gathering place for all agents.
 *
 * Dark floor with subtle grid, agents centered, doorways along the right edge.
 */

import * as ex from "excalibur";
import type { DashboardAgent, ActivityEntry, Setting } from "../data/types.js";
import { AgentActor } from "../actors/agent-actor.js";
import { DoorwayActor } from "../actors/doorway-actor.js";
import { SCENE_THEMES } from "../config/settings.js";

// ── Layout ──────────────────────────────────────────────────────────

const AGENT_SPACING = 90;
const AGENTS_PER_ROW = 6;
const TICKER_HEIGHT = 28;

// ── Config ──────────────────────────────────────────────────────────

export interface HubSceneConfig {
	readonly onSceneChange: (targetScene: string) => void;
	readonly onAgentSelect: (agentName: string) => void;
}

// ── HubScene ────────────────────────────────────────────────────────

export class HubScene extends ex.Scene {
	private readonly config: HubSceneConfig;
	private readonly agentActors = new Map<string, AgentActor>();
	private tickerLabel: ex.Label | null = null;
	private iterationLabel: ex.Label | null = null;

	constructor(config: HubSceneConfig) {
		super();
		this.config = config;
	}

	onInitialize(engine: ex.Engine): void {
		const w = engine.drawWidth;
		const h = engine.drawHeight;

		// ── Floor background with subtle grid ────────────────
		const floor = new ex.Actor({
			pos: ex.vec(w / 2, h / 2),
			width: w,
			height: h,
			anchor: ex.vec(0.5, 0.5),
			z: -10,
		});
		const floorCanvas = new ex.Canvas({
			width: w,
			height: h,
			cache: true,
			draw: (ctx: CanvasRenderingContext2D) => {
				// Base floor
				ctx.fillStyle = "#0d1117";
				ctx.fillRect(0, 0, w, h);

				// Subtle grid
				ctx.strokeStyle = "#1b2332";
				ctx.lineWidth = 0.5;
				for (let x = 0; x < w; x += 40) {
					ctx.beginPath();
					ctx.moveTo(x, 0);
					ctx.lineTo(x, h);
					ctx.stroke();
				}
				for (let y = 0; y < h; y += 40) {
					ctx.beginPath();
					ctx.moveTo(0, y);
					ctx.lineTo(w, y);
					ctx.stroke();
				}

				// Center glow
				const gradient = ctx.createRadialGradient(w / 2, h / 2, 50, w / 2, h / 2, 350);
				gradient.addColorStop(0, "rgba(30, 41, 59, 0.15)");
				gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
				ctx.fillStyle = gradient;
				ctx.fillRect(0, 0, w, h);

				// Top border accent
				ctx.fillStyle = "#1e293b";
				ctx.fillRect(0, 0, w, 2);
				// Bottom border accent
				ctx.fillRect(0, h - 2, w, 2);
			},
		});
		floor.graphics.use(floorCanvas);
		this.add(floor);

		// ── Title ────────────────────────────────────────────
		const title = new ex.Label({
			text: "Agent Hub",
			pos: ex.vec(w / 2, 32),
			font: new ex.Font({
				family: "system-ui, sans-serif",
				size: 20,
				unit: ex.FontUnit.Px,
				color: ex.Color.fromHex("#94a3b8"),
				textAlign: ex.TextAlign.Center,
				bold: true,
			}),
			anchor: ex.vec(0.5, 0.5),
			z: 5,
		});
		this.add(title);

		// ── Iteration badge ─────────────────────────────────
		this.iterationLabel = new ex.Label({
			text: "",
			pos: ex.vec(w / 2, 52),
			font: new ex.Font({
				family: "system-ui, sans-serif",
				size: 11,
				unit: ex.FontUnit.Px,
				color: ex.Color.fromHex("#64748b"),
				textAlign: ex.TextAlign.Center,
			}),
			anchor: ex.vec(0.5, 0.5),
			z: 5,
		});
		this.add(this.iterationLabel);

		// ── Doorways along right edge ────────────────────────
		const doorSettings: Setting[] = ["office", "village", "station"];
		const doorSpacing = 120;
		const doorStartY = h / 2 - doorSpacing;
		for (let i = 0; i < doorSettings.length; i++) {
			const setting = doorSettings[i];
			const doorway = new DoorwayActor({
				x: w - 50,
				y: doorStartY + i * doorSpacing,
				targetScene: setting,
				label: SCENE_THEMES[setting].label,
				onClick: this.config.onSceneChange,
			});
			doorway.z = 5;
			this.add(doorway);
		}

		// ── Activity ticker at bottom ────────────────────────
		this.tickerLabel = new ex.Label({
			text: "No recent activity",
			pos: ex.vec(12, h - TICKER_HEIGHT / 2),
			font: new ex.Font({
				family: "system-ui, sans-serif",
				size: 10,
				unit: ex.FontUnit.Px,
				color: ex.Color.fromHex("#475569"),
				textAlign: ex.TextAlign.Left,
			}),
			anchor: ex.vec(0, 0.5),
			z: 5,
		});
		this.add(this.tickerLabel);
	}

	/** Spawn or update agents from dashboard data. */
	updateAgents(agents: readonly DashboardAgent[]): void {
		const incoming = new Set<string>();

		const w = this.engine?.drawWidth ?? 1200;
		const h = this.engine?.drawHeight ?? 700;
		const cols = Math.min(agents.length, AGENTS_PER_ROW);
		const rows = Math.ceil(agents.length / AGENTS_PER_ROW);
		const gridW = cols * AGENT_SPACING;
		const gridH = rows * AGENT_SPACING;
		// Center in the area left of doorways
		const areaW = w - 120;
		const startX = (areaW - gridW) / 2 + AGENT_SPACING / 2;
		const startY = (h - gridH) / 2 + 20;

		for (let i = 0; i < agents.length; i++) {
			const agent = agents[i];
			incoming.add(agent.name);

			const col = i % AGENTS_PER_ROW;
			const row = Math.floor(i / AGENTS_PER_ROW);
			const x = startX + col * AGENT_SPACING;
			const y = startY + row * AGENT_SPACING;

			if (this.agentActors.has(agent.name)) {
				const actor = this.agentActors.get(agent.name)!;
				actor.agentData = agent;
				actor.updateVisualStatus(agent.status);
			} else {
				const actor = new AgentActor({
					agent,
					x,
					y,
					onSelect: this.config.onAgentSelect,
				});
				actor.z = 10;
				this.add(actor);
				this.agentActors.set(agent.name, actor);
			}
		}

		for (const [name, actor] of this.agentActors) {
			if (!incoming.has(name)) {
				actor.kill();
				this.agentActors.delete(name);
			}
		}
	}

	/** Update the bottom activity ticker. */
	updateTicker(activityLog: readonly ActivityEntry[]): void {
		if (!this.tickerLabel) return;
		if (activityLog.length === 0) {
			this.tickerLabel.text = "No recent activity";
			return;
		}
		const recent = activityLog.slice(-3);
		const parts = recent.map((e) => {
			const clean = e.summary
				.replace(/^(thinking|speaking|asking|using-tool)\s*/i, "")
				.replace(/```[\s\S]*?```/g, "[code]")
				.replace(/\n/g, " ")
				.slice(0, 50);
			return `[${e.agentName}] ${clean}`;
		});
		this.tickerLabel.text = parts.join("  |  ");
	}

	updateIterationBadge(text: string): void {
		if (this.iterationLabel) {
			this.iterationLabel.text = text;
		}
	}

	getAgentActor(name: string): AgentActor | undefined {
		return this.agentActors.get(name);
	}
}
