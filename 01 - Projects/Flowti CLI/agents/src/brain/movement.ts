/** Pure movement-resolution functions. No ExcaliburJS imports. */

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
