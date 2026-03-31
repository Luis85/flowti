import { describe, it, expect } from 'vitest';
import { exchangeGossip, parseGossipData } from '../../../src/domain/systems/gossip.js';
import type { GossipData, GossipExchangeInput, LocationGossip, ReputationGossip } from '../../../src/domain/systems/gossip.js';
import type { MemoryEntry } from '../../../src/domain/core/component-data.js';

const defaultTiers = [1.0, 0.7, 0.5, 0.3];

function makeLocationGossip(overrides: Partial<LocationGossip> = {}): LocationGossip {
	return {
		gossipType: 'location',
		locationId: 'loc-bakery',
		locationType: 'work',
		position: { x: 100, y: 200 },
		reliability: 1.0,
		sourceAgentId: 'agent-elena',
		hopCount: 0,
		...overrides,
	};
}

function makeReputationGossip(overrides: Partial<ReputationGossip> = {}): ReputationGossip {
	return {
		gossipType: 'reputation',
		subjectAgentId: 'agent-marcus',
		dispositionBias: 5,
		reliability: 1.0,
		sourceAgentId: 'agent-elena',
		hopCount: 0,
		...overrides,
	};
}

function makeGossipMemory(data: GossipData, significance = 5): MemoryEntry {
	return {
		tick: 100,
		type: 'gossip',
		description: 'gossip entry',
		participants: [data.sourceAgentId],
		outcome: 'neutral',
		significance,
		mood_impact: 0,
		metadata: { ...data },
	};
}

function baseInput(overrides: Partial<GossipExchangeInput> = {}): GossipExchangeInput {
	return {
		giverGossip: [],
		receiverGossip: [],
		receiverIQ: 10,
		reliabilityTiers: defaultTiers,
		iqFilterThreshold: 12,
		minReliability: 0.3,
		maxItemsPerExchange: 2,
		currentTick: 200,
		...overrides,
	};
}

describe('exchangeGossip', () => {
	it('degrades reliability: hopCount 0 → 1 gives reliability 0.7', () => {
		const data = makeLocationGossip({ hopCount: 0 });
		const result = exchangeGossip(baseInput({
			giverGossip: [{ memory: makeGossipMemory(data), data }],
		}));

		expect(result.transferred.length).toBe(1);
		const meta = result.transferred[0]!.memory.metadata as Record<string, unknown>;
		expect(meta['reliability']).toBe(0.7);
		expect(meta['hopCount']).toBe(1);
	});

	it('hopCount 2 transfers at last valid tier (reliability 0.3)', () => {
		// giverGossip with hopCount 2, default tiers [1.0, 0.7, 0.5, 0.3]
		// newHopCount = 3, tiers[3] = 0.3 → should transfer (last valid index)
		const data = makeLocationGossip({ hopCount: 2 });
		const result = exchangeGossip(baseInput({
			giverGossip: [{ memory: makeGossipMemory(data), data }],
		}));

		expect(result.transferred.length).toBe(1);
		const meta = result.transferred[0]!.memory.metadata as Record<string, unknown>;
		expect(meta['reliability']).toBe(0.3);
		expect(meta['hopCount']).toBe(3);
	});

	it('skips gossip when hop limit exceeded (hopCount 3 → 4 exceeds tiers length)', () => {
		const data = makeLocationGossip({ hopCount: 3 });
		const result = exchangeGossip(baseInput({
			giverGossip: [{ memory: makeGossipMemory(data), data }],
		}));

		expect(result.transferred.length).toBe(0);
	});

	it('IQ filtering: receiver IQ >= 12 rejects reliability < 0.3', () => {
		const data = makeLocationGossip({ hopCount: 2 });
		// tiers[3] = 0.3, but minReliability is 0.3 so that is equal — not less than.
		// Use tiers that produce a value below minReliability.
		const result = exchangeGossip(baseInput({
			giverGossip: [{ memory: makeGossipMemory(data), data }],
			reliabilityTiers: [1.0, 0.7, 0.5, 0.2],
			receiverIQ: 12,
			minReliability: 0.3,
		}));

		expect(result.transferred.length).toBe(0);
	});

	it('IQ bypass: receiver IQ < 12 accepts low reliability', () => {
		const data = makeLocationGossip({ hopCount: 2 });
		const result = exchangeGossip(baseInput({
			giverGossip: [{ memory: makeGossipMemory(data), data }],
			reliabilityTiers: [1.0, 0.7, 0.5, 0.2],
			receiverIQ: 8,
			minReliability: 0.3,
		}));

		expect(result.transferred.length).toBe(1);
	});

	it('skips duplicate location gossip (same locationId in receiver)', () => {
		const giverData = makeLocationGossip({ locationId: 'loc-bakery', hopCount: 0 });
		const receiverData = makeLocationGossip({ locationId: 'loc-bakery', hopCount: 1 });
		const result = exchangeGossip(baseInput({
			giverGossip: [{ memory: makeGossipMemory(giverData), data: giverData }],
			receiverGossip: [{ memory: makeGossipMemory(receiverData), data: receiverData }],
		}));

		expect(result.transferred.length).toBe(0);
	});

	it('skips duplicate reputation gossip (same subjectAgentId in receiver)', () => {
		const giverData = makeReputationGossip({ subjectAgentId: 'agent-marcus', hopCount: 0 });
		const receiverData = makeReputationGossip({ subjectAgentId: 'agent-marcus', hopCount: 1 });
		const result = exchangeGossip(baseInput({
			giverGossip: [{ memory: makeGossipMemory(giverData), data: giverData }],
			receiverGossip: [{ memory: makeGossipMemory(receiverData), data: receiverData }],
		}));

		expect(result.transferred.length).toBe(0);
	});

	it('max items per exchange: only top 2 by significance transferred', () => {
		const data1 = makeLocationGossip({ locationId: 'loc-bakery', hopCount: 0 });
		const data2 = makeLocationGossip({ locationId: 'loc-inn', hopCount: 0 });
		const data3 = makeLocationGossip({ locationId: 'loc-market', hopCount: 0 });
		const result = exchangeGossip(baseInput({
			giverGossip: [
				{ memory: makeGossipMemory(data1, 10), data: data1 },
				{ memory: makeGossipMemory(data2, 8), data: data2 },
				{ memory: makeGossipMemory(data3, 6), data: data3 },
			],
			maxItemsPerExchange: 2,
		}));

		expect(result.transferred.length).toBe(2);

		// Verify the two highest-significance items were selected (bakery=10, inn=8)
		const transferredLocationIds = result.transferred.map(
			t => (t.memory.metadata as Record<string, unknown>)['locationId'],
		);
		expect(transferredLocationIds).toContain('loc-bakery');
		expect(transferredLocationIds).toContain('loc-inn');
		expect(transferredLocationIds).not.toContain('loc-market');
	});

	it('reputation disposition change: dispositionBias * newReliability', () => {
		const data = makeReputationGossip({ dispositionBias: 5, hopCount: 0 });
		const result = exchangeGossip(baseInput({
			giverGossip: [{ memory: makeGossipMemory(data), data }],
		}));

		expect(result.transferred.length).toBe(1);
		expect(result.transferred[0]!.dispositionChanges.length).toBe(1);
		expect(result.transferred[0]!.dispositionChanges[0]!.agentId).toBe('agent-marcus');
		// dispositionBias(5) * reliability at hop 1 (0.7) = 3.5
		expect(result.transferred[0]!.dispositionChanges[0]!.change).toBeCloseTo(3.5);
	});

	it('returns empty result when giver has no gossip', () => {
		const result = exchangeGossip(baseInput({ giverGossip: [] }));
		expect(result.transferred.length).toBe(0);
	});

	it('location gossip creates valid MemoryEntry with metadata', () => {
		const data = makeLocationGossip({ hopCount: 0, sourceAgentId: 'agent-elena' });
		const result = exchangeGossip(baseInput({
			giverGossip: [{ memory: makeGossipMemory(data), data }],
			currentTick: 300,
		}));

		expect(result.transferred.length).toBe(1);
		const mem = result.transferred[0]!.memory;
		expect(mem.tick).toBe(300);
		expect(mem.type).toBe('gossip');
		expect(mem.outcome).toBe('neutral');
		expect(mem.mood_impact).toBe(0);
		expect(mem.significance).toBeCloseTo(0.7 * 5);
		expect(mem.participants).toEqual(['agent-elena']);
		expect(mem.description).toContain('agent-elena');
		expect(mem.metadata).toBeDefined();
	});
});

describe('parseGossipData', () => {
	it('extracts location gossip from metadata', () => {
		const data = makeLocationGossip();
		const entry: MemoryEntry = makeGossipMemory(data);
		const parsed = parseGossipData(entry);

		expect(parsed).not.toBeNull();
		expect(parsed!.gossipType).toBe('location');
		if (parsed!.gossipType === 'location') {
			expect(parsed!.locationId).toBe('loc-bakery');
			expect(parsed!.locationType).toBe('work');
			expect(parsed!.position).toEqual({ x: 100, y: 200 });
		}
	});

	it('returns null for non-gossip entries', () => {
		const entry: MemoryEntry = {
			tick: 100,
			type: 'social',
			description: 'Talked with someone',
			participants: ['agent-marcus'],
			outcome: 'positive',
			significance: 3,
			mood_impact: 2,
		};
		expect(parseGossipData(entry)).toBeNull();
	});

	it('returns null for unknown gossipType', () => {
		const entry: MemoryEntry = {
			tick: 100,
			type: 'gossip',
			description: 'Some gossip',
			participants: ['agent-elena'],
			outcome: 'neutral',
			significance: 3,
			mood_impact: 0,
			metadata: {
				gossipType: 'unknown',
				sourceAgentId: 'agent-elena',
				hopCount: 0,
				reliability: 1.0,
			},
		};
		expect(parseGossipData(entry)).toBeNull();
	});

	it('returns null for location gossip missing locationId', () => {
		const entry: MemoryEntry = {
			tick: 100,
			type: 'gossip',
			description: 'Some gossip',
			participants: ['agent-elena'],
			outcome: 'neutral',
			significance: 3,
			mood_impact: 0,
			metadata: {
				gossipType: 'location',
				// locationId intentionally omitted
				locationType: 'work',
				position: { x: 100, y: 200 },
				reliability: 1.0,
				sourceAgentId: 'agent-elena',
				hopCount: 0,
			},
		};
		expect(parseGossipData(entry)).toBeNull();
	});
});
