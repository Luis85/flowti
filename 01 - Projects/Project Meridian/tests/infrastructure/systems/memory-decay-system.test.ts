import { describe, it, expect } from 'vitest';
import { createMemoryDecaySystem } from '../../../src/infrastructure/systems/memory-decay-system.js';
import { AgentActor } from '../../../src/infrastructure/entity/agent-actor.js';
import { MemoryComponent } from '../../../src/infrastructure/components/memory-component.js';
import { GameConfigSchema } from '../../../src/domain/schemas/game-config-schema.js';
import { createPerformanceTracker } from '../../../src/infrastructure/performance/performance-tracker.js';
import { createEventBus } from '../../../src/infrastructure/event-bus.js';
import type { GameCoreDeps } from '../../../src/domain/core/game-deps.js';
import type { GameEvent } from '../../../src/domain/core/events.js';

function createTestAgent(memory: unknown[] = []) {
	return {
		id: 'agent-test', name: 'Test', kind: 'merchant',
		attributes: { ST: 10, DX: 10, IQ: 10, HT: 10 },
		social: { status: 0, reputation: 0, charisma: 10 },
		needs: { hunger: 80, energy: 90, social: 70, thirst: 80 },
		mood: 0, memory, goals: [], skills: [], inventory: [],
		equipment: { head: null, body: null, hands: null, tool: null, accessory: null },
		traits: [], wallet: { gold: 50 }, xp: 0, level: 1,
		position: { x: 0, y: 0, region: 'test' }, relationships: '',
		tools: [], color: '#b0b0b0', behavior_tree: 'bt/test.md', job: null, property: [],
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
		tickCount: 100,
		writeFile: null,
		dataRoot: 'test-data',
		getRecipeRegistry: () => new Map(),
		getFacilityTypeRegistry: () => new Map(),
	};
}

describe('MemoryDecaySystem', () => {
	it('decays memory entries past min lifespan', () => {
		const memory = [{
			tick: 0, type: 'test', description: 'old memory',
			participants: [], outcome: 'neutral' as const, significance: 5, mood_impact: 0,
		}];
		const agent = new AgentActor(createTestAgent(memory), defaultMoodConfig);
		const system = createMemoryDecaySystem(() => [agent]);
		system.execute(createDeps());

		const mem = agent.get(MemoryComponent);
		expect(mem.state.entries[0]?.significance).toBeLessThan(5);
		expect(mem.dirty).toBe(true);
	});

	it('emits MemoryDecayed when entries change', () => {
		const eventBus = createEventBus();
		const events: GameEvent[] = [];
		eventBus.on('MemoryDecayed', (e) => { events.push(e); });

		const memory = [{
			tick: 0, type: 'test', description: 'old memory',
			participants: [], outcome: 'neutral' as const, significance: 5, mood_impact: 0,
		}];
		const agent = new AgentActor(createTestAgent(memory), defaultMoodConfig);
		const system = createMemoryDecaySystem(() => [agent]);
		system.execute(createDeps(eventBus));

		expect(events).toHaveLength(1);
		expect(events[0]?.payload.agentId).toBe('agent-test');
	});

	it('significance-5 memory survives at least one full game day (480 ticks)', () => {
		const memory = [{
			tick: 0, type: 'quest_completed', description: 'completed repair',
			participants: [], outcome: 'positive' as const, significance: 5, mood_impact: 10,
		}];
		const agent = new AgentActor(createTestAgent(memory), defaultMoodConfig);
		const system = createMemoryDecaySystem(() => [agent]);
		const deps = createDeps();
		deps.config.memory.min_lifespan_ticks = 480;

		system.execute({ ...deps, tickCount: 480 });

		const memComp = agent.get(MemoryComponent);
		expect(memComp.state.entries.length).toBe(1);
		expect(memComp.state.entries[0]!.significance).toBeGreaterThanOrEqual(1);
	});

	it('does not emit when no entries change', () => {
		const eventBus = createEventBus();
		const events: GameEvent[] = [];
		eventBus.on('MemoryDecayed', (e) => { events.push(e); });

		const agent = new AgentActor(createTestAgent(), defaultMoodConfig);
		const system = createMemoryDecaySystem(() => [agent]);
		system.execute(createDeps(eventBus));

		expect(events).toHaveLength(0);
	});
});
