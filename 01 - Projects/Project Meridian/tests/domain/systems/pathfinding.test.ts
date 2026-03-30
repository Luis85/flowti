import { describe, it, expect } from 'vitest';
import { buildRegionGraph, findRegionPath } from '../../../src/domain/systems/pathfinding.js';
import type { WorldRegion } from '../../../src/domain/schemas/region-schema.js';

function makeRegion(
	id: string,
	cx: number,
	cy: number,
	connections: { regionId: string; travel_cost: number }[] = [],
): WorldRegion {
	const size = 50;
	return {
		id, name: id,
		bounds: [
			{ x: cx - size, y: cy - size }, { x: cx + size, y: cy - size },
			{ x: cx + size, y: cy + size }, { x: cx - size, y: cy + size },
		],
		connections: connections.map(c => ({ regionId: c.regionId, travel_cost: c.travel_cost })),
		rest_tier: null, color: '#000000',
	};
}

describe('buildRegionGraph', () => {
	it('creates nodes for all regions', () => {
		const regions = [
			makeRegion('region-a', 0, 0),
			makeRegion('region-b', 100, 0),
			makeRegion('region-c', 200, 0),
		];
		const graph = buildRegionGraph(regions);
		expect(graph.nodes.size).toBe(3);
		expect(graph.nodes.has('region-a')).toBe(true);
		expect(graph.nodes.has('region-b')).toBe(true);
		expect(graph.nodes.has('region-c')).toBe(true);
	});

	it('computes centroids from polygon vertices', () => {
		const regions = [makeRegion('region-a', 100, 200)];
		const graph = buildRegionGraph(regions);
		const node = graph.nodes.get('region-a');
		expect(node?.centroid.x).toBe(100);
		expect(node?.centroid.y).toBe(200);
	});
});

describe('findRegionPath', () => {
	// Graph: A(0,0)--1--B(100,0)--2--C(200,0), A--5--C (direct but expensive)
	const regions: WorldRegion[] = [
		makeRegion('region-a', 0, 0, [
			{ regionId: 'region-b', travel_cost: 1 },
			{ regionId: 'region-c', travel_cost: 5 },
		]),
		makeRegion('region-b', 100, 0, [
			{ regionId: 'region-a', travel_cost: 1 },
			{ regionId: 'region-c', travel_cost: 2 },
		]),
		makeRegion('region-c', 200, 0, [
			{ regionId: 'region-a', travel_cost: 5 },
			{ regionId: 'region-b', travel_cost: 2 },
		]),
	];

	it('finds direct neighbor path (1 hop)', () => {
		const graph = buildRegionGraph(regions);
		const result = findRegionPath(graph, 'region-a', 'region-b');
		expect(result).not.toBeNull();
		expect(result!.path).toEqual(['region-a', 'region-b']);
		expect(result!.totalCost).toBe(1);
	});

	it('picks cheapest multi-hop over expensive direct', () => {
		const graph = buildRegionGraph(regions);
		const result = findRegionPath(graph, 'region-a', 'region-c');
		expect(result).not.toBeNull();
		// A→B→C = 3 vs A→C = 5
		expect(result!.path).toEqual(['region-a', 'region-b', 'region-c']);
		expect(result!.totalCost).toBe(3);
	});

	it('same region returns [id] with cost 0', () => {
		const graph = buildRegionGraph(regions);
		const result = findRegionPath(graph, 'region-a', 'region-a');
		expect(result).not.toBeNull();
		expect(result!.path).toEqual(['region-a']);
		expect(result!.totalCost).toBe(0);
	});

	it('disconnected region returns null', () => {
		const disconnected = [
			makeRegion('region-a', 0, 0, []),
			makeRegion('region-d', 500, 500, []),
		];
		const graph = buildRegionGraph(disconnected);
		const result = findRegionPath(graph, 'region-a', 'region-d');
		expect(result).toBeNull();
	});

	it('unknown region returns null', () => {
		const graph = buildRegionGraph(regions);
		expect(findRegionPath(graph, 'region-a', 'region-z')).toBeNull();
		expect(findRegionPath(graph, 'region-z', 'region-a')).toBeNull();
	});

	it('returns null for disconnected nodes without infinite loop', () => {
		// Both nodes exist but have zero connections — A* must terminate
		const isolated: WorldRegion[] = [
			makeRegion('region-a', 0, 0, []),
			makeRegion('region-b', 200, 0, []),
		];
		const graph = buildRegionGraph(isolated);
		const result = findRegionPath(graph, 'region-a', 'region-b');
		expect(result).toBeNull();
	});

	it('handles cycles without infinite loop', () => {
		// A↔B↔C↔A — all connected in a cycle
		const cyclic: WorldRegion[] = [
			makeRegion('region-a', 0, 0, [
				{ regionId: 'region-b', travel_cost: 1 },
				{ regionId: 'region-c', travel_cost: 10 },
			]),
			makeRegion('region-b', 100, 0, [
				{ regionId: 'region-a', travel_cost: 1 },
				{ regionId: 'region-c', travel_cost: 1 },
			]),
			makeRegion('region-c', 200, 0, [
				{ regionId: 'region-b', travel_cost: 1 },
				{ regionId: 'region-a', travel_cost: 10 },
			]),
		];
		const graph = buildRegionGraph(cyclic);
		const result = findRegionPath(graph, 'region-a', 'region-c');
		expect(result).not.toBeNull();
		expect(result!.path).toEqual(['region-a', 'region-b', 'region-c']);
		expect(result!.totalCost).toBe(2);
	});
});
