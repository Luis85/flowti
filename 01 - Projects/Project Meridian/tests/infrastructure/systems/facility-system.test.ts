import { describe, it, expect } from 'vitest';
import { Actor } from 'excalibur';
import { createFacilitySystem } from '../../../src/infrastructure/systems/facility-system.js';
import { AgentActor } from '../../../src/infrastructure/entity/agent-actor.js';
import { FacilityComponent } from '../../../src/infrastructure/components/facility-component.js';
import { EconomyComponent } from '../../../src/infrastructure/components/economy-component.js';
import { WalletComponent } from '../../../src/infrastructure/components/wallet-component.js';
import { InventoryComponent } from '../../../src/infrastructure/components/inventory-component.js';
import { GameConfigSchema } from '../../../src/domain/schemas/game-config-schema.js';
import { createPerformanceTracker } from '../../../src/infrastructure/performance/performance-tracker.js';
import { createEventBus } from '../../../src/infrastructure/event-bus.js';
import type { GameCoreDeps } from '../../../src/domain/core/game-deps.js';
import type { GameEvent } from '../../../src/domain/core/events.js';
import type { WorldLocation } from '../../../src/domain/schemas/location-schema.js';
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
		attributes: { ST: 12, DX: 12, IQ: 12, HT: 12 },
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

function createFarmLocation(): WorldLocation {
	return {
		id: 'loc-farm',
		name: 'Farm',
		type: 'work',
		position: { x: 100, y: 100, region: 'test' },
		capacity: 10,
		color: '#808080',
		production: {
			job: 'farmer',
			output: { item_id: 'wheat', quantity: 1 },
			input: null,
			wage: 5,
			ticks_per_cycle: 30,
			funding: 'facility' as const,
		},
	};
}

function createBakeryLocation(): WorldLocation {
	return {
		id: 'loc-bakery',
		name: 'Bakery',
		type: 'work',
		position: { x: 200, y: 200, region: 'test' },
		capacity: 10,
		color: '#808080',
		production: {
			job: 'baker',
			output: { item_id: 'bread', quantity: 1 },
			input: { item_id: 'wheat', quantity: 1 },
			wage: 5,
			ticks_per_cycle: 30,
			funding: 'facility' as const,
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

describe('FacilitySystem', () => {
	it('increments workProgress when worker is at facility with correct job', () => {
		const eventBus = createEventBus();
		const agent = new AgentActor(createTestAgentData('agent-1', 100, 100, { job: 'farmer' }), defaultMoodConfig);
		agent.behaviorAgent = createStubBehaviorAgent({ btAction: 'work' });

		const farm = createFarmLocation();
		const farmActor = new Actor();
		farmActor.addComponent(new FacilityComponent({
			stock: [],
			fund: 200,
			workProgress: 0,
			status: 'idle',
			workerId: 'agent-1',
		}));

		const locationActors = new Map<string, Actor>([['loc-farm', farmActor]]);
		const world = createWorldEntity();

		const system = createFacilitySystem(
			() => [agent],
			() => [farm],
			() => locationActors,
			() => world,
		);
		system.execute(createDeps(eventBus));

		const facility = farmActor.get(FacilityComponent);
		expect(facility.state.workProgress).toBe(1);
		expect(facility.state.status).toBe('producing');
		expect(facility.state.workerId).toBe('agent-1');
	});

	it('pays wage and collects tax on cycle complete', () => {
		const eventBus = createEventBus();
		const events: GameEvent[] = [];
		eventBus.on('ProductionComplete', (e) => { events.push(e); });

		const agent = new AgentActor(createTestAgentData('agent-1', 100, 100, { job: 'farmer' }), defaultMoodConfig);
		agent.behaviorAgent = createStubBehaviorAgent({ btAction: 'work' });

		const farm = createFarmLocation();
		const farmActor = new Actor();
		farmActor.addComponent(new FacilityComponent({
			stock: [],
			fund: 200,
			workProgress: 29,
			status: 'producing',
			workerId: 'agent-1',
		}));

		const locationActors = new Map<string, Actor>([['loc-farm', farmActor]]);
		const world = createWorldEntity();

		const system = createFacilitySystem(
			() => [agent],
			() => [farm],
			() => locationActors,
			() => world,
		);
		system.execute(createDeps(eventBus));

		const facility = farmActor.get(FacilityComponent);
		expect(facility.state.workProgress).toBe(0);
		expect(facility.state.stock).toEqual([{ item_id: 'wheat', quantity: 1 }]);
		expect(facility.state.fund).toBe(195);

		const wallet = agent.get(WalletComponent);
		expect(wallet.state.gold).toBeCloseTo(54.50);

		const economy = world.get(EconomyComponent);
		expect(economy.state.treasury).toBeCloseTo(500.50);

		expect(events.length).toBe(1);
		expect(events[0]?.payload.facilityId).toBe('loc-farm');
		expect(events[0]?.payload.workerId).toBe('agent-1');
	});

	it('remains idle when no worker is present', () => {
		const eventBus = createEventBus();
		const events: GameEvent[] = [];
		eventBus.on('FacilityIdle', (e) => { events.push(e); });

		const farm = createFarmLocation();
		const farmActor = new Actor();
		farmActor.addComponent(new FacilityComponent({
			stock: [],
			fund: 200,
			workProgress: 0,
			status: 'idle',
			workerId: null,
		}));

		const locationActors = new Map<string, Actor>([['loc-farm', farmActor]]);
		const world = createWorldEntity();

		const system = createFacilitySystem(
			() => [],
			() => [farm],
			() => locationActors,
			() => world,
		);
		system.execute(createDeps(eventBus));

		const facility = farmActor.get(FacilityComponent);
		expect(facility.state.workProgress).toBe(0);
		expect(facility.state.status).toBe('idle');

		expect(events.length).toBe(1);
		expect(events[0]?.payload.reason).toBe('no_worker');
	});

	it('bakery remains idle when no wheat in stock', () => {
		const eventBus = createEventBus();
		const events: GameEvent[] = [];
		eventBus.on('FacilityIdle', (e) => { events.push(e); });

		const agent = new AgentActor(createTestAgentData('agent-1', 200, 200, { job: 'baker' }), defaultMoodConfig);
		agent.behaviorAgent = createStubBehaviorAgent({ btAction: 'work' });

		const bakery = createBakeryLocation();
		const bakeryActor = new Actor();
		bakeryActor.addComponent(new FacilityComponent({
			stock: [],
			fund: 200,
			workProgress: 0,
			status: 'idle',
			workerId: 'agent-1',
		}));

		const locationActors = new Map<string, Actor>([['loc-bakery', bakeryActor]]);
		const world = createWorldEntity();

		const system = createFacilitySystem(
			() => [agent],
			() => [bakery],
			() => locationActors,
			() => world,
		);
		system.execute(createDeps(eventBus));

		const facility = bakeryActor.get(FacilityComponent);
		expect(facility.state.workProgress).toBe(0);
		expect(facility.state.status).toBe('idle');

		expect(events.length).toBe(1);
		expect(events[0]?.payload.reason).toBe('no_input');
	});

	it('bakery consumes wheat on cycle complete', () => {
		const eventBus = createEventBus();
		const events: GameEvent[] = [];
		eventBus.on('ProductionComplete', (e) => { events.push(e); });

		const agent = new AgentActor(createTestAgentData('agent-1', 200, 200, { job: 'baker' }), defaultMoodConfig);
		agent.behaviorAgent = createStubBehaviorAgent({ btAction: 'work' });

		const bakery = createBakeryLocation();
		const bakeryActor = new Actor();
		bakeryActor.addComponent(new FacilityComponent({
			stock: [{ item_id: 'wheat', quantity: 2 }],
			fund: 200,
			workProgress: 29,
			status: 'producing',
			workerId: 'agent-1',
		}));

		const locationActors = new Map<string, Actor>([['loc-bakery', bakeryActor]]);
		const world = createWorldEntity();

		const system = createFacilitySystem(
			() => [agent],
			() => [bakery],
			() => locationActors,
			() => world,
		);
		system.execute(createDeps(eventBus));

		const facility = bakeryActor.get(FacilityComponent);
		expect(facility.state.stock).toContainEqual({ item_id: 'wheat', quantity: 1 });
		expect(facility.state.stock).toContainEqual({ item_id: 'bread', quantity: 1 });
		expect(facility.state.workProgress).toBe(0);

		expect(events.length).toBe(1);
		expect(events[0]?.payload.outputItem).toBe('bread');
	});

	it('private zero-wage production routes output to worker inventory, not facility stock', () => {
		const eventBus = createEventBus();

		const agent = new AgentActor(createTestAgentData('craftsman-1', 50, 50, { job: 'craftsman' }), defaultMoodConfig);
		agent.behaviorAgent = createStubBehaviorAgent({ btAction: 'work', job: 'craftsman' });

		const workshopLocation: WorldLocation = {
			id: 'loc-workshop',
			name: 'Workshop',
			type: 'work',
			position: { x: 50, y: 50, region: 'test' },
			capacity: 10,
			color: '#808080',
			production: {
				job: 'craftsman',
				output: { item_id: 'iron_tool', quantity: 1 },
				input: null,
				wage: 0,
				ticks_per_cycle: 30,
				funding: 'facility' as const,
			},
		};

		const workshopActor = new Actor();
		workshopActor.addComponent(new FacilityComponent({
			stock: [],
			fund: 0,
			workProgress: 29,
			status: 'producing',
			workerId: 'craftsman-1',
		}));

		const locationActors = new Map<string, Actor>([['loc-workshop', workshopActor]]);
		const world = createWorldEntity();

		const system = createFacilitySystem(
			() => [agent],
			() => [workshopLocation],
			() => locationActors,
			() => world,
		);
		system.execute(createDeps(eventBus));

		// Output must be in worker inventory
		const inv = agent.get(InventoryComponent);
		expect(inv.state.items).toContainEqual({ item_id: 'iron_tool', quantity: 1 });

		// Output must NOT be in facility stock
		const facility = workshopActor.get(FacilityComponent);
		const stockItem = facility.state.stock.find(s => s.item_id === 'iron_tool');
		expect(stockItem).toBeUndefined();
	});

	it('normal waged facility production still routes output to facility stock', () => {
		const eventBus = createEventBus();

		const agent = new AgentActor(createTestAgentData('agent-1', 100, 100, { job: 'farmer' }), defaultMoodConfig);
		agent.behaviorAgent = createStubBehaviorAgent({ btAction: 'work', job: 'farmer' });

		const farm = createFarmLocation();
		const farmActor = new Actor();
		farmActor.addComponent(new FacilityComponent({
			stock: [],
			fund: 200,
			workProgress: 29,
			status: 'producing',
			workerId: 'agent-1',
		}));

		const locationActors = new Map<string, Actor>([['loc-farm', farmActor]]);
		const world = createWorldEntity();

		const system = createFacilitySystem(
			() => [agent],
			() => [farm],
			() => locationActors,
			() => world,
		);
		system.execute(createDeps(eventBus));

		// Output must be in facility stock (normal waged behaviour)
		const facility = farmActor.get(FacilityComponent);
		expect(facility.state.stock).toContainEqual({ item_id: 'wheat', quantity: 1 });

		// Worker inventory must NOT contain the output
		const inv = agent.get(InventoryComponent);
		const workerWheat = inv.state.items.find(i => i.item_id === 'wheat');
		expect(workerWheat).toBeUndefined();
	});

	it('worker with tools gets doubled food output and 1 charge consumed', () => {
		const eventBus = createEventBus();

		const agent = new AgentActor(createTestAgentData('agent-1', 50, 50, { job: 'farmer' }), defaultMoodConfig);
		agent.behaviorAgent = createStubBehaviorAgent({ btAction: 'work', job: 'farmer' });

		// Give worker tools with charges
		const inv = agent.get(InventoryComponent);
		inv.state = { items: [{ item_id: 'tools', quantity: 1, charges: 5 }] };

		const foodFarm: WorldLocation = {
			id: 'loc-food-farm',
			name: 'Food Farm',
			type: 'food',
			position: { x: 50, y: 50, region: 'test' },
			capacity: 10,
			color: '#808080',
			production: {
				job: 'farmer',
				output: { item_id: 'food', quantity: 1 },
				input: null,
				wage: 5,
				ticks_per_cycle: 30,
				funding: 'facility' as const,
			},
		};

		const farmActor = new Actor();
		farmActor.addComponent(new FacilityComponent({
			stock: [],
			fund: 200,
			workProgress: 29,
			status: 'producing',
			workerId: 'agent-1',
		}));

		const locationActors = new Map<string, Actor>([['loc-food-farm', farmActor]]);
		const world = createWorldEntity();

		const system = createFacilitySystem(
			() => [agent],
			() => [foodFarm],
			() => locationActors,
			() => world,
		);
		system.execute(createDeps(eventBus));

		// Output quantity should be doubled (multiplier = 2)
		const facility = farmActor.get(FacilityComponent);
		expect(facility.state.stock).toContainEqual({ item_id: 'food', quantity: 2 });

		// Tools charges should be reduced by 1
		const workerInv = agent.get(InventoryComponent);
		const toolsItem = workerInv.state.items.find(i => i.item_id === 'tools');
		expect(toolsItem).toBeDefined();
		expect(toolsItem?.charges).toBe(4);
	});

	it('worker without tools gets normal food output quantity', () => {
		const eventBus = createEventBus();

		const agent = new AgentActor(createTestAgentData('agent-1', 50, 50, { job: 'farmer' }), defaultMoodConfig);
		agent.behaviorAgent = createStubBehaviorAgent({ btAction: 'work', job: 'farmer' });

		// Worker has no tools
		const inv = agent.get(InventoryComponent);
		inv.state = { items: [] };

		const foodFarm: WorldLocation = {
			id: 'loc-food-farm',
			name: 'Food Farm',
			type: 'food',
			position: { x: 50, y: 50, region: 'test' },
			capacity: 10,
			color: '#808080',
			production: {
				job: 'farmer',
				output: { item_id: 'food', quantity: 1 },
				input: null,
				wage: 5,
				ticks_per_cycle: 30,
				funding: 'facility' as const,
			},
		};

		const farmActor = new Actor();
		farmActor.addComponent(new FacilityComponent({
			stock: [],
			fund: 200,
			workProgress: 29,
			status: 'producing',
			workerId: 'agent-1',
		}));

		const locationActors = new Map<string, Actor>([['loc-food-farm', farmActor]]);
		const world = createWorldEntity();

		const system = createFacilitySystem(
			() => [agent],
			() => [foodFarm],
			() => locationActors,
			() => world,
		);
		system.execute(createDeps(eventBus));

		// Output quantity should be 1 (no multiplier)
		const facility = farmActor.get(FacilityComponent);
		expect(facility.state.stock).toContainEqual({ item_id: 'food', quantity: 1 });
	});

	it('tools do not boost non-food production output', () => {
		const eventBus = createEventBus();

		const agent = new AgentActor(createTestAgentData('craftsman-1', 50, 50, { job: 'craftsman' }), defaultMoodConfig);
		agent.behaviorAgent = createStubBehaviorAgent({ btAction: 'work', job: 'craftsman' });

		// Worker has tools with charges
		const inv = agent.get(InventoryComponent);
		inv.state = { items: [{ item_id: 'tools', quantity: 1, charges: 5 }] };

		const workshopLocation: WorldLocation = {
			id: 'loc-workshop',
			name: 'Workshop',
			type: 'work',
			position: { x: 50, y: 50, region: 'test' },
			capacity: 10,
			color: '#808080',
			production: {
				job: 'craftsman',
				output: { item_id: 'iron_tool', quantity: 1 },
				input: null,
				wage: 0,
				ticks_per_cycle: 30,
				funding: 'facility' as const,
			},
		};

		const workshopActor = new Actor();
		workshopActor.addComponent(new FacilityComponent({
			stock: [],
			fund: 0,
			workProgress: 29,
			status: 'producing',
			workerId: 'craftsman-1',
		}));

		const locationActors = new Map<string, Actor>([['loc-workshop', workshopActor]]);
		const world = createWorldEntity();

		const system = createFacilitySystem(
			() => [agent],
			() => [workshopLocation],
			() => locationActors,
			() => world,
		);
		system.execute(createDeps(eventBus));

		// Output goes to worker inventory (private production), quantity should be 1 (no multiplier for non-food)
		const workerInv = agent.get(InventoryComponent);
		expect(workerInv.state.items).toContainEqual({ item_id: 'iron_tool', quantity: 1 });

		// Tools charges should NOT be consumed (no boost for non-food)
		const toolsItem = workerInv.state.items.find(i => i.item_id === 'tools');
		expect(toolsItem).toBeDefined();
		expect(toolsItem?.charges).toBe(5);
	});

	it('tools with 0 charges do not boost output', () => {
		const eventBus = createEventBus();

		const agent = new AgentActor(createTestAgentData('agent-1', 50, 50, { job: 'farmer' }), defaultMoodConfig);
		agent.behaviorAgent = createStubBehaviorAgent({ btAction: 'work', job: 'farmer' });

		// Worker has tools but with 0 charges
		const inv = agent.get(InventoryComponent);
		inv.state = { items: [{ item_id: 'tools', quantity: 1, charges: 0 }] };

		const foodFarm: WorldLocation = {
			id: 'loc-food-farm',
			name: 'Food Farm',
			type: 'food',
			position: { x: 50, y: 50, region: 'test' },
			capacity: 10,
			color: '#808080',
			production: {
				job: 'farmer',
				output: { item_id: 'food', quantity: 1 },
				input: null,
				wage: 5,
				ticks_per_cycle: 30,
				funding: 'facility' as const,
			},
		};

		const farmActor = new Actor();
		farmActor.addComponent(new FacilityComponent({
			stock: [],
			fund: 200,
			workProgress: 29,
			status: 'producing',
			workerId: 'agent-1',
		}));

		const locationActors = new Map<string, Actor>([['loc-food-farm', farmActor]]);
		const world = createWorldEntity();

		const system = createFacilitySystem(
			() => [agent],
			() => [foodFarm],
			() => locationActors,
			() => world,
		);
		system.execute(createDeps(eventBus));

		// Output should be normal quantity (tools have 0 charges, no boost)
		const facility = farmActor.get(FacilityComponent);
		expect(facility.state.stock).toContainEqual({ item_id: 'food', quantity: 1 });
	});

	it('tools with 1 charge are removed from inventory after consumption', () => {
		const eventBus = createEventBus();

		const agent = new AgentActor(createTestAgentData('agent-1', 50, 50, { job: 'farmer' }), defaultMoodConfig);
		agent.behaviorAgent = createStubBehaviorAgent({ btAction: 'work', job: 'farmer' });

		// Worker has tools with exactly 1 charge
		const inv = agent.get(InventoryComponent);
		inv.state = { items: [{ item_id: 'tools', quantity: 1, charges: 1 }] };

		const foodFarm: WorldLocation = {
			id: 'loc-food-farm',
			name: 'Food Farm',
			type: 'food',
			position: { x: 50, y: 50, region: 'test' },
			capacity: 10,
			color: '#808080',
			production: {
				job: 'farmer',
				output: { item_id: 'food', quantity: 1 },
				input: null,
				wage: 5,
				ticks_per_cycle: 30,
				funding: 'facility' as const,
			},
		};

		const farmActor = new Actor();
		farmActor.addComponent(new FacilityComponent({
			stock: [],
			fund: 200,
			workProgress: 29,
			status: 'producing',
			workerId: 'agent-1',
		}));

		const locationActors = new Map<string, Actor>([['loc-food-farm', farmActor]]);
		const world = createWorldEntity();

		const system = createFacilitySystem(
			() => [agent],
			() => [foodFarm],
			() => locationActors,
			() => world,
		);
		system.execute(createDeps(eventBus));

		// Output should be doubled
		const facility = farmActor.get(FacilityComponent);
		expect(facility.state.stock).toContainEqual({ item_id: 'food', quantity: 2 });

		// Tools should be removed (charges went to 0)
		const workerInv = agent.get(InventoryComponent);
		const toolsItem = workerInv.state.items.find(i => i.item_id === 'tools');
		expect(toolsItem).toBeUndefined();
	});

	it('private production adds to existing inventory item quantity', () => {
		const eventBus = createEventBus();

		const agent = new AgentActor(createTestAgentData('craftsman-1', 50, 50, { job: 'craftsman' }), defaultMoodConfig);
		agent.behaviorAgent = createStubBehaviorAgent({ btAction: 'work', job: 'craftsman' });

		// Pre-populate worker inventory with 3 iron_tools already
		const inv = agent.get(InventoryComponent);
		inv.state = { items: [{ item_id: 'iron_tool', quantity: 3 }] };

		const workshopLocation: WorldLocation = {
			id: 'loc-workshop',
			name: 'Workshop',
			type: 'work',
			position: { x: 50, y: 50, region: 'test' },
			capacity: 10,
			color: '#808080',
			production: {
				job: 'craftsman',
				output: { item_id: 'iron_tool', quantity: 1 },
				input: null,
				wage: 0,
				ticks_per_cycle: 30,
				funding: 'facility' as const,
			},
		};

		const workshopActor = new Actor();
		workshopActor.addComponent(new FacilityComponent({
			stock: [],
			fund: 0,
			workProgress: 29,
			status: 'producing',
			workerId: 'craftsman-1',
		}));

		const locationActors = new Map<string, Actor>([['loc-workshop', workshopActor]]);
		const world = createWorldEntity();

		const system = createFacilitySystem(
			() => [agent],
			() => [workshopLocation],
			() => locationActors,
			() => world,
		);
		system.execute(createDeps(eventBus));

		// Existing quantity should be incremented
		const workerInv = agent.get(InventoryComponent);
		const ironTool = workerInv.state.items.find(i => i.item_id === 'iron_tool');
		expect(ironTool).toBeDefined();
		expect(ironTool!.quantity).toBe(4);
	});

	it('emits FacilityInsolvent when facility fund reaches zero after paying wage', () => {
		const eventBus = createEventBus();
		const events: GameEvent[] = [];
		eventBus.on('FacilityInsolvent', (e) => { events.push(e); });

		const agent = new AgentActor(createTestAgentData('agent-1', 100, 100, { job: 'farmer' }), defaultMoodConfig);
		agent.behaviorAgent = createStubBehaviorAgent({ btAction: 'work', job: 'farmer' });

		const farm = createFarmLocation();
		const farmActor = new Actor();
		farmActor.addComponent(new FacilityComponent({
			stock: [],
			fund: 5, // Exactly one wage — fund will be 0 after paying
			workProgress: 29,
			status: 'producing',
			workerId: 'agent-1',
		}));

		const locationActors = new Map<string, Actor>([['loc-farm', farmActor]]);
		const world = createWorldEntity();

		const system = createFacilitySystem(
			() => [agent],
			() => [farm],
			() => locationActors,
			() => world,
		);
		system.execute(createDeps(eventBus));

		const facility = farmActor.get(FacilityComponent);
		expect(facility.state.fund).toBe(0);
		expect(events.length).toBe(1);
		expect(events[0]?.payload.facilityId).toBe('loc-farm');
		expect(events[0]?.payload.fund).toBe(0);
	});

	it('auto-process facility produces without a worker', () => {
		const eventBus = createEventBus();
		const events: GameEvent[] = [];
		eventBus.on('ProductionComplete', (e) => { events.push(e); });

		const wellLocation: WorldLocation = {
			id: 'loc-well',
			name: 'Well',
			type: 'water',
			position: { x: 50, y: 50, region: 'test' },
			capacity: 10,
			color: '#808080',
			production: {
				job: 'none',
				output: { item_id: 'water', quantity: 1 },
				input: null,
				wage: 0,
				ticks_per_cycle: 30,
				auto_process: true,
				auto_ticks_per_cycle: 10,
				funding: 'facility' as const,
			},
		};

		const wellActor = new Actor();
		wellActor.addComponent(new FacilityComponent({
			stock: [],
			fund: 0,
			workProgress: 9, // One tick away from auto cycle completion
			status: 'auto',
			workerId: null,
		}));

		const locationActors = new Map<string, Actor>([['loc-well', wellActor]]);
		const world = createWorldEntity();

		const system = createFacilitySystem(
			() => [], // no agents at all
			() => [wellLocation],
			() => locationActors,
			() => world,
		);
		system.execute(createDeps(eventBus));

		// Auto-process should complete — output in stock
		const facility = wellActor.get(FacilityComponent);
		expect(facility.state.stock).toContainEqual({ item_id: 'water', quantity: 1 });
		expect(facility.state.workProgress).toBe(0);
		expect(facility.state.status).toBe('auto');

		// ProductionComplete emitted with workerId=null
		expect(events.length).toBe(1);
		expect(events[0]?.payload.workerId).toBeNull();
		expect(events[0]?.payload.facilityId).toBe('loc-well');
	});

	it('auto-process facility increments progress without completing', () => {
		const eventBus = createEventBus();

		const wellLocation: WorldLocation = {
			id: 'loc-well',
			name: 'Well',
			type: 'water',
			position: { x: 50, y: 50, region: 'test' },
			capacity: 10,
			color: '#808080',
			production: {
				job: 'none',
				output: { item_id: 'water', quantity: 1 },
				input: null,
				wage: 0,
				ticks_per_cycle: 30,
				auto_process: true,
				auto_ticks_per_cycle: 10,
				funding: 'facility' as const,
			},
		};

		const wellActor = new Actor();
		wellActor.addComponent(new FacilityComponent({
			stock: [],
			fund: 0,
			workProgress: 5,
			status: 'auto',
			workerId: null,
		}));

		const locationActors = new Map<string, Actor>([['loc-well', wellActor]]);
		const world = createWorldEntity();

		const system = createFacilitySystem(
			() => [],
			() => [wellLocation],
			() => locationActors,
			() => world,
		);
		system.execute(createDeps(eventBus));

		const facility = wellActor.get(FacilityComponent);
		expect(facility.state.workProgress).toBe(6);
		expect(facility.state.status).toBe('auto');
	});

	it('treasury-funded facility pays wage from treasury, not facility fund', () => {
		const eventBus = createEventBus();
		const events: GameEvent[] = [];
		eventBus.on('GoldFlowed', (e) => {
			if (e.payload.subcategory === 'public_wage') events.push(e);
		});

		const agent = new AgentActor(createTestAgentData('guard-1', 100, 100, { job: 'guard' }), defaultMoodConfig);
		agent.behaviorAgent = createStubBehaviorAgent({ btAction: 'work', job: 'guard' });

		const guardPostLocation: WorldLocation = {
			id: 'loc-guardpost',
			name: 'Guard Post',
			type: 'work',
			position: { x: 100, y: 100, region: 'test' },
			capacity: 10,
			color: '#808080',
			production: {
				job: 'guard',
				output: { item_id: 'safety', quantity: 1 },
				input: null,
				wage: 8,
				ticks_per_cycle: 30,
				funding: 'treasury' as const,
			},
		};

		const guardActor = new Actor();
		guardActor.addComponent(new FacilityComponent({
			stock: [],
			fund: 0,
			workProgress: 29,
			status: 'producing',
			workerId: 'guard-1',
		}));

		const locationActors = new Map<string, Actor>([['loc-guardpost', guardActor]]);
		const world = createWorldEntity();

		const system = createFacilitySystem(
			() => [agent],
			() => [guardPostLocation],
			() => locationActors,
			() => world,
		);
		system.execute(createDeps(eventBus));

		// Worker gets full wage (no tax for treasury-funded)
		const wallet = agent.get(WalletComponent);
		expect(wallet.state.gold).toBe(58); // 50 + 8

		// Treasury should be debited
		const economy = world.get(EconomyComponent);
		expect(economy.state.treasury).toBe(492); // 500 - 8

		// Public wage event emitted
		expect(events.length).toBe(1);
		expect(events[0]?.payload.amount).toBe(8);
	});

	it('aptitude efficiency slows production when worker attribute is below baseline', () => {
		const eventBus = createEventBus();

		// Settler job uses HT. Set HT to 6 (half of baseline 12) -> efficiency = 0.5 -> doubled ticks
		const agent = new AgentActor(
			createTestAgentData('agent-1', 100, 100, {
				job: 'settler',
				attributes: { ST: 12, DX: 12, IQ: 12, HT: 6 },
			}),
			defaultMoodConfig,
		);
		agent.behaviorAgent = createStubBehaviorAgent({ btAction: 'work', job: 'settler' });

		const farm: WorldLocation = {
			id: 'loc-farm',
			name: 'Farm',
			type: 'work',
			position: { x: 100, y: 100, region: 'test' },
			capacity: 10,
			color: '#808080',
			production: {
				job: 'settler',
				output: { item_id: 'wheat', quantity: 1 },
				input: null,
				wage: 5,
				ticks_per_cycle: 30,
				funding: 'facility' as const,
			},
		};

		const farmActor = new Actor();
		farmActor.addComponent(new FacilityComponent({
			stock: [],
			fund: 200,
			workProgress: 29, // One tick away at normal speed — but with 0.5 efficiency, ticks_per_cycle becomes 60
			status: 'producing',
			workerId: 'agent-1',
		}));

		const locationActors = new Map<string, Actor>([['loc-farm', farmActor]]);
		const world = createWorldEntity();

		const system = createFacilitySystem(
			() => [agent],
			() => [farm],
			() => locationActors,
			() => world,
		);
		system.execute(createDeps(eventBus));

		// With effective ticks = 60, progress 29+1=30 < 60 — should NOT complete
		const facility = farmActor.get(FacilityComponent);
		expect(facility.state.workProgress).toBe(30);
		expect(facility.state.status).toBe('producing');
	});

	it('aptitude efficiency with missing job definition uses baseline (no slowdown)', () => {
		const eventBus = createEventBus();

		// Use a job name not in the config definitions (default only has settler, guard, craftsman)
		const agent = new AgentActor(
			createTestAgentData('agent-1', 100, 100, {
				job: 'lumberjack',
				attributes: { ST: 6, DX: 6, IQ: 6, HT: 6 },
			}),
			defaultMoodConfig,
		);
		agent.behaviorAgent = createStubBehaviorAgent({ btAction: 'work', job: 'lumberjack' });

		const lumbermill: WorldLocation = {
			id: 'loc-lumbermill',
			name: 'Lumber Mill',
			type: 'work',
			position: { x: 100, y: 100, region: 'test' },
			capacity: 10,
			color: '#808080',
			production: {
				job: 'lumberjack',
				output: { item_id: 'wood', quantity: 1 },
				input: null,
				wage: 5,
				ticks_per_cycle: 30,
				funding: 'facility' as const,
			},
		};

		const millActor = new Actor();
		millActor.addComponent(new FacilityComponent({
			stock: [],
			fund: 200,
			workProgress: 29, // One tick away from completion
			status: 'producing',
			workerId: 'agent-1',
		}));

		const locationActors = new Map<string, Actor>([['loc-lumbermill', millActor]]);
		const world = createWorldEntity();

		const system = createFacilitySystem(
			() => [agent],
			() => [lumbermill],
			() => locationActors,
			() => world,
		);
		system.execute(createDeps(eventBus));

		// No job definition for 'lumberjack' — aptitude block is skipped, uses base ticks_per_cycle=30
		// Progress 29+1=30 >= 30 — cycle SHOULD complete
		const facility = millActor.get(FacilityComponent);
		expect(facility.state.workProgress).toBe(0);
		expect(facility.state.stock).toContainEqual({ item_id: 'wood', quantity: 1 });
	});

	it('does not emit FacilityInsolvent for treasury-funded facility with zero fund', () => {
		const eventBus = createEventBus();
		const events: GameEvent[] = [];
		eventBus.on('FacilityInsolvent', (e) => { events.push(e); });

		const agent = new AgentActor(createTestAgentData('guard-1', 100, 100, { job: 'guard' }), defaultMoodConfig);
		agent.behaviorAgent = createStubBehaviorAgent({ btAction: 'work', job: 'guard' });

		const guardPost: WorldLocation = {
			id: 'loc-guardpost',
			name: 'Guard Post',
			type: 'work',
			position: { x: 100, y: 100, region: 'test' },
			capacity: 10,
			color: '#808080',
			production: {
				job: 'guard',
				output: { item_id: 'safety', quantity: 1 },
				input: null,
				wage: 5,
				ticks_per_cycle: 30,
				funding: 'treasury' as const,
			},
		};

		const guardActor = new Actor();
		guardActor.addComponent(new FacilityComponent({
			stock: [],
			fund: 0, // Treasury-funded, fund=0 by design
			workProgress: 29,
			status: 'producing',
			workerId: 'guard-1',
		}));

		const locationActors = new Map<string, Actor>([['loc-guardpost', guardActor]]);
		const world = createWorldEntity();

		const system = createFacilitySystem(
			() => [agent],
			() => [guardPost],
			() => locationActors,
			() => world,
		);
		system.execute(createDeps(eventBus));

		// Treasury-funded facilities skip insolvency check — no event
		expect(events.length).toBe(0);
	});
});
