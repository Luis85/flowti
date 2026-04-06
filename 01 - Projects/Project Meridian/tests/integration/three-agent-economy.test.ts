import { describe, it, expect } from 'vitest';
import { Actor } from 'excalibur';
import { AgentActor } from '../../src/infrastructure/entity/agent-actor.js';
import { FacilityComponent } from '../../src/infrastructure/components/facility-component.js';
import { EconomyComponent } from '../../src/infrastructure/components/economy-component.js';
import { InventoryComponent } from '../../src/infrastructure/components/inventory-component.js';
import { NeedsComponent } from '../../src/infrastructure/components/needs-component.js';
import { PerceptionComponent } from '../../src/infrastructure/components/perception-component.js';
import { TimeComponent } from '../../src/infrastructure/components/time-component.js';
import { GameConfigSchema } from '../../src/domain/schemas/game-config-schema.js';
import { createPerformanceTracker } from '../../src/infrastructure/performance/performance-tracker.js';
import { createEventBus } from '../../src/infrastructure/event-bus.js';
import { createFacilitySystem } from '../../src/infrastructure/systems/facility-system.js';
import { createNeedsDecaySystem } from '../../src/infrastructure/systems/needs-decay-system.js';
import { createDayNightSystem } from '../../src/infrastructure/systems/day-night-system.js';
import { createEquipmentDecaySystem } from '../../src/infrastructure/systems/equipment-decay-system.js';
import { createBehaviorAgent } from '../../src/infrastructure/entity/behavior-agent-factory.js';
import type { GameCoreDeps } from '../../src/domain/core/game-deps.js';
import type { WorldLocation } from '../../src/domain/schemas/location-schema.js';
import type { BehaviorAgent } from '../../src/domain/systems/behavior-agent.js';

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

function createDeps(tickCount = 1): GameCoreDeps {
	return {
		logger: { debug() {}, info() {}, warn() {}, error() {} },
		eventBus: createEventBus(),
		config: GameConfigSchema.parse({}),
		performanceTracker: createPerformanceTracker(),
		tickCount,
		writeFile: null,
		dataRoot: 'test-data',
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

function createWorldWithTime(): Actor {
	const actor = new Actor();
	actor.addComponent(new TimeComponent({ phase: 'dawn', tickInCycle: 0, dayCount: 0, dayBoundaryThisTick: false }));
	actor.addComponent(new EconomyComponent({
		treasury: 500,
		ledger: [],
		dailySummary: { totalWages: 0, totalTax: 0, totalSales: 0, totalConsumption: 0, avgWage: 0, wageSpread: 0, vacancyCount: 0, unemploymentCount: 0, jobSwitchesThisDay: 0, supplyDeliveries: 0, questsCompletedThisDay: 0 },
	}));
	return actor;
}

describe('three-agent economy integration', () => {
	it('craftsman produces tools into own inventory (private zero-wage)', () => {
		const craftsman = new AgentActor(
			createTestAgentData('craftsman-1', 50, 50, { job: 'craftsman', attributes: { ST: 12, DX: 12, IQ: 12, HT: 12 } }),
			defaultMoodConfig,
		);
		craftsman.behaviorAgent = createStubBehaviorAgent({ btAction: 'work', job: 'craftsman' });

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
				wage: 0,
				ticks_per_cycle: 25,
				funding: 'facility' as const,
			},
		};

		const workshopActor = new Actor();
		workshopActor.addComponent(new FacilityComponent({
			stock: [],
			fund: 0,
			workProgress: 24,
			status: 'producing',
			workerId: 'craftsman-1',
		}));

		const locationActors = new Map<string, Actor>([['loc-workshop', workshopActor]]);
		const world = createWorldEntity();

		const system = createFacilitySystem(
			() => [craftsman],
			() => [workshopLocation],
			() => locationActors,
			() => world,
		);
		system.execute(createDeps());

		// Tools must be in craftsman inventory (private zero-wage routing)
		const inv = craftsman.get(InventoryComponent);
		expect(inv.state.items).toContainEqual({ item_id: 'tools', quantity: 1 });

		// Tools must NOT be in facility stock
		const facility = workshopActor.get(FacilityComponent);
		const stockItem = facility.state.stock.find(s => s.item_id === 'tools');
		expect(stockItem).toBeUndefined();
	});

	it('tools multiply farm output and consume a charge', () => {
		const farmer = new AgentActor(
			createTestAgentData('farmer-1', 100, 100, { job: 'farmer', attributes: { ST: 12, DX: 12, IQ: 12, HT: 12 } }),
			defaultMoodConfig,
		);
		farmer.behaviorAgent = createStubBehaviorAgent({ btAction: 'work', job: 'farmer' });

		// Give farmer tools with charges
		const inv = farmer.get(InventoryComponent);
		inv.state = { items: [{ item_id: 'tools', quantity: 1, charges: 5 }] };

		const farmLocation: WorldLocation = {
			id: 'loc-farm',
			name: 'Food Farm',
			type: 'food',
			position: { x: 100, y: 100, region: 'test' },
			capacity: 10,
			color: '#808080',
			production: {
				job: 'farmer',
				output: { item_id: 'food', quantity: 1 },
				input: null,
				wage: 5,
				ticks_per_cycle: 25,
				funding: 'facility' as const,
			},
		};

		const farmActor = new Actor();
		farmActor.addComponent(new FacilityComponent({
			stock: [],
			fund: 200,
			workProgress: 24,
			status: 'producing',
			workerId: 'farmer-1',
		}));

		const locationActors = new Map<string, Actor>([['loc-farm', farmActor]]);
		const world = createWorldEntity();

		const system = createFacilitySystem(
			() => [farmer],
			() => [farmLocation],
			() => locationActors,
			() => world,
		);
		system.execute(createDeps());

		// Output quantity should be doubled (tools multiplier = 2)
		const facility = farmActor.get(FacilityComponent);
		expect(facility.state.stock).toContainEqual({ item_id: 'food', quantity: 2 });

		// Tools charges should be reduced by 1
		const farmerInv = farmer.get(InventoryComponent);
		const toolsItem = farmerInv.state.items.find(i => i.item_id === 'tools');
		expect(toolsItem).toBeDefined();
		expect(toolsItem?.charges).toBe(4);
	});

	it('equipment reduces need decay rates', () => {
		const withEquipment = new AgentActor(
			createTestAgentData('agent-equipped', 0, 0, {
				needs: { hunger: 80, energy: 80, social: 70, thirst: 80 },
				inventory: [{ item_id: 'equipment', quantity: 1, charges: 10 }],
			}),
			defaultMoodConfig,
		);
		withEquipment.behaviorAgent = createStubBehaviorAgent();

		const withoutEquipment = new AgentActor(
			createTestAgentData('agent-plain', 0, 0, {
				needs: { hunger: 80, energy: 80, social: 70, thirst: 80 },
			}),
			defaultMoodConfig,
		);
		withoutEquipment.behaviorAgent = createStubBehaviorAgent();

		const systemWith = createNeedsDecaySystem(() => [withEquipment]);
		const systemWithout = createNeedsDecaySystem(() => [withoutEquipment]);
		const deps = createDeps();
		systemWith.execute(deps);
		systemWithout.execute(deps);

		const needsWith = withEquipment.get(NeedsComponent).state;
		const needsWithout = withoutEquipment.get(NeedsComponent).state;

		// Agent with equipment decays slower — higher values remain
		expect(needsWith.hunger).toBeGreaterThan(needsWithout.hunger);
		expect(needsWith.thirst).toBeGreaterThan(needsWithout.thirst);
		expect(needsWith.energy).toBeGreaterThan(needsWithout.energy);
	});

	it('equipment loses 1 charge at day boundary', () => {
		const config = GameConfigSchema.parse({});
		const worldEntity = createWorldWithTime();

		const agent = new AgentActor(
			createTestAgentData('agent-1', 0, 0, {
				inventory: [{ item_id: 'equipment', quantity: 1, charges: 5 }],
			}),
			defaultMoodConfig,
		);

		const dayNight = createDayNightSystem(() => worldEntity, () => [agent]);
		const equipDecay = createEquipmentDecaySystem(() => worldEntity, () => [agent]);

		// First tick to initialize previousDayCount
		dayNight.execute(createDeps(0));

		// Tick at day boundary — run both systems
		const boundaryDeps = createDeps(config.ticks_per_day);
		dayNight.execute(boundaryDeps);
		equipDecay.execute(boundaryDeps);

		const inv = agent.get(InventoryComponent);
		const equip = inv.state.items.find(i => i.item_id === 'equipment');
		expect(equip).toBeDefined();
		expect(equip?.charges).toBe(4);
	});

	it('BuyItem sets buyTargetItem for TradeSystem', () => {
		const config = GameConfigSchema.parse({});
		const eventBus = createEventBus();
		const worldEntity = createWorldWithTime();

		const agent = new AgentActor(
			createTestAgentData('agent-buyer', 50, 50),
			defaultMoodConfig,
		);

		// Set up a workshop location in agent's perception
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
				ticks_per_cycle: 25,
				funding: 'facility' as const,
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

		// Wire agent perception to see the workshop
		const perception = agent.get(PerceptionComponent);
		perception.state = {
			nearbyAgents: [],
			nearbyLocations: [{ id: 'loc-workshop', type: 'work', distance: 30 }],
		};

		const ba = createBehaviorAgent({
			actor: agent,
			worldEntity: () => worldEntity,
			config,
			getLocationActors: () => locationActors,
			getLocations: () => [workshopLocation],
			tickCount: () => 1,
			eventBus,
		});
		agent.behaviorAgent = ba;

		// Agent is at the workshop location
		ba.atLocation = 'loc-workshop';

		// Call BuyItem — should set buyTargetItem to 'tools'
		const result = ba.BuyItem('tools');

		expect(result).toBe('mistreevous.succeeded');
		expect(ba.buyTargetItem).toBe('tools');
		expect(ba.btAction).toBe('buy');
	});

	it('FacilityHasStock uses itemId parameter correctly', () => {
		const config = GameConfigSchema.parse({});
		const eventBus = createEventBus();
		const worldEntity = createWorldWithTime();

		const agent = new AgentActor(
			createTestAgentData('agent-shopper', 50, 50),
			defaultMoodConfig,
		);

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
				ticks_per_cycle: 25,
				funding: 'facility' as const,
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

		// Wire agent perception to see the workshop as nearby
		const perception = agent.get(PerceptionComponent);
		perception.state = {
			nearbyAgents: [],
			nearbyLocations: [{ id: 'loc-workshop', type: 'work', distance: 30 }],
		};

		const ba = createBehaviorAgent({
			actor: agent,
			worldEntity: () => worldEntity,
			config,
			getLocationActors: () => locationActors,
			getLocations: () => [workshopLocation],
			tickCount: () => 1,
			eventBus,
		});
		agent.behaviorAgent = ba;

		// Workshop has tools — FacilityHasStock('tools') should return true
		expect(ba.FacilityHasStock('tools')).toBe(true);

		// Workshop does not have equipment — FacilityHasStock('equipment') should return false
		expect(ba.FacilityHasStock('equipment')).toBe(false);
	});
});
