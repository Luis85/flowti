import { describe, it, expect } from 'vitest';
import { createNeedsDecaySystem } from '../../../src/infrastructure/systems/needs-decay-system.js';
import { AgentActor } from '../../../src/infrastructure/entity/agent-actor.js';
import { NeedsComponent } from '../../../src/infrastructure/components/needs-component.js';
import { BlackboardComponent } from '../../../src/infrastructure/components/blackboard-component.js';
import { GameConfigSchema } from '../../../src/domain/schemas/game-config-schema.js';
import { createPerformanceTracker } from '../../../src/infrastructure/performance/performance-tracker.js';
import { createEventBus } from '../../../src/infrastructure/event-bus.js';
import type { GameCoreDeps } from '../../../src/domain/core/game-deps.js';
import type { GameEvent } from '../../../src/domain/core/events.js';

function createTestAgent(overrides: Record<string, unknown> = {}) {
	return {
		id: 'agent-test',
		name: 'Test',
		kind: 'merchant',
		attributes: { ST: 10, DX: 10, IQ: 10, HT: 10 },
		social: { status: 0, reputation: 0, charisma: 10 },
		needs: { hunger: 80, energy: 90, social: 70 },
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
		position: { x: 0, y: 0, region: 'test' },
		relationships: '',
		tools: [],
		color: '#b0b0b0', behavior_tree: 'bt/test.md',
		job: null,
		property: [],
		...overrides,
	};
}

const defaultMoodConfig = {
	factor_weights: { needs: 30, positive_memories: 20, negative_memories: 20, goal_progress: 10, wallet: 10, equipment: 5, relationships: 5 },
	buckets: [{ name: 'stressed', min: -100, max: 100 }],
	external_modifier_cap: 30,
};

function createDeps(eventBus = createEventBus()): GameCoreDeps {
	return {
		logger: { debug() {}, info() {}, warn() {}, error() {} },
		eventBus,
		config: GameConfigSchema.parse({}),
		performanceTracker: createPerformanceTracker(),
		tickCount: 1,
		writeFile: null,
	};
}

describe('NeedsDecaySystem', () => {
	it('reads NeedsComponent and writes decayed values', () => {
		const agent = new AgentActor(createTestAgent(), defaultMoodConfig);
		const system = createNeedsDecaySystem(() => [agent]);
		system.execute(createDeps());

		const needs = agent.get(NeedsComponent);
		expect(needs.state.hunger).toBeLessThan(80);
		expect(needs.state.energy).toBeLessThan(90);
		expect(needs.state.social).toBeLessThan(70);
		expect(needs.dirty).toBe(true);
	});

	it('reads modifiers from blackboard', () => {
		const agent = new AgentActor(createTestAgent(), defaultMoodConfig);
		const bb = agent.get(BlackboardComponent);
		const modMap = new Map([['NeedsDecaySystem', { hungerDecayScale: 2.0 }]]);
		bb.state.traitModifiers = modMap;

		const system = createNeedsDecaySystem(() => [agent]);
		const depsNoMod = createDeps();
		const agentNoMod = new AgentActor(createTestAgent(), defaultMoodConfig);
		const systemNoMod = createNeedsDecaySystem(() => [agentNoMod]);
		systemNoMod.execute(depsNoMod);
		system.execute(createDeps());

		expect(agent.get(NeedsComponent).state.hunger).toBeLessThan(agentNoMod.get(NeedsComponent).state.hunger);
	});

	it('emits NeedChanged events via EventBus', () => {
		const eventBus = createEventBus();
		const events: GameEvent[] = [];
		eventBus.on('NeedChanged', (e) => { events.push(e); });

		const agent = new AgentActor(createTestAgent(), defaultMoodConfig);
		const system = createNeedsDecaySystem(() => [agent]);
		system.execute(createDeps(eventBus));

		expect(events.length).toBeGreaterThan(0);
		expect(events[0]?.payload.agentId).toBe('agent-test');
	});

	it('emits NeedCritical when need crosses below threshold', () => {
		const eventBus = createEventBus();
		const criticals: GameEvent[] = [];
		eventBus.on('NeedCritical', (e) => { criticals.push(e); });

		// Start at threshold — decay will cross below it
		const agent = new AgentActor(createTestAgent({ needs: { hunger: 20, energy: 90, social: 70 } }), defaultMoodConfig);
		const system = createNeedsDecaySystem(() => [agent]);
		system.execute(createDeps(eventBus));

		expect(criticals.length).toBeGreaterThan(0);
	});
});
