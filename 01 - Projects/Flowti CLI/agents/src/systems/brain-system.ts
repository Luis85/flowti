/**
 * brain-system.ts — Drives agent movement and state transitions each frame.
 *
 * Maintains per-agent brain state, movement targets, and attribute-derived params.
 * Called from scene onPreUpdate to advance wandering, walking, working, and idle cycles.
 */

import type { BrainState, BrainParams, MovementTarget } from "../brain/brain-types.js";
import type { AgentAttributes, AgentActionType } from "../data/types.js";
import { computeParams, transition } from "../brain/agent-brain.js";
import { randomWanderPoint, type Bounds, type Position } from "../brain/movement.js";
import type { AgentActor } from "../actors/agent-actor.js";

// ── Per-agent entry ──────────────────────────────────────────────────

interface AgentBrainEntry {
	state: BrainState;
	params: BrainParams;
	target: MovementTarget;
	targetPos: Position | null;
	stateTimer: number;
}

// ── Constants ────────────────────────────────────────────────────────

const BASE_SPEED = 40; // pixels per second
const ARRIVAL_THRESHOLD = 4; // pixels to consider "arrived"

// ── BrainSystem ──────────────────────────────────────────────────────

export interface BrainSystemConfig {
	readonly bounds: Bounds;
}

export class BrainSystem {
	private readonly entries = new Map<string, AgentBrainEntry>();
	private readonly bounds: Bounds;

	constructor(config: BrainSystemConfig) {
		this.bounds = config.bounds;
	}

	/** Register an agent with its attributes. */
	register(name: string, attributes: AgentAttributes): void {
		if (this.entries.has(name)) return;
		this.entries.set(name, {
			state: "idle",
			params: computeParams(attributes),
			target: { kind: "none" },
			targetPos: null,
			stateTimer: 0,
		});
	}

	/** Remove an agent from the brain system. */
	unregister(name: string): void {
		this.entries.delete(name);
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
		const result = transition(entry.state, { type: eventType as AgentActionType });
		entry.state = result.state;
		entry.target = result.target;
		entry.targetPos = null;
		entry.stateTimer = 0;
	}

	/** Advance all agent brains by deltaMs. Updates actor positions and visuals. */
	update(deltaMs: number, getActor: (name: string) => AgentActor | undefined): void {
		for (const [name, entry] of this.entries) {
			entry.stateTimer += deltaMs;
			const actor = getActor(name);
			if (!actor) continue;

			switch (entry.state) {
				case "idle":
					this.updateIdle(entry, name);
					break;
				case "wandering":
					this.updateMoving(entry, actor, deltaMs);
					break;
				case "walking-to":
					this.updateMoving(entry, actor, deltaMs);
					break;
				case "working":
					this.updateWorking(entry);
					break;
				case "talking":
					// Stay in talking until an event transitions out
					break;
				case "waiting":
					// Stay in waiting until permission event
					break;
			}

			actor.updateFromBrain(entry.state, entry.target);
		}
	}

	private updateIdle(entry: AgentBrainEntry, _name: string): void {
		if (entry.stateTimer >= entry.params.idleResistance) {
			// Start wandering
			entry.state = "wandering";
			entry.stateTimer = 0;
			const dest = randomWanderPoint(this.bounds, Math.random);
			entry.targetPos = dest;
			entry.target = { kind: "wander", x: dest.x, y: dest.y };
		}
	}

	private updateMoving(entry: AgentBrainEntry, actor: AgentActor, deltaMs: number): void {
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
			} else if (entry.state === "walking-to") {
				if (entry.target.kind === "workstation") {
					entry.state = "working";
				} else {
					entry.state = "idle";
				}
				entry.target = { kind: "none" };
			}
			entry.targetPos = null;
			entry.stateTimer = 0;
			return;
		}

		// Move toward target
		const speed = BASE_SPEED * entry.params.speedMultiplier * (deltaMs / 1000);
		const moveX = (dx / dist) * Math.min(speed, dist);
		const moveY = (dy / dist) * Math.min(speed, dist);
		actor.pos.x += moveX;
		actor.pos.y += moveY;

		// Face direction of movement
		actor.facingLeft = dx < 0;
	}

	private updateWorking(entry: AgentBrainEntry): void {
		if (entry.stateTimer >= entry.params.focusDuration) {
			// Done working, start wandering
			entry.state = "wandering";
			entry.stateTimer = 0;
			const dest = randomWanderPoint(this.bounds, Math.random);
			entry.targetPos = dest;
			entry.target = { kind: "wander", x: dest.x, y: dest.y };
		}
	}
}
