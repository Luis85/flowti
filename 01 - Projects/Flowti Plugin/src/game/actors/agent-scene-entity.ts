/**
 * agent-scene-entity.ts — SceneEntity wrapper for agent actors.
 *
 * Holds stable agent identity, sprite registry ref, and brain system ref.
 * Creates fresh AgentActor instances on each scene enter (kill-and-recreate pattern).
 */

import type { SceneEntity } from "../data/scene-entity.js";
import type { DashboardAgent } from "../data/types.js";
import type { AgentSprites } from "../sprites/sprite-loader.js";
import type { BrainSystem } from "../systems/brain-system.js";
import { AgentActor } from "./agent-actor.js";
import type * as ex from "excalibur";

export class AgentSceneEntity implements SceneEntity {
	readonly entityId: string;
	readonly entityType = "agent" as const;
	private actor: AgentActor | null = null;

	constructor(
		readonly agent: DashboardAgent,
		private readonly sprites: AgentSprites,
		private readonly brainSystem: BrainSystem,
		private readonly onSelect: (name: string) => void,
	) {
		this.entityId = agent.name;
	}

	createActor(x: number, y: number): ex.Actor {
		this.actor = new AgentActor({
			agent: this.agent,
			x,
			y,
			onSelect: this.onSelect,
			sprites: this.sprites,
		});
		return this.actor;
	}

	getActor(): ex.Actor | null {
		return this.actor;
	}

	moveTo(x: number, y: number): void {
		this.brainSystem.walkTo(this.entityId, { x, y });
	}

	getPosition(): { x: number; y: number } {
		if (this.actor) return { x: this.actor.pos.x, y: this.actor.pos.y };
		return this.brainSystem.getPosition(this.entityId) ?? { x: 0, y: 0 };
	}

	onExitScene(): void {
		this.actor = null;
	}

	onEnterScene(x: number, y: number): void {
		if (this.actor) {
			this.actor.pos.x = x;
			this.actor.pos.y = y;
		}
		const brainPos = this.brainSystem.getPosition(this.entityId);
		if (brainPos) {
			brainPos.x = x;
			brainPos.y = y;
		}
	}
}
