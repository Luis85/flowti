import { describe, it, expect } from 'vitest';
import { computeCrossingPoint } from '../../../src/domain/systems/crossing-point.js';
import type { Polygon } from '../../../src/domain/core/polygon.js';

describe('computeCrossingPoint', () => {
	it('finds midpoint of shared edge between adjacent squares', () => {
		// Left square: 0-100, right square: 100-200 (shared edge at x=100)
		const left: Polygon = {
			vertices: [
				{ x: 0, y: 0 }, { x: 100, y: 0 },
				{ x: 100, y: 100 }, { x: 0, y: 100 },
			],
		};
		const right: Polygon = {
			vertices: [
				{ x: 100, y: 0 }, { x: 200, y: 0 },
				{ x: 200, y: 100 }, { x: 100, y: 100 },
			],
		};
		const result = computeCrossingPoint(left, right);
		expect(result.x).toBe(100);
		expect(result.y).toBe(50);
	});

	it('finds midpoint between nearest edges when gap exists', () => {
		// Left square: 0-90, right square: 110-200 (gap from 90 to 110)
		const left: Polygon = {
			vertices: [
				{ x: 0, y: 0 }, { x: 90, y: 0 },
				{ x: 90, y: 100 }, { x: 0, y: 100 },
			],
		};
		const right: Polygon = {
			vertices: [
				{ x: 110, y: 0 }, { x: 200, y: 0 },
				{ x: 200, y: 100 }, { x: 110, y: 100 },
			],
		};
		const result = computeCrossingPoint(left, right);
		// Closest edge midpoints: left right-edge midpoint (90,50) and right left-edge midpoint (110,50)
		// Average: (100, 50)
		expect(result.x).toBe(100);
		expect(result.y).toBe(50);
	});

	it('works with triangular regions', () => {
		const triA: Polygon = {
			vertices: [
				{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 25, y: 50 },
			],
		};
		const triB: Polygon = {
			vertices: [
				{ x: 50, y: 0 }, { x: 100, y: 0 }, { x: 75, y: 50 },
			],
		};
		const result = computeCrossingPoint(triA, triB);
		// triA edges midpoints: (25,0), (37.5,25), (12.5,25)
		// triB edges midpoints: (75,0), (87.5,25), (62.5,25)
		// Closest pair: triA (37.5,25) and triB (62.5,25) → average (50, 25)
		expect(result.x).toBe(50);
		expect(result.y).toBe(25);
	});
});
