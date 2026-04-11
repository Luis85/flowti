import { describe, it, expect } from 'vitest';
import { Actor } from 'excalibur';
import { createQuestGenerationSystem } from '../../../src/infrastructure/systems/quest-generation-system.js';
import { TimeComponent } from '../../../src/infrastructure/components/time-component.js';
import { EconomyComponent } from '../../../src/infrastructure/components/economy-component.js';
import { QuestBoardComponent } from '../../../src/infrastructure/components/quest-board-component.js';
import { FacilityComponent } from '../../../src/infrastructure/components/facility-component.js';
import { GameConfigSchema } from '../../../src/domain/schemas/game-config-schema.js';
import { createPerformanceTracker } from '../../../src/infrastructure/performance/performance-tracker.js';
import { createEventBus } from '../../../src/infrastructure/event-bus.js';
import type { GameCoreDeps } from '../../../src/domain/core/game-deps.js';
import type { GameEvent } from '../../../src/domain/core/events.js';
import type { WorldLocation } from '../../../src/domain/schemas/location-schema.js';
import type { QuestRuntime } from '../../../src/domain/schemas/quest-schema.js';
import type { Recipe } from '../../../src/domain/schemas/recipe-schema.js';
import type { FacilityType } from '../../../src/domain/schemas/facility-type-schema.js';

function createDeps(
	eventBus = createEventBus(),
	tickCount = 480,
	recipes?: Map<string, Recipe>,
	facilityTypes?: Map<string, FacilityType>,
): GameCoreDeps {
	const defaults = makeRegistries();
	return {
		logger: { debug() {}, info() {}, warn() {}, error() {} },
		eventBus,
		config: GameConfigSchema.parse({}),
		performanceTracker: createPerformanceTracker(),
		tickCount,
		writeFile: null,
		dataRoot: 'test-data',
		getRecipeRegistry: () => recipes ?? defaults.recipes,
		getFacilityTypeRegistry: () => facilityTypes ?? defaults.facilityTypes,
	};
}

function createWorldEntity(dayBoundary: boolean, quests: QuestRuntime[] = []): Actor {
	const actor = new Actor();
	actor.addComponent(new TimeComponent({ phase: 'dawn', tickInCycle: 0, dayCount: 1, dayBoundaryThisTick: dayBoundary }));
	actor.addComponent(new EconomyComponent({
		treasury: 1000,
		ledger: [],
		dailySummary: { totalWages: 0, totalTax: 0, totalSales: 0, totalConsumption: 0, avgWage: 0, wageSpread: 0, vacancyCount: 0, unemploymentCount: 0, jobSwitchesThisDay: 0, supplyDeliveries: 0, questsCompletedThisDay: 0 },
	}));
	actor.addComponent(new QuestBoardComponent({ quests }));
	return actor;
}

function createFacilityActor(
	stock: { item_id: string; quantity: number }[] = [],
	fund = 200,
	status: 'idle' | 'producing' | 'auto' | 'abandoned' = 'idle',
): Actor {
	const actor = new Actor();
	actor.addComponent(new FacilityComponent({
		stock,
		fund,
		workProgress: 0,
		status,
		workerId: null,
	}));
	return actor;
}

const bakeryFacilityType: FacilityType = {
	id: 'bakery',
	kind: 'production',
	primary_job: 'baker',
	default_wage: 5,
	default_fund: 200,
	funding: 'facility',
	capacity: 1,
	allowed_recipes: ['recipe-bake-bread'],
};

const mineFacilityType: FacilityType = {
	id: 'mine',
	kind: 'production',
	primary_job: 'miner',
	default_wage: 5,
	default_fund: 200,
	funding: 'facility',
	capacity: 1,
	allowed_recipes: ['recipe-mine-ore'],
};

const marketStallFacilityType: FacilityType = {
	id: 'market_stall',
	kind: 'service',
	primary_job: 'settler',
	default_wage: 1,
	default_fund: 200,
	funding: 'facility',
	capacity: 1,
	staffed_effects: { mood: 0, energy: 0, social: 0, skill_xp: 0 },
	unstaffed_effects: { mood: 0, energy: 0, social: 0, skill_xp: 0 },
	cost_per_visit: 0,
	ticks_per_visit: 20,
	restock_threshold_per_item: { food: 3 },
};

function bakeryRecipe(inputItemId = 'wheat', inputQty = 2): Recipe {
	return {
		id: 'recipe-bake-bread',
		name: 'Bake bread',
		inputs: [{ item_id: inputItemId, quantity: inputQty }],
		outputs: [{ item_id: 'food', quantity: 1 }],
		ticks_per_cycle: 30,
		required_skill: null,
		min_skill_level: 0,
	};
}

const mineRecipe: Recipe = {
	id: 'recipe-mine-ore',
	name: 'Mine ore',
	inputs: [],
	outputs: [{ item_id: 'ore', quantity: 1 }],
	ticks_per_cycle: 30,
	required_skill: null,
	min_skill_level: 0,
};

function makeRegistries(inputItemId = 'wheat', inputQty = 2): { recipes: Map<string, Recipe>; facilityTypes: Map<string, FacilityType> } {
	const recipes = new Map<string, Recipe>();
	recipes.set('recipe-bake-bread', bakeryRecipe(inputItemId, inputQty));
	recipes.set('recipe-mine-ore', mineRecipe);
	const facilityTypes = new Map<string, FacilityType>();
	facilityTypes.set('bakery', bakeryFacilityType);
	facilityTypes.set('mine', mineFacilityType);
	facilityTypes.set('market_stall', marketStallFacilityType);
	return { recipes, facilityTypes };
}

function createProductionLocation(id = 'loc-bakery'): WorldLocation {
	return {
		id,
		name: 'Bakery',
		facility_type: 'bakery',
		active_recipe: 'recipe-bake-bread',
		position: { x: 200, y: 200, region: 'test' },
		capacity: 10,
		color: '#808080',
		region: null,
	};
}

function createMarketLocation(id = 'loc-market'): WorldLocation {
	return {
		id,
		name: 'Market',
		facility_type: 'market_stall',
		active_recipe: null,
		position: { x: 100, y: 100, region: 'test' },
		capacity: 10,
		color: '#808080',
		region: null,
	};
}

function createAbandonedLocation(id = 'loc-mine'): WorldLocation {
	return {
		id,
		name: 'Mine',
		facility_type: 'mine',
		active_recipe: 'recipe-mine-ore',
		position: { x: 300, y: 300, region: 'test' },
		capacity: 10,
		color: '#808080',
		region: null,
	};
}

function makeQuest(overrides: Partial<QuestRuntime> = {}): QuestRuntime {
	return {
		id: 'q-test-1',
		type: 'supply',
		facilityId: 'loc-bakery',
		itemId: 'wheat',
		quantity: 1,
		reward: 10,
		rewardXp: 5,
		state: 'open',
		claimedBy: null,
		createdTick: 100,
		expiryTicks: 960,
		repairProgress: 0,
		...overrides,
	};
}

describe('QuestGenerationSystem', () => {
	it('skips when dayBoundaryThisTick is false', () => {
		const worldEntity = createWorldEntity(false);
		const loc = createProductionLocation();
		const locActor = createFacilityActor([]); // no input stock — would generate supply quest
		const locationActors = new Map<string, Actor>([['loc-bakery', locActor]]);

		const system = createQuestGenerationSystem(() => worldEntity, () => locationActors, () => [loc]);

		const eventBus = createEventBus();
		const events: GameEvent[] = [];
		eventBus.on('QuestGenerated', (e) => { events.push(e); });

		system.execute(createDeps(eventBus));

		expect(events.length).toBe(0);
		expect(worldEntity.get(QuestBoardComponent).state.quests.length).toBe(0);
	});

	it('generates supply quest when facility has unmet input', () => {
		const worldEntity = createWorldEntity(true);
		const loc = createProductionLocation('loc-bakery');
		const locActor = createFacilityActor([]); // no wheat in stock
		const locationActors = new Map<string, Actor>([['loc-bakery', locActor]]);

		const system = createQuestGenerationSystem(() => worldEntity, () => locationActors, () => [loc]);

		const eventBus = createEventBus();
		const events: GameEvent[] = [];
		eventBus.on('QuestGenerated', (e) => { events.push(e); });

		const deps = createDeps(eventBus, 480);
		system.execute(deps);

		const board = worldEntity.get(QuestBoardComponent);
		expect(board.state.quests.length).toBe(1);

		const quest = board.state.quests[0]!;
		expect(quest.type).toBe('supply');
		expect(quest.facilityId).toBe('loc-bakery');
		expect(quest.itemId).toBe('wheat');
		expect(quest.quantity).toBe(2);
		expect(quest.state).toBe('open');
		expect(events.length).toBe(1);
		expect(events[0]?.payload.type).toBe('supply');
	});

	it('generates restock quest when market stock below threshold', () => {
		const config = GameConfigSchema.parse({});
		const worldEntity = createWorldEntity(true);
		const loc = createMarketLocation();
		// Stock below restock_threshold (default 3)
		const locActor = createFacilityActor([{ item_id: 'food', quantity: 1 }]);
		const locationActors = new Map<string, Actor>([['loc-market', locActor]]);

		const system = createQuestGenerationSystem(() => worldEntity, () => locationActors, () => [loc]);

		const eventBus = createEventBus();
		const events: GameEvent[] = [];
		eventBus.on('QuestGenerated', (e) => { events.push(e); });

		system.execute(createDeps(eventBus, 480));

		const board = worldEntity.get(QuestBoardComponent);
		expect(board.state.quests.length).toBe(1);

		const quest = board.state.quests[0]!;
		expect(quest.type).toBe('restock');
		expect(quest.facilityId).toBe('loc-market');
		expect(quest.reward).toBe(config.quests.restock_reward);
		expect(events.length).toBe(1);
	});

	it('generates repair quest when facility is abandoned', () => {
		const config = GameConfigSchema.parse({});
		const worldEntity = createWorldEntity(true);
		const loc = createAbandonedLocation('loc-mine');
		const locActor = createFacilityActor([], 0, 'abandoned');
		const locationActors = new Map<string, Actor>([['loc-mine', locActor]]);

		const system = createQuestGenerationSystem(() => worldEntity, () => locationActors, () => [loc]);

		const eventBus = createEventBus();
		const events: GameEvent[] = [];
		eventBus.on('QuestGenerated', (e) => { events.push(e); });

		system.execute(createDeps(eventBus, 480));

		const board = worldEntity.get(QuestBoardComponent);
		expect(board.state.quests.length).toBe(1);

		const quest = board.state.quests[0]!;
		expect(quest.type).toBe('repair');
		expect(quest.facilityId).toBe('loc-mine');
		expect(quest.reward).toBe(config.quests.repair_reward);
		expect(events.length).toBe(1);
	});

	it('respects max_open limit', () => {
		const config = GameConfigSchema.parse({});
		// Pre-fill board with max_open quests
		const existingQuests: QuestRuntime[] = [];
		for (let i = 0; i < config.quests.max_open; i++) {
			existingQuests.push(makeQuest({
				id: `q-existing-${i}`,
				facilityId: `loc-existing-${i}`,
				state: 'open',
			}));
		}
		const worldEntity = createWorldEntity(true, existingQuests);
		const loc = createProductionLocation('loc-bakery');
		const locActor = createFacilityActor([]);
		const locationActors = new Map<string, Actor>([['loc-bakery', locActor]]);

		const system = createQuestGenerationSystem(() => worldEntity, () => locationActors, () => [loc]);

		const eventBus = createEventBus();
		const events: GameEvent[] = [];
		eventBus.on('QuestGenerated', (e) => { events.push(e); });

		system.execute(createDeps(eventBus, 480));

		// Should not have generated a new quest
		expect(events.length).toBe(0);
		expect(worldEntity.get(QuestBoardComponent).state.quests.length).toBe(config.quests.max_open);
	});

	it('does not generate duplicate quest for same facility', () => {
		const existing = makeQuest({
			id: 'q-loc-bakery-100',
			facilityId: 'loc-bakery',
			state: 'open',
		});
		const worldEntity = createWorldEntity(true, [existing]);
		const loc = createProductionLocation('loc-bakery');
		const locActor = createFacilityActor([]);
		const locationActors = new Map<string, Actor>([['loc-bakery', locActor]]);

		const system = createQuestGenerationSystem(() => worldEntity, () => locationActors, () => [loc]);

		const eventBus = createEventBus();
		const events: GameEvent[] = [];
		eventBus.on('QuestGenerated', (e) => { events.push(e); });

		system.execute(createDeps(eventBus, 480));

		expect(events.length).toBe(0);
		expect(worldEntity.get(QuestBoardComponent).state.quests.length).toBe(1);
	});

	// Expiration is tested in quest-evaluation-system.test.ts (QuestEvaluationSystem owns expiry)

	it('quest ID format is q-{facilityId}-{tick}', () => {
		const worldEntity = createWorldEntity(true);
		const loc = createProductionLocation('loc-bakery');
		const locActor = createFacilityActor([]);
		const locationActors = new Map<string, Actor>([['loc-bakery', locActor]]);

		const system = createQuestGenerationSystem(() => worldEntity, () => locationActors, () => [loc]);
		system.execute(createDeps(createEventBus(), 960));

		const quest = worldEntity.get(QuestBoardComponent).state.quests[0]!;
		expect(quest.id).toBe('q-loc-bakery-960');
	});

	it('has correct system name and priority', () => {
		const system = createQuestGenerationSystem(() => new Actor(), () => new Map(), () => []);
		expect(system.name).toBe('QuestGenerationSystem');
		expect(system.priority).toBe(7.1);
	});

	it('recipe-path: generates supply quest from active recipe inputs', () => {
		const worldEntity = createWorldEntity(true);
		const loc: WorldLocation = {
			id: 'loc-smithy',
			name: 'Smithy',
			type: 'work',
			position: { x: 300, y: 300, region: 'test' },
			capacity: 10,
			color: '#808080',
			production: null,
			leisure: null,
			region: null,
			facility_type: 'smithy',
			active_recipe: 'recipe-smithy-equipment',
		};
		const locActor = createFacilityActor([]); // empty stock
		const locationActors = new Map<string, Actor>([['loc-smithy', locActor]]);

		const recipes = new Map<string, Recipe>([
			['recipe-smithy-equipment', {
				id: 'recipe-smithy-equipment',
				name: 'Smithy Equipment',
				inputs: [{ item_id: 'tools', quantity: 1 }],
				outputs: [{ item_id: 'equipment', quantity: 1 }],
				ticks_per_cycle: 40,
				required_skill: null,
				min_skill_level: 0,
			}],
		]);
		const facilityTypes = new Map<string, FacilityType>([
			['smithy', {
				kind: 'production',
				id: 'smithy',
				primary_job: 'smith',
				default_wage: 5,
				default_fund: 200,
				funding: 'facility',
				capacity: 1,
				allowed_recipes: ['recipe-smithy-equipment'],
			}],
		]);

		const system = createQuestGenerationSystem(() => worldEntity, () => locationActors, () => [loc]);

		const eventBus = createEventBus();
		const events: GameEvent[] = [];
		eventBus.on('QuestGenerated', (e) => { events.push(e); });

		system.execute(createDeps(eventBus, 480, recipes, facilityTypes));

		const board = worldEntity.get(QuestBoardComponent);
		expect(board.state.quests.length).toBe(1);

		const quest = board.state.quests[0]!;
		expect(quest.type).toBe('supply');
		expect(quest.facilityId).toBe('loc-smithy');
		expect(quest.itemId).toBe('tools');
		expect(quest.quantity).toBe(1);
		expect(events.length).toBe(1);
	});

	it('recipe-path: market_stall restock quest uses per-item thresholds', () => {
		const worldEntity = createWorldEntity(true);
		const loc: WorldLocation = {
			id: 'loc-stall',
			name: 'Market Stall',
			type: 'work',
			position: { x: 100, y: 100, region: 'test' },
			capacity: 10,
			color: '#808080',
			production: null,
			leisure: null,
			region: null,
			facility_type: 'market_stall',
			active_recipe: null,
		};
		const locActor = createFacilityActor([{ item_id: 'food', quantity: 2 }]);
		const locationActors = new Map<string, Actor>([['loc-stall', locActor]]);

		const facilityTypes = new Map<string, FacilityType>([
			['market_stall', {
				kind: 'service',
				id: 'market_stall',
				primary_job: 'merchant',
				default_wage: 3,
				default_fund: 200,
				funding: 'facility',
				capacity: 1,
				staffed_effects: { mood: 0, energy: 0, social: 0, skill_xp: 0 },
				unstaffed_effects: { mood: 0, energy: 0, social: 0, skill_xp: 0 },
				cost_per_visit: 0,
				ticks_per_visit: 20,
				restock_threshold_per_item: { food: 5 },
			}],
		]);

		const system = createQuestGenerationSystem(() => worldEntity, () => locationActors, () => [loc]);

		const eventBus = createEventBus();
		const events: GameEvent[] = [];
		eventBus.on('QuestGenerated', (e) => { events.push(e); });

		system.execute(createDeps(eventBus, 480, new Map(), facilityTypes));

		const board = worldEntity.get(QuestBoardComponent);
		expect(board.state.quests.length).toBe(1);

		const quest = board.state.quests[0]!;
		expect(quest.type).toBe('restock');
		expect(quest.facilityId).toBe('loc-stall');
		expect(quest.itemId).toBe('food');
		expect(quest.quantity).toBe(3);
		expect(events.length).toBe(1);
	});

	it('supply quest reward uses item baseValue from config', () => {
		const worldEntity = createWorldEntity(true);
		const loc = createProductionLocation('loc-bakery');
		const locActor = createFacilityActor([{ item_id: 'wheat', quantity: 1 }]); // need 2 more
		const locationActors = new Map<string, Actor>([['loc-bakery', locActor]]);

		const system = createQuestGenerationSystem(() => worldEntity, () => locationActors, () => [loc]);
		const config = GameConfigSchema.parse({});
		// Recipe with quantity 3 (standard bakery recipe needs 2; override here)
		const recipes = new Map<string, Recipe>();
		recipes.set('recipe-bake-bread', bakeryRecipe('wheat', 3));
		const facilityTypes = new Map<string, FacilityType>();
		facilityTypes.set('bakery', bakeryFacilityType);
		system.execute(createDeps(createEventBus(), 480, recipes, facilityTypes));

		const quest = worldEntity.get(QuestBoardComponent).state.quests[0]!;
		// wheat not in config.items, so fallback to economy.food_price
		const expectedReward = config.economy.food_price * 2 * config.quests.supply_reward_multiplier;
		expect(quest.reward).toBe(expectedReward);
		expect(quest.quantity).toBe(2); // 3 needed - 1 in stock
	});
});
