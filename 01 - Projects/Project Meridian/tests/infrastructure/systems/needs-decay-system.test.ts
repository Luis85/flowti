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
		needs: { hunger: 80, energy: 90, social: 70, thirst: 80 },
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
		hunger: 80, energy: 90, social: 70, thirst: 80, gold: 50, mood: 0, moodBucket: 'stressed',
		timePhase: 'day', job: null, position: { x: 0, y: 0 }, inventory: [],
		nearbyAgents: [], nearbyLocations: [], nearbyFacilities: [],
		movementTarget: null, journey: null, atLocation: null, currentRegion: '',
		haulCargo: null, socialCooldowns: new Map(), committedAction: null,
		btAction: null, gossipPending: null, knownLocations: [], traitModifiers: null,
		skills: [], feedingAt: null, restingAt: null, arrivalSlot: null, buyTargetItem: null,
		unemployedTicks: 0,
		priceMemories: [] as unknown as BehaviorAgent['priceMemories'],
		IsHungry: () => false, IsExhausted: () => false, IsLonely: () => false,
		IsThirsty: () => false, HasWater: () => false,
		NeedsCritical: () => false, HasFood: () => false, HasFoodReserve: () => false, HasGold: () => false,
		CanAffordFood: () => false, AtLocation: () => false, NearLocation: () => false,
		NearAgent: () => false, NearAgentClose: () => false, IsDaytime: () => true,
		IsNighttime: () => false, IsWorkHours: () => false, HasJob: () => false, AtJobFacility: () => false,
		FacilityHasStock: () => false, HasCargo: () => false, CargoDestinationNearby: () => false,
		FacilityNeedsSupply: () => false, KnowsFoodSource: () => false,
		HasNoJob: () => true, OpenFacilityNearby: () => false, OpenProductionFacilityNearby: () => false,
		HasTradeGoods: () => false, NeedsTools: () => true, NeedsEquipment: () => true,
		CanAffordItem: () => false,
		Eat: () => 'mistreevous.failed', Rest: () => 'mistreevous.failed',
		Drink: () => 'mistreevous.failed', Harvest: () => 'mistreevous.failed',
		SeekFood: () => 'mistreevous.failed', SeekRest: () => 'mistreevous.failed',
		SeekWater: () => 'mistreevous.failed', FillWaterskin: () => 'mistreevous.failed',
		SellAtMarket: () => 'mistreevous.failed',
		SeekWork: () => 'mistreevous.failed', SeekSocial: () => 'mistreevous.failed',
		SeekMarket: () => 'mistreevous.failed', Work: () => 'mistreevous.failed',
		Talk: () => 'mistreevous.failed', Buy: () => 'mistreevous.failed',
		BuyItem: () => 'mistreevous.failed',
		PickupCargo: () => 'mistreevous.failed', DeliverCargo: () => 'mistreevous.failed',
		SeekDeliveryTarget: () => 'mistreevous.failed', SeekSupplySource: () => 'mistreevous.failed',
		SeekBestFoodSource: () => 'mistreevous.failed', ClaimJob: () => 'mistreevous.failed',
		ClaimBestJob: () => 'mistreevous.failed' as const, ReleaseJob: () => 'mistreevous.succeeded' as const,
		Idle: () => 'mistreevous.running', Wander: () => 'mistreevous.running',
		recordPriceObservation: () => {}, tickUnemployment: () => {},
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
		// social_decay is 0 by default, so social doesn't decay
		expect(needs.state.social).toBe(70);
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
		const agent = new AgentActor(createTestAgent({ needs: { hunger: 20, energy: 90, social: 70, thirst: 80 } }), defaultMoodConfig);
		agent.behaviorAgent = createStubBehaviorAgent();
		const system = createNeedsDecaySystem(() => [agent]);
		system.execute(createDeps(eventBus));

		expect(criticals.length).toBeGreaterThan(0);
	});

	it('equipment with charges reduces all need decay rates', () => {
		const withEquipment = new AgentActor(
			createTestAgent({ inventory: [{ item_id: 'equipment', quantity: 1, charges: 10 }] }),
			defaultMoodConfig,
		);
		withEquipment.behaviorAgent = createStubBehaviorAgent();

		const withoutEquipment = new AgentActor(createTestAgent(), defaultMoodConfig);
		withoutEquipment.behaviorAgent = createStubBehaviorAgent();

		const systemWith = createNeedsDecaySystem(() => [withEquipment]);
		const systemWithout = createNeedsDecaySystem(() => [withoutEquipment]);
		const deps = createDeps();
		systemWith.execute(deps);
		systemWithout.execute(deps);

		const needsWith = withEquipment.get(NeedsComponent).state;
		const needsWithout = withoutEquipment.get(NeedsComponent).state;

		// Agent with equipment should decay less (higher values remain)
		expect(needsWith.hunger).toBeGreaterThan(needsWithout.hunger);
		expect(needsWith.thirst).toBeGreaterThan(needsWithout.thirst);
		expect(needsWith.energy).toBeGreaterThan(needsWithout.energy);
	});

	it('equipment with zero charges does not reduce decay', () => {
		const withExhaustedEquipment = new AgentActor(
			createTestAgent({ inventory: [{ item_id: 'equipment', quantity: 1, charges: 0 }] }),
			defaultMoodConfig,
		);
		withExhaustedEquipment.behaviorAgent = createStubBehaviorAgent();

		const withoutEquipment = new AgentActor(createTestAgent(), defaultMoodConfig);
		withoutEquipment.behaviorAgent = createStubBehaviorAgent();

		const systemWith = createNeedsDecaySystem(() => [withExhaustedEquipment]);
		const systemWithout = createNeedsDecaySystem(() => [withoutEquipment]);
		const deps = createDeps();
		systemWith.execute(deps);
		systemWithout.execute(deps);

		const needsWith = withExhaustedEquipment.get(NeedsComponent).state;
		const needsWithout = withoutEquipment.get(NeedsComponent).state;

		// Zero charges: same decay as no equipment
		expect(needsWith.hunger).toBe(needsWithout.hunger);
		expect(needsWith.thirst).toBe(needsWithout.thirst);
		expect(needsWith.energy).toBe(needsWithout.energy);
	});
});
