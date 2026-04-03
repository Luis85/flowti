import { describe, it, expect, beforeEach } from 'vitest';
import { Actor } from 'excalibur';
import { createBehaviorAgent, type BehaviorAgentDeps } from '../../../src/infrastructure/entity/behavior-agent-factory.js';
import { AgentActor } from '../../../src/infrastructure/entity/agent-actor.js';
import { NeedsComponent } from '../../../src/infrastructure/components/needs-component.js';
import { MoodComponent } from '../../../src/infrastructure/components/mood-component.js';
import { WalletComponent } from '../../../src/infrastructure/components/wallet-component.js';
import { InventoryComponent } from '../../../src/infrastructure/components/inventory-component.js';
import { PerceptionComponent } from '../../../src/infrastructure/components/perception-component.js';
import { FacilityComponent } from '../../../src/infrastructure/components/facility-component.js';
import { TimeComponent } from '../../../src/infrastructure/components/time-component.js';
import { EconomyComponent } from '../../../src/infrastructure/components/economy-component.js';
import { GameConfigSchema } from '../../../src/domain/schemas/game-config-schema.js';
import { NEED_CRITICAL_THRESHOLDS } from '../../../src/domain/schemas/ranges.js';
import type { BehaviorAgent } from '../../../src/domain/systems/behavior-agent.js';
import type { GameConfig } from '../../../src/domain/schemas/game-config-schema.js';
import type { WorldLocation } from '../../../src/domain/schemas/location-schema.js';
import type { EventBus } from '../../../src/domain/core/events.js';

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
	world.addComponent(new TimeComponent({ phase, tickInCycle: 0, dayCount: 0 }));
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
	return { actor, worldEntity, config, getLocationActors, getLocations, tickCount, eventBus };
}

// ═══════════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════════

describe('BehaviorAgent factory', () => {
	let config: GameConfig;
	let worldEntity: Actor;

	beforeEach(() => {
		config = GameConfigSchema.parse({});
		worldEntity = createWorldEntity();
	});

	// ── Read-only getter proxies ───────────────────────────────────────────
	describe('getter proxies', () => {
		it('reads hunger from NeedsComponent', () => {
			const actor = new AgentActor(createTestAgentData('a1', { needs: { hunger: 42, energy: 90, social: 70, thirst: 80 } }), defaultMoodConfig);
			actor.get(NeedsComponent).state = { hunger: 42, energy: 90, social: 70, thirst: 80 };
			const agent = createBehaviorAgent(setupDeps(actor, { config }));
			expect(agent.hunger).toBe(42);
		});

		it('reads energy from NeedsComponent', () => {
			const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
			actor.get(NeedsComponent).state = { hunger: 80, energy: 55, social: 70, thirst: 80 };
			const agent = createBehaviorAgent(setupDeps(actor));
			expect(agent.energy).toBe(55);
		});

		it('reads social from NeedsComponent', () => {
			const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
			actor.get(NeedsComponent).state = { hunger: 80, energy: 90, social: 33, thirst: 80 };
			const agent = createBehaviorAgent(setupDeps(actor));
			expect(agent.social).toBe(33);
		});

		it('reads gold from WalletComponent', () => {
			const actor = new AgentActor(createTestAgentData('a1', { wallet: { gold: 75 } }), defaultMoodConfig);
			const agent = createBehaviorAgent(setupDeps(actor));
			expect(agent.gold).toBe(75);
		});

		it('reads mood from MoodComponent', () => {
			const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
			actor.get(MoodComponent).state = { value: 42, bucket: 'content' };
			const agent = createBehaviorAgent(setupDeps(actor));
			expect(agent.mood).toBe(42);
		});

		it('reads moodBucket from MoodComponent', () => {
			const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
			actor.get(MoodComponent).state = { value: 60, bucket: 'elated' };
			const agent = createBehaviorAgent(setupDeps(actor));
			expect(agent.moodBucket).toBe('elated');
		});

		it('reads timePhase from world TimeComponent', () => {
			const world = createWorldEntity('dusk');
			const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
			const agent = createBehaviorAgent(setupDeps(actor, { worldEntity: () => world }));
			expect(agent.timePhase).toBe('dusk');
		});

		it('reads job from actor', () => {
			const actor = new AgentActor(createTestAgentData('a1', { job: 'baker' }), defaultMoodConfig);
			const agent = createBehaviorAgent(setupDeps(actor));
			expect(agent.job).toBe('baker');
		});

		it('reads position from actor', () => {
			const actor = new AgentActor(createTestAgentData('a1', { position: { x: 50, y: 75, region: 'test' } }), defaultMoodConfig);
			const agent = createBehaviorAgent(setupDeps(actor));
			expect(agent.position).toEqual({ x: 50, y: 75 });
		});

		it('reads inventory from InventoryComponent', () => {
			const actor = new AgentActor(
				createTestAgentData('a1', { inventory: [{ item_id: 'food', quantity: 3 }] }),
				defaultMoodConfig,
			);
			const agent = createBehaviorAgent(setupDeps(actor));
			expect(agent.inventory).toEqual([{ item_id: 'food', quantity: 3 }]);
		});

		it('reads nearbyAgents from PerceptionComponent', () => {
			const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
			actor.get(PerceptionComponent).state = {
				nearbyAgents: [{ id: 'agent-x', distance: 10 }],
				nearbyLocations: [],
			};
			const agent = createBehaviorAgent(setupDeps(actor));
			expect(agent.nearbyAgents).toHaveLength(1);
			expect(agent.nearbyAgents[0]!.id).toBe('agent-x');
			expect(agent.nearbyAgents[0]!.distance).toBe(10);
		});

		it('reads nearbyLocations from PerceptionComponent + location data', () => {
			const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
			actor.get(PerceptionComponent).state = {
				nearbyAgents: [],
				nearbyLocations: [{ id: 'loc-tavern', type: 'food', distance: 20 }],
			};
			const locations = [makeLocation('loc-tavern', 'food', 30, 40)];
			const agent = createBehaviorAgent(setupDeps(actor, { getLocations: () => locations }));
			expect(agent.nearbyLocations).toHaveLength(1);
			expect(agent.nearbyLocations[0]!.type).toBe('food');
			expect(agent.nearbyLocations[0]!.position).toEqual({ x: 30, y: 40 });
		});

		it('reads nearbyFacilities from perception + location actors', () => {
			const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
			actor.get(PerceptionComponent).state = {
				nearbyAgents: [],
				nearbyLocations: [{ id: 'loc-bakery', type: 'work', distance: 15 }],
			};

			const locations = [makeLocation('loc-bakery', 'work', 0, 0, {
				job: 'baker',
				output: { item_id: 'bread', quantity: 1 },
				input: null,
				wage: 5,
				ticks_per_cycle: 30,
				auto_process: false,
				auto_ticks_per_cycle: 60,
			})];

			const facActor = createLocationActor({
				stock: [{ item_id: 'bread', quantity: 5 }],
				fund: 100,
				workProgress: 0,
				status: 'idle',
				workerId: null,
			});

			const locActors = new Map<string, Actor>([['loc-bakery', facActor]]);

			const agent = createBehaviorAgent(setupDeps(actor, {
				getLocations: () => locations,
				getLocationActors: () => locActors,
			}));

			expect(agent.nearbyFacilities).toHaveLength(1);
			expect(agent.nearbyFacilities[0]!.job).toBe('baker');
			expect(agent.nearbyFacilities[0]!.stock).toEqual([{ item_id: 'bread', quantity: 5 }]);
			expect(agent.nearbyFacilities[0]!.hasUnmetInput).toBe(false);
		});

		it('marks facility hasUnmetInput when input is not stocked', () => {
			const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
			actor.get(PerceptionComponent).state = {
				nearbyAgents: [],
				nearbyLocations: [{ id: 'loc-mill', type: 'work', distance: 10 }],
			};

			const locations = [makeLocation('loc-mill', 'work', 0, 0, {
				job: 'miller',
				output: { item_id: 'flour', quantity: 1 },
				input: { item_id: 'wheat', quantity: 1 },
				wage: 5,
				ticks_per_cycle: 30,
				auto_process: false,
				auto_ticks_per_cycle: 60,
			})];

			const facActor = createLocationActor({
				stock: [],
				fund: 100,
				workProgress: 0,
				status: 'idle',
				workerId: null,
			});

			const locActors = new Map<string, Actor>([['loc-mill', facActor]]);

			const agent = createBehaviorAgent(setupDeps(actor, {
				getLocations: () => locations,
				getLocationActors: () => locActors,
			}));

			expect(agent.nearbyFacilities[0]!.hasUnmetInput).toBe(true);
		});
	});

	// ── Working memory ─────────────────────────────────────────────────────
	describe('working memory', () => {
		it('initializes with null/empty defaults', () => {
			const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
			const agent = createBehaviorAgent(setupDeps(actor));

			expect(agent.movementTarget).toBeNull();
			expect(agent.journey).toBeNull();
			expect(agent.atLocation).toBeNull();
			expect(agent.currentRegion).toBe('');
			expect(agent.haulCargo).toBeNull();
			expect(agent.socialCooldowns.size).toBe(0);
			expect(agent.committedAction).toBeNull();
		});

		it('can set and get movementTarget', () => {
			const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
			const agent = createBehaviorAgent(setupDeps(actor));

			agent.movementTarget = { id: 'loc-tavern', type: 'location' };
			expect(agent.movementTarget).toEqual({ id: 'loc-tavern', type: 'location' });

			agent.movementTarget = null;
			expect(agent.movementTarget).toBeNull();
		});

		it('can set and get haulCargo', () => {
			const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
			const agent = createBehaviorAgent(setupDeps(actor));

			agent.haulCargo = { itemId: 'bread', quantity: 1, source: 'loc-a', destination: 'loc-b' };
			expect(agent.haulCargo).toEqual({ itemId: 'bread', quantity: 1, source: 'loc-a', destination: 'loc-b' });
		});
	});

	// ── 19 Condition methods ───────────────────────────────────────────────
	describe('conditions', () => {
		describe('IsHungry', () => {
			it('returns true when hunger < 50', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				actor.get(NeedsComponent).state = { hunger: 30, energy: 90, social: 70, thirst: 80 };
				const agent = createBehaviorAgent(setupDeps(actor));
				expect(agent.IsHungry()).toBe(true);
			});

			it('returns false when hunger >= 50', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				actor.get(NeedsComponent).state = { hunger: 50, energy: 90, social: 70, thirst: 80 };
				const agent = createBehaviorAgent(setupDeps(actor));
				expect(agent.IsHungry()).toBe(false);
			});
		});

		describe('IsExhausted', () => {
			it('returns true when energy < 30', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				actor.get(NeedsComponent).state = { hunger: 80, energy: 20, social: 70, thirst: 80 };
				const agent = createBehaviorAgent(setupDeps(actor));
				expect(agent.IsExhausted()).toBe(true);
			});

			it('returns false when energy >= 30', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				actor.get(NeedsComponent).state = { hunger: 80, energy: 30, social: 70, thirst: 80 };
				const agent = createBehaviorAgent(setupDeps(actor));
				expect(agent.IsExhausted()).toBe(false);
			});
		});

		describe('IsLonely', () => {
			it('returns true when social < 40', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				actor.get(NeedsComponent).state = { hunger: 80, energy: 90, social: 25, thirst: 80 };
				const agent = createBehaviorAgent(setupDeps(actor));
				expect(agent.IsLonely()).toBe(true);
			});

			it('returns false when social >= 40', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				actor.get(NeedsComponent).state = { hunger: 80, energy: 90, social: 40, thirst: 80 };
				const agent = createBehaviorAgent(setupDeps(actor));
				expect(agent.IsLonely()).toBe(false);
			});
		});

		describe('NeedsCritical', () => {
			it('returns true when hunger < critical threshold', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				actor.get(NeedsComponent).state = { hunger: NEED_CRITICAL_THRESHOLDS.hunger - 1, energy: 90, social: 70, thirst: 80 };
				const agent = createBehaviorAgent(setupDeps(actor));
				expect(agent.NeedsCritical()).toBe(true);
			});

			it('returns true when energy < critical threshold', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				actor.get(NeedsComponent).state = { hunger: 80, energy: NEED_CRITICAL_THRESHOLDS.energy - 1, social: 70, thirst: 80 };
				const agent = createBehaviorAgent(setupDeps(actor));
				expect(agent.NeedsCritical()).toBe(true);
			});

			it('returns true when thirst < critical threshold', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				actor.get(NeedsComponent).state = { hunger: 80, energy: 90, social: 70, thirst: NEED_CRITICAL_THRESHOLDS.thirst - 1 };
				const agent = createBehaviorAgent(setupDeps(actor));
				expect(agent.NeedsCritical()).toBe(true);
			});

			it('returns false when all needs above critical', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				actor.get(NeedsComponent).state = { hunger: 80, energy: 90, social: 70, thirst: 80 };
				const agent = createBehaviorAgent(setupDeps(actor));
				expect(agent.NeedsCritical()).toBe(false);
			});
		});

		describe('HasFood', () => {
			it('returns true when inventory has food', () => {
				const actor = new AgentActor(
					createTestAgentData('a1', { inventory: [{ item_id: 'food', quantity: 2 }] }),
					defaultMoodConfig,
				);
				const agent = createBehaviorAgent(setupDeps(actor));
				expect(agent.HasFood()).toBe(true);
			});

			it('returns false when inventory has no food items', () => {
				const actor = new AgentActor(
					createTestAgentData('a1', { inventory: [{ item_id: 'torch', quantity: 1 }] }),
					defaultMoodConfig,
				);
				const agent = createBehaviorAgent(setupDeps(actor));
				expect(agent.HasFood()).toBe(false);
			});

			it('returns false when inventory is empty', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				const agent = createBehaviorAgent(setupDeps(actor));
				expect(agent.HasFood()).toBe(false);
			});
		});

		describe('HasGold', () => {
			it('returns true when gold >= amount', () => {
				const actor = new AgentActor(createTestAgentData('a1', { wallet: { gold: 50 } }), defaultMoodConfig);
				const agent = createBehaviorAgent(setupDeps(actor));
				expect(agent.HasGold(50)).toBe(true);
				expect(agent.HasGold(25)).toBe(true);
			});

			it('returns false when gold < amount', () => {
				const actor = new AgentActor(createTestAgentData('a1', { wallet: { gold: 10 } }), defaultMoodConfig);
				const agent = createBehaviorAgent(setupDeps(actor));
				expect(agent.HasGold(11)).toBe(false);
			});
		});

		describe('CanAffordFood', () => {
			it('returns true when gold >= food_price and hunger is critical', () => {
				// Critical hunger (10 < 40 threshold) → high reservation price → can afford
				const actor = new AgentActor(
					createTestAgentData('a1', { wallet: { gold: 10 }, needs: { hunger: 10, energy: 90, social: 70, thirst: 80 } }),
					defaultMoodConfig,
				);
				actor.get(NeedsComponent).state = { hunger: 10, energy: 90, social: 70, thirst: 80 };
				const agent = createBehaviorAgent(setupDeps(actor, { config }));
				expect(agent.CanAffordFood()).toBe(true);
			});

			it('returns false when gold < food_price', () => {
				const actor = new AgentActor(createTestAgentData('a1', { wallet: { gold: 2 } }), defaultMoodConfig);
				const agent = createBehaviorAgent(setupDeps(actor, { config }));
				expect(agent.CanAffordFood()).toBe(false);
			});

			it('returns false when well-fed (reservation price below food_price)', () => {
				// hunger=80 → urgency=0.8 → reservationPrice=2.4 < food_price=3 → false
				const actor = new AgentActor(
					createTestAgentData('a1', { wallet: { gold: 10 }, needs: { hunger: 80, energy: 90, social: 70, thirst: 80 } }),
					defaultMoodConfig,
				);
				actor.get(NeedsComponent).state = { hunger: 80, energy: 90, social: 70, thirst: 80 };
				const agent = createBehaviorAgent(setupDeps(actor, { config }));
				expect(agent.CanAffordFood()).toBe(false);
			});
		});

		describe('HasFoodReserve', () => {
			it('returns false when inventory has no food', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				const agent = createBehaviorAgent(setupDeps(actor, { config }));
				expect(agent.HasFoodReserve()).toBe(false);
			});

			it('returns false when food quantity is at or below food_reserve (quantity=3)', () => {
				// food_reserve defaults to 3, so quantity=3 is NOT above the reserve
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				actor.get(InventoryComponent).state = { items: [{ item_id: 'food', quantity: 3 }] };
				const agent = createBehaviorAgent(setupDeps(actor, { config }));
				expect(agent.HasFoodReserve()).toBe(false);
			});

			it('returns true when food quantity exceeds food_reserve (quantity=5)', () => {
				// food_reserve defaults to 3, so quantity=5 is above the reserve
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				actor.get(InventoryComponent).state = { items: [{ item_id: 'food', quantity: 5 }] };
				const agent = createBehaviorAgent(setupDeps(actor, { config }));
				expect(agent.HasFoodReserve()).toBe(true);
			});
		});

		describe('AtLocation', () => {
			it('returns true when atLocation is set and type matches', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				const locations = [makeLocation('loc-tavern', 'food')];
				const agent = createBehaviorAgent(setupDeps(actor, { getLocations: () => locations }));
				agent.atLocation = 'loc-tavern';
				expect(agent.AtLocation('food')).toBe(true);
			});

			it('returns false when atLocation is null', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				const agent = createBehaviorAgent(setupDeps(actor));
				expect(agent.AtLocation('food')).toBe(false);
			});

			it('returns false when type does not match', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				const locations = [makeLocation('loc-tavern', 'food')];
				const agent = createBehaviorAgent(setupDeps(actor, { getLocations: () => locations }));
				agent.atLocation = 'loc-tavern';
				expect(agent.AtLocation('rest')).toBe(false);
			});
		});

		describe('NearLocation', () => {
			it('returns true when nearby location matches type', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				actor.get(PerceptionComponent).state = {
					nearbyAgents: [],
					nearbyLocations: [{ id: 'loc-inn', type: 'rest', distance: 20 }],
				};
				const locations = [makeLocation('loc-inn', 'rest')];
				const agent = createBehaviorAgent(setupDeps(actor, { getLocations: () => locations }));
				expect(agent.NearLocation('rest')).toBe(true);
			});

			it('returns false when no nearby location matches', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				actor.get(PerceptionComponent).state = {
					nearbyAgents: [],
					nearbyLocations: [{ id: 'loc-inn', type: 'rest', distance: 20 }],
				};
				const locations = [makeLocation('loc-inn', 'rest')];
				const agent = createBehaviorAgent(setupDeps(actor, { getLocations: () => locations }));
				expect(agent.NearLocation('market')).toBe(false);
			});
		});

		describe('NearAgent', () => {
			it('returns true when nearbyAgents is non-empty', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				actor.get(PerceptionComponent).state = {
					nearbyAgents: [{ id: 'agent-b', distance: 30 }],
					nearbyLocations: [],
				};
				const agent = createBehaviorAgent(setupDeps(actor));
				expect(agent.NearAgent()).toBe(true);
			});

			it('returns false when nearbyAgents is empty', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				const agent = createBehaviorAgent(setupDeps(actor));
				expect(agent.NearAgent()).toBe(false);
			});
		});

		describe('NearAgentClose', () => {
			it('returns true when any agent within interaction_radius', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				actor.get(PerceptionComponent).state = {
					nearbyAgents: [{ id: 'agent-b', distance: 10 }],
					nearbyLocations: [],
				};
				const agent = createBehaviorAgent(setupDeps(actor, { config }));
				expect(agent.NearAgentClose()).toBe(true); // interaction_radius defaults to 25
			});

			it('returns false when no agent within interaction_radius', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				actor.get(PerceptionComponent).state = {
					nearbyAgents: [{ id: 'agent-b', distance: 30 }],
					nearbyLocations: [],
				};
				const agent = createBehaviorAgent(setupDeps(actor, { config }));
				expect(agent.NearAgentClose()).toBe(false);
			});
		});

		describe('IsDaytime', () => {
			it('returns true when phase is day', () => {
				const world = createWorldEntity('day');
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				const agent = createBehaviorAgent(setupDeps(actor, { worldEntity: () => world }));
				expect(agent.IsDaytime()).toBe(true);
			});

			it('returns false when phase is night', () => {
				const world = createWorldEntity('night');
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				const agent = createBehaviorAgent(setupDeps(actor, { worldEntity: () => world }));
				expect(agent.IsDaytime()).toBe(false);
			});
		});

		describe('IsNighttime', () => {
			it('returns true when phase is night', () => {
				const world = createWorldEntity('night');
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				const agent = createBehaviorAgent(setupDeps(actor, { worldEntity: () => world }));
				expect(agent.IsNighttime()).toBe(true);
			});

			it('returns true when phase is dusk', () => {
				const world = createWorldEntity('dusk');
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				const agent = createBehaviorAgent(setupDeps(actor, { worldEntity: () => world }));
				expect(agent.IsNighttime()).toBe(true);
			});

			it('returns false when phase is day', () => {
				const world = createWorldEntity('day');
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				const agent = createBehaviorAgent(setupDeps(actor, { worldEntity: () => world }));
				expect(agent.IsNighttime()).toBe(false);
			});
		});

		describe('HasJob', () => {
			it('returns true when job is set', () => {
				const actor = new AgentActor(createTestAgentData('a1', { job: 'baker' }), defaultMoodConfig);
				const agent = createBehaviorAgent(setupDeps(actor));
				expect(agent.HasJob()).toBe(true);
			});

			it('returns false when job is null', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				const agent = createBehaviorAgent(setupDeps(actor));
				expect(agent.HasJob()).toBe(false);
			});
		});

		describe('AtJobFacility', () => {
			it('returns true when at a facility matching agent job', () => {
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

				const agent = createBehaviorAgent(setupDeps(actor, {
					getLocations: () => locations,
					getLocationActors: () => new Map([['loc-bakery', facActor]]),
				}));

				agent.atLocation = 'loc-bakery';
				expect(agent.AtJobFacility()).toBe(true);
			});

			it('returns false when not at any location', () => {
				const actor = new AgentActor(createTestAgentData('a1', { job: 'baker' }), defaultMoodConfig);
				const agent = createBehaviorAgent(setupDeps(actor));
				expect(agent.AtJobFacility()).toBe(false);
			});

			it('returns false when agent has no job', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				const agent = createBehaviorAgent(setupDeps(actor));
				agent.atLocation = 'loc-bakery';
				expect(agent.AtJobFacility()).toBe(false);
			});
		});

		describe('FacilityHasStock', () => {
			it('returns true when a nearby facility has the item in stock', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				actor.get(PerceptionComponent).state = {
					nearbyAgents: [],
					nearbyLocations: [{ id: 'loc-bakery', type: 'work', distance: 10 }],
				};

				const locations = [makeLocation('loc-bakery', 'work', 0, 0, {
					job: 'baker', output: { item_id: 'bread', quantity: 1 }, input: null,
					wage: 5, ticks_per_cycle: 30, auto_process: false, auto_ticks_per_cycle: 60,
				})];

				const facActor = createLocationActor({
					stock: [{ item_id: 'food', quantity: 3 }], fund: 100, workProgress: 0, status: 'idle', workerId: null,
				});

				const agent = createBehaviorAgent(setupDeps(actor, {
					getLocations: () => locations,
					getLocationActors: () => new Map([['loc-bakery', facActor]]),
				}));

				expect(agent.FacilityHasStock('food')).toBe(true);
			});

			it('returns false when no nearby facility has that item', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				const agent = createBehaviorAgent(setupDeps(actor));
				expect(agent.FacilityHasStock('food')).toBe(false);
			});
		});

		describe('HasCargo', () => {
			it('returns true when haulCargo is set', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				const agent = createBehaviorAgent(setupDeps(actor));
				agent.haulCargo = { itemId: 'flour', quantity: 1, source: 'loc-a', destination: 'loc-b' };
				expect(agent.HasCargo()).toBe(true);
			});

			it('returns false when haulCargo is null', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				const agent = createBehaviorAgent(setupDeps(actor));
				expect(agent.HasCargo()).toBe(false);
			});
		});

		describe('CargoDestinationNearby', () => {
			it('returns true when destination is in nearbyLocations', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				actor.get(PerceptionComponent).state = {
					nearbyAgents: [],
					nearbyLocations: [{ id: 'loc-mill', type: 'work', distance: 15 }],
				};
				const locations = [makeLocation('loc-mill', 'work')];
				const agent = createBehaviorAgent(setupDeps(actor, { getLocations: () => locations }));
				agent.haulCargo = { itemId: 'flour', quantity: 1, source: 'loc-a', destination: 'loc-mill' };
				expect(agent.CargoDestinationNearby()).toBe(true);
			});

			it('returns false when haulCargo is null', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				const agent = createBehaviorAgent(setupDeps(actor));
				expect(agent.CargoDestinationNearby()).toBe(false);
			});
		});

		describe('FacilityNeedsSupply', () => {
			it('returns true when a nearby facility has unmet input', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				actor.get(PerceptionComponent).state = {
					nearbyAgents: [],
					nearbyLocations: [{ id: 'loc-mill', type: 'work', distance: 10 }],
				};

				const locations = [makeLocation('loc-mill', 'work', 0, 0, {
					job: 'miller', output: { item_id: 'flour', quantity: 1 },
					input: { item_id: 'wheat', quantity: 1 },
					wage: 5, ticks_per_cycle: 30, auto_process: false, auto_ticks_per_cycle: 60,
				})];

				const facActor = createLocationActor({
					stock: [], fund: 50, workProgress: 0, status: 'idle', workerId: null,
				});

				const agent = createBehaviorAgent(setupDeps(actor, {
					getLocations: () => locations,
					getLocationActors: () => new Map([['loc-mill', facActor]]),
				}));

				expect(agent.FacilityNeedsSupply()).toBe(true);
			});

			it('returns false when no facility has unmet input', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				const agent = createBehaviorAgent(setupDeps(actor));
				expect(agent.FacilityNeedsSupply()).toBe(false);
			});
		});
	});

	// ── Action method tests (C2: survival) ─────────────────────────────────
	describe('survival actions', () => {
		describe('Eat', () => {
			it('sets btAction to eat and returns running when food available', () => {
				const actor = new AgentActor(
					createTestAgentData('a1', {
						needs: { hunger: 40, energy: 90, social: 70, thirst: 80 },
						inventory: [{ item_id: 'food', quantity: 2 }],
					}),
					defaultMoodConfig,
				);
				const agent = createBehaviorAgent(setupDeps(actor, { config }));

				const result = agent.Eat();
				expect(result).toBe('mistreevous.running');
				expect(agent.btAction).toBe('eat');
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
				const agent = createBehaviorAgent(setupDeps(actor, { config }));

				agent.Eat();
				expect(agent.hunger).toBe(40);

				const inv = actor.get(InventoryComponent);
				const foodItem = inv.state.items.find(i => i.item_id === 'food');
				expect(foodItem?.quantity).toBe(2);
			});

			it('returns failed when no food in inventory', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				const agent = createBehaviorAgent(setupDeps(actor));
				expect(agent.Eat()).toBe('mistreevous.failed');
			});
		});

		describe('Rest', () => {
			it('sets btAction to rest and returns running', () => {
				const actor = new AgentActor(
					createTestAgentData('a1', { needs: { hunger: 80, energy: 30, social: 70, thirst: 80 } }),
					defaultMoodConfig,
				);
				actor.get(NeedsComponent).state = { hunger: 80, energy: 30, social: 70, thirst: 80 };
				const agent = createBehaviorAgent(setupDeps(actor, { config }));

				const result = agent.Rest();
				expect(result).toBe('mistreevous.running');
				expect(agent.btAction).toBe('rest');
			});

			it('does not modify energy (system handles that)', () => {
				const actor = new AgentActor(
					createTestAgentData('a1', { needs: { hunger: 80, energy: 30, social: 70, thirst: 80 } }),
					defaultMoodConfig,
				);
				actor.get(NeedsComponent).state = { hunger: 80, energy: 30, social: 70, thirst: 80 };
				const agent = createBehaviorAgent(setupDeps(actor, { config }));

				agent.Rest();
				expect(agent.energy).toBe(30);
			});
		});

		describe('SeekFood', () => {
			it('sets movementTarget to nearest food location', () => {
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
				const agent = createBehaviorAgent(setupDeps(actor, { getLocations: () => locations }));

				const result = agent.SeekFood();
				expect(result).toBe('mistreevous.running');
				expect(agent.movementTarget).toEqual({ id: 'loc-bakery', type: 'location' });
			});

			it('returns succeeded when already at food location', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				actor.get(PerceptionComponent).state = {
					nearbyAgents: [],
					nearbyLocations: [{ id: 'loc-tavern', type: 'food', distance: 5 }],
				};
				const locations = [makeLocation('loc-tavern', 'food')];
				const agent = createBehaviorAgent(setupDeps(actor, { getLocations: () => locations }));
				agent.atLocation = 'loc-tavern';

				expect(agent.SeekFood()).toBe('mistreevous.succeeded');
			});

			it('returns failed when no food locations nearby', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				const agent = createBehaviorAgent(setupDeps(actor));
				expect(agent.SeekFood()).toBe('mistreevous.failed');
			});
		});

		describe('SeekRest', () => {
			it('sets movementTarget to nearest rest location', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				actor.get(PerceptionComponent).state = {
					nearbyAgents: [],
					nearbyLocations: [{ id: 'loc-inn', type: 'rest', distance: 30 }],
				};
				const locations = [makeLocation('loc-inn', 'rest')];
				const agent = createBehaviorAgent(setupDeps(actor, { getLocations: () => locations }));

				expect(agent.SeekRest()).toBe('mistreevous.running');
				expect(agent.movementTarget).toEqual({ id: 'loc-inn', type: 'location' });
			});

			it('returns failed when no rest locations nearby', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				const agent = createBehaviorAgent(setupDeps(actor));
				expect(agent.SeekRest()).toBe('mistreevous.failed');
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

				return {
					actor,
					agent: createBehaviorAgent(setupDeps(actor, {
						config,
						getLocations: () => locations,
						getLocationActors: () => locActors,
					})),
					facActor,
				};
			}

			it('sets btAction to buy and returns succeeded when preconditions met', () => {
				const { agent } = setupBuyScenario();
				agent.atLocation = 'loc-market';
				const result = agent.Buy();
				expect(result).toBe('mistreevous.succeeded');
				expect(agent.btAction).toBe('buy');
			});

			it('does not modify gold or inventory (TradeSystem handles that)', () => {
				const { agent } = setupBuyScenario();
				agent.atLocation = 'loc-market';
				agent.Buy();
				expect(agent.gold).toBe(50);
				expect(agent.inventory.some(i => i.item_id === 'food')).toBe(false);
			});

			it('does not modify facility fund (TradeSystem handles that)', () => {
				const { agent, facActor } = setupBuyScenario();
				agent.atLocation = 'loc-market';
				agent.Buy();
				expect(facActor.get(FacilityComponent).state.fund).toBe(100);
			});

			it('returns failed when insufficient gold', () => {
				const { agent } = setupBuyScenario(1);
				expect(agent.Buy()).toBe('mistreevous.failed');
			});

			it('returns failed when no facility has food stock', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				const agent = createBehaviorAgent(setupDeps(actor));
				expect(agent.Buy()).toBe('mistreevous.failed');
			});
		});

		describe('Idle', () => {
			it('always returns running', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				const agent = createBehaviorAgent(setupDeps(actor));
				expect(agent.Idle()).toBe('mistreevous.running');
			});
		});

		describe('Wander', () => {
			it('always returns running', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				const agent = createBehaviorAgent(setupDeps(actor));
				expect(agent.Wander()).toBe('mistreevous.running');
			});
		});
	});

	// ── Action method tests (C3: work + merchant) ──────────────────────────
	describe('work + merchant actions', () => {
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

				const agent = createBehaviorAgent(setupDeps(actor, {
					getLocations: () => locations,
					getLocationActors: () => new Map([['loc-bakery', facActor]]),
				}));

				agent.atLocation = 'loc-bakery';
				expect(agent.Work()).toBe('mistreevous.running');
			});

			it('returns failed when not at job facility', () => {
				const actor = new AgentActor(createTestAgentData('a1', { job: 'baker' }), defaultMoodConfig);
				const agent = createBehaviorAgent(setupDeps(actor));
				expect(agent.Work()).toBe('mistreevous.failed');
			});
		});

		describe('Talk', () => {
			it('returns running when close agent nearby', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				actor.get(PerceptionComponent).state = {
					nearbyAgents: [{ id: 'agent-b', distance: 10 }],
					nearbyLocations: [],
				};
				const agent = createBehaviorAgent(setupDeps(actor, { config }));
				expect(agent.Talk()).toBe('mistreevous.running');
			});

			it('returns failed when no close agent', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				actor.get(PerceptionComponent).state = {
					nearbyAgents: [{ id: 'agent-b', distance: 100 }],
					nearbyLocations: [],
				};
				const agent = createBehaviorAgent(setupDeps(actor, { config }));
				expect(agent.Talk()).toBe('mistreevous.failed');
			});
		});

		describe('SeekWork', () => {
			it('sets movementTarget to job facility', () => {
				const actor = new AgentActor(createTestAgentData('a1', { job: 'baker' }), defaultMoodConfig);
				const locations = [makeLocation('loc-bakery', 'work', 0, 0, {
					job: 'baker', output: { item_id: 'bread', quantity: 1 }, input: null,
					wage: 5, ticks_per_cycle: 30, auto_process: false, auto_ticks_per_cycle: 60,
				})];
				const agent = createBehaviorAgent(setupDeps(actor, { getLocations: () => locations }));

				expect(agent.SeekWork()).toBe('mistreevous.running');
				expect(agent.movementTarget).toEqual({ id: 'loc-bakery', type: 'location' });
			});

			it('returns failed when no job', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				const agent = createBehaviorAgent(setupDeps(actor));
				expect(agent.SeekWork()).toBe('mistreevous.failed');
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
				const agent = createBehaviorAgent(setupDeps(actor, { config }));

				expect(agent.SeekSocial()).toBe('mistreevous.running');
				expect(agent.movementTarget).toEqual({ id: 'agent-c', type: 'agent' });
			});

			it('returns succeeded when nearest agent is close enough', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				actor.get(PerceptionComponent).state = {
					nearbyAgents: [{ id: 'agent-b', distance: 5 }],
					nearbyLocations: [],
				};
				const agent = createBehaviorAgent(setupDeps(actor, { config }));
				expect(agent.SeekSocial()).toBe('mistreevous.succeeded');
			});

			it('returns failed when no nearby agents', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				const agent = createBehaviorAgent(setupDeps(actor));
				expect(agent.SeekSocial()).toBe('mistreevous.failed');
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
				const agent = createBehaviorAgent(setupDeps(actor, { getLocations: () => locations }));

				expect(agent.SeekMarket()).toBe('mistreevous.running');
				expect(agent.movementTarget).toEqual({ id: 'loc-market', type: 'location' });
			});

			it('returns failed when no market nearby', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				const agent = createBehaviorAgent(setupDeps(actor));
				expect(agent.SeekMarket()).toBe('mistreevous.failed');
			});
		});

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

				const agent = createBehaviorAgent(setupDeps(actor, {
					getLocations: () => locations,
					getLocationActors: () => locActors,
				}));

				const result = agent.PickupCargo();
				expect(result).toBe('mistreevous.succeeded');
				expect(agent.haulCargo).not.toBeNull();
				expect(agent.haulCargo!.itemId).toBe('wheat');
				expect(agent.haulCargo!.destination).toBe('loc-mill');

				// Farm stock decremented
				expect(farmActor.get(FacilityComponent).state.stock.find(s => s.item_id === 'wheat')?.quantity).toBe(2);
			});

			it('returns failed when no facility has output stock', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				const agent = createBehaviorAgent(setupDeps(actor));
				expect(agent.PickupCargo()).toBe('mistreevous.failed');
			});
		});

		describe('DeliverCargo', () => {
			it('delivers cargo and clears haulCargo', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				const destActor = createLocationActor({
					stock: [], fund: 50, workProgress: 0, status: 'idle', workerId: null,
				});

				const locActors = new Map<string, Actor>([['loc-mill', destActor]]);

				const agent = createBehaviorAgent(setupDeps(actor, {
					getLocationActors: () => locActors,
				}));

				agent.haulCargo = { itemId: 'wheat', quantity: 1, source: 'loc-farm', destination: 'loc-mill' };
				agent.atLocation = 'loc-mill';

				const result = agent.DeliverCargo();
				expect(result).toBe('mistreevous.succeeded');
				expect(agent.haulCargo).toBeNull();

				const stock = destActor.get(FacilityComponent).state.stock;
				expect(stock.find(s => s.item_id === 'wheat')?.quantity).toBe(1);
			});

			it('returns failed when not at destination', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				const agent = createBehaviorAgent(setupDeps(actor));
				agent.haulCargo = { itemId: 'wheat', quantity: 1, source: 'loc-farm', destination: 'loc-mill' };
				agent.atLocation = 'loc-other';
				expect(agent.DeliverCargo()).toBe('mistreevous.failed');
			});

			it('returns failed when no cargo', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				const agent = createBehaviorAgent(setupDeps(actor));
				expect(agent.DeliverCargo()).toBe('mistreevous.failed');
			});
		});

		describe('SeekDeliveryTarget', () => {
			it('sets movementTarget to cargo destination', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				const agent = createBehaviorAgent(setupDeps(actor));
				agent.haulCargo = { itemId: 'wheat', quantity: 1, source: 'loc-farm', destination: 'loc-mill' };

				expect(agent.SeekDeliveryTarget()).toBe('mistreevous.running');
				expect(agent.movementTarget).toEqual({ id: 'loc-mill', type: 'location' });
			});

			it('returns succeeded when already at destination', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				const agent = createBehaviorAgent(setupDeps(actor));
				agent.haulCargo = { itemId: 'wheat', quantity: 1, source: 'loc-farm', destination: 'loc-mill' };
				agent.atLocation = 'loc-mill';

				expect(agent.SeekDeliveryTarget()).toBe('mistreevous.succeeded');
			});

			it('returns failed when no cargo', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				const agent = createBehaviorAgent(setupDeps(actor));
				expect(agent.SeekDeliveryTarget()).toBe('mistreevous.failed');
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

				const agent = createBehaviorAgent(setupDeps(actor, {
					getLocations: () => locations,
					getLocationActors: () => locActors,
				}));

				expect(agent.SeekSupplySource()).toBe('mistreevous.running');
				expect(agent.movementTarget).toEqual({ id: 'loc-farm', type: 'location' });
			});

			it('returns failed when no facility needs supply', () => {
				const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
				const agent = createBehaviorAgent(setupDeps(actor));
				expect(agent.SeekSupplySource()).toBe('mistreevous.failed');
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

				const agent = createBehaviorAgent(setupDeps(actor, {
					config,
					getLocations: () => locations,
					getLocationActors: () => locActors,
				}));
				agent.atLocation = 'loc-market';

				return { actor, agent, facActor };
			}

			it('sells food when agent has food at a market', () => {
				const { agent, facActor } = setupSellScenario([{ item_id: 'food', quantity: 2 }]);
				const result = agent.SellAtMarket();
				expect(result).toBe('mistreevous.succeeded');
				expect(agent.btAction).toBe('sell');
				expect(facActor.get(FacilityComponent).state.stock.find(s => s.item_id === 'food')?.quantity).toBe(1);
				expect(agent.inventory.find(i => i.item_id === 'food')?.quantity).toBe(1);
			});

			it('sells tools (trade goods) when agent has tools at a market', () => {
				const { agent, actor, facActor } = setupSellScenario([{ item_id: 'tools', quantity: 3 }]);
				const result = agent.SellAtMarket();
				expect(result).toBe('mistreevous.succeeded');
				expect(agent.btAction).toBe('sell');
				expect(facActor.get(FacilityComponent).state.stock.find(s => s.item_id === 'tools')?.quantity).toBe(1);
				expect(actor.get(InventoryComponent).state.items.find(i => i.item_id === 'tools')?.quantity).toBe(2);
			});

			it('removes the item entirely when selling the last unit of a trade good', () => {
				const { agent, actor } = setupSellScenario([{ item_id: 'tools', quantity: 1 }]);
				agent.SellAtMarket();
				expect(actor.get(InventoryComponent).state.items.find(i => i.item_id === 'tools')).toBeUndefined();
			});

			it('credits the agent wallet on sale', () => {
				const { agent } = setupSellScenario([{ item_id: 'tools', quantity: 1 }]);
				const goldBefore = agent.gold;
				agent.SellAtMarket();
				expect(agent.gold).toBeGreaterThan(goldBefore);
			});

			it('returns failed when atLocation is null', () => {
				const actor = new AgentActor(
					createTestAgentData('a1', { inventory: [{ item_id: 'tools', quantity: 1 }] }),
					defaultMoodConfig,
				);
				const agent = createBehaviorAgent(setupDeps(actor, { config }));
				expect(agent.SellAtMarket()).toBe('mistreevous.failed');
			});

			it('returns failed when location is not a market', () => {
				const actor = new AgentActor(
					createTestAgentData('a1', { inventory: [{ item_id: 'tools', quantity: 1 }] }),
					defaultMoodConfig,
				);
				const locations = [makeLocation('loc-tavern', 'food')];
				const agent = createBehaviorAgent(setupDeps(actor, {
					config,
					getLocations: () => locations,
				}));
				agent.atLocation = 'loc-tavern';
				expect(agent.SellAtMarket()).toBe('mistreevous.failed');
			});

			it('returns failed when inventory has no sellable items', () => {
				const { agent } = setupSellScenario([{ item_id: 'torch', quantity: 2 }]);
				expect(agent.SellAtMarket()).toBe('mistreevous.failed');
			});

			it('returns failed when market has insufficient funds', () => {
				const { agent } = setupSellScenario([{ item_id: 'tools', quantity: 1 }], 0);
				expect(agent.SellAtMarket()).toBe('mistreevous.failed');
			});
		});
	});
});
