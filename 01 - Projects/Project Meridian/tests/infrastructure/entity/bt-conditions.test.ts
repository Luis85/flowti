import { describe, it, expect, beforeEach } from 'vitest';
import { Actor } from 'excalibur';
import { createConditions, type ConditionMethods } from '../../../src/infrastructure/entity/bt-conditions.js';
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
import { MoodComponent } from '../../../src/infrastructure/components/mood-component.js';
import { GameConfigSchema } from '../../../src/domain/schemas/game-config-schema.js';
import { NEED_CRITICAL_THRESHOLDS } from '../../../src/domain/schemas/ranges.js';
import type { GameConfig } from '../../../src/domain/schemas/game-config-schema.js';
import type { WorldLocation } from '../../../src/domain/schemas/location-schema.js';
import type { EventBus } from '../../../src/domain/core/events.js';
import type { PerceivedFacility, PerceivedAgent, PerceivedLocation } from '../../../src/domain/systems/behavior-agent.js';

// ── Shared helpers ────────────────────────────────────────────────────────

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

function createWorldEntity(phase: 'dawn' | 'day' | 'dusk' | 'night' = 'day', tickInCycle = 0): Actor {
	const world = new Actor();
	world.addComponent(new TimeComponent({ phase, tickInCycle, dayCount: 0, dayBoundaryThisTick: false }));
	world.addComponent(new EconomyComponent({
		treasury: 500,
		ledger: [],
		dailySummary: { totalWages: 0, totalTax: 0, totalSales: 0, totalConsumption: 0, avgWage: 0, wageSpread: 0, vacancyCount: 0, unemploymentCount: 0, jobSwitchesThisDay: 0, supplyDeliveries: 0, questsCompletedThisDay: 0 },
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
	return { actor, worldEntity, config, getLocationActors, getLocations, tickCount, eventBus, ...overrides.getQuestBoard !== undefined ? { getQuestBoard: overrides.getQuestBoard } : {} };
}

// Helper to build resolveNearbyFacilities from deps (mirrors factory logic)
function buildResolveNearbyFacilities(actor: AgentActor, deps: BehaviorAgentDeps): () => PerceivedFacility[] {
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

function buildResolveNearbyAgents(actor: AgentActor): () => PerceivedAgent[] {
	return () => {
		const perception = actor.get(PerceptionComponent);
		return perception.state.nearbyAgents.map(a => ({
			id: a.id,
			position: { x: 0, y: 0 },
			distance: a.distance,
		}));
	};
}

function buildResolveNearbyLocations(actor: AgentActor, deps: BehaviorAgentDeps): () => PerceivedLocation[] {
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

function buildGetAtLocationData(memory: WorkingMemory, deps: BehaviorAgentDeps): () => WorldLocation | undefined {
	return () => {
		if (memory.atLocation === null) return undefined;
		return deps.getLocations().find(l => l.id === memory.atLocation);
	};
}

/** Helper: create conditions with default wiring from actor + deps */
function makeConditions(
	actor: AgentActor,
	deps: BehaviorAgentDeps,
	memory?: WorkingMemory,
	wakeOffset = 0,
): { conditions: ConditionMethods; memory: WorkingMemory } {
	const mem = memory ?? createWorkingMemory(deps.config.economy.price_memory_max);
	const conditions = createConditions(
		mem,
		actor,
		deps,
		buildResolveNearbyFacilities(actor, deps),
		buildResolveNearbyAgents(actor),
		buildResolveNearbyLocations(actor, deps),
		buildGetAtLocationData(mem, deps),
		wakeOffset,
	);
	return { conditions, memory: mem };
}

// ═══════════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════════

describe('bt-conditions', () => {
	let config: GameConfig;
	let worldEntity: Actor;

	beforeEach(() => {
		config = GameConfigSchema.parse({});
		worldEntity = createWorldEntity();
	});

	// ── Need-based conditions ─────────────────────────────────────────────

	describe('IsHungry', () => {
		it('returns true when hunger < threshold', () => {
			const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
			actor.get(NeedsComponent).state = { hunger: 30, energy: 90, social: 70, thirst: 80 };
			const { conditions } = makeConditions(actor, setupDeps(actor, { config }));
			expect(conditions.IsHungry()).toBe(true);
		});

		it('returns false when hunger >= threshold', () => {
			const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
			actor.get(NeedsComponent).state = { hunger: 50, energy: 90, social: 70, thirst: 80 };
			const { conditions } = makeConditions(actor, setupDeps(actor, { config }));
			expect(conditions.IsHungry()).toBe(false);
		});
	});

	describe('IsExhausted', () => {
		it('returns true when energy < threshold', () => {
			const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
			actor.get(NeedsComponent).state = { hunger: 80, energy: 20, social: 70, thirst: 80 };
			const { conditions } = makeConditions(actor, setupDeps(actor, { config }));
			expect(conditions.IsExhausted()).toBe(true);
		});

		it('returns false when energy >= threshold', () => {
			const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
			actor.get(NeedsComponent).state = { hunger: 80, energy: 30, social: 70, thirst: 80 };
			const { conditions } = makeConditions(actor, setupDeps(actor, { config }));
			expect(conditions.IsExhausted()).toBe(false);
		});

		it('sets recovering flag when exhausted', () => {
			const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
			actor.get(NeedsComponent).state = { hunger: 80, energy: 25, social: 70, thirst: 80 };
			const { conditions, memory } = makeConditions(actor, setupDeps(actor, { config }));
			conditions.IsExhausted();
			expect(memory.recovering).toBe(true);
		});
	});

	describe('IsRecovering', () => {
		it('returns false when never exhausted', () => {
			const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
			actor.get(NeedsComponent).state = { hunger: 80, energy: 80, social: 70, thirst: 80 };
			const { conditions } = makeConditions(actor, setupDeps(actor, { config }));
			expect(conditions.IsRecovering()).toBe(false);
		});

		it('stays true while energy is between threshold and threshold+hysteresis', () => {
			const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
			actor.get(NeedsComponent).state = { hunger: 80, energy: 25, social: 70, thirst: 80 };
			const { conditions } = makeConditions(actor, setupDeps(actor, { config }));
			conditions.IsExhausted(); // triggers recovering=true
			expect(conditions.IsRecovering()).toBe(true);
		});

		it('clears when energy reaches threshold + hysteresis', () => {
			const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
			actor.get(NeedsComponent).state = { hunger: 80, energy: 25, social: 70, thirst: 80 };
			const { conditions, memory } = makeConditions(actor, setupDeps(actor, { config }));

			conditions.IsExhausted();
			expect(memory.recovering).toBe(true);

			// personalThreshold.energy=36 (30*(12/10)), hysteresis=50 → recovered=86
			const needs = actor.get(NeedsComponent);
			needs.state = { ...needs.state, energy: 87 };
			needs.markDirty();

			expect(conditions.IsRecovering()).toBe(false);
			expect(memory.recovering).toBe(false);
		});

		it('agent at 35 energy is not exhausted but stays recovering if previously set', () => {
			const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
			actor.get(NeedsComponent).state = { hunger: 80, energy: 25, social: 70, thirst: 80 };
			const { conditions, memory } = makeConditions(actor, setupDeps(actor, { config }));

			conditions.IsExhausted(); // triggers recovering
			expect(memory.recovering).toBe(true);

			const needs = actor.get(NeedsComponent);
			needs.state = { ...needs.state, energy: 35 };
			needs.markDirty();

			expect(conditions.IsExhausted()).toBe(false); // no longer exhausted
			expect(conditions.IsRecovering()).toBe(true);  // still recovering
		});
	});

	describe('IsLonely', () => {
		it('returns true when social < threshold', () => {
			const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
			actor.get(NeedsComponent).state = { hunger: 80, energy: 90, social: 25, thirst: 80 };
			const { conditions } = makeConditions(actor, setupDeps(actor, { config }));
			expect(conditions.IsLonely()).toBe(true);
		});

		it('returns false when social >= threshold', () => {
			const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
			actor.get(NeedsComponent).state = { hunger: 80, energy: 90, social: 40, thirst: 80 };
			const { conditions } = makeConditions(actor, setupDeps(actor, { config }));
			expect(conditions.IsLonely()).toBe(false);
		});
	});

	describe('IsThirsty', () => {
		it('returns true when thirst < threshold', () => {
			const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
			actor.get(NeedsComponent).state = { hunger: 80, energy: 90, social: 70, thirst: 30 };
			const { conditions } = makeConditions(actor, setupDeps(actor, { config }));
			expect(conditions.IsThirsty()).toBe(true);
		});

		it('returns false when thirst >= threshold', () => {
			const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
			actor.get(NeedsComponent).state = { hunger: 80, energy: 90, social: 70, thirst: 80 };
			const { conditions } = makeConditions(actor, setupDeps(actor, { config }));
			expect(conditions.IsThirsty()).toBe(false);
		});
	});

	describe('NeedsCritical', () => {
		it('returns true when hunger < critical threshold', () => {
			const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
			actor.get(NeedsComponent).state = { hunger: NEED_CRITICAL_THRESHOLDS.hunger - 1, energy: 90, social: 70, thirst: 80 };
			const { conditions } = makeConditions(actor, setupDeps(actor));
			expect(conditions.NeedsCritical()).toBe(true);
		});

		it('returns true when energy < critical threshold', () => {
			const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
			actor.get(NeedsComponent).state = { hunger: 80, energy: NEED_CRITICAL_THRESHOLDS.energy - 1, social: 70, thirst: 80 };
			const { conditions } = makeConditions(actor, setupDeps(actor));
			expect(conditions.NeedsCritical()).toBe(true);
		});

		it('returns true when thirst < critical threshold', () => {
			const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
			actor.get(NeedsComponent).state = { hunger: 80, energy: 90, social: 70, thirst: NEED_CRITICAL_THRESHOLDS.thirst - 1 };
			const { conditions } = makeConditions(actor, setupDeps(actor));
			expect(conditions.NeedsCritical()).toBe(true);
		});

		it('returns false when all needs above critical', () => {
			const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
			actor.get(NeedsComponent).state = { hunger: 80, energy: 90, social: 70, thirst: 80 };
			const { conditions } = makeConditions(actor, setupDeps(actor));
			expect(conditions.NeedsCritical()).toBe(false);
		});
	});

	describe('IsSociallyCritical', () => {
		it('returns true when social below critical threshold (15)', () => {
			const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
			actor.get(NeedsComponent).state = { hunger: 80, energy: 90, social: 10, thirst: 80 };
			const { conditions } = makeConditions(actor, setupDeps(actor));
			expect(conditions.IsSociallyCritical()).toBe(true);
		});

		it('returns false when social at critical threshold', () => {
			const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
			actor.get(NeedsComponent).state = { hunger: 80, energy: 90, social: NEED_CRITICAL_THRESHOLDS.social, thirst: 80 };
			const { conditions } = makeConditions(actor, setupDeps(actor));
			expect(conditions.IsSociallyCritical()).toBe(false);
		});

		it('returns false when social is healthy', () => {
			const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
			actor.get(NeedsComponent).state = { hunger: 80, energy: 90, social: 50, thirst: 80 };
			const { conditions } = makeConditions(actor, setupDeps(actor));
			expect(conditions.IsSociallyCritical()).toBe(false);
		});
	});

	// ── Inventory conditions ──────────────────────────────────────────────

	describe('HasFood', () => {
		it('returns true when inventory has food', () => {
			const actor = new AgentActor(
				createTestAgentData('a1', { inventory: [{ item_id: 'food', quantity: 2 }] }),
				defaultMoodConfig,
			);
			const { conditions } = makeConditions(actor, setupDeps(actor));
			expect(conditions.HasFood()).toBe(true);
		});

		it('returns false when inventory has no food items', () => {
			const actor = new AgentActor(
				createTestAgentData('a1', { inventory: [{ item_id: 'torch', quantity: 1 }] }),
				defaultMoodConfig,
			);
			const { conditions } = makeConditions(actor, setupDeps(actor));
			expect(conditions.HasFood()).toBe(false);
		});

		it('returns false when inventory is empty', () => {
			const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
			const { conditions } = makeConditions(actor, setupDeps(actor));
			expect(conditions.HasFood()).toBe(false);
		});
	});

	describe('HasFoodReserve', () => {
		it('returns false when inventory has no food', () => {
			const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
			const { conditions } = makeConditions(actor, setupDeps(actor, { config }));
			expect(conditions.HasFoodReserve()).toBe(false);
		});

		it('returns false when food quantity is at or below food_reserve', () => {
			const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
			actor.get(InventoryComponent).state = { items: [{ item_id: 'food', quantity: 3 }] };
			const { conditions } = makeConditions(actor, setupDeps(actor, { config }));
			expect(conditions.HasFoodReserve()).toBe(false);
		});

		it('returns true when food quantity exceeds food_reserve', () => {
			const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
			actor.get(InventoryComponent).state = { items: [{ item_id: 'food', quantity: 5 }] };
			const { conditions } = makeConditions(actor, setupDeps(actor, { config }));
			expect(conditions.HasFoodReserve()).toBe(true);
		});
	});

	describe('HasWater', () => {
		it('returns true when inventory has waterskin with charges', () => {
			const actor = new AgentActor(
				createTestAgentData('a1', { inventory: [{ item_id: 'waterskin', quantity: 1, charges: 3 }] }),
				defaultMoodConfig,
			);
			const { conditions } = makeConditions(actor, setupDeps(actor));
			expect(conditions.HasWater()).toBe(true);
		});

		it('returns false when waterskin has 0 charges', () => {
			const actor = new AgentActor(
				createTestAgentData('a1', { inventory: [{ item_id: 'waterskin', quantity: 1, charges: 0 }] }),
				defaultMoodConfig,
			);
			const { conditions } = makeConditions(actor, setupDeps(actor));
			expect(conditions.HasWater()).toBe(false);
		});

		it('returns false when no waterskin in inventory', () => {
			const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
			const { conditions } = makeConditions(actor, setupDeps(actor));
			expect(conditions.HasWater()).toBe(false);
		});
	});

	describe('HasTradeGoods', () => {
		it('returns true when agent has a TRADE_GOODS item with quantity > 0', () => {
			const actor = new AgentActor(
				createTestAgentData('a1', { inventory: [{ item_id: 'tools', quantity: 2 }] }),
				defaultMoodConfig,
			);
			const { conditions } = makeConditions(actor, setupDeps(actor));
			expect(conditions.HasTradeGoods()).toBe(true);
		});

		it('returns false when agent has no TRADE_GOODS items', () => {
			const actor = new AgentActor(
				createTestAgentData('a1', { inventory: [{ item_id: 'torch', quantity: 1 }] }),
				defaultMoodConfig,
			);
			const { conditions } = makeConditions(actor, setupDeps(actor));
			expect(conditions.HasTradeGoods()).toBe(false);
		});

		it('returns false when inventory is empty', () => {
			const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
			const { conditions } = makeConditions(actor, setupDeps(actor));
			expect(conditions.HasTradeGoods()).toBe(false);
		});
	});

	describe('NeedsTools', () => {
		it('returns true when agent has no tools in inventory', () => {
			const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
			const { conditions } = makeConditions(actor, setupDeps(actor));
			expect(conditions.NeedsTools()).toBe(true);
		});

		it('returns true when agent has tools with quantity 0', () => {
			const actor = new AgentActor(
				createTestAgentData('a1', { inventory: [{ item_id: 'tools', quantity: 0 }] }),
				defaultMoodConfig,
			);
			const { conditions } = makeConditions(actor, setupDeps(actor));
			expect(conditions.NeedsTools()).toBe(true);
		});

		it('returns false when agent has tools with quantity > 0 and charges > 0', () => {
			const actor = new AgentActor(
				createTestAgentData('a1', { inventory: [{ item_id: 'tools', quantity: 1, charges: 5 }] }),
				defaultMoodConfig,
			);
			const { conditions } = makeConditions(actor, setupDeps(actor));
			expect(conditions.NeedsTools()).toBe(false);
		});

		it('returns true when agent has tools with charges 0', () => {
			const actor = new AgentActor(
				createTestAgentData('a1', { inventory: [{ item_id: 'tools', quantity: 1, charges: 0 }] }),
				defaultMoodConfig,
			);
			const { conditions } = makeConditions(actor, setupDeps(actor));
			expect(conditions.NeedsTools()).toBe(true);
		});
	});

	describe('NeedsEquipment', () => {
		it('returns true when agent has no equipment in inventory', () => {
			const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
			const { conditions } = makeConditions(actor, setupDeps(actor));
			expect(conditions.NeedsEquipment()).toBe(true);
		});

		it('returns true when agent has equipment with quantity 0', () => {
			const actor = new AgentActor(
				createTestAgentData('a1', { inventory: [{ item_id: 'equipment', quantity: 0 }] }),
				defaultMoodConfig,
			);
			const { conditions } = makeConditions(actor, setupDeps(actor));
			expect(conditions.NeedsEquipment()).toBe(true);
		});

		it('returns false when agent has equipment with quantity > 0 and charges > 0', () => {
			const actor = new AgentActor(
				createTestAgentData('a1', { inventory: [{ item_id: 'equipment', quantity: 1, charges: 10 }] }),
				defaultMoodConfig,
			);
			const { conditions } = makeConditions(actor, setupDeps(actor));
			expect(conditions.NeedsEquipment()).toBe(false);
		});

		it('returns true when agent has equipment with charges 0', () => {
			const actor = new AgentActor(
				createTestAgentData('a1', { inventory: [{ item_id: 'equipment', quantity: 1, charges: 0 }] }),
				defaultMoodConfig,
			);
			const { conditions } = makeConditions(actor, setupDeps(actor));
			expect(conditions.NeedsEquipment()).toBe(true);
		});
	});

	// ── Gold / economy conditions ─────────────────────────────────────────

	describe('HasGold', () => {
		it('returns true when gold >= amount', () => {
			const actor = new AgentActor(createTestAgentData('a1', { wallet: { gold: 50 } }), defaultMoodConfig);
			const { conditions } = makeConditions(actor, setupDeps(actor));
			expect(conditions.HasGold(50)).toBe(true);
			expect(conditions.HasGold(25)).toBe(true);
		});

		it('returns false when gold < amount', () => {
			const actor = new AgentActor(createTestAgentData('a1', { wallet: { gold: 10 } }), defaultMoodConfig);
			const { conditions } = makeConditions(actor, setupDeps(actor));
			expect(conditions.HasGold(11)).toBe(false);
		});
	});

	describe('CanAffordFood', () => {
		it('returns true when gold >= food_price and hunger is critical', () => {
			const actor = new AgentActor(
				createTestAgentData('a1', { wallet: { gold: 10 }, needs: { hunger: 10, energy: 90, social: 70, thirst: 80 } }),
				defaultMoodConfig,
			);
			actor.get(NeedsComponent).state = { hunger: 10, energy: 90, social: 70, thirst: 80 };
			const { conditions } = makeConditions(actor, setupDeps(actor, { config }));
			expect(conditions.CanAffordFood()).toBe(true);
		});

		it('returns false when gold < food_price', () => {
			const actor = new AgentActor(createTestAgentData('a1', { wallet: { gold: 2 } }), defaultMoodConfig);
			const { conditions } = makeConditions(actor, setupDeps(actor, { config }));
			expect(conditions.CanAffordFood()).toBe(false);
		});

		it('returns false when well-fed (reservation price below food_price)', () => {
			const actor = new AgentActor(
				createTestAgentData('a1', { wallet: { gold: 10 }, needs: { hunger: 80, energy: 90, social: 70, thirst: 80 } }),
				defaultMoodConfig,
			);
			actor.get(NeedsComponent).state = { hunger: 80, energy: 90, social: 70, thirst: 80 };
			const { conditions } = makeConditions(actor, setupDeps(actor, { config }));
			expect(conditions.CanAffordFood()).toBe(false);
		});
	});

	describe('CanAffordItem', () => {
		it('returns true when agent gold >= cheapest known price', () => {
			const actor = new AgentActor(createTestAgentData('a1', { wallet: { gold: 20 } }), defaultMoodConfig);
			const deps = setupDeps(actor, { tickCount: () => 1 });
			const { conditions, memory } = makeConditions(actor, deps);
			memory.priceMemories.push({ itemId: 'tools', price: 8, locationId: 'loc-market', tick: 1 });
			expect(conditions.CanAffordItem('tools')).toBe(true);
		});

		it('returns false when agent gold < cheapest known price', () => {
			const actor = new AgentActor(createTestAgentData('a1', { wallet: { gold: 5 } }), defaultMoodConfig);
			const deps = setupDeps(actor, { tickCount: () => 1 });
			const { conditions, memory } = makeConditions(actor, deps);
			memory.priceMemories.push({ itemId: 'tools', price: 8, locationId: 'loc-market', tick: 1 });
			expect(conditions.CanAffordItem('tools')).toBe(false);
		});

		it('falls back to config food_price when no price memory exists', () => {
			const actor = new AgentActor(createTestAgentData('a1', { wallet: { gold: 50 } }), defaultMoodConfig);
			const { conditions } = makeConditions(actor, setupDeps(actor, { config }));
			expect(conditions.CanAffordItem('unknown-item')).toBe(true);
		});

		it('ignores stale price memories and falls back to config food_price', () => {
			const actor = new AgentActor(createTestAgentData('a1', { wallet: { gold: 2 } }), defaultMoodConfig);
			const deps = setupDeps(actor, { config, tickCount: () => 300 });
			const { conditions, memory } = makeConditions(actor, deps);
			memory.priceMemories.push({ itemId: 'tools', price: 8, locationId: 'loc-market', tick: 1 });
			expect(conditions.CanAffordItem('tools')).toBe(false);
		});

		it('uses cheapest of multiple valid price memories', () => {
			const actor = new AgentActor(createTestAgentData('a1', { wallet: { gold: 6 } }), defaultMoodConfig);
			const deps = setupDeps(actor, { tickCount: () => 1 });
			const { conditions, memory } = makeConditions(actor, deps);
			memory.priceMemories.push({ itemId: 'tools', price: 10, locationId: 'loc-a', tick: 1 });
			memory.priceMemories.push({ itemId: 'tools', price: 5, locationId: 'loc-b', tick: 1 });
			expect(conditions.CanAffordItem('tools')).toBe(true);
		});
	});

	describe('KnowsFoodSource', () => {
		it('returns true when price memory has fresh food entry', () => {
			const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
			const deps = setupDeps(actor, { config, tickCount: () => 10 });
			const { conditions, memory } = makeConditions(actor, deps);
			memory.priceMemories.push({ itemId: 'food', price: 3, locationId: 'loc-tavern', tick: 5 });
			expect(conditions.KnowsFoodSource()).toBe(true);
		});

		it('returns false when no food entries in price memory', () => {
			const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
			const deps = setupDeps(actor, { config, tickCount: () => 10 });
			const { conditions } = makeConditions(actor, deps);
			expect(conditions.KnowsFoodSource()).toBe(false);
		});

		it('returns false when food entries are stale', () => {
			const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
			const deps = setupDeps(actor, { config, tickCount: () => 300 });
			const { conditions, memory } = makeConditions(actor, deps);
			memory.priceMemories.push({ itemId: 'food', price: 3, locationId: 'loc-tavern', tick: 1 });
			expect(conditions.KnowsFoodSource()).toBe(false);
		});
	});

	// ── Location-based conditions ─────────────────────────────────────────

	describe('AtLocation', () => {
		it('returns true when atLocation is set and type matches', () => {
			const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
			const locations = [makeLocation('loc-tavern', 'food')];
			const deps = setupDeps(actor, { getLocations: () => locations });
			const { conditions, memory } = makeConditions(actor, deps);
			memory.atLocation = 'loc-tavern';
			expect(conditions.AtLocation('food')).toBe(true);
		});

		it('returns false when atLocation is null', () => {
			const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
			const { conditions } = makeConditions(actor, setupDeps(actor));
			expect(conditions.AtLocation('food')).toBe(false);
		});

		it('returns false when type does not match', () => {
			const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
			const locations = [makeLocation('loc-tavern', 'food')];
			const deps = setupDeps(actor, { getLocations: () => locations });
			const { conditions, memory } = makeConditions(actor, deps);
			memory.atLocation = 'loc-tavern';
			expect(conditions.AtLocation('rest')).toBe(false);
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
			const { conditions } = makeConditions(actor, setupDeps(actor, { getLocations: () => locations }));
			expect(conditions.NearLocation('rest')).toBe(true);
		});

		it('returns false when no nearby location matches', () => {
			const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
			actor.get(PerceptionComponent).state = {
				nearbyAgents: [],
				nearbyLocations: [{ id: 'loc-inn', type: 'rest', distance: 20 }],
			};
			const locations = [makeLocation('loc-inn', 'rest')];
			const { conditions } = makeConditions(actor, setupDeps(actor, { getLocations: () => locations }));
			expect(conditions.NearLocation('market')).toBe(false);
		});
	});

	// ── Agent proximity conditions ────────────────────────────────────────

	describe('NearAgent', () => {
		it('returns true when nearbyAgents is non-empty', () => {
			const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
			actor.get(PerceptionComponent).state = {
				nearbyAgents: [{ id: 'agent-b', distance: 30 }],
				nearbyLocations: [],
			};
			const { conditions } = makeConditions(actor, setupDeps(actor));
			expect(conditions.NearAgent()).toBe(true);
		});

		it('returns false when nearbyAgents is empty', () => {
			const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
			const { conditions } = makeConditions(actor, setupDeps(actor));
			expect(conditions.NearAgent()).toBe(false);
		});
	});

	describe('NearAgentClose', () => {
		it('returns true when any agent within interaction_radius', () => {
			const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
			actor.get(PerceptionComponent).state = {
				nearbyAgents: [{ id: 'agent-b', distance: 10 }],
				nearbyLocations: [],
			};
			const { conditions } = makeConditions(actor, setupDeps(actor, { config }));
			expect(conditions.NearAgentClose()).toBe(true);
		});

		it('returns false when no agent within interaction_radius', () => {
			const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
			actor.get(PerceptionComponent).state = {
				nearbyAgents: [{ id: 'agent-b', distance: 30 }],
				nearbyLocations: [],
			};
			const { conditions } = makeConditions(actor, setupDeps(actor, { config }));
			expect(conditions.NearAgentClose()).toBe(false);
		});
	});

	// ── Time-based conditions ─────────────────────────────────────────────

	describe('IsDaytime', () => {
		it('returns true when phase is day', () => {
			const world = createWorldEntity('day');
			const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
			const { conditions } = makeConditions(actor, setupDeps(actor, { worldEntity: () => world }));
			expect(conditions.IsDaytime()).toBe(true);
		});

		it('returns false when phase is night', () => {
			const world = createWorldEntity('night');
			const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
			const { conditions } = makeConditions(actor, setupDeps(actor, { worldEntity: () => world }));
			expect(conditions.IsDaytime()).toBe(false);
		});
	});

	describe('IsNighttime', () => {
		it('returns true when phase is night', () => {
			const world = createWorldEntity('night');
			const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
			const { conditions } = makeConditions(actor, setupDeps(actor, { worldEntity: () => world }));
			expect(conditions.IsNighttime()).toBe(true);
		});

		it('returns true when phase is dusk', () => {
			const world = createWorldEntity('dusk');
			const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
			const { conditions } = makeConditions(actor, setupDeps(actor, { worldEntity: () => world }));
			expect(conditions.IsNighttime()).toBe(true);
		});

		it('returns false when phase is day', () => {
			const world = createWorldEntity('day');
			const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
			const { conditions } = makeConditions(actor, setupDeps(actor, { worldEntity: () => world }));
			expect(conditions.IsNighttime()).toBe(false);
		});
	});

	describe('IsDusk', () => {
		it('returns true during dusk phase', () => {
			const world = createWorldEntity('dusk');
			const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
			const { conditions } = makeConditions(actor, setupDeps(actor, { worldEntity: () => world }));
			expect(conditions.IsDusk()).toBe(true);
		});

		it('returns false during day phase', () => {
			const world = createWorldEntity('day');
			const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
			const { conditions } = makeConditions(actor, setupDeps(actor, { worldEntity: () => world }));
			expect(conditions.IsDusk()).toBe(false);
		});

		it('returns false during night phase', () => {
			const world = createWorldEntity('night');
			const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
			const { conditions } = makeConditions(actor, setupDeps(actor, { worldEntity: () => world }));
			expect(conditions.IsDusk()).toBe(false);
		});
	});

	describe('IsWorkHours', () => {
		it('returns true when phase is day regardless of offset', () => {
			const world = createWorldEntity('day');
			const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
			const { conditions } = makeConditions(actor, setupDeps(actor, { config, worldEntity: () => world }), undefined, 99);
			expect(conditions.IsWorkHours()).toBe(true);
		});

		it('returns true during dawn when tickInCycle >= dawn.start + wakeOffset', () => {
			const world = createWorldEntity('dawn', 10);
			const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
			const { conditions } = makeConditions(actor, setupDeps(actor, { config, worldEntity: () => world }), undefined, 5);
			// dawn.start=0, wakeOffset=5, tickInCycle=10 → 10 >= 0+5 → true
			expect(conditions.IsWorkHours()).toBe(true);
		});

		it('returns false during dawn when tickInCycle < dawn.start + wakeOffset', () => {
			const world = createWorldEntity('dawn', 2);
			const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
			const { conditions } = makeConditions(actor, setupDeps(actor, { config, worldEntity: () => world }), undefined, 10);
			// dawn.start=0, wakeOffset=10, tickInCycle=2 → 2 < 0+10 → false
			expect(conditions.IsWorkHours()).toBe(false);
		});

		it('returns false when phase is night', () => {
			const world = createWorldEntity('night');
			const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
			const { conditions } = makeConditions(actor, setupDeps(actor, { config, worldEntity: () => world }));
			expect(conditions.IsWorkHours()).toBe(false);
		});

		it('returns false when phase is dusk', () => {
			const world = createWorldEntity('dusk');
			const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
			const { conditions } = makeConditions(actor, setupDeps(actor, { config, worldEntity: () => world }));
			expect(conditions.IsWorkHours()).toBe(false);
		});
	});

	// ── Job / facility conditions ─────────────────────────────────────────

	describe('HasJob', () => {
		it('returns true when job is set', () => {
			const actor = new AgentActor(createTestAgentData('a1', { job: 'baker' }), defaultMoodConfig);
			const { conditions } = makeConditions(actor, setupDeps(actor));
			expect(conditions.HasJob()).toBe(true);
		});

		it('returns false when job is null', () => {
			const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
			const { conditions } = makeConditions(actor, setupDeps(actor));
			expect(conditions.HasJob()).toBe(false);
		});
	});

	describe('HasNoJob', () => {
		it('returns true when job is null', () => {
			const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
			const { conditions } = makeConditions(actor, setupDeps(actor));
			expect(conditions.HasNoJob()).toBe(true);
		});

		it('returns false when job is set', () => {
			const actor = new AgentActor(createTestAgentData('a1', { job: 'baker' }), defaultMoodConfig);
			const { conditions } = makeConditions(actor, setupDeps(actor));
			expect(conditions.HasNoJob()).toBe(false);
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
				stock: [], fund: 100, workProgress: 0, status: 'idle', workerId: 'a1',
			});

			const deps = setupDeps(actor, {
				getLocations: () => locations,
				getLocationActors: () => new Map([['loc-bakery', facActor]]),
			});

			const { conditions, memory } = makeConditions(actor, deps);
			memory.atLocation = 'loc-bakery';
			expect(conditions.AtJobFacility()).toBe(true);
		});

		it('returns false when not at any location', () => {
			const actor = new AgentActor(createTestAgentData('a1', { job: 'baker' }), defaultMoodConfig);
			const { conditions } = makeConditions(actor, setupDeps(actor));
			expect(conditions.AtJobFacility()).toBe(false);
		});

		it('returns false when agent has no job', () => {
			const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
			const { conditions, memory } = makeConditions(actor, setupDeps(actor));
			memory.atLocation = 'loc-bakery';
			expect(conditions.AtJobFacility()).toBe(false);
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

			const deps = setupDeps(actor, {
				getLocations: () => locations,
				getLocationActors: () => new Map([['loc-bakery', facActor]]),
			});

			const { conditions } = makeConditions(actor, deps);
			expect(conditions.FacilityHasStock('food')).toBe(true);
		});

		it('returns false when no nearby facility has that item', () => {
			const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
			const { conditions } = makeConditions(actor, setupDeps(actor));
			expect(conditions.FacilityHasStock('food')).toBe(false);
		});
	});

	describe('OpenFacilityNearby', () => {
		it('returns true when a nearby facility has no worker', () => {
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
				stock: [], fund: 100, workProgress: 0, status: 'idle', workerId: null,
			});

			const deps = setupDeps(actor, {
				getLocations: () => locations,
				getLocationActors: () => new Map([['loc-bakery', facActor]]),
			});

			const { conditions } = makeConditions(actor, deps);
			expect(conditions.OpenFacilityNearby()).toBe(true);
		});

		it('returns false when all facilities have workers', () => {
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
				stock: [], fund: 100, workProgress: 0, status: 'idle', workerId: 'other-agent',
			});

			const deps = setupDeps(actor, {
				getLocations: () => locations,
				getLocationActors: () => new Map([['loc-bakery', facActor]]),
			});

			const { conditions } = makeConditions(actor, deps);
			expect(conditions.OpenFacilityNearby()).toBe(false);
		});

		it('returns false when no facilities nearby', () => {
			const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
			const { conditions } = makeConditions(actor, setupDeps(actor));
			expect(conditions.OpenFacilityNearby()).toBe(false);
		});
	});

	describe('OpenProductionFacilityNearby', () => {
		it('returns true when a nearby production facility has no worker', () => {
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
				stock: [], fund: 100, workProgress: 0, status: 'idle', workerId: null,
			});

			const deps = setupDeps(actor, {
				getLocations: () => locations,
				getLocationActors: () => new Map([['loc-bakery', facActor]]),
			});

			const { conditions } = makeConditions(actor, deps);
			expect(conditions.OpenProductionFacilityNearby()).toBe(true);
		});

		it('returns false when open facility has empty job string', () => {
			const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
			actor.get(PerceptionComponent).state = {
				nearbyAgents: [],
				nearbyLocations: [{ id: 'loc-tavern', type: 'food', distance: 10 }],
			};

			// Location with no production (job will default to '')
			const locations = [makeLocation('loc-tavern', 'food')];

			const facActor = createLocationActor({
				stock: [], fund: 100, workProgress: 0, status: 'idle', workerId: null,
			});

			const deps = setupDeps(actor, {
				getLocations: () => locations,
				getLocationActors: () => new Map([['loc-tavern', facActor]]),
			});

			const { conditions } = makeConditions(actor, deps);
			expect(conditions.OpenProductionFacilityNearby()).toBe(false);
		});

		it('returns false when no facilities nearby', () => {
			const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
			const { conditions } = makeConditions(actor, setupDeps(actor));
			expect(conditions.OpenProductionFacilityNearby()).toBe(false);
		});
	});

	// ── Cargo conditions ──────────────────────────────────────────────────

	describe('HasCargo', () => {
		it('returns true when haulCargo is set', () => {
			const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
			const { conditions, memory } = makeConditions(actor, setupDeps(actor));
			memory.haulCargo = { itemId: 'flour', quantity: 1, source: 'loc-a', destination: 'loc-b' };
			expect(conditions.HasCargo()).toBe(true);
		});

		it('returns false when haulCargo is null', () => {
			const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
			const { conditions } = makeConditions(actor, setupDeps(actor));
			expect(conditions.HasCargo()).toBe(false);
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
			const deps = setupDeps(actor, { getLocations: () => locations });
			const { conditions, memory } = makeConditions(actor, deps);
			memory.haulCargo = { itemId: 'flour', quantity: 1, source: 'loc-a', destination: 'loc-mill' };
			expect(conditions.CargoDestinationNearby()).toBe(true);
		});

		it('returns false when haulCargo is null', () => {
			const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
			const { conditions } = makeConditions(actor, setupDeps(actor));
			expect(conditions.CargoDestinationNearby()).toBe(false);
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

			const deps = setupDeps(actor, {
				getLocations: () => locations,
				getLocationActors: () => new Map([['loc-mill', facActor]]),
			});

			const { conditions } = makeConditions(actor, deps);
			expect(conditions.FacilityNeedsSupply()).toBe(true);
		});

		it('returns false when no facility has unmet input', () => {
			const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
			const { conditions } = makeConditions(actor, setupDeps(actor));
			expect(conditions.FacilityNeedsSupply()).toBe(false);
		});
	});

	describe('BetterPayAvailable', () => {
		it('returns false when agent has no job', () => {
			const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
			const { conditions } = makeConditions(actor, setupDeps(actor));
			expect(conditions.BetterPayAvailable()).toBe(false);
		});

		it('returns false when no open facilities nearby', () => {
			const actor = new AgentActor(createTestAgentData('a1', { job: 'farmer' }), defaultMoodConfig);
			const { conditions } = makeConditions(actor, setupDeps(actor));
			expect(conditions.BetterPayAvailable()).toBe(false);
		});

		it('returns false when no facility offers higher effective wage', () => {
			const actor = new AgentActor(createTestAgentData('a1', { job: 'farmer' }), defaultMoodConfig);
			const farmLoc = makeLocation('farm-1', 'food', 110, 200, {
				job: 'farmer', output: { item_id: 'wheat', quantity: 1 }, input: null, ticks_per_cycle: 10, wage: 10,
			});
			const locActor = createLocationActor({ stock: [], fund: 100, workProgress: 0, status: 'idle', workerId: actor.agentId });
			const locationActors = new Map<string, Actor>([['farm-1', locActor]]);
			actor.get(PerceptionComponent).state = {
				nearbyAgents: [],
				nearbyLocations: [{ id: 'farm-1', type: 'food', distance: 10 }],
			};
			const deps = setupDeps(actor, {
				config: GameConfigSchema.parse({ jobs: { definitions: { farmer: { primary_attribute: 'HT', behavior_tree: 'bt-farmer' } } } }),
				getLocationActors: () => locationActors,
				getLocations: () => [farmLoc],
			});
			const { conditions } = makeConditions(actor, deps);
			expect(conditions.BetterPayAvailable()).toBe(false);
		});

		it('returns true when open facility offers higher wage', () => {
			const actor = new AgentActor(createTestAgentData('a1', { job: 'farmer' }), defaultMoodConfig);
			const farmLoc = makeLocation('farm-1', 'food', 110, 200, {
				job: 'farmer', output: { item_id: 'wheat', quantity: 1 }, input: null, ticks_per_cycle: 10, wage: 5,
			});
			const betterFarmLoc = makeLocation('farm-2', 'food', 120, 200, {
				job: 'farmer', output: { item_id: 'wheat', quantity: 1 }, input: null, ticks_per_cycle: 10, wage: 15,
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
			const deps = setupDeps(actor, {
				config: GameConfigSchema.parse({ jobs: { definitions: { farmer: { primary_attribute: 'HT', behavior_tree: 'bt-farmer' } } } }),
				getLocationActors: () => locationActors,
				getLocations: () => [farmLoc, betterFarmLoc],
			});
			const { conditions } = makeConditions(actor, deps);
			expect(conditions.BetterPayAvailable()).toBe(true);
		});

		it('accounts for aptitude efficiency in effective wage comparison', () => {
			// Agent has high IQ (15) but low HT (5). Current job: farmer (HT-based, wage 10).
			// Available job: scholar (IQ-based, wage 8). Scholar effective = 8 * 15/10 = 12 > farmer effective = 10 * 5/10 = 5.
			const actor = new AgentActor(createTestAgentData('a1', {
				job: 'farmer',
				attributes: { ST: 10, DX: 10, IQ: 15, HT: 5 },
			}), defaultMoodConfig);
			const farmLoc = makeLocation('farm-1', 'food', 110, 200, {
				job: 'farmer', output: { item_id: 'wheat', quantity: 1 }, input: null, ticks_per_cycle: 10, wage: 10,
			});
			const scholarLoc = makeLocation('library-1', 'workshop', 120, 200, {
				job: 'scholar', output: { item_id: 'scroll', quantity: 1 }, input: null, ticks_per_cycle: 10, wage: 8,
			});
			const locActor1 = createLocationActor({ stock: [], fund: 100, workProgress: 0, status: 'idle', workerId: actor.agentId });
			const locActor2 = createLocationActor({ stock: [], fund: 100, workProgress: 0, status: 'idle', workerId: null });
			const locationActors = new Map<string, Actor>([['farm-1', locActor1], ['library-1', locActor2]]);
			actor.get(PerceptionComponent).state = {
				nearbyAgents: [],
				nearbyLocations: [
					{ id: 'farm-1', type: 'food', distance: 10 },
					{ id: 'library-1', type: 'workshop', distance: 20 },
				],
			};
			const deps = setupDeps(actor, {
				config: GameConfigSchema.parse({
					jobs: {
						definitions: {
							farmer: { primary_attribute: 'HT', behavior_tree: 'bt-farmer' },
							scholar: { primary_attribute: 'IQ', behavior_tree: 'bt-scholar' },
						},
					},
				}),
				getLocationActors: () => locationActors,
				getLocations: () => [farmLoc, scholarLoc],
			});
			const { conditions } = makeConditions(actor, deps);
			expect(conditions.BetterPayAvailable()).toBe(true);
		});
	});

	// ── Supply route conditions ──────────────────────────────────────────

	describe('KnowsSupplyRoute', () => {
		it('returns false when knownLocations is empty', () => {
			const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
			const deps = setupDeps(actor, {
				getLocations: () => [],
			});
			const { conditions, memory } = makeConditions(actor, deps);
			memory.knownLocations = [];
			expect(conditions.KnowsSupplyRoute()).toBe(false);
			expect(memory.supplyRoute).toBeNull();
		});

		it('returns true and caches route when source and destination match', () => {
			const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
			const farmLoc = makeLocation('loc-farm', 'food', 100, 200, {
				job: 'farmer', output: { item_id: 'wheat', quantity: 1 }, input: null, ticks_per_cycle: 10, wage: 5,
			}, 'region-test');
			const millLoc = makeLocation('loc-mill', 'work', 120, 200, {
				job: 'miller', output: { item_id: 'flour', quantity: 1 }, input: { item_id: 'wheat', quantity: 1 }, ticks_per_cycle: 10, wage: 5,
			}, 'region-test');
			const deps = setupDeps(actor, {
				getLocations: () => [farmLoc, millLoc],
			});
			const { conditions, memory } = makeConditions(actor, deps);
			memory.knownLocations = ['loc-farm', 'loc-mill'];
			expect(conditions.KnowsSupplyRoute()).toBe(true);
			expect(memory.supplyRoute).not.toBeNull();
			expect(memory.supplyRoute!.sourceId).toBe('loc-farm');
			expect(memory.supplyRoute!.destinationId).toBe('loc-mill');
			expect(memory.supplyRoute!.itemId).toBe('wheat');
		});

		it('returns false when no facility needs input', () => {
			const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
			const farmLoc = makeLocation('loc-farm', 'food', 100, 200, {
				job: 'farmer', output: { item_id: 'wheat', quantity: 1 }, input: null, ticks_per_cycle: 10, wage: 5,
			});
			const deps = setupDeps(actor, {
				getLocations: () => [farmLoc],
			});
			const { conditions, memory } = makeConditions(actor, deps);
			memory.knownLocations = ['loc-farm'];
			expect(conditions.KnowsSupplyRoute()).toBe(false);
		});
	});

	// ── Quest conditions ─────────────────────────────────────────────────

	describe('HasQuest', () => {
		it('returns false when no active quest', () => {
			const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
			const deps = setupDeps(actor, { config });
			const { conditions } = makeConditions(actor, deps);
			expect(conditions.HasQuest()).toBe(false);
		});

		it('returns true when active quest set', () => {
			const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
			const deps = setupDeps(actor, { config });
			const { conditions, memory } = makeConditions(actor, deps);
			memory.activeQuest = {
				id: 'q1', type: 'supply', facilityId: 'loc-mill', itemId: 'wheat',
				quantity: 2, reward: 10, rewardXp: 5, state: 'claimed', claimedBy: 'a1',
				createdTick: 0, expiryTicks: 100, repairProgress: 0,
			};
			expect(conditions.HasQuest()).toBe(true);
		});
	});

	describe('QuestAvailable', () => {
		it('returns false when no quest board', () => {
			const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
			const deps = setupDeps(actor, { config });
			// no getQuestBoard in deps
			const { conditions } = makeConditions(actor, deps);
			expect(conditions.QuestAvailable()).toBe(false);
		});

		it('returns false when no open quests', () => {
			const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
			const deps = setupDeps(actor, {
				config,
				getQuestBoard: () => ({ quests: [
					{ id: 'q1', type: 'supply', facilityId: 'loc-mill', itemId: 'wheat', quantity: 1, reward: 10, rewardXp: 5, state: 'completed', claimedBy: 'a1', createdTick: 0, expiryTicks: 100, repairProgress: 0 },
				] }),
			});
			const { conditions } = makeConditions(actor, deps);
			expect(conditions.QuestAvailable()).toBe(false);
		});

		it('returns true and caches best quest', () => {
			const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
			actor.get(PerceptionComponent).state.nearbyLocations = [
				{ id: 'loc-mill', type: 'work', distance: 50 },
			];
			const millLoc = makeLocation('loc-mill', 'work', 100, 200, {
				job: 'miller', output: { item_id: 'flour', quantity: 1 }, input: { item_id: 'wheat', quantity: 1 }, ticks_per_cycle: 10, wage: 5,
			});
			const deps = setupDeps(actor, {
				config,
				getLocations: () => [millLoc],
				getQuestBoard: () => ({ quests: [
					{ id: 'q1', type: 'supply', facilityId: 'loc-mill', itemId: 'wheat', quantity: 2, reward: 15, rewardXp: 5, state: 'open', claimedBy: null, createdTick: 0, expiryTicks: 100, repairProgress: 0 },
				] }),
			});
			const { conditions, memory } = makeConditions(actor, deps);
			memory.knownLocations = ['loc-mill'];
			expect(conditions.QuestAvailable()).toBe(true);
			expect(memory.cachedAvailableQuest).not.toBeNull();
			expect(memory.cachedAvailableQuest!.id).toBe('q1');
		});
	});

	describe('QuestAtFacility', () => {
		it('returns true when at quest facility', () => {
			const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
			const deps = setupDeps(actor, { config });
			const { conditions, memory } = makeConditions(actor, deps);
			memory.activeQuest = {
				id: 'q1', type: 'supply', facilityId: 'loc-mill', itemId: 'wheat',
				quantity: 2, reward: 10, rewardXp: 5, state: 'claimed', claimedBy: 'a1',
				createdTick: 0, expiryTicks: 100, repairProgress: 0,
			};
			memory.atLocation = 'loc-mill';
			expect(conditions.QuestAtFacility()).toBe(true);
		});

		it('returns false when not at quest facility', () => {
			const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
			const deps = setupDeps(actor, { config });
			const { conditions, memory } = makeConditions(actor, deps);
			memory.activeQuest = {
				id: 'q1', type: 'supply', facilityId: 'loc-mill', itemId: 'wheat',
				quantity: 2, reward: 10, rewardXp: 5, state: 'claimed', claimedBy: 'a1',
				createdTick: 0, expiryTicks: 100, repairProgress: 0,
			};
			memory.atLocation = 'loc-farm';
			expect(conditions.QuestAtFacility()).toBe(false);
		});

		it('returns false when no active quest', () => {
			const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
			const deps = setupDeps(actor, { config });
			const { conditions, memory } = makeConditions(actor, deps);
			memory.atLocation = 'loc-mill';
			expect(conditions.QuestAtFacility()).toBe(false);
		});
	});

	describe('QuestCargoReady', () => {
		it('returns true for repair quest (no cargo needed)', () => {
			const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
			const deps = setupDeps(actor, { config });
			const { conditions, memory } = makeConditions(actor, deps);
			memory.activeQuest = {
				id: 'q1', type: 'repair', facilityId: 'loc-mill', itemId: null,
				quantity: 1, reward: 10, rewardXp: 5, state: 'claimed', claimedBy: 'a1',
				createdTick: 0, expiryTicks: 100, repairProgress: 0,
			};
			expect(conditions.QuestCargoReady()).toBe(true);
		});

		it('returns true when agent has required item', () => {
			const actor = new AgentActor(createTestAgentData('a1', {
				inventory: [{ item_id: 'wheat', quantity: 5 }],
			}), defaultMoodConfig);
			const deps = setupDeps(actor, { config });
			const { conditions, memory } = makeConditions(actor, deps);
			memory.activeQuest = {
				id: 'q1', type: 'supply', facilityId: 'loc-mill', itemId: 'wheat',
				quantity: 2, reward: 10, rewardXp: 5, state: 'claimed', claimedBy: 'a1',
				createdTick: 0, expiryTicks: 100, repairProgress: 0,
			};
			expect(conditions.QuestCargoReady()).toBe(true);
		});

		it('returns false when agent lacks required quantity', () => {
			const actor = new AgentActor(createTestAgentData('a1', {
				inventory: [{ item_id: 'wheat', quantity: 1 }],
			}), defaultMoodConfig);
			const deps = setupDeps(actor, { config });
			const { conditions, memory } = makeConditions(actor, deps);
			memory.activeQuest = {
				id: 'q1', type: 'supply', facilityId: 'loc-mill', itemId: 'wheat',
				quantity: 2, reward: 10, rewardXp: 5, state: 'claimed', claimedBy: 'a1',
				createdTick: 0, expiryTicks: 100, repairProgress: 0,
			};
			expect(conditions.QuestCargoReady()).toBe(false);
		});

		it('returns false when no active quest', () => {
			const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
			const deps = setupDeps(actor, { config });
			const { conditions } = makeConditions(actor, deps);
			expect(conditions.QuestCargoReady()).toBe(false);
		});
	});

	// ── Leisure / rest-day conditions ────────────────────────────────────

	describe('IsRestDay', () => {
		it('returns false on day 0', () => {
			const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
			const world = createWorldEntity('day', 0);
			const time = world.get(TimeComponent);
			time.state = { ...time.state, dayCount: 0 };
			const deps = setupDeps(actor, { config, worldEntity: () => world });
			const { conditions } = makeConditions(actor, deps);
			expect(conditions.IsRestDay()).toBe(false);
		});

		it('returns true on day 7 (rest_day_interval default = 7)', () => {
			const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
			const world = createWorldEntity('day', 0);
			const time = world.get(TimeComponent);
			time.state = { ...time.state, dayCount: 7 };
			const deps = setupDeps(actor, { config, worldEntity: () => world });
			const { conditions } = makeConditions(actor, deps);
			expect(conditions.IsRestDay()).toBe(true);
		});

		it('returns false on day 8', () => {
			const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
			const world = createWorldEntity('day', 0);
			const time = world.get(TimeComponent);
			time.state = { ...time.state, dayCount: 8 };
			const deps = setupDeps(actor, { config, worldEntity: () => world });
			const { conditions } = makeConditions(actor, deps);
			expect(conditions.IsRestDay()).toBe(false);
		});

		it('returns true on day 14', () => {
			const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
			const world = createWorldEntity('day', 0);
			const time = world.get(TimeComponent);
			time.state = { ...time.state, dayCount: 14 };
			const deps = setupDeps(actor, { config, worldEntity: () => world });
			const { conditions } = makeConditions(actor, deps);
			expect(conditions.IsRestDay()).toBe(true);
		});
	});

	describe('IsMoodLow', () => {
		it('returns true when mood < leisure_mood_threshold (-20)', () => {
			const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
			actor.get(MoodComponent).state = { value: -25, bucket: 'stressed' };
			const deps = setupDeps(actor, { config });
			const { conditions } = makeConditions(actor, deps);
			expect(conditions.IsMoodLow()).toBe(true);
		});

		it('returns false when mood >= leisure_mood_threshold (-20)', () => {
			const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
			actor.get(MoodComponent).state = { value: -20, bucket: 'stressed' };
			const deps = setupDeps(actor, { config });
			const { conditions } = makeConditions(actor, deps);
			expect(conditions.IsMoodLow()).toBe(false);
		});
	});

	describe('IsOverloaded', () => {
		it('returns true when food exceeds overload threshold', () => {
			const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
			actor.get(InventoryComponent).state = { items: [{ item_id: 'food', quantity: 15 }] };
			const { conditions } = makeConditions(actor, setupDeps(actor, { config }));
			expect(conditions.IsOverloaded()).toBe(true);
		});

		it('returns false when food is at overload threshold', () => {
			const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
			actor.get(InventoryComponent).state = { items: [{ item_id: 'food', quantity: 10 }] };
			const { conditions } = makeConditions(actor, setupDeps(actor, { config }));
			expect(conditions.IsOverloaded()).toBe(false);
		});

		it('returns true when trade goods exceed overload threshold', () => {
			const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
			actor.get(InventoryComponent).state = { items: [{ item_id: 'tools', quantity: 20 }] };
			const { conditions } = makeConditions(actor, setupDeps(actor, { config }));
			expect(conditions.IsOverloaded()).toBe(true);
		});

		it('returns false with normal inventory', () => {
			const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
			actor.get(InventoryComponent).state = { items: [{ item_id: 'food', quantity: 5 }, { item_id: 'tools', quantity: 3 }] };
			const { conditions } = makeConditions(actor, setupDeps(actor, { config }));
			expect(conditions.IsOverloaded()).toBe(false);
		});

		it('returns false with empty inventory', () => {
			const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
			actor.get(InventoryComponent).state = { items: [] };
			const { conditions } = makeConditions(actor, setupDeps(actor, { config }));
			expect(conditions.IsOverloaded()).toBe(false);
		});
	});

	describe('IsAtLeisure', () => {
		it('returns true when btAction is leisure and atLocation matches leisureTarget', () => {
			const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
			const deps = setupDeps(actor, { config });
			const { conditions, memory } = makeConditions(actor, deps);
			memory.btAction = 'leisure';
			memory.leisureTarget = 'loc-tavern';
			memory.atLocation = 'loc-tavern';
			expect(conditions.IsAtLeisure()).toBe(true);
		});

		it('returns false when btAction is not leisure', () => {
			const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
			const deps = setupDeps(actor, { config });
			const { conditions, memory } = makeConditions(actor, deps);
			memory.btAction = 'work';
			memory.leisureTarget = 'loc-tavern';
			memory.atLocation = 'loc-tavern';
			expect(conditions.IsAtLeisure()).toBe(false);
		});

		it('returns false when atLocation does not match leisureTarget', () => {
			const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
			const deps = setupDeps(actor, { config });
			const { conditions, memory } = makeConditions(actor, deps);
			memory.btAction = 'leisure';
			memory.leisureTarget = 'loc-tavern';
			memory.atLocation = 'loc-farm';
			expect(conditions.IsAtLeisure()).toBe(false);
		});
	});
});
