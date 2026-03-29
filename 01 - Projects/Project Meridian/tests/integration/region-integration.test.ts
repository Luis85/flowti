import { describe, it, expect } from 'vitest';
import { buildRegionGraph, findRegionPath } from '../../src/domain/systems/pathfinding.js';
import { computeCrossingPoint } from '../../src/domain/systems/crossing-point.js';
import { pointInPolygon, polygonCentroid } from '../../src/domain/core/polygon.js';
import type { WorldRegion } from '../../src/domain/schemas/region-schema.js';
import type { Polygon } from '../../src/domain/core/polygon.js';

/**
 * Three adjacent 100x100 square regions in a horizontal row:
 *   A: [0,0]–[100,100]   connections: B (cost 1)
 *   B: [100,0]–[200,100]  connections: A (cost 1), C (cost 2)
 *   C: [200,0]–[300,100]  connections: B (cost 2)
 */
function makeTestRegions(): WorldRegion[] {
	return [
		{
			id: 'region-a', name: 'Region A',
			bounds: [
				{ x: 0, y: 0 }, { x: 100, y: 0 },
				{ x: 100, y: 100 }, { x: 0, y: 100 },
			],
			connections: [{ regionId: 'region-b', travel_cost: 1 }],
			rest_tier: null, color: '#2a2a4a',
		},
		{
			id: 'region-b', name: 'Region B',
			bounds: [
				{ x: 100, y: 0 }, { x: 200, y: 0 },
				{ x: 200, y: 100 }, { x: 100, y: 100 },
			],
			connections: [
				{ regionId: 'region-a', travel_cost: 1 },
				{ regionId: 'region-c', travel_cost: 2 },
			],
			rest_tier: null, color: '#2a2a4a',
		},
		{
			id: 'region-c', name: 'Region C',
			bounds: [
				{ x: 200, y: 0 }, { x: 300, y: 0 },
				{ x: 300, y: 100 }, { x: 200, y: 100 },
			],
			connections: [{ regionId: 'region-b', travel_cost: 2 }],
			rest_tier: null, color: '#2a2a4a',
		},
	];
}

interface JourneyWaypoint {
	fromRegionId: string;
	toRegionId: string;
	crossingPoint: { x: number; y: number };
	travelCost: number;
}

interface JourneyState {
	path: string[];
	waypoints: JourneyWaypoint[];
	totalCost: number;
}

/**
 * Build a complete journey from an A* path result:
 * for each consecutive pair of regions, compute the crossing point
 * and look up the travel cost from the region graph.
 */
function buildJourney(
	regions: WorldRegion[],
	path: string[],
	totalCost: number,
): JourneyState {
	const regionMap = new Map(regions.map(r => [r.id, r]));
	const graph = buildRegionGraph(regions);
	const waypoints: JourneyWaypoint[] = [];

	for (let i = 0; i < path.length - 1; i++) {
		const fromId = path[i]!;
		const toId = path[i + 1]!;
		const fromRegion = regionMap.get(fromId)!;
		const toRegion = regionMap.get(toId)!;

		const polyA: Polygon = { vertices: fromRegion.bounds };
		const polyB: Polygon = { vertices: toRegion.bounds };
		const crossingPoint = computeCrossingPoint(polyA, polyB);

		const fromNode = graph.nodes.get(fromId)!;
		const conn = fromNode.connections.find(c => c.regionId === toId)!;

		waypoints.push({
			fromRegionId: fromId,
			toRegionId: toId,
			crossingPoint,
			travelCost: conn.travelCost,
		});
	}

	return { path, waypoints, totalCost };
}

describe('Region integration', () => {
	const regions = makeTestRegions();

	it('A* finds path A->B->C through 3 regions', () => {
		const graph = buildRegionGraph(regions);
		const result = findRegionPath(graph, 'region-a', 'region-c');

		expect(result).not.toBeNull();
		expect(result!.path).toEqual(['region-a', 'region-b', 'region-c']);
		expect(result!.totalCost).toBe(3);
	});

	it('crossing points are between adjacent region edges', () => {
		const polyA: Polygon = { vertices: regions[0]!.bounds };
		const polyB: Polygon = { vertices: regions[1]!.bounds };
		const polyC: Polygon = { vertices: regions[2]!.bounds };

		const crossAB = computeCrossingPoint(polyA, polyB);
		// Shared edge at x=100, midpoints at y=50 on both sides
		expect(crossAB.x).toBe(100);
		expect(crossAB.y).toBe(50);

		const crossBC = computeCrossingPoint(polyB, polyC);
		// Shared edge at x=200, midpoints at y=50 on both sides
		expect(crossBC.x).toBe(200);
		expect(crossBC.y).toBe(50);
	});

	it('pointInPolygon correctly identifies agent region', () => {
		const polyA: Polygon = { vertices: regions[0]!.bounds };
		const polyB: Polygon = { vertices: regions[1]!.bounds };
		const polyC: Polygon = { vertices: regions[2]!.bounds };

		// Agent at center of region A
		expect(pointInPolygon(50, 50, polyA)).toBe(true);
		expect(pointInPolygon(50, 50, polyB)).toBe(false);
		expect(pointInPolygon(50, 50, polyC)).toBe(false);

		// Agent at center of region C
		expect(pointInPolygon(250, 50, polyA)).toBe(false);
		expect(pointInPolygon(250, 50, polyB)).toBe(false);
		expect(pointInPolygon(250, 50, polyC)).toBe(true);

		// Agent at center of region B
		expect(pointInPolygon(150, 50, polyA)).toBe(false);
		expect(pointInPolygon(150, 50, polyB)).toBe(true);
		expect(pointInPolygon(150, 50, polyC)).toBe(false);
	});

	it('journey waypoints have correct structure', () => {
		const graph = buildRegionGraph(regions);
		const pathResult = findRegionPath(graph, 'region-a', 'region-c')!;
		const journey = buildJourney(regions, pathResult.path, pathResult.totalCost);

		// Path A->B->C produces 2 waypoints
		expect(journey.waypoints).toHaveLength(2);

		// First waypoint: A->B crossing
		const wp0 = journey.waypoints[0]!;
		expect(wp0.fromRegionId).toBe('region-a');
		expect(wp0.toRegionId).toBe('region-b');
		expect(wp0.crossingPoint.x).toBe(100);
		expect(wp0.crossingPoint.y).toBe(50);
		expect(wp0.travelCost).toBe(1);

		// Second waypoint: B->C crossing
		const wp1 = journey.waypoints[1]!;
		expect(wp1.fromRegionId).toBe('region-b');
		expect(wp1.toRegionId).toBe('region-c');
		expect(wp1.crossingPoint.x).toBe(200);
		expect(wp1.crossingPoint.y).toBe(50);
		expect(wp1.travelCost).toBe(2);
	});

	it('total travel cost matches path cost', () => {
		const graph = buildRegionGraph(regions);
		const pathResult = findRegionPath(graph, 'region-a', 'region-c')!;
		const journey = buildJourney(regions, pathResult.path, pathResult.totalCost);

		const waypointCostSum = journey.waypoints.reduce(
			(sum, wp) => sum + wp.travelCost, 0,
		);
		expect(waypointCostSum).toBe(journey.totalCost);
		expect(waypointCostSum).toBe(3);
	});

	it('centroids are computed correctly for all regions', () => {
		const graph = buildRegionGraph(regions);

		const nodeA = graph.nodes.get('region-a')!;
		expect(nodeA.centroid).toEqual({ x: 50, y: 50 });

		const nodeB = graph.nodes.get('region-b')!;
		expect(nodeB.centroid).toEqual({ x: 150, y: 50 });

		const nodeC = graph.nodes.get('region-c')!;
		expect(nodeC.centroid).toEqual({ x: 250, y: 50 });
	});

	it('reverse path C->A has same cost as A->C', () => {
		const graph = buildRegionGraph(regions);
		const forward = findRegionPath(graph, 'region-a', 'region-c')!;
		const reverse = findRegionPath(graph, 'region-c', 'region-a')!;

		expect(reverse.path).toEqual(['region-c', 'region-b', 'region-a']);
		expect(reverse.totalCost).toBe(forward.totalCost);
	});
});
