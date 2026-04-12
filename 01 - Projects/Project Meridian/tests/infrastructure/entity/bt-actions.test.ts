import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Actor } from 'excalibur';
import { createActions, type ActionMethods } from '../../../src/infrastructure/entity/bt-actions.js';
import { createWorkingMemory, type WorkingMemory } from '../../../src/infrastructure/entity/bt-working-memory.js';
import type { BehaviorAgentDeps } from '../../../src/infrastructure/entity/behavior-agent-factory.js';
import { AgentActor } from '../../../src/infrastructure/entity/agent-actor.js';
import { NeedsComponent } from '../../../src/infrastructure/components/needs-component.js';
import { WalletComponent } from '../../../src/infrastructure/components/wallet-component.js';
import { InventoryComponent } from '../../../src/infrastructure/components/inventory-component.js';
import { PerceptionComponent } from '../../../src/infrastructure/components/perception-component.js';
import { FacilityComponent } from '../../../src/infrastructure/components/facility-component.js';
import { TimeComponent } from '../../../src/infrastructure/components/time-component.js';
import { EconomyComponent } from '../../../src/infrastructure/components/economy-component.js';
import { MemoryComponent } from '../../../src/infrastructure/components/memory-component.js';
import { MoodComponent } from '../../../src/infrastructure/components/mood-component.js';
import { AttributesComponent } from '../../../src/infrastructure/components/attributes-component.js';
import { GameConfigSchema } from '../../../src/domain/schemas/game-config-schema.js';
import type { GameConfig } from '../../../src/domain/schemas/game-config-schema.js';
import type { WorldLocation } from '../../../src/domain/schemas/location-schema.js';
import type { FacilityType } from '../../../src/domain/schemas/facility-type-schema.js';
import type { Recipe } from '../../../src/domain/schemas/recipe-schema.js';
import type { EventBus } from '../../../src/domain/core/events.js';
import type { PerceivedFacility, PerceivedAgent, PerceivedLocation } from '../../../src/domain/systems/behavior-agent.js';
import type { QuestRuntime } from '../../../src/domain/schemas/quest-schema.js';
import { QuestBoardComponent, type QuestBoardState } from '../../../src/infrastructure/components/quest-board-component.js';

const noopEventBus: EventBus = {
	emit: () => {},
	on: () => () => {},
	off: () => {},
	onAny: () => () => {},
	filter: () => () => {},
	history: () => [],
};

const defaultMoodConfig = {
	factor_weights: { needs: 30, positive_memories: 20, negative_memories: 20, goal_progress: 10, wallet: 10, equipment: 5, relationships: 5 },
	buckets: [{ name: 'stressed', min: -100, max: 100 }],
	external_modifier_cap: 30,
};

function createTestAgentData(id: string, overrides: Record<string, unknown> = {}) {
	return {
		id,
		name: id,
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
		position: { x: 100, y: 200, region: 'test' },
		relationships: '',
		tools: [],
		color: '#b0b0b0',
		behavior_tree: 'bt-merchant',
		job: null,
		property: [],
		...overrides,
	};
}

function createWorldEntity(phase: 'dawn' | 'day' | 'dusk' | 'night' = 'day'): Actor {
	const world = new Actor();
	world.addComponent(new TimeComponent({ phase, tickInCycle: 0, dayCount: 0, dayBoundaryThisTick: false }));
	world.addComponent(new EconomyComponent({
		treasury: 500,
		ledger: [],
		dailySummary: { totalWages: 0, totalTax: 0, totalSales: 0, totalConsumption: 0, avgWage: 0, wageSpread: 0, vacancyCount: 0, unemploymentCount: 0, jobSwitchesThisDay: 0, supplyDeliveries: 0, questsCompletedThisDay: 0 },
	}));
	world.addComponent(new QuestBoardComponent({ quests: [] }));
	return world;
}

function createLocationActor(facilityState: {
	stock: { item_id: string; quantity: number }[];
	fund: number;
	workProgress: number;
	status: 'idle' | 'producing';
	workerId: string | null;
	currentPrices?: Record<string, number>;
}): Actor {
	const loc = new Actor();
	loc.addComponent(new FacilityComponent(facilityState));
	return loc;
}

// Legacy signature kept for this test file — production block is ignored,
// facility_type/active_recipe are derived from the production.job + output
// where possible. The mock registry (testFacilityTypes / testRecipes) is
// populated alongside via helper function.
interface LegacyProduction {
	job?: string;
	output?: { item_id: string; quantity: number };
	input?: { item_id: string; quantity: number } | null;
	wage?: number;
	ticks_per_cycle?: number;
}

// Shared registries that test mutates as locations are created
const testFacilityTypes = new Map<string, FacilityType>();
const testRecipes = new Map<string, Recipe>();

function resetTestRegistries(): void {
	testFacilityTypes.clear();
	testRecipes.clear();
	// seed common default types
	testFacilityTypes.set('market_stall', { id: 'market_stall', kind: 'service', primary_job: 'settler', default_wage: 1, default_fund: 200, funding: 'facility', capacity: 1, staffed_effects: { mood: 0, energy: 0, social: 0, skill_xp: 0 }, unstaffed_effects: { mood: 0, energy: 0, social: 0, skill_xp: 0 }, cost_per_visit: 0, ticks_per_visit: 20, restock_threshold_per_item: {} });
	testFacilityTypes.set('well', { id: 'well', kind: 'production', primary_job: 'waterbearer', default_wage: 5, default_fund: 200, funding: 'facility', capacity: 1, allowed_recipes: ['recipe-well'] });
	testFacilityTypes.set('tavern', { id: 'tavern', kind: 'service', primary_job: 'settler', default_wage: 1, default_fund: 200, funding: 'facility', capacity: 1, staffed_effects: { mood: 0, energy: 0, social: 0, skill_xp: 0 }, unstaffed_effects: { mood: 0, energy: 0, social: 0, skill_xp: 0 }, cost_per_visit: 0, ticks_per_visit: 20, restock_threshold_per_item: {} });
	testRecipes.set('recipe-well', { id: 'recipe-well', name: 'Well', inputs: [], outputs: [{ item_id: 'water', quantity: 1 }], ticks_per_cycle: 30, required_skill: null, min_skill_level: 0 });
}

function makeLocation(
	id: string,
	_legacyType: string,
	x = 0,
	y = 0,
	production: LegacyProduction | null = null,
	region: string | null = null,
	explicitFacilityType?: string,
): WorldLocation {
	let facility_type = explicitFacilityType;
	let active_recipe: string | null = null;

	if (production !== null && production.job !== undefined) {
		facility_type ??= `type-${id}`;
		const recipeId = `recipe-${id}`;
		active_recipe = recipeId;
		const inputs = production.input !== null && production.input !== undefined ? [{ item_id: production.input.item_id, quantity: production.input.quantity }] : [];
		const outputs = production.output !== undefined ? [{ item_id: production.output.item_id, quantity: production.output.quantity }] : [];
		testRecipes.set(recipeId, { id: recipeId, name: recipeId, inputs, outputs, ticks_per_cycle: production.ticks_per_cycle ?? 30, required_skill: null, min_skill_level: 0 });
		testFacilityTypes.set(facility_type, { id: facility_type, kind: 'production', primary_job: production.job, default_wage: production.wage ?? 5, default_fund: 200, funding: 'facility', capacity: 1, allowed_recipes: [recipeId] });
	}

	facility_type ??= _legacyType;

	return {
		id,
		name: id,
		facility_type,
		active_recipe,
		position: { x, y, region: region ?? 'test' },
		capacity: 10,
		color: '#808080',
		region,
	};
}

function setupDeps(
	actor: AgentActor,
	overrides: Partial<BehaviorAgentDeps> = {},
): BehaviorAgentDeps {
	const worldEntity = overrides.worldEntity ?? (() => createWorldEntity());
	const config = overrides.config ?? GameConfigSchema.parse({});
	const getLocationActors = overrides.getLocationActors ?? (() => new Map<string, Actor>());
	const getLocations = overrides.getLocations ?? (() => []);
	const tickCount = overrides.tickCount ?? (() => 1);
	const eventBus = overrides.eventBus ?? noopEventBus;
	const claimFacility = overrides.claimFacility ?? (() => true);
	const releaseFacility = overrides.releaseFacility ?? (() => {});
	const getFacilityTypeRegistry = overrides.getFacilityTypeRegistry ?? (() => testFacilityTypes);
	const getRecipeRegistry = overrides.getRecipeRegistry ?? (() => testRecipes);
	return { actor, worldEntity, config, getLocationActors, getLocations, tickCount, eventBus, claimFacility, releaseFacility, getFacilityTypeRegistry, getRecipeRegistry, ...overrides };
}

/** Resolves nearby facilities from location actors with FacilityComponent */
function makeResolveNearbyFacilities(
	actor: AgentActor,
	deps: BehaviorAgentDeps,
): () => PerceivedFacility[] {
	return () => {
		const locationActorMap = deps.getLocationActors();
		const locationList = deps.getLocations();
		const perception = actor.get(PerceptionComponent);
		const facilityTypeRegistry = deps.getFacilityTypeRegistry?.();
		const recipeRegistry = deps.getRecipeRegistry?.();
		const facilities: PerceivedFacility[] = [];

		for (const nearLoc of perception.state.nearbyLocations) {
			const locData = locationList.find(l => l.id === nearLoc.id);
			if (locData === undefined) continue;
			const locActor = locationActorMap.get(nearLoc.id);
			if (locActor?.has(FacilityComponent) !== true) continue;
			const facility = locActor.get(FacilityComponent);

			const facilityType = facilityTypeRegistry?.get(locData.facility_type);
			const recipe = locData.active_recipe !== null ? recipeRegistry?.get(locData.active_recipe) : undefined;

			let hasUnmetInput = false;
			if (recipe !== undefined) {
				for (const input of recipe.inputs) {
					const inStock = facility.state.stock.find(s => s.item_id === input.item_id);
					if (inStock === undefined || inStock.quantity < input.quantity) {
						hasUnmetInput = true;
						break;
					}
				}
			}

			facilities.push({
				id: nearLoc.id,
				job: facilityType?.primary_job ?? '',
				stock: [...facility.state.stock],
				distance: nearLoc.distance,
				hasUnmetInput,
				workerId: facility.state.workerId,
				wage: facilityType?.default_wage ?? 0,
				status: facility.state.status,
			});
		}
		return facilities;
	};
}

function makeResolveNearbyAgents(actor: AgentActor): () => PerceivedAgent[] {
	return () => {
		const perception = actor.get(PerceptionComponent);
		return perception.state.nearbyAgents.map(a => ({
			id: a.id,
			position: { x: 0, y: 0 },
			distance: a.distance,
		}));
	};
}

function makeResolveNearbyLocations(actor: AgentActor, deps: BehaviorAgentDeps): () => PerceivedLocation[] {
	return () => {
		const perception = actor.get(PerceptionComponent);
		const locationList = deps.getLocations();
		return perception.state.nearbyLocations.map(nl => {
			const locData = locationList.find(l => l.id === nl.id);
			return {
				id: nl.id,
				facility_type: locData?.facility_type ?? nl.facility_type ?? '',
				position: locData !== undefined
					? { x: locData.position.x, y: locData.position.y }
					: { x: 0, y: 0 },
				distance: nl.distance,
			};
		});
	};
}

/** Helper: create actions from a fresh memory, actor, and deps */
function setupActions(
	actor: AgentActor,
	overrides: Partial<BehaviorAgentDeps> = {},
): { actions: ActionMethods; memory: WorkingMemory; deps: BehaviorAgentDeps } {
	const deps = setupDeps(actor, overrides);
	const memory = createWorkingMemory(deps.config.economy.price_memory_max);
	const resolveNearbyFacilities = makeResolveNearbyFacilities(actor, deps);
	const resolveNearbyAgents = makeResolveNearbyAgents(actor);
	const resolveNearbyLocations = makeResolveNearbyLocations(actor, deps);

	const actions = createActions(
		memory,
		actor,
		deps,
		resolveNearbyFacilities,
		resolveNearbyAgents,
		resolveNearbyLocations,
	);
	return { actions, memory, deps };
}

// ═══════════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════════

describe('bt-actions: createActions', () => {
	let config: GameConfig;

	beforeEach(() => {
		config = GameConfigSchema.parse({});
		resetTestRegistries();
	});

	// ── Life actions ──────────────────────────────────────────────────────
	describe('Life actions', () => {
		describe('Eat', () => {
			it('sets btAction to eat and returns running when food available', () => {
				const actor = new AgentActor(
					createTestAgentData('a1', {
						needs: { hunger: 40, energy: 90, social: 70, thirst: 80 },
						inventory: [{ item_id: 'food', quantity: 2 }],
					}),
					defaultMoodConfig,
				);
				const { actions, memory } = setupActions(actor, { config });

				const result = actions.Eat();
				expect(result).toBe('mistreevous.running');
				expect(memory.btAction).toBe('eat');
			});

			it('does not modify hunger or inventory (system handles that)', () => {
				const actor = new AgentActor(
					createTestAgentData('a1', {
						needs: { hunger: 40, energy: 90, social: 70, thirst: 80 },
						inventory: [{ item_id: 'food', quantity: 2 }],
					}),
					defaultMoodConfig,
				);
				actor.get(NeedsComponent).state = { hunger: 40, energy: 90, social: 70, thirst: 80 };
				const { actions } = setupActions(actor, { config });

				actions.Eat();
				expect(actor.get(NeedsComponent).state.hunger).toBe(40);

				const inv = actor.get(InventoryComponent);
				const foodItem = inv.state.items.find(i => i.item_id === 'food');
				expect(foodItem?.quantity).toBe(2);
			});

			it('returns failed when no food in inventory', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				const { actions } = setupActions(actor);
				expect(actions.Eat()).toBe('mistreevous.failed');
			});
		});

		describe('Drink', () => {
			it('consumes a water item and recovers thirst', () => {
				const actor = new AgentActor(
					createTestAgentData('a1', {
						needs: { hunger: 80, energy: 90, social: 70, thirst: 40 },
						inventory: [{ item_id: 'water', quantity: 2 }],
					}),
					defaultMoodConfig,
				);
				actor.get(NeedsComponent).state = { hunger: 80, energy: 90, social: 70, thirst: 40 };
				const { actions, memory } = setupActions(actor, { config });

				const result = actions.Drink();
				expect(result).toBe('mistreevous.succeeded');
				expect(memory.btAction).toBe('drink');

				// Quantity decremented
				const water = actor.get(InventoryComponent).state.items.find(i => i.item_id === 'water');
				expect(water?.quantity).toBe(1);

				// Thirst recovered
				expect(actor.get(NeedsComponent).state.thirst).toBeGreaterThan(40);
			});

			it('returns failed when no water items', () => {
				const actor = new AgentActor(
					createTestAgentData('a1', {
						inventory: [{ item_id: 'food', quantity: 5 }],
					}),
					defaultMoodConfig,
				);
				const { actions } = setupActions(actor, { config });
				expect(actions.Drink()).toBe('mistreevous.failed');
			});

			it('returns failed when inventory is empty', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				const { actions } = setupActions(actor, { config });
				expect(actions.Drink()).toBe('mistreevous.failed');
			});

			it('consumes 1 water item (quantity decrement) when water is present', () => {
				const actor = new AgentActor(
					createTestAgentData('a1', {
						needs: { hunger: 80, energy: 90, social: 70, thirst: 40 },
						inventory: [{ item_id: 'water', quantity: 3 }],
					}),
					defaultMoodConfig,
				);
				actor.get(NeedsComponent).state = { hunger: 80, energy: 90, social: 70, thirst: 40 };
				const { actions, memory } = setupActions(actor, { config });

				const result = actions.Drink();
				expect(result).toBe('mistreevous.succeeded');
				expect(memory.btAction).toBe('drink');

				const water = actor.get(InventoryComponent).state.items.find(i => i.item_id === 'water');
				expect(water?.quantity).toBe(2);
				expect(actor.get(NeedsComponent).state.thirst).toBeGreaterThan(40);
			});

			it('removes water from inventory when quantity drops to 0', () => {
				const actor = new AgentActor(
					createTestAgentData('a1', {
						needs: { hunger: 80, energy: 90, social: 70, thirst: 40 },
						inventory: [{ item_id: 'water', quantity: 1 }],
					}),
					defaultMoodConfig,
				);
				actor.get(NeedsComponent).state = { hunger: 80, energy: 90, social: 70, thirst: 40 };
				const { actions } = setupActions(actor, { config });

				const result = actions.Drink();
				expect(result).toBe('mistreevous.succeeded');
				const water = actor.get(InventoryComponent).state.items.find(i => i.item_id === 'water');
				expect(water).toBeUndefined();
			});

			it('returns failed when only waterskin in inventory (no water items)', () => {
				const actor = new AgentActor(
					createTestAgentData('a1', {
						needs: { hunger: 80, energy: 90, social: 70, thirst: 40 },
						inventory: [{ item_id: 'waterskin', quantity: 1, charges: 2 }],
					}),
					defaultMoodConfig,
				);
				actor.get(NeedsComponent).state = { hunger: 80, energy: 90, social: 70, thirst: 40 };
				const { actions } = setupActions(actor, { config });

				const result = actions.Drink();
				expect(result).toBe('mistreevous.failed');
			});
		});

	});

	// ── Economy actions ───────────────────────────────────────────────────
	describe('Economy actions', () => {
		describe('CollectProduced', () => {
			it('transfers first stock item from facility to agent inventory', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				actor.get(PerceptionComponent).state = {
					nearbyAgents: [],
					nearbyLocations: [{ id: 'loc-farm', type: 'work', distance: 5 }],
				};

				const locations = [makeLocation('loc-farm', 'work', 0, 0, {
					job: 'farmer', output: { item_id: 'food', quantity: 1 }, input: null,
					wage: 5, ticks_per_cycle: 30, auto_process: false, auto_ticks_per_cycle: 60,
				})];

				const facActor = createLocationActor({
					stock: [{ item_id: 'food', quantity: 3 }],
					fund: 100, workProgress: 0, status: 'idle', workerId: null,
				});

				const locActors = new Map<string, Actor>([['loc-farm', facActor]]);

				const { actions, memory } = setupActions(actor, {
					config,
					getLocations: () => locations,
					getLocationActors: () => locActors,
				});
				memory.atLocation = 'loc-farm';

				const result = actions.CollectProduced();
				expect(result).toBe('mistreevous.succeeded');
				expect(memory.btAction).toBe('collect');

				// Facility stock decremented
				expect(facActor.get(FacilityComponent).state.stock.find(s => s.item_id === 'food')?.quantity).toBe(2);

				// Agent inventory has food
				expect(actor.get(InventoryComponent).state.items.find(i => i.item_id === 'food')?.quantity).toBe(1);
			});

			it('collects tools from workshop (generic — not food-only)', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				actor.get(PerceptionComponent).state = {
					nearbyAgents: [],
					nearbyLocations: [{ id: 'loc-workshop', type: 'work', distance: 5 }],
				};

				const locations = [makeLocation('loc-workshop', 'work', 0, 0, {
					job: 'craftsman', output: { item_id: 'tools', quantity: 1 }, input: null,
					wage: 5, ticks_per_cycle: 30, auto_process: false, auto_ticks_per_cycle: 60,
				})];

				const facActor = createLocationActor({
					stock: [{ item_id: 'tools', quantity: 2 }],
					fund: 100, workProgress: 0, status: 'idle', workerId: null,
				});

				const locActors = new Map<string, Actor>([['loc-workshop', facActor]]);

				const { actions, memory } = setupActions(actor, {
					config,
					getLocations: () => locations,
					getLocationActors: () => locActors,
				});
				memory.atLocation = 'loc-workshop';

				const result = actions.CollectProduced();
				expect(result).toBe('mistreevous.succeeded');
				const toolsItem = actor.get(InventoryComponent).state.items.find(i => i.item_id === 'tools');
				expect(toolsItem?.quantity).toBe(1);
				// Chargeable items get charges initialized from config maxCharges
				expect(toolsItem?.charges).toBe(config.items['tools']?.maxCharges);
				expect(facActor.get(FacilityComponent).state.stock.find(s => s.item_id === 'tools')?.quantity).toBe(1);
			});

			it('returns failed when not at any location', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				const { actions } = setupActions(actor, { config });
				expect(actions.CollectProduced()).toBe('mistreevous.failed');
			});

			it('returns failed when facility has no stock', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				actor.get(PerceptionComponent).state = {
					nearbyAgents: [],
					nearbyLocations: [{ id: 'loc-farm', type: 'work', distance: 5 }],
				};

				const locations = [makeLocation('loc-farm', 'work', 0, 0, {
					job: 'farmer', output: { item_id: 'food', quantity: 1 }, input: null,
					wage: 5, ticks_per_cycle: 30, auto_process: false, auto_ticks_per_cycle: 60,
				})];

				const facActor = createLocationActor({
					stock: [],
					fund: 100, workProgress: 0, status: 'idle', workerId: null,
				});

				const locActors = new Map<string, Actor>([['loc-farm', facActor]]);

				const { actions, memory } = setupActions(actor, {
					config,
					getLocations: () => locations,
					getLocationActors: () => locActors,
				});
				memory.atLocation = 'loc-farm';

				expect(actions.CollectProduced()).toBe('mistreevous.failed');
			});
		});

		describe('RepairWithTools', () => {
			it('consumes 1 tool and adds charges capped at maxCharges', () => {
				const actor = new AgentActor(
					createTestAgentData('a1', {
						inventory: [
							{ item_id: 'tools', quantity: 2 },
							{ item_id: 'equipment', quantity: 1, charges: 3 },
						],
					}),
					defaultMoodConfig,
				);
				const { actions } = setupActions(actor, { config });
				const result = actions.RepairWithTools();
				expect(result).toBe('mistreevous.succeeded');
				const inv = actor.get(InventoryComponent).state.items;
				expect(inv.find(i => i.item_id === 'tools')?.quantity).toBe(1);
				// maxCharges for equipment is 20, so 3 + 10 = 13 (under cap)
				expect(inv.find(i => i.item_id === 'equipment')?.charges).toBe(13);
			});

			it('fails when no tools in inventory', () => {
				const actor = new AgentActor(
					createTestAgentData('a1', {
						inventory: [{ item_id: 'equipment', quantity: 1, charges: 3 }],
					}),
					defaultMoodConfig,
				);
				const { actions } = setupActions(actor, { config });
				expect(actions.RepairWithTools()).toBe('mistreevous.failed');
			});

			it('fails when no equipment in inventory', () => {
				const actor = new AgentActor(
					createTestAgentData('a1', {
						inventory: [{ item_id: 'tools', quantity: 2 }],
					}),
					defaultMoodConfig,
				);
				const { actions } = setupActions(actor, { config });
				expect(actions.RepairWithTools()).toBe('mistreevous.failed');
			});

			it('removes tools item when quantity reaches 0', () => {
				const actor = new AgentActor(
					createTestAgentData('a1', {
						inventory: [
							{ item_id: 'tools', quantity: 1 },
							{ item_id: 'equipment', quantity: 1, charges: 2 },
						],
					}),
					defaultMoodConfig,
				);
				const { actions } = setupActions(actor, { config });
				const result = actions.RepairWithTools();
				expect(result).toBe('mistreevous.succeeded');
				const inv = actor.get(InventoryComponent).state.items;
				expect(inv.find(i => i.item_id === 'tools')).toBeUndefined();
				// maxCharges for equipment is 20, so 2 + 10 = 12 (under cap)
				expect(inv.find(i => i.item_id === 'equipment')?.charges).toBe(12);
			});

			it('emits EquipmentRepaired event', () => {
				const emitted: unknown[] = [];
				const testEventBus: EventBus = {
					...noopEventBus,
					emit: (e) => { emitted.push(e); },
				};
				const actor = new AgentActor(
					createTestAgentData('a1', {
						inventory: [
							{ item_id: 'tools', quantity: 1 },
							{ item_id: 'equipment', quantity: 1, charges: 2 },
						],
					}),
					defaultMoodConfig,
				);
				const { actions } = setupActions(actor, { config, eventBus: testEventBus });
				actions.RepairWithTools();
				expect(emitted.length).toBe(1);
				expect((emitted[0] as Record<string, unknown>).type).toBe('EquipmentRepaired');
			});
		});

		describe('SellAtMarket', () => {
			function setupSellScenario(inventoryItems: { item_id: string; quantity: number }[], fund = 100) {
				const actor = new AgentActor(
					createTestAgentData('a1', { inventory: inventoryItems }),
					defaultMoodConfig,
				);

				const locations = [makeLocation('loc-market', 'market', 0, 0, null, null, 'market_stall')];

				const facActor = createLocationActor({
					stock: [],
					fund,
					workProgress: 0,
					status: 'idle',
					workerId: null,
				});

				const locActors = new Map<string, Actor>([['loc-market', facActor]]);

				const { actions, memory, deps } = setupActions(actor, {
					config,
					getLocations: () => locations,
					getLocationActors: () => locActors,
				});
				memory.atLocation = 'loc-market';

				return { actor, actions, memory, facActor };
			}

			it('sells food when agent has food at a market', () => {
				const { actions, memory, facActor } = setupSellScenario([{ item_id: 'food', quantity: 2 }]);
				const result = actions.SellAtMarket();
				expect(result).toBe('mistreevous.succeeded');
				expect(memory.btAction).toBe('sell');
				expect(facActor.get(FacilityComponent).state.stock.find(s => s.item_id === 'food')?.quantity).toBe(1);
			});

			it('sells tools (trade goods) when agent has tools at a market', () => {
				const { actions, actor, facActor } = setupSellScenario([{ item_id: 'tools', quantity: 3 }]);
				const result = actions.SellAtMarket();
				expect(result).toBe('mistreevous.succeeded');
				expect(facActor.get(FacilityComponent).state.stock.find(s => s.item_id === 'tools')?.quantity).toBe(1);
				expect(actor.get(InventoryComponent).state.items.find(i => i.item_id === 'tools')?.quantity).toBe(2);
			});

			it('removes the item entirely when selling the last unit of a trade good', () => {
				const { actions, actor } = setupSellScenario([{ item_id: 'tools', quantity: 1 }]);
				actions.SellAtMarket();
				expect(actor.get(InventoryComponent).state.items.find(i => i.item_id === 'tools')).toBeUndefined();
			});

			it('credits the agent wallet on sale', () => {
				const { actions, actor } = setupSellScenario([{ item_id: 'tools', quantity: 1 }]);
				const goldBefore = actor.get(WalletComponent).state.gold;
				actions.SellAtMarket();
				expect(actor.get(WalletComponent).state.gold).toBeGreaterThan(goldBefore);
			});

			it('emits GoldFlowed event on sale', () => {
				const emitSpy = vi.fn();
				const actor = new AgentActor(
					createTestAgentData('a1', { inventory: [{ item_id: 'food', quantity: 2 }] }),
					defaultMoodConfig,
				);
				const locations = [makeLocation('loc-market', 'market', 0, 0, null, null, 'market_stall')];
				const facActor = createLocationActor({
					stock: [], fund: 100, workProgress: 0, status: 'idle', workerId: null,
				});
				const locActors = new Map<string, Actor>([['loc-market', facActor]]);
				const { actions, memory } = setupActions(actor, {
					config,
					getLocations: () => locations,
					getLocationActors: () => locActors,
					eventBus: { ...noopEventBus, emit: emitSpy },
				});
				memory.atLocation = 'loc-market';

				actions.SellAtMarket();
				expect(emitSpy).toHaveBeenCalledTimes(1);
				expect(emitSpy.mock.calls[0]![0].type).toBe('GoldFlowed');
			});

			it('returns failed when atLocation is null', () => {
				const actor = new AgentActor(
					createTestAgentData('a1', { inventory: [{ item_id: 'tools', quantity: 1 }] }),
					defaultMoodConfig,
				);
				const { actions } = setupActions(actor, { config });
				expect(actions.SellAtMarket()).toBe('mistreevous.failed');
			});

			it('returns failed when location is not a market', () => {
				const actor = new AgentActor(
					createTestAgentData('a1', { inventory: [{ item_id: 'tools', quantity: 1 }] }),
					defaultMoodConfig,
				);
				const locations = [makeLocation('loc-tavern', 'food')];
				const { actions, memory } = setupActions(actor, {
					config,
					getLocations: () => locations,
				});
				memory.atLocation = 'loc-tavern';
				expect(actions.SellAtMarket()).toBe('mistreevous.failed');
			});

			it('returns failed when inventory has no sellable items', () => {
				const { actions } = setupSellScenario([{ item_id: 'torch', quantity: 2 }]);
				expect(actions.SellAtMarket()).toBe('mistreevous.failed');
			});

			it('returns failed when market has insufficient funds', () => {
				const { actions } = setupSellScenario([{ item_id: 'tools', quantity: 1 }], 0);
				expect(actions.SellAtMarket()).toBe('mistreevous.failed');
			});

			it('prefers the most-overloaded item when multiple sellables present', () => {
				// Regression for recording 2026-04-11-1339: Celia had food(4) + equipment(1) + tools(84)
				// and the old SellAtMarket used .find() which picked food first, so tools never
				// got dumped despite massive overload. The fix sorts by overload amount and
				// picks the most-over-threshold item.
				const { actions, actor, facActor } = setupSellScenario([
					{ item_id: 'food', quantity: 4 },
					{ item_id: 'equipment', quantity: 1 },
					{ item_id: 'tools', quantity: 84 },
				]);
				const result = actions.SellAtMarket();
				expect(result).toBe('mistreevous.succeeded');
				// Tools should be the one sold — most overloaded (84 - 5 = 79 over threshold)
				expect(actor.get(InventoryComponent).state.items.find(i => i.item_id === 'tools')?.quantity).toBe(83);
				expect(actor.get(InventoryComponent).state.items.find(i => i.item_id === 'food')?.quantity).toBe(4);
				expect(facActor.get(FacilityComponent).state.stock.find(s => s.item_id === 'tools')?.quantity).toBe(1);
			});
		});

		describe('Buy', () => {
			function setupBuyScenario(gold = 50) {
				const actor = new AgentActor(
					createTestAgentData('a1', { wallet: { gold } }),
					defaultMoodConfig,
				);
				actor.get(PerceptionComponent).state = {
					nearbyAgents: [],
					nearbyLocations: [{ id: 'loc-market', type: 'market', distance: 5 }],
				};

				const locations = [makeLocation('loc-market', 'market', 0, 0, {
					job: 'shopkeeper', output: { item_id: 'food', quantity: 1 }, input: null,
					wage: 5, ticks_per_cycle: 30, auto_process: false, auto_ticks_per_cycle: 60,
				})];

				const facActor = createLocationActor({
					stock: [{ item_id: 'food', quantity: 10 }],
					fund: 100,
					workProgress: 0,
					status: 'idle',
					workerId: null,
				});

				const locActors = new Map<string, Actor>([['loc-market', facActor]]);

				const result = setupActions(actor, {
					config,
					getLocations: () => locations,
					getLocationActors: () => locActors,
				});

				return { actor, ...result, facActor };
			}

			it('sets btAction to buy and returns succeeded when preconditions met', () => {
				const { actions, memory } = setupBuyScenario();
				memory.atLocation = 'loc-market';
				const result = actions.Buy();
				expect(result).toBe('mistreevous.succeeded');
				expect(memory.btAction).toBe('buy');
			});

			it('clears buyTargetItem so TradeSystem defaults to food', () => {
				const { actions, memory } = setupBuyScenario();
				memory.atLocation = 'loc-market';
				memory.buyTargetItem = 'tools';
				actions.Buy();
				expect(memory.buyTargetItem).toBeNull();
			});

			it('returns failed when atLocation is null', () => {
				const { actions } = setupBuyScenario();
				expect(actions.Buy()).toBe('mistreevous.failed');
			});

			it('returns failed when no facility has food stock', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				const { actions } = setupActions(actor);
				expect(actions.Buy()).toBe('mistreevous.failed');
			});
		});

		describe('BuyItem', () => {
			it('sets btAction to buy and buyTargetItem when preconditions met', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				actor.get(PerceptionComponent).state = {
					nearbyAgents: [],
					nearbyLocations: [{ id: 'loc-market', type: 'market', distance: 5 }],
				};

				const locations = [makeLocation('loc-market', 'market', 0, 0, {
					job: 'shopkeeper', output: { item_id: 'tools', quantity: 1 }, input: null,
					wage: 5, ticks_per_cycle: 30, auto_process: false, auto_ticks_per_cycle: 60,
				})];

				const facActor = createLocationActor({
					stock: [{ item_id: 'tools', quantity: 5 }],
					fund: 100, workProgress: 0, status: 'idle', workerId: null,
				});

				const locActors = new Map<string, Actor>([['loc-market', facActor]]);

				const { actions, memory } = setupActions(actor, {
					config,
					getLocations: () => locations,
					getLocationActors: () => locActors,
				});
				memory.atLocation = 'loc-market';

				const result = actions.BuyItem('tools');
				expect(result).toBe('mistreevous.succeeded');
				expect(memory.btAction).toBe('buy');
				expect(memory.buyTargetItem).toBe('tools');
			});

			it('returns failed when no facility has the requested item', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				actor.get(PerceptionComponent).state = {
					nearbyAgents: [],
					nearbyLocations: [{ id: 'loc-market', type: 'market', distance: 5 }],
				};

				const locations = [makeLocation('loc-market', 'market', 0, 0, {
					job: 'shopkeeper', output: { item_id: 'food', quantity: 1 }, input: null,
					wage: 5, ticks_per_cycle: 30, auto_process: false, auto_ticks_per_cycle: 60,
				})];

				const facActor = createLocationActor({
					stock: [{ item_id: 'food', quantity: 5 }],
					fund: 100, workProgress: 0, status: 'idle', workerId: null,
				});

				const locActors = new Map<string, Actor>([['loc-market', facActor]]);

				const { actions, memory } = setupActions(actor, {
					config,
					getLocations: () => locations,
					getLocationActors: () => locActors,
				});
				memory.atLocation = 'loc-market';

				expect(actions.BuyItem('tools')).toBe('mistreevous.failed');
			});

			it('returns failed when atLocation is null', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				const { actions } = setupActions(actor);
				expect(actions.BuyItem('tools')).toBe('mistreevous.failed');
			});
		});

		describe('SeekFood', () => {
			it('prefers stocked facilities over food-type locations', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				actor.get(PerceptionComponent).state = {
					nearbyAgents: [],
					nearbyLocations: [
						{ id: 'loc-farm', type: 'food', distance: 10 },
						{ id: 'loc-market', type: 'market', distance: 20 },
					],
				};

				const locations = [
					makeLocation('loc-farm', 'food'),
					makeLocation('loc-market', 'market', 0, 0, {
						job: 'shopkeeper', output: { item_id: 'food', quantity: 1 }, input: null,
						wage: 5, ticks_per_cycle: 30, auto_process: false, auto_ticks_per_cycle: 60,
					}),
				];

				const facActor = createLocationActor({
					stock: [{ item_id: 'food', quantity: 5 }],
					fund: 100, workProgress: 0, status: 'idle', workerId: null,
				});

				const locActors = new Map<string, Actor>([['loc-market', facActor]]);

				const { actions, memory } = setupActions(actor, {
					config,
					getLocations: () => locations,
					getLocationActors: () => locActors,
				});

				const result = actions.SeekFood();
				expect(result).toBe('mistreevous.running');
				// Market has food in stock, so it should target the market
				expect(memory.movementTarget).toEqual({ id: 'loc-market', type: 'location' });
			});

			it('falls back to farm facilities when no stocked facilities', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				actor.get(PerceptionComponent).state = {
					nearbyAgents: [],
					nearbyLocations: [
						{ id: 'loc-tavern', type: 'food', facility_type: 'farm', distance: 50 },
						{ id: 'loc-bakery', type: 'food', facility_type: 'farm', distance: 20 },
					],
				};
				const locations = [
					makeLocation('loc-tavern', 'food', 0, 0, null, null, 'farm'),
					makeLocation('loc-bakery', 'food', 0, 0, null, null, 'farm'),
				];
				const { actions, memory } = setupActions(actor, { getLocations: () => locations });

				const result = actions.SeekFood();
				expect(result).toBe('mistreevous.running');
				expect(memory.movementTarget).toEqual({ id: 'loc-bakery', type: 'location' });
			});

			it('returns succeeded when already at farm location', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				actor.get(PerceptionComponent).state = {
					nearbyAgents: [],
					nearbyLocations: [{ id: 'loc-tavern', type: 'food', facility_type: 'farm', distance: 5 }],
				};
				const locations = [makeLocation('loc-tavern', 'food', 0, 0, null, null, 'farm')];
				const { actions, memory } = setupActions(actor, { getLocations: () => locations });
				memory.atLocation = 'loc-tavern';

				expect(actions.SeekFood()).toBe('mistreevous.succeeded');
			});

			it('returns failed when no food locations nearby', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				const { actions } = setupActions(actor);
				expect(actions.SeekFood()).toBe('mistreevous.failed');
			});
		});

		describe('SeekBestFoodSource', () => {
			it('targets location with cheapest food price from memory', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				const { actions, memory } = setupActions(actor, { config, tickCount: () => 1 });

				memory.priceMemories.push({ itemId: 'food', price: 5, locationId: 'loc-a', tick: 1 });
				memory.priceMemories.push({ itemId: 'food', price: 3, locationId: 'loc-b', tick: 1 });

				const result = actions.SeekBestFoodSource();
				expect(result).toBe('mistreevous.running');
				expect(memory.movementTarget).toEqual({ id: 'loc-b', type: 'location' });
			});

			it('returns succeeded when already at cheapest location', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				const { actions, memory } = setupActions(actor, { config, tickCount: () => 1 });

				memory.priceMemories.push({ itemId: 'food', price: 3, locationId: 'loc-a', tick: 1 });
				memory.atLocation = 'loc-a';

				expect(actions.SeekBestFoodSource()).toBe('mistreevous.succeeded');
			});

			it('returns failed when no food price memories exist', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				const { actions } = setupActions(actor, { config });
				expect(actions.SeekBestFoodSource()).toBe('mistreevous.failed');
			});

			it('ignores stale memories', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				// Default staleTicks = 200; tick=300, memory at tick=1 is stale
				const { actions, memory } = setupActions(actor, { config, tickCount: () => 300 });

				memory.priceMemories.push({ itemId: 'food', price: 3, locationId: 'loc-a', tick: 1 });

				expect(actions.SeekBestFoodSource()).toBe('mistreevous.failed');
			});
		});

		describe('SeekMarket', () => {
			it('sets movementTarget to nearest market', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				actor.get(PerceptionComponent).state = {
					nearbyAgents: [],
					nearbyLocations: [{ id: 'loc-market', type: 'market', distance: 30 }],
				};
				const locations = [makeLocation('loc-market', 'market', 0, 0, null, null, 'market_stall')];
				const { actions, memory } = setupActions(actor, { getLocations: () => locations });

				expect(actions.SeekMarket()).toBe('mistreevous.running');
				expect(memory.movementTarget).toEqual({ id: 'loc-market', type: 'location' });
			});

			it('returns succeeded when already at market', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				actor.get(PerceptionComponent).state = {
					nearbyAgents: [],
					nearbyLocations: [{ id: 'loc-market', type: 'market', distance: 5 }],
				};
				const locations = [makeLocation('loc-market', 'market', 0, 0, null, null, 'market_stall')];
				const { actions, memory } = setupActions(actor, { getLocations: () => locations });
				memory.atLocation = 'loc-market';

				expect(actions.SeekMarket()).toBe('mistreevous.succeeded');
			});

			it('returns failed when no market nearby', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				const { actions } = setupActions(actor);
				expect(actions.SeekMarket()).toBe('mistreevous.failed');
			});
		});

		describe('SeekWell', () => {
			it('sets movementTarget to a nearby well with water in stock', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				actor.get(PerceptionComponent).state = {
					nearbyAgents: [],
					nearbyLocations: [{ id: 'loc-well', type: 'work', facility_type: 'well', distance: 15 }],
				};
				const locations = [
					makeLocation('loc-well', 'work', 0, 0, {
						job: 'water_drawer', output: { item_id: 'water', quantity: 1 }, input: null,
						wage: 0, ticks_per_cycle: 30, auto_process: true, auto_ticks_per_cycle: 60,
					}, null, 'well'),
				];
				const facActor = createLocationActor({
					stock: [{ item_id: 'water', quantity: 5 }],
					fund: 0, workProgress: 0, status: 'idle', workerId: null,
				});
				const { actions, memory } = setupActions(actor, {
					getLocations: () => locations,
					getLocationActors: () => new Map([['loc-well', facActor]]),
				});

				const result = actions.SeekWell();
				expect(result).toBe('mistreevous.running');
				expect(memory.movementTarget).toEqual({ id: 'loc-well', type: 'location' });
				expect(memory.btAction).toBe('seek_well');
			});

			it('returns succeeded when already at the well', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				actor.get(PerceptionComponent).state = {
					nearbyAgents: [],
					nearbyLocations: [{ id: 'loc-well', type: 'work', facility_type: 'well', distance: 5 }],
				};
				const locations = [
					makeLocation('loc-well', 'work', 0, 0, {
						job: 'water_drawer', output: { item_id: 'water', quantity: 1 }, input: null,
						wage: 0, ticks_per_cycle: 30, auto_process: true, auto_ticks_per_cycle: 60,
					}, null, 'well'),
				];
				const facActor = createLocationActor({
					stock: [{ item_id: 'water', quantity: 5 }],
					fund: 0, workProgress: 0, status: 'idle', workerId: null,
				});
				const { actions, memory } = setupActions(actor, {
					getLocations: () => locations,
					getLocationActors: () => new Map([['loc-well', facActor]]),
				});
				memory.atLocation = 'loc-well';

				expect(actions.SeekWell()).toBe('mistreevous.succeeded');
				expect(memory.movementTarget).toEqual({ id: 'loc-well', type: 'location' });
			});

			it('falls back to the closest well on the full map when none in perception', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				actor.pos.x = 300;
				actor.pos.y = 400;
				actor.get(PerceptionComponent).state = {
					nearbyAgents: [],
					nearbyLocations: [], // no wells in perception
				};
				const locations = [
					makeLocation('loc-well-far', 'work', 80, 130, null, null, 'well'),
					makeLocation('loc-well-near', 'work', 250, 380, null, null, 'well'),
					makeLocation('loc-market', 'market', 300, 380),
				];
				const { actions, memory } = setupActions(actor, { getLocations: () => locations });

				const result = actions.SeekWell();
				expect(result).toBe('mistreevous.running');
				expect(memory.movementTarget).toEqual({ id: 'loc-well-near', type: 'location' });
				expect(memory.btAction).toBe('seek_well');
			});
		});
	});

	// ── Work actions ──────────────────────────────────────────────────────
	describe('Work actions', () => {
		describe('Work', () => {
			it('returns running when at job facility', () => {
				const actor = new AgentActor(createTestAgentData('a1', { job: 'baker' }), defaultMoodConfig);
				actor.get(PerceptionComponent).state = {
					nearbyAgents: [],
					nearbyLocations: [{ id: 'loc-bakery', type: 'work', distance: 5 }],
				};

				const locations = [makeLocation('loc-bakery', 'work', 0, 0, {
					job: 'baker', output: { item_id: 'bread', quantity: 1 }, input: null,
					wage: 5, ticks_per_cycle: 30, auto_process: false, auto_ticks_per_cycle: 60,
				})];

				const facActor = createLocationActor({
					stock: [], fund: 100, workProgress: 0, status: 'idle', workerId: 'a1',
				});

				const { actions, memory } = setupActions(actor, {
					getLocations: () => locations,
					getLocationActors: () => new Map([['loc-bakery', facActor]]),
				});

				memory.atLocation = 'loc-bakery';
				expect(actions.Work()).toBe('mistreevous.running');
				expect(memory.btAction).toBe('work');
			});

			it('returns failed when not at any location', () => {
				const actor = new AgentActor(createTestAgentData('a1', { job: 'baker' }), defaultMoodConfig);
				const { actions } = setupActions(actor);
				expect(actions.Work()).toBe('mistreevous.failed');
			});

			it('returns failed when agent has no job', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				const { actions, memory } = setupActions(actor);
				memory.atLocation = 'loc-bakery';
				expect(actions.Work()).toBe('mistreevous.failed');
			});
		});

		describe('SeekWork', () => {
			it('sets movementTarget to job facility', () => {
				const actor = new AgentActor(createTestAgentData('a1', { job: 'baker' }), defaultMoodConfig);
				const locations = [makeLocation('loc-bakery', 'work', 0, 0, {
					job: 'baker', output: { item_id: 'bread', quantity: 1 }, input: null,
					wage: 5, ticks_per_cycle: 30, auto_process: false, auto_ticks_per_cycle: 60,
				})];
				const facActor = createLocationActor({
					stock: [], fund: 100, workProgress: 0, status: 'idle', workerId: 'a1',
				});
				const { actions, memory } = setupActions(actor, {
					getLocations: () => locations,
					getLocationActors: () => new Map([['loc-bakery', facActor]]),
				});

				expect(actions.SeekWork()).toBe('mistreevous.running');
				expect(memory.movementTarget).toEqual({ id: 'loc-bakery', type: 'location' });
			});

			it('returns failed when no job', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				const { actions } = setupActions(actor);
				expect(actions.SeekWork()).toBe('mistreevous.failed');
			});

			it('returns succeeded when already at available facility', () => {
				const actor = new AgentActor(createTestAgentData('a1', { job: 'baker' }), defaultMoodConfig);
				actor.get(PerceptionComponent).state = {
					nearbyAgents: [],
					nearbyLocations: [{ id: 'loc-bakery', type: 'work', distance: 5 }],
				};

				const locations = [makeLocation('loc-bakery', 'work', 0, 0, {
					job: 'baker', output: { item_id: 'bread', quantity: 1 }, input: null,
					wage: 5, ticks_per_cycle: 30, auto_process: false, auto_ticks_per_cycle: 60,
				})];

				const facActor = createLocationActor({
					stock: [], fund: 100, workProgress: 0, status: 'idle', workerId: 'a1',
				});

				const { actions, memory } = setupActions(actor, {
					getLocations: () => locations,
					getLocationActors: () => new Map([['loc-bakery', facActor]]),
				});
				memory.atLocation = 'loc-bakery';

				expect(actions.SeekWork()).toBe('mistreevous.succeeded');
			});

			it('fails gracefully when at facility but it is occupied', () => {
				const actor = new AgentActor(createTestAgentData('a1', { job: 'baker' }), defaultMoodConfig);
				// No nearby facilities in perception, but the fallback location exists
				actor.get(PerceptionComponent).state = {
					nearbyAgents: [],
					nearbyLocations: [],
				};

				const locations = [makeLocation('loc-bakery', 'work', 0, 0, {
					job: 'baker', output: { item_id: 'bread', quantity: 1 }, input: null,
					wage: 5, ticks_per_cycle: 30, auto_process: false, auto_ticks_per_cycle: 60,
				})];

				const { actions, memory } = setupActions(actor, { getLocations: () => locations });
				memory.atLocation = 'loc-bakery';

				expect(actions.SeekWork()).toBe('mistreevous.failed');
			});
		});

		describe('ClaimJob', () => {
			it('claims matching facility job for agent kind', () => {
				const actor = new AgentActor(createTestAgentData('a1', { job: 'baker' }), defaultMoodConfig);
				actor.get(PerceptionComponent).state = {
					nearbyAgents: [],
					nearbyLocations: [{ id: 'loc-bakery', type: 'work', distance: 5 }],
				};

				const locations = [makeLocation('loc-bakery', 'work', 0, 0, {
					job: 'baker', output: { item_id: 'bread', quantity: 1 }, input: null,
					wage: 5, ticks_per_cycle: 30, auto_process: false, auto_ticks_per_cycle: 60,
				})];

				const facActor = createLocationActor({
					stock: [], fund: 100, workProgress: 0, status: 'idle', workerId: null,
				});

				const { actions, memory } = setupActions(actor, {
					config,
					getLocations: () => locations,
					getLocationActors: () => new Map([['loc-bakery', facActor]]),
				});

				const result = actions.ClaimJob();
				expect(result).toBe('mistreevous.succeeded');
				expect(memory.btAction).toBe('claim_job');
				expect(actor.job).toBe('baker');
			});

			it('returns failed when no matching facility', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				const { actions } = setupActions(actor, { config });
				expect(actions.ClaimJob()).toBe('mistreevous.failed');
			});
		});

		describe('ClaimBestJob', () => {
			it('claims facility based on aptitude scoring', () => {
				const actor = new AgentActor(
					createTestAgentData('a1', {
						attributes: { ST: 15, DX: 10, IQ: 10, HT: 10 },
					}),
					defaultMoodConfig,
				);
				actor.get(PerceptionComponent).state = {
					nearbyAgents: [],
					nearbyLocations: [
						{ id: 'loc-farm', type: 'work', distance: 10 },
						{ id: 'loc-bakery', type: 'work', distance: 15 },
					],
				};

				const locations = [
					makeLocation('loc-farm', 'work', 0, 0, {
						job: 'farmer', output: { item_id: 'wheat', quantity: 1 }, input: null,
						wage: 5, ticks_per_cycle: 30, auto_process: false, auto_ticks_per_cycle: 60,
					}),
					makeLocation('loc-bakery', 'work', 0, 0, {
						job: 'baker', output: { item_id: 'bread', quantity: 1 }, input: null,
						wage: 5, ticks_per_cycle: 30, auto_process: false, auto_ticks_per_cycle: 60,
					}),
				];

				const farmActor = createLocationActor({
					stock: [], fund: 100, workProgress: 0, status: 'idle', workerId: null,
				});
				const bakeryActor = createLocationActor({
					stock: [], fund: 100, workProgress: 0, status: 'idle', workerId: null,
				});

				const locActors = new Map<string, Actor>([
					['loc-farm', farmActor],
					['loc-bakery', bakeryActor],
				]);

				const jobsConfig = {
					desperation_ticks: 100,
					definitions: {
						farmer: { primary_attribute: 'ST', efficiency_modifier: 0.5 },
						baker: { primary_attribute: 'DX', efficiency_modifier: 0.5 },
					} as Record<string, { primary_attribute: string; efficiency_modifier: number }>,
				};

				const swapSpy = vi.fn();
				const { actions, memory } = setupActions(actor, {
					config,
					getLocations: () => locations,
					getLocationActors: () => locActors,
					jobsConfig: jobsConfig as unknown as GameConfig['jobs'],
					swapBehaviorTree: swapSpy,
				});

				const result = actions.ClaimBestJob();
				expect(result).toBe('mistreevous.succeeded');
				// ST=15 > DX=10, so farmer should be chosen
				expect(actor.job).toBe('farmer');
				expect(memory.btAction).toBe('claim_job');
				expect(memory.unemployedTicks).toBe(0);
				expect(swapSpy).toHaveBeenCalledWith('farmer');
			});

			it('takes nearest when desperate', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				actor.get(PerceptionComponent).state = {
					nearbyAgents: [],
					nearbyLocations: [
						{ id: 'loc-far', type: 'work', distance: 50 },
						{ id: 'loc-near', type: 'work', distance: 5 },
					],
				};

				const locations = [
					makeLocation('loc-far', 'work', 0, 0, {
						job: 'farmer', output: { item_id: 'wheat', quantity: 1 }, input: null,
						wage: 5, ticks_per_cycle: 30, auto_process: false, auto_ticks_per_cycle: 60,
					}),
					makeLocation('loc-near', 'work', 0, 0, {
						job: 'baker', output: { item_id: 'bread', quantity: 1 }, input: null,
						wage: 5, ticks_per_cycle: 30, auto_process: false, auto_ticks_per_cycle: 60,
					}),
				];

				const farActor = createLocationActor({
					stock: [], fund: 100, workProgress: 0, status: 'idle', workerId: null,
				});
				const nearActor = createLocationActor({
					stock: [], fund: 100, workProgress: 0, status: 'idle', workerId: null,
				});

				const locActors = new Map<string, Actor>([
					['loc-far', farActor],
					['loc-near', nearActor],
				]);

				const jobsConfig = {
					desperation_ticks: 5,
					definitions: {} as Record<string, { primary_attribute: string; efficiency_modifier: number }>,
				};

				const { actions, memory } = setupActions(actor, {
					config,
					getLocations: () => locations,
					getLocationActors: () => locActors,
					jobsConfig: jobsConfig as unknown as GameConfig['jobs'],
				});

				// Set unemployed above desperation threshold
				memory.unemployedTicks = 10;

				const result = actions.ClaimBestJob();
				expect(result).toBe('mistreevous.succeeded');
				expect(actor.job).toBe('baker'); // nearest
			});

			it('returns failed when no open facilities', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				const { actions } = setupActions(actor, { config });
				expect(actions.ClaimBestJob()).toBe('mistreevous.failed');
			});

			it('prefers higher-wage facility when aptitude matches', () => {
				const actor = new AgentActor(
					createTestAgentData('a1', {
						attributes: { ST: 15, DX: 10, IQ: 10, HT: 10 },
					}),
					defaultMoodConfig,
				);
				actor.get(PerceptionComponent).state = {
					nearbyAgents: [],
					nearbyLocations: [
						{ id: 'loc-farm', type: 'work', distance: 5 },
						{ id: 'loc-smithy', type: 'work', distance: 10 },
					],
				};

				// Two facilities, both ST-primary (farmer + blacksmith), but
				// blacksmith pays a higher wage. Wage-weighted scoring should
				// prefer the smithy despite the extra distance.
				const locations = [
					makeLocation('loc-farm', 'work', 0, 0, {
						job: 'farmer', output: { item_id: 'wheat', quantity: 1 }, input: null,
						wage: 3, ticks_per_cycle: 30, auto_process: false, auto_ticks_per_cycle: 60,
					}),
					makeLocation('loc-smithy', 'work', 0, 0, {
						job: 'blacksmith', output: { item_id: 'tool', quantity: 1 }, input: null,
						wage: 8, ticks_per_cycle: 30, auto_process: false, auto_ticks_per_cycle: 60,
					}),
				];

				const farmActor = createLocationActor({
					stock: [], fund: 100, workProgress: 0, status: 'idle', workerId: null,
				});
				const smithyActor = createLocationActor({
					stock: [], fund: 100, workProgress: 0, status: 'idle', workerId: null,
				});
				const locActors = new Map<string, Actor>([
					['loc-farm', farmActor],
					['loc-smithy', smithyActor],
				]);

				const jobsConfig = {
					aptitude_baseline: 12,
					desperation_ticks: 100,
					definitions: {
						farmer: { primary_attribute: 'ST' },
						blacksmith: { primary_attribute: 'ST' },
					} as Record<string, { primary_attribute: 'ST' | 'DX' | 'IQ' | 'HT' }>,
				};

				const { actions } = setupActions(actor, {
					config,
					getLocations: () => locations,
					getLocationActors: () => locActors,
					jobsConfig: jobsConfig as unknown as GameConfig['jobs'],
				});

				expect(actions.ClaimBestJob()).toBe('mistreevous.succeeded');
				expect(actor.job).toBe('blacksmith');
			});

			it('claims service facility when it has best effective wage', () => {
				// HT=15 agent prefers an innkeeper (HT-primary) at an inn (service)
				// over a DX-primary farmer job at the same wage.
				const actor = new AgentActor(
					createTestAgentData('a1', {
						attributes: { ST: 10, DX: 10, IQ: 10, HT: 15 },
					}),
					defaultMoodConfig,
				);
				actor.get(PerceptionComponent).state = {
					nearbyAgents: [],
					nearbyLocations: [
						{ id: 'loc-farm', type: 'work', distance: 5 },
						{ id: 'loc-inn', type: 'work', distance: 10 },
					],
				};

				const farmLoc = makeLocation('loc-farm', 'work', 0, 0, {
					job: 'farmer', output: { item_id: 'wheat', quantity: 1 }, input: null,
					wage: 5, ticks_per_cycle: 30, auto_process: false, auto_ticks_per_cycle: 60,
				});

				// Service facility — register in registry directly, no recipe.
				testFacilityTypes.set('rest_inn', {
					id: 'rest_inn',
					kind: 'service',
					primary_job: 'innkeeper',
					default_wage: 5,
					default_fund: 200,
					funding: 'facility',
					capacity: 1,
					staffed_effects: { mood: 0, energy: 0, social: 0, skill_xp: 0 },
					unstaffed_effects: { mood: 0, energy: 0, social: 0, skill_xp: 0 },
					cost_per_visit: 0,
					ticks_per_visit: 20,
					restock_threshold_per_item: {},
				});
				const innLoc: WorldLocation = {
					id: 'loc-inn',
					name: 'loc-inn',
					facility_type: 'rest_inn',
					active_recipe: null,
					position: { x: 0, y: 0, region: 'test' },
					capacity: 10,
					color: '#808080',
					region: null,
				};

				const farmActor = createLocationActor({
					stock: [], fund: 100, workProgress: 0, status: 'idle', workerId: null,
				});
				const innActor = createLocationActor({
					stock: [], fund: 100, workProgress: 0, status: 'idle', workerId: null,
				});
				const locActors = new Map<string, Actor>([
					['loc-farm', farmActor],
					['loc-inn', innActor],
				]);

				const jobsConfig = {
					aptitude_baseline: 12,
					desperation_ticks: 100,
					definitions: {
						farmer: { primary_attribute: 'DX' },
						innkeeper: { primary_attribute: 'HT' },
					} as Record<string, { primary_attribute: 'ST' | 'DX' | 'IQ' | 'HT' }>,
				};

				const { actions } = setupActions(actor, {
					config,
					getLocations: () => [farmLoc, innLoc],
					getLocationActors: () => locActors,
					jobsConfig: jobsConfig as unknown as GameConfig['jobs'],
				});

				expect(actions.ClaimBestJob()).toBe('mistreevous.succeeded');
				// Both wage=5, but HT=15 boosts innkeeper score above farmer
				// (DX=10 → score 5 × 10/12 ≈ 4.17 vs innkeeper 5 × 15/12 = 6.25)
				expect(actor.job).toBe('innkeeper');
			});
		});

		describe('ReleaseJob', () => {
			it('clears job and calls swapBehaviorTree(null)', () => {
				const actor = new AgentActor(createTestAgentData('a1', { job: 'baker' }), defaultMoodConfig);
				const swapSpy = vi.fn();
				const { actions, memory } = setupActions(actor, { config, swapBehaviorTree: swapSpy });

				const result = actions.ReleaseJob();
				expect(result).toBe('mistreevous.succeeded');
				expect(actor.job).toBeNull();
				expect(memory.unemployedTicks).toBe(0);
				expect(memory.btAction).toBeNull();
				expect(swapSpy).toHaveBeenCalledWith(null);
			});
		});
	});

	// ── Supply actions ────────────────────────────────────────────────────
	describe('Supply actions', () => {
		describe('PickupCargo', () => {
			it('picks up cargo from facility and sets haulCargo', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				actor.get(PerceptionComponent).state = {
					nearbyAgents: [],
					nearbyLocations: [
						{ id: 'loc-farm', type: 'work', distance: 5 },
						{ id: 'loc-mill', type: 'work', distance: 20 },
					],
				};

				const locations: WorldLocation[] = [
					makeLocation('loc-farm', 'work', 0, 0, {
						job: 'farmer', output: { item_id: 'wheat', quantity: 1 }, input: null,
						wage: 5, ticks_per_cycle: 30, auto_process: false, auto_ticks_per_cycle: 60,
					}),
					makeLocation('loc-mill', 'work', 0, 0, {
						job: 'miller', output: { item_id: 'flour', quantity: 1 },
						input: { item_id: 'wheat', quantity: 1 },
						wage: 5, ticks_per_cycle: 30, auto_process: false, auto_ticks_per_cycle: 60,
					}),
				];

				const farmActor = createLocationActor({
					stock: [{ item_id: 'wheat', quantity: 3 }],
					fund: 100, workProgress: 0, status: 'idle', workerId: null,
				});
				const millActor = createLocationActor({
					stock: [],
					fund: 50, workProgress: 0, status: 'idle', workerId: null,
				});

				const locActors = new Map<string, Actor>([
					['loc-farm', farmActor],
					['loc-mill', millActor],
				]);

				const { actions, memory } = setupActions(actor, {
					getLocations: () => locations,
					getLocationActors: () => locActors,
				});

				const result = actions.PickupCargo();
				expect(result).toBe('mistreevous.succeeded');
				expect(memory.haulCargo).not.toBeNull();
				expect(memory.haulCargo!.itemId).toBe('wheat');
				expect(memory.haulCargo!.destination).toBe('loc-mill');

				// Farm stock decremented
				expect(farmActor.get(FacilityComponent).state.stock.find(s => s.item_id === 'wheat')?.quantity).toBe(2);
			});

			it('returns failed when no facility has output stock', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				const { actions } = setupActions(actor);
				expect(actions.PickupCargo()).toBe('mistreevous.failed');
			});

			it('returns failed when no destination facility needs the item', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				actor.get(PerceptionComponent).state = {
					nearbyAgents: [],
					nearbyLocations: [{ id: 'loc-farm', type: 'work', distance: 5 }],
				};

				const locations: WorldLocation[] = [
					makeLocation('loc-farm', 'work', 0, 0, {
						job: 'farmer', output: { item_id: 'wheat', quantity: 1 }, input: null,
						wage: 5, ticks_per_cycle: 30, auto_process: false, auto_ticks_per_cycle: 60,
					}),
				];

				const farmActor = createLocationActor({
					stock: [{ item_id: 'wheat', quantity: 3 }],
					fund: 100, workProgress: 0, status: 'idle', workerId: null,
				});

				const locActors = new Map<string, Actor>([['loc-farm', farmActor]]);

				const { actions } = setupActions(actor, {
					getLocations: () => locations,
					getLocationActors: () => locActors,
				});

				expect(actions.PickupCargo()).toBe('mistreevous.failed');
			});
		});

		describe('DeliverCargo', () => {
			it('delivers cargo and clears haulCargo', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				const destActor = createLocationActor({
					stock: [], fund: 50, workProgress: 0, status: 'idle', workerId: null,
				});

				const locActors = new Map<string, Actor>([['loc-mill', destActor]]);

				const { actions, memory } = setupActions(actor, {
					getLocationActors: () => locActors,
				});

				memory.haulCargo = { itemId: 'wheat', quantity: 1, source: 'loc-farm', destination: 'loc-mill' };
				memory.atLocation = 'loc-mill';

				const result = actions.DeliverCargo();
				expect(result).toBe('mistreevous.succeeded');
				expect(memory.haulCargo).toBeNull();

				const stock = destActor.get(FacilityComponent).state.stock;
				expect(stock.find(s => s.item_id === 'wheat')?.quantity).toBe(1);
			});

			it('emits SupplyDelivered event on successful delivery', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				const destActor = createLocationActor({
					stock: [], fund: 50, workProgress: 0, status: 'idle', workerId: null,
				});

				const locActors = new Map<string, Actor>([['loc-mill', destActor]]);
				const emitted: { type: string; payload: Record<string, unknown> }[] = [];
				const spyEventBus: EventBus = {
					emit: (e) => { emitted.push({ type: e.type, payload: e.payload }); },
					on: () => () => {},
					off: () => {},
					onAny: () => () => {},
					filter: () => () => {},
					history: () => [],
				};

				const { actions, memory } = setupActions(actor, {
					getLocationActors: () => locActors,
					eventBus: spyEventBus,
				});

				memory.haulCargo = { itemId: 'wheat', quantity: 1, source: 'loc-farm', destination: 'loc-mill' };
				memory.atLocation = 'loc-mill';

				actions.DeliverCargo();

				expect(emitted).toHaveLength(1);
				expect(emitted[0]!.type).toBe('SupplyDelivered');
				expect(emitted[0]!.payload).toEqual({
					agentId: 'a1',
					itemId: 'wheat',
					quantity: 1,
					sourceId: 'loc-farm',
					destinationId: 'loc-mill',
				});
			});

			it('returns failed when not at destination', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				const { actions, memory } = setupActions(actor);
				memory.haulCargo = { itemId: 'wheat', quantity: 1, source: 'loc-farm', destination: 'loc-mill' };
				memory.atLocation = 'loc-other';
				expect(actions.DeliverCargo()).toBe('mistreevous.failed');
			});

			it('returns failed when no cargo', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				const { actions } = setupActions(actor);
				expect(actions.DeliverCargo()).toBe('mistreevous.failed');
			});
		});

		describe('SeekDeliveryTarget', () => {
			it('sets movementTarget to cargo destination', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				const { actions, memory } = setupActions(actor);
				memory.haulCargo = { itemId: 'wheat', quantity: 1, source: 'loc-farm', destination: 'loc-mill' };

				expect(actions.SeekDeliveryTarget()).toBe('mistreevous.running');
				expect(memory.movementTarget).toEqual({ id: 'loc-mill', type: 'location' });
			});

			it('returns succeeded when already at destination', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				const { actions, memory } = setupActions(actor);
				memory.haulCargo = { itemId: 'wheat', quantity: 1, source: 'loc-farm', destination: 'loc-mill' };
				memory.atLocation = 'loc-mill';

				expect(actions.SeekDeliveryTarget()).toBe('mistreevous.succeeded');
			});

			it('returns failed when no cargo', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				const { actions } = setupActions(actor);
				expect(actions.SeekDeliveryTarget()).toBe('mistreevous.failed');
			});
		});

		describe('SeekSupplySource', () => {
			it('sets movementTarget to producing facility', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				actor.get(PerceptionComponent).state = {
					nearbyAgents: [],
					nearbyLocations: [
						{ id: 'loc-mill', type: 'work', distance: 10 },
						{ id: 'loc-farm', type: 'work', distance: 30 },
					],
				};

				const locations: WorldLocation[] = [
					makeLocation('loc-mill', 'work', 0, 0, {
						job: 'miller', output: { item_id: 'flour', quantity: 1 },
						input: { item_id: 'wheat', quantity: 1 },
						wage: 5, ticks_per_cycle: 30, auto_process: false, auto_ticks_per_cycle: 60,
					}),
					makeLocation('loc-farm', 'work', 0, 0, {
						job: 'farmer', output: { item_id: 'wheat', quantity: 1 }, input: null,
						wage: 5, ticks_per_cycle: 30, auto_process: false, auto_ticks_per_cycle: 60,
					}),
				];

				const millActor = createLocationActor({
					stock: [], fund: 50, workProgress: 0, status: 'idle', workerId: null,
				});
				const farmActor = createLocationActor({
					stock: [{ item_id: 'wheat', quantity: 5 }],
					fund: 100, workProgress: 0, status: 'idle', workerId: null,
				});

				const locActors = new Map<string, Actor>([
					['loc-mill', millActor],
					['loc-farm', farmActor],
				]);

				const { actions, memory } = setupActions(actor, {
					getLocations: () => locations,
					getLocationActors: () => locActors,
				});

				expect(actions.SeekSupplySource()).toBe('mistreevous.running');
				expect(memory.movementTarget).toEqual({ id: 'loc-farm', type: 'location' });
			});

			it('returns failed when no facility needs supply', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				const { actions } = setupActions(actor);
				expect(actions.SeekSupplySource()).toBe('mistreevous.failed');
			});
		});
	});

	// ── Social actions ────────────────────────────────────────────────────
	describe('Social actions', () => {
		describe('Talk', () => {
			it('returns running when close agent nearby', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				actor.get(PerceptionComponent).state = {
					nearbyAgents: [{ id: 'agent-b', distance: 10 }],
					nearbyLocations: [],
				};
				const { actions, memory } = setupActions(actor, { config });
				expect(actions.Talk()).toBe('mistreevous.running');
				expect(memory.btAction).toBe('talk');
			});

			it('returns failed when no close agent', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				actor.get(PerceptionComponent).state = {
					nearbyAgents: [{ id: 'agent-b', distance: 100 }],
					nearbyLocations: [],
				};
				const { actions } = setupActions(actor, { config });
				expect(actions.Talk()).toBe('mistreevous.failed');
			});

			it('returns failed when no nearby agents', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				const { actions } = setupActions(actor, { config });
				expect(actions.Talk()).toBe('mistreevous.failed');
			});
		});

		describe('SeekSocial', () => {
			it('sets movementTarget to nearest agent', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				actor.get(PerceptionComponent).state = {
					nearbyAgents: [
						{ id: 'agent-b', distance: 50 },
						{ id: 'agent-c', distance: 30 },
					],
					nearbyLocations: [],
				};
				const { actions, memory } = setupActions(actor, { config });

				expect(actions.SeekSocial()).toBe('mistreevous.running');
				expect(memory.movementTarget).toEqual({ id: 'agent-c', type: 'agent' });
			});

			it('returns succeeded when nearest agent is close enough', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				actor.get(PerceptionComponent).state = {
					nearbyAgents: [{ id: 'agent-b', distance: 5 }],
					nearbyLocations: [],
				};
				const { actions } = setupActions(actor, { config });
				expect(actions.SeekSocial()).toBe('mistreevous.succeeded');
			});

			it('returns failed when no nearby agents', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				const { actions } = setupActions(actor);
				expect(actions.SeekSocial()).toBe('mistreevous.failed');
			});
		});
	});

	// ── Navigation actions ────────────────────────────────────────────────
	describe('Navigation actions', () => {
		describe('Idle', () => {
			it('always returns running and sets btAction', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				const { actions, memory } = setupActions(actor);
				expect(actions.Idle()).toBe('mistreevous.running');
				expect(memory.btAction).toBe('idle');
			});
		});

		describe('Wander', () => {
			it('always returns running and sets btAction', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				const { actions, memory } = setupActions(actor);
				expect(actions.Wander()).toBe('mistreevous.running');
				expect(memory.btAction).toBe('wander');
			});
		});
	});

	// ── Utility methods ───────────────────────────────────────────────────
	describe('Utility methods', () => {
		describe('tickUnemployment', () => {
			it('increments unemployedTicks when agent has no job', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				const { actions, memory } = setupActions(actor);

				actions.tickUnemployment();
				expect(memory.unemployedTicks).toBe(1);
				actions.tickUnemployment();
				expect(memory.unemployedTicks).toBe(2);
			});

			it('resets unemployedTicks when agent has a job', () => {
				const actor = new AgentActor(createTestAgentData('a1', { job: 'baker' }), defaultMoodConfig);
				const { actions, memory } = setupActions(actor);

				memory.unemployedTicks = 5;
				actions.tickUnemployment();
				expect(memory.unemployedTicks).toBe(0);
			});
		});

		describe('recordPriceObservation', () => {
			it('pushes a price memory entry', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				const { actions, memory } = setupActions(actor, { config });

				actions.recordPriceObservation('food', 5, 'loc-market', 42);
				expect(memory.priceMemories.size).toBe(1);

				let found = false;
				for (const mem of memory.priceMemories) {
					if (mem.itemId === 'food' && mem.price === 5 && mem.locationId === 'loc-market' && mem.tick === 42) {
						found = true;
					}
				}
				expect(found).toBe(true);
			});
		});
	});

	describe('SwitchJob', () => {
		it('returns FAILED when no better facility available', () => {
			const actor = new AgentActor(createTestAgentData('a1', { job: 'farmer' }), defaultMoodConfig);
			const { actions } = setupActions(actor);
			expect(actions.SwitchJob()).toBe('mistreevous.failed');
		});

		it('releases current job and claims better one', () => {
			const actor = new AgentActor(createTestAgentData('a1', { job: 'farmer' }), defaultMoodConfig);
			const farmLoc = makeLocation('farm-1', 'food', 110, 200, {
				job: 'farmer', output: { item_id: 'wheat', quantity: 1 }, input: null, ticks_per_cycle: 10, wage: 5,
			});
			const betterFarmLoc = makeLocation('farm-2', 'food', 120, 200, {
				job: 'baker', output: { item_id: 'bread', quantity: 1 }, input: null, ticks_per_cycle: 10, wage: 15,
			});
			const locActor1 = createLocationActor({ stock: [], fund: 100, workProgress: 0, status: 'idle', workerId: actor.agentId });
			const locActor2 = createLocationActor({ stock: [], fund: 100, workProgress: 0, status: 'idle', workerId: null });
			const locationActors = new Map<string, Actor>([['farm-1', locActor1], ['farm-2', locActor2]]);
			actor.get(PerceptionComponent).state = {
				nearbyAgents: [],
				nearbyLocations: [
					{ id: 'farm-1', type: 'food', distance: 10 },
					{ id: 'farm-2', type: 'food', distance: 20 },
				],
			};
			const deps: Partial<BehaviorAgentDeps> = {
				config: GameConfigSchema.parse({
					jobs: {
						definitions: {
							farmer: { primary_attribute: 'HT', behavior_tree: 'bt-farmer' },
							baker: { primary_attribute: 'HT', behavior_tree: 'bt-baker' },
						},
					},
				}),
				getLocationActors: () => locationActors,
				getLocations: () => [farmLoc, betterFarmLoc],
			};
			const { actions } = setupActions(actor, deps);
			const result = actions.SwitchJob();
			expect(result).toBe('mistreevous.succeeded');
			expect(actor.job).toBe('baker');
		});

		it('emits JobSwitched event with old/new details', () => {
			const actor = new AgentActor(createTestAgentData('a1', { job: 'farmer' }), defaultMoodConfig);
			const farmLoc = makeLocation('farm-1', 'food', 110, 200, {
				job: 'farmer', output: { item_id: 'wheat', quantity: 1 }, input: null, ticks_per_cycle: 10, wage: 5,
			});
			const betterLoc = makeLocation('shop-1', 'workshop', 120, 200, {
				job: 'baker', output: { item_id: 'bread', quantity: 1 }, input: null, ticks_per_cycle: 10, wage: 15,
			});
			const locActor1 = createLocationActor({ stock: [], fund: 100, workProgress: 0, status: 'idle', workerId: actor.agentId });
			const locActor2 = createLocationActor({ stock: [], fund: 100, workProgress: 0, status: 'idle', workerId: null });
			const locationActors = new Map<string, Actor>([['farm-1', locActor1], ['shop-1', locActor2]]);
			actor.get(PerceptionComponent).state = {
				nearbyAgents: [],
				nearbyLocations: [
					{ id: 'farm-1', type: 'food', distance: 10 },
					{ id: 'shop-1', type: 'workshop', distance: 20 },
				],
			};
			const emitted: unknown[] = [];
			const eventBus: EventBus = {
				emit: (e: unknown) => { emitted.push(e); },
				on: () => () => {},
				off: () => {},
				onAny: () => () => {},
				filter: () => () => {},
				history: () => [],
			};
			const deps: Partial<BehaviorAgentDeps> = {
				config: GameConfigSchema.parse({
					jobs: {
						definitions: {
							farmer: { primary_attribute: 'HT', behavior_tree: 'bt-farmer' },
							baker: { primary_attribute: 'HT', behavior_tree: 'bt-baker' },
						},
					},
				}),
				getLocationActors: () => locationActors,
				getLocations: () => [farmLoc, betterLoc],
				eventBus,
			};
			const { actions } = setupActions(actor, deps);
			actions.SwitchJob();
			expect(emitted.length).toBe(1);
			const event = emitted[0] as { type: string; payload: { agentId: string; oldJob: string; newJob: string } };
			expect(event.type).toBe('JobSwitched');
			expect(event.payload.oldJob).toBe('farmer');
			expect(event.payload.newJob).toBe('baker');
		});

		it('triggers BT swap via swapBehaviorTree', () => {
			const actor = new AgentActor(createTestAgentData('a1', { job: 'farmer' }), defaultMoodConfig);
			const farmLoc = makeLocation('farm-1', 'food', 110, 200, {
				job: 'farmer', output: { item_id: 'wheat', quantity: 1 }, input: null, ticks_per_cycle: 10, wage: 5,
			});
			const betterLoc = makeLocation('shop-1', 'workshop', 120, 200, {
				job: 'baker', output: { item_id: 'bread', quantity: 1 }, input: null, ticks_per_cycle: 10, wage: 15,
			});
			const locActor1 = createLocationActor({ stock: [], fund: 100, workProgress: 0, status: 'idle', workerId: actor.agentId });
			const locActor2 = createLocationActor({ stock: [], fund: 100, workProgress: 0, status: 'idle', workerId: null });
			const locationActors = new Map<string, Actor>([['farm-1', locActor1], ['shop-1', locActor2]]);
			actor.get(PerceptionComponent).state = {
				nearbyAgents: [],
				nearbyLocations: [
					{ id: 'farm-1', type: 'food', distance: 10 },
					{ id: 'shop-1', type: 'workshop', distance: 20 },
				],
			};
			let swappedTo: string | null | undefined;
			const deps: Partial<BehaviorAgentDeps> = {
				config: GameConfigSchema.parse({
					jobs: {
						definitions: {
							farmer: { primary_attribute: 'HT', behavior_tree: 'bt-farmer' },
							baker: { primary_attribute: 'HT', behavior_tree: 'bt-baker' },
						},
					},
				}),
				getLocationActors: () => locationActors,
				getLocations: () => [farmLoc, betterLoc],
				swapBehaviorTree: (job) => { swappedTo = job; },
			};
			const { actions } = setupActions(actor, deps);
			actions.SwitchJob();
			expect(swappedTo).toBe('baker');
		});
	});

	// ── Quest actions ─────────────────────────────────────────────────────
	describe('Quest actions', () => {
		function makeQuest(overrides: Partial<QuestRuntime> = {}): QuestRuntime {
			return {
				id: 'q-1',
				type: 'supply',
				facilityId: 'loc-market',
				itemId: 'wheat',
				quantity: 2,
				reward: 20,
				rewardXp: 5,
				state: 'open',
				claimedBy: null,
				createdTick: 0,
				expiryTicks: 960,
				repairProgress: 0,
				...overrides,
			};
		}

		function makeQuestBoard(quests: QuestRuntime[]): QuestBoardState {
			return { quests };
		}

		describe('ClaimQuest', () => {
			it('claims cached quest, sets state to claimed, emits QuestClaimed', () => {
				const quest = makeQuest();
				const board = makeQuestBoard([quest]);
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				const emitted: { type: string; payload: Record<string, unknown> }[] = [];
				const spyEventBus: EventBus = {
					emit: (e) => { emitted.push({ type: e.type, payload: e.payload }); },
					on: () => () => {},
					off: () => {},
					onAny: () => () => {},
					filter: () => () => {},
					history: () => [],
				};

				const { actions, memory } = setupActions(actor, {
					eventBus: spyEventBus,
					getQuestBoard: () => board,
				});

				memory.cachedAvailableQuest = makeQuest();

				const result = actions.ClaimQuest();
				expect(result).toBe('mistreevous.succeeded');
				expect(quest.state).toBe('claimed');
				expect(quest.claimedBy).toBe('a1');
				expect(memory.activeQuest).toBe(quest);
				expect(memory.cachedAvailableQuest).toBeNull();
				expect(memory.btAction).toBe('claim_quest');

				expect(emitted).toHaveLength(1);
				expect(emitted[0]!.type).toBe('QuestClaimed');
				expect(emitted[0]!.payload).toEqual({
					agentId: 'a1',
					questId: 'q-1',
					questType: 'supply',
					facilityId: 'loc-market',
				});
			});

			it('fails if quest already claimed by someone else (race condition)', () => {
				const quest = makeQuest({ state: 'claimed', claimedBy: 'other-agent' });
				const board = makeQuestBoard([quest]);
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);

				const { actions, memory } = setupActions(actor, {
					getQuestBoard: () => board,
				});

				memory.cachedAvailableQuest = makeQuest();

				const result = actions.ClaimQuest();
				expect(result).toBe('mistreevous.failed');
				expect(memory.cachedAvailableQuest).toBeNull();
			});

			it('fails if no cached quest', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				const { actions } = setupActions(actor);

				expect(actions.ClaimQuest()).toBe('mistreevous.failed');
			});

			it('fails if getQuestBoard is not provided', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				const { actions, memory } = setupActions(actor);
				memory.cachedAvailableQuest = makeQuest();

				expect(actions.ClaimQuest()).toBe('mistreevous.failed');
			});

			it('fails if quest not found on board', () => {
				const board = makeQuestBoard([]);
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				const { actions, memory } = setupActions(actor, {
					getQuestBoard: () => board,
				});
				memory.cachedAvailableQuest = makeQuest();

				expect(actions.ClaimQuest()).toBe('mistreevous.failed');
				expect(memory.cachedAvailableQuest).toBeNull();
			});
		});

		describe('SeekQuestFacility', () => {
			it('sets movementTarget and returns RUNNING when not at facility', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				const { actions, memory } = setupActions(actor);
				memory.activeQuest = makeQuest({ facilityId: 'loc-bakery' });

				const result = actions.SeekQuestFacility();
				expect(result).toBe('mistreevous.running');
				expect(memory.btAction).toBe('seek_quest');
				expect(memory.movementTarget).toEqual({ id: 'loc-bakery', type: 'location' });
			});

			it('returns SUCCEEDED when already at quest facility', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				const { actions, memory } = setupActions(actor);
				memory.activeQuest = makeQuest({ facilityId: 'loc-bakery' });
				memory.atLocation = 'loc-bakery';

				expect(actions.SeekQuestFacility()).toBe('mistreevous.succeeded');
			});

			it('returns FAILED when no active quest', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				const { actions } = setupActions(actor);

				expect(actions.SeekQuestFacility()).toBe('mistreevous.failed');
			});
		});

		describe('WorkRepair', () => {
			it('sets btAction to repair and returns RUNNING for repair quest', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				const { actions, memory } = setupActions(actor);
				memory.activeQuest = makeQuest({ type: 'repair', itemId: null });

				const result = actions.WorkRepair();
				expect(result).toBe('mistreevous.running');
				expect(memory.btAction).toBe('repair');
			});

			it('returns FAILED when no active quest', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				const { actions } = setupActions(actor);

				expect(actions.WorkRepair()).toBe('mistreevous.failed');
			});

			it('returns FAILED when quest is not repair type', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				const { actions, memory } = setupActions(actor);
				memory.activeQuest = makeQuest({ type: 'supply' });

				expect(actions.WorkRepair()).toBe('mistreevous.failed');
			});
		});

		describe('SeekQuestSource', () => {
			it('returns FAILED when no active quest', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				const { actions } = setupActions(actor);
				expect(actions.SeekQuestSource()).toBe('mistreevous.failed');
			});

			it('returns FAILED for repair quests (no source needed)', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				const { actions, memory } = setupActions(actor);
				memory.activeQuest = makeQuest({ type: 'repair', itemId: null });
				expect(actions.SeekQuestSource()).toBe('mistreevous.failed');
			});

			it('returns FAILED when no known facility produces the quest item', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				const { actions, memory } = setupActions(actor, {
					getLocations: () => [
						makeLocation('loc-market', 'market'),
						// no producer of wheat
					],
				});
				memory.activeQuest = makeQuest({ type: 'restock', itemId: 'wheat', facilityId: 'loc-market' });
				memory.knownLocations = ['loc-market'];
				expect(actions.SeekQuestSource()).toBe('mistreevous.failed');
			});

			it('moves toward the nearest known producer of the quest item', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				const farmland = makeLocation('loc-farmland', 'food', 0, 0, {
					output: { item_id: 'wheat', quantity: 1 },
					input: null,
					job: 'settler',
					ticks: 15,
					wage: 3,
					funding: 'self',
				} as WorldLocation['production']);
				const market = makeLocation('loc-market', 'market', 100, 0);
				const farmFac = createLocationActor({
					stock: [{ item_id: 'wheat', quantity: 5 }],
					fund: 100, workProgress: 0, status: 'idle', workerId: null,
				});
				const locActors = new Map<string, Actor>([['loc-farmland', farmFac]]);
				const { actions, memory } = setupActions(actor, {
					getLocations: () => [farmland, market],
					getLocationActors: () => locActors,
				});
				memory.activeQuest = makeQuest({ type: 'restock', itemId: 'wheat', facilityId: 'loc-market', quantity: 2 });
				memory.knownLocations = ['loc-farmland', 'loc-market'];

				const result = actions.SeekQuestSource();
				expect(result).toBe('mistreevous.running');
				expect(memory.movementTarget).toEqual({ id: 'loc-farmland', type: 'location' });
				expect(memory.btAction).toBe('seek_quest_source');
			});

			it('returns SUCCEEDED when already at the source facility', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				const farmland = makeLocation('loc-farmland', 'food', 0, 0, {
					output: { item_id: 'wheat', quantity: 1 },
					input: null,
					job: 'settler',
					ticks: 15,
					wage: 3,
					funding: 'self',
				} as WorldLocation['production']);
				const farmFac = createLocationActor({
					stock: [{ item_id: 'wheat', quantity: 5 }],
					fund: 100, workProgress: 0, status: 'idle', workerId: null,
				});
				const locActors = new Map<string, Actor>([['loc-farmland', farmFac]]);
				const { actions, memory } = setupActions(actor, {
					getLocations: () => [farmland],
					getLocationActors: () => locActors,
				});
				memory.activeQuest = makeQuest({ type: 'restock', itemId: 'wheat', facilityId: 'loc-market', quantity: 2 });
				memory.knownLocations = ['loc-farmland'];
				memory.atLocation = 'loc-farmland';

				expect(actions.SeekQuestSource()).toBe('mistreevous.succeeded');
			});

			it('skips sources with insufficient stock', () => {
				// Regression: without stock filtering, the nearest producer wins even
				// if its stock is empty. Agent walks there, PickupForQuest fails, loop.
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				const nearEmpty = makeLocation('loc-farm-empty', 'food', 0, 0, {
					output: { item_id: 'wheat', quantity: 1 },
					input: null,
					job: 'settler',
					ticks: 15,
					wage: 3,
					funding: 'self',
				} as WorldLocation['production']);
				const farStocked = makeLocation('loc-farm-stocked', 'food', 500, 0, {
					output: { item_id: 'wheat', quantity: 1 },
					input: null,
					job: 'settler',
					ticks: 15,
					wage: 3,
					funding: 'self',
				} as WorldLocation['production']);
				const emptyFac = createLocationActor({
					stock: [{ item_id: 'wheat', quantity: 0 }],
					fund: 100, workProgress: 0, status: 'idle', workerId: null,
				});
				const stockedFac = createLocationActor({
					stock: [{ item_id: 'wheat', quantity: 10 }],
					fund: 100, workProgress: 0, status: 'idle', workerId: null,
				});
				const locActors = new Map<string, Actor>([
					['loc-farm-empty', emptyFac],
					['loc-farm-stocked', stockedFac],
				]);
				const { actions, memory } = setupActions(actor, {
					getLocations: () => [nearEmpty, farStocked],
					getLocationActors: () => locActors,
				});
				memory.activeQuest = makeQuest({ type: 'restock', itemId: 'wheat', facilityId: 'loc-market', quantity: 2 });
				memory.knownLocations = ['loc-farm-empty', 'loc-farm-stocked'];

				actions.SeekQuestSource();
				// Empty farm is closer but has no stock — must route to the stocked farm
				expect(memory.movementTarget).toEqual({ id: 'loc-farm-stocked', type: 'location' });
			});

			it('returns FAILED when all producers are out of stock', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				const farm = makeLocation('loc-farm', 'food', 0, 0, {
					output: { item_id: 'wheat', quantity: 1 },
					input: null,
					job: 'settler',
					ticks: 15,
					wage: 3,
					funding: 'self',
				} as WorldLocation['production']);
				const emptyFac = createLocationActor({
					stock: [],
					fund: 100, workProgress: 0, status: 'idle', workerId: null,
				});
				const locActors = new Map<string, Actor>([['loc-farm', emptyFac]]);
				const { actions, memory } = setupActions(actor, {
					getLocations: () => [farm],
					getLocationActors: () => locActors,
				});
				memory.activeQuest = makeQuest({ type: 'restock', itemId: 'wheat', facilityId: 'loc-market', quantity: 1 });
				memory.knownLocations = ['loc-farm'];

				expect(actions.SeekQuestSource()).toBe('mistreevous.failed');
			});

			it('skips the quest target facility when searching for a source', () => {
				// Prevent picking from the destination
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				const market = makeLocation('loc-market', 'market', 50, 0, {
					output: { item_id: 'wheat', quantity: 1 },
					input: null,
					job: 'shopkeeper',
					ticks: 30,
					wage: 2,
					funding: 'self',
				} as WorldLocation['production']);
				const farmland = makeLocation('loc-farmland', 'food', 500, 0, {
					output: { item_id: 'wheat', quantity: 1 },
					input: null,
					job: 'settler',
					ticks: 15,
					wage: 3,
					funding: 'self',
				} as WorldLocation['production']);
				// Both facilities have stock — market is closer but must be skipped because it's the target
				const marketFac = createLocationActor({
					stock: [{ item_id: 'wheat', quantity: 10 }],
					fund: 100, workProgress: 0, status: 'idle', workerId: null,
				});
				const farmFac = createLocationActor({
					stock: [{ item_id: 'wheat', quantity: 10 }],
					fund: 100, workProgress: 0, status: 'idle', workerId: null,
				});
				const locActors = new Map<string, Actor>([
					['loc-market', marketFac],
					['loc-farmland', farmFac],
				]);
				const { actions, memory } = setupActions(actor, {
					getLocations: () => [market, farmland],
					getLocationActors: () => locActors,
				});
				memory.activeQuest = makeQuest({ type: 'restock', itemId: 'wheat', facilityId: 'loc-market', quantity: 2 });
				memory.knownLocations = ['loc-market', 'loc-farmland'];

				actions.SeekQuestSource();
				// Market is closer AND has stock, but it's the quest target — must skip and pick farmland
				expect(memory.movementTarget).toEqual({ id: 'loc-farmland', type: 'location' });
			});
		});

		describe('PickupForQuest', () => {
			it('returns FAILED when no active quest', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				const { actions } = setupActions(actor);
				expect(actions.PickupForQuest()).toBe('mistreevous.failed');
			});

			it('returns FAILED when not at a facility', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				const { actions, memory } = setupActions(actor);
				memory.activeQuest = makeQuest({ type: 'restock', itemId: 'wheat' });
				memory.atLocation = null;
				expect(actions.PickupForQuest()).toBe('mistreevous.failed');
			});

			it('returns FAILED when facility stock is insufficient', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				const farmActor = createLocationActor({
					stock: [{ item_id: 'wheat', quantity: 1 }],
					fund: 100,
					workProgress: 0,
					status: 'idle',
					workerId: null,
				});
				const locActors = new Map([['loc-farmland', farmActor]]);
				const { actions, memory } = setupActions(actor, {
					getLocationActors: () => locActors,
				});
				memory.activeQuest = makeQuest({ type: 'restock', itemId: 'wheat', quantity: 3 });
				memory.atLocation = 'loc-farmland';
				expect(actions.PickupForQuest()).toBe('mistreevous.failed');
			});

			it('transfers the quest quantity from facility stock to questCargo', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				const farmActor = createLocationActor({
					stock: [{ item_id: 'wheat', quantity: 5 }],
					fund: 100,
					workProgress: 0,
					status: 'idle',
					workerId: null,
				});
				const locActors = new Map([['loc-farmland', farmActor]]);
				const { actions, memory } = setupActions(actor, {
					getLocationActors: () => locActors,
				});
				memory.activeQuest = makeQuest({ id: 'q-42', type: 'restock', itemId: 'wheat', quantity: 2 });
				memory.atLocation = 'loc-farmland';

				const result = actions.PickupForQuest();
				expect(result).toBe('mistreevous.succeeded');
				expect(memory.questCargo).toEqual({ itemId: 'wheat', quantity: 2, questId: 'q-42' });
				// Facility stock reduced by 2
				const remaining = farmActor.get(FacilityComponent).state.stock.find(s => s.item_id === 'wheat');
				expect(remaining?.quantity).toBe(3);
				expect(memory.btAction).toBe('pickup_quest_item');
			});

			it('does not touch personal inventory', () => {
				const actor = new AgentActor(
					createTestAgentData('a1', { inventory: [{ item_id: 'wheat', quantity: 4 }] }),
					defaultMoodConfig,
				);
				const farmActor = createLocationActor({
					stock: [{ item_id: 'wheat', quantity: 5 }],
					fund: 100,
					workProgress: 0,
					status: 'idle',
					workerId: null,
				});
				const locActors = new Map([['loc-farmland', farmActor]]);
				const { actions, memory } = setupActions(actor, {
					getLocationActors: () => locActors,
				});
				memory.activeQuest = makeQuest({ type: 'restock', itemId: 'wheat', quantity: 1 });
				memory.atLocation = 'loc-farmland';

				actions.PickupForQuest();
				const invWheat = actor.get(InventoryComponent).state.items.find(i => i.item_id === 'wheat');
				expect(invWheat?.quantity).toBe(4); // unchanged
			});

			it('returns FAILED for repair quests', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				const { actions, memory } = setupActions(actor);
				memory.activeQuest = makeQuest({ type: 'repair', itemId: null });
				memory.atLocation = 'loc-farmland';
				expect(actions.PickupForQuest()).toBe('mistreevous.failed');
			});

			it('returns SUCCEEDED idempotently when cargo already picked up (re-entry guard)', () => {
				// Regression: without this guard, a double-entry would overwrite the
				// existing cargo AND subtract again from the facility — silent item loss.
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				const farmActor = createLocationActor({
					stock: [{ item_id: 'wheat', quantity: 5 }],
					fund: 100, workProgress: 0, status: 'idle', workerId: null,
				});
				const locActors = new Map([['loc-farmland', farmActor]]);
				const { actions, memory } = setupActions(actor, {
					getLocationActors: () => locActors,
				});
				memory.activeQuest = makeQuest({ id: 'q-42', type: 'restock', itemId: 'wheat', quantity: 2 });
				memory.atLocation = 'loc-farmland';
				// Pre-existing cargo for the same quest
				memory.questCargo = { itemId: 'wheat', quantity: 2, questId: 'q-42' };

				const result = actions.PickupForQuest();
				expect(result).toBe('mistreevous.succeeded');
				// Facility stock should NOT have been reduced a second time
				expect(farmActor.get(FacilityComponent).state.stock.find(s => s.item_id === 'wheat')?.quantity).toBe(5);
				// Cargo unchanged
				expect(memory.questCargo).toEqual({ itemId: 'wheat', quantity: 2, questId: 'q-42' });
			});
		});

		describe('Restock quest end-to-end', () => {
			it('completes a restock via source → pickup → deliver (questCargo path)', () => {
				const quest = makeQuest({ id: 'q-42', type: 'restock', itemId: 'wheat', quantity: 2, reward: 15, facilityId: 'loc-market' });

				// Agent has NO wheat in personal inventory — must source it from the farm
				const actor = new AgentActor(
					createTestAgentData('a1', { inventory: [], wallet: { gold: 0 } }),
					defaultMoodConfig,
				);

				// Farm has wheat in stock; market has empty stock and will receive the delivery
				const farmActor = createLocationActor({
					stock: [{ item_id: 'wheat', quantity: 5 }],
					fund: 100, workProgress: 0, status: 'idle', workerId: null,
				});
				const marketActor = createLocationActor({
					stock: [], fund: 100, workProgress: 0, status: 'idle', workerId: null,
				});
				const locActors = new Map<string, Actor>([
					['loc-farmland', farmActor],
					['loc-market', marketActor],
				]);
				const worldEntity = createWorldEntity();

				const { actions, memory } = setupActions(actor, {
					getLocationActors: () => locActors,
					worldEntity: () => worldEntity,
					tickCount: () => 100,
				});

				memory.activeQuest = quest;
				memory.knownLocations = ['loc-farmland', 'loc-market'];
				memory.atLocation = 'loc-farmland'; // pre-arrived for brevity

				// Step 1: pickup for quest
				expect(actions.PickupForQuest()).toBe('mistreevous.succeeded');
				expect(memory.questCargo).toEqual({ itemId: 'wheat', quantity: 2, questId: 'q-42' });
				// Farm stock reduced
				expect(farmActor.get(FacilityComponent).state.stock.find(s => s.item_id === 'wheat')?.quantity).toBe(3);

				// Step 2: simulate arrival at quest facility
				memory.atLocation = 'loc-market';

				// Step 3: complete the quest — uses questCargo, NOT personal inventory (which is empty)
				const completeResult = actions.CompleteQuest();
				expect(completeResult).toBe('mistreevous.succeeded');
				expect(memory.activeQuest).toBeNull();
				expect(memory.questCargo).toBeNull(); // consumed

				// Market now has the wheat
				const marketWheat = marketActor.get(FacilityComponent).state.stock.find(s => s.item_id === 'wheat');
				expect(marketWheat?.quantity).toBe(2);

				// Personal inventory unchanged (never had wheat)
				expect(actor.get(InventoryComponent).state.items.find(i => i.item_id === 'wheat')).toBeUndefined();
			});

			it('AbandonQuest clears questCargo so stale cargo does not linger', () => {
				const quest = makeQuest({ type: 'restock', itemId: 'wheat', quantity: 2 });
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				const worldEntity = createWorldEntity();

				const { actions, memory } = setupActions(actor, {
					worldEntity: () => worldEntity,
					tickCount: () => 50,
				});

				memory.activeQuest = quest;
				memory.questCargo = { itemId: 'wheat', quantity: 2, questId: quest.id };

				expect(actions.AbandonQuest()).toBe('mistreevous.succeeded');
				expect(memory.activeQuest).toBeNull();
				expect(memory.questCargo).toBeNull();
			});
		});

		describe('CompleteQuest', () => {
			it('supply quest: transfers item, pays reward, creates positive memory', () => {
				const quest = makeQuest({ type: 'supply', itemId: 'wheat', quantity: 2, reward: 20 });
				const actor = new AgentActor(
					createTestAgentData('a1', {
						inventory: [{ item_id: 'wheat', quantity: 5 }],
						wallet: { gold: 10 },
					}),
					defaultMoodConfig,
				);

				const facActor = createLocationActor({
					stock: [], fund: 100, workProgress: 0, status: 'idle', workerId: null,
				});
				const locActors = new Map<string, Actor>([['loc-market', facActor]]);

				const emitted: { type: string; payload: Record<string, unknown> }[] = [];
				const spyEventBus: EventBus = {
					emit: (e) => { emitted.push({ type: e.type, payload: e.payload }); },
					on: () => () => {},
					off: () => {},
					onAny: () => () => {},
					filter: () => () => {},
					history: () => [],
				};

				const worldEntity = createWorldEntity();

				const { actions, memory } = setupActions(actor, {
					eventBus: spyEventBus,
					getLocationActors: () => locActors,
					worldEntity: () => worldEntity,
					tickCount: () => 42,
				});

				memory.activeQuest = quest;

				const result = actions.CompleteQuest();
				expect(result).toBe('mistreevous.succeeded');

				// Item transferred from agent
				const agentWheat = actor.get(InventoryComponent).state.items.find(i => i.item_id === 'wheat');
				expect(agentWheat?.quantity).toBe(3);

				// Item added to facility
				const facWheat = facActor.get(FacilityComponent).state.stock.find(s => s.item_id === 'wheat');
				expect(facWheat?.quantity).toBe(2);

				// Reward paid
				expect(actor.get(WalletComponent).state.gold).toBe(30);
				expect(worldEntity.get(EconomyComponent).state.treasury).toBe(480);

				// Positive memory created
				const entries = actor.get(MemoryComponent).state.entries;
				expect(entries).toHaveLength(1);
				expect(entries[0]!.type).toBe('quest_completed');
				expect(entries[0]!.outcome).toBe('positive');
				expect(entries[0]!.mood_impact).toBe(15);

				// Quest marked completed
				expect(quest.state).toBe('completed');
				expect(memory.activeQuest).toBeNull();

				// Events: GoldFlowed + QuestCompleted
				expect(emitted.some(e => e.type === 'GoldFlowed')).toBe(true);
				expect(emitted.some(e => e.type === 'QuestCompleted')).toBe(true);
			});

			it('supply quest: removes item entirely when quantity matches', () => {
				const quest = makeQuest({ type: 'supply', itemId: 'wheat', quantity: 3, reward: 10 });
				const actor = new AgentActor(
					createTestAgentData('a1', {
						inventory: [{ item_id: 'wheat', quantity: 3 }],
					}),
					defaultMoodConfig,
				);

				const facActor = createLocationActor({
					stock: [], fund: 100, workProgress: 0, status: 'idle', workerId: null,
				});
				const locActors = new Map<string, Actor>([['loc-market', facActor]]);
				const worldEntity = createWorldEntity();

				const { actions, memory } = setupActions(actor, {
					getLocationActors: () => locActors,
					worldEntity: () => worldEntity,
				});

				memory.activeQuest = quest;
				actions.CompleteQuest();

				// Item fully consumed
				const agentItems = actor.get(InventoryComponent).state.items;
				expect(agentItems.find(i => i.item_id === 'wheat')).toBeUndefined();
			});

			it('supply quest: fails when agent lacks required item', () => {
				const quest = makeQuest({ type: 'supply', itemId: 'wheat', quantity: 5 });
				const actor = new AgentActor(
					createTestAgentData('a1', {
						inventory: [{ item_id: 'wheat', quantity: 2 }],
					}),
					defaultMoodConfig,
				);

				const { actions, memory } = setupActions(actor);
				memory.activeQuest = quest;

				expect(actions.CompleteQuest()).toBe('mistreevous.failed');
			});

			it('supply quest: fails when itemId is null', () => {
				const quest = makeQuest({ type: 'supply', itemId: null });
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				const { actions, memory } = setupActions(actor);
				memory.activeQuest = quest;

				expect(actions.CompleteQuest()).toBe('mistreevous.failed');
			});

			it('repair quest: restores facility and injects fund', () => {
				const config = GameConfigSchema.parse({});
				const quest = makeQuest({
					type: 'repair',
					itemId: null,
					reward: 25,
					repairProgress: config.quests.repair_ticks,
				});
				const actor = new AgentActor(
					createTestAgentData('a1', { wallet: { gold: 0 } }),
					defaultMoodConfig,
				);

				const facActor = createLocationActor({
					stock: [], fund: 0, workProgress: 0, status: 'abandoned' as 'idle', workerId: null,
				});
				const locActors = new Map<string, Actor>([['loc-market', facActor]]);
				const worldEntity = createWorldEntity();

				const emitted: { type: string; payload: Record<string, unknown> }[] = [];
				const spyEventBus: EventBus = {
					emit: (e) => { emitted.push({ type: e.type, payload: e.payload }); },
					on: () => () => {},
					off: () => {},
					onAny: () => () => {},
					filter: () => () => {},
					history: () => [],
				};

				const { actions, memory } = setupActions(actor, {
					config,
					eventBus: spyEventBus,
					getLocationActors: () => locActors,
					worldEntity: () => worldEntity,
				});

				memory.activeQuest = quest;

				const result = actions.CompleteQuest();
				expect(result).toBe('mistreevous.succeeded');

				// Facility restored
				const facState = facActor.get(FacilityComponent).state;
				expect(facState.status).toBe('idle');
				expect(facState.fund).toBe(config.quests.repair_fund_injection);

				// Reward paid
				expect(actor.get(WalletComponent).state.gold).toBe(25);

				// Events emitted
				expect(emitted.some(e => e.type === 'QuestCompleted')).toBe(true);
			});

			it('repair quest: fails when repair progress insufficient', () => {
				const quest = makeQuest({ type: 'repair', itemId: null, repairProgress: 5 });
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				const { actions, memory } = setupActions(actor);
				memory.activeQuest = quest;

				expect(actions.CompleteQuest()).toBe('mistreevous.failed');
			});

			it('emits QuestRewardSkipped when treasury is empty', () => {
				const quest = makeQuest({ type: 'supply', itemId: 'wheat', quantity: 1, reward: 600 });
				const actor = new AgentActor(
					createTestAgentData('a1', {
						inventory: [{ item_id: 'wheat', quantity: 5 }],
						wallet: { gold: 10 },
					}),
					defaultMoodConfig,
				);

				const facActor = createLocationActor({
					stock: [], fund: 100, workProgress: 0, status: 'idle', workerId: null,
				});
				const locActors = new Map<string, Actor>([['loc-market', facActor]]);

				// World with treasury=500, quest reward=600
				const worldEntity = createWorldEntity();

				const emitted: { type: string; payload: Record<string, unknown> }[] = [];
				const spyEventBus: EventBus = {
					emit: (e) => { emitted.push({ type: e.type, payload: e.payload }); },
					on: () => () => {},
					off: () => {},
					onAny: () => () => {},
					filter: () => () => {},
					history: () => [],
				};

				const { actions, memory } = setupActions(actor, {
					eventBus: spyEventBus,
					getLocationActors: () => locActors,
					worldEntity: () => worldEntity,
				});

				memory.activeQuest = quest;

				const result = actions.CompleteQuest();
				expect(result).toBe('mistreevous.succeeded');

				// No gold paid
				expect(actor.get(WalletComponent).state.gold).toBe(10);

				// QuestRewardSkipped emitted
				expect(emitted.some(e => e.type === 'QuestRewardSkipped')).toBe(true);
				const skipped = emitted.find(e => e.type === 'QuestRewardSkipped');
				expect(skipped!.payload).toEqual({
					agentId: 'a1',
					questId: 'q-1',
					reason: 'treasury_empty',
				});

				// Quest still completed
				expect(quest.state).toBe('completed');
				expect(emitted.some(e => e.type === 'QuestCompleted')).toBe(true);
			});

			it('returns FAILED when no active quest', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				const { actions } = setupActions(actor);

				expect(actions.CompleteQuest()).toBe('mistreevous.failed');
			});

			it('supply quest: adds to existing facility stock', () => {
				const quest = makeQuest({ type: 'supply', itemId: 'wheat', quantity: 2, reward: 10 });
				const actor = new AgentActor(
					createTestAgentData('a1', {
						inventory: [{ item_id: 'wheat', quantity: 5 }],
					}),
					defaultMoodConfig,
				);

				const facActor = createLocationActor({
					stock: [{ item_id: 'wheat', quantity: 3 }],
					fund: 100, workProgress: 0, status: 'idle', workerId: null,
				});
				const locActors = new Map<string, Actor>([['loc-market', facActor]]);
				const worldEntity = createWorldEntity();

				const { actions, memory } = setupActions(actor, {
					getLocationActors: () => locActors,
					worldEntity: () => worldEntity,
				});

				memory.activeQuest = quest;
				actions.CompleteQuest();

				const facWheat = facActor.get(FacilityComponent).state.stock.find(s => s.item_id === 'wheat');
				expect(facWheat?.quantity).toBe(5);
			});

			it('returns FAILED when the target facility is missing (questCargo path)', () => {
				// Regression: previously the questCargo branch would consume cargo
				// and pay reward even when the facility couldn't be found — silent
				// item loss. Fix: bail with FAILED so the agent keeps the cargo.
				const quest = makeQuest({ id: 'q-ghost', type: 'restock', itemId: 'wheat', quantity: 2, reward: 15, facilityId: 'loc-market' });
				const actor = new AgentActor(
					createTestAgentData('a1', { wallet: { gold: 0 } }),
					defaultMoodConfig,
				);
				// No facility actor in the map — the market has "disappeared"
				const locActors = new Map<string, Actor>();
				const worldEntity = createWorldEntity();
				worldEntity.addComponent(new QuestBoardComponent({ quests: [quest] }));

				const { actions, memory } = setupActions(actor, {
					getLocationActors: () => locActors,
					worldEntity: () => worldEntity,
				});

				memory.activeQuest = quest;
				memory.questCargo = { itemId: 'wheat', quantity: 2, questId: 'q-ghost' };

				const result = actions.CompleteQuest();
				expect(result).toBe('mistreevous.failed');
				// Cargo should be preserved for a retry / abandon
				expect(memory.questCargo).not.toBeNull();
				// Quest not marked completed
				expect(memory.activeQuest).not.toBeNull();
				// Reward not paid
				expect(actor.get(WalletComponent).state.gold).toBe(0);
			});
		});

		describe('AbandonQuest', () => {
			it('resets quest to open, creates negative memory, emits QuestAbandoned', () => {
				const quest = makeQuest({ state: 'claimed', claimedBy: 'a1' });
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);

				const emitted: { type: string; payload: Record<string, unknown> }[] = [];
				const spyEventBus: EventBus = {
					emit: (e) => { emitted.push({ type: e.type, payload: e.payload }); },
					on: () => () => {},
					off: () => {},
					onAny: () => () => {},
					filter: () => () => {},
					history: () => [],
				};

				const { actions, memory } = setupActions(actor, {
					eventBus: spyEventBus,
					tickCount: () => 100,
				});

				memory.activeQuest = quest;

				const result = actions.AbandonQuest();
				expect(result).toBe('mistreevous.succeeded');

				// Quest reset
				expect(quest.state).toBe('open');
				expect(quest.claimedBy).toBeNull();
				expect(quest.repairProgress).toBe(0);
				expect(memory.activeQuest).toBeNull();

				// Negative memory created
				const entries = actor.get(MemoryComponent).state.entries;
				expect(entries).toHaveLength(1);
				expect(entries[0]!.type).toBe('quest_failed');
				expect(entries[0]!.outcome).toBe('negative');
				expect(entries[0]!.mood_impact).toBe(-10);
				expect(entries[0]!.significance).toBe(5);

				// Event emitted
				expect(emitted).toHaveLength(1);
				expect(emitted[0]!.type).toBe('QuestAbandoned');
				expect(emitted[0]!.payload).toEqual({
					agentId: 'a1',
					questId: 'q-1',
					reason: 'abandoned',
				});
			});

			it('returns FAILED when no active quest', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				const { actions } = setupActions(actor);

				expect(actions.AbandonQuest()).toBe('mistreevous.failed');
			});
		});
	});

	describe('ContinueCommitment', () => {
		it('breaks work commitment when hunger < personal threshold', () => {
			const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
			const { actions, memory } = setupActions(actor, { config });
			memory.committedAction = 'work';
			memory.commitmentTicks = 20;
			actor.get(NeedsComponent).state = { ...actor.get(NeedsComponent).state, hunger: 35 };
			memory.personalThresholds = { hunger: 40, energy: 30, thirst: 40 };
			actor.get(InventoryComponent).state = { items: [{ item_id: 'equipment', quantity: 1, charges: 15 }] };
			expect(actions.ContinueCommitment()).toBe('mistreevous.failed');
			expect(memory.committedAction).toBeNull();
		});

		it('breaks work commitment when thirst < personal threshold', () => {
			const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
			const { actions, memory } = setupActions(actor, { config });
			memory.committedAction = 'work';
			memory.commitmentTicks = 20;
			actor.get(NeedsComponent).state = { ...actor.get(NeedsComponent).state, thirst: 35 };
			memory.personalThresholds = { hunger: 40, energy: 30, thirst: 40 };
			actor.get(InventoryComponent).state = { items: [{ item_id: 'equipment', quantity: 1, charges: 15 }] };
			expect(actions.ContinueCommitment()).toBe('mistreevous.failed');
			expect(memory.committedAction).toBeNull();
		});

		it('breaks work commitment when equipment missing', () => {
			const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
			const { actions, memory } = setupActions(actor, { config });
			memory.committedAction = 'work';
			memory.commitmentTicks = 20;
			actor.get(NeedsComponent).state = { ...actor.get(NeedsComponent).state, hunger: 80, thirst: 80 };
			memory.personalThresholds = { hunger: 40, energy: 30, thirst: 40 };
			actor.get(InventoryComponent).state = { items: [] };
			expect(actions.ContinueCommitment()).toBe('mistreevous.failed');
		});

		it('breaks work commitment when equipment charges < repair threshold', () => {
			const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
			const { actions, memory } = setupActions(actor, { config });
			memory.committedAction = 'work';
			memory.commitmentTicks = 20;
			actor.get(NeedsComponent).state = { ...actor.get(NeedsComponent).state, hunger: 80, thirst: 80 };
			memory.personalThresholds = { hunger: 40, energy: 30, thirst: 40 };
			actor.get(InventoryComponent).state = { items: [{ item_id: 'equipment', quantity: 1, charges: 5 }] };
			expect(actions.ContinueCommitment()).toBe('mistreevous.failed');
		});

		it('does NOT break work commitment when equipment charges at repair threshold', () => {
			const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
			const { actions, memory } = setupActions(actor, { config });
			memory.committedAction = 'work';
			memory.commitmentTicks = 20;
			actor.get(NeedsComponent).state = { ...actor.get(NeedsComponent).state, hunger: 80, thirst: 80 };
			memory.personalThresholds = { hunger: 40, energy: 30, thirst: 40 };
			actor.get(InventoryComponent).state = { items: [{ item_id: 'equipment', quantity: 1, charges: 10 }] };
			expect(actions.ContinueCommitment()).toBe('mistreevous.running');
		});

		it('does NOT break work commitment when all needs healthy and equipment OK', () => {
			const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
			const { actions, memory } = setupActions(actor, { config });
			memory.committedAction = 'work';
			memory.commitmentTicks = 20;
			actor.get(NeedsComponent).state = { ...actor.get(NeedsComponent).state, hunger: 80, thirst: 80 };
			memory.personalThresholds = { hunger: 40, energy: 30, thirst: 40 };
			actor.get(InventoryComponent).state = { items: [{ item_id: 'equipment', quantity: 1, charges: 15 }] };
			expect(actions.ContinueCommitment()).toBe('mistreevous.running');
			expect(memory.commitmentTicks).toBe(19);
		});

		it('does NOT break sell commitment at personal hunger threshold', () => {
			const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
			const { actions, memory } = setupActions(actor, { config });
			memory.committedAction = 'sell';
			memory.commitmentTicks = 5;
			actor.get(NeedsComponent).state = { ...actor.get(NeedsComponent).state, hunger: 35 };
			memory.personalThresholds = { hunger: 40, energy: 30, thirst: 40 };
			expect(actions.ContinueCommitment()).toBe('mistreevous.running');
		});

		it('does NOT break rest commitment at personal hunger threshold', () => {
			const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
			const { actions, memory } = setupActions(actor, { config });
			memory.committedAction = 'rest';
			memory.commitmentTicks = 15;
			actor.get(NeedsComponent).state = { ...actor.get(NeedsComponent).state, hunger: 35, energy: 50 };
			memory.personalThresholds = { hunger: 40, energy: 30, thirst: 40 };
			expect(actions.ContinueCommitment()).toBe('mistreevous.running');
		});

		it('existing: eat commitment breaks when hunger satisfied', () => {
			const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
			const { actions, memory } = setupActions(actor, { config });
			memory.committedAction = 'eat';
			memory.commitmentTicks = 5;
			actor.get(NeedsComponent).state = { ...actor.get(NeedsComponent).state, hunger: 80 };
			memory.personalThresholds = { hunger: 40, energy: 30, thirst: 40 };
			expect(actions.ContinueCommitment()).toBe('mistreevous.failed');
		});
	});

	describe('ContinueCommitment — travel commitments break on critical needs', () => {
		it('breaks seek_food when energy crosses critical threshold', () => {
			const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
			const { actions, memory } = setupActions(actor, { config });
			memory.committedAction = 'seek_food';
			memory.commitmentTicks = 6;
			actor.get(NeedsComponent).state = { ...actor.get(NeedsComponent).state, hunger: 20, thirst: 80, energy: 10, social: 50 };
			memory.personalThresholds = { hunger: 40, energy: 30, thirst: 40 };
			expect(actions.ContinueCommitment()).toBe('mistreevous.failed');
		});

		it('does NOT break seek_food for sub-critical thirst (only personal threshold)', () => {
			// Personal thirst=40, critical=20, thirst=30 is below personal but above critical.
			// Travel commitments only break on CRITICAL, not personal thresholds.
			const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
			const { actions, memory } = setupActions(actor, { config });
			memory.committedAction = 'seek_food';
			memory.commitmentTicks = 8;
			actor.get(NeedsComponent).state = { ...actor.get(NeedsComponent).state, hunger: 80, thirst: 30, energy: 80, social: 50 };
			memory.personalThresholds = { hunger: 40, energy: 30, thirst: 40 };
			expect(actions.ContinueCommitment()).toBe('mistreevous.running');
			expect(memory.commitmentTicks).toBe(7);
		});

		it('does NOT break seek_market when all needs above critical', () => {
			const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
			const { actions, memory } = setupActions(actor, { config });
			memory.committedAction = 'seek_market';
			memory.commitmentTicks = 10;
			actor.get(NeedsComponent).state = { ...actor.get(NeedsComponent).state, hunger: 80, thirst: 80, energy: 80, social: 50 };
			memory.personalThresholds = { hunger: 40, energy: 30, thirst: 40 };
			expect(actions.ContinueCommitment()).toBe('mistreevous.running');
		});

		it('work commitment uses personal-threshold logic even with critical-level thirst (regression)', () => {
			// Work break fires because thirst 10 < personal threshold 40. The new
			// critical-travel block only applies to seek_* commitments.
			const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
			const { actions, memory } = setupActions(actor, { config });
			memory.committedAction = 'work';
			memory.commitmentTicks = 20;
			actor.get(NeedsComponent).state = { ...actor.get(NeedsComponent).state, hunger: 80, thirst: 10, energy: 80 };
			memory.personalThresholds = { hunger: 40, energy: 30, thirst: 40 };
			actor.get(InventoryComponent).state = { items: [{ item_id: 'equipment', quantity: 1, charges: 15 }] };
			expect(actions.ContinueCommitment()).toBe('mistreevous.failed');
		});

		it('breaks all travel variants on critical hunger', () => {
			const variants = ['seek_food', 'seek_market', 'seek_quest', 'seek_quest_source', 'seek_delivery', 'seek_supply', 'seek_job_facility', 'seek_service', 'seek_social', 'seek_work'];
			for (const travelAction of variants) {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				const { actions, memory } = setupActions(actor, { config });
				memory.committedAction = travelAction;
				memory.commitmentTicks = 5;
				actor.get(NeedsComponent).state = { ...actor.get(NeedsComponent).state, hunger: 10, thirst: 80, energy: 80, social: 50 };
				memory.personalThresholds = { hunger: 40, energy: 30, thirst: 40 };
				expect(actions.ContinueCommitment(), `variant=${travelAction}`).toBe('mistreevous.failed');
			}
		});

		it('breaks repair commitment when thirst drops below personal threshold', () => {
			// Regression for recording 2026-04-11-1610 — agents mid-repair
			// ignored low thirst because `repair` wasn't in the break list.
			const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
			const { actions, memory } = setupActions(actor, { config });
			memory.committedAction = 'repair';
			memory.commitmentTicks = 20;
			actor.get(NeedsComponent).state = { ...actor.get(NeedsComponent).state, hunger: 80, thirst: 35, energy: 80 };
			memory.personalThresholds = { hunger: 40, energy: 30, thirst: 40 };
			actor.get(InventoryComponent).state = { items: [{ item_id: 'equipment', quantity: 1, charges: 15 }] };
			expect(actions.ContinueCommitment()).toBe('mistreevous.failed');
			expect(memory.committedAction).toBeNull();
		});
	});

	describe('ContinueCommitment — use_service cleanup', () => {
		it('clears currentServiceVisit and insideFacility when use_service expires', () => {
			const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
			const { actions, memory } = setupActions(actor, { config });
			memory.committedAction = 'use_service';
			memory.commitmentTicks = 1;
			memory.insideFacility = true;
			memory.currentServiceVisit = { facilityId: 'loc-tavern', ticksRemaining: 0, costPaid: true };

			expect(actions.ContinueCommitment()).toBe('mistreevous.failed');
			expect(memory.committedAction).toBeNull();
			expect(memory.currentServiceVisit).toBeNull();
			expect(memory.insideFacility).toBe(false);
		});

		it('does NOT clear service visit when a non-use_service commitment breaks', () => {
			// Sanity: clearing must be gated on ca === 'use_service'. A `work`
			// commitment breaking on hunger should not touch service-visit fields.
			const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
			const { actions, memory } = setupActions(actor, { config });
			memory.committedAction = 'work';
			memory.commitmentTicks = 20;
			memory.insideFacility = true;
			memory.currentServiceVisit = { facilityId: 'loc-tavern', ticksRemaining: 5, costPaid: true };
			actor.get(NeedsComponent).state = { ...actor.get(NeedsComponent).state, hunger: 35 };
			memory.personalThresholds = { hunger: 40, energy: 30, thirst: 40 };
			actor.get(InventoryComponent).state = { items: [{ item_id: 'equipment', quantity: 1, charges: 15 }] };

			expect(actions.ContinueCommitment()).toBe('mistreevous.failed');
			expect(memory.committedAction).toBeNull();
			// Service visit untouched — only the use_service path should clean it up
			expect(memory.currentServiceVisit).not.toBeNull();
			expect(memory.insideFacility).toBe(true);
		});
	});
});
