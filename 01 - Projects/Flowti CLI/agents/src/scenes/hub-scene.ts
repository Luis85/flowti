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
import { resolveSettingForDomain } from "../config/domain-map.js";

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

// ── Indicator helpers ────────────────────────────────────────────────

const STATUS_DOT_COLORS: Record<string, string> = {
	busy: "#3b82f6",
	idle: "#22c55e",
	unassigned: "#6b7280",
};

export class HubScene extends ex.Scene {
	private readonly config: HubSceneConfig;
	private readonly agentActors = new Map<string, AgentActor>();
	private readonly indicatorActors = new Map<string, ex.Actor>();
	private tickerLabel: ex.Label | null = null;
	private iterationLabel: ex.Label | null = null;
	private connectionLabel: ex.Label | null = null;

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

		// ── Connection status indicator ─────────────────────
		this.connectionLabel = new ex.Label({
			text: "POLLING",
			pos: ex.vec(w - 12, 16),
			font: new ex.Font({
				family: "system-ui, sans-serif",
				size: 10,
				unit: ex.FontUnit.Px,
				color: ex.Color.fromHex("#f59e0b"),
				textAlign: ex.TextAlign.Right,
			}),
			anchor: ex.vec(1, 0.5),
			z: 20,
		});
		this.add(this.connectionLabel);

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

		// Split agents into hub-resident (no domain or hub domain) and domain-assigned
		const hubAgents: DashboardAgent[] = [];
		const domainAgents: DashboardAgent[] = [];
		for (const agent of agents) {
			const setting = resolveSettingForDomain(agent.domain);
			if (setting === "hub") {
				hubAgents.push(agent);
			} else {
				domainAgents.push(agent);
			}
		}

		const w = this.engine?.drawWidth ?? 1200;
		const h = this.engine?.drawHeight ?? 700;

		// ── Full agent actors for hub-resident agents ────────
		const cols = Math.min(hubAgents.length, AGENTS_PER_ROW);
		const rows = Math.ceil(hubAgents.length / AGENTS_PER_ROW) || 1;
		const gridW = cols * AGENT_SPACING;
		const gridH = rows * AGENT_SPACING;
		const areaW = w - 120;
		const startX = (areaW - gridW) / 2 + AGENT_SPACING / 2;
		const startY = (h - gridH) / 2 + 20;

		for (let i = 0; i < hubAgents.length; i++) {
			const agent = hubAgents[i];
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

		// ── Compact indicator dots for domain-assigned agents ─
		const indicatorStartX = 20;
		const indicatorStartY = h - 60;
		const indicatorSpacing = 32;

		for (let i = 0; i < domainAgents.length; i++) {
			const agent = domainAgents[i];
			incoming.add(agent.name);
			const setting = resolveSettingForDomain(agent.domain);

			const x = indicatorStartX + i * indicatorSpacing;
			const y = indicatorStartY;

			if (this.indicatorActors.has(agent.name)) {
				// Update existing indicator — no structural changes needed
				continue;
			}

			const dotColor = STATUS_DOT_COLORS[agent.status] ?? "#6b7280";
			const dotCanvas = new ex.Canvas({
				width: 24,
				height: 24,
				cache: true,
				draw: (ctx: CanvasRenderingContext2D) => {
					// Status-colored dot
					ctx.fillStyle = dotColor;
					ctx.beginPath();
					ctx.arc(12, 8, 5, 0, Math.PI * 2);
					ctx.fill();

					// Tiny name text
					ctx.fillStyle = "#94a3b8";
					ctx.font = "7px system-ui, sans-serif";
					ctx.textAlign = "center";
					ctx.textBaseline = "top";
					const shortName = agent.name.length > 5 ? agent.name.slice(0, 4) + "\u2026" : agent.name;
					ctx.fillText(shortName, 12, 16);
				},
			});

			const indicator = new ex.Actor({
				pos: ex.vec(x, y),
				width: 24,
				height: 24,
				anchor: ex.vec(0.5, 0.5),
				z: 15,
			});
			indicator.graphics.use(dotCanvas);

			// Click to navigate to the agent's room
			indicator.on("pointerdown", () => {
				this.config.onSceneChange(setting);
			});

			this.add(indicator);
			this.indicatorActors.set(agent.name, indicator);
		}

		// Remove stale agent actors
		for (const [name, actor] of this.agentActors) {
			if (!incoming.has(name)) {
				actor.kill();
				this.agentActors.delete(name);
			}
		}

		// Remove stale indicator actors
		for (const [name, actor] of this.indicatorActors) {
			if (!incoming.has(name)) {
				actor.kill();
				this.indicatorActors.delete(name);
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
				.replace(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z\s*/i, "")
				.replace(/^(thinking|speaking|asking|using-tool)\s*/i, "")
				.replace(/```[\s\S]*?```/g, "[code]")
				.replace(/\{[\s\S]*?\}/g, "")
				.replace(/\n/g, " ")
				.trim()
				.slice(0, 50);
			return `[${e.agentName}] ${clean}`;
		});
		this.tickerLabel.text = parts.join("  |  ");
	}

	/** Update the connection status indicator. */
	updateConnectionStatus(status: "connected" | "disconnected" | "reconnecting"): void {
		if (!this.connectionLabel) return;
		const labels: Record<string, string> = {
			connected: "LIVE",
			disconnected: "OFFLINE",
			reconnecting: "POLLING",
		};
		const colors: Record<string, string> = {
			connected: "#22c55e",
			disconnected: "#ef4444",
			reconnecting: "#f59e0b",
		};
		this.connectionLabel.text = labels[status] ?? "POLLING";
		this.connectionLabel.font = new ex.Font({
			family: "system-ui, sans-serif",
			size: 10,
			unit: ex.FontUnit.Px,
			color: ex.Color.fromHex(colors[status] ?? "#f59e0b"),
			textAlign: ex.TextAlign.Right,
		});
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
