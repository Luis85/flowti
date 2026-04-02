import { describe, it, expect } from 'vitest';
import { createNeedsDecaySystem } from '../../../src/infrastructure/systems/needs-decay-system.js';
import { AgentActor } from '../../../src/infrastructure/entity/agent-actor.js';
import { NeedsComponent } from '../../../src/infrastructure/components/needs-component.js';
import { GameConfigSchema } from '../../../src/domain/schemas/game-config-schema.js';
import { createPerformanceTracker } from '../../../src/infrastructure/performance/performance-tracker.js';
import { createEventBus } from '../../../src/infrastructure/event-bus.js';
import type { GameCoreDeps } from '../../../src/domain/core/game-deps.js';
import type { GameEvent } from '../../../src/domain/core/events.js';
import type { BehaviorAgent } from '../../../src/domain/systems/behavior-agent.js';

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

function createStubBehaviorAgent(overrides: Partial<BehaviorAgent> = {}): BehaviorAgent {
	return {
		hunger: 80, energy: 90, social: 70, gold: 50, mood: 0, moodBucket: 'stressed',
		timePhase: 'day', job: null, position: { x: 0, y: 0 }, inventory: [],
		nearbyAgents: [], nearbyLocations: [], nearbyFacilities: [],
		movementTarget: null, journey: null, atLocation: null, currentRegion: '',
		haulCargo: null, socialCooldowns: new Map(), committedAction: null,
		btAction: null, gossipPending: null, knownLocations: [], traitModifiers: null,
		skills: [], feedingAt: null, restingAt: null, arrivalSlot: null,
		IsHungry: () => false, IsExhausted: () => false, IsLonely: () => false,
		NeedsCritical: () => false, HasFood: () => false, HasGold: () => false,
		CanAffordFood: () => false, AtLocation: () => false, NearLocation: () => false,
		NearAgent: () => false, NearAgentClose: () => false, IsDaytime: () => true,
		IsNighttime: () => false, HasJob: () => false, AtJobFacility: () => false,
		FacilityHasStock: () => false, HasCargo: () => false, CargoDestinationNearby: () => false,
		FacilityNeedsSupply: () => false,
		Eat: () => 'mistreevous.failed', Rest: () => 'mistreevous.failed',
		SeekFood: () => 'mistreevous.failed', SeekRest: () => 'mistreevous.failed',
		SeekWork: () => 'mistreevous.failed', SeekSocial: () => 'mistreevous.failed',
		SeekMarket: () => 'mistreevous.failed', Work: () => 'mistreevous.failed',
		Talk: () => 'mistreevous.failed', Buy: () => 'mistreevous.failed',
		PickupCargo: () => 'mistreevous.failed', DeliverCargo: () => 'mistreevous.failed',
		SeekDeliveryTarget: () => 'mistreevous.failed', SeekSupplySource: () => 'mistreevous.failed',
		Idle: () => 'mistreevous.running', Wander: () => 'mistreevous.running',
		...overrides,
	};
}

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
		agent.behaviorAgent = createStubBehaviorAgent();
		const system = createNeedsDecaySystem(() => [agent]);
		system.execute(createDeps());

		const needs = agent.get(NeedsComponent);
		expect(needs.state.hunger).toBeLessThan(80);
		expect(needs.state.energy).toBeLessThan(90);
		expect(needs.state.social).toBeLessThan(70);
		expect(needs.dirty).toBe(true);
	});

	it('reads modifiers from behaviorAgent', () => {
		const agent = new AgentActor(createTestAgent(), defaultMoodConfig);
		agent.behaviorAgent = createStubBehaviorAgent({
			traitModifiers: { NeedsDecaySystem: { hungerDecayScale: 2.0 } },
		});

		const system = createNeedsDecaySystem(() => [agent]);
		const depsNoMod = createDeps();
		const agentNoMod = new AgentActor(createTestAgent(), defaultMoodConfig);
		agentNoMod.behaviorAgent = createStubBehaviorAgent();
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
		agent.behaviorAgent = createStubBehaviorAgent();
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
		agent.behaviorAgent = createStubBehaviorAgent();
		const system = createNeedsDecaySystem(() => [agent]);
		system.execute(createDeps(eventBus));

		expect(criticals.length).toBeGreaterThan(0);
	});
});
