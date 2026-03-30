import { describe, it, expect, vi } from 'vitest';
import { createTraitResolverSystem } from '../../../src/infrastructure/systems/trait-resolver-system.js';
import { AgentActor } from '../../../src/infrastructure/entity/agent-actor.js';
import { BlackboardComponent } from '../../../src/infrastructure/components/blackboard-component.js';
import { GameConfigSchema } from '../../../src/domain/schemas/game-config-schema.js';
import { createPerformanceTracker } from '../../../src/infrastructure/performance/performance-tracker.js';
import { createEventBus } from '../../../src/infrastructure/event-bus.js';
import type { GameCoreDeps } from '../../../src/domain/core/game-deps.js';
import type { TraitDefinition } from '../../../src/domain/systems/trait-resolver.js';

const traitDefs: Record<string, TraitDefinition> = {
	'hardy': {
		id: 'hardy',
		effects: [{ system: 'NeedsDecaySystem', modifier: { hungerDecayScale: 0.8 } }],
		conflicts_with: [],
	},
	'frail': {
		id: 'frail',
		effects: [{ system: 'NeedsDecaySystem', modifier: { hungerDecayScale: 1.5 } }],
		conflicts_with: ['hardy'],
	},
};

function createDeps(eventBus = createEventBus()): GameCoreDeps {
	return {
		logger: { debug() {}, info() {}, warn: vi.fn(), error() {} },
		eventBus,
		config: GameConfigSchema.parse({}),
		performanceTracker: createPerformanceTracker(),
		tickCount: 1,
		writeFile: null,
	};
}

function createTestAgent(traits: string[]) {
	return {
		id: 'agent-test' as const,
		name: 'Test',
		kind: 'merchant',
		attributes: { ST: 10, DX: 10, IQ: 10, HT: 10 },
		social: { status: 0, reputation: 0, charisma: 10 },
		needs: { hunger: 80, energy: 90, social: 70 },
		mood: 0,
		memory: [] as never[],
		goals: [] as never[],
		skills: [] as never[],
		inventory: [] as never[],
		equipment: { head: null, body: null, hands: null, tool: null, accessory: null },
		traits,
		wallet: { gold: 50 },
		xp: 0,
		level: 1,
		position: { x: 0, y: 0, region: 'test' },
		relationships: '',
		tools: [] as never[],
		color: '#b0b0b0', behavior_tree: 'bt/test.md',
		job: null,
		property: [] as never[],
	};
}

const defaultMoodConfig = {
	factor_weights: { needs: 30, positive_memories: 20, negative_memories: 20, goal_progress: 10, wallet: 10, equipment: 5, relationships: 5 },
	buckets: [{ name: 'stressed', min: -100, max: 100 }],
	external_modifier_cap: 30,
};

describe('TraitResolverSystem', () => {
	it('writes modifier map to blackboard', () => {
		const agent = new AgentActor(createTestAgent(['hardy']), defaultMoodConfig);
		const system = createTraitResolverSystem(() => [agent], traitDefs);
		system.execute(createDeps());

		const bb = agent.get(BlackboardComponent);
		const modifiers = bb.state.traitModifiers as Record<string, Record<string, unknown>> | undefined;
		expect(modifiers).toBeDefined();
		expect(modifiers?.['NeedsDecaySystem']).toEqual({ hungerDecayScale: 0.8 });
	});

	it('writes empty map on trait conflict', () => {
		const agent = new AgentActor(createTestAgent(['hardy', 'frail']), defaultMoodConfig);
		const system = createTraitResolverSystem(() => [agent], traitDefs);
		const deps = createDeps();
		system.execute(deps);

		const bb = agent.get(BlackboardComponent);
		const modifiers = bb.state.traitModifiers as Record<string, unknown> | undefined;
		expect(Object.keys(modifiers ?? {})).toHaveLength(0);
		expect(deps.logger.warn).toHaveBeenCalled();
	});

	it('handles agent with no traits', () => {
		const agent = new AgentActor(createTestAgent([]), defaultMoodConfig);
		const system = createTraitResolverSystem(() => [agent], traitDefs);
		system.execute(createDeps());

		const bb = agent.get(BlackboardComponent);
		const modifiers = bb.state.traitModifiers as Record<string, unknown> | undefined;
		expect(Object.keys(modifiers ?? {})).toHaveLength(0);
	});
});
