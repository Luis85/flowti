/**
 * pet-scene-entity.ts — SceneEntity wrapper for pet actors.
 *
 * Holds stable pet identity and creates disposable visual actors per scene
 * (kill-and-recreate pattern). PetActor stays as the behavior/state holder
 * but is never added to an ExcaliburJS scene directly — only the lightweight
 * visual proxy is added.
 *
 * This solves the ExcaliburJS limitation where scene.remove() is deferred
 * and never processes on non-active scenes, causing ghost actors.
 */

import * as ex from "excalibur";
import type { SceneEntity } from "../data/scene-entity.js";
import type { PetActor } from "./pet-actor.js";

export class PetSceneEntity implements SceneEntity {
	readonly entityId: string;
	readonly entityType = "creature" as const;
	private actor: ex.Actor | null = null;

	constructor(readonly pet: PetActor) {
		this.entityId = pet.entityId;
	}

	createActor(x: number, y: number): ex.Actor {
		this.actor = new ex.Actor({
			pos: ex.vec(x, y),
			width: 16,
			height: 16,
			anchor: ex.vec(0.5, 0.5),
			scale: ex.vec(this.pet.scale.x, this.pet.scale.y),
			collisionType: ex.CollisionType.PreventCollision,
			z: 5,
		});
		// Share the pet's Canvas graphic — its draw callback reads state
		// from PetActor via closure, so sleep Z's etc. render correctly.
		const graphic = this.pet.graphics.current;
		if (graphic) this.actor.graphics.use(graphic);
		return this.actor;
	}

	getActor(): ex.Actor | null {
		return this.actor;
	}

	moveTo(x: number, y: number): void {
		this.pet.moveTo(x, y);
	}

	getPosition(): { x: number; y: number } {
		return { x: this.pet.pos.x, y: this.pet.pos.y };
	}

	/** Sync visual actor position from PetActor state. Call after updateBehavior(). */
	syncVisual(): void {
		if (this.actor) {
			this.actor.pos.x = this.pet.pos.x;
			this.actor.pos.y = this.pet.pos.y;
		}
	}

	onExitScene(): void {
		this.actor = null;
		this.pet.onExitScene();
	}

	onEnterScene(x: number, y: number): void {
		this.pet.onEnterScene(x, y);
		// Sync visual actor to the pet's clamped position (may differ from raw spawn coords)
		if (this.actor) {
			this.actor.pos.x = this.pet.pos.x;
			this.actor.pos.y = this.pet.pos.y;
		}
	}
}
