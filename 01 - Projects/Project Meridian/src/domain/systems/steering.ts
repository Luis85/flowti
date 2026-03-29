import { distance } from '../core/math-utils.js';

export interface Obstacle {
	x: number;
	y: number;
	radius: number;
}

/**
 * Check if a line segment from (ax,ay) to (bx,by) intersects a circle
 * centered at (cx,cy) with the given combinedRadius.
 * Uses closest-point-on-segment approach with quadratic discriminant.
 */
function lineIntersectsCircle(
	ax: number, ay: number,
	bx: number, by: number,
	cx: number, cy: number,
	combinedRadius: number,
): boolean {
	const dx = bx - ax;
	const dy = by - ay;
	const fx = ax - cx;
	const fy = ay - cy;

	const a = dx * dx + dy * dy;
	if (a === 0) {
		// Agent and target at same position
		return distance(ax, ay, cx, cy) < combinedRadius;
	}

	const b = 2 * (fx * dx + fy * dy);
	const c = fx * fx + fy * fy - combinedRadius * combinedRadius;
	const discriminant = b * b - 4 * a * c;

	if (discriminant < 0) return false;

	const sqrtDisc = Math.sqrt(discriminant);
	const t1 = (-b - sqrtDisc) / (2 * a);
	const t2 = (-b + sqrtDisc) / (2 * a);

	// Intersection if either t is within [0, 1]
	return (t1 >= 0 && t1 <= 1) || (t2 >= 0 && t2 <= 1) || (t1 < 0 && t2 > 1);
}

/**
 * Resolve steering offset: if an obstacle blocks the path from agent to target,
 * offset the target perpendicular to the approach direction, away from the obstacle.
 */
export function resolveSteeringOffset(
	agentX: number,
	agentY: number,
	targetX: number,
	targetY: number,
	obstacles: Obstacle[],
	agentRadius: number,
): { x: number; y: number } {
	if (obstacles.length === 0) {
		return { x: targetX, y: targetY };
	}

	// Find the closest blocking obstacle
	let closestDist = Infinity;
	let blocker: Obstacle | null = null;

	for (const obs of obstacles) {
		const combinedRadius = obs.radius + agentRadius;
		if (lineIntersectsCircle(agentX, agentY, targetX, targetY, obs.x, obs.y, combinedRadius)) {
			const d = distance(agentX, agentY, obs.x, obs.y);
			if (d < closestDist) {
				closestDist = d;
				blocker = obs;
			}
		}
	}

	if (!blocker) {
		return { x: targetX, y: targetY };
	}

	// Compute perpendicular offset away from the obstacle
	const dx = targetX - agentX;
	const dy = targetY - agentY;
	const len = Math.sqrt(dx * dx + dy * dy);

	if (len === 0) {
		return { x: targetX, y: targetY };
	}

	// Perpendicular direction (rotate 90 degrees)
	const perpX = -dy / len;
	const perpY = dx / len;

	// Determine which side of the line the obstacle is on
	const toObsX = blocker.x - agentX;
	const toObsY = blocker.y - agentY;
	const side = perpX * toObsX + perpY * toObsY;

	// Offset away from obstacle (opposite side)
	const offsetAmount = blocker.radius + agentRadius;
	const sign = side >= 0 ? -1 : 1;

	return {
		x: targetX + perpX * offsetAmount * sign,
		y: targetY + perpY * offsetAmount * sign,
	};
}
