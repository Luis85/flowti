export interface Polygon {
	vertices: { x: number; y: number }[];
}

/** Ray-casting point-in-polygon test. */
export function pointInPolygon(px: number, py: number, polygon: Polygon): boolean {
	const { vertices } = polygon;
	let inside = false;
	for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
		const vi = vertices[i]!;
		const vj = vertices[j]!;
		const xi = vi.x;
		const yi = vi.y;
		const xj = vj.x;
		const yj = vj.y;
		const intersect = ((yi > py) !== (yj > py))
			&& (px < (xj - xi) * (py - yi) / (yj - yi) + xi);
		if (intersect) inside = !inside;
	}
	return inside;
}

/** Compute the centroid (average of vertices) of a polygon. */
export function polygonCentroid(polygon: Polygon): { x: number; y: number } {
	const { vertices } = polygon;
	if (vertices.length === 0) return { x: 0, y: 0 };
	let cx = 0;
	let cy = 0;
	for (const v of vertices) {
		cx += v.x;
		cy += v.y;
	}
	return { x: cx / vertices.length, y: cy / vertices.length };
}
