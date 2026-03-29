import type { Polygon } from '../core/polygon.js';
import { distance } from '../core/math-utils.js';

interface EdgeMidpoint {
	x: number;
	y: number;
}

/** Returns midpoints of each edge in a polygon. */
function getEdges(polygon: Polygon): EdgeMidpoint[] {
	const { vertices } = polygon;
	const midpoints: EdgeMidpoint[] = [];
	for (let i = 0; i < vertices.length; i++) {
		const a = vertices[i]!;
		const b = vertices[(i + 1) % vertices.length]!;
		midpoints.push({
			x: (a.x + b.x) / 2,
			y: (a.y + b.y) / 2,
		});
	}
	return midpoints;
}

/**
 * Find the crossing point between two polygons.
 * Algorithm: find the two closest edge midpoints between the polygons,
 * then return their average (the midpoint between them).
 */
export function computeCrossingPoint(
	polyA: Polygon,
	polyB: Polygon,
): { x: number; y: number } {
	const edgesA = getEdges(polyA);
	const edgesB = getEdges(polyB);

	let bestDist = Infinity;
	let bestA: EdgeMidpoint = { x: 0, y: 0 };
	let bestB: EdgeMidpoint = { x: 0, y: 0 };

	for (const a of edgesA) {
		for (const b of edgesB) {
			const d = distance(a.x, a.y, b.x, b.y);
			if (d < bestDist) {
				bestDist = d;
				bestA = a;
				bestB = b;
			}
		}
	}

	return {
		x: (bestA.x + bestB.x) / 2,
		y: (bestA.y + bestB.y) / 2,
	};
}
