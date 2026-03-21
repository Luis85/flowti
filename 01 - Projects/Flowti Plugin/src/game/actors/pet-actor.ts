/**
 * pet-actor.ts — Autonomous office pet with simple behavior brain.
 *
 * Pets wander, sleep, and occasionally follow agents. They have no LLM.
 * Nearby agents react with thought bubbles and get needs effects.
 */

import * as ex from "excalibur";
import type { PetDefinition } from "../data/pet-definitions.js";
import type { SceneEntity } from "../data/scene-entity.js";

// ── Affection visual thresholds ────────────────────────────────────────
const AFFECTION_WARM_THRESHOLD = 75;   // warm tint above this
const AFFECTION_DIM_THRESHOLD = 25;    // gray tint below this

type PetState = "idle" | "wandering" | "sleeping" | "following" | "exiting";

// World bounds with margin so pets stay visible
const WORLD_MIN_X = 30;
const WORLD_MAX_X = 770;
const WORLD_MIN_Y = 60;
const WORLD_MAX_Y = 460;

export class PetActor extends ex.Actor implements SceneEntity {
	readonly entityId: string;
	readonly entityType = "creature" as const;
	readonly petType: string;
	private readonly def: PetDefinition;
	private state: PetState = "idle";
	private stateTimer = 0;
	private homePos: ex.Vector;
	private targetPos: ex.Vector | null = null;
	private followTarget: string | null = null;
	private reachedExit = false;
	private hunger = 70;
	private thirst = 70;
	private affection = 50;
	private utilityScore = 0;
	private bondedAgent: string | null = null;
	private readonly proximityTracker: Map<string, number> = new Map();
	private bondLabelActor: ex.Actor | null = null;

	constructor(def: PetDefinition, x: number, y: number, entityId: string) {
		super({
			width: 16,
			height: 16,
			pos: ex.vec(x, y),
			anchor: ex.vec(0.5, 0.5),
			scale: ex.vec(def.scale * 2, def.scale * 2),
			collisionType: ex.CollisionType.PreventCollision,
			z: 5,
		});
		this.entityId = entityId;
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
		} else if (def.type === "cat") {
			const canvas = new ex.Canvas({
				width: 16,
				height: 16,
				draw: (ctx) => {
					// Body — rounded orange oval
					ctx.fillStyle = "#f59e0b";
					ctx.beginPath();
					ctx.ellipse(8, 10, 5, 4, 0, 0, Math.PI * 2);
					ctx.fill();
					// Head
					ctx.beginPath();
					ctx.arc(8, 5, 3.5, 0, Math.PI * 2);
					ctx.fill();
					// Ears — pointy triangles
					ctx.fillStyle = "#d97706";
					ctx.beginPath();
					ctx.moveTo(5, 3);
					ctx.lineTo(4, 0);
					ctx.lineTo(7, 2);
					ctx.fill();
					ctx.beginPath();
					ctx.moveTo(11, 3);
					ctx.lineTo(12, 0);
					ctx.lineTo(9, 2);
					ctx.fill();
					// Eyes
					ctx.fillStyle = "#1e293b";
					ctx.beginPath();
					ctx.arc(6.5, 5, 0.8, 0, Math.PI * 2);
					ctx.fill();
					ctx.beginPath();
					ctx.arc(9.5, 5, 0.8, 0, Math.PI * 2);
					ctx.fill();
					// Nose
					ctx.fillStyle = "#ec4899";
					ctx.beginPath();
					ctx.arc(8, 6.2, 0.5, 0, Math.PI * 2);
					ctx.fill();
					// Tail — curved line
					ctx.strokeStyle = "#f59e0b";
					ctx.lineWidth = 1.5;
					ctx.beginPath();
					ctx.moveTo(13, 10);
					ctx.quadraticCurveTo(16, 6, 14, 4);
					ctx.stroke();
				},
			});
			this.graphics.use(canvas);
		} else if (def.type === "dog") {
			const canvas = new ex.Canvas({
				width: 16,
				height: 16,
				draw: (ctx) => {
					// Body
					ctx.fillStyle = "#d97706";
					ctx.beginPath();
					ctx.ellipse(8, 10, 5, 4, 0, 0, Math.PI * 2);
					ctx.fill();
					// Belly patch
					ctx.fillStyle = "#fbbf24";
					ctx.beginPath();
					ctx.ellipse(8, 11, 3, 2.5, 0, 0, Math.PI * 2);
					ctx.fill();
					// Head
					ctx.fillStyle = "#d97706";
					ctx.beginPath();
					ctx.arc(8, 5, 3.5, 0, Math.PI * 2);
					ctx.fill();
					// Floppy ears
					ctx.fillStyle = "#b45309";
					ctx.beginPath();
					ctx.ellipse(4, 5, 2, 3, -0.3, 0, Math.PI * 2);
					ctx.fill();
					ctx.beginPath();
					ctx.ellipse(12, 5, 2, 3, 0.3, 0, Math.PI * 2);
					ctx.fill();
					// Eyes
					ctx.fillStyle = "#1e293b";
					ctx.beginPath();
					ctx.arc(6.5, 4.5, 0.8, 0, Math.PI * 2);
					ctx.fill();
					ctx.beginPath();
					ctx.arc(9.5, 4.5, 0.8, 0, Math.PI * 2);
					ctx.fill();
					// Nose
					ctx.fillStyle = "#1e293b";
					ctx.beginPath();
					ctx.ellipse(8, 6.2, 1, 0.6, 0, 0, Math.PI * 2);
					ctx.fill();
					// Tail — short wagging stub
					ctx.strokeStyle = "#d97706";
					ctx.lineWidth = 2;
					ctx.beginPath();
					ctx.moveTo(13, 9);
					ctx.quadraticCurveTo(15, 6, 14, 5);
					ctx.stroke();
				},
			});
			this.graphics.use(canvas);
		} else if (def.type === "bird") {
			const canvas = new ex.Canvas({
				width: 16,
				height: 16,
				draw: (ctx) => {
					// Body — round
					ctx.fillStyle = "#3b82f6";
					ctx.beginPath();
					ctx.arc(8, 9, 4.5, 0, Math.PI * 2);
					ctx.fill();
					// Wing
					ctx.fillStyle = "#2563eb";
					ctx.beginPath();
					ctx.ellipse(11, 9, 3, 2, 0.4, 0, Math.PI * 2);
					ctx.fill();
					// Belly
					ctx.fillStyle = "#93c5fd";
					ctx.beginPath();
					ctx.ellipse(7, 11, 2.5, 2, 0, 0, Math.PI * 2);
					ctx.fill();
					// Head
					ctx.fillStyle = "#3b82f6";
					ctx.beginPath();
					ctx.arc(7, 5, 3, 0, Math.PI * 2);
					ctx.fill();
					// Eye
					ctx.fillStyle = "#1e293b";
					ctx.beginPath();
					ctx.arc(6, 4.5, 0.8, 0, Math.PI * 2);
					ctx.fill();
					// Beak
					ctx.fillStyle = "#f59e0b";
					ctx.beginPath();
					ctx.moveTo(4, 5);
					ctx.lineTo(2, 5.5);
					ctx.lineTo(4, 6.2);
					ctx.fill();
					// Feet — two tiny lines
					ctx.strokeStyle = "#f59e0b";
					ctx.lineWidth = 1;
					ctx.beginPath();
					ctx.moveTo(6.5, 13);
					ctx.lineTo(6, 15);
					ctx.moveTo(9, 13);
					ctx.lineTo(9.5, 15);
					ctx.stroke();
				},
			});
			this.graphics.use(canvas);
		}
		this.buildBondLabelChild();
	}

	onPreUpdate(_engine: ex.Engine, _delta: number): void {
		// Affection-based color tint — warm glow when happy, gray when neglected
		if (this.affection >= AFFECTION_WARM_THRESHOLD) {
			// Warm pink tint — subtle, just a hint of warmth
			const t = (this.affection - AFFECTION_WARM_THRESHOLD) / (100 - AFFECTION_WARM_THRESHOLD);
			this.color = new ex.Color(255, Math.round(200 + 55 * (1 - t)), Math.round(200 + 55 * (1 - t)), 0.25 * t);
		} else if (this.affection <= AFFECTION_DIM_THRESHOLD) {
			// Desaturated/gray tint — low affection
			const t = 1 - this.affection / AFFECTION_DIM_THRESHOLD;
			this.color = new ex.Color(180, 180, 180, 0.3 * t);
		} else {
			this.color = ex.Color.Transparent;
		}

		// Bond label visibility — show "♥" near name when bonded
		if (this.bondLabelActor) {
			this.bondLabelActor.graphics.visible = this.bondedAgent !== null;
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

	getHunger(): number { return this.hunger; }
	getThirst(): number { return this.thirst; }
	setHunger(v: number): void { this.hunger = Math.max(0, Math.min(100, v)); }
	setThirst(v: number): void { this.thirst = Math.max(0, Math.min(100, v)); }

	getAffection(): number { return this.affection; }
	setAffection(v: number): void { this.affection = Math.max(0, Math.min(100, v)); }
	addAffection(amount: number): void { this.setAffection(this.affection + amount); }

	getUtilityScore(): number { return this.utilityScore; }
	incrementUtilityScore(): void { this.utilityScore++; }
	getBondedAgent(): string | null { return this.bondedAgent; }

	trackProximity(agentName: string, deltaMs: number): void {
		this.proximityTracker.set(agentName, (this.proximityTracker.get(agentName) ?? 0) + deltaMs / 1000);
		let maxTime = 60; let maxAgent: string | null = null;
		for (const [n, t] of this.proximityTracker) { if (t > maxTime) { maxTime = t; maxAgent = n; } }
		if (maxAgent && maxAgent !== this.bondedAgent) this.bondedAgent = maxAgent;
	}

	/** Called by the engine each frame with deltaMs. */
	updateBehavior(deltaMs: number): void {
		if (this.def.speed === 0) return; // stationary (fish)

		this.hunger = Math.max(0, this.hunger - 0.3 * (deltaMs / 1000));
		this.thirst = Math.max(0, this.thirst - 0.4 * (deltaMs / 1000));
		this.affection = Math.max(0, this.affection - 0.05 * (deltaMs / 1000));

		this.stateTimer -= deltaMs;

		switch (this.state) {
			case "idle":
				this.tickIdle(deltaMs);
				break;
			case "wandering":
				this.tickWandering(deltaMs);
				break;
			case "sleeping":
				this.tickSleeping(deltaMs);
				break;
			case "following":
				this.tickFollowing();
				break;
			case "exiting":
				this.tickExiting(deltaMs);
				break;
		}

		// Clamp position to world bounds (except when exiting — pet must reach the door)
		if (this.state !== "exiting") {
			this.pos.x = Math.max(WORLD_MIN_X, Math.min(WORLD_MAX_X, this.pos.x));
			this.pos.y = Math.max(WORLD_MIN_Y, Math.min(WORLD_MAX_Y, this.pos.y));
		}
	}

	private tickIdle(deltaMs: number): void {
		if (Math.random() < this.def.behaviors.sleepChance * (deltaMs / 1000)) {
			this.state = "sleeping"; this.stateTimer = 5000 + Math.random() * 10000;
			return;
		}
		if (this.stateTimer <= 0) {
			this.state = "wandering";
			const angle = Math.random() * Math.PI * 2;
			const dist = Math.random() * this.def.behaviors.wanderRadius;
			this.targetPos = ex.vec(
				Math.max(WORLD_MIN_X, Math.min(WORLD_MAX_X, this.homePos.x + Math.cos(angle) * dist)),
				Math.max(WORLD_MIN_Y, Math.min(WORLD_MAX_Y, this.homePos.y + Math.sin(angle) * dist)),
			);
			this.stateTimer = 3000 + Math.random() * 4000;
		}
	}

	private tickWandering(deltaMs: number): void {
		if (this.targetPos) {
			const dx = this.targetPos.x - this.pos.x;
			const dy = this.targetPos.y - this.pos.y;
			const dist = Math.sqrt(dx * dx + dy * dy);
			if (dist < 5) {
				this.state = "idle"; this.stateTimer = 2000 + Math.random() * 5000;
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
	}

	private tickSleeping(_deltaMs: number): void {
		if (this.stateTimer <= 0) {
			this.state = "idle";
			this.stateTimer = 3000 + Math.random() * 5000;
		}
	}

	private tickFollowing(): void {
		if (this.stateTimer <= 0) {
			this.followTarget = null;
			this.state = "idle";
			this.stateTimer = 5000;
		}
	}

	private tickExiting(deltaMs: number): void {
		if (!this.targetPos) return;
		const dx = this.targetPos.x - this.pos.x;
		const dy = this.targetPos.y - this.pos.y;
		const dist = Math.sqrt(dx * dx + dy * dy);
		if (dist < 10) {
			this.reachedExit = true;
		} else {
			const speed = 50 * this.def.speed * (deltaMs / 1000);
			this.pos.x += (dx / dist) * speed;
			this.pos.y += (dy / dist) * speed;
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
		// Clamp after follow movement too
		this.pos.x = Math.max(WORLD_MIN_X, Math.min(WORLD_MAX_X, this.pos.x));
		this.pos.y = Math.max(WORLD_MIN_Y, Math.min(WORLD_MAX_Y, this.pos.y));
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

	isExiting(): boolean {
		return this.state === "exiting";
	}

	/** Start walking toward a door position. Returns false if already exiting. */
	walkToExit(doorX: number, doorY: number): boolean {
		if (this.state === "exiting") return false;
		this.state = "exiting";
		this.targetPos = ex.vec(doorX, doorY);
		this.followTarget = null;
		return true;
	}

	/** Check if the pet has arrived at its exit target and consume the flag. */
	hasArrivedAtExit(): boolean {
		if (this.reachedExit) {
			this.reachedExit = false;
			this.state = "idle";
			this.targetPos = null;
			return true;
		}
		return false;
	}

	/** Reset home position after being placed in a new room. */
	resetHome(): void {
		this.homePos = ex.vec(
			Math.max(WORLD_MIN_X, Math.min(WORLD_MAX_X, this.pos.x)),
			Math.max(WORLD_MIN_Y, Math.min(WORLD_MAX_Y, this.pos.y)),
		);
		this.stateTimer = 2000 + Math.random() * 3000; // pause at new location before wandering
	}

	// ── SceneEntity implementation ──────────────────────

	createActor(x: number, y: number): ex.Actor {
		this.pos.x = x;
		this.pos.y = y;
		return this;
	}

	getActor(): ex.Actor | null {
		return this;
	}

	moveTo(x: number, y: number): void {
		if (this.def.speed === 0) return;
		this.state = "wandering";
		this.targetPos = ex.vec(x, y);
		this.stateTimer = 10000;
	}

	getPosition(): { x: number; y: number } {
		return { x: this.pos.x, y: this.pos.y };
	}

	onExitScene(): void {
		this.followTarget = null;
		this.state = "idle";
		this.targetPos = null;
		this.reachedExit = false;
	}

	onEnterScene(x: number, y: number): void {
		this.pos.x = x;
		this.pos.y = y;
		this.resetHome();
	}

	// ── Private ──────────────────────────────────────────────────────

	private buildBondLabelChild(): void {
		const SIZE = 14;
		const bondCanvas = new ex.Canvas({
			width: SIZE,
			height: SIZE,
			cache: true,
			draw: (ctx: CanvasRenderingContext2D) => {
				ctx.fillStyle = "rgba(244, 114, 182, 0.85)";
				ctx.font = "bold 10px system-ui, sans-serif";
				ctx.textAlign = "center";
				ctx.textBaseline = "middle";
				ctx.fillText("\u2665", SIZE / 2, SIZE / 2 + 0.5);
			},
		});

		this.bondLabelActor = new ex.Actor({
			pos: ex.vec(8, -10),
			anchor: ex.vec(0.5, 0.5),
			z: 20,
			collisionType: ex.CollisionType.PreventCollision,
		});
		this.bondLabelActor.scale = ex.vec(1 / (this.def.scale * 2), 1 / (this.def.scale * 2));
		this.bondLabelActor.graphics.use(bondCanvas);
		this.bondLabelActor.graphics.visible = false;
		this.addChild(this.bondLabelActor);
	}
}
