import { describe, it, expect } from 'vitest';
import { computeMovement } from '../../../src/domain/systems/movement.js';

describe('computeMovement', () => {
	it('moves toward target along x axis', () => {
		const result = computeMovement({ currentPos: { x: 0, y: 0 }, targetPos: { x: 100, y: 0 }, speed: 10, deltaTicks: 1 });
		expect(result.newPos.x).toBeCloseTo(10, 1);
		expect(result.newPos.y).toBeCloseTo(0, 1);
		expect(result.arrived).toBe(false);
	});

	it('moves toward target along y axis', () => {
		const result = computeMovement({ currentPos: { x: 0, y: 0 }, targetPos: { x: 0, y: 100 }, speed: 10, deltaTicks: 1 });
		expect(result.newPos.y).toBeCloseTo(10, 1);
		expect(result.arrived).toBe(false);
	});

	it('normalises diagonal movement', () => {
		const result = computeMovement({ currentPos: { x: 0, y: 0 }, targetPos: { x: 100, y: 100 }, speed: 10, deltaTicks: 1 });
		const dist = Math.sqrt(result.newPos.x ** 2 + result.newPos.y ** 2);
		expect(dist).toBeCloseTo(10, 1);
	});

	it('arrives when within step distance', () => {
		const result = computeMovement({ currentPos: { x: 95, y: 0 }, targetPos: { x: 100, y: 0 }, speed: 10, deltaTicks: 1 });
		expect(result.arrived).toBe(true);
		expect(result.newPos.x).toBe(100);
		expect(result.newPos.y).toBe(0);
	});

	it('already at target returns arrived', () => {
		const result = computeMovement({ currentPos: { x: 50, y: 50 }, targetPos: { x: 50, y: 50 }, speed: 10, deltaTicks: 1 });
		expect(result.arrived).toBe(true);
		expect(result.newPos).toEqual({ x: 50, y: 50 });
	});

	it('deltaTicks scales movement', () => {
		const result = computeMovement({ currentPos: { x: 0, y: 0 }, targetPos: { x: 100, y: 0 }, speed: 5, deltaTicks: 3 });
		expect(result.newPos.x).toBeCloseTo(15, 1);
	});

	it('speed zero keeps agent in place', () => {
		const result = computeMovement({
			currentPos: { x: 0, y: 0 },
			targetPos: { x: 100, y: 0 },
			speed: 0,
			deltaTicks: 1,
		});
		expect(result.newPos).toEqual({ x: 0, y: 0 });
		expect(result.arrived).toBe(false);
	});
});
