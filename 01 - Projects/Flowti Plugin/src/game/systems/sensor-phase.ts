/**
 * sensor-phase.ts — Per-frame sensor data gathering into agent blackboards.
 *
 * Runs once per frame BEFORE the BT tick. Writes needs snapshots,
 * nearby agents, station positions, echo hints, and room info
 * to each agent's blackboard. The BT reads these values as its
 * sensor inputs.
 *
 * All data sources are injected via SensorDeps to avoid coupling
 * to the full EngineContext.
 */

import type { AgentBlackboard, AgentNeeds, BlackboardManager } from "./blackboard.js";

// ── Dependency interfaces ────────────────────────────────────────

export interface SensorDeps {
	/** All registered agent names. */
	getAgentNames(): string[];
	/** Current needs for an agent. */
	getNeeds(name: string): AgentNeeds;
	/** Room the agent is currently in. */
	getRoom(name: string): string;
	/** Agent names within social radius, same room. */
	getNearbyAgents(name: string): string[];
	/** Entity IDs within interaction radius, same room. */
	getNearbyEntities(name: string): string[];
	/** Nearest unoccupied food station position in agent's room (null if none). */
	getNearestStation(name: string, need: "food" | "drink" | "rest"): { x: number; y: number } | null;
	/** Echo-driven wander hint toward bonded agent (null if no bond or probability miss). */
	getWanderHint(name: string): { x: number; y: number } | null;
	/** Pending cascade hint from echo system (null if none). */
	getCascadeHint(name: string): { hint: string; target: { x: number; y: number } | null } | null;
	/** Room the agent should avoid (echo aversion). */
	getRoomAvoidance(name: string): string | null;
	/** Echo mood-residue weight for break threshold bias. */
	getBreakThresholdBias(name: string): number;
}

// ── Sensor tick ──────────────────────────────────────────────────

/** Write sensor data to all agent blackboards. */
export function tickSensors(blackboards: BlackboardManager, deps: SensorDeps): void {
	for (const name of deps.getAgentNames()) {
		if (!blackboards.has(name)) continue;
		const bb = blackboards.get(name);
		writeSensorData(bb, name, deps);
	}
}

/** Write sensor data to a single agent's blackboard. */
function writeSensorData(bb: AgentBlackboard, name: string, deps: SensorDeps): void {
	// Needs snapshot
	const needs = deps.getNeeds(name);
	bb.needs.energy = needs.energy;
	bb.needs.social = needs.social;
	bb.needs.focus = needs.focus;
	bb.needs.morale = needs.morale;
	bb.needs.hunger = needs.hunger;
	bb.needs.thirst = needs.thirst;

	// Spatial awareness
	bb.currentRoom = deps.getRoom(name);
	bb.nearbyAgents = deps.getNearbyAgents(name);
	bb.nearbyEntities = deps.getNearbyEntities(name);

	// Station positions (nearest unoccupied in same room)
	bb.nearestFoodStation = deps.getNearestStation(name, "food");
	bb.nearestDrinkStation = deps.getNearestStation(name, "drink");
	bb.nearestRestStation = deps.getNearestStation(name, "rest");

	// Echo-driven hints
	bb.wanderHint = deps.getWanderHint(name);
	bb.breakThresholdBias = deps.getBreakThresholdBias(name);
	bb.roomAvoidance = deps.getRoomAvoidance(name);

	// Cascade hints (from echo threshold crossings)
	const cascade = deps.getCascadeHint(name);
	if (cascade) {
		bb.cascadeHint = cascade.hint;
		bb.cascadeTarget = cascade.target;
	} else {
		bb.cascadeHint = null;
		bb.cascadeTarget = null;
	}
}
