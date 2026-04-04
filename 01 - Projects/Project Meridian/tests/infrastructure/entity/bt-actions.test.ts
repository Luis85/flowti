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
import { GameConfigSchema } from '../../../src/domain/schemas/game-config-schema.js';
import type { GameConfig } from '../../../src/domain/schemas/game-config-schema.js';
import type { WorldLocation } from '../../../src/domain/schemas/location-schema.js';
import type { EventBus } from '../../../src/domain/core/events.js';
import type { PerceivedFacility, PerceivedAgent, PerceivedLocation } from '../../../src/domain/systems/behavior-agent.js';

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
		dailySummary: { totalWages: 0, totalTax: 0, totalSales: 0, totalConsumption: 0 },
	}));
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

function makeLocation(id: string, type: string, x = 0, y = 0, production: WorldLocation['production'] = null, region: string | null = null): WorldLocation {
	return {
		id,
		name: id,
		type: type as WorldLocation['type'],
		position: { x, y, region: region ?? 'test' },
		capacity: 10,
		color: '#808080',
		production,
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
	return { actor, worldEntity, config, getLocationActors, getLocations, tickCount, eventBus, ...overrides };
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
		const facilities: PerceivedFacility[] = [];

		for (const nearLoc of perception.state.nearbyLocations) {
			const locData = locationList.find(l => l.id === nearLoc.id);
			if (locData === undefined) continue;
			const locActor = locationActorMap.get(nearLoc.id);
			if (locActor?.has(FacilityComponent) !== true) continue;
			const facility = locActor.get(FacilityComponent);

			let hasUnmetInput = false;
			if (locData.production?.input !== null && locData.production?.input !== undefined) {
				const needed = locData.production.input;
				const inStock = facility.state.stock.find(s => s.item_id === needed.item_id);
				hasUnmetInput = inStock === undefined || inStock.quantity < needed.quantity;
			}

			facilities.push({
				id: nearLoc.id,
				job: locData.production?.job ?? '',
				stock: [...facility.state.stock],
				distance: nearLoc.distance,
				hasUnmetInput,
				workerId: facility.state.workerId,
				wage: locData.production?.wage ?? 0,
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
				type: locData?.type ?? nl.type,
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
			it('consumes a waterskin charge and recovers thirst', () => {
				const actor = new AgentActor(
					createTestAgentData('a1', {
						needs: { hunger: 80, energy: 90, social: 70, thirst: 40 },
						inventory: [{ item_id: 'waterskin', quantity: 1, charges: 2 }],
					}),
					defaultMoodConfig,
				);
				actor.get(NeedsComponent).state = { hunger: 80, energy: 90, social: 70, thirst: 40 };
				const { actions, memory } = setupActions(actor, { config });

				const result = actions.Drink();
				expect(result).toBe('mistreevous.succeeded');
				expect(memory.btAction).toBe('drink');

				// Charges decremented
				const waterskin = actor.get(InventoryComponent).state.items.find(i => i.item_id === 'waterskin');
				expect(waterskin?.charges).toBe(1);

				// Thirst recovered
				expect(actor.get(NeedsComponent).state.thirst).toBeGreaterThan(40);
			});

			it('returns failed when no waterskin with charges', () => {
				const actor = new AgentActor(
					createTestAgentData('a1', {
						inventory: [{ item_id: 'waterskin', quantity: 1, charges: 0 }],
					}),
					defaultMoodConfig,
				);
				const { actions } = setupActions(actor, { config });
				expect(actions.Drink()).toBe('mistreevous.failed');
			});

			it('returns failed when no waterskin at all', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				const { actions } = setupActions(actor, { config });
				expect(actions.Drink()).toBe('mistreevous.failed');
			});
		});

		describe('Rest', () => {
			it('sets btAction to rest and returns running', () => {
				const actor = new AgentActor(
					createTestAgentData('a1', { needs: { hunger: 80, energy: 30, social: 70, thirst: 80 } }),
					defaultMoodConfig,
				);
				const { actions, memory } = setupActions(actor, { config });

				const result = actions.Rest();
				expect(result).toBe('mistreevous.running');
				expect(memory.btAction).toBe('rest');
			});

			it('does not modify energy (system handles that)', () => {
				const actor = new AgentActor(
					createTestAgentData('a1', { needs: { hunger: 80, energy: 30, social: 70, thirst: 80 } }),
					defaultMoodConfig,
				);
				actor.get(NeedsComponent).state = { hunger: 80, energy: 30, social: 70, thirst: 80 };
				const { actions } = setupActions(actor, { config });

				actions.Rest();
				expect(actor.get(NeedsComponent).state.energy).toBe(30);
			});
		});

		describe('FillWaterskin', () => {
			it('fills waterskin when at water location', () => {
				const actor = new AgentActor(
					createTestAgentData('a1', {
						inventory: [{ item_id: 'waterskin', quantity: 1, charges: 0 }],
					}),
					defaultMoodConfig,
				);
				const locations = [makeLocation('loc-river', 'water')];
				const { actions, memory } = setupActions(actor, {
					config,
					getLocations: () => locations,
				});
				memory.atLocation = 'loc-river';

				const result = actions.FillWaterskin();
				expect(result).toBe('mistreevous.succeeded');
				expect(memory.btAction).toBe('fill_waterskin');

				const waterskin = actor.get(InventoryComponent).state.items.find(i => i.item_id === 'waterskin');
				expect(waterskin?.charges).toBe(3);
			});

			it('returns failed when not at water location', () => {
				const actor = new AgentActor(
					createTestAgentData('a1', {
						inventory: [{ item_id: 'waterskin', quantity: 1, charges: 0 }],
					}),
					defaultMoodConfig,
				);
				const locations = [makeLocation('loc-tavern', 'food')];
				const { actions, memory } = setupActions(actor, {
					config,
					getLocations: () => locations,
				});
				memory.atLocation = 'loc-tavern';
				expect(actions.FillWaterskin()).toBe('mistreevous.failed');
			});

			it('returns failed when no waterskin in inventory', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				const locations = [makeLocation('loc-river', 'water')];
				const { actions, memory } = setupActions(actor, {
					config,
					getLocations: () => locations,
				});
				memory.atLocation = 'loc-river';
				expect(actions.FillWaterskin()).toBe('mistreevous.failed');
			});

			it('returns failed when atLocation is null', () => {
				const actor = new AgentActor(
					createTestAgentData('a1', {
						inventory: [{ item_id: 'waterskin', quantity: 1, charges: 0 }],
					}),
					defaultMoodConfig,
				);
				const { actions } = setupActions(actor, { config });
				expect(actions.FillWaterskin()).toBe('mistreevous.failed');
			});
		});
	});

	// ── Economy actions ───────────────────────────────────────────────────
	describe('Economy actions', () => {
		describe('Harvest', () => {
			it('transfers food from facility to agent inventory', () => {
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

				const result = actions.Harvest();
				expect(result).toBe('mistreevous.succeeded');
				expect(memory.btAction).toBe('harvest');

				// Facility stock decremented
				expect(facActor.get(FacilityComponent).state.stock.find(s => s.item_id === 'food')?.quantity).toBe(2);

				// Agent inventory has food
				expect(actor.get(InventoryComponent).state.items.find(i => i.item_id === 'food')?.quantity).toBe(1);
			});

			it('returns failed when not at any location', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				const { actions } = setupActions(actor, { config });
				expect(actions.Harvest()).toBe('mistreevous.failed');
			});

			it('returns failed when facility has no food stock', () => {
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

				expect(actions.Harvest()).toBe('mistreevous.failed');
			});
		});

		describe('SellAtMarket', () => {
			function setupSellScenario(inventoryItems: { item_id: string; quantity: number }[], fund = 100) {
				const actor = new AgentActor(
					createTestAgentData('a1', { inventory: inventoryItems }),
					defaultMoodConfig,
				);

				const locations = [makeLocation('loc-market', 'market')];

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
				const locations = [makeLocation('loc-market', 'market')];
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

			it('falls back to food-type locations when no stocked facilities', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				actor.get(PerceptionComponent).state = {
					nearbyAgents: [],
					nearbyLocations: [
						{ id: 'loc-tavern', type: 'food', distance: 50 },
						{ id: 'loc-bakery', type: 'food', distance: 20 },
					],
				};
				const locations = [
					makeLocation('loc-tavern', 'food', 0, 0),
					makeLocation('loc-bakery', 'food', 0, 0),
				];
				const { actions, memory } = setupActions(actor, { getLocations: () => locations });

				const result = actions.SeekFood();
				expect(result).toBe('mistreevous.running');
				expect(memory.movementTarget).toEqual({ id: 'loc-bakery', type: 'location' });
			});

			it('returns succeeded when already at food location', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				actor.get(PerceptionComponent).state = {
					nearbyAgents: [],
					nearbyLocations: [{ id: 'loc-tavern', type: 'food', distance: 5 }],
				};
				const locations = [makeLocation('loc-tavern', 'food')];
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

		describe('SeekWater', () => {
			it('sets movementTarget to nearest water location', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				actor.get(PerceptionComponent).state = {
					nearbyAgents: [],
					nearbyLocations: [
						{ id: 'loc-river', type: 'water', distance: 50 },
						{ id: 'loc-well', type: 'water', distance: 20 },
					],
				};
				const locations = [
					makeLocation('loc-river', 'water'),
					makeLocation('loc-well', 'water'),
				];
				const { actions, memory } = setupActions(actor, { getLocations: () => locations });

				const result = actions.SeekWater();
				expect(result).toBe('mistreevous.running');
				expect(memory.movementTarget).toEqual({ id: 'loc-well', type: 'location' });
				expect(memory.btAction).toBe('seek_water');
			});

			it('returns succeeded when already at water location', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				actor.get(PerceptionComponent).state = {
					nearbyAgents: [],
					nearbyLocations: [{ id: 'loc-well', type: 'water', distance: 5 }],
				};
				const locations = [makeLocation('loc-well', 'water')];
				const { actions, memory } = setupActions(actor, { getLocations: () => locations });
				memory.atLocation = 'loc-well';

				expect(actions.SeekWater()).toBe('mistreevous.succeeded');
			});

			it('returns failed when no water locations nearby', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				const { actions } = setupActions(actor);
				expect(actions.SeekWater()).toBe('mistreevous.failed');
			});
		});

		describe('SeekMarket', () => {
			it('sets movementTarget to nearest market', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				actor.get(PerceptionComponent).state = {
					nearbyAgents: [],
					nearbyLocations: [{ id: 'loc-market', type: 'market', distance: 30 }],
				};
				const locations = [makeLocation('loc-market', 'market')];
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
				const locations = [makeLocation('loc-market', 'market')];
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
					stock: [], fund: 100, workProgress: 0, status: 'idle', workerId: null,
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
				const { actions, memory } = setupActions(actor, { getLocations: () => locations });

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
					stock: [], fund: 100, workProgress: 0, status: 'idle', workerId: null,
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
		describe('SeekRest', () => {
			it('sets movementTarget to nearest rest location', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				actor.get(PerceptionComponent).state = {
					nearbyAgents: [],
					nearbyLocations: [{ id: 'loc-inn', type: 'rest', distance: 30 }],
				};
				const locations = [makeLocation('loc-inn', 'rest')];
				const { actions, memory } = setupActions(actor, { getLocations: () => locations });

				expect(actions.SeekRest()).toBe('mistreevous.running');
				expect(memory.movementTarget).toEqual({ id: 'loc-inn', type: 'location' });
			});

			it('returns succeeded when already at rest location', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				actor.get(PerceptionComponent).state = {
					nearbyAgents: [],
					nearbyLocations: [{ id: 'loc-inn', type: 'rest', distance: 5 }],
				};
				const locations = [makeLocation('loc-inn', 'rest')];
				const { actions, memory } = setupActions(actor, { getLocations: () => locations });
				memory.atLocation = 'loc-inn';

				expect(actions.SeekRest()).toBe('mistreevous.succeeded');
			});

			it('falls back to all locations when no rest in perception range', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				actor.pos.x = 300;
				actor.pos.y = 190;
				actor.get(PerceptionComponent).state = { nearbyAgents: [], nearbyLocations: [] };

				const restLocation = makeLocation('loc-cabin', 'rest', 200, 380);
				const { actions, memory } = setupActions(actor, {
					getLocations: () => [restLocation],
				});

				const result = actions.SeekRest();
				expect(result).toBe('mistreevous.running');
				expect(memory.movementTarget).toEqual({ id: 'loc-cabin', type: 'location' });
			});

			it('returns failed when no rest locations exist at all', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				const { actions } = setupActions(actor);
				expect(actions.SeekRest()).toBe('mistreevous.failed');
			});
		});

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
});
