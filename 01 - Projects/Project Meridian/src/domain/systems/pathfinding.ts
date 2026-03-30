import { polygonCentroid } from '../core/polygon.js';
import type { WorldRegion } from '../schemas/region-schema.js';
import { distance } from '../core/math-utils.js';

export interface RegionGraphNode {
	id: string;
	centroid: { x: number; y: number };
	connections: { regionId: string; travelCost: number }[];
}

export interface RegionGraph {
	nodes: Map<string, RegionGraphNode>;
}

export interface RegionPathResult {
	path: string[];
	totalCost: number;
}

export function buildRegionGraph(regions: WorldRegion[]): RegionGraph {
	const nodes = new Map<string, RegionGraphNode>();
	for (const region of regions) {
		const centroid = polygonCentroid({ vertices: region.bounds });
		nodes.set(region.id, {
			id: region.id,
			centroid,
			connections: region.connections.map(c => ({
				regionId: c.regionId,
				travelCost: c.travel_cost,
			})),
		});
	}
	return { nodes };
}

export function findRegionPath(
	graph: RegionGraph,
	fromId: string,
	toId: string,
): RegionPathResult | null {
	const fromNode = graph.nodes.get(fromId);
	const toNode = graph.nodes.get(toId);
	if (!fromNode || !toNode) return null;

	if (fromId === toId) return { path: [fromId], totalCost: 0 };

	// Compute admissible heuristic scale: min(cost / distance) across all edges.
	// This ensures h(n) never overestimates actual cost to goal.
	const scale = computeHeuristicScale(graph);

	const openSet = new Set<string>([fromId]);
	const cameFrom = new Map<string, string>();
	const gScore = new Map<string, number>();
	const fScore = new Map<string, number>();

	gScore.set(fromId, 0);
	fScore.set(fromId, heuristic(fromNode, toNode, scale));

	while (openSet.size > 0) {
		const current = lowestFScore(openSet, fScore);
		if (current === null) break;
		if (current === toId) {
			return reconstructPath(cameFrom, current, gScore);
		}

		openSet.delete(current);
		const currentNode = graph.nodes.get(current);
		if (!currentNode) continue;

		expandNeighbors(currentNode, current, graph, toNode, scale, openSet, cameFrom, gScore, fScore);
	}

	return null;
}

function expandNeighbors(
	currentNode: RegionGraphNode,
	current: string,
	graph: RegionGraph,
	toNode: RegionGraphNode,
	scale: number,
	openSet: Set<string>,
	cameFrom: Map<string, string>,
	gScore: Map<string, number>,
	fScore: Map<string, number>,
): void {
	for (const conn of currentNode.connections) {
		const neighborNode = graph.nodes.get(conn.regionId);
		if (!neighborNode) continue;

		const tentativeG = (gScore.get(current) ?? Infinity) + conn.travelCost;
		if (tentativeG < (gScore.get(conn.regionId) ?? Infinity)) {
			cameFrom.set(conn.regionId, current);
			gScore.set(conn.regionId, tentativeG);
			fScore.set(conn.regionId, tentativeG + heuristic(neighborNode, toNode, scale));
			openSet.add(conn.regionId);
		}
	}
}

function computeHeuristicScale(graph: RegionGraph): number {
	let minRatio = Infinity;
	for (const node of graph.nodes.values()) {
		for (const conn of node.connections) {
			const neighbor = graph.nodes.get(conn.regionId);
			if (!neighbor) continue;
			const dist = distance(node.centroid.x, node.centroid.y, neighbor.centroid.x, neighbor.centroid.y);
			if (dist > 0) {
				minRatio = Math.min(minRatio, conn.travelCost / dist);
			}
		}
	}
	return minRatio === Infinity ? 0 : minRatio;
}

function heuristic(a: RegionGraphNode, b: RegionGraphNode, scale: number): number {
	return distance(a.centroid.x, a.centroid.y, b.centroid.x, b.centroid.y) * scale;
}

function lowestFScore(openSet: Set<string>, fScore: Map<string, number>): string | null {
	let best: string | null = null;
	let bestScore = Infinity;
	for (const id of openSet) {
		const score = fScore.get(id) ?? Infinity;
		if (score < bestScore) {
			bestScore = score;
			best = id;
		}
	}
	return best;
}

function reconstructPath(
	cameFrom: Map<string, string>,
	current: string,
	gScore: Map<string, number>,
): RegionPathResult {
	const path = [current];
	let node = current;
	while (cameFrom.has(node)) {
		node = cameFrom.get(node)!;
		path.unshift(node);
	}
	return { path, totalCost: gScore.get(current) ?? 0 };
}
