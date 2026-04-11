import { describe, it, expect } from 'vitest';
import { Actor } from 'excalibur';
import { createAreaEffectSystem } from '../../../src/infrastructure/systems/area-effect-system.js';
import { AgentActor } from '../../../src/infrastructure/entity/agent-actor.js';
import { WalletComponent } from '../../../src/infrastructure/components/wallet-component.js';
import { EconomyComponent } from '../../../src/infrastructure/components/economy-component.js';
import { FacilityComponent } from '../../../src/infrastructure/components/facility-component.js';
import { GameConfigSchema } from '../../../src/domain/schemas/game-config-schema.js';
import { createPerformanceTracker } from '../../../src/infrastructure/performance/performance-tracker.js';
import { createEventBus } from '../../../src/infrastructure/event-bus.js';
import { FacilityTypeSchema, type FacilityType } from '../../../src/domain/schemas/facility-type-schema.js';
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
		needs: { hunger: 50, energy: 50, social: 40, thirst: 50 },
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
		hunger: 50, energy: 50, social: 40, thirst: 50, gold: 50, mood: 0, moodBucket: 'stressed',
		timePhase: 'day', job: null, position: { x: 0, y: 0 }, inventory: [],
		nearbyAgents: [], nearbyLocations: [], nearbyFacilities: [],
		movementTarget: null, journey: null, atLocation: null, currentRegion: '',
		haulCargo: null, questCargo: null, socialCooldowns: new Map(), committedAction: null,
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
		wakeOffset: 0,
		sleepOffset: 0,
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

function createGuardPostLocation(id = 'loc-guardpost', x = 100, y = 100): WorldLocation {
	return {
		id,
		name: 'Guard Post',
		type: 'service',
		position: { x, y, region: 'test' },
		capacity: 1,
		color: '#c08060',
		production: null,
		leisure: null,
		region: null,
	};
}

function createGuardPostType(overrides: Partial<Record<string, unknown>> = {}): Extract<FacilityType, { kind: 'area_effect' }> {
	const parsed = FacilityTypeSchema.parse({
		id: 'guard_post',
		kind: 'area_effect',
		primary_job: 'guard',
		default_wage: 4,
		default_fund: 200,
		funding: 'treasury',
		modifier: { kind: 'mood', delta_per_tick: 0.5 },
		radius: 50,
		ticks_per_pulse: 30,
		...overrides,
	});
	if (parsed.kind !== 'area_effect') throw new Error('expected area_effect kind');
	return parsed;
}

function createFacilityActor(fund = 200, workerId: string | null = null): Actor {
	const actor = new Actor();
	actor.addComponent(new FacilityComponent({
		stock: [], fund, workProgress: 0, status: 'idle', workerId,
	}));
	return actor;
}

function createWorldEntity(treasury = 1000): Actor {
	const entity = new Actor();
	entity.addComponent(new EconomyComponent({
		treasury,
		ledger: [],
		dailySummary: {
			totalWages: 0, totalTax: 0, totalSales: 0, totalConsumption: 0,
			avgWage: 0, wageSpread: 0, vacancyCount: 0, unemploymentCount: 0,
			jobSwitchesThisDay: 0, supplyDeliveries: 0, questsCompletedThisDay: 0,
		},
	}));
	return entity;
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
	};
}

function createWorkerAgent(locX: number, locY: number, job = 'guard'): AgentActor {
	const worker = new AgentActor(
		createTestAgentData('worker-1', locX, locY, { job }),
		defaultMoodConfig,
	);
	worker.behaviorAgent = createStubBehaviorAgent({ btAction: 'work', job });
	return worker;
}

function createBystander(id: string, x: number, y: number): AgentActor {
	const a = new AgentActor(
		createTestAgentData(id, x, y),
		defaultMoodConfig,
	);
	a.behaviorAgent = createStubBehaviorAgent({ btAction: 'wander' });
	return a;
}

describe('AreaEffectSystem', () => {
	it('staffed pulse: agents in radius get area modifier pushed after ticks_per_pulse', () => {
		const facilityType = createGuardPostType();
		const location = createGuardPostLocation();
		const worker = createWorkerAgent(location.position.x, location.position.y);
		const bystander = createBystander('bystander-1', location.position.x + 10, location.position.y + 10);
		const facilityActor = createFacilityActor(200, worker.agentId);
		const worldEntity = createWorldEntity();
		const agents = [worker, bystander];

		const handle = createAreaEffectSystem(
			() => agents,
			() => [location],
			() => new Map<string, Actor>([[location.id, facilityActor]]),
			() => new Map<string, FacilityType>([[facilityType.id, facilityType]]),
			() => facilityType.id,
			() => worldEntity,
		);

		const events: GameEvent[] = [];
		const eventBus = createEventBus();
		eventBus.on('AreaEffectPulsed', e => { events.push(e); });

		// First call at tick 5000 → initialise lastPulseTick, no pulse
		handle.system.execute(createDeps(eventBus, 5000));
		expect(handle.getLastPulseTick(location.id)).toBe(5000);
		expect(events).toHaveLength(0);
		expect(handle.getPending(bystander.agentId)).toHaveLength(0);

		// Call at tick 5030 → pulse fires (30 ticks elapsed)
		handle.system.execute(createDeps(eventBus, 5030));
		expect(events).toHaveLength(1);
		expect(handle.getLastPulseTick(location.id)).toBe(5030);

		const pending = handle.getPending(bystander.agentId);
		expect(pending).toHaveLength(1);
		expect(pending[0]).toEqual({ kind: 'mood', delta_per_tick: 0.5 });
	});

	it('unstaffed facility does not pulse, does not pay wage, and does not advance pulse clock', () => {
		const facilityType = createGuardPostType();
		const location = createGuardPostLocation();
		const bystander = createBystander('bystander-1', location.position.x, location.position.y);
		const facilityActor = createFacilityActor(200, null);
		const worldEntity = createWorldEntity(1000);
		const agents = [bystander];

		const handle = createAreaEffectSystem(
			() => agents,
			() => [location],
			() => new Map<string, Actor>([[location.id, facilityActor]]),
			() => new Map<string, FacilityType>([[facilityType.id, facilityType]]),
			() => facilityType.id,
			() => worldEntity,
		);

		const events: GameEvent[] = [];
		const eventBus = createEventBus();
		eventBus.on('AreaEffectPulsed', e => { events.push(e); });
		eventBus.on('GoldFlowed', e => { events.push(e); });

		const treasuryBefore = worldEntity.get(EconomyComponent).state.treasury;

		// Many ticks pass unstaffed — no pulse, no wage, no clock advance
		handle.system.execute(createDeps(eventBus, 5000));
		handle.system.execute(createDeps(eventBus, 5100));
		handle.system.execute(createDeps(eventBus, 5200));

		expect(events).toHaveLength(0);
		expect(handle.getPending(bystander.agentId)).toHaveLength(0);
		expect(worldEntity.get(EconomyComponent).state.treasury).toBe(treasuryBefore);
		// lastPulseTick never set — clock not advanced while unstaffed
		expect(handle.getLastPulseTick(location.id)).toBeUndefined();
	});

	it('pulse interval enforcement: no pulse until ticks_per_pulse elapse', () => {
		const facilityType = createGuardPostType();
		const location = createGuardPostLocation();
		const worker = createWorkerAgent(location.position.x, location.position.y);
		const bystander = createBystander('bystander-1', location.position.x, location.position.y);
		const facilityActor = createFacilityActor(200, worker.agentId);
		const worldEntity = createWorldEntity(1000);
		const agents = [worker, bystander];

		const handle = createAreaEffectSystem(
			() => agents,
			() => [location],
			() => new Map<string, Actor>([[location.id, facilityActor]]),
			() => new Map<string, FacilityType>([[facilityType.id, facilityType]]),
			() => facilityType.id,
			() => worldEntity,
		);

		const events: GameEvent[] = [];
		const eventBus = createEventBus();
		eventBus.on('AreaEffectPulsed', e => { events.push(e); });

		// tick 5000: initialise
		handle.system.execute(createDeps(eventBus, 5000));
		expect(events).toHaveLength(0);

		// tick 5029: only 29 ticks elapsed → no pulse
		handle.system.execute(createDeps(eventBus, 5029));
		expect(events).toHaveLength(0);
		expect(handle.getPending(bystander.agentId)).toHaveLength(0);

		// tick 5030: 30 ticks elapsed → pulse
		handle.system.execute(createDeps(eventBus, 5030));
		expect(events).toHaveLength(1);
		expect(handle.getPending(bystander.agentId)).toHaveLength(1);
	});

	it('lastPulseTick spawn semantics: first encounter does not pulse that same tick', () => {
		const facilityType = createGuardPostType();
		const location = createGuardPostLocation();
		const worker = createWorkerAgent(location.position.x, location.position.y);
		const bystander = createBystander('bystander-1', location.position.x, location.position.y);
		const facilityActor = createFacilityActor(200, worker.agentId);
		const worldEntity = createWorldEntity(1000);
		const agents = [worker, bystander];

		const handle = createAreaEffectSystem(
			() => agents,
			() => [location],
			() => new Map<string, Actor>([[location.id, facilityActor]]),
			() => new Map<string, FacilityType>([[facilityType.id, facilityType]]),
			() => facilityType.id,
			() => worldEntity,
		);

		const events: GameEvent[] = [];
		const eventBus = createEventBus();
		eventBus.on('AreaEffectPulsed', e => { events.push(e); });

		handle.system.execute(createDeps(eventBus, 5000));
		expect(events).toHaveLength(0);
		expect(handle.getLastPulseTick(location.id)).toBe(5000);
		// No pulse fired → no pending modifier on bystander
		expect(handle.getPending(bystander.agentId)).toHaveLength(0);
	});

	it('multiple overlapping posts stack: each pushes its own modifier', () => {
		const typeA = createGuardPostType({ id: 'guard_post', modifier: { kind: 'mood', delta_per_tick: 0.5 } });
		const typeB = createGuardPostType({ id: 'watch_tower', modifier: { kind: 'mood', delta_per_tick: 0.25 } });
		const locA = createGuardPostLocation('loc-guard-a', 100, 100);
		const locB = createGuardPostLocation('loc-guard-b', 120, 100);

		const workerA = new AgentActor(
			createTestAgentData('worker-a', locA.position.x, locA.position.y, { job: 'guard' }),
			defaultMoodConfig,
		);
		workerA.behaviorAgent = createStubBehaviorAgent({ btAction: 'work', job: 'guard' });

		const workerB = new AgentActor(
			createTestAgentData('worker-b', locB.position.x, locB.position.y, { job: 'guard' }),
			defaultMoodConfig,
		);
		workerB.behaviorAgent = createStubBehaviorAgent({ btAction: 'work', job: 'guard' });

		const bystander = createBystander('bystander-1', 110, 100);
		const actorA = createFacilityActor(200, workerA.agentId);
		const actorB = createFacilityActor(200, workerB.agentId);

		const worldEntity = createWorldEntity(1000);
		const agents = [workerA, workerB, bystander];

		const registry = new Map<string, FacilityType>([
			[typeA.id, typeA],
			[typeB.id, typeB],
		]);
		const locTypes = new Map<string, string>([
			[locA.id, typeA.id],
			[locB.id, typeB.id],
		]);

		const locationActors = new Map<string, Actor>([
			[locA.id, actorA],
			[locB.id, actorB],
		]);
		const handle = createAreaEffectSystem(
			() => agents,
			() => [locA, locB],
			() => locationActors,
			() => registry,
			(loc) => locTypes.get(loc.id),
			() => worldEntity,
		);

		// Init tick → no pulse
		handle.system.execute(createDeps(createEventBus(), 5000));
		// Pulse tick
		handle.system.execute(createDeps(createEventBus(), 5030));

		const pending = handle.getPending(bystander.agentId);
		expect(pending).toHaveLength(2);
		const deltas = pending.map(m => m.delta_per_tick).sort();
		expect(deltas).toEqual([0.25, 0.5]);
	});

	it('treasury-funded pulse: treasury drains by wage, worker paid net, GoldFlowed uses public_wage subcategory', () => {
		const facilityType = createGuardPostType({ funding: 'treasury', default_wage: 4 });
		const location = createGuardPostLocation();
		const worker = createWorkerAgent(location.position.x, location.position.y);
		const bystander = createBystander('bystander-1', location.position.x, location.position.y);
		const facilityActor = createFacilityActor(200, worker.agentId);
		const worldEntity = createWorldEntity(1000);
		const agents = [worker, bystander];

		const handle = createAreaEffectSystem(
			() => agents,
			() => [location],
			() => new Map<string, Actor>([[location.id, facilityActor]]),
			() => new Map<string, FacilityType>([[facilityType.id, facilityType]]),
			() => facilityType.id,
			() => worldEntity,
		);

		// Seed lastPulseTick so next tick pulses
		handle.setLastPulseTick(location.id, 5000);

		const goldEvents: GameEvent[] = [];
		const pulseEvents: GameEvent[] = [];
		const eventBus = createEventBus();
		eventBus.on('GoldFlowed', e => { goldEvents.push(e); });
		eventBus.on('AreaEffectPulsed', e => { pulseEvents.push(e); });

		const walletBefore = worker.get(WalletComponent).state.gold;
		const treasuryBefore = worldEntity.get(EconomyComponent).state.treasury;
		const fundBefore = facilityActor.get(FacilityComponent).state.fund;

		handle.system.execute(createDeps(eventBus, 5030));

		// Wage 4, tax 10% → net 3.6, tax 0.4
		// Treasury: -4 (wage) + 0.4 (tax) = net -3.6
		expect(worldEntity.get(EconomyComponent).state.treasury).toBeCloseTo(treasuryBefore - 4 + 0.4);
		expect(worker.get(WalletComponent).state.gold).toBeCloseTo(walletBefore + 3.6);
		expect(facilityActor.get(FacilityComponent).state.fund).toBe(fundBefore);

		const publicWage = goldEvents.find(e => (e.payload as { subcategory?: string }).subcategory === 'public_wage');
		expect(publicWage).toBeDefined();
		expect((publicWage?.payload as { amount: number }).amount).toBeCloseTo(3.6);
		expect((publicWage?.payload as { fromEntity: string }).fromEntity).toBe('treasury');
		expect((publicWage?.payload as { toEntity: string }).toEntity).toBe('worker-1');

		const tax = goldEvents.find(e => (e.payload as { subcategory?: string }).subcategory === 'tax');
		expect(tax).toBeDefined();
		expect((tax?.payload as { amount: number }).amount).toBeCloseTo(0.4);

		expect(pulseEvents).toHaveLength(1);
		expect((pulseEvents[0]?.payload as { facilityId: string }).facilityId).toBe(location.id);
	});

	it('facility-funded pulse: facility fund drains by wage, worker paid net, wage subcategory', () => {
		const facilityType = createGuardPostType({ funding: 'facility', default_wage: 4 });
		const location = createGuardPostLocation();
		const worker = createWorkerAgent(location.position.x, location.position.y);
		const bystander = createBystander('bystander-1', location.position.x, location.position.y);
		const facilityActor = createFacilityActor(200, worker.agentId);
		const worldEntity = createWorldEntity(1000);
		const agents = [worker, bystander];

		const handle = createAreaEffectSystem(
			() => agents,
			() => [location],
			() => new Map<string, Actor>([[location.id, facilityActor]]),
			() => new Map<string, FacilityType>([[facilityType.id, facilityType]]),
			() => facilityType.id,
			() => worldEntity,
		);

		handle.setLastPulseTick(location.id, 5000);

		const goldEvents: GameEvent[] = [];
		const eventBus = createEventBus();
		eventBus.on('GoldFlowed', e => { goldEvents.push(e); });

		const walletBefore = worker.get(WalletComponent).state.gold;
		const treasuryBefore = worldEntity.get(EconomyComponent).state.treasury;
		const fundBefore = facilityActor.get(FacilityComponent).state.fund;

		handle.system.execute(createDeps(eventBus, 5030));

		expect(facilityActor.get(FacilityComponent).state.fund).toBe(fundBefore - 4);
		expect(worker.get(WalletComponent).state.gold).toBeCloseTo(walletBefore + 3.6);
		// Treasury gains only the tax portion
		expect(worldEntity.get(EconomyComponent).state.treasury).toBeCloseTo(treasuryBefore + 0.4);

		const wage = goldEvents.find(e => (e.payload as { subcategory?: string }).subcategory === 'wage');
		expect(wage).toBeDefined();
		expect((wage?.payload as { fromEntity: string }).fromEntity).toBe(location.id);
	});

	it('agents outside the radius are not affected', () => {
		const facilityType = createGuardPostType({ radius: 10 });
		const location = createGuardPostLocation('loc-guardpost', 100, 100);
		const worker = createWorkerAgent(location.position.x, location.position.y);
		const insideAgent = createBystander('inside', 105, 100);
		const outsideAgent = createBystander('outside', 200, 200);
		const facilityActor = createFacilityActor(200, worker.agentId);
		const worldEntity = createWorldEntity(1000);
		const agents = [worker, insideAgent, outsideAgent];

		const handle = createAreaEffectSystem(
			() => agents,
			() => [location],
			() => new Map<string, Actor>([[location.id, facilityActor]]),
			() => new Map<string, FacilityType>([[facilityType.id, facilityType]]),
			() => facilityType.id,
			() => worldEntity,
		);

		handle.setLastPulseTick(location.id, 5000);
		handle.system.execute(createDeps(createEventBus(), 5030));

		expect(handle.getPending('inside')).toHaveLength(1);
		expect(handle.getPending('outside')).toHaveLength(0);
	});

	it('clearPending removes all queued modifiers for an agent', () => {
		const facilityType = createGuardPostType();
		const location = createGuardPostLocation();
		const worker = createWorkerAgent(location.position.x, location.position.y);
		const bystander = createBystander('bystander-1', location.position.x, location.position.y);
		const facilityActor = createFacilityActor(200, worker.agentId);
		const worldEntity = createWorldEntity(1000);
		const agents = [worker, bystander];

		const handle = createAreaEffectSystem(
			() => agents,
			() => [location],
			() => new Map<string, Actor>([[location.id, facilityActor]]),
			() => new Map<string, FacilityType>([[facilityType.id, facilityType]]),
			() => facilityType.id,
			() => worldEntity,
		);

		handle.setLastPulseTick(location.id, 5000);
		handle.system.execute(createDeps(createEventBus(), 5030));
		expect(handle.getPending(bystander.agentId)).toHaveLength(1);

		handle.clearPending(bystander.agentId);
		expect(handle.getPending(bystander.agentId)).toHaveLength(0);
	});

	it('system name is AreaEffectSystem and factory returns a valid GameSystem handle', () => {
		const facilityType = createGuardPostType();
		const location = createGuardPostLocation();
		const worldEntity = createWorldEntity(1000);
		const handle = createAreaEffectSystem(
			() => [],
			() => [location],
			() => new Map<string, Actor>(),
			() => new Map<string, FacilityType>([[facilityType.id, facilityType]]),
			() => facilityType.id,
			() => worldEntity,
		);
		expect(handle.system.name).toBe('AreaEffectSystem');
		expect(typeof handle.system.execute).toBe('function');
	});
});
