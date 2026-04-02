import { describe, it, expect } from 'vitest';
import { CircularBuffer } from 'mnemonist';
import {
	isPriceStale,
	getRememberedPrice,
	getBestKnownSource,
	type PriceMemory,
} from '../../../src/domain/systems/price-memory.js';

function makeMemory(overrides: Partial<PriceMemory> = {}): PriceMemory {
	return { itemId: 'bread', price: 5, locationId: 'bakery', tick: 100, ...overrides };
}

function bufferWith(...memories: PriceMemory[]): CircularBuffer<PriceMemory> {
	const buf = new CircularBuffer<PriceMemory>(Array, 20);
	for (const m of memories) buf.push(m);
	return buf;
}

describe('isPriceStale', () => {
	it('returns false for fresh memory', () => {
		expect(isPriceStale(makeMemory({ tick: 100 }), 150, 200)).toBe(false);
	});

	it('returns true for old memory', () => {
		expect(isPriceStale(makeMemory({ tick: 100 }), 350, 200)).toBe(true);
	});

	it('returns false at exact boundary', () => {
		expect(isPriceStale(makeMemory({ tick: 100 }), 300, 200)).toBe(false);
	});

	it('returns true one tick past boundary', () => {
		expect(isPriceStale(makeMemory({ tick: 100 }), 301, 200)).toBe(true);
	});
});

describe('getRememberedPrice', () => {
	it('returns null for empty buffer', () => {
		const buf = bufferWith();
		expect(getRememberedPrice(buf, 'bread', 100, 200)).toBeNull();
	});

	it('returns null when all memories are stale', () => {
		const buf = bufferWith(makeMemory({ tick: 10 }));
		expect(getRememberedPrice(buf, 'bread', 500, 200)).toBeNull();
	});

	it('returns null for unknown item', () => {
		const buf = bufferWith(makeMemory({ itemId: 'wheat' }));
		expect(getRememberedPrice(buf, 'bread', 150, 200)).toBeNull();
	});

	it('returns freshest non-stale memory', () => {
		const buf = bufferWith(
			makeMemory({ tick: 80, price: 4 }),
			makeMemory({ tick: 120, price: 6 }),
		);
		const result = getRememberedPrice(buf, 'bread', 150, 200);
		expect(result?.price).toBe(6);
		expect(result?.tick).toBe(120);
	});

	it('skips stale entries and returns fresh one', () => {
		const buf = bufferWith(
			makeMemory({ tick: 10, price: 3 }),
			makeMemory({ tick: 120, price: 7 }),
		);
		const result = getRememberedPrice(buf, 'bread', 250, 200);
		expect(result?.price).toBe(7);
	});
});

describe('getBestKnownSource', () => {
	it('returns null for empty buffer', () => {
		const buf = bufferWith();
		expect(getBestKnownSource(buf, 'bread', 100, 200)).toBeNull();
	});

	it('returns cheapest non-stale source', () => {
		const buf = bufferWith(
			makeMemory({ locationId: 'bakery', price: 8, tick: 100 }),
			makeMemory({ locationId: 'market', price: 5, tick: 110 }),
		);
		expect(getBestKnownSource(buf, 'bread', 150, 200)).toBe('market');
	});

	it('ignores stale sources', () => {
		const buf = bufferWith(
			makeMemory({ locationId: 'bakery', price: 2, tick: 10 }),
			makeMemory({ locationId: 'market', price: 8, tick: 120 }),
		);
		expect(getBestKnownSource(buf, 'bread', 250, 200)).toBe('market');
	});

	it('evicts oldest memory when buffer is full', () => {
		const small = new CircularBuffer<PriceMemory>(Array, 3);
		small.push(makeMemory({ locationId: 'a', price: 1, tick: 10 }));
		small.push(makeMemory({ locationId: 'b', price: 2, tick: 20 }));
		small.push(makeMemory({ locationId: 'c', price: 3, tick: 30 }));
		small.push(makeMemory({ locationId: 'd', price: 0.5, tick: 40 }));
		// 'a' was evicted, 'd' is cheapest
		expect(getBestKnownSource(small, 'bread', 50, 200)).toBe('d');
		expect(small.size).toBe(3);
	});
});
