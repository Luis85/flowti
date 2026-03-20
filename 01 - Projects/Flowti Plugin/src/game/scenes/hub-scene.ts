/**
 * hub-scene.ts — RPG hub scene: central gathering place for all agents.
 *
 * Dark floor with subtle grid, agents centered, doorways along the right edge.
 * The bottom roster bar is a DOM overlay managed externally (roster-bar.ts).
 */

import * as ex from "excalibur";
import type { DashboardAgent, Setting } from "../data/types.js";
import { AgentActor } from "../actors/agent-actor.js";
import { DoorwayActor } from "../actors/doorway-actor.js";
import { SCENE_THEMES } from "../config/settings.js";
import { resolveSettingForDomain } from "../config/domain-map.js";
import { resolveCharacter } from "../sprites/character-pool.js";
import type { AgentSprites } from "../sprites/sprite-loader.js";

// ── Layout ──────────────────────────────────────────────────────────

const AGENT_SPACING = 80;
const AGENTS_PER_ROW = 6;

// ── Config ──────────────────────────────────────────────────────────

export interface HubSceneConfig {
	readonly onSceneChange: (targetScene: string) => void;
	readonly onAgentSelect: (agentName: string) => void;
}

// ── HubScene ────────────────────────────────────────────────────────

export class HubScene extends ex.Scene {
	private readonly config: HubSceneConfig;
	private readonly agentActors = new Map<string, AgentActor>();
	private iterationLabel: ex.Label | null = null;
	private connectionLabel: ex.Label | null = null;
	private spriteRegistry: Map<string, AgentSprites> = new Map();

	setSpriteRegistry(registry: Map<string, AgentSprites>): void {
		this.spriteRegistry = registry;
	}

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
			collisionType: ex.CollisionType.PreventCollision,
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
		title.body.collisionType = ex.CollisionType.PreventCollision;
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
		this.iterationLabel.body.collisionType = ex.CollisionType.PreventCollision;
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
		this.connectionLabel.body.collisionType = ex.CollisionType.PreventCollision;
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
	}

	/** Spawn or update agents from dashboard data. */
	updateAgents(agents: readonly DashboardAgent[]): void {
		const incoming = new Set<string>();

		// Only hub-resident agents get full actors in this scene
		const hubAgents = agents.filter((a) => resolveSettingForDomain(a.domain) === "hub");

		const w = this.engine?.drawWidth ?? 1200;
		const h = this.engine?.drawHeight ?? 700;

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
				const charName = resolveCharacter(agent.name, agent.domain ?? "");
				const sprites = this.spriteRegistry.get(charName);
				if (!sprites) continue;
				const actor = new AgentActor({
					agent,
					x,
					y,
					onSelect: this.config.onAgentSelect,
					sprites,
				});
				actor.z = 10;
				this.add(actor);
				this.agentActors.set(agent.name, actor);
			}
		}

		// Remove stale agent actors
		for (const [name, actor] of this.agentActors) {
			if (!incoming.has(name)) {
				actor.kill();
				this.agentActors.delete(name);
			}
		}
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

	/** Remove an agent actor by name (for room switching). */
	removeAgent(name: string): void {
		const actor = this.agentActors.get(name);
		if (!actor) return;
		actor.kill();
		this.agentActors.delete(name);
	}

	/** Spawn an agent actor near the hub doorways (right side, for room transfers). */
	spawnAgentAtDoorway(agent: DashboardAgent): void {
		if (this.agentActors.has(agent.name)) return;
		const w = this.engine?.drawWidth ?? 800;
		const h = this.engine?.drawHeight ?? 500;
		const x = w - 80 + Math.random() * 20;
		const y = h / 2 - 20 + Math.random() * 40;
		const charName = resolveCharacter(agent.name, agent.domain ?? "");
		const sprites = this.spriteRegistry.get(charName);
		if (!sprites) return;
		const actor = new AgentActor({
			agent, x, y,
			onSelect: this.config.onAgentSelect,
			sprites,
		});
		actor.z = 10;
		this.add(actor);
		this.agentActors.set(agent.name, actor);
	}

	/** Get the doorway position (right side of hub where room doors are). */
	getDoorwayPosition(): { x: number; y: number } {
		return { x: (this.engine?.drawWidth ?? 800) - 50, y: (this.engine?.drawHeight ?? 500) / 2 };
	}
}
