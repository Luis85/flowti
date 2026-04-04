import { describe, it, expect } from 'vitest';
import { createWorkingMemory } from '../../../src/infrastructure/entity/bt-working-memory.js';

describe('createWorkingMemory', () => {
	it('initializes all fields to defaults', () => {
		const mem = createWorkingMemory(10);
		expect(mem.movementTarget).toBeNull();
		expect(mem.journey).toBeNull();
		expect(mem.atLocation).toBeNull();
		expect(mem.currentRegion).toBe('');
		expect(mem.haulCargo).toBeNull();
		expect(mem.socialCooldowns.size).toBe(0);
		expect(mem.committedAction).toBeNull();
		expect(mem.btAction).toBeNull();
		expect(mem.gossipPending).toBeNull();
		expect(mem.knownLocations).toEqual([]);
		expect(mem.traitModifiers).toBeNull();
		expect(mem.skills).toEqual([]);
		expect(mem.feedingAt).toBeNull();
		expect(mem.restingAt).toBeNull();
		expect(mem.arrivalSlot).toBeNull();
		expect(mem.buyTargetItem).toBeNull();
		expect(mem.unemployedTicks).toBe(0);
		expect(mem.recovering).toBe(false);
	});

	it('creates priceMemories with given capacity', () => {
		const mem = createWorkingMemory(5);
		expect(mem.priceMemories.capacity).toBe(5);
	});
});

describe('recordPriceObservation', () => {
	it('adds observation to priceMemories buffer', () => {
		const mem = createWorkingMemory(10);
		mem.recordPriceObservation('food', 3, 'loc-market', 100);
		expect(mem.priceMemories.size).toBe(1);
	});

	it('evicts oldest when buffer full', () => {
		const mem = createWorkingMemory(2);
		mem.recordPriceObservation('food', 3, 'loc-a', 1);
		mem.recordPriceObservation('food', 4, 'loc-b', 2);
		mem.recordPriceObservation('food', 5, 'loc-c', 3);
		expect(mem.priceMemories.size).toBe(2);
	});
});
