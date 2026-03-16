/**
 * room-scene.ts — Shared room scene factory for office, village, and station.
 *
 * Each room has the same structure: themed background, workstation grid,
 * back-to-hub doorway, room title, and agent spawning. Only the SceneTheme
 * and setting name differ between rooms.
 */

import * as ex from "excalibur";
import type { DashboardAgent, Setting } from "../data/types.js";
import type { SceneTheme } from "../config/settings.js";
import { SCENE_THEMES, WORKSTATION_COLS, WORKSTATION_SPACING, WORKSTATION_START } from "../config/settings.js";
import { AgentActor } from "../actors/agent-actor.js";
import { WorkstationActor } from "../actors/workstation-actor.js";
import { DoorwayActor } from "../actors/doorway-actor.js";
import type { BrainSystem } from "../systems/brain-system.js";

// ── Config ───────────────────────────────────────────────────────────

const WORKSTATION_ROWS = 3;
const DOORWAY_MARGIN = 40;

export interface RoomSceneConfig {
	readonly onSceneChange: (targetScene: string) => void;
	readonly onAgentSelect: (agentName: string) => void;
	readonly workstationStyle?: "desk" | "workbench" | "console";
	readonly drawBackground?: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
}

// ── RoomScene ────────────────────────────────────────────────────────

export class RoomScene extends ex.Scene {
	public readonly setting: Setting;
	private readonly theme: SceneTheme;
	private readonly roomConfig: RoomSceneConfig;
	private readonly workstations: WorkstationActor[] = [];
	private readonly agentActors = new Map<string, AgentActor>();
	private brainSystem: BrainSystem | null = null;

	constructor(setting: Setting, config: RoomSceneConfig) {
		super();
		this.setting = setting;
		this.theme = SCENE_THEMES[setting];
		this.roomConfig = config;
	}

	/** Set the brain system for position sync on scene activate. */
	setBrainSystem(brain: BrainSystem): void {
		this.brainSystem = brain;
	}

	onActivate(): void {
		if (!this.brainSystem) return;
		for (const [name, actor] of this.agentActors) {
			const pos = this.brainSystem.getPosition(name);
			if (pos) {
				actor.pos.x = pos.x;
				actor.pos.y = pos.y;
			}
		}
	}

	onInitialize(engine: ex.Engine): void {
		// ── Themed background ───────────────────────────────
		const drawBg = this.roomConfig.drawBackground;
		if (drawBg) {
			const w = engine.drawWidth;
			const h = engine.drawHeight;
			const bgCanvas = new ex.Canvas({
				width: w,
				height: h,
				cache: true,
				draw: (ctx: CanvasRenderingContext2D) => {
					drawBg(ctx, w, h);
				},
			});
			const bgActor = new ex.Actor({
				pos: ex.vec(w / 2, h / 2),
				width: w,
				height: h,
				anchor: ex.vec(0.5, 0.5),
				z: -10,
			});
			bgActor.graphics.use(bgCanvas);
			this.add(bgActor);
		}

		// ── Room title ──────────────────────────────────────
		const title = new ex.Label({
			text: this.theme.label,
			pos: ex.vec(engine.drawWidth / 2, 36),
			font: new ex.Font({
				family: "system-ui, sans-serif",
				size: 20,
				unit: ex.FontUnit.Px,
				color: ex.Color.fromHex("#e2e8f0"),
				textAlign: ex.TextAlign.Center,
				bold: true,
			}),
			anchor: ex.vec(0.5, 0.5),
		});
		this.add(title);

		// ── Floor accent ────────────────────────────────────
		const floor = new ex.Actor({
			pos: ex.vec(engine.drawWidth / 2, engine.drawHeight - 20),
			width: engine.drawWidth,
			height: 40,
			anchor: ex.vec(0.5, 0.5),
			color: ex.Color.fromHex(this.theme.floorColor),
		});
		this.add(floor);

		// ── Workstation grid ────────────────────────────────
		for (let row = 0; row < WORKSTATION_ROWS; row++) {
			for (let col = 0; col < WORKSTATION_COLS; col++) {
				const x = WORKSTATION_START.x + col * WORKSTATION_SPACING.x;
				const y = WORKSTATION_START.y + row * WORKSTATION_SPACING.y;
				const ws = new WorkstationActor({
					x,
					y,
					workstationColor: this.theme.workstationColor,
					style: this.roomConfig.workstationStyle,
				});
				this.add(ws);
				this.workstations.push(ws);
			}
		}

		// ── Back doorway ────────────────────────────────────
		const backDoorway = new DoorwayActor({
			x: DOORWAY_MARGIN,
			y: engine.drawHeight / 2,
			targetScene: "hub",
			label: "Back",
			onClick: this.roomConfig.onSceneChange,
		});
		this.add(backDoorway);
	}

	/** Spawn an agent actor at the next available workstation. */
	spawnAgent(agent: DashboardAgent): void {
		if (this.agentActors.has(agent.name)) return;

		// Find an unoccupied workstation
		const ws = this.workstations.find((w) => !w.occupied);
		const x = ws ? ws.pos.x : WORKSTATION_START.x + this.agentActors.size * 60;
		const y = ws ? ws.pos.y - 40 : WORKSTATION_START.y - 40;

		if (ws) {
			ws.occupy(agent.name);
		}

		const actor = new AgentActor({
			agent,
			x,
			y,
			onSelect: this.roomConfig.onAgentSelect,
		});
		this.add(actor);
		this.agentActors.set(agent.name, actor);
	}

	/** Remove an agent actor by name. */
	removeAgent(name: string): void {
		const actor = this.agentActors.get(name);
		if (!actor) return;

		// Free the workstation
		const ws = this.workstations.find((w) => w.occupantName === name);
		if (ws) ws.vacate();

		actor.kill();
		this.agentActors.delete(name);
	}

	/** Get all workstation actors in this room. */
	getWorkstations(): readonly WorkstationActor[] {
		return this.workstations;
	}

	/** Get an agent actor by name. */
	getAgentActor(name: string): AgentActor | undefined {
		return this.agentActors.get(name);
	}

	/** Get all agent actors in this room. */
	getAgentActors(): ReadonlyMap<string, AgentActor> {
		return this.agentActors;
	}
}
