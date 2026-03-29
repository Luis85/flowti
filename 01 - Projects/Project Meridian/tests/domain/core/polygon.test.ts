import { describe, it, expect } from 'vitest';
import { pointInPolygon, polygonCentroid, type Polygon } from '../../../src/domain/core/polygon.js';

const square: Polygon = {
	vertices: [
		{ x: 0, y: 0 },
		{ x: 100, y: 0 },
		{ x: 100, y: 100 },
		{ x: 0, y: 100 },
	],
};

const triangle: Polygon = {
	vertices: [
		{ x: 50, y: 0 },
		{ x: 100, y: 100 },
		{ x: 0, y: 100 },
	],
};

const concaveL: Polygon = {
	vertices: [
		{ x: 0, y: 0 },
		{ x: 100, y: 0 },
		{ x: 100, y: 50 },
		{ x: 50, y: 50 },
		{ x: 50, y: 100 },
		{ x: 0, y: 100 },
	],
};

describe('pointInPolygon', () => {
	it('detects point inside square', () => {
		expect(pointInPolygon(50, 50, square)).toBe(true);
	});

	it('detects point outside square', () => {
		expect(pointInPolygon(150, 50, square)).toBe(false);
	});

	it('detects point inside triangle', () => {
		expect(pointInPolygon(50, 70, triangle)).toBe(true);
	});

	it('detects point outside triangle', () => {
		expect(pointInPolygon(10, 10, triangle)).toBe(false);
	});

	it('handles concave polygon — point in notch is outside', () => {
		expect(pointInPolygon(75, 75, concaveL)).toBe(false);
	});

	it('handles concave polygon — point in L-body is inside', () => {
		expect(pointInPolygon(25, 75, concaveL)).toBe(true);
	});

	it('detects point far outside', () => {
		expect(pointInPolygon(-100, -100, square)).toBe(false);
	});
});

describe('polygonCentroid', () => {
	it('computes centroid of square', () => {
		const c = polygonCentroid(square);
		expect(c.x).toBeCloseTo(50);
		expect(c.y).toBeCloseTo(50);
	});

	it('computes centroid of triangle', () => {
		const c = polygonCentroid(triangle);
		expect(c.x).toBeCloseTo(50);
		expect(c.y).toBeCloseTo(66.67, 1);
	});
});
