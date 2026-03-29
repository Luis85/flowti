import { describe, it, expect } from 'vitest';
import { createRestSystem } from '../../../src/infrastructure/systems/rest-system.js';
import { AgentActor } from '../../../src/infrastructure/entity/agent-actor.js';
import { NeedsComponent } from '../../../src/infrastructure/components/needs-component.js';
import { BlackboardComponent } from '../../../src/infrastructure/components/blackboard-component.js';
import { GameConfigSchema } from '../../../src/domain/schemas/game-config-schema.js';
import { createPerformanceTracker } from '../../../src/infrastructure/performance/performance-tracker.js';
import { createEventBus } from '../../../src/infrastructure/event-bus.js';
import type { GameCoreDeps } from '../../../src/domain/core/game-deps.js';
import type { GameEvent } from '../../../src/domain/core/events.js';
import type { WorldLocation } from '../../../src/domain/schemas/location-schema.js';

const defaultMoodConfig = {
	factor_weights: { needs: 30, positive_memories: 20, negative_memories: 20, goal_progress: 10, wallet: 10, equipment: 5, relationships: 5 },
	buckets: [{ name: 'stressed', min: -100, max: 100 }],
	external_modifier_cap: 30,
};

function createTestAgentData(id: string, x = 0, y = 0, overrides: Record<string, unknown> = {}) {
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
		position: { x, y, region: 'test' },
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

function createRestLocation(id: string, x: number, y: number): WorldLocation {
	return { id, name: id, type: 'rest', position: { x, y, region: 'test' }, capacity: 8, color: '#6a5acd' };
}

function createDeps(eventBus = createEventBus(), tickCount = 1): GameCoreDeps {
	return {
		logger: { debug() {}, info() {}, warn() {}, error() {} },
		eventBus,
		config: GameConfigSchema.parse({}),
		performanceTracker: createPerformanceTracker(),
		tickCount,
		writeFile: null,
	};
}

describe('RestSystem', () => {
	it('applies public_shelter recovery when agent is at unowned rest location', () => {
		const eventBus = createEventBus();
		const events: GameEvent[] = [];
		eventBus.on('RestStarted', (e) => { events.push(e); });

		const agent = new AgentActor(createTestAgentData('agent-1', 300, 200), defaultMoodConfig);
		const restLoc = createRestLocation('loc-tavern', 300, 200);

		const system = createRestSystem(() => [agent], () => [restLoc]);
		system.execute(createDeps(eventBus));

		const needs = agent.get(NeedsComponent);
		// public_shelter recovery_rate = 1.5, starting energy = 50
		expect(needs.state.energy).toBeCloseTo(51.5);

		// RestStarted event should be emitted
		expect(events.length).toBe(1);
		expect(events[0]?.payload.agentId).toBe('agent-1');
		expect(events[0]?.payload.tier).toBe('public_shelter');
		expect(events[0]?.payload.locationId).toBe('loc-tavern');
	});

	it('applies owned_home recovery when agent owns the rest location', () => {
		const eventBus = createEventBus();
		const events: GameEvent[] = [];
		eventBus.on('RestStarted', (e) => { events.push(e); });

		const agent = new AgentActor(
			createTestAgentData('agent-1', 300, 200, { property: ['loc-tavern'] }),
			defaultMoodConfig,
		);
		const restLoc = createRestLocation('loc-tavern', 300, 200);

		const system = createRestSystem(() => [agent], () => [restLoc]);
		system.execute(createDeps(eventBus));

		const needs = agent.get(NeedsComponent);
		// owned_home recovery_rate = 2.0, starting energy = 50
		expect(needs.state.energy).toBeCloseTo(52.0);

		expect(events.length).toBe(1);
		expect(events[0]?.payload.tier).toBe('owned_home');
	});

	it('applies outdoors recovery when agent is idle with no rest location nearby', () => {
		const eventBus = createEventBus();
		const events: GameEvent[] = [];
		eventBus.on('RestStarted', (e) => { events.push(e); });

		const agent = new AgentActor(createTestAgentData('agent-1', 0, 0), defaultMoodConfig);

		const system = createRestSystem(() => [agent], () => []);
		system.execute(createDeps(eventBus));

		const needs = agent.get(NeedsComponent);
		// outdoors recovery_rate = 1.0, starting energy = 50
		expect(needs.state.energy).toBeCloseTo(51.0);

		expect(events.length).toBe(1);
		expect(events[0]?.payload.tier).toBe('outdoors');
		expect(events[0]?.payload.locationId).toBeNull();
	});

	it('skips agent with non-idle btAction and no rest location nearby', () => {
		const eventBus = createEventBus();
		const events: GameEvent[] = [];
		eventBus.on('RestStarted', (e) => { events.push(e); });

		const agent = new AgentActor(createTestAgentData('agent-1', 0, 0), defaultMoodConfig);
		const bb = agent.get(BlackboardComponent);
		bb.state = { ...bb.state, btAction: 'seek_food' };

		const system = createRestSystem(() => [agent], () => []);
		system.execute(createDeps(eventBus));

		const needs = agent.get(NeedsComponent);
		// Energy should be unchanged
		expect(needs.state.energy).toBe(50);

		// No event emitted
		expect(events.length).toBe(0);
	});

	it('does not emit RestStarted on second tick at same location', () => {
		const eventBus = createEventBus();
		const events: GameEvent[] = [];
		eventBus.on('RestStarted', (e) => { events.push(e); });

		const agent = new AgentActor(createTestAgentData('agent-1', 300, 200), defaultMoodConfig);
		const restLoc = createRestLocation('loc-tavern', 300, 200);

		const system = createRestSystem(() => [agent], () => [restLoc]);

		// First tick — event emitted
		system.execute(createDeps(eventBus, 1));
		expect(events.length).toBe(1);

		// Second tick — no new event
		system.execute(createDeps(eventBus, 2));
		expect(events.length).toBe(1);

		// Energy should have increased twice (1.5 each tick)
		const needs = agent.get(NeedsComponent);
		expect(needs.state.energy).toBeCloseTo(53.0);
	});

	it('clears restingAt when agent leaves rest location and re-emits on return', () => {
		const eventBus = createEventBus();
		const events: GameEvent[] = [];
		eventBus.on('RestStarted', (e) => { events.push(e); });

		const agent = new AgentActor(createTestAgentData('agent-1', 200, 200), defaultMoodConfig);
		const bb = agent.get(BlackboardComponent);
		bb.state = { ...bb.state, btAction: 'seek_food' };

		const restLoc = createRestLocation('loc-tavern', 200, 200);
		const system = createRestSystem(() => [agent], () => [restLoc]);
		const deps = createDeps(eventBus);

		// Tick 1: agent at rest location — nearestRest found, btAction ignored
		system.execute(deps);
		expect(events.length).toBe(1);

		// Move agent away (outside interaction radius) — no rest location nearby + non-idle btAction → restTier null → restingAt cleared
		agent.pos.x = 500;
		agent.pos.y = 500;
		system.execute(deps);

		// Move agent back to rest location
		agent.pos.x = 200;
		agent.pos.y = 200;
		events.length = 0;
		system.execute(deps);
		// Should emit RestStarted again because restingAt was cleared
		expect(events.length).toBe(1);
	});

	it('emits RestStarted again when agent moves to a different rest location', () => {
		const eventBus = createEventBus();
		const events: GameEvent[] = [];
		eventBus.on('RestStarted', (e) => { events.push(e); });

		const agent = new AgentActor(createTestAgentData('agent-1', 300, 200), defaultMoodConfig);
		const restLoc1 = createRestLocation('loc-tavern', 300, 200);
		const restLoc2 = createRestLocation('loc-inn', 500, 500);

		const system1 = createRestSystem(() => [agent], () => [restLoc1]);
		system1.execute(createDeps(eventBus, 1));
		expect(events.length).toBe(1);
		expect(events[0]?.payload.locationId).toBe('loc-tavern');

		// Move agent to second location
		agent.pos.x = 500;
		agent.pos.y = 500;

		const system2 = createRestSystem(() => [agent], () => [restLoc2]);
		system2.execute(createDeps(eventBus, 2));
		expect(events.length).toBe(2);
		expect(events[1]?.payload.locationId).toBe('loc-inn');
	});
});
