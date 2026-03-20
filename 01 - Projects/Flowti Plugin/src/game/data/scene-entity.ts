/**
 * scene-entity.ts — Shared contract for agents and creatures.
 *
 * Both AgentSceneEntity and PetActor implement this so the transfer
 * system and GameScene can handle them uniformly via enter/exit.
 */

import type * as ex from "excalibur";

export interface SceneEntity {
	readonly entityId: string;
	readonly entityType: "agent" | "creature";

	/** Create a fresh ExcaliburJS actor at the given position. */
	createActor(x: number, y: number): ex.Actor;

	/** Get the current actor instance (null if not in a scene). */
	getActor(): ex.Actor | null;

	/** Request movement toward a position. */
	moveTo(x: number, y: number): void;

	/** Get current world position. */
	getPosition(): { x: number; y: number };

	/** Called before the actor is removed from a scene. */
	onExitScene(): void;

	/** Called after the actor is placed in a new scene. */
	onEnterScene(x: number, y: number): void;
}
