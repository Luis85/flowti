import { describe, it, expect } from 'vitest';
import { createGossipSystem } from '../../../src/infrastructure/systems/gossip-system.js';
import { AgentActor } from '../../../src/infrastructure/entity/agent-actor.js';
import { BlackboardComponent } from '../../../src/infrastructure/components/blackboard-component.js';
import { MemoryComponent } from '../../../src/infrastructure/components/memory-component.js';
import { RelationshipComponent } from '../../../src/infrastructure/components/relationship-component.js';
import { AttributesComponent } from '../../../src/infrastructure/components/attributes-component.js';
import { GameConfigSchema } from '../../../src/domain/schemas/game-config-schema.js';
import { createPerformanceTracker } from '../../../src/infrastructure/performance/performance-tracker.js';
import { createEventBus } from '../../../src/infrastructure/event-bus.js';
import type { GameCoreDeps } from '../../../src/domain/core/game-deps.js';
import type { GameEvent } from '../../../src/domain/core/events.js';
import type { WorldLocation } from '../../../src/domain/schemas/location-schema.js';
import type { MemoryEntry } from '../../../src/domain/core/component-data.js';

const defaultMoodConfig = {
	factor_weights: { needs: 30, positive_memories: 20, negative_memories: 20, goal_progress: 10, wallet: 10, equipment: 5, relationships: 5 },
	buckets: [{ name: 'stressed', min: -100, max: 100 }],
	external_modifier_cap: 30,
};

function createTestAgentData(id: string, overrides: Record<string, unknown> = {}) {
	return {
		id,
		name: id,
		kind: 'merchant',
		attributes: { ST: 10, DX: 10, IQ: 10, HT: 10 },
		social: { status: 0, reputation: 0, charisma: 10 },
		needs: { hunger: 50, energy: 50, social: 50 },
		mood: 0,
		memory: [],
		goals: [],
		skills: [],
		inventory: [],
		equipment: { head: null, body: null, hands: null, tool: null, accessory: null },
		traits: [],
		wallet: { gold: 50 },
		xp: 0,
		level: 1,
		position: { x: 100, y: 100, region: 'test' },
		relationships: '',
		color: '#b0b0b0',
		persona: null,
		property: [],
		tools: [],
		behavior_tree: 'bt-merchant',
		job: null,
		...overrides,
	};
}

function createDeps(eventBus = createEventBus(), tickCount = 100): GameCoreDeps {
	return {
		logger: { debug() {}, info() {}, warn() {}, error() {} },
		eventBus,
		config: GameConfigSchema.parse({}),
		performanceTracker: createPerformanceTracker(),
		tickCount,
		writeFile: null,
	};
}

function createTestLocation(id: string, type: string, x: number, y: number): WorldLocation {
	return {
		id,
		name: id,
		type: type as 'rest' | 'food' | 'social' | 'work' | 'market',
		position: { x, y, region: 'test' },
		capacity: 10,
		color: '#808080',
		production: null,
		region: null,
	};
}

function makeGossipMemory(gossipType: string, extraMeta: Record<string, unknown> = {}): MemoryEntry {
	if (gossipType === 'location') {
		return {
			tick: 50,
			type: 'gossip',
			description: 'Heard about a location',
			participants: ['agent-someone'],
			outcome: 'neutral',
			significance: 3.5,
			mood_impact: 0,
			metadata: {
				gossipType: 'location',
				locationId: 'loc-tavern',
				locationType: 'social',
				position: { x: 200, y: 300 },
				reliability: 0.7,
				sourceAgentId: 'agent-someone',
				hopCount: 1,
				...extraMeta,
			},
		};
	}
	return {
		tick: 50,
		type: 'gossip',
		description: 'Heard about reputation',
		participants: ['agent-someone'],
		outcome: 'neutral',
		significance: 3.5,
		mood_impact: 0,
		metadata: {
			gossipType: 'reputation',
			subjectAgentId: 'agent-target',
			dispositionBias: 5,
			reliability: 0.7,
			sourceAgentId: 'agent-someone',
			hopCount: 1,
			...extraMeta,
		},
	};
}

function setupGossipPair(opts: {
	agent1GossipMemories?: MemoryEntry[];
	agent2GossipMemories?: MemoryEntry[];
	agent1KnownLocations?: string[];
	agent2KnownLocations?: string[];
	agent1IQ?: number;
	agent2IQ?: number;
} = {}) {
	const {
		agent1GossipMemories = [],
		agent2GossipMemories = [],
		agent1KnownLocations = [],
		agent2KnownLocations = [],
		agent1IQ = 10,
		agent2IQ = 10,
	} = opts;

	const agent1 = new AgentActor(
		createTestAgentData('agent-elena', { attributes: { ST: 10, DX: 10, IQ: agent1IQ, HT: 10 } }),
		defaultMoodConfig,
	);
	const agent2 = new AgentActor(
		createTestAgentData('agent-marcus', { attributes: { ST: 10, DX: 10, IQ: agent2IQ, HT: 10 } }),
		defaultMoodConfig,
	);

	// Pre-populate gossip memories
	if (agent1GossipMemories.length > 0) {
		const mem1 = agent1.get(MemoryComponent);
		mem1.state = { ...mem1.state, entries: [...agent1GossipMemories] };
	}
	if (agent2GossipMemories.length > 0) {
		const mem2 = agent2.get(MemoryComponent);
		mem2.state = { ...mem2.state, entries: [...agent2GossipMemories] };
	}

	// Set gossipPending on both agents (bidirectional)
	const bb1 = agent1.get(BlackboardComponent);
	bb1.state = {
		...bb1.state,
		gossipPending: 'agent-marcus',
		knownLocations: agent1KnownLocations,
	};

	const bb2 = agent2.get(BlackboardComponent);
	bb2.state = {
		...bb2.state,
		gossipPending: 'agent-elena',
		knownLocations: agent2KnownLocations,
	};

	return { agent1, agent2 };
}

describe('GossipSystem', () => {
	it('processes agents with gossipPending flag', () => {
		const eventBus = createEventBus();
		const events: GameEvent[] = [];
		eventBus.on('GossipExchanged', (e) => { events.push(e); });

		const { agent1, agent2 } = setupGossipPair({
			agent1KnownLocations: ['loc-bakery'],
		});

		const bakery = createTestLocation('loc-bakery', 'work', 100, 200);
		const system = createGossipSystem(() => [agent1, agent2], () => [bakery]);
		system.execute(createDeps(eventBus, 100));

		expect(events.length).toBe(1);
		expect(events[0]!.payload.agentAId).toBe('agent-elena');
		expect(events[0]!.payload.agentBId).toBe('agent-marcus');
	});

	it('bidirectional: transfers gossip both ways', () => {
		const eventBus = createEventBus();
		const events: GameEvent[] = [];
		eventBus.on('GossipExchanged', (e) => { events.push(e); });

		const { agent1, agent2 } = setupGossipPair({
			agent1KnownLocations: ['loc-bakery'],
			agent2KnownLocations: ['loc-inn'],
		});

		const bakery = createTestLocation('loc-bakery', 'work', 100, 200);
		const inn = createTestLocation('loc-inn', 'rest', 300, 400);

		const system = createGossipSystem(() => [agent1, agent2], () => [bakery, inn]);
		system.execute(createDeps(eventBus, 100));

		expect(events.length).toBe(1);
		// A→B should transfer bakery, B→A should transfer inn
		const aToB = events[0]!.payload.aToB as number;
		const bToA = events[0]!.payload.bToA as number;
		expect(aToB).toBeGreaterThan(0);
		expect(bToA).toBeGreaterThan(0);
	});

	it('writes gossip to receiver MemoryComponent', () => {
		const { agent1, agent2 } = setupGossipPair({
			agent1KnownLocations: ['loc-bakery'],
		});

		const bakery = createTestLocation('loc-bakery', 'work', 100, 200);
		const system = createGossipSystem(() => [agent1, agent2], () => [bakery]);
		system.execute(createDeps(createEventBus(), 100));

		// Partner (agent2) should have received gossip about bakery
		const partnerEntries = agent2.get(MemoryComponent).state.entries;
		const gossipEntries = partnerEntries.filter(e => e.type === 'gossip');
		expect(gossipEntries.length).toBeGreaterThan(0);
		const meta = gossipEntries[0]!.metadata as Record<string, unknown>;
		expect(meta['locationId']).toBe('loc-bakery');
	});

	it('applies reputation disposition changes', () => {
		const reputationGossip = makeGossipMemory('reputation', {
			subjectAgentId: 'agent-target',
			dispositionBias: 5,
			reliability: 1.0,
			sourceAgentId: 'agent-elena',
			hopCount: 0,
		});

		const { agent1, agent2 } = setupGossipPair({
			agent1GossipMemories: [reputationGossip],
		});

		const system = createGossipSystem(() => [agent1, agent2], () => []);
		system.execute(createDeps(createEventBus(), 100));

		// Partner should have a relationship entry for the gossip subject
		const partnerRels = agent2.get(RelationshipComponent).state.entries;
		const targetRel = partnerRels.find(e => e.agentId === 'agent-target');
		expect(targetRel).toBeDefined();
		expect(targetRel!.tags).toContain('gossiped_about');
		expect(targetRel!.disposition).toBeGreaterThan(0);
	});

	it('clears gossipPending on both agents', () => {
		const { agent1, agent2 } = setupGossipPair({
			agent1KnownLocations: ['loc-bakery'],
		});

		const bakery = createTestLocation('loc-bakery', 'work', 100, 200);
		const system = createGossipSystem(() => [agent1, agent2], () => [bakery]);
		system.execute(createDeps(createEventBus(), 100));

		expect(agent1.get(BlackboardComponent).state.gossipPending).toBeUndefined();
		expect(agent2.get(BlackboardComponent).state.gossipPending).toBeUndefined();
	});

	it('emits GossipExchanged event', () => {
		const eventBus = createEventBus();
		const events: GameEvent[] = [];
		eventBus.on('GossipExchanged', (e) => { events.push(e); });

		const { agent1, agent2 } = setupGossipPair({
			agent1KnownLocations: ['loc-bakery'],
		});

		const bakery = createTestLocation('loc-bakery', 'work', 100, 200);
		const system = createGossipSystem(() => [agent1, agent2], () => [bakery]);
		system.execute(createDeps(eventBus, 100));

		expect(events.length).toBe(1);
		expect(events[0]!.type).toBe('GossipExchanged');
		expect(events[0]!.source).toBe('GossipSystem');
		expect(events[0]!.payload.types).toContain('location');
	});

	it('builds first-hand location gossip from knownLocations', () => {
		const { agent1, agent2 } = setupGossipPair({
			agent1KnownLocations: ['loc-bakery', 'loc-inn'],
		});

		const bakery = createTestLocation('loc-bakery', 'work', 100, 200);
		const inn = createTestLocation('loc-inn', 'rest', 300, 400);

		const system = createGossipSystem(() => [agent1, agent2], () => [bakery, inn]);
		system.execute(createDeps(createEventBus(), 100));

		// Partner should have received location gossip (up to max_items_per_exchange = 2)
		const partnerEntries = agent2.get(MemoryComponent).state.entries;
		const gossipEntries = partnerEntries.filter(e => e.type === 'gossip');
		expect(gossipEntries.length).toBe(2);
	});

	it('uses processedPairs to avoid double-processing', () => {
		const eventBus = createEventBus();
		const events: GameEvent[] = [];
		eventBus.on('GossipExchanged', (e) => { events.push(e); });

		const { agent1, agent2 } = setupGossipPair({
			agent1KnownLocations: ['loc-bakery'],
		});

		const bakery = createTestLocation('loc-bakery', 'work', 100, 200);

		// Both agents have gossipPending pointing at each other — should only process once
		const system = createGossipSystem(() => [agent1, agent2], () => [bakery]);
		system.execute(createDeps(eventBus, 100));

		// Only ONE GossipExchanged event — pair deduplication prevents double-processing
		expect(events.length).toBe(1);
	});
});
