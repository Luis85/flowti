/**
 * pet-actor.ts — Autonomous office pet with simple behavior brain.
 *
 * Pets wander, sleep, and occasionally follow agents. They have no LLM.
 * Nearby agents react with thought bubbles and get needs effects.
 */

import * as ex from "excalibur";
import type { PetDefinition } from "../data/pet-definitions.js";

type PetState = "idle" | "wandering" | "sleeping" | "following";

export class PetActor extends ex.Actor {
	readonly petType: string;
	private readonly def: PetDefinition;
	private state: PetState = "idle";
	private stateTimer = 0;
	private homePos: ex.Vector;
	private targetPos: ex.Vector | null = null;
	private followTarget: string | null = null;
	private sleepZTimer = 0;

	constructor(def: PetDefinition, x: number, y: number) {
		super({
			width: 16,
			height: 16,
			pos: ex.vec(x, y),
			anchor: ex.vec(0.5, 0.5),
			scale: ex.vec(def.scale * 2, def.scale * 2),
			collisionType: ex.CollisionType.PreventCollision,
			z: 5,
		});
		this.petType = def.type;
		this.def = def;
		this.homePos = ex.vec(x, y);

		// Fish tank gets a Canvas graphic (stationary)
		if (def.type === "fish") {
			const canvas = new ex.Canvas({
				width: 40,
				height: 30,
				draw: (ctx) => {
					// Tank
					ctx.fillStyle = "rgba(100, 180, 255, 0.3)";
					ctx.strokeStyle = "#64748b";
					ctx.lineWidth = 2;
					ctx.beginPath();
					ctx.roundRect(2, 2, 36, 26, 3);
					ctx.fill();
					ctx.stroke();
					// Fish
					ctx.fillStyle = "#f59e0b";
					ctx.beginPath();
					ctx.ellipse(15, 14, 4, 2.5, 0, 0, Math.PI * 2);
					ctx.fill();
					// Second fish
					ctx.fillStyle = "#ef4444";
					ctx.beginPath();
					ctx.ellipse(28, 18, 3, 2, 0.3, 0, Math.PI * 2);
					ctx.fill();
					// Bubbles
					ctx.fillStyle = "rgba(200, 230, 255, 0.5)";
					ctx.beginPath();
					ctx.arc(22, 8, 2, 0, Math.PI * 2);
					ctx.fill();
					ctx.beginPath();
					ctx.arc(25, 5, 1.5, 0, Math.PI * 2);
					ctx.fill();
				},
			});
			this.graphics.use(canvas);
		}
	}

	getState(): PetState {
		return this.state;
	}

	getFollowTarget(): string | null {
		return this.followTarget;
	}

	setFollowTarget(agentName: string | null): void {
		if (agentName) {
			this.state = "following";
			this.followTarget = agentName;
			this.stateTimer = 8000 + Math.random() * 7000; // follow for 8-15s
		} else {
			this.followTarget = null;
			this.state = "idle";
		}
	}

	/** Called by the engine each frame with deltaMs. */
	updateBehavior(deltaMs: number): void {
		if (this.def.speed === 0) return; // stationary (fish)

		this.stateTimer -= deltaMs;

		switch (this.state) {
			case "idle": {
				// Chance to sleep
				if (Math.random() < this.def.behaviors.sleepChance * (deltaMs / 1000)) {
					this.state = "sleeping";
					this.stateTimer = 5000 + Math.random() * 10000; // sleep 5-15s
					break;
				}
				// Chance to wander
				if (this.stateTimer <= 0) {
					this.state = "wandering";
					const angle = Math.random() * Math.PI * 2;
					const dist = Math.random() * this.def.behaviors.wanderRadius;
					this.targetPos = ex.vec(
						this.homePos.x + Math.cos(angle) * dist,
						this.homePos.y + Math.sin(angle) * dist,
					);
					this.stateTimer = 3000 + Math.random() * 4000;
				}
				break;
			}
			case "wandering": {
				if (this.targetPos) {
					const dx = this.targetPos.x - this.pos.x;
					const dy = this.targetPos.y - this.pos.y;
					const dist = Math.sqrt(dx * dx + dy * dy);
					if (dist < 5) {
						this.state = "idle";
						this.stateTimer = 2000 + Math.random() * 5000;
						this.targetPos = null;
					} else {
						const speed = 30 * this.def.speed * (deltaMs / 1000);
						this.pos.x += (dx / dist) * speed;
						this.pos.y += (dy / dist) * speed;
					}
				} else {
					this.state = "idle";
					this.stateTimer = 2000;
				}
				if (this.stateTimer <= 0) {
					this.state = "idle";
					this.stateTimer = 2000;
				}
				break;
			}
			case "sleeping": {
				// Gentle bob while sleeping
				this.sleepZTimer += deltaMs;
				// Stay sleeping until timer expires
				if (this.stateTimer <= 0) {
					this.state = "idle";
					this.stateTimer = 3000 + Math.random() * 5000;
				}
				break;
			}
			case "following": {
				// Following is handled externally (engine updates target position)
				if (this.stateTimer <= 0) {
					this.followTarget = null;
					this.state = "idle";
					this.stateTimer = 5000;
				}
				break;
			}
		}
	}

	/** Move toward a world position (used for follow behavior). */
	moveToward(x: number, y: number, deltaMs: number): void {
		const dx = x - this.pos.x;
		const dy = y - this.pos.y;
		const dist = Math.sqrt(dx * dx + dy * dy);
		if (dist < 20) return; // close enough, don't crowd
		const speed = 40 * this.def.speed * (deltaMs / 1000);
		this.pos.x += (dx / dist) * speed;
		this.pos.y += (dy / dist) * speed;
	}

	getInteractRadius(): number {
		return this.def.behaviors.interactRadius;
	}

	getNeedsEffects(): Partial<{ energy: number; social: number; focus: number; morale: number }> {
		return this.def.behaviors.needsEffect;
	}

	isSleeping(): boolean {
		return this.state === "sleeping";
	}
}
