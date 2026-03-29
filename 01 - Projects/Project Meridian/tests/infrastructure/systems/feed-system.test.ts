import { describe, it, expect } from 'vitest';
import { createFeedSystem } from '../../../src/infrastructure/systems/feed-system.js';
import { AgentActor } from '../../../src/infrastructure/entity/agent-actor.js';
import { NeedsComponent } from '../../../src/infrastructure/components/needs-component.js';
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

function createFoodLocation(id: string, x: number, y: number): WorldLocation {
	return { id, name: id, type: 'food', position: { x, y, region: 'test' }, capacity: 10, color: '#808080' };
}

function createDeps(eventBus = createEventBus(), tickCount = 1): GameCoreDeps {
	return {
		logger: { debug() {}, info() {}, warn() {}, error() {} },
		eventBus,
		config: GameConfigSchema.parse({}),
		performanceTracker: createPerformanceTracker(),
		tickCount,
	};
}

describe('FeedSystem', () => {
	it('applies food recovery when agent is at food location and emits FeedStarted', () => {
		const eventBus = createEventBus();
		const events: GameEvent[] = [];
		eventBus.on('FeedStarted', (e) => { events.push(e); });

		const agent = new AgentActor(createTestAgentData('agent-1', 300, 200), defaultMoodConfig);
		const foodLoc = createFoodLocation('loc-tavern', 300, 200);

		const system = createFeedSystem(() => [agent], () => [foodLoc]);
		system.execute(createDeps(eventBus));

		const needs = agent.get(NeedsComponent);
		// food_recovery_rate = 1.5, starting hunger = 50
		expect(needs.state.hunger).toBeCloseTo(51.5);

		expect(events.length).toBe(1);
		expect(events[0]?.payload.agentId).toBe('agent-1');
		expect(events[0]?.payload.locationId).toBe('loc-tavern');
	});

	it('skips agent when no food location is nearby', () => {
		const eventBus = createEventBus();
		const events: GameEvent[] = [];
		eventBus.on('FeedStarted', (e) => { events.push(e); });

		const agent = new AgentActor(createTestAgentData('agent-1', 0, 0), defaultMoodConfig);

		const system = createFeedSystem(() => [agent], () => []);
		system.execute(createDeps(eventBus));

		const needs = agent.get(NeedsComponent);
		expect(needs.state.hunger).toBe(50);
		expect(events.length).toBe(0);
	});

	it('does not emit FeedStarted on second tick at same food location', () => {
		const eventBus = createEventBus();
		const events: GameEvent[] = [];
		eventBus.on('FeedStarted', (e) => { events.push(e); });

		const agent = new AgentActor(createTestAgentData('agent-1', 300, 200), defaultMoodConfig);
		const foodLoc = createFoodLocation('loc-tavern', 300, 200);

		const system = createFeedSystem(() => [agent], () => [foodLoc]);

		// First tick — event emitted
		system.execute(createDeps(eventBus, 1));
		expect(events.length).toBe(1);

		// Second tick — no new event
		system.execute(createDeps(eventBus, 2));
		expect(events.length).toBe(1);

		// Hunger should have increased twice (1.5 each tick)
		const needs = agent.get(NeedsComponent);
		expect(needs.state.hunger).toBeCloseTo(53.0);
	});

	it('clamps hunger to 100', () => {
		const eventBus = createEventBus();
		const agent = new AgentActor(
			createTestAgentData('agent-1', 300, 200, { needs: { hunger: 99.5, energy: 50, social: 50 } }),
			defaultMoodConfig,
		);
		const foodLoc = createFoodLocation('loc-tavern', 300, 200);

		const system = createFeedSystem(() => [agent], () => [foodLoc]);
		system.execute(createDeps(eventBus));

		const needs = agent.get(NeedsComponent);
		// 99.5 + 1.5 = 101 → clamped to 100
		expect(needs.state.hunger).toBe(100);
	});
});
