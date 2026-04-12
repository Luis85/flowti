import { describe, it, expect } from 'vitest';
import { Actor } from 'excalibur';
import { createServiceActions } from '../../../src/infrastructure/entity/bt-actions-service.js';
import { createWorkingMemory, type WorkingMemory } from '../../../src/infrastructure/entity/bt-working-memory.js';
import type { BehaviorAgentDeps } from '../../../src/infrastructure/entity/behavior-agent-factory.js';
import type { ActionContext } from '../../../src/infrastructure/entity/bt-action-helpers.js';
import { AgentActor } from '../../../src/infrastructure/entity/agent-actor.js';
import { WalletComponent } from '../../../src/infrastructure/components/wallet-component.js';
import { FacilityComponent } from '../../../src/infrastructure/components/facility-component.js';
import { GameConfigSchema } from '../../../src/domain/schemas/game-config-schema.js';
import { FacilityTypeSchema, type FacilityType } from '../../../src/domain/schemas/facility-type-schema.js';
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
		position: { x: 100, y: 100, region: 'test' },
		relationships: '',
		tools: [],
		color: '#b0b0b0',
		behavior_tree: 'bt-merchant',
		job: null,
		property: [],
		...overrides,
	};
}

function createBathhouseType(overrides: Partial<Record<string, unknown>> = {}): Extract<FacilityType, { kind: 'service' }> {
	const parsed = FacilityTypeSchema.parse({
		id: 'bathhouse',
		kind: 'service',
		primary_job: 'bathhouse_keeper',
		default_wage: 4,
		default_fund: 200,
		funding: 'facility',
		staffed_effects: { mood: 20, energy: 10, social: 5, skill_xp: 0 },
		unstaffed_effects: { mood: 5, energy: 2, social: 0, skill_xp: 0 },
		cost_per_visit: 8,
		ticks_per_visit: 3,
		...overrides,
	});
	if (parsed.kind !== 'service') throw new Error('expected service kind');
	return parsed;
}

function createInnType(): Extract<FacilityType, { kind: 'service' }> {
	const parsed = FacilityTypeSchema.parse({
		id: 'inn',
		kind: 'service',
		primary_job: 'innkeeper',
		default_wage: 4,
		funding: 'facility',
		staffed_effects: { mood: 5, energy: 30, social: 10, skill_xp: 0 },
		unstaffed_effects: { mood: 0, energy: 10, social: 0, skill_xp: 0 },
		cost_per_visit: 4,
		ticks_per_visit: 5,
	});
	if (parsed.kind !== 'service') throw new Error('expected service kind');
	return parsed;
}

function createTavernType(): Extract<FacilityType, { kind: 'service' }> {
	const parsed = FacilityTypeSchema.parse({
		id: 'tavern',
		kind: 'service',
		primary_job: 'tavern_keeper',
		default_wage: 4,
		funding: 'facility',
		staffed_effects: { mood: 40, energy: 0, social: 20, skill_xp: 0 },
		unstaffed_effects: { mood: 10, energy: 0, social: 5, skill_xp: 0 },
		cost_per_visit: 6,
		ticks_per_visit: 4,
	});
	if (parsed.kind !== 'service') throw new Error('expected service kind');
	return parsed;
}

interface Setup {
	ctx: ActionContext;
	memory: WorkingMemory;
	actor: AgentActor;
	nearbyLocations: PerceivedLocation[];
}

function setupServiceContext(options: {
	nearbyLocations: PerceivedLocation[];
	registry: Map<string, FacilityType>;
	startingGold?: number;
}): Setup {
	const actor = new AgentActor(
		createTestAgentData('agent-1', { wallet: { gold: options.startingGold ?? 50 } }),
		defaultMoodConfig,
	);
	const config = GameConfigSchema.parse({});
	const deps: BehaviorAgentDeps = {
		actor,
		worldEntity: () => new Actor(),
		config,
		getLocationActors: () => new Map(),
		getLocations: () => [],
		tickCount: () => 1,
		eventBus: noopEventBus,
		getFacilityTypeRegistry: () => options.registry,
	};
	const memory = createWorkingMemory(config.economy.price_memory_max);
	const resolveNearbyFacilities: () => PerceivedFacility[] = () => [];
	const resolveNearbyAgents: () => PerceivedAgent[] = () => [];
	const resolveNearbyLocations: () => PerceivedLocation[] = () => options.nearbyLocations;

	const ctx: ActionContext = {
		memory,
		actor,
		deps,
		resolveNearbyFacilities,
		resolveNearbyAgents,
		resolveNearbyLocations,
		commitmentMultiplier: 1.0,
	};
	return { ctx, memory, actor, nearbyLocations: options.nearbyLocations };
}

function makeNearbyLocation(id: string, facility_type: string, distance = 10): PerceivedLocation {
	return {
		id,
		type: 'leisure',
		facility_type,
		position: { x: 0, y: 0 },
		distance,
	};
}

describe('createServiceActions', () => {
	// ── ChooseServiceFacility ──────────────────────────────────────────────
	describe('ChooseServiceFacility', () => {
		it('picks the nearby service facility with the best staffed mood effect for leisure intent', () => {
			const bathhouse = createBathhouseType(); // mood 20
			const tavern = createTavernType(); // mood 40
			const inn = createInnType(); // mood 5
			const registry = new Map<string, FacilityType>([
				['bathhouse', bathhouse], ['tavern', tavern], ['inn', inn],
			]);
			const { ctx, memory } = setupServiceContext({
				nearbyLocations: [
					makeNearbyLocation('loc-bathhouse', 'bathhouse'),
					makeNearbyLocation('loc-tavern', 'tavern'),
					makeNearbyLocation('loc-inn', 'inn'),
				],
				registry,
			});
			const actions = createServiceActions(ctx);

			const result = actions.ChooseServiceFacility('leisure');
			expect(result).toBe('mistreevous.succeeded');
			expect(memory.serviceTarget).toBe('loc-tavern'); // mood 40 wins
		});

		it('picks the best energy facility for rest intent', () => {
			const bathhouse = createBathhouseType(); // energy 10
			const inn = createInnType(); // energy 30
			const registry = new Map<string, FacilityType>([
				['bathhouse', bathhouse], ['inn', inn],
			]);
			const { ctx, memory } = setupServiceContext({
				nearbyLocations: [
					makeNearbyLocation('loc-bathhouse', 'bathhouse'),
					makeNearbyLocation('loc-inn', 'inn'),
				],
				registry,
			});
			const actions = createServiceActions(ctx);

			expect(actions.ChooseServiceFacility('rest')).toBe('mistreevous.succeeded');
			expect(memory.serviceTarget).toBe('loc-inn');
		});

		it('returns FAILED when no eligible service facilities are nearby', () => {
			const registry = new Map<string, FacilityType>();
			const { ctx, memory } = setupServiceContext({
				nearbyLocations: [makeNearbyLocation('loc-unknown', 'nonexistent')],
				registry,
			});
			const actions = createServiceActions(ctx);

			expect(actions.ChooseServiceFacility('leisure')).toBe('mistreevous.failed');
			expect(memory.serviceTarget).toBeNull();
		});

		it('filters out service facilities whose intent score is zero or negative', () => {
			const tavern = createTavernType(); // energy 0 → useless for rest
			const registry = new Map<string, FacilityType>([['tavern', tavern]]);
			const { ctx, memory } = setupServiceContext({
				nearbyLocations: [makeNearbyLocation('loc-tavern', 'tavern')],
				registry,
			});
			const actions = createServiceActions(ctx);

			expect(actions.ChooseServiceFacility('rest')).toBe('mistreevous.failed');
			expect(memory.serviceTarget).toBeNull();
		});
	});

	// ── SeekService ────────────────────────────────────────────────────────
	describe('SeekService', () => {
		it('returns RUNNING and sets movement target when not at target yet', () => {
			const bathhouse = createBathhouseType();
			const registry = new Map<string, FacilityType>([['bathhouse', bathhouse]]);
			const { ctx, memory } = setupServiceContext({
				nearbyLocations: [makeNearbyLocation('loc-bathhouse', 'bathhouse')],
				registry,
			});
			memory.serviceTarget = 'loc-bathhouse';
			memory.atLocation = null;
			const actions = createServiceActions(ctx);

			expect(actions.SeekService()).toBe('mistreevous.running');
			expect(memory.movementTarget).toEqual({ id: 'loc-bathhouse', type: 'location' });
			expect(memory.btAction).toBe('seek_service');
		});

		it('returns SUCCEEDED when already at service target', () => {
			const bathhouse = createBathhouseType();
			const registry = new Map<string, FacilityType>([['bathhouse', bathhouse]]);
			const { ctx, memory } = setupServiceContext({
				nearbyLocations: [makeNearbyLocation('loc-bathhouse', 'bathhouse')],
				registry,
			});
			memory.serviceTarget = 'loc-bathhouse';
			memory.atLocation = 'loc-bathhouse';
			const actions = createServiceActions(ctx);

			expect(actions.SeekService()).toBe('mistreevous.succeeded');
		});

		it('returns FAILED when serviceTarget is null', () => {
			const registry = new Map<string, FacilityType>();
			const { ctx } = setupServiceContext({ nearbyLocations: [], registry });
			const actions = createServiceActions(ctx);

			expect(actions.SeekService()).toBe('mistreevous.failed');
		});
	});

	// ── UseService ─────────────────────────────────────────────────────────
	describe('UseService', () => {
		it('debits cost upfront, sets currentServiceVisit, begins use_service commitment', () => {
			const bathhouse = createBathhouseType(); // cost 8, ticks 3
			const registry = new Map<string, FacilityType>([['bathhouse', bathhouse]]);
			const { ctx, memory, actor } = setupServiceContext({
				nearbyLocations: [makeNearbyLocation('loc-bathhouse', 'bathhouse')],
				registry,
				startingGold: 50,
			});
			memory.serviceTarget = 'loc-bathhouse';
			const actions = createServiceActions(ctx);

			expect(actions.UseService()).toBe('mistreevous.running');
			expect(actor.get(WalletComponent).state.gold).toBe(42); // 50 - 8
			expect(memory.currentServiceVisit).toEqual({
				facilityId: 'loc-bathhouse',
				ticksRemaining: 3,
				costPaid: true,
			});
			expect(memory.insideFacility).toBe(true);
			expect(memory.btAction).toBe('use_service');
			expect(memory.committedAction).toBe('use_service');
			expect(memory.commitmentTicks).toBe(3);
		});

		it('does not debit wallet when cost_per_visit is zero', () => {
			const park = FacilityTypeSchema.parse({
				id: 'park',
				kind: 'service',
				primary_job: 'gardener',
				default_wage: 0,
				funding: 'treasury',
				staffed_effects: { mood: 5, energy: 0, social: 2, skill_xp: 0 },
				unstaffed_effects: { mood: 3, energy: 0, social: 1, skill_xp: 0 },
				cost_per_visit: 0,
				ticks_per_visit: 2,
			});
			if (park.kind !== 'service') throw new Error('expected service');
			const registry = new Map<string, FacilityType>([['park', park]]);
			const { ctx, memory, actor } = setupServiceContext({
				nearbyLocations: [makeNearbyLocation('loc-park', 'park')],
				registry,
				startingGold: 5,
			});
			memory.serviceTarget = 'loc-park';
			const actions = createServiceActions(ctx);

			expect(actions.UseService()).toBe('mistreevous.running');
			expect(actor.get(WalletComponent).state.gold).toBe(5);
			expect(memory.currentServiceVisit?.facilityId).toBe('loc-park');
		});

		it('returns FAILED when wallet gold is below cost_per_visit', () => {
			const bathhouse = createBathhouseType(); // cost 8
			const registry = new Map<string, FacilityType>([['bathhouse', bathhouse]]);
			const { ctx, memory, actor } = setupServiceContext({
				nearbyLocations: [makeNearbyLocation('loc-bathhouse', 'bathhouse')],
				registry,
				startingGold: 5,
			});
			memory.serviceTarget = 'loc-bathhouse';
			const actions = createServiceActions(ctx);

			expect(actions.UseService()).toBe('mistreevous.failed');
			expect(actor.get(WalletComponent).state.gold).toBe(5); // untouched
			expect(memory.currentServiceVisit).toBeNull();
			expect(memory.insideFacility).toBe(false);
		});

		it('returns FAILED when a visit is already in progress (no double-enter)', () => {
			const bathhouse = createBathhouseType();
			const registry = new Map<string, FacilityType>([['bathhouse', bathhouse]]);
			const { ctx, memory, actor } = setupServiceContext({
				nearbyLocations: [makeNearbyLocation('loc-bathhouse', 'bathhouse')],
				registry,
				startingGold: 50,
			});
			memory.serviceTarget = 'loc-bathhouse';
			memory.currentServiceVisit = { facilityId: 'loc-bathhouse', ticksRemaining: 2, costPaid: true };
			const walletBefore = actor.get(WalletComponent).state.gold;
			const actions = createServiceActions(ctx);

			expect(actions.UseService()).toBe('mistreevous.failed');
			expect(actor.get(WalletComponent).state.gold).toBe(walletBefore);
			expect(memory.currentServiceVisit?.ticksRemaining).toBe(2); // unchanged
		});

		it('returns FAILED when serviceTarget is null', () => {
			const registry = new Map<string, FacilityType>();
			const { ctx } = setupServiceContext({ nearbyLocations: [], registry });
			const actions = createServiceActions(ctx);

			expect(actions.UseService()).toBe('mistreevous.failed');
		});

		it('credits cost_per_visit to facility fund and emits GoldFlowed', () => {
			const bathhouse = createBathhouseType(); // cost_per_visit: 8
			const registry = new Map<string, FacilityType>([['bathhouse', bathhouse]]);
			const emittedEvents: Array<{ type: string; payload: Record<string, unknown> }> = [];
			const capturingEventBus: EventBus = {
				...noopEventBus,
				emit: (e: { type: string; payload?: unknown }) => { emittedEvents.push(e as { type: string; payload: Record<string, unknown> }); },
			};

			const actor = new AgentActor(
				createTestAgentData('agent-1', { wallet: { gold: 50 } }),
				defaultMoodConfig,
			);
			const facilityActor = new Actor();
			facilityActor.addComponent(new FacilityComponent({
				stock: [], fund: 100, workProgress: 0, status: 'idle', workerId: null,
			}));
			const locationActors = new Map<string, Actor>([['loc-bathhouse', facilityActor]]);

			const config = GameConfigSchema.parse({});
			const deps: BehaviorAgentDeps = {
				actor,
				worldEntity: () => new Actor(),
				config,
				getLocationActors: () => locationActors,
				getLocations: () => [],
				tickCount: () => 1,
				eventBus: capturingEventBus,
				getFacilityTypeRegistry: () => registry,
			};
			const memory = createWorkingMemory(config.economy.price_memory_max);
			const ctx: ActionContext = {
				memory, actor, deps,
				resolveNearbyFacilities: () => [],
				resolveNearbyAgents: () => [],
				resolveNearbyLocations: () => [makeNearbyLocation('loc-bathhouse', 'bathhouse')],
				commitmentMultiplier: 1.0,
			};

			memory.serviceTarget = 'loc-bathhouse';
			const actions = createServiceActions(ctx);
			actions.UseService();

			// Facility fund increased by cost_per_visit
			expect(facilityActor.get(FacilityComponent).state.fund).toBe(108);
			// Agent wallet decreased
			expect(actor.get(WalletComponent).state.gold).toBe(42);
			// GoldFlowed event emitted
			const goldEvent = emittedEvents.find(e => e.type === 'GoldFlowed');
			expect(goldEvent).toBeDefined();
			expect(goldEvent!.payload.subcategory).toBe('service_fee');
			expect(goldEvent!.payload.amount).toBe(8);
			expect(goldEvent!.payload.fromEntity).toBe('agent-1');
			expect(goldEvent!.payload.toEntity).toBe('loc-bathhouse');
		});

		it('returns FAILED when the target location is no longer nearby', () => {
			const bathhouse = createBathhouseType();
			const registry = new Map<string, FacilityType>([['bathhouse', bathhouse]]);
			const { ctx, memory } = setupServiceContext({
				nearbyLocations: [],
				registry,
				startingGold: 50,
			});
			memory.serviceTarget = 'loc-bathhouse';
			const actions = createServiceActions(ctx);

			expect(actions.UseService()).toBe('mistreevous.failed');
		});
	});
});
