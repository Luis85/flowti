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
		needs: { hunger: 80, energy: 90, social: 70, thirst: 80 },
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
		dataRoot: 'test-data',
		getRecipeRegistry: () => new Map(),
		getFacilityTypeRegistry: () => new Map(),
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

		// Agent with zero needs, zero gold, and negative memories → mood should be very low.
		// Negative memories are needed because the fixed-totalWeight formula uses a neutral
		// 0.5 baseline for positive memories when empty, preventing all-zero from reaching breakdown.
		const negativeMemories = Array.from({ length: 10 }, (_, i) => ({
			tick: 60 + i, type: 'bad_event', description: 'test',
			participants: [], outcome: 'negative' as const, significance: 1, mood_impact: -5,
		}));
		const agent = new AgentActor(
			createTestAgent({
				needs: { hunger: 0, energy: 0, social: 0, thirst: 0 },
				wallet: { gold: 0 },
				memory: negativeMemories,
			}),
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

		const negativeMemories = Array.from({ length: 10 }, (_, i) => ({
			tick: 60 + i, type: 'bad_event', description: 'test',
			participants: [], outcome: 'negative' as const, significance: 1, mood_impact: -5,
		}));
		const agent = new AgentActor(
			createTestAgent({
				needs: { hunger: 0, energy: 0, social: 0, thirst: 0 },
				wallet: { gold: 0 },
				memory: negativeMemories,
			}),
			defaultMoodConfig,
		);
		// Agent is already in breakdown — no transition should occur
		agent.get(MoodComponent).state.bucket = 'breakdown';

		const system = createMoodSystem(() => [agent]);
		system.execute(createDeps(eventBus));

		expect(breakdowns).toHaveLength(0);
	});

	describe('goalProgress mood factor', () => {
		it('defaults to 0.5 for unemployed agent (neutral)', () => {
			const agent = new AgentActor(createTestAgent({ job: null }), defaultMoodConfig);
			const employed = new AgentActor(
				createTestAgent({ id: 'employed', job: 'farmer', attributes: { ST: 10, DX: 10, IQ: 10, HT: 15 } }),
				defaultMoodConfig,
			);
			const system = createMoodSystem(() => [agent, employed]);
			const deps = createDeps();
			deps.config = GameConfigSchema.parse({
				jobs: { definitions: { farmer: { primary_attribute: 'HT', behavior_tree: 'bt-farmer' } } },
			});
			system.execute(deps);

			// Unemployed agent gets 0.5 goalProgress (neutral) — close to employed mood
			const unemployedMood = agent.get(MoodComponent).state.value;
			const employedMood = employed.get(MoodComponent).state.value;
			expect(employedMood).toBeGreaterThanOrEqual(unemployedMood);
		});

		it('returns higher value for agent with matching aptitude', () => {
			const goodFit = new AgentActor(
				createTestAgent({ id: 'good', job: 'farmer', attributes: { ST: 10, DX: 10, IQ: 10, HT: 18 } }),
				defaultMoodConfig,
			);
			const poorFit = new AgentActor(
				createTestAgent({ id: 'poor', job: 'farmer', attributes: { ST: 10, DX: 10, IQ: 10, HT: 3 } }),
				defaultMoodConfig,
			);
			const system = createMoodSystem(() => [goodFit, poorFit]);
			const deps = createDeps();
			deps.config = GameConfigSchema.parse({
				jobs: { definitions: { farmer: { primary_attribute: 'HT', behavior_tree: 'bt-farmer' } } },
			});
			system.execute(deps);

			const goodMood = goodFit.get(MoodComponent).state.value;
			const poorMood = poorFit.get(MoodComponent).state.value;
			expect(goodMood).toBeGreaterThan(poorMood);
		});
	});

	describe('equipmentCondition mood factor', () => {
		it('returns 0.5 when agent has no chargeable items', () => {
			const agent = new AgentActor(createTestAgent({ inventory: [{ item_id: 'bread', quantity: 2 }] }), defaultMoodConfig);
			const system = createMoodSystem(() => [agent]);
			system.execute(createDeps());

			// Default 0.5 when no chargeable items — mood is the same as an empty-inventory agent
			const noInvAgent = new AgentActor(createTestAgent({ id: 'empty' }), defaultMoodConfig);
			const system2 = createMoodSystem(() => [noInvAgent]);
			system2.execute(createDeps());

			expect(agent.get(MoodComponent).state.value).toBe(noInvAgent.get(MoodComponent).state.value);
		});

		it('returns higher mood when tools at full charges vs depleted', () => {
			const fullCharges = new AgentActor(
				createTestAgent({ id: 'full', inventory: [{ item_id: 'tools', quantity: 1, charges: 5 }] }),
				defaultMoodConfig,
			);
			const emptyCharges = new AgentActor(
				createTestAgent({ id: 'empty', inventory: [{ item_id: 'tools', quantity: 1, charges: 0 }] }),
				defaultMoodConfig,
			);
			const system = createMoodSystem(() => [fullCharges, emptyCharges]);
			system.execute(createDeps());

			const fullMood = fullCharges.get(MoodComponent).state.value;
			const emptyMood = emptyCharges.get(MoodComponent).state.value;
			expect(fullMood).toBeGreaterThan(emptyMood);
		});
	});

	it('thirst is included in needsSatisfaction — low-thirst agent gets lower mood than high-thirst agent', () => {
		const highThirst = new AgentActor(
			createTestAgent({ needs: { hunger: 80, energy: 80, social: 80, thirst: 80 } }),
			defaultMoodConfig,
		);
		const lowThirst = new AgentActor(
			createTestAgent({ needs: { hunger: 80, energy: 80, social: 80, thirst: 10 } }),
			defaultMoodConfig,
		);

		const system = createMoodSystem(() => [highThirst, lowThirst]);
		system.execute(createDeps());

		const highMood = highThirst.get(MoodComponent).state.value;
		const lowMood = lowThirst.get(MoodComponent).state.value;

		expect(highMood).toBeGreaterThan(lowMood);
	});
});
