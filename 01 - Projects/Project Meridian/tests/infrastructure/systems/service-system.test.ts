import { describe, it, expect } from 'vitest';
import { Actor } from 'excalibur';
import { createServiceSystem, type ServiceSystemHandle } from '../../../src/infrastructure/systems/service-system.js';
import { AgentActor } from '../../../src/infrastructure/entity/agent-actor.js';
import { NeedsComponent } from '../../../src/infrastructure/components/needs-component.js';
import { WalletComponent } from '../../../src/infrastructure/components/wallet-component.js';
import { MemoryComponent } from '../../../src/infrastructure/components/memory-component.js';
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

function createBathhouseLocation(): WorldLocation {
	return {
		id: 'loc-bathhouse',
		name: 'Bathhouse',
		type: 'leisure',
		position: { x: 100, y: 100, region: 'test' },
		capacity: 10,
		color: '#7db2ff',
		production: null,
		leisure: null,
		region: null,
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

interface Fixture {
	agent: AgentActor;
	worker: AgentActor | null;
	facility: FacilityComponent;
	facilityActor: Actor;
	facilityType: Extract<FacilityType, { kind: 'service' }>;
	location: WorldLocation;
	worldEntity: Actor;
	handle: ServiceSystemHandle;
	allAgents: AgentActor[];
}

function buildFixture(options: {
	withWorker?: boolean;
	workerBtAction?: string | null;
	workerJob?: string | null;
	fund?: number;
	facilityTypeOverrides?: Partial<Record<string, unknown>>;
	extraAgents?: AgentActor[];
} = {}): Fixture {
	const facilityType = createBathhouseType(options.facilityTypeOverrides);
	const location = createBathhouseLocation();

	let worker: AgentActor | null = null;
	if (options.withWorker === true) {
		worker = new AgentActor(
			createTestAgentData('worker-1', location.position.x, location.position.y, {
				job: options.workerJob ?? 'bathhouse_keeper',
			}),
			defaultMoodConfig,
		);
		worker.behaviorAgent = createStubBehaviorAgent({
			btAction: options.workerBtAction ?? 'work',
			job: options.workerJob ?? 'bathhouse_keeper',
		});
	}

	const customer = new AgentActor(
		createTestAgentData('customer-1', location.position.x, location.position.y),
		defaultMoodConfig,
	);
	customer.behaviorAgent = createStubBehaviorAgent({
		btAction: 'use_service',
		atLocation: location.id,
		insideFacility: true,
	});

	const facilityActor = createFacilityActor(options.fund ?? 200, worker?.agentId ?? null);
	const facility = facilityActor.get(FacilityComponent);
	const worldEntity = createWorldEntity();

	const allAgents: AgentActor[] = [customer];
	if (worker !== null) allAgents.push(worker);
	if (options.extraAgents !== undefined) allAgents.push(...options.extraAgents);

	const handle = createServiceSystem(
		() => allAgents,
		() => [location],
		() => new Map<string, Actor>([[location.id, facilityActor]]),
		() => worldEntity,
		() => new Map<string, FacilityType>([[facilityType.id, facilityType]]),
		() => facilityType.id,
	);

	return {
		agent: customer,
		worker,
		facility,
		facilityActor,
		facilityType,
		location,
		worldEntity,
		handle,
		allAgents,
	};
}

describe('ServiceSystem', () => {
	it('staffed visit: effects applied when visit completes', () => {
		const fx = buildFixture({ withWorker: true });
		fx.handle.startVisit(fx.agent.agentId, {
			facilityId: fx.location.id,
			ticksRemaining: 3,
			costPaid: true,
		});

		const events: GameEvent[] = [];
		const eventBus = createEventBus();
		eventBus.on('ServiceDelivered', e => { events.push(e); });

		// Tick 1: 3 -> 2
		fx.handle.system.execute(createDeps(eventBus, 1));
		expect(fx.handle.getVisit(fx.agent.agentId)?.ticksRemaining).toBe(2);
		expect(events).toHaveLength(0);

		// Tick 2: 2 -> 1
		fx.handle.system.execute(createDeps(eventBus, 2));
		expect(fx.handle.getVisit(fx.agent.agentId)?.ticksRemaining).toBe(1);
		expect(events).toHaveLength(0);

		// Tick 3: 1 -> 0 → complete
		fx.handle.system.execute(createDeps(eventBus, 3));
		expect(fx.handle.getVisit(fx.agent.agentId)).toBeUndefined();
		expect(fx.agent.behaviorAgent.insideFacility).toBe(false);

		expect(events).toHaveLength(1);
		expect(events[0]?.payload.agentId).toBe('customer-1');
		expect(events[0]?.payload.facilityId).toBe('loc-bathhouse');
		expect(events[0]?.payload.staffed).toBe(true);

		// Staffed effects: energy +10, social +5, mood +20 (memory)
		const needs = fx.agent.get(NeedsComponent);
		expect(needs.state.energy).toBe(60); // 50 + 10
		expect(needs.state.social).toBe(45); // 40 + 5

		const mem = fx.agent.get(MemoryComponent);
		const serviceMemory = mem.state.entries.find(e => e.type === 'service_loc-bathhouse');
		expect(serviceMemory).toBeDefined();
		expect(serviceMemory?.outcome).toBe('positive');
		expect(serviceMemory?.mood_impact).toBe(20);
	});

	it('unstaffed visit: degraded effects applied, no wage paid', () => {
		const fx = buildFixture({ withWorker: false });
		fx.handle.startVisit(fx.agent.agentId, {
			facilityId: fx.location.id,
			ticksRemaining: 1,
			costPaid: true,
		});

		const fundBefore = fx.facility.state.fund;

		fx.handle.system.execute(createDeps(createEventBus(), 1));

		// Unstaffed effects: energy +2, mood +5
		const needs = fx.agent.get(NeedsComponent);
		expect(needs.state.energy).toBe(52); // 50 + 2
		expect(needs.state.social).toBe(40); // unchanged — unstaffed social is 0

		const mem = fx.agent.get(MemoryComponent);
		const serviceMemory = mem.state.entries.find(e => e.type === 'service_loc-bathhouse');
		expect(serviceMemory?.mood_impact).toBe(5);

		// Fund unchanged (no worker to pay)
		expect(fx.facility.state.fund).toBe(fundBefore);
	});

	it('worker earns hourly wage while btAction === work', () => {
		const fx = buildFixture({ withWorker: true, fund: 100 });
		const workerWallet = fx.worker!.get(WalletComponent);
		const walletBefore = workerWallet.state.gold;
		const fundBefore = fx.facility.state.fund;
		const economyBefore = fx.worldEntity.get(EconomyComponent).state.treasury;

		const goldEvents: GameEvent[] = [];
		const eventBus = createEventBus();
		eventBus.on('GoldFlowed', e => { goldEvents.push(e); });

		fx.handle.system.execute(createDeps(eventBus, 1));

		// Default wage 4, tax 10% → net 3.6, tax 0.4
		expect(workerWallet.state.gold).toBeCloseTo(walletBefore + 3.6);
		expect(fx.facility.state.fund).toBe(fundBefore - 4);
		expect(fx.worldEntity.get(EconomyComponent).state.treasury).toBeCloseTo(economyBefore + 0.4);

		const wageFlow = goldEvents.find(e => e.payload.subcategory === 'wage');
		expect(wageFlow).toBeDefined();
		expect(wageFlow?.payload.amount).toBeCloseTo(3.6);
		expect(wageFlow?.payload.fromEntity).toBe('loc-bathhouse');
		expect(wageFlow?.payload.toEntity).toBe('worker-1');

		const taxFlow = goldEvents.find(e => e.payload.subcategory === 'tax');
		expect(taxFlow).toBeDefined();
		expect(taxFlow?.payload.amount).toBeCloseTo(0.4);
	});

	it('worker with btAction === seek_work earns nothing (findWorker returns undefined)', () => {
		const fx = buildFixture({ withWorker: true, workerBtAction: 'seek_work', fund: 100 });
		const workerWallet = fx.worker!.get(WalletComponent);
		const walletBefore = workerWallet.state.gold;
		const fundBefore = fx.facility.state.fund;

		fx.handle.system.execute(createDeps(createEventBus(), 1));

		expect(workerWallet.state.gold).toBe(walletBefore);
		expect(fx.facility.state.fund).toBe(fundBefore);
	});

	it('fund depletion: subsequent ticks pay no wage and fund stays non-negative', () => {
		// Fund starts at 6 → first tick pays 4 (leaves 2), second tick skips (2 < 4)
		const fx = buildFixture({ withWorker: true, fund: 6 });
		const workerWallet = fx.worker!.get(WalletComponent);

		fx.handle.system.execute(createDeps(createEventBus(), 1));
		expect(fx.facility.state.fund).toBe(2);
		const afterFirst = workerWallet.state.gold;

		fx.handle.system.execute(createDeps(createEventBus(), 2));
		expect(fx.facility.state.fund).toBe(2); // unchanged — wage skipped
		expect(workerWallet.state.gold).toBe(afterFirst);

		fx.handle.system.execute(createDeps(createEventBus(), 3));
		expect(fx.facility.state.fund).toBe(2); // still unchanged
	});

	it('multiple simultaneous visitors tick down independently', () => {
		const fx = buildFixture({ withWorker: true });
		const second = new AgentActor(
			createTestAgentData('customer-2', fx.location.position.x, fx.location.position.y),
			defaultMoodConfig,
		);
		second.behaviorAgent = createStubBehaviorAgent({
			btAction: 'use_service',
			atLocation: fx.location.id,
			insideFacility: true,
		});
		fx.allAgents.push(second);

		fx.handle.startVisit('customer-1', { facilityId: fx.location.id, ticksRemaining: 3, costPaid: true });
		fx.handle.startVisit('customer-2', { facilityId: fx.location.id, ticksRemaining: 2, costPaid: true });

		const events: GameEvent[] = [];
		const eventBus = createEventBus();
		eventBus.on('ServiceDelivered', e => { events.push(e); });

		// Tick 1
		fx.handle.system.execute(createDeps(eventBus, 1));
		expect(fx.handle.getVisit('customer-1')?.ticksRemaining).toBe(2);
		expect(fx.handle.getVisit('customer-2')?.ticksRemaining).toBe(1);

		// Tick 2 → customer-2 completes
		fx.handle.system.execute(createDeps(eventBus, 2));
		expect(fx.handle.getVisit('customer-1')?.ticksRemaining).toBe(1);
		expect(fx.handle.getVisit('customer-2')).toBeUndefined();
		expect(events).toHaveLength(1);
		expect(events[0]?.payload.agentId).toBe('customer-2');

		// Tick 3 → customer-1 completes
		fx.handle.system.execute(createDeps(eventBus, 3));
		expect(fx.handle.getVisit('customer-1')).toBeUndefined();
		expect(events).toHaveLength(2);
		expect(events[1]?.payload.agentId).toBe('customer-1');
	});

	it('orphan guard: btAction !== use_service clears visit with no effects and no ServiceDelivered event', () => {
		const fx = buildFixture({ withWorker: false });
		fx.agent.behaviorAgent.btAction = 'wander'; // not use_service
		fx.handle.startVisit(fx.agent.agentId, {
			facilityId: fx.location.id,
			ticksRemaining: 1,
			costPaid: true,
		});

		const events: GameEvent[] = [];
		const eventBus = createEventBus();
		eventBus.on('ServiceDelivered', e => { events.push(e); });
		eventBus.on('GoldFlowed', e => { events.push(e); });

		const needsBefore = fx.agent.get(NeedsComponent).state;
		const memBefore = fx.agent.get(MemoryComponent).state.entries.length;

		fx.handle.system.execute(createDeps(eventBus, 1));

		expect(fx.handle.getVisit(fx.agent.agentId)).toBeUndefined();
		expect(fx.agent.behaviorAgent.insideFacility).toBe(false);
		expect(fx.agent.get(NeedsComponent).state).toEqual(needsBefore);
		expect(fx.agent.get(MemoryComponent).state.entries.length).toBe(memBefore);
		expect(events).toHaveLength(0);
	});

	it('treasury funding: treasury drains by wage, worker paid net, GoldFlowed uses public_wage subcategory', () => {
		const fx = buildFixture({
			withWorker: true,
			fund: 100,
			facilityTypeOverrides: { funding: 'treasury', default_wage: 4 },
		});
		const workerWallet = fx.worker!.get(WalletComponent);
		const walletBefore = workerWallet.state.gold;
		const fundBefore = fx.facility.state.fund;
		const treasuryBefore = fx.worldEntity.get(EconomyComponent).state.treasury;

		const goldEvents: GameEvent[] = [];
		const eventBus = createEventBus();
		eventBus.on('GoldFlowed', e => { goldEvents.push(e); });

		fx.handle.system.execute(createDeps(eventBus, 1));

		// wage 4, tax_base_rate 0.10 → net 3.6, tax 0.4
		// Treasury: -4 (wage) +0.4 (tax) = net -3.6
		expect(fx.worldEntity.get(EconomyComponent).state.treasury).toBeCloseTo(treasuryBefore - 4 + 0.4);
		expect(workerWallet.state.gold).toBeCloseTo(walletBefore + 3.6);
		// Facility fund must be untouched under treasury funding
		expect(fx.facility.state.fund).toBe(fundBefore);

		const publicWageFlow = goldEvents.find(e => e.payload.subcategory === 'public_wage');
		expect(publicWageFlow).toBeDefined();
		expect(publicWageFlow?.payload.amount).toBeCloseTo(3.6);
		expect(publicWageFlow?.payload.fromEntity).toBe('treasury');
		expect(publicWageFlow?.payload.toEntity).toBe('worker-1');

		// No plain 'wage' subcategory should have been emitted under treasury funding
		const plainWageFlow = goldEvents.find(e => e.payload.subcategory === 'wage');
		expect(plainWageFlow).toBeUndefined();

		const taxFlow = goldEvents.find(e => e.payload.subcategory === 'tax');
		expect(taxFlow).toBeDefined();
		expect(taxFlow?.payload.amount).toBeCloseTo(0.4);
		expect(taxFlow?.payload.fromEntity).toBe('treasury');
	});

	it('orphan guard: insideFacility === false clears visit even when btAction and atLocation match', () => {
		const fx = buildFixture({ withWorker: false });
		fx.handle.startVisit(fx.agent.agentId, {
			facilityId: fx.location.id,
			ticksRemaining: 1,
			costPaid: true,
		});
		// btAction and atLocation remain valid — only insideFacility is wrong
		fx.agent.behaviorAgent.insideFacility = false;
		expect(fx.agent.behaviorAgent.btAction).toBe('use_service');
		expect(fx.agent.behaviorAgent.atLocation).toBe(fx.location.id);

		const events: GameEvent[] = [];
		const eventBus = createEventBus();
		eventBus.on('ServiceDelivered', e => { events.push(e); });

		const needsBefore = { ...fx.agent.get(NeedsComponent).state };
		const memBefore = fx.agent.get(MemoryComponent).state.entries.length;

		fx.handle.system.execute(createDeps(eventBus, 1));

		expect(fx.handle.getVisit(fx.agent.agentId)).toBeUndefined();
		expect(fx.agent.get(NeedsComponent).state).toEqual(needsBefore);
		expect(fx.agent.get(MemoryComponent).state.entries.length).toBe(memBefore);
		expect(events).toHaveLength(0);
	});

	it('orphan guard: memory.atLocation !== facility.id clears visit', () => {
		const fx = buildFixture({ withWorker: false });
		fx.agent.behaviorAgent.atLocation = 'loc-somewhere-else';
		fx.handle.startVisit(fx.agent.agentId, {
			facilityId: fx.location.id,
			ticksRemaining: 1,
			costPaid: true,
		});

		const events: GameEvent[] = [];
		const eventBus = createEventBus();
		eventBus.on('ServiceDelivered', e => { events.push(e); });
		const needsBefore = fx.agent.get(NeedsComponent).state;

		fx.handle.system.execute(createDeps(eventBus, 1));

		expect(fx.handle.getVisit(fx.agent.agentId)).toBeUndefined();
		expect(fx.agent.get(NeedsComponent).state).toEqual(needsBefore);
		expect(events).toHaveLength(0);
	});

	it('cost_per_visit === 0: ServiceSystem never touches visitor wallet on completion', () => {
		// Represents Park/Market case where UseService paid 0 upfront — completion
		// should also be neutral on the wallet regardless of the cost config.
		const fx = buildFixture({
			withWorker: false,
			facilityTypeOverrides: { cost_per_visit: 0 },
		});
		fx.handle.startVisit(fx.agent.agentId, {
			facilityId: fx.location.id,
			ticksRemaining: 1,
			costPaid: false,
		});

		const walletBefore = fx.agent.get(WalletComponent).state.gold;
		fx.handle.system.execute(createDeps(createEventBus(), 1));
		expect(fx.agent.get(WalletComponent).state.gold).toBe(walletBefore);
		expect(fx.handle.getVisit(fx.agent.agentId)).toBeUndefined();
	});

	it('system is not registered automatically — factory returns handle only', () => {
		const fx = buildFixture({ withWorker: false });
		expect(fx.handle.system.name).toBe('ServiceSystem');
		expect(typeof fx.handle.system.execute).toBe('function');
	});
});
