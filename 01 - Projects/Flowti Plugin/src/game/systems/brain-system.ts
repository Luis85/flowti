/**
 * brain-system.ts — Drives agent movement and state transitions each frame.
 *
 * Maintains per-agent brain state, movement targets, attribute-derived params,
 * and personality-driven habits (idle targeting, break routine, social facing).
 * Called from scene onPreUpdate to advance wandering, walking, working, and idle cycles.
 */

import type { BrainState, BrainParams, MovementTarget, AgentHabits } from "../brain/brain-types.js";
import type { AgentAttributes, AgentActionType } from "../data/types.js";
import { computeParams, transition, computeHabits } from "../brain/agent-brain.js";
import { randomWanderPoint, resolveIdleTarget, preferredWorkstation, type Bounds, type Position, type Workstation } from "../brain/movement.js";
import type { AgentActor } from "../actors/agent-actor.js";

// ── Per-agent entry ──────────────────────────────────────────────────

export interface AgentBrainEntry {
	state: BrainState;
	params: BrainParams;
	habits: AgentHabits;
	attributes: AgentAttributes;
	domain: string;
	target: MovementTarget;
	targetPos: Position | null;
	stateTimer: number;
	position: { x: number; y: number };
	// Idle pose cycling
	idlePoseTimer: number;
	idlePoseIndex: number;
	// Break routine
	breakPhase: "none" | "moving" | "resting";
	breakTimer: number;
	breakRestTarget: number;
	// Social facing
	socialHoldTimer: number;
	// Task execution lock — prevents autonomous state transitions while externally driven
	taskLocked: boolean;
}

// ── Constants ────────────────────────────────────────────────────────

const BASE_SPEED = 40; // pixels per second
const ARRIVAL_THRESHOLD = 4; // pixels to consider "arrived"
const SPRITE_MARGIN = 16; // half-sprite width at scale 2, keeps sprites fully inside bounds

const IDLE_CYCLES: Record<AgentHabits["idleStyle"], readonly string[]> = {
	fidgety: ["idle", "look-around", "stretch", "idle"],
	calm: ["idle", "idle", "look-around", "idle"],
	restless: ["idle", "look-around", "idle", "look-around", "stretch"],
};

const IDLE_TIMERS: Record<AgentHabits["idleStyle"], { min: number; max: number }> = {
	fidgety: { min: 3000, max: 6000 },
	calm: { min: 8000, max: 15000 },
	restless: { min: 5000, max: 10000 },
};

const SOCIAL_PROXIMITY_THRESHOLD = 70;
const SOCIAL_HOLD_DURATION = 4000;
const MOVEMENT_SPEED_MAP: Record<AgentHabits["movementStyle"], number> = {
	deliberate: 0.7,
	brisk: 1.0,
	darting: 1.4,
};

// ── BrainSystem ──────────────────────────────────────────────────────

export interface BrainSystemConfig {
	readonly bounds: Bounds;
	readonly onWorkstationChange?: (agentName: string, action: "occupy" | "vacate" | "claim", position: { x: number; y: number }) => void;
	readonly onWorkstationResolve?: (agentName: string, preferredId: string | null) => { x: number; y: number } | null;
}

export class BrainSystem {
	private readonly entries = new Map<string, AgentBrainEntry>();
	private readonly bounds: Bounds;
	/** Bounds shrunk by SPRITE_MARGIN — all wander/break targets land inside the clamped area. */
	private readonly targetBounds: Bounds;
	private readonly config: BrainSystemConfig;

	constructor(config: BrainSystemConfig) {
		this.bounds = config.bounds;
		this.targetBounds = {
			minX: config.bounds.minX + SPRITE_MARGIN,
			maxX: config.bounds.maxX - SPRITE_MARGIN,
			minY: config.bounds.minY + SPRITE_MARGIN,
			maxY: config.bounds.maxY - SPRITE_MARGIN,
		};
		this.config = config;
	}

	/** Register an agent with its attributes, mood, and domain. */
	register(name: string, attributes: AgentAttributes, mood?: string, domain?: string): void {
		if (this.entries.has(name)) return;
		const resolvedMood = mood ?? "neutral";
		const resolvedDomain = domain ?? "general";
		const params = computeParams(attributes);
		// Random initial offset so agents don't all start wandering simultaneously
		const initialTimer = Math.random() * params.idleResistance * 0.8;
		this.entries.set(name, {
			state: "idle",
			params,
			habits: computeHabits(attributes, resolvedMood, resolvedDomain),
			attributes,
			domain: resolvedDomain,
			target: { kind: "none" },
			targetPos: null,
			stateTimer: initialTimer,
			position: { x: 0, y: 0 },
			idlePoseTimer: 0,
			idlePoseIndex: 0,
			breakPhase: "none",
			breakTimer: 0,
			breakRestTarget: 0,
			socialHoldTimer: 0,
			taskLocked: false,
		});
	}

	/** Remove an agent from the brain system. */
	unregister(name: string): void {
		this.entries.delete(name);
	}

	/** Immediately stop an agent — cancel movement, go idle, face forward. */
	freeze(name: string): void {
		const entry = this.entries.get(name);
		if (!entry) return;
		if (entry.state === "working") {
			this.config.onWorkstationChange?.(name, "vacate", entry.position);
		}
		entry.state = "idle";
		entry.target = { kind: "none" };
		entry.targetPos = null;
		entry.stateTimer = 0;
		entry.breakPhase = "none";
		entry.breakTimer = 0;
	}

	/** Lock an agent into task execution — walk to workstation and begin working. */
	assignWork(name: string): void {
		const entry = this.entries.get(name);
		if (!entry) return;
		entry.taskLocked = true;
		entry.state = "walking-to";
		entry.stateTimer = 0;
		const ws = this.config.onWorkstationResolve?.(name, entry.habits.preferredWorkstationId);
		entry.targetPos = ws ?? null;
		entry.target = { kind: "workstation", ...(ws ? { x: ws.x, y: ws.y } : {}) };
		if (ws) {
			this.config.onWorkstationChange?.(name, "claim", ws);
		}
	}

	/** Release an agent from task execution — unlock and return to idle. */
	releaseWork(name: string): void {
		const entry = this.entries.get(name);
		if (!entry) return;
		entry.taskLocked = false;
		if (entry.state === "working") {
			this.config.onWorkstationChange?.(name, "vacate", entry.position);
		}
		entry.state = "idle";
		entry.target = { kind: "none" };
		entry.targetPos = null;
		entry.stateTimer = 0;
	}

	/** Recompute habit multipliers when mood changes at runtime. */
	updateMood(name: string, mood: string): void {
		const entry = this.entries.get(name);
		if (!entry) return;
		entry.habits = computeHabits(entry.attributes, mood, entry.domain);
	}

	/** Get the current brain state for an agent. */
	getState(name: string): { state: BrainState; params: BrainParams; target: MovementTarget } | undefined {
		const entry = this.entries.get(name);
		if (!entry) return undefined;
		return { state: entry.state, params: entry.params, target: entry.target };
	}

	/** Apply an external brain event (from SSE or sync). */
	applyEvent(name: string, eventType: string): void {
		const entry = this.entries.get(name);
		if (!entry) return;
		const previousState = entry.state;
		const result = transition(entry.state, { type: eventType as AgentActionType });
		entry.state = result.state;
		entry.target = result.target;
		entry.targetPos = null;
		entry.stateTimer = 0;

		// Fire vacate callback when leaving working state
		if (previousState === "working" && result.state !== "working") {
			this.config.onWorkstationChange?.(name, "vacate", entry.position);
		}
	}

	/** Advance all agent brains by deltaMs. Updates actor positions and visuals. */
	update(deltaMs: number, getActor: (name: string) => AgentActor | undefined): void {
		for (const [name, entry] of this.entries) {
			entry.stateTimer += deltaMs;
			const actor = getActor(name);
			if (!actor) continue;

			const prevState = entry.state;

			switch (entry.state) {
				case "idle":
					this.updateIdlePoseCycle(entry, deltaMs, actor);
					this.updateIdle(entry, name);
					break;
				case "wandering":
					this.updateMoving(entry, actor, deltaMs, name);
					break;
				case "walking-to":
					this.updateMoving(entry, actor, deltaMs, name);
					break;
				case "working":
					this.updateWorking(entry, name);
					break;
				case "on-break":
					this.updateOnBreak(entry, actor, deltaMs, name);
					this.updateIdlePoseCycle(entry, deltaMs, actor);
					break;
				case "talking":
					break;
				case "waiting":
					break;
			}

			// Set walk direction once when transitioning into a walking state
			const isNowWalking = entry.state === "wandering" || entry.state === "walking-to" || (entry.state === "on-break" && entry.breakPhase === "moving");
			const wasWalking = prevState === "wandering" || prevState === "walking-to" || (prevState === "on-break");
			if (isNowWalking && !wasWalking && entry.targetPos) {
				actor.setWalkDirection(entry.targetPos.x, entry.targetPos.y);
			}

			actor.updateFromBrain(entry.state);
			entry.position = { x: actor.pos.x, y: actor.pos.y };
		}

		// Social facing pass (after all positions updated)
		this.updateSocialFacing(deltaMs, getActor);
	}

	/** Read-only access to brain entries for the store frame adapter. */
	getAllEntries(): ReadonlyMap<string, Readonly<AgentBrainEntry>> {
		return this.entries;
	}

	/** Get the last known position for an agent. */
	getPosition(name: string): { x: number; y: number } | undefined {
		const entry = this.entries.get(name);
		if (!entry) return undefined;
		return entry.position;
	}

	private updateIdle(entry: AgentBrainEntry, name: string): void {
		const adjustedIdleResistance = entry.params.idleResistance * entry.habits.idleResistanceMult;
		if (entry.stateTimer >= adjustedIdleResistance) {
			// Start wandering with personality-driven target
			entry.state = "wandering";
			entry.stateTimer = 0;
			const nearbyAgents = this.getNearbyAgentPositions(name);
			const dest = resolveIdleTarget(entry.habits, nearbyAgents, this.targetBounds, Math.random, entry.position);
			if (dest) {
				entry.targetPos = dest;
				entry.target = { kind: "wander", x: dest.x, y: dest.y };
			} else {
				entry.state = "idle";
			}
		}
	}

	private updateMoving(entry: AgentBrainEntry, actor: AgentActor, deltaMs: number, name: string): void {
		if (!entry.targetPos) {
			// No target, go idle
			entry.state = "idle";
			entry.stateTimer = 0;
			entry.target = { kind: "none" };
			return;
		}

		const dx = entry.targetPos.x - actor.pos.x;
		const dy = entry.targetPos.y - actor.pos.y;
		const dist = Math.sqrt(dx * dx + dy * dy);

		if (dist < ARRIVAL_THRESHOLD) {
			// Arrived at target
			if (entry.state === "wandering") {
				entry.state = "idle";
				entry.target = { kind: "none" };
				entry.stateTimer = 0;
			} else if (entry.state === "walking-to") {
				if (entry.target.kind === "workstation") {
					// Settling pause before working
					entry.state = "idle";
					entry.stateTimer = entry.params.idleResistance - entry.habits.settlingPause;
					this.config.onWorkstationChange?.(name, "occupy", { x: entry.position.x, y: entry.position.y });
				} else {
					entry.state = "idle";
					entry.stateTimer = 0;
				}
				entry.target = { kind: "none" };
			}
			entry.targetPos = null;
			return;
		}

		// Move toward target with habit-based speed
		const speedMult = MOVEMENT_SPEED_MAP[entry.habits.movementStyle] * entry.habits.speedMult;
		const speed = BASE_SPEED * speedMult * (deltaMs / 1000);
		const moveX = (dx / dist) * Math.min(speed, dist);
		const moveY = (dy / dist) * Math.min(speed, dist);
		actor.pos.x += moveX;
		actor.pos.y += moveY;
		this.clampToBounds(actor);
	}

	private updateWorking(entry: AgentBrainEntry, name: string): void {
		if (entry.taskLocked) return;
		const breakThresholdMs = entry.habits.breakThreshold * 1000;
		if (entry.stateTimer >= breakThresholdMs && breakThresholdMs < entry.params.focusDuration) {
			// Break time
			entry.state = "on-break";
			entry.breakPhase = "moving";
			entry.stateTimer = 0;
			entry.breakTimer = 0;
			this.config.onWorkstationChange?.(name, "vacate", entry.position);
			const dest = randomWanderPoint(this.targetBounds, Math.random);
			entry.targetPos = dest;
			entry.target = { kind: "wander", x: dest.x, y: dest.y };
			return;
		}
		if (entry.stateTimer >= entry.params.focusDuration) {
			// Done working, start wandering
			entry.state = "wandering";
			entry.stateTimer = 0;
			const dest = randomWanderPoint(this.targetBounds, Math.random);
			entry.targetPos = dest;
			entry.target = { kind: "wander", x: dest.x, y: dest.y };
		}
	}

	private updateOnBreak(entry: AgentBrainEntry, actor: AgentActor, deltaMs: number, name: string): void {
		if (entry.breakPhase === "moving") {
			// Walk to break point
			if (!entry.targetPos) {
				entry.breakPhase = "resting";
				entry.breakTimer = 0;
				entry.breakRestTarget = 5000 + Math.random() * 5000;
				return;
			}
			const dx = entry.targetPos.x - actor.pos.x;
			const dy = entry.targetPos.y - actor.pos.y;
			const dist = Math.sqrt(dx * dx + dy * dy);
			if (dist < ARRIVAL_THRESHOLD) {
				entry.breakPhase = "resting";
				entry.breakTimer = 0;
				entry.breakRestTarget = 5000 + Math.random() * 5000;
				entry.targetPos = null;
				return;
			}
			const speedMult = MOVEMENT_SPEED_MAP[entry.habits.movementStyle];
			const speed = BASE_SPEED * speedMult * (deltaMs / 1000);
			actor.pos.x += (dx / dist) * Math.min(speed, dist);
			actor.pos.y += (dy / dist) * Math.min(speed, dist);
			this.clampToBounds(actor);
		} else if (entry.breakPhase === "resting") {
			entry.breakTimer += deltaMs;
			if (entry.breakTimer >= entry.breakRestTarget) {
				// Return to preferred workstation
				entry.state = "walking-to";
				entry.breakPhase = "none";
				entry.stateTimer = 0;
				entry.target = { kind: "workstation" };
				const wsPos = this.config.onWorkstationResolve?.(name, entry.habits.preferredWorkstationId);
				entry.targetPos = wsPos ?? null;
			}
		}
	}

	private updateIdlePoseCycle(entry: AgentBrainEntry, deltaMs: number, actor: AgentActor): void {
		entry.idlePoseTimer += deltaMs;
		const timing = IDLE_TIMERS[entry.habits.idleStyle];
		const threshold = timing.min + Math.random() * (timing.max - timing.min);
		if (entry.idlePoseTimer >= threshold) {
			entry.idlePoseTimer = 0;
			const cycle = IDLE_CYCLES[entry.habits.idleStyle];
			entry.idlePoseIndex = (entry.idlePoseIndex + 1) % cycle.length;
			actor.setIdlePose(cycle[entry.idlePoseIndex]);
		}
	}

	private updateSocialFacing(deltaMs: number, getActor: (name: string) => AgentActor | undefined): void {
		const idleEntries: Array<[string, AgentBrainEntry]> = [];
		for (const [name, entry] of this.entries) {
			if (entry.state === "idle" && entry.socialHoldTimer <= 0) {
				idleEntries.push([name, entry]);
			}
		}

		for (let i = 0; i < idleEntries.length; i++) {
			for (let j = i + 1; j < idleEntries.length; j++) {
				const [nameA, entryA] = idleEntries[i];
				const [nameB, entryB] = idleEntries[j];
				const dx = entryA.position.x - entryB.position.x;
				const dy = entryA.position.y - entryB.position.y;
				const dist = Math.sqrt(dx * dx + dy * dy);
				if (dist < SOCIAL_PROXIMITY_THRESHOLD && dist > 0) {
					const actorA = getActor(nameA);
					const actorB = getActor(nameB);
					if (actorA && actorB) {
						// Social facing — no-op, direction handled by updateFromBrain
						entryA.socialHoldTimer = SOCIAL_HOLD_DURATION;
						entryB.socialHoldTimer = SOCIAL_HOLD_DURATION;
					}
				}
			}
		}

		// Decrement social hold timers
		for (const [, entry] of this.entries) {
			if (entry.socialHoldTimer > 0) {
				entry.socialHoldTimer -= deltaMs;
			}
		}
	}

	/** Clamp an actor's position within bounds (accounting for sprite size). */
	private clampToBounds(actor: AgentActor): void {
		actor.pos.x = Math.max(this.bounds.minX + SPRITE_MARGIN, Math.min(this.bounds.maxX - SPRITE_MARGIN, actor.pos.x));
		actor.pos.y = Math.max(this.bounds.minY + SPRITE_MARGIN, Math.min(this.bounds.maxY - SPRITE_MARGIN, actor.pos.y));
	}

	private getNearbyAgentPositions(excludeName: string): Position[] {
		const positions: Position[] = [];
		for (const [name, entry] of this.entries) {
			if (name === excludeName) continue;
			positions.push(entry.position);
		}
		return positions;
	}
}
