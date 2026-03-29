import { describe, it, expect } from 'vitest';
import { applyFeed } from '../../../src/domain/systems/feed.js';

describe('applyFeed', () => {
	it('recovers hunger at configured rate', () => {
		const result = applyFeed({ currentHunger: 50 }, { recovery_rate: 1.5 });
		expect(result.newHunger).toBe(51.5);
		expect(result.recovered).toBe(1.5);
	});

	it('clamps hunger to 100', () => {
		const result = applyFeed({ currentHunger: 99.5 }, { recovery_rate: 1.5 });
		expect(result.newHunger).toBe(100);
	});

	it('does not recover past 100', () => {
		const result = applyFeed({ currentHunger: 100 }, { recovery_rate: 1.5 });
		expect(result.recovered).toBe(0);
	});
});
