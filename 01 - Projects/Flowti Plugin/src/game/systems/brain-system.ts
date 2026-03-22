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
import { randomWanderPoint, resolveIdleTarget, computeSeparation, type Bounds, type Position } from "../brain/movement.js";
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
	readonly onStationResolve?: (agentName: string, need: "food" | "drink" | "rest") => { x: number; y: number } | null;
}

export class BrainSystem {
	private readonly entries = new Map<string, AgentBrainEntry>();
	private readonly bounds: Bounds;
	/** Bounds shrunk by SPRITE_MARGIN — all wander/break targets land inside the clamped area. */
	private readonly targetBounds: Bounds;
	private readonly config: BrainSystemConfig;
	private readonly quirkOverrides = new Map<string, Record<string, number>>();
	private readonly wanderHints = new Map<string, { x: number; y: number }>();
	private readonly breakThresholdBiases = new Map<string, number>();
	private readonly roomAvoidances = new Map<string, string>();

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
	unregister(name: string): void { this.entries.delete(name); }

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
		if (ws) this.config.onWorkstationChange?.(name, "claim", ws);
	}

	/** Release an agent from task execution — unlock and return to idle. */
	releaseWork(name: string): void {
		const entry = this.entries.get(name);
		if (!entry) return;
		entry.taskLocked = false;
		if (entry.state === "working") this.config.onWorkstationChange?.(name, "vacate", entry.position);
		entry.state = "idle";
		entry.target = { kind: "none" };
		entry.targetPos = null;
		entry.stateTimer = 0;
	}

	/** Walk an agent to a specific world-space coordinate. */
	walkTo(name: string, target: { x: number; y: number }): void {
		const entry = this.entries.get(name);
		if (!entry) return;
		entry.state = "walking-to";
		entry.target = { kind: "custom", x: target.x, y: target.y };
		entry.targetPos = { x: target.x, y: target.y };
	}

	/** Recompute habit multipliers when mood changes at runtime. */
	updateMood(name: string, mood: string): void {
		const entry = this.entries.get(name);
		if (!entry) return;
		entry.habits = computeHabits(entry.attributes, mood, entry.domain);
	}

	/** Apply quirk-derived multipliers to an agent's brain params. */
	applyQuirkOverrides(name: string, overrides: Record<string, number>): void {
		this.quirkOverrides.set(name, overrides);
		const entry = this.entries.get(name);
		if (!entry) return;
		const p = entry.params;
		entry.params = {
			speedMultiplier: p.speedMultiplier * (overrides.moveSpeedMultiplier ?? 1),
			socialRadius: p.socialRadius * (overrides.socialRadiusMultiplier ?? 1),
			idleResistance: p.idleResistance * (overrides.idleResistanceMultiplier ?? 1),
			focusDuration: p.focusDuration,
			quoteFrequency: p.quoteFrequency,
		};
	}

	/** Set a per-agent wander hint — when set, idle target resolution prefers this position. */
	setWanderHint(name: string, target: { x: number; y: number } | null): void {
		if (target) {
			this.wanderHints.set(name, target);
		} else {
			this.wanderHints.delete(name);
		}
	}

	/** Set the room an agent should avoid. When idling in the avoided room, the agent will wander away. */
	setRoomAvoidance(name: string, room: string | null): void {
		if (room) {
			this.roomAvoidances.set(name, room);
		} else {
			this.roomAvoidances.delete(name);
		}
	}

	/** Get the room the agent is currently avoiding, if any. */
	getRoomAvoidance(name: string): string | null {
		return this.roomAvoidances.get(name) ?? null;
	}

	/** Set a break threshold bias from echo mood-residue weight. Negative values lower the threshold. */
	setBreakThresholdBias(name: string, bias: number): void {
		if (bias === 0) {
			this.breakThresholdBiases.delete(name);
		} else {
			this.breakThresholdBiases.set(name, bias);
		}
	}

	/** Get the current brain state for an agent. */
	getState(name: string): { state: BrainState; params: BrainParams; target: MovementTarget } | undefined {
		const entry = this.entries.get(name);
		if (!entry) return undefined;
		return { state: entry.state, params: entry.params, target: entry.target };
	}

	/**
	 * Externally set an agent's brain state.
	 * While taskLocked, only the walking-to → working transition is permitted.
	 */
	setState(name: string, state: BrainState): void {
		const entry = this.entries.get(name);
		if (!entry) return;
		if (entry.taskLocked && !(entry.state === "walking-to" && state === "working")) return;
		if (entry.state === "working" && state !== "working") this.config.onWorkstationChange?.(name, "vacate", entry.position);
		entry.state = state;
		entry.stateTimer = 0;
	}

	/** Return true if the agent is currently task-locked (externally driven). */
	isTaskLocked(name: string): boolean { return this.entries.get(name)?.taskLocked ?? false; }

	/** Apply an external brain event (e.g. world sync or EventBus relay). */
	applyEvent(name: string, eventType: string): void {
		const entry = this.entries.get(name);
		if (!entry) return;
		const previousState = entry.state;
		const result = transition(entry.state, { type: eventType as AgentActionType });

		// Don't interrupt an agent already moving toward a valid target with
		// a redundant transition to the same movement state — preserves walk
		// progress and prevents stateTimer reset on repeated seek calls.
		const isMoving = previousState === "walking-to" || previousState === "wandering";
		if (isMoving && result.state === previousState && entry.targetPos) {
			return;
		}

		entry.state = result.state;
		entry.target = result.target;
		entry.stateTimer = 0;

		// Movement states need an actual target position; resolve one.
		if (result.state === "walking-to" || result.state === "wandering") {
			if (result.target.kind === "workstation") {
				const ws = this.config.onWorkstationResolve?.(name, entry.habits.preferredWorkstationId);
				entry.targetPos = ws ?? null;
			} else if (eventType === "seek-food" || eventType === "seek-drink") {
				const need = eventType === "seek-food" ? "food" : "drink" as const;
				entry.targetPos = this.config.onStationResolve?.(name, need) ?? null;
			} else if (eventType === "seek-rest") {
				// Rest spot — try couch station, fall back to random quiet spot
				entry.targetPos = this.config.onStationResolve?.(name, "rest") ?? resolveIdleTarget(entry.habits, [], this.targetBounds, Math.random, entry.position);
			} else if (eventType === "seek-agent") {
				// Walk toward nearest agent in the same room
				const nearby = this.getNearbyAgentPositions(name);
				if (nearby.length > 0) {
					const t = nearby[0];
					const offsetAngle = Math.random() * Math.PI * 2;
					entry.targetPos = {
						x: Math.max(this.targetBounds.minX, Math.min(this.targetBounds.maxX, t.x + Math.cos(offsetAngle) * 40)),
						y: Math.max(this.targetBounds.minY, Math.min(this.targetBounds.maxY, t.y + Math.sin(offsetAngle) * 40)),
					};
				} else {
					entry.targetPos = resolveIdleTarget(entry.habits, [], this.targetBounds, Math.random, entry.position);
				}
			} else {
				entry.targetPos = resolveIdleTarget(entry.habits, this.getNearbyAgentPositions(name), this.targetBounds, Math.random, entry.position);
			}
		} else {
			entry.targetPos = null;
		}

		if (previousState === "working" && result.state !== "working") {
			this.config.onWorkstationChange?.(name, "vacate", entry.position);
		}
	}

	/** Advance all agent brains by deltaMs. Updates actor positions and visuals.
	 * @param getRoom optional room getter — when provided, separation only applies to same-room agents.
	 * @param recordBrain when set, records per-agent body time and an equal share of separation/social facing (canvas perf). */
	update(
		deltaMs: number,
		getActor: (name: string) => AgentActor | undefined,
		getRoom?: (name: string) => string | undefined,
		recordBrain?: (name: string, bodyMs: number) => void,
	): void {
		for (const [name, entry] of this.entries) {
			entry.stateTimer += deltaMs;
			const actor = getActor(name);

			if (recordBrain) {
				const t0 = performance.now();
				if (actor) {
					const prevState = entry.state;
					this.tickAgentState(entry, actor, deltaMs, name);
					this.applyWalkDirection(entry, prevState, actor);
					actor.updateFromBrain(entry.state);
					entry.position = { x: actor.pos.x, y: actor.pos.y };
				}
				recordBrain(name, performance.now() - t0);
				continue;
			}

			if (!actor) continue;

			const prevState = entry.state;
			this.tickAgentState(entry, actor, deltaMs, name);
			this.applyWalkDirection(entry, prevState, actor);

			actor.updateFromBrain(entry.state);
			entry.position = { x: actor.pos.x, y: actor.pos.y };
		}

		if (recordBrain) {
			const t0 = performance.now();
			this.applySeparation(getActor, getRoom);
			this.updateSocialFacing(deltaMs, getActor, getRoom);
			const sharedMs = performance.now() - t0;
			const n = Math.max(1, this.entries.size);
			const per = sharedMs / n;
			for (const name of this.entries.keys()) {
				recordBrain(name, per);
			}
			return;
		}

		this.applySeparation(getActor, getRoom);
		this.updateSocialFacing(deltaMs, getActor, getRoom);
	}

	/** Tick a single agent's state machine. */
	private tickAgentState(entry: AgentBrainEntry, actor: AgentActor, deltaMs: number, name: string): void {
		switch (entry.state) {
			case "idle":
				this.updateIdlePoseCycle(entry, deltaMs, actor);
				this.updateIdle(entry, name);
				break;
			case "wandering":
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
			case "waiting":
				if (entry.stateTimer > 10_000) {
					entry.state = "idle";
					entry.stateTimer = 0;
					entry.target = { kind: "none" };
				}
				break;
		}
	}

	/** Set walk direction once when transitioning into a walking state. */
	private applyWalkDirection(entry: AgentBrainEntry, prevState: BrainState, actor: AgentActor): void {
		const isNowWalking = entry.state === "wandering" || entry.state === "walking-to" || (entry.state === "on-break" && entry.breakPhase === "moving");
		const wasWalking = prevState === "wandering" || prevState === "walking-to" || prevState === "on-break";
		if (isNowWalking && !wasWalking && entry.targetPos) {
			actor.setWalkDirection(entry.targetPos.x, entry.targetPos.y);
		}
	}

	/** Push agents apart when they overlap. Idle/wandering agents get nudged; working/talking agents are anchored. */
	private applySeparation(getActor: (name: string) => AgentActor | undefined, getRoom?: (name: string) => string | undefined): void {
		const movableStates = new Set<BrainState>(["idle", "wandering", "on-break"]);
		const names = [...this.entries.keys()];

		for (const name of names) {
			const entry = this.entries.get(name);
			if (!entry || !movableStates.has(entry.state)) continue;
			const actor = getActor(name);
			if (!actor) continue;

			const myRoom = getRoom?.(name);
			const others: Position[] = [];
			for (const otherName of names) {
				if (otherName === name) continue;
				// Only separate from agents in the same room
				if (getRoom && getRoom(otherName) !== myRoom) continue;
				const otherEntry = this.entries.get(otherName);
				if (otherEntry) others.push(otherEntry.position);
			}

			const nudged = computeSeparation(entry.position, others, this.targetBounds);
			if (nudged.x !== entry.position.x || nudged.y !== entry.position.y) {
				actor.pos.x = nudged.x;
				actor.pos.y = nudged.y;
				entry.position = { x: nudged.x, y: nudged.y };
			}
		}
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
		if (entry.stateTimer < entry.params.idleResistance * entry.habits.idleResistanceMult) return;
		entry.state = "wandering";
		entry.stateTimer = 0;

		// Wander hint: echo-driven spatial preference (e.g. bond target)
		const hint = this.wanderHints.get(name);
		if (hint) {
			const clampedX = Math.max(this.targetBounds.minX, Math.min(this.targetBounds.maxX, hint.x));
			const clampedY = Math.max(this.targetBounds.minY, Math.min(this.targetBounds.maxY, hint.y));
			entry.targetPos = { x: clampedX, y: clampedY };
			entry.target = { kind: "wander", x: clampedX, y: clampedY };
			return;
		}

		const dest = resolveIdleTarget(entry.habits, this.getNearbyAgentPositions(name), this.targetBounds, Math.random, entry.position);
		if (dest) { entry.targetPos = dest; entry.target = { kind: "wander", x: dest.x, y: dest.y }; }
		else { entry.state = "idle"; }
	}

	private updateMoving(entry: AgentBrainEntry, actor: AgentActor, deltaMs: number, name: string): void {
		if (!entry.targetPos) {
			entry.state = "idle";
			entry.stateTimer = 0;
			entry.target = { kind: "none" };
			return;
		}

		const dx = entry.targetPos.x - actor.pos.x;
		const dy = entry.targetPos.y - actor.pos.y;
		const dist = Math.sqrt(dx * dx + dy * dy);

		if (dist < ARRIVAL_THRESHOLD) {
			if (entry.state === "wandering") {
				entry.state = "idle"; entry.target = { kind: "none" }; entry.stateTimer = 0;
			} else if (entry.state === "walking-to") {
				if (entry.target.kind === "workstation") {
					entry.state = "idle";
					entry.stateTimer = entry.params.idleResistance - entry.habits.settlingPause;
					this.config.onWorkstationChange?.(name, "occupy", { x: entry.position.x, y: entry.position.y });
				} else {
					entry.state = "idle"; entry.stateTimer = 0;
				}
				entry.target = { kind: "none" };
			}
			entry.targetPos = null;
			return;
		}

		const speedMult = MOVEMENT_SPEED_MAP[entry.habits.movementStyle] * entry.habits.speedMult * actor.walkSpeedMultiplier;
		const speed = BASE_SPEED * speedMult * (deltaMs / 1000);
		const moveX = (dx / dist) * Math.min(speed, dist);
		const moveY = (dy / dist) * Math.min(speed, dist);
		actor.pos.x += moveX;
		actor.pos.y += moveY;
		this.clampToBounds(actor);
	}

	private updateWorking(entry: AgentBrainEntry, name: string): void {
		if (entry.taskLocked) return;
		const bias = this.breakThresholdBiases.get(name) ?? 0;
		const biasedThreshold = Math.max(1, entry.habits.breakThreshold + bias);
		const breakThresholdMs = biasedThreshold * 1000;
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
			const speedMult = MOVEMENT_SPEED_MAP[entry.habits.movementStyle] * actor.walkSpeedMultiplier;
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

	private updateSocialFacing(deltaMs: number, getActor: (name: string) => AgentActor | undefined, getRoom?: (name: string) => string | undefined): void {
		const idle = [...this.entries].filter(([, e]) => e.state === "idle" && e.socialHoldTimer <= 0);
		for (let i = 0; i < idle.length; i++) {
			for (let j = i + 1; j < idle.length; j++) {
				const [nameA, entryA] = idle[i];
				const [nameB, entryB] = idle[j];
				if (getRoom && getRoom(nameA) !== getRoom(nameB)) continue;
				const dx = entryA.position.x - entryB.position.x;
				const dy = entryA.position.y - entryB.position.y;
				const dist = Math.sqrt(dx * dx + dy * dy);
				if (dist < SOCIAL_PROXIMITY_THRESHOLD && dist > 0 && getActor(nameA) && getActor(nameB)) {
					entryA.socialHoldTimer = SOCIAL_HOLD_DURATION;
					entryB.socialHoldTimer = SOCIAL_HOLD_DURATION;
				}
			}
		}
		for (const [, entry] of this.entries) {
			if (entry.socialHoldTimer > 0) entry.socialHoldTimer -= deltaMs;
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
