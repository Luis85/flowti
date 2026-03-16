/**
 * agent-scene.ts — Main scene that renders agents grouped by project.
 *
 * Layout:
 *   - Project groups are arranged horizontally
 *   - Agents within a group are arranged in a grid
 *   - Unassigned agents go in a separate area on the right
 */

import * as ex from "excalibur";
import type { DashboardData, DashboardAgent, DashboardProject } from "./data-loader.js";
import { AgentActor } from "./actors/agent-actor.js";

// ── Layout constants ─────────────────────────────────────────────────

const GROUP_PADDING_X = 200;
const GROUP_START_X = 120;
const GROUP_START_Y = 120;
const AGENT_SPACING_X = 110;
const AGENT_SPACING_Y = 100;
const AGENTS_PER_ROW = 3;
const HEADER_HEIGHT = 50;

export class AgentScene extends ex.Scene {
	private data: DashboardData = { agents: [], projects: [] };

	setData(data: DashboardData): void {
		this.data = data;
	}

	onInitialize(engine: ex.Engine): void {
		this.drawBackground(engine);
		this.layoutAgents(engine);
	}

	private drawBackground(engine: ex.Engine): void {
		// Title
		const title = new ex.Label({
			text: "Flowti — Agent Dashboard",
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

		// Subtitle with agent count
		const busyCount = this.data.agents.filter((a) => a.status === "busy").length;
		const totalCount = this.data.agents.length;
		const subtitle = new ex.Label({
			text: `${totalCount} agents — ${busyCount} busy`,
			pos: ex.vec(engine.drawWidth / 2, 60),
			font: new ex.Font({
				family: "system-ui, sans-serif",
				size: 13,
				unit: ex.FontUnit.Px,
				color: ex.Color.fromHex("#94a3b8"),
				textAlign: ex.TextAlign.Center,
			}),
			anchor: ex.vec(0.5, 0.5),
		});
		this.add(subtitle);
	}

	private layoutAgents(_engine: ex.Engine): void {
		let groupX = GROUP_START_X;

		// Layout project groups
		for (const project of this.data.projects) {
			if (project.agents.length === 0) continue;
			const projectAgents = this.data.agents.filter(
				(a) => a.project === project.name,
			);
			if (projectAgents.length === 0) continue;

			groupX = this.layoutGroup(project.name, projectAgents, groupX);
		}

		// Layout unassigned agents
		const unassigned = this.data.agents.filter((a) => a.status === "unassigned");
		if (unassigned.length > 0) {
			this.layoutGroup("Unassigned", unassigned, groupX);
		}
	}

	private layoutGroup(groupName: string, agents: DashboardAgent[], startX: number): number {
		const cols = Math.min(agents.length, AGENTS_PER_ROW);
		const groupWidth = cols * AGENT_SPACING_X;

		// Group header
		const header = new ex.Label({
			text: groupName,
			pos: ex.vec(startX + groupWidth / 2, GROUP_START_Y),
			font: new ex.Font({
				family: "system-ui, sans-serif",
				size: 15,
				unit: ex.FontUnit.Px,
				color: ex.Color.fromHex("#cbd5e1"),
				textAlign: ex.TextAlign.Center,
				bold: true,
			}),
			anchor: ex.vec(0.5, 0.5),
		});
		this.add(header);

		// Place agents in grid
		for (let i = 0; i < agents.length; i++) {
			const col = i % AGENTS_PER_ROW;
			const row = Math.floor(i / AGENTS_PER_ROW);
			const x = startX + col * AGENT_SPACING_X + AGENT_SPACING_X / 2;
			const y = GROUP_START_Y + HEADER_HEIGHT + row * AGENT_SPACING_Y + AGENT_SPACING_Y / 2;

			const actor = new AgentActor({
				agent: agents[i],
				x,
				y,
				onSelect: (name) => { void name; }, // panel integration pending
			});
			this.add(actor);
		}

		return startX + groupWidth + GROUP_PADDING_X;
	}
}
