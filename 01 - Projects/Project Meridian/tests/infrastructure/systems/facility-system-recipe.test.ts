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
import type { Recipe } from '../../../src/domain/schemas/recipe-schema.js';
import type { FacilityType } from '../../../src/domain/schemas/facility-type-schema.js';

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
		btAction: null, gossipPending: null, knownLocations: [], locationMemories: [], traitModifiers: null,
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

function createWorldEntity(treasury = 500): Actor {
	const entity = new Actor();
	entity.addComponent(new EconomyComponent({
		treasury,
		ledger: [],
		dailySummary: { totalWages: 0, totalTax: 0, totalSales: 0, totalConsumption: 0, avgWage: 0, wageSpread: 0, vacancyCount: 0, unemploymentCount: 0, jobSwitchesThisDay: 0, supplyDeliveries: 0, questsCompletedThisDay: 0 },
	}));
	return entity;
}

const smithyType: FacilityType = {
	id: 'smithy',
	kind: 'production',
	primary_job: 'craftsman',
	default_wage: 5,
	default_fund: 200,
	funding: 'facility',
	capacity: 1,
	allowed_recipes: ['recipe-smithy-equipment'],
};

const smithyRecipe: Recipe = {
	id: 'recipe-smithy-equipment',
	name: 'Forge Equipment',
	inputs: [{ item_id: 'tools', quantity: 1 }],
	outputs: [{ item_id: 'equipment', quantity: 1 }],
	ticks_per_cycle: 30,
	required_skill: null,
	min_skill_level: 0,
};

const farmType: FacilityType = {
	id: 'farm',
	kind: 'production',
	primary_job: 'settler',
	default_wage: 5,
	default_fund: 200,
	funding: 'facility',
	capacity: 1,
	allowed_recipes: ['recipe-farm-wheat'],
};

const wheatRecipe: Recipe = {
	id: 'recipe-farm-wheat',
	name: 'Grow Wheat',
	inputs: [],
	outputs: [{ item_id: 'wheat', quantity: 1 }],
	ticks_per_cycle: 30,
	required_skill: null,
	min_skill_level: 0,
};

const guardPostType: FacilityType = {
	id: 'guard_post',
	kind: 'production',
	primary_job: 'guard',
	default_wage: 8,
	default_fund: 0,
	funding: 'treasury',
	capacity: 1,
	allowed_recipes: ['recipe-guard-safety'],
};

const safetyRecipe: Recipe = {
	id: 'recipe-guard-safety',
	name: 'Keep the Peace',
	inputs: [],
	outputs: [{ item_id: 'safety', quantity: 1 }],
	ticks_per_cycle: 30,
	required_skill: null,
	min_skill_level: 0,
};

interface RegistryOverrides {
	facilityTypes?: FacilityType[];
	recipes?: Recipe[];
	tickCount?: number;
}

function createDeps(
	eventBus = createEventBus(),
	overrides: RegistryOverrides = {},
): GameCoreDeps {
	const facilityTypes = new Map<string, FacilityType>();
	for (const t of overrides.facilityTypes ?? []) facilityTypes.set(t.id, t);
	const recipes = new Map<string, Recipe>();
	for (const r of overrides.recipes ?? []) recipes.set(r.id, r);
	return {
		logger: { debug() {}, info() {}, warn() {}, error() {} },
		eventBus,
		config: GameConfigSchema.parse({}),
		performanceTracker: createPerformanceTracker(),
		tickCount: overrides.tickCount ?? 1,
		writeFile: null,
		dataRoot: 'test-data',
		getRecipeRegistry: () => recipes,
		getFacilityTypeRegistry: () => facilityTypes,
	};
}

function createSmithyLocation(): WorldLocation {
	return {
		id: 'loc-smithy',
		name: 'Smithy',
		position: { x: 100, y: 100, region: 'test' },
		capacity: 10,
		color: '#808080',
		facility_type: 'smithy',
		active_recipe: 'recipe-smithy-equipment',
	};
}

function createRecipeFarmLocation(): WorldLocation {
	return {
		id: 'loc-recipe-farm',
		name: 'Recipe Farm',
		position: { x: 100, y: 100, region: 'test' },
		capacity: 10,
		color: '#808080',
		facility_type: 'farm',
		active_recipe: 'recipe-farm-wheat',
	};
}

function createRecipeGuardPostLocation(): WorldLocation {
	return {
		id: 'loc-recipe-guardpost',
		name: 'Recipe Guard Post',
		position: { x: 100, y: 100, region: 'test' },
		capacity: 10,
		color: '#808080',
		facility_type: 'guard_post',
		active_recipe: 'recipe-guard-safety',
	};
}

describe('FacilitySystem — recipe path', () => {
	it('consumes inputs and produces output on cycle complete', () => {
		const eventBus = createEventBus();
		const events: GameEvent[] = [];
		eventBus.on('ProductionComplete', (e) => { events.push(e); });

		const agent = new AgentActor(createTestAgentData('craftsman-1', 100, 100, { job: 'craftsman' }), defaultMoodConfig);
		agent.behaviorAgent = createStubBehaviorAgent({ btAction: 'work', job: 'craftsman' });

		const smithy = createSmithyLocation();
		const smithyActor = new Actor();
		smithyActor.addComponent(new FacilityComponent({
			stock: [{ item_id: 'tools', quantity: 2 }],
			fund: 200,
			workProgress: 29,
			status: 'producing',
			workerId: 'craftsman-1',
		}));

		const locationActors = new Map<string, Actor>([['loc-smithy', smithyActor]]);
		const world = createWorldEntity();

		const system = createFacilitySystem(
			() => [agent],
			() => [smithy],
			() => locationActors,
			() => world,
		);
		system.execute(createDeps(eventBus, {
			facilityTypes: [smithyType],
			recipes: [smithyRecipe],
		}));

		const facility = smithyActor.get(FacilityComponent);
		expect(facility.state.workProgress).toBe(0);
		// tools consumed (2 -> 1)
		expect(facility.state.stock).toContainEqual({ item_id: 'tools', quantity: 1 });
		// equipment produced
		expect(facility.state.stock).toContainEqual({ item_id: 'equipment', quantity: 1 });
		// worker paid wage minus tax (tax_base_rate default is 0.1 -> 5 * 0.1 = 0.5)
		const wallet = agent.get(WalletComponent);
		expect(wallet.state.gold).toBeCloseTo(54.5);
		// fund drained by full wage
		expect(facility.state.fund).toBe(195);
		// Event emitted with first recipe output
		expect(events.length).toBe(1);
		expect(events[0]?.payload.outputItem).toBe('equipment');
	});

	it('stays idle with no progress when required inputs are missing', () => {
		const eventBus = createEventBus();
		const idleEvents: GameEvent[] = [];
		eventBus.on('FacilityIdle', (e) => { idleEvents.push(e); });

		const agent = new AgentActor(createTestAgentData('craftsman-1', 100, 100, { job: 'craftsman' }), defaultMoodConfig);
		agent.behaviorAgent = createStubBehaviorAgent({ btAction: 'work', job: 'craftsman' });

		const smithy = createSmithyLocation();
		const smithyActor = new Actor();
		smithyActor.addComponent(new FacilityComponent({
			stock: [], // no tools → can't work
			fund: 200,
			workProgress: 10,
			status: 'producing',
			workerId: 'craftsman-1',
		}));

		const locationActors = new Map<string, Actor>([['loc-smithy', smithyActor]]);
		const world = createWorldEntity();

		const system = createFacilitySystem(
			() => [agent],
			() => [smithy],
			() => locationActors,
			() => world,
		);
		system.execute(createDeps(eventBus, {
			facilityTypes: [smithyType],
			recipes: [smithyRecipe],
		}));

		const facility = smithyActor.get(FacilityComponent);
		expect(facility.state.workProgress).toBe(10); // unchanged
		expect(facility.state.fund).toBe(200); // no drain
		expect(facility.state.status).toBe('idle');
		expect(idleEvents.length).toBe(1);
		expect(idleEvents[0]?.payload.reason).toBe('no_input');
	});

	it('applies aptitude scaling from facility type primary job', () => {
		const eventBus = createEventBus();

		// Settler primary attribute is HT. Baseline is 12. Set HT=6 → efficiency 0.5 → 60 effective ticks.
		const agent = new AgentActor(
			createTestAgentData('settler-1', 100, 100, {
				job: 'settler',
				attributes: { ST: 12, DX: 12, IQ: 12, HT: 6 },
			}),
			defaultMoodConfig,
		);
		agent.behaviorAgent = createStubBehaviorAgent({ btAction: 'work', job: 'settler' });

		const farm = createRecipeFarmLocation();
		const farmActor = new Actor();
		farmActor.addComponent(new FacilityComponent({
			stock: [],
			fund: 200,
			workProgress: 29, // one tick away at 30 ticks — but effective is 60
			status: 'producing',
			workerId: 'settler-1',
		}));

		const locationActors = new Map<string, Actor>([['loc-recipe-farm', farmActor]]);
		const world = createWorldEntity();

		const system = createFacilitySystem(
			() => [agent],
			() => [farm],
			() => locationActors,
			() => world,
		);
		system.execute(createDeps(eventBus, {
			facilityTypes: [farmType],
			recipes: [wheatRecipe],
		}));

		const facility = farmActor.get(FacilityComponent);
		// progress 29+1=30 < 60 → NOT complete
		expect(facility.state.workProgress).toBe(30);
		expect(facility.state.status).toBe('producing');
		// wheat not produced yet
		const wheatStock = facility.state.stock.find(s => s.item_id === 'wheat');
		expect(wheatStock).toBeUndefined();
	});

	it('facility funding drains facility fund on cycle complete', () => {
		const eventBus = createEventBus();

		const agent = new AgentActor(createTestAgentData('settler-1', 100, 100, { job: 'settler' }), defaultMoodConfig);
		agent.behaviorAgent = createStubBehaviorAgent({ btAction: 'work', job: 'settler' });

		const farm = createRecipeFarmLocation();
		const farmActor = new Actor();
		farmActor.addComponent(new FacilityComponent({
			stock: [],
			fund: 5, // exactly one wage
			workProgress: 29,
			status: 'producing',
			workerId: 'settler-1',
		}));

		const insolventEvents: GameEvent[] = [];
		eventBus.on('FacilityInsolvent', (e) => { insolventEvents.push(e); });

		const locationActors = new Map<string, Actor>([['loc-recipe-farm', farmActor]]);
		const world = createWorldEntity();

		const system = createFacilitySystem(
			() => [agent],
			() => [farm],
			() => locationActors,
			() => world,
		);
		system.execute(createDeps(eventBus, {
			facilityTypes: [farmType],
			recipes: [wheatRecipe],
		}));

		const facility = farmActor.get(FacilityComponent);
		expect(facility.state.fund).toBe(0);
		expect(insolventEvents.length).toBe(1);
		expect(insolventEvents[0]?.payload.facilityId).toBe('loc-recipe-farm');
	});

	it('treasury funding drains treasury on cycle complete and pays worker with no tax', () => {
		const eventBus = createEventBus();
		const publicWageEvents: GameEvent[] = [];
		eventBus.on('GoldFlowed', (e) => {
			if (e.payload.subcategory === 'public_wage') publicWageEvents.push(e);
		});

		const agent = new AgentActor(createTestAgentData('guard-1', 100, 100, { job: 'guard' }), defaultMoodConfig);
		agent.behaviorAgent = createStubBehaviorAgent({ btAction: 'work', job: 'guard' });

		const guardPost = createRecipeGuardPostLocation();
		const guardActor = new Actor();
		guardActor.addComponent(new FacilityComponent({
			stock: [],
			fund: 0,
			workProgress: 29,
			status: 'producing',
			workerId: 'guard-1',
		}));

		const locationActors = new Map<string, Actor>([['loc-recipe-guardpost', guardActor]]);
		const world = createWorldEntity(500);

		const system = createFacilitySystem(
			() => [agent],
			() => [guardPost],
			() => locationActors,
			() => world,
		);
		system.execute(createDeps(eventBus, {
			facilityTypes: [guardPostType],
			recipes: [safetyRecipe],
		}));

		// Worker gets full wage (no tax on treasury funding)
		const wallet = agent.get(WalletComponent);
		expect(wallet.state.gold).toBe(58); // 50 + 8

		// Treasury drops by 8
		const economy = world.get(EconomyComponent);
		expect(economy.state.treasury).toBe(492);

		// Facility fund stays 0 — treasury-funded path does not touch it
		const facility = guardActor.get(FacilityComponent);
		expect(facility.state.fund).toBe(0);

		expect(publicWageEvents.length).toBe(1);
		expect(publicWageEvents[0]?.payload.amount).toBe(8);
	});

	it('idles with no_worker event when worker is absent', () => {
		const eventBus = createEventBus();
		const idleEvents: GameEvent[] = [];
		eventBus.on('FacilityIdle', (e) => { idleEvents.push(e); });

		const smithy = createSmithyLocation();
		const smithyActor = new Actor();
		smithyActor.addComponent(new FacilityComponent({
			stock: [{ item_id: 'tools', quantity: 2 }],
			fund: 200,
			workProgress: 15,
			status: 'producing',
			workerId: null,
		}));

		const locationActors = new Map<string, Actor>([['loc-smithy', smithyActor]]);
		const world = createWorldEntity();

		const system = createFacilitySystem(
			() => [],
			() => [smithy],
			() => locationActors,
			() => world,
		);
		system.execute(createDeps(eventBus, {
			facilityTypes: [smithyType],
			recipes: [smithyRecipe],
		}));

		const facility = smithyActor.get(FacilityComponent);
		expect(facility.state.status).toBe('idle');
		expect(facility.state.workProgress).toBe(0);
		expect(idleEvents.length).toBe(1);
		expect(idleEvents[0]?.payload.reason).toBe('no_worker');
	});
});
