import { describe, it, expect } from 'vitest';
import { resolveArrivalOffset } from '../../../src/domain/systems/arrival-spread.js';

describe('resolveArrivalOffset', () => {
	it('returns zero offset for single agent', () => {
		const result = resolveArrivalOffset(0, 1, 22);
		expect(result.dx).toBe(0);
		expect(result.dy).toBe(0);
	});

	it('distributes two agents opposite each other', () => {
		const a = resolveArrivalOffset(0, 2, 22);
		const b = resolveArrivalOffset(1, 2, 22);
		// Slot 0 at angle 0 → (22, 0), slot 1 at angle π → (-22, 0)
		expect(a.dx).toBeCloseTo(22);
		expect(a.dy).toBeCloseTo(0);
		expect(b.dx).toBeCloseTo(-22);
		expect(b.dy).toBeCloseTo(0);
	});

	it('distributes three agents in a triangle', () => {
		const a = resolveArrivalOffset(0, 3, 22);
		const b = resolveArrivalOffset(1, 3, 22);
		const c = resolveArrivalOffset(2, 3, 22);
		// All should be 22px from center
		expect(Math.sqrt(a.dx ** 2 + a.dy ** 2)).toBeCloseTo(22);
		expect(Math.sqrt(b.dx ** 2 + b.dy ** 2)).toBeCloseTo(22);
		expect(Math.sqrt(c.dx ** 2 + c.dy ** 2)).toBeCloseTo(22);
	});

	it('distributes four agents in a cross', () => {
		const offsets = [0, 1, 2, 3].map(i => resolveArrivalOffset(i, 4, 22));
		// Slot 0: (22, 0), Slot 1: (0, 22), Slot 2: (-22, 0), Slot 3: (0, -22)
		expect(offsets[0].dx).toBeCloseTo(22);
		expect(offsets[0].dy).toBeCloseTo(0);
		expect(offsets[1].dx).toBeCloseTo(0);
		expect(offsets[1].dy).toBeCloseTo(22);
		expect(offsets[2].dx).toBeCloseTo(-22);
		expect(offsets[2].dy).toBeCloseTo(0);
		expect(offsets[3].dx).toBeCloseTo(0);
		expect(offsets[3].dy).toBeCloseTo(-22);
	});

	it('respects spread radius', () => {
		const a = resolveArrivalOffset(0, 2, 10);
		expect(a.dx).toBeCloseTo(10);
		expect(a.dy).toBeCloseTo(0);
	});

	it('returns zero offset for zero agents', () => {
		const result = resolveArrivalOffset(0, 0, 22);
		expect(result.dx).toBe(0);
		expect(result.dy).toBe(0);
	});
});
