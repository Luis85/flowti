import { describe, it, expect } from 'vitest';
import { findNearest } from '../../../src/domain/core/array-utils.js';

describe('findNearest', () => {
	it('returns null for empty array', () => {
		expect(findNearest([])).toBeNull();
	});

	it('returns the only item', () => {
		const items = [{ id: 'a', distance: 5 }];
		expect(findNearest(items)).toEqual({ id: 'a', distance: 5 });
	});

	it('returns closest of multiple items', () => {
		const items = [
			{ id: 'far', distance: 100 },
			{ id: 'near', distance: 3 },
			{ id: 'mid', distance: 50 },
		];
		expect(findNearest(items)?.id).toBe('near');
	});

	it('preserves all properties on returned item', () => {
		const items = [{ id: 'a', distance: 1, extra: 'data' }];
		expect(findNearest(items)).toEqual({ id: 'a', distance: 1, extra: 'data' });
	});
});
