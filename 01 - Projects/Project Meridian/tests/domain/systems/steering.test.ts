import { describe, it, expect } from 'vitest';
import { resolveSteeringOffset } from '../../../src/domain/systems/steering.js';
import type { Obstacle } from '../../../src/domain/systems/steering.js';

describe('resolveSteeringOffset', () => {
	it('clear path returns original target', () => {
		// Obstacle is off to the side, not blocking
		const obstacles: Obstacle[] = [{ x: 50, y: 100, radius: 10 }];
		const result = resolveSteeringOffset(0, 0, 100, 0, obstacles, 5);
		expect(result.x).toBe(100);
		expect(result.y).toBe(0);
	});

	it('steers around blocking obstacle', () => {
		// Obstacle directly in the path from (0,0) to (100,0)
		const obstacles: Obstacle[] = [{ x: 50, y: 0, radius: 10 }];
		const result = resolveSteeringOffset(0, 0, 100, 0, obstacles, 5);
		// x stays near target, y should be offset (not zero)
		expect(result.y).not.toBe(0);
	});

	it('no steer when obstacle far from path', () => {
		// Obstacle very far away
		const obstacles: Obstacle[] = [{ x: 500, y: 500, radius: 10 }];
		const result = resolveSteeringOffset(0, 0, 100, 0, obstacles, 5);
		expect(result.x).toBe(100);
		expect(result.y).toBe(0);
	});

	it('handles obstacle at agent position', () => {
		// Obstacle right at the agent start
		const obstacles: Obstacle[] = [{ x: 0, y: 0, radius: 10 }];
		const result = resolveSteeringOffset(0, 0, 100, 0, obstacles, 5);
		// Should still return a valid point (may be offset or original)
		expect(typeof result.x).toBe('number');
		expect(typeof result.y).toBe('number');
		expect(Number.isFinite(result.x)).toBe(true);
		expect(Number.isFinite(result.y)).toBe(true);
	});

	it('avoids closest when multiple obstacles block', () => {
		// Two obstacles in path; the closer one should determine the offset direction
		const obstacles: Obstacle[] = [
			{ x: 30, y: 0, radius: 10 },
			{ x: 70, y: 0, radius: 10 },
		];
		const result = resolveSteeringOffset(0, 0, 100, 0, obstacles, 5);
		// Should steer around the closest one (x=30)
		expect(result.y).not.toBe(0);
	});

	it('no obstacles returns original target', () => {
		const result = resolveSteeringOffset(0, 0, 100, 0, [], 5);
		expect(result.x).toBe(100);
		expect(result.y).toBe(0);
	});
});
