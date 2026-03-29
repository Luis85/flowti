import { describe, it, expect } from 'vitest';
import { createMoodSystem } from '../../../src/infrastructure/systems/mood-system.js';
import { AgentActor } from '../../../src/infrastructure/entity/agent-actor.js';
import { MoodComponent } from '../../../src/infrastructure/components/mood-component.js';
import { GameConfigSchema } from '../../../src/domain/schemas/game-config-schema.js';
import { createPerformanceTracker } from '../../../src/infrastructure/performance/performance-tracker.js';
import { createEventBus } from '../../../src/infrastructure/event-bus.js';
import type { GameCoreDeps } from '../../../src/domain/core/game-deps.js';
import type { GameEvent } from '../../../src/domain/core/events.js';

function createTestAgent(overrides: Record<string, unknown> = {}) {
	return {
		id: 'agent-test', name: 'Test', kind: 'merchant',
		attributes: { ST: 10, DX: 10, IQ: 10, HT: 10 },
		social: { status: 0, reputation: 0, charisma: 10 },
		needs: { hunger: 80, energy: 90, social: 70 },
		mood: 0, memory: [], goals: [], skills: [], inventory: [],
		equipment: { head: null, body: null, hands: null, tool: null, accessory: null },
		traits: [], wallet: { gold: 50 }, xp: 0, level: 1,
		position: { x: 0, y: 0, region: 'test' }, relationships: '',
		tools: [], color: '#b0b0b0', behavior_tree: 'bt/test.md', job: null, property: [],
		...overrides,
	};
}

const defaultMoodConfig = {
	factor_weights: { needs: 30, positive_memories: 20, negative_memories: 20, goal_progress: 10, wallet: 10, equipment: 5, relationships: 5 },
	buckets: [
		{ name: 'elated', min: 60, max: 100 },
		{ name: 'content', min: 20, max: 59 },
		{ name: 'stressed', min: -19, max: 19 },
		{ name: 'distressed', min: -59, max: -20 },
		{ name: 'breakdown', min: -100, max: -60 },
	],
	external_modifier_cap: 30,
};

function createDeps(eventBus = createEventBus()): GameCoreDeps {
	return {
		logger: { debug() {}, info() {}, warn() {}, error() {} },
		eventBus,
		config: GameConfigSchema.parse({}),
		performanceTracker: createPerformanceTracker(),
		tickCount: 100,
		writeFile: null,
	};
}

describe('MoodSystem', () => {
	it('reads components and calculates mood', () => {
		const agent = new AgentActor(createTestAgent(), defaultMoodConfig);
		const system = createMoodSystem(() => [agent]);
		system.execute(createDeps());

		const mood = agent.get(MoodComponent);
		expect(typeof mood.state.value).toBe('number');
		expect(mood.state.value).not.toBeNaN();
		expect(mood.state.bucket).toMatch(/^(elated|content|stressed|distressed|breakdown)$/);
		expect(mood.dirty).toBe(true);
	});

	it('emits MoodChanged on bucket transition', () => {
		const eventBus = createEventBus();
		const events: GameEvent[] = [];
		eventBus.on('MoodChanged', (e) => { events.push(e); });

		const agent = new AgentActor(createTestAgent(), defaultMoodConfig);
		const prevBucket = agent.get(MoodComponent).state.bucket;

		// Manually set a different bucket to force a transition
		agent.get(MoodComponent).state.bucket = prevBucket === 'content' ? 'stressed' : 'content';

		const system = createMoodSystem(() => [agent]);
		system.execute(createDeps(eventBus));

		expect(events.length).toBeGreaterThan(0);
		expect(events[0]?.payload.agentId).toBe('agent-test');
	});

	it('emits MoodBreakdown when entering breakdown', () => {
		const eventBus = createEventBus();
		const breakdowns: GameEvent[] = [];
		eventBus.on('MoodBreakdown', (e) => { breakdowns.push(e); });

		// Agent with zero needs → mood should be very low
		const agent = new AgentActor(
			createTestAgent({ needs: { hunger: 0, energy: 0, social: 0 } }),
			defaultMoodConfig,
		);
		// Force previous bucket to something other than breakdown
		agent.get(MoodComponent).state.bucket = 'content';

		const system = createMoodSystem(() => [agent]);
		system.execute(createDeps(eventBus));

		expect(breakdowns.length).toBeGreaterThan(0);
	});

	it('does not re-emit MoodBreakdown when already in breakdown', () => {
		const eventBus = createEventBus();
		const breakdowns: GameEvent[] = [];
		eventBus.on('MoodBreakdown', (e) => { breakdowns.push(e); });

		const agent = new AgentActor(
			createTestAgent({ needs: { hunger: 0, energy: 0, social: 0 } }),
			defaultMoodConfig,
		);
		// Agent is already in breakdown — no transition should occur
		agent.get(MoodComponent).state.bucket = 'breakdown';

		const system = createMoodSystem(() => [agent]);
		system.execute(createDeps(eventBus));

		expect(breakdowns).toHaveLength(0);
	});
});
