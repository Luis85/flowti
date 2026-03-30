import { describe, it, expect } from 'vitest';
import type { RelationshipEntry, MemoryEntry } from '../../../src/domain/core/component-data.js';

describe('component-data types', () => {
	it('RelationshipEntry includes tags and lastInteractionTick', () => {
		const entry: RelationshipEntry = {
			agentId: 'agent-test',
			disposition: 10,
			familiarity: 5,
			tags: ['worked_with'],
			lastInteractionTick: 42,
		};
		expect(entry.tags).toEqual(['worked_with']);
		expect(entry.lastInteractionTick).toBe(42);
	});

	it('MemoryEntry includes optional metadata', () => {
		const entry: MemoryEntry = {
			tick: 1,
			type: 'social',
			description: 'test memory',
			participants: ['a', 'b'],
			outcome: 'positive',
			significance: 5,
			mood_impact: 2,
			metadata: { location: 'tavern', topic: 'weather' },
		};
		expect(entry.metadata).toEqual({ location: 'tavern', topic: 'weather' });
	});

	it('MemoryEntry metadata is optional (undefined when not set)', () => {
		const entry: MemoryEntry = {
			tick: 1,
			type: 'social',
			description: 'test memory',
			participants: ['a'],
			outcome: 'neutral',
			significance: 3,
			mood_impact: 0,
		};
		expect(entry.metadata).toBeUndefined();
	});
});
