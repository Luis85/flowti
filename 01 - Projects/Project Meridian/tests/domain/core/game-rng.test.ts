import { describe, it, expect } from 'vitest';
import { createGameRNG, hashString } from '../../../src/domain/core/game-rng.js';

describe('createGameRNG', () => {
	it('same seed produces same sequence', () => {
		const a = createGameRNG(42);
		const b = createGameRNG(42);
		expect(a.next()).toBe(b.next());
		expect(a.next()).toBe(b.next());
		expect(a.next()).toBe(b.next());
	});

	it('different seeds produce different sequences', () => {
		const a = createGameRNG(1);
		const b = createGameRNG(2);
		expect(a.next()).not.toBe(b.next());
	});

	it('next() returns values in [0, 1)', () => {
		const rng = createGameRNG(123);
		for (let i = 0; i < 100; i++) {
			const v = rng.next();
			expect(v).toBeGreaterThanOrEqual(0);
			expect(v).toBeLessThan(1);
		}
	});

	it('range() stays within bounds', () => {
		const rng = createGameRNG(456);
		for (let i = 0; i < 100; i++) {
			const v = rng.range(10, 20);
			expect(v).toBeGreaterThanOrEqual(10);
			expect(v).toBeLessThan(20);
		}
	});

	it('chance(0) always returns false', () => {
		const rng = createGameRNG(789);
		for (let i = 0; i < 50; i++) {
			expect(rng.chance(0)).toBe(false);
		}
	});

	it('chance(1) always returns true', () => {
		const rng = createGameRNG(101);
		for (let i = 0; i < 50; i++) {
			expect(rng.chance(1)).toBe(true);
		}
	});

	it('chance(0.5) produces both true and false over many rolls', () => {
		const rng = createGameRNG(202);
		const results = Array.from({ length: 200 }, () => rng.chance(0.5));
		expect(results.some(r => r === true)).toBe(true);
		expect(results.some(r => r === false)).toBe(true);
	});
});

describe('hashString', () => {
	it('same string produces same hash', () => {
		expect(hashString('test')).toBe(hashString('test'));
	});

	it('different strings produce different hashes', () => {
		expect(hashString('agent-elena')).not.toBe(hashString('agent-marcus'));
	});

	it('empty string returns a stable value', () => {
		expect(hashString('')).toBe(0);
	});
});
