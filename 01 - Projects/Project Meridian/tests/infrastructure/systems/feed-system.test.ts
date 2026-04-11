import { describe, it, expect } from 'vitest';
import { createFeedSystem } from '../../../src/infrastructure/systems/feed-system.js';
import { AgentActor } from '../../../src/infrastructure/entity/agent-actor.js';
import { NeedsComponent } from '../../../src/infrastructure/components/needs-component.js';
import { InventoryComponent } from '../../../src/infrastructure/components/inventory-component.js';
import { EconomyComponent } from '../../../src/infrastructure/components/economy-component.js';
import { GameConfigSchema } from '../../../src/domain/schemas/game-config-schema.js';
import { createPerformanceTracker } from '../../../src/infrastructure/performance/performance-tracker.js';
import { createEventBus } from '../../../src/infrastructure/event-bus.js';
import type { GameCoreDeps } from '../../../src/domain/core/game-deps.js';
import type { GameEvent } from '../../../src/domain/core/events.js';
import { Actor } from 'excalibur';
import type { BehaviorAgent } from '../../../src/domain/systems/behavior-agent.js';

const defaultMoodConfig = {
	factor_weights: { needs: 30, positive_memories: 20, negative_memories: 20, goal_progress: 10, wallet: 10, equipment: 5, relationships: 5 },
	buckets: [{ name: 'stressed', min: -100, max: 100 }],
	external_modifier_cap: 30,
};

function createTestAgentData(id: string, x = 0, y = 0, overrides: Record<string, unknown> = {}) {
	return {
		id, name: id, kind: 'merchant',
		attributes: { ST: 10, DX: 10, IQ: 10, HT: 10 },
		social: { status: 0, reputation: 0, charisma: 10 },
		needs: { hunger: 50, energy: 50, social: 50, thirst: 50 },
		mood: 0, memory: [], goals: [], skills: [], inventory: [],
		equipment: { head: null, body: null, hands: null, tool: null, accessory: null },
		traits: [], wallet: { gold: 50 }, xp: 0, level: 1,
		position: { x, y, region: 'test' }, relationships: '',
		color: '#b0b0b0', persona: null, property: [],
		tools: [], behavior_tree: 'bt-merchant', job: null,
		...overrides,
	};
}

function createStubBehaviorAgent(overrides: Partial<BehaviorAgent> = {}): BehaviorAgent {
	return {
		hunger: 50, energy: 50, social: 50, thirst: 50, gold: 50, mood: 0, moodBucket: 'stressed',
		timePhase: 'day', job: null, position: { x: 0, y: 0 }, inventory: [],
		nearbyAgents: [], nearbyLocations: [], nearbyFacilities: [],
		movementTarget: null, journey: null, atLocation: null, currentRegion: '',
		haulCargo: null, socialCooldowns: new Map(), committedAction: null,
		btAction: null, gossipPending: null, knownLocations: [], traitModifiers: null,
		skills: [], feedingAt: null, restingAt: null, arrivalSlot: null, buyTargetItem: null,
		unemployedTicks: 0,
		recovering: false,
		supplyRoute: null,
		activeQuest: null,
		cachedAvailableQuest: null,
		insideFacility: false,
		commitmentTicks: 0,
		sleepDebt: 0,
		ticksRestedThisDay: 0,
		personalThresholds: { hunger: 40, energy: 30, thirst: 40 },
		priceMemories: [] as unknown as BehaviorAgent['priceMemories'],
		IsHungry: () => false, IsExhausted: () => false, IsRecovering: () => false, IsLonely: () => false,
		IsThirsty: () => false, HasWater: () => false,
		NeedsCritical: () => false, HasFood: () => false, HasFoodReserve: () => false, HasGold: () => false,
		CanAffordFood: () => false, AtLocation: () => false, NearLocation: () => false,
		NearAgent: () => false, NearAgentClose: () => false, IsDaytime: () => true,
		IsNighttime: () => false, IsWorkHours: () => false, HasJob: () => false, AtJobFacility: () => false,
		FacilityHasStock: () => false, HasCargo: () => false, CargoDestinationNearby: () => false,
		FacilityNeedsSupply: () => false, KnowsFoodSource: () => false,
		HasNoJob: () => true, OpenFacilityNearby: () => false, OpenProductionFacilityNearby: () => false,
		HasTradeGoods: () => false, NeedsTools: () => true, NeedsEquipment: () => true, NeedsRepair: () => false, HasTools: () => false,
		CanAffordItem: () => false,
		Eat: () => 'mistreevous.failed', Rest: () => 'mistreevous.failed',
		Drink: () => 'mistreevous.failed', CollectProduced: () => 'mistreevous.failed',
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
		SwitchJob: () => 'mistreevous.failed', ClaimQuest: () => 'mistreevous.failed',
		SeekQuestFacility: () => 'mistreevous.failed', WorkRepair: () => 'mistreevous.failed',
		CompleteQuest: () => 'mistreevous.failed', AbandonQuest: () => 'mistreevous.failed',
		RepairWithTools: () => 'mistreevous.failed', ContinueCommitment: () => 'mistreevous.failed',
		Leisure: () => 'mistreevous.failed',
		BetterPayAvailable: () => false, KnowsSupplyRoute: () => false,
		HasQuest: () => false, QuestAvailable: () => false, QuestAtFacility: () => false,
		QuestCargoReady: () => false, IsCommitted: () => false, ShouldSleep: () => false,
		IsRestDay: () => false, IsMoodLow: () => false,
		claimFacility: () => true, releaseFacility: () => {},
		recordPriceObservation: () => {}, tickUnemployment: () => {},
		...overrides,
	};
}

function createWorldEntity(): Actor {
	const entity = new Actor();
	entity.addComponent(new EconomyComponent({
		treasury: 500, ledger: [], dailySummary: { totalWages: 0, totalTax: 0, totalSales: 0, totalConsumption: 0, avgWage: 0, wageSpread: 0, vacancyCount: 0, unemploymentCount: 0, jobSwitchesThisDay: 0, supplyDeliveries: 0, questsCompletedThisDay: 0 },
	}));
	return entity;
}

function createDeps(eventBus = createEventBus(), tickCount = 1): GameCoreDeps {
	return {
		logger: { debug() {}, info() {}, warn() {}, error() {} },
		eventBus,
		config: GameConfigSchema.parse({}),
		performanceTracker: createPerformanceTracker(),
		tickCount,
		writeFile: null,
		dataRoot: 'test-data',
		getRecipeRegistry: () => new Map(),
		getFacilityTypeRegistry: () => new Map(),
	};
}

describe('FeedSystem (inventory-based)', () => {
	it('consumes food from inventory and recovers hunger', () => {
		const agent = new AgentActor(
			createTestAgentData('agent-1', 0, 0, { inventory: [{ item_id: 'food', quantity: 2 }] }),
			defaultMoodConfig,
		);
		agent.behaviorAgent = createStubBehaviorAgent({ btAction: 'eat' });

		const worldEntity = createWorldEntity();
		const deps = createDeps();
		const system = createFeedSystem(() => [agent], () => worldEntity);
		system.execute(deps);

		const needs = agent.get(NeedsComponent);
		expect(needs.state.hunger).toBeGreaterThan(50);

		const inv = agent.get(InventoryComponent);
		const foodItem = inv.state.items.find(i => i.item_id === 'food');
		expect(foodItem?.quantity).toBe(1);
	});

	it('does not recover hunger when no food in inventory', () => {
		const agent = new AgentActor(
			createTestAgentData('agent-1', 0, 0, { inventory: [{ item_id: 'torch', quantity: 1 }] }),
			defaultMoodConfig,
		);
		agent.behaviorAgent = createStubBehaviorAgent({ btAction: 'eat' });

		const worldEntity = createWorldEntity();
		const deps = createDeps();
		const system = createFeedSystem(() => [agent], () => worldEntity);
		system.execute(deps);

		const needs = agent.get(NeedsComponent);
		expect(needs.state.hunger).toBe(50);
	});

	it('emits ItemConsumed event on consumption', () => {
		const agent = new AgentActor(
			createTestAgentData('agent-1', 0, 0, { inventory: [{ item_id: 'food', quantity: 1 }] }),
			defaultMoodConfig,
		);
		agent.behaviorAgent = createStubBehaviorAgent({ btAction: 'eat' });

		const events: GameEvent[] = [];
		const eventBus = createEventBus();
		eventBus.on('ItemConsumed', (e: GameEvent) => { events.push(e); });

		const worldEntity = createWorldEntity();
		const deps = createDeps(eventBus);
		const system = createFeedSystem(() => [agent], () => worldEntity);
		system.execute(deps);

		expect(events).toHaveLength(1);
		expect(events[0].payload.itemId).toBe('food');
	});

	it('appends consumption ledger entry', () => {
		const agent = new AgentActor(
			createTestAgentData('agent-1', 0, 0, { inventory: [{ item_id: 'food', quantity: 1 }] }),
			defaultMoodConfig,
		);
		agent.behaviorAgent = createStubBehaviorAgent({ btAction: 'eat' });

		const worldEntity = createWorldEntity();
		const deps = createDeps();
		const system = createFeedSystem(() => [agent], () => worldEntity);
		system.execute(deps);

		const economy = worldEntity.get(EconomyComponent);
		expect(economy.state.ledger).toHaveLength(1);
		expect(economy.state.ledger[0].type).toBe('consumption');
	});

	it('skips agents not eating', () => {
		const agent = new AgentActor(
			createTestAgentData('agent-1', 0, 0, { inventory: [{ item_id: 'food', quantity: 5 }] }),
			defaultMoodConfig,
		);
		agent.behaviorAgent = createStubBehaviorAgent();

		const worldEntity = createWorldEntity();
		const deps = createDeps();
		const system = createFeedSystem(() => [agent], () => worldEntity);
		system.execute(deps);

		const inv = agent.get(InventoryComponent);
		const foodItem = inv.state.items.find(i => i.item_id === 'food');
		expect(foodItem?.quantity).toBe(5);
	});
});
