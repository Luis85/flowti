import { describe, it, expect } from 'vitest';
import { clamp, round2, distance } from '../../../src/domain/core/math-utils.js';

describe('clamp', () => {
	it('returns value when within range', () => {
		expect(clamp(5, 0, 10)).toBe(5);
	});

	it('clamps to min when value is below', () => {
		expect(clamp(-3, 0, 10)).toBe(0);
	});

	it('clamps to max when value is above', () => {
		expect(clamp(15, 0, 10)).toBe(10);
	});

	it('returns min when value equals min', () => {
		expect(clamp(0, 0, 10)).toBe(0);
	});

	it('returns max when value equals max', () => {
		expect(clamp(10, 0, 10)).toBe(10);
	});

	it('handles negative ranges', () => {
		expect(clamp(-5, -10, -1)).toBe(-5);
		expect(clamp(-15, -10, -1)).toBe(-10);
		expect(clamp(0, -10, -1)).toBe(-1);
	});
});

describe('round2', () => {
	it('rounds to 2 decimal places', () => {
		expect(round2(1.2345)).toBe(1.23);
		expect(round2(1.2367)).toBe(1.24);
	});

	it('returns already-rounded values unchanged', () => {
		expect(round2(3.14)).toBe(3.14);
		expect(round2(7)).toBe(7);
	});

	it('rounds negative numbers correctly', () => {
		expect(round2(-2.567)).toBe(-2.57);
		expect(round2(-0.001)).toBe(-0);
	});
});

describe('distance', () => {
	it('calculates horizontal distance', () => {
		expect(distance(0, 0, 3, 0)).toBe(3);
	});

	it('calculates vertical distance', () => {
		expect(distance(0, 0, 0, 4)).toBe(4);
	});

	it('calculates diagonal distance (3-4-5 triangle)', () => {
		expect(distance(0, 0, 3, 4)).toBe(5);
	});

	it('returns zero for identical points', () => {
		expect(distance(5, 5, 5, 5)).toBe(0);
	});

	it('handles negative coordinates', () => {
		expect(distance(-3, -4, 0, 0)).toBe(5);
		expect(distance(-1, -1, -4, -5)).toBe(5);
	});
});
