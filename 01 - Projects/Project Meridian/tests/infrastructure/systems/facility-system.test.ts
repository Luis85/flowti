import { describe, it, expect } from 'vitest';
import { Actor } from 'excalibur';
import { createFacilitySystem } from '../../../src/infrastructure/systems/facility-system.js';
import { AgentActor } from '../../../src/infrastructure/entity/agent-actor.js';
import { FacilityComponent } from '../../../src/infrastructure/components/facility-component.js';
import { EconomyComponent } from '../../../src/infrastructure/components/economy-component.js';
import { WalletComponent } from '../../../src/infrastructure/components/wallet-component.js';
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
		priceMemories: [] as unknown as BehaviorAgent['priceMemories'],
		IsHungry: () => false, IsExhausted: () => false, IsLonely: () => false,
		IsThirsty: () => false, HasWater: () => false,
		NeedsCritical: () => false, HasFood: () => false, HasFoodReserve: () => false, HasGold: () => false,
		CanAffordFood: () => false, AtLocation: () => false, NearLocation: () => false,
		NearAgent: () => false, NearAgentClose: () => false, IsDaytime: () => true,
		IsNighttime: () => false, IsWorkHours: () => false, HasJob: () => false, AtJobFacility: () => false,
		FacilityHasStock: () => false, HasCargo: () => false, CargoDestinationNearby: () => false,
		FacilityNeedsSupply: () => false, KnowsFoodSource: () => false,
		HasNoJob: () => true, OpenFacilityNearby: () => false,
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
		Idle: () => 'mistreevous.running', Wander: () => 'mistreevous.running',
		recordPriceObservation: () => {},
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
		dailySummary: { totalWages: 0, totalTax: 0, totalSales: 0, totalConsumption: 0 },
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
			workerId: null,
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
			workerId: null,
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
});
