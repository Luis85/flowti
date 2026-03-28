import { describe, it, expect } from 'vitest';
import { createTickRunner } from '../../src/infrastructure/engine/tick-runner.js';
import { createEventBus } from '../../src/infrastructure/event-bus.js';
import { createPerformanceTracker } from '../../src/infrastructure/performance/performance-tracker.js';
import { GameConfigSchema } from '../../src/domain/schemas/game-config-schema.js';
import { createTraitResolverSystem } from '../../src/infrastructure/systems/trait-resolver-system.js';
import { createNeedsDecaySystem } from '../../src/infrastructure/systems/needs-decay-system.js';
import { createMoodSystem } from '../../src/infrastructure/systems/mood-system.js';
import { createMemoryDecaySystem } from '../../src/infrastructure/systems/memory-decay-system.js';
import { AgentActor } from '../../src/infrastructure/entity/agent-actor.js';
import { NeedsComponent } from '../../src/infrastructure/components/needs-component.js';
import { MoodComponent } from '../../src/infrastructure/components/mood-component.js';
import type { GameCoreDeps } from '../../src/domain/core/game-deps.js';
import type { GameEvent } from '../../src/domain/core/events.js';
import type { TraitDefinition } from '../../src/domain/systems/trait-resolver.js';

function createTestAgent(overrides: Record<string, unknown> = {}) {
	return {
		id: 'agent-elena', name: 'Elena', kind: 'merchant',
		attributes: { ST: 10, DX: 10, IQ: 10, HT: 10 },
		social: { status: 0, reputation: 0, charisma: 10 },
		needs: { hunger: 80, energy: 90, social: 70 },
		mood: 0, memory: [], goals: [], skills: [], inventory: [],
		equipment: { head: null, body: null, hands: null, tool: null, accessory: null },
		traits: [], wallet: { gold: 50 }, xp: 0, level: 1,
		position: { x: 0, y: 0, region: 'test' }, relationships: '',
		tools: [], behavior_tree: 'bt/test.md', job: null, property: [],
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

describe('Life Systems Integration', () => {
	it('full tick: 4 systems execute in order, needs decay → mood reacts', () => {
		const eventBus = createEventBus();
		const eventLog: string[] = [];
		eventBus.on('NeedChanged', () => { eventLog.push('NeedChanged'); });
		eventBus.on('MoodChanged', () => { eventLog.push('MoodChanged'); });

		const agent = new AgentActor(createTestAgent(), defaultMoodConfig);
		const getAgents = () => [agent];

		const runner = createTickRunner(eventBus);
		runner.register(createTraitResolverSystem(getAgents, {}));
		runner.register(createNeedsDecaySystem(getAgents));
		runner.register(createMoodSystem(getAgents));
		runner.register(createMemoryDecaySystem(getAgents));

		const deps: GameCoreDeps = {
			logger: { debug() {}, info() {}, warn() {}, error() {} },
			eventBus,
			config: GameConfigSchema.parse({}),
			performanceTracker: createPerformanceTracker(),
			tickCount: 0,
		};

		runner.tick(deps);

		// Needs should have decayed
		expect(agent.get(NeedsComponent).state.hunger).toBeLessThan(80);

		// NeedChanged should fire before MoodChanged (system priority ordering)
		const needIdx = eventLog.indexOf('NeedChanged');
		const moodIdx = eventLog.indexOf('MoodChanged');
		if (moodIdx >= 0) {
			expect(needIdx).toBeLessThan(moodIdx);
		}
	});

	it('trait modifiers flow through blackboard → affect needs decay', () => {
		const eventBus = createEventBus();
		const traitDefs: Record<string, TraitDefinition> = {
			'hardy': {
				id: 'hardy',
				effects: [{ system: 'NeedsDecaySystem', modifier: { hungerDecayScale: 0.5 } }],
				conflicts_with: [],
			},
		};

		const agentWithTrait = new AgentActor(createTestAgent({ traits: ['hardy'] }), defaultMoodConfig);
		const agentWithout = new AgentActor(createTestAgent({ id: 'agent-other' }), defaultMoodConfig);

		const runner1 = createTickRunner(eventBus);
		runner1.register(createTraitResolverSystem(() => [agentWithTrait], traitDefs));
		runner1.register(createNeedsDecaySystem(() => [agentWithTrait]));

		const runner2 = createTickRunner(createEventBus());
		runner2.register(createTraitResolverSystem(() => [agentWithout], traitDefs));
		runner2.register(createNeedsDecaySystem(() => [agentWithout]));

		const config = GameConfigSchema.parse({});
		const deps1: GameCoreDeps = { logger: { debug() {}, info() {}, warn() {}, error() {} }, eventBus, config, performanceTracker: createPerformanceTracker(), tickCount: 0 };
		const deps2: GameCoreDeps = { logger: { debug() {}, info() {}, warn() {}, error() {} }, eventBus: createEventBus(), config, performanceTracker: createPerformanceTracker(), tickCount: 0 };

		runner1.tick(deps1);
		runner2.tick(deps2);

		// Hardy trait → 0.5x hunger decay → agent with trait should have more hunger remaining
		expect(agentWithTrait.get(NeedsComponent).state.hunger).toBeGreaterThan(
			agentWithout.get(NeedsComponent).state.hunger,
		);
	});

	it('event delivery order: NeedChanged before MoodChanged', () => {
		const eventBus = createEventBus();
		const order: string[] = [];
		eventBus.on('NeedChanged', () => { order.push('NeedChanged'); });
		eventBus.on('MoodChanged', () => { order.push('MoodChanged'); });

		const agent = new AgentActor(createTestAgent(), defaultMoodConfig);
		// Force bucket to something that will change after mood recalculation
		agent.get(MoodComponent).state.bucket = 'elated';

		const runner = createTickRunner(eventBus);
		runner.register(createTraitResolverSystem(() => [agent], {}));
		runner.register(createNeedsDecaySystem(() => [agent]));
		runner.register(createMoodSystem(() => [agent]));

		const deps: GameCoreDeps = {
			logger: { debug() {}, info() {}, warn() {}, error() {} },
			eventBus,
			config: GameConfigSchema.parse({}),
			performanceTracker: createPerformanceTracker(),
			tickCount: 0,
		};

		runner.tick(deps);

		const needIdx = order.indexOf('NeedChanged');
		const moodIdx = order.indexOf('MoodChanged');
		expect(needIdx).toBeGreaterThanOrEqual(0);
		expect(moodIdx).toBeGreaterThan(needIdx);
	});
});
