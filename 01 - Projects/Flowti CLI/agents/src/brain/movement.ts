/** Pure movement-resolution functions. No ExcaliburJS imports. Type-only brain import for AgentHabits. */

import type { AgentHabits } from "./brain-types.js";

export interface Bounds {
	readonly minX: number;
	readonly maxX: number;
	readonly minY: number;
	readonly maxY: number;
}

export interface Position {
	readonly x: number;
	readonly y: number;
}

export interface Workstation extends Position {
	readonly id: string;
	readonly occupied: boolean;
}

export interface Relationship {
	readonly target: string;
	readonly type: string;
}

export interface AgentTarget extends Position {
	readonly targetId: string;
}

/** Returns a random point within the given bounds using the supplied rng (0–1). */
export function randomWanderPoint(bounds: Bounds, rng: () => number): Position {
	return {
		x: bounds.minX + rng() * (bounds.maxX - bounds.minX),
		y: bounds.minY + rng() * (bounds.maxY - bounds.minY),
	};
}

/** Finds the closest unoccupied workstation by Euclidean distance. */
export function nearestUnoccupied(
	position: Position,
	workstations: readonly Workstation[],
): Position | null {
	let best: Workstation | null = null;
	let bestDist = Infinity;

	for (const ws of workstations) {
		if (ws.occupied) continue;
		const dx = ws.x - position.x;
		const dy = ws.y - position.y;
		const dist = dx * dx + dy * dy;
		if (dist < bestDist) {
			bestDist = dist;
			best = ws;
		}
	}

	return best ? { x: best.x, y: best.y } : null;
}

/** Finds the first relationship target that exists in the agents map. */
export function resolveAgentTarget(
	relationships: readonly Relationship[],
	agents: Map<string, Position>,
): AgentTarget | null {
	for (const rel of relationships) {
		const pos = agents.get(rel.target);
		if (pos) {
			return { x: pos.x, y: pos.y, targetId: rel.target };
		}
	}
	return null;
}

/** Resolve an idle target based on personality habits. Priority: social → focus → wander. */
export function resolveIdleTarget(
	habits: AgentHabits,
	nearbyAgents: readonly Position[],
	bounds: Bounds,
	rng: () => number,
): Position | null {
	// Social drift: gravitate toward nearest agent
	if (nearbyAgents.length > 0 && rng() < habits.socialDrift) {
		const target = nearbyAgents[0];
		const offsetAngle = rng() * Math.PI * 2;
		return {
			x: Math.max(bounds.minX, Math.min(bounds.maxX, target.x + Math.cos(offsetAngle) * 30)),
			y: Math.max(bounds.minY, Math.min(bounds.maxY, target.y + Math.sin(offsetAngle) * 30)),
		};
	}

	// Focus drift: seek furthest corner from all agents
	if (nearbyAgents.length > 0 && rng() < habits.focusDrift) {
		const corners: Position[] = [
			{ x: bounds.minX, y: bounds.minY },
			{ x: bounds.maxX, y: bounds.minY },
			{ x: bounds.minX, y: bounds.maxY },
			{ x: bounds.maxX, y: bounds.maxY },
		];
		let bestCorner = corners[0];
		let bestMinDist = -1;
		for (const corner of corners) {
			let minDist = Infinity;
			for (const agent of nearbyAgents) {
				const dx = corner.x - agent.x;
				const dy = corner.y - agent.y;
				minDist = Math.min(minDist, dx * dx + dy * dy);
			}
			if (minDist > bestMinDist) {
				bestMinDist = minDist;
				bestCorner = corner;
			}
		}
		return bestCorner;
	}

	// Fallback: random wander
	return randomWanderPoint(bounds, rng);
}

/** Find preferred workstation if available, otherwise nearest unoccupied. */
export function preferredWorkstation(
	position: Position,
	workstations: readonly Workstation[],
	preferredId: string | null,
): Position | null {
	if (preferredId) {
		const pref = workstations.find((ws) => ws.id === preferredId && !ws.occupied);
		if (pref) return { x: pref.x, y: pref.y };
	}
	return nearestUnoccupied(position, workstations);
}
