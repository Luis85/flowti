/**
 * hub-scene.ts — Overview scene showing ALL agents with doorways to room scenes.
 *
 * Displays agents grouped loosely by domain at a small scale. Three doorways
 * at the edges lead to office, village, and station room scenes.
 */

import * as ex from "excalibur";
import type { DashboardAgent, ActivityEntry, Setting } from "../data/types.js";
import { AgentActor } from "../actors/agent-actor.js";
import { DoorwayActor } from "../actors/doorway-actor.js";
import { SCENE_THEMES } from "../config/settings.js";

// ── Layout constants ─────────────────────────────────────────────────

const AGENT_SPACING = 80;
const AGENTS_PER_ROW = 6;
const AGENT_START_X = 140;
const AGENT_START_Y = 120;
const DOORWAY_Y = 80;
const TICKER_HEIGHT = 24;

// ── Hub scene config ─────────────────────────────────────────────────

export interface HubSceneConfig {
	readonly onSceneChange: (targetScene: string) => void;
	readonly onAgentSelect: (agentName: string) => void;
}

// ── HubScene ─────────────────────────────────────────────────────────

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
		const theme = SCENE_THEMES["hub"];

		// ── Title ────────────────────────────────────────────
		const title = new ex.Label({
			text: "Flowti Agent Hub",
			pos: ex.vec(engine.drawWidth / 2, 36),
			font: new ex.Font({
				family: "system-ui, sans-serif",
				size: 22,
				unit: ex.FontUnit.Px,
				color: ex.Color.fromHex("#e2e8f0"),
				textAlign: ex.TextAlign.Center,
				bold: true,
			}),
			anchor: ex.vec(0.5, 0.5),
		});
		this.add(title);

		// ── Iteration badge ─────────────────────────────────
		this.iterationLabel = new ex.Label({
			text: "",
			pos: ex.vec(engine.drawWidth / 2, 58),
			font: new ex.Font({
				family: "system-ui, sans-serif",
				size: 12,
				unit: ex.FontUnit.Px,
				color: ex.Color.fromHex("#94a3b8"),
				textAlign: ex.TextAlign.Center,
			}),
			anchor: ex.vec(0.5, 0.5),
		});
		this.add(this.iterationLabel);

		// ── Doorways (one per room setting) ──────────────────
		const doorways: Array<{ setting: Setting; label: string; x: number }> = [
			{ setting: "office", label: "Office", x: engine.drawWidth - 60 },
			{ setting: "village", label: "Village", x: engine.drawWidth - 60 },
			{ setting: "station", label: "Station", x: engine.drawWidth - 60 },
		];

		// Position doorways along the right edge, spaced vertically
		const doorSpacingY = 100;
		const doorStartY = DOORWAY_Y + 60;
		for (let i = 0; i < doorways.length; i++) {
			const d = doorways[i];
			const doorway = new DoorwayActor({
				x: d.x,
				y: doorStartY + i * doorSpacingY,
				targetScene: d.setting,
				label: SCENE_THEMES[d.setting].label,
				onClick: this.config.onSceneChange,
			});
			this.add(doorway);
		}

		// ── Activity ticker ─────────────────────────────────
		this.tickerLabel = new ex.Label({
			text: "",
			pos: ex.vec(10, engine.drawHeight - TICKER_HEIGHT),
			font: new ex.Font({
				family: "system-ui, sans-serif",
				size: 11,
				unit: ex.FontUnit.Px,
				color: ex.Color.fromHex(theme.workstationColor).lighten(0.6),
				textAlign: ex.TextAlign.Left,
			}),
			anchor: ex.vec(0, 0.5),
		});
		this.add(this.tickerLabel);
	}

	/** Spawn or update agents from dashboard data. */
	updateAgents(agents: readonly DashboardAgent[]): void {
		const incoming = new Set<string>();

		for (let i = 0; i < agents.length; i++) {
			const agent = agents[i];
			incoming.add(agent.name);

			if (this.agentActors.has(agent.name)) {
				// Update existing actor
				const actor = this.agentActors.get(agent.name)!;
				actor.agentData = agent;
				actor.updateVisualStatus(agent.status);
			} else {
				// Spawn new actor
				const col = i % AGENTS_PER_ROW;
				const row = Math.floor(i / AGENTS_PER_ROW);
				const x = AGENT_START_X + col * AGENT_SPACING;
				const y = AGENT_START_Y + row * AGENT_SPACING;

				const actor = new AgentActor({
					agent,
					x,
					y,
					onSelect: this.config.onAgentSelect,
				});
				this.add(actor);
				this.agentActors.set(agent.name, actor);
			}
		}

		// Remove agents that are no longer present
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
		const parts = recent.map((e) => `[${e.agentName}] ${e.summary}`);
		this.tickerLabel.text = parts.join("  |  ");
	}

	/** Update the iteration badge text. */
	updateIterationBadge(text: string): void {
		if (this.iterationLabel) {
			this.iterationLabel.text = text;
		}
	}

	/** Get an agent actor by name. */
	getAgentActor(name: string): AgentActor | undefined {
		return this.agentActors.get(name);
	}
}
