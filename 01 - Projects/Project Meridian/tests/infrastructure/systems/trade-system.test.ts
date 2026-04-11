import { describe, it, expect } from 'vitest';
import { Actor } from 'excalibur';
import { createTradeSystem } from '../../../src/infrastructure/systems/trade-system.js';
import { AgentActor } from '../../../src/infrastructure/entity/agent-actor.js';
import { FacilityComponent } from '../../../src/infrastructure/components/facility-component.js';
import { EconomyComponent } from '../../../src/infrastructure/components/economy-component.js';
import { WalletComponent } from '../../../src/infrastructure/components/wallet-component.js';
import { InventoryComponent } from '../../../src/infrastructure/components/inventory-component.js';
import { RelationshipComponent } from '../../../src/infrastructure/components/relationship-component.js';
import { MemoryComponent } from '../../../src/infrastructure/components/memory-component.js';
import { GameConfigSchema } from '../../../src/domain/schemas/game-config-schema.js';
import { createPerformanceTracker } from '../../../src/infrastructure/performance/performance-tracker.js';
import { createEventBus } from '../../../src/infrastructure/event-bus.js';
import type { GameCoreDeps } from '../../../src/domain/core/game-deps.js';
import type { GameEvent } from '../../../src/domain/core/events.js';
import type { WorldLocation } from '../../../src/domain/schemas/location-schema.js';
import type { BehaviorAgent } from '../../../src/domain/systems/behavior-agent.js';
import type { Item } from '../../../src/domain/schemas/item-schema.js';

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
		needs: { hunger: 50, energy: 50, social: 50, thirst: 50 },
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
		leisureTarget: null,
		commitmentTicks: 0,
		sleepDebt: 0,
		ticksRestedThisDay: 0,
		personalThresholds: { hunger: 40, energy: 30, thirst: 40 },
		priceMemories: [] as unknown as BehaviorAgent['priceMemories'],
		IsHungry: () => false, IsExhausted: () => false, IsRecovering: () => false, IsLonely: () => false,
		IsThirsty: () => false, HasWater: () => false,
		NeedsCritical: () => false, HasFood: () => false, HasFoodReserve: () => false,
		HasGold: () => false,
		CanAffordFood: () => false, AtLocation: () => false, NearLocation: () => false,
		NearAgent: () => false, NearAgentClose: () => false, IsDaytime: () => true,
		IsNighttime: () => false, IsWorkHours: () => false,
		HasJob: () => false, AtJobFacility: () => false,
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

function createBakeryLocation(): WorldLocation {
	return {
		id: 'loc-bakery',
		name: 'Bakery',
		type: 'work',
		position: { x: 100, y: 100, region: 'test' },
		capacity: 10,
		color: '#808080',
		production: {
			job: 'baker',
			output: { item_id: 'food', quantity: 1 },
			input: { item_id: 'wheat', quantity: 1 },
			wage: 5,
			ticks_per_cycle: 30,
		},
	};
}

function createWorldEntity(): Actor {
	const entity = new Actor();
	entity.addComponent(new EconomyComponent({
		treasury: 500,
		ledger: [],
		dailySummary: { totalWages: 0, totalTax: 0, totalSales: 0, totalConsumption: 0, avgWage: 0, wageSpread: 0, vacancyCount: 0, unemploymentCount: 0, jobSwitchesThisDay: 0, supplyDeliveries: 0, questsCompletedThisDay: 0 },
	}));
	return entity;
}

describe('TradeSystem', () => {
	it('agent buys food from facility with stock', () => {
		const eventBus = createEventBus();
		const events: GameEvent[] = [];
		eventBus.on('PurchaseComplete', (e) => { events.push(e); });

		const agent = new AgentActor(createTestAgentData('agent-1', 100, 100), defaultMoodConfig);
		agent.behaviorAgent = createStubBehaviorAgent({ btAction: 'buy' });

		const bakery = createBakeryLocation();
		const bakeryActor = new Actor();
		bakeryActor.addComponent(new FacilityComponent({
			stock: [{ item_id: 'food', quantity: 5 }],
			fund: 100,
			workProgress: 0,
			status: 'idle',
			workerId: null,
		}));

		const locationActors = new Map<string, Actor>([['loc-bakery', bakeryActor]]);
		const world = createWorldEntity();

		const system = createTradeSystem(
			() => [agent],
			() => [bakery],
			() => locationActors,
			() => world,
			() => new Map(),
		);
		system.execute(createDeps(eventBus));

		const wallet = agent.get(WalletComponent);
		expect(wallet.state.gold).toBe(47);

		const inv = agent.get(InventoryComponent);
		expect(inv.state.items).toContainEqual({ item_id: 'food', quantity: 1 });

		const facility = bakeryActor.get(FacilityComponent);
		expect(facility.state.stock).toContainEqual({ item_id: 'food', quantity: 4 });
		expect(facility.state.fund).toBe(103);

		expect(events.length).toBe(1);
		expect(events[0]?.payload.agentId).toBe('agent-1');
		expect(events[0]?.payload.facilityId).toBe('loc-bakery');
	});

	it('emits PurchaseFailed when agent has no gold', () => {
		const eventBus = createEventBus();
		const events: GameEvent[] = [];
		eventBus.on('PurchaseFailed', (e) => { events.push(e); });

		const agent = new AgentActor(createTestAgentData('agent-1', 100, 100, { wallet: { gold: 0 } }), defaultMoodConfig);
		agent.behaviorAgent = createStubBehaviorAgent({ btAction: 'buy' });

		const bakery = createBakeryLocation();
		const bakeryActor = new Actor();
		bakeryActor.addComponent(new FacilityComponent({
			stock: [{ item_id: 'food', quantity: 5 }],
			fund: 100,
			workProgress: 0,
			status: 'idle',
			workerId: null,
		}));

		const locationActors = new Map<string, Actor>([['loc-bakery', bakeryActor]]);
		const world = createWorldEntity();

		const system = createTradeSystem(
			() => [agent],
			() => [bakery],
			() => locationActors,
			() => world,
			() => new Map(),
		);
		system.execute(createDeps(eventBus));

		expect(events.length).toBe(1);
		expect(events[0]?.payload.reason).toBe('no_gold');

		const wallet = agent.get(WalletComponent);
		expect(wallet.state.gold).toBe(0);

		const facility = bakeryActor.get(FacilityComponent);
		expect(facility.state.stock).toContainEqual({ item_id: 'food', quantity: 5 });
	});

	it('agent buys tools via BuyItem — generalized TradeSystem handles non-food items', () => {
		const eventBus = createEventBus();
		const events: GameEvent[] = [];
		eventBus.on('PurchaseComplete', (e) => { events.push(e); });

		const agent = new AgentActor(createTestAgentData('agent-2', 50, 50), defaultMoodConfig);
		agent.behaviorAgent = createStubBehaviorAgent({ btAction: 'buy', buyTargetItem: 'tools' });

		const workshopLocation: WorldLocation = {
			id: 'loc-workshop',
			name: 'Workshop',
			type: 'work',
			position: { x: 50, y: 50, region: 'test' },
			capacity: 10,
			color: '#808080',
			production: {
				job: 'craftsman',
				output: { item_id: 'tools', quantity: 1 },
				input: null,
				wage: 5,
				ticks_per_cycle: 30,
			},
		};
		const workshopActor = new Actor();
		workshopActor.addComponent(new FacilityComponent({
			stock: [{ item_id: 'tools', quantity: 3 }],
			fund: 200,
			workProgress: 0,
			status: 'idle',
			workerId: null,
		}));

		const locationActors = new Map<string, Actor>([['loc-workshop', workshopActor]]);
		const world = createWorldEntity();

		const system = createTradeSystem(
			() => [agent],
			() => [workshopLocation],
			() => locationActors,
			() => world,
			() => new Map(),
		);
		system.execute(createDeps(eventBus));

		const inv = agent.get(InventoryComponent);
		expect(inv.state.items).toContainEqual({ item_id: 'tools', quantity: 1 });

		const facility = workshopActor.get(FacilityComponent);
		expect(facility.state.stock).toContainEqual({ item_id: 'tools', quantity: 2 });

		expect(events.length).toBe(1);
		expect(events[0]?.payload.itemId).toBe('tools');
	});

	it('backward compat — Buy() without buyTargetItem defaults to food', () => {
		const eventBus = createEventBus();
		const events: GameEvent[] = [];
		eventBus.on('PurchaseComplete', (e) => { events.push(e); });

		const agent = new AgentActor(createTestAgentData('agent-3', 100, 100), defaultMoodConfig);
		// btAction='buy' but buyTargetItem is null (backward compat with Buy())
		agent.behaviorAgent = createStubBehaviorAgent({ btAction: 'buy', buyTargetItem: null });

		const bakery = createBakeryLocation();
		const bakeryActor = new Actor();
		bakeryActor.addComponent(new FacilityComponent({
			stock: [{ item_id: 'food', quantity: 5 }],
			fund: 100,
			workProgress: 0,
			status: 'idle',
			workerId: null,
		}));

		const locationActors = new Map<string, Actor>([['loc-bakery', bakeryActor]]);
		const world = createWorldEntity();

		const system = createTradeSystem(
			() => [agent],
			() => [bakery],
			() => locationActors,
			() => world,
			() => new Map(),
		);
		system.execute(createDeps(eventBus));

		const inv = agent.get(InventoryComponent);
		expect(inv.state.items).toContainEqual({ item_id: 'food', quantity: 1 });

		expect(events.length).toBe(1);
		expect(events[0]?.payload.itemId).toBe('food');
	});

	it('does not buy when buyTargetItem is set but facility has different stock', () => {
		const agent = new AgentActor(createTestAgentData('agent-4', 100, 100), defaultMoodConfig);
		// Agent wants tools but facility only has food
		agent.behaviorAgent = createStubBehaviorAgent({ btAction: 'buy', buyTargetItem: 'tools' });

		const bakery = createBakeryLocation();
		const bakeryActor = new Actor();
		bakeryActor.addComponent(new FacilityComponent({
			stock: [{ item_id: 'food', quantity: 5 }],
			fund: 100,
			workProgress: 0,
			status: 'idle',
			workerId: null,
		}));

		const locationActors = new Map<string, Actor>([['loc-bakery', bakeryActor]]);
		const world = createWorldEntity();

		const system = createTradeSystem(
			() => [agent],
			() => [bakery],
			() => locationActors,
			() => world,
			() => new Map(),
		);
		system.execute(createDeps());

		const inv = agent.get(InventoryComponent);
		expect(inv.state.items).toHaveLength(0);

		const facility = bakeryActor.get(FacilityComponent);
		expect(facility.state.stock).toContainEqual({ item_id: 'food', quantity: 5 });
	});

	it('skips agents whose btAction is not buy', () => {
		const agent = new AgentActor(createTestAgentData('agent-idle', 100, 100), defaultMoodConfig);
		agent.behaviorAgent = createStubBehaviorAgent({ btAction: 'idle' });

		const bakery = createBakeryLocation();
		const bakeryActor = new Actor();
		bakeryActor.addComponent(new FacilityComponent({
			stock: [{ item_id: 'food', quantity: 5 }],
			fund: 100,
			workProgress: 0,
			status: 'idle',
			workerId: null,
		}));

		const locationActors = new Map<string, Actor>([['loc-bakery', bakeryActor]]);
		const world = createWorldEntity();

		const system = createTradeSystem(
			() => [agent],
			() => [bakery],
			() => locationActors,
			() => world,
			() => new Map(),
		);
		system.execute(createDeps());

		// Wallet and stock unchanged — agent was skipped entirely
		const wallet = agent.get(WalletComponent);
		expect(wallet.state.gold).toBe(50);

		const facility = bakeryActor.get(FacilityComponent);
		expect(facility.state.stock).toContainEqual({ item_id: 'food', quantity: 5 });
	});

	it('falls back to config food_price when item not in registry and no currentPrices', () => {
		const eventBus = createEventBus();
		const events: GameEvent[] = [];
		eventBus.on('PurchaseComplete', (e) => { events.push(e); });

		const agent = new AgentActor(createTestAgentData('agent-fallback', 100, 100, { wallet: { gold: 200 } }), defaultMoodConfig);
		agent.behaviorAgent = createStubBehaviorAgent({ btAction: 'buy' });

		const bakery = createBakeryLocation();
		const bakeryActor = new Actor();
		bakeryActor.addComponent(new FacilityComponent({
			stock: [{ item_id: 'food', quantity: 5 }],
			fund: 50,
			workProgress: 0,
			status: 'idle',
			workerId: null,
			// No currentPrices set
		}));

		const locationActors = new Map<string, Actor>([['loc-bakery', bakeryActor]]);
		const world = createWorldEntity();
		const deps = createDeps(eventBus);
		const configFoodPrice = deps.config.economy.food_price;

		const system = createTradeSystem(
			() => [agent],
			() => [bakery],
			() => locationActors,
			() => world,
			() => new Map(), // empty item registry — forces food_price fallback
		);
		system.execute(deps);

		expect(events.length).toBe(1);
		expect(events[0]?.payload.price).toBe(configFoodPrice);
	});

	it('emits GoldFlowed event on successful trade', () => {
		const eventBus = createEventBus();
		const goldFlows: GameEvent[] = [];
		eventBus.on('GoldFlowed', (e) => { goldFlows.push(e); });

		const agent = new AgentActor(createTestAgentData('agent-gold', 100, 100), defaultMoodConfig);
		agent.behaviorAgent = createStubBehaviorAgent({ btAction: 'buy' });

		const bakery = createBakeryLocation();
		const bakeryActor = new Actor();
		bakeryActor.addComponent(new FacilityComponent({
			stock: [{ item_id: 'food', quantity: 5 }],
			fund: 100,
			workProgress: 0,
			status: 'idle',
			workerId: null,
		}));

		const locationActors = new Map<string, Actor>([['loc-bakery', bakeryActor]]);
		const world = createWorldEntity();

		const system = createTradeSystem(
			() => [agent],
			() => [bakery],
			() => locationActors,
			() => world,
			() => new Map(),
		);
		system.execute(createDeps(eventBus));

		expect(goldFlows.length).toBe(1);
		expect(goldFlows[0]?.payload.category).toBe('transfer');
		expect(goldFlows[0]?.payload.subcategory).toBe('purchase');
		expect(goldFlows[0]?.payload.fromEntity).toBe('agent-gold');
		expect(goldFlows[0]?.payload.toEntity).toBe('loc-bakery');
	});

	it('creates relationship between buyer and facility worker', () => {
		const agent = new AgentActor(createTestAgentData('agent-rel', 100, 100), defaultMoodConfig);
		agent.behaviorAgent = createStubBehaviorAgent({ btAction: 'buy' });

		const bakery = createBakeryLocation();
		const bakeryActor = new Actor();
		bakeryActor.addComponent(new FacilityComponent({
			stock: [{ item_id: 'food', quantity: 5 }],
			fund: 100,
			workProgress: 0,
			status: 'idle',
			workerId: 'worker-1', // facility has a worker
		}));

		const locationActors = new Map<string, Actor>([['loc-bakery', bakeryActor]]);
		const world = createWorldEntity();

		const system = createTradeSystem(
			() => [agent],
			() => [bakery],
			() => locationActors,
			() => world,
			() => new Map(),
		);
		system.execute(createDeps());

		const relComp = agent.get(RelationshipComponent);
		const workerRel = relComp.state.entries.find(e => e.agentId === 'worker-1');
		expect(workerRel).toBeDefined();
		expect(workerRel?.tags).toContain('traded_with');
		expect(workerRel?.familiarity).toBeGreaterThan(0);
	});

	it('creates a positive memory for the buyer on successful purchase', () => {
		const agent = new AgentActor(createTestAgentData('agent-mem', 100, 100), defaultMoodConfig);
		agent.behaviorAgent = createStubBehaviorAgent({ btAction: 'buy' });

		const bakery = createBakeryLocation();
		const bakeryActor = new Actor();
		bakeryActor.addComponent(new FacilityComponent({
			stock: [{ item_id: 'food', quantity: 5 }],
			fund: 100,
			workProgress: 0,
			status: 'idle',
			workerId: null,
		}));

		const locationActors = new Map<string, Actor>([['loc-bakery', bakeryActor]]);
		const world = createWorldEntity();

		const system = createTradeSystem(
			() => [agent],
			() => [bakery],
			() => locationActors,
			() => world,
			() => new Map(),
		);
		system.execute(createDeps());

		const memComp = agent.get(MemoryComponent);
		const purchaseMemory = memComp.state.entries.find(e => e.type.includes('purchase'));
		expect(purchaseMemory).toBeDefined();
		expect(purchaseMemory?.outcome).toBe('positive');
		expect(purchaseMemory?.significance).toBe(3);
		expect(purchaseMemory?.mood_impact).toBe(2);
		expect(purchaseMemory?.participants).toContain('loc-bakery');
	});

	it('uses item registry baseValue when currentPrices not set', () => {
		const eventBus = createEventBus();
		const events: GameEvent[] = [];
		eventBus.on('PurchaseComplete', (e) => { events.push(e); });

		const agent = new AgentActor(createTestAgentData('agent-reg', 100, 100, { wallet: { gold: 200 } }), defaultMoodConfig);
		agent.behaviorAgent = createStubBehaviorAgent({ btAction: 'buy' });

		const bakery = createBakeryLocation();
		const bakeryActor = new Actor();
		bakeryActor.addComponent(new FacilityComponent({
			stock: [{ item_id: 'food', quantity: 5 }],
			fund: 100,
			workProgress: 0,
			status: 'idle',
			workerId: null,
			// No currentPrices
		}));

		const locationActors = new Map<string, Actor>([['loc-bakery', bakeryActor]]);
		const world = createWorldEntity();

		const itemReg = new Map<string, Item>([
			['food', { id: 'food', name: 'Food', baseValue: 7, category: 'subsistence' } as Item],
		]);

		const system = createTradeSystem(
			() => [agent],
			() => [bakery],
			() => locationActors,
			() => world,
			() => itemReg,
		);
		system.execute(createDeps(eventBus));

		expect(events.length).toBe(1);
		// Price should use item registry baseValue (7) since no currentPrices
		expect(events[0]?.payload.price).toBe(7);
	});
});
