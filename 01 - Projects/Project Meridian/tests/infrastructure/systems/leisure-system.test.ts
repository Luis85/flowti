import { describe, it, expect } from 'vitest';
import { createLeisureSystem } from '../../../src/infrastructure/systems/leisure-system.js';
import { AgentActor } from '../../../src/infrastructure/entity/agent-actor.js';
import { NeedsComponent } from '../../../src/infrastructure/components/needs-component.js';
import { WalletComponent } from '../../../src/infrastructure/components/wallet-component.js';
import { MemoryComponent } from '../../../src/infrastructure/components/memory-component.js';
import { EconomyComponent } from '../../../src/infrastructure/components/economy-component.js';
import { FacilityComponent } from '../../../src/infrastructure/components/facility-component.js';
import { GameConfigSchema } from '../../../src/domain/schemas/game-config-schema.js';
import { createPerformanceTracker } from '../../../src/infrastructure/performance/performance-tracker.js';
import { createEventBus } from '../../../src/infrastructure/event-bus.js';
import type { GameCoreDeps } from '../../../src/domain/core/game-deps.js';
import type { GameEvent } from '../../../src/domain/core/events.js';
import type { WorldLocation } from '../../../src/domain/schemas/location-schema.js';
import { Actor } from 'excalibur';
import type { BehaviorAgent } from '../../../src/domain/systems/behavior-agent.js';

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
		needs: { hunger: 50, energy: 50, social: 40, thirst: 50 },
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

function createStubBehaviorAgent(overrides: Partial<BehaviorAgent> = {}): BehaviorAgent {
	return {
		hunger: 50, energy: 50, social: 40, thirst: 50, gold: 50, mood: 0, moodBucket: 'stressed',
		timePhase: 'day', job: null, position: { x: 0, y: 0 }, inventory: [],
		nearbyAgents: [], nearbyLocations: [], nearbyFacilities: [],
		movementTarget: null, journey: null, atLocation: null, currentRegion: '',
		haulCargo: null, socialCooldowns: new Map(), committedAction: null,
		btAction: 'leisure', gossipPending: null, knownLocations: [], traitModifiers: null,
		skills: [], feedingAt: null, restingAt: null, arrivalSlot: null, buyTargetItem: null,
		unemployedTicks: 0,
		recovering: false,
		supplyRoute: null,
		activeQuest: null,
		cachedAvailableQuest: null,
		insideFacility: false,
		leisureTarget: 'loc-tavern',
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
		SwitchJob: () => 'mistreevous.failed', ClaimQuest: () => 'mistreevous.failed',
		SeekQuestFacility: () => 'mistreevous.failed', WorkRepair: () => 'mistreevous.failed',
		CompleteQuest: () => 'mistreevous.failed', AbandonQuest: () => 'mistreevous.failed',
		ContinueCommitment: () => 'mistreevous.failed',
		ChooseLeisure: () => 'mistreevous.failed', SeekLeisureTarget: () => 'mistreevous.failed',
		Leisure: () => 'mistreevous.failed',
		BetterPayAvailable: () => false, KnowsSupplyRoute: () => false,
		HasQuest: () => false, QuestAvailable: () => false, QuestAtFacility: () => false,
		QuestCargoReady: () => false, IsCommitted: () => false, ShouldSleep: () => false,
		IsRestDay: () => false, IsMoodLow: () => false, IsAtLeisure: () => false,
		claimFacility: () => true, releaseFacility: () => {},
		recordPriceObservation: () => {}, tickUnemployment: () => {},
		...overrides,
	};
}

function createTavernLocation(): WorldLocation {
	return {
		id: 'loc-tavern',
		name: 'Tavern',
		type: 'leisure',
		position: { x: 300, y: 200, region: 'test' },
		capacity: 10,
		color: '#d4a574',
		production: null,
		leisure: {
			cost: 3,
			effects: { social: 15, mood: 10, energy: 5, skill_xp: 2 },
			attribute_bonus: null,
			ticks_per_visit: 20,
		},
		region: null,
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
	};
}

describe('LeisureSystem', () => {
	it('deducts gold on first tick', () => {
		const agent = new AgentActor(createTestAgentData('agent-1', 300, 200), defaultMoodConfig);
		agent.behaviorAgent = createStubBehaviorAgent();
		const tavern = createTavernLocation();
		const worldEntity = createWorldEntity();

		// Create facility actor for the tavern
		const tavernActor = new Actor();
		tavernActor.addComponent(new FacilityComponent({
			stock: [], fund: 0, workProgress: 0, status: 'idle', workerId: null,
		}));
		const locationActors = new Map<string, Actor>([['loc-tavern', tavernActor]]);

		const system = createLeisureSystem(
			() => [agent], () => [tavern], () => worldEntity, () => locationActors,
		);
		system.execute(createDeps());

		const wallet = agent.get(WalletComponent);
		expect(wallet.state.gold).toBe(47); // 50 - 3

		const facility = tavernActor.get(FacilityComponent);
		expect(facility.state.fund).toBe(3);
	});

	it('applies per-tick social recovery', () => {
		const agent = new AgentActor(createTestAgentData('agent-1', 300, 200), defaultMoodConfig);
		agent.behaviorAgent = createStubBehaviorAgent();
		const tavern = createTavernLocation();
		const worldEntity = createWorldEntity();

		const system = createLeisureSystem(() => [agent], () => [tavern], () => worldEntity);
		system.execute(createDeps());

		const needs = agent.get(NeedsComponent);
		// social starts at 40, gain = 15 / 20 = 0.75 per tick → 40.75
		expect(needs.state.social).toBeCloseTo(40.75);
	});

	it('creates positive memory for mood effect', () => {
		const agent = new AgentActor(createTestAgentData('agent-1', 300, 200), defaultMoodConfig);
		agent.behaviorAgent = createStubBehaviorAgent();
		const tavern = createTavernLocation();
		const worldEntity = createWorldEntity();

		const system = createLeisureSystem(() => [agent], () => [tavern], () => worldEntity);
		system.execute(createDeps());

		const mem = agent.get(MemoryComponent);
		const leisureMemory = mem.state.entries.find(e => e.type === 'leisure_loc-tavern');
		expect(leisureMemory).toBeDefined();
		expect(leisureMemory?.outcome).toBe('positive');
		expect(leisureMemory?.significance).toBe(5); // ceil(10 / 2)
	});

	it('emits GoldFlowed and LeisureStarted events', () => {
		const eventBus = createEventBus();
		const goldEvents: GameEvent[] = [];
		const leisureEvents: GameEvent[] = [];
		eventBus.on('GoldFlowed', (e) => { goldEvents.push(e); });
		eventBus.on('LeisureStarted', (e) => { leisureEvents.push(e); });

		const agent = new AgentActor(createTestAgentData('agent-1', 300, 200), defaultMoodConfig);
		agent.behaviorAgent = createStubBehaviorAgent();
		const tavern = createTavernLocation();
		const worldEntity = createWorldEntity();

		const system = createLeisureSystem(() => [agent], () => [tavern], () => worldEntity);
		system.execute(createDeps(eventBus));

		expect(goldEvents).toHaveLength(1);
		expect(goldEvents[0]?.payload.subcategory).toBe('leisure');
		expect(goldEvents[0]?.payload.amount).toBe(3);
		expect(goldEvents[0]?.payload.fromEntity).toBe('agent-1');
		expect(goldEvents[0]?.payload.toEntity).toBe('loc-tavern');

		expect(leisureEvents).toHaveLength(1);
		expect(leisureEvents[0]?.payload.agentId).toBe('agent-1');
		expect(leisureEvents[0]?.payload.locationId).toBe('loc-tavern');
		expect(leisureEvents[0]?.payload.cost).toBe(3);
	});

	it('does not deduct gold on subsequent ticks', () => {
		const agent = new AgentActor(createTestAgentData('agent-1', 300, 200), defaultMoodConfig);
		agent.behaviorAgent = createStubBehaviorAgent();
		const tavern = createTavernLocation();
		const worldEntity = createWorldEntity();

		const system = createLeisureSystem(() => [agent], () => [tavern], () => worldEntity);

		// First tick
		system.execute(createDeps(createEventBus(), 1));
		expect(agent.get(WalletComponent).state.gold).toBe(47);

		// Second tick — same target, should not deduct again
		system.execute(createDeps(createEventBus(), 2));
		expect(agent.get(WalletComponent).state.gold).toBe(47);
	});

	it('emits LeisureComplete when agent stops leisure', () => {
		const eventBus = createEventBus();
		const completeEvents: GameEvent[] = [];
		eventBus.on('LeisureComplete', (e) => { completeEvents.push(e); });

		const agent = new AgentActor(createTestAgentData('agent-1', 300, 200), defaultMoodConfig);
		agent.behaviorAgent = createStubBehaviorAgent({ btAction: 'leisure', leisureTarget: 'loc-tavern' });
		const tavern = createTavernLocation();
		const worldEntity = createWorldEntity();

		const system = createLeisureSystem(() => [agent], () => [tavern], () => worldEntity);

		// First tick — leisure starts
		system.execute(createDeps(eventBus, 1));
		expect(completeEvents).toHaveLength(0);

		// Agent switches to wander
		agent.behaviorAgent.btAction = 'wander';
		system.execute(createDeps(eventBus, 2));

		expect(completeEvents).toHaveLength(1);
		expect(completeEvents[0]?.payload.agentId).toBe('agent-1');
		expect(completeEvents[0]?.payload.locationId).toBe('loc-tavern');
	});

	it('skips agents not doing leisure', () => {
		const agent = new AgentActor(createTestAgentData('agent-1', 300, 200), defaultMoodConfig);
		agent.behaviorAgent = createStubBehaviorAgent({ btAction: 'work', leisureTarget: null });
		const tavern = createTavernLocation();
		const worldEntity = createWorldEntity();

		const system = createLeisureSystem(() => [agent], () => [tavern], () => worldEntity);
		system.execute(createDeps());

		const wallet = agent.get(WalletComponent);
		expect(wallet.state.gold).toBe(50); // unchanged
	});
});
