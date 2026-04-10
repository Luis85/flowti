import { describe, it, expect } from 'vitest';
import { createRestSystem } from '../../../src/infrastructure/systems/rest-system.js';
import { AgentActor } from '../../../src/infrastructure/entity/agent-actor.js';
import { NeedsComponent } from '../../../src/infrastructure/components/needs-component.js';
import { WalletComponent } from '../../../src/infrastructure/components/wallet-component.js';
import { EconomyComponent } from '../../../src/infrastructure/components/economy-component.js';
import { FacilityComponent } from '../../../src/infrastructure/components/facility-component.js';
import { GameConfigSchema } from '../../../src/domain/schemas/game-config-schema.js';
import { createPerformanceTracker } from '../../../src/infrastructure/performance/performance-tracker.js';
import { createEventBus } from '../../../src/infrastructure/event-bus.js';
import type { GameCoreDeps } from '../../../src/domain/core/game-deps.js';
import type { GameEvent } from '../../../src/domain/core/events.js';
import type { WorldLocation } from '../../../src/domain/schemas/location-schema.js';
import { Actor } from 'excalibur';
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

function createRestLocation(id: string, x: number, y: number): WorldLocation {
	return { id, name: id, type: 'rest', position: { x, y, region: 'test' }, capacity: 8, color: '#6a5acd' };
}

function createWorldEntity(): Actor {
	const entity = new Actor();
	entity.addComponent(new EconomyComponent({
		treasury: 500, ledger: [], dailySummary: { totalWages: 0, totalTax: 0, totalSales: 0, totalConsumption: 0, avgWage: 0, wageSpread: 0, vacancyCount: 0, unemploymentCount: 0, jobSwitchesThisDay: 0, supplyDeliveries: 0, questsCompletedThisDay: 0 },
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

describe('RestSystem', () => {
	it('applies public_shelter recovery when agent is at unowned rest location', () => {
		const eventBus = createEventBus();
		const events: GameEvent[] = [];
		eventBus.on('RestStarted', (e) => { events.push(e); });

		const agent = new AgentActor(createTestAgentData('agent-1', 300, 200), defaultMoodConfig);
		agent.behaviorAgent = createStubBehaviorAgent();
		const restLoc = createRestLocation('loc-tavern', 300, 200);
		const worldEntity = createWorldEntity();

		const system = createRestSystem(() => [agent], () => [restLoc], () => worldEntity);
		system.execute(createDeps(eventBus));

		const needs = agent.get(NeedsComponent);
		expect(needs.state.energy).toBeCloseTo(53.0);

		expect(events.length).toBe(1);
		expect(events[0]?.payload.agentId).toBe('agent-1');
		expect(events[0]?.payload.tier).toBe('public_shelter');
		expect(events[0]?.payload.locationId).toBe('loc-tavern');
	});

	it('applies owned_home recovery when agent owns the rest location', () => {
		const eventBus = createEventBus();
		const events: GameEvent[] = [];
		eventBus.on('RestStarted', (e) => { events.push(e); });

		const agent = new AgentActor(
			createTestAgentData('agent-1', 300, 200, { property: ['loc-tavern'] }),
			defaultMoodConfig,
		);
		agent.behaviorAgent = createStubBehaviorAgent();
		const restLoc = createRestLocation('loc-tavern', 300, 200);
		const worldEntity = createWorldEntity();

		const system = createRestSystem(() => [agent], () => [restLoc], () => worldEntity);
		system.execute(createDeps(eventBus));

		const needs = agent.get(NeedsComponent);
		expect(needs.state.energy).toBeCloseTo(54.0);

		expect(events.length).toBe(1);
		expect(events[0]?.payload.tier).toBe('owned_home');
	});

	it('applies outdoors recovery when agent is idle with no rest location nearby', () => {
		const eventBus = createEventBus();
		const events: GameEvent[] = [];
		eventBus.on('RestStarted', (e) => { events.push(e); });

		const agent = new AgentActor(createTestAgentData('agent-1', 0, 0), defaultMoodConfig);
		agent.behaviorAgent = createStubBehaviorAgent();
		const worldEntity = createWorldEntity();

		const system = createRestSystem(() => [agent], () => [], () => worldEntity);
		system.execute(createDeps(eventBus));

		const needs = agent.get(NeedsComponent);
		expect(needs.state.energy).toBeCloseTo(51.5);

		expect(events.length).toBe(1);
		expect(events[0]?.payload.tier).toBe('outdoors');
		expect(events[0]?.payload.locationId).toBeNull();
	});

	it('skips agent with non-idle btAction and no rest location nearby', () => {
		const eventBus = createEventBus();
		const events: GameEvent[] = [];
		eventBus.on('RestStarted', (e) => { events.push(e); });

		const agent = new AgentActor(createTestAgentData('agent-1', 0, 0), defaultMoodConfig);
		agent.behaviorAgent = createStubBehaviorAgent({ btAction: 'seek_food' });
		const worldEntity = createWorldEntity();

		const system = createRestSystem(() => [agent], () => [], () => worldEntity);
		system.execute(createDeps(eventBus));

		const needs = agent.get(NeedsComponent);
		expect(needs.state.energy).toBe(50);

		expect(events.length).toBe(0);
	});

	it('does not emit RestStarted on second tick at same location', () => {
		const eventBus = createEventBus();
		const events: GameEvent[] = [];
		eventBus.on('RestStarted', (e) => { events.push(e); });

		const agent = new AgentActor(createTestAgentData('agent-1', 300, 200), defaultMoodConfig);
		agent.behaviorAgent = createStubBehaviorAgent();
		const restLoc = createRestLocation('loc-tavern', 300, 200);
		const worldEntity = createWorldEntity();

		const system = createRestSystem(() => [agent], () => [restLoc], () => worldEntity);

		system.execute(createDeps(eventBus, 1));
		expect(events.length).toBe(1);

		system.execute(createDeps(eventBus, 2));
		expect(events.length).toBe(1);

		const needs = agent.get(NeedsComponent);
		expect(needs.state.energy).toBeCloseTo(56.0); // 2 ticks of public_shelter at 3.0/tick
	});

	it('clears restingAt when agent leaves rest location and re-emits on return', () => {
		const eventBus = createEventBus();
		const events: GameEvent[] = [];
		eventBus.on('RestStarted', (e) => { events.push(e); });

		const agent = new AgentActor(createTestAgentData('agent-1', 200, 200), defaultMoodConfig);
		agent.behaviorAgent = createStubBehaviorAgent({ btAction: 'rest' });

		const restLoc = createRestLocation('loc-tavern', 200, 200);
		const worldEntity = createWorldEntity();
		const system = createRestSystem(() => [agent], () => [restLoc], () => worldEntity);
		const deps = createDeps(eventBus);

		system.execute(deps);
		expect(events.length).toBe(1);

		// Move agent away (outside interaction radius)
		agent.pos.x = 500;
		agent.pos.y = 500;
		system.execute(deps);

		// Move agent back to rest location
		agent.pos.x = 200;
		agent.pos.y = 200;
		events.length = 0;
		system.execute(deps);
		expect(events.length).toBe(1);
	});

	it('skips rest for agent with non-rest btAction near a rest location', () => {
		const agent = new AgentActor(createTestAgentData('agent-1', 300, 200), defaultMoodConfig);
		agent.behaviorAgent = createStubBehaviorAgent({ btAction: 'seek_food' });

		const restLoc = createRestLocation('loc-tavern', 300, 200);
		const worldEntity = createWorldEntity();
		const system = createRestSystem(() => [agent], () => [restLoc], () => worldEntity);
		system.execute(createDeps());

		const needs = agent.get(NeedsComponent);
		expect(needs.state.energy).toBe(50);
	});

	it('emits RestStarted again when agent moves to a different rest location', () => {
		const eventBus = createEventBus();
		const events: GameEvent[] = [];
		eventBus.on('RestStarted', (e) => { events.push(e); });

		const agent = new AgentActor(createTestAgentData('agent-1', 300, 200), defaultMoodConfig);
		agent.behaviorAgent = createStubBehaviorAgent();
		const restLoc1 = createRestLocation('loc-tavern', 300, 200);
		const restLoc2 = createRestLocation('loc-inn', 500, 500);
		const worldEntity = createWorldEntity();

		const system1 = createRestSystem(() => [agent], () => [restLoc1], () => worldEntity);
		system1.execute(createDeps(eventBus, 1));
		expect(events.length).toBe(1);
		expect(events[0]?.payload.locationId).toBe('loc-tavern');

		agent.pos.x = 500;
		agent.pos.y = 500;

		const system2 = createRestSystem(() => [agent], () => [restLoc2], () => worldEntity);
		system2.execute(createDeps(eventBus, 2));
		expect(events.length).toBe(2);
		expect(events[1]?.payload.locationId).toBe('loc-inn');
	});

	it('downgrades to outdoors when agent cannot afford public shelter', () => {
		const eventBus = createEventBus();
		const events: GameEvent[] = [];
		eventBus.on('RestStarted', (e) => { events.push(e); });

		const agent = new AgentActor(
			createTestAgentData('agent-1', 300, 200, { wallet: { gold: 0 } }),
			defaultMoodConfig,
		);
		agent.behaviorAgent = createStubBehaviorAgent();
		const restLoc = createRestLocation('loc-tavern', 300, 200);
		const worldEntity = createWorldEntity();

		const system = createRestSystem(() => [agent], () => [restLoc], () => worldEntity);
		system.execute(createDeps(eventBus));

		const needs = agent.get(NeedsComponent);
		expect(needs.state.energy).toBeCloseTo(51.5);

		expect(events.length).toBe(1);
		expect(events[0]?.payload.tier).toBe('outdoors');
	});

	it('deducts gold on public shelter entry', () => {
		const agent = new AgentActor(createTestAgentData('agent-1', 300, 200), defaultMoodConfig);
		agent.behaviorAgent = createStubBehaviorAgent();
		const restLoc = createRestLocation('loc-tavern', 300, 200);
		const worldEntity = createWorldEntity();

		const system = createRestSystem(() => [agent], () => [restLoc], () => worldEntity);
		system.execute(createDeps());

		const wallet = agent.get(WalletComponent);
		expect(wallet.state.gold).toBe(49);

		const economy = worldEntity.get(EconomyComponent);
		expect(economy.state.ledger).toHaveLength(1);
		expect(economy.state.ledger[0].type).toBe('purchase');
		expect(economy.state.ledger[0].gold).toBe(1);
	});

	it('credits tavern FacilityComponent fund when agent pays for public shelter', () => {
		const agent = new AgentActor(createTestAgentData('agent-1', 300, 200), defaultMoodConfig);
		agent.behaviorAgent = createStubBehaviorAgent();
		const restLoc = createRestLocation('loc-tavern', 300, 200);
		const worldEntity = createWorldEntity();

		// Create a location actor with a FacilityComponent
		const tavernActor = new Actor();
		tavernActor.addComponent(new FacilityComponent({
			stock: [],
			fund: 100,
			workProgress: 0,
			status: 'idle',
			workerId: null,
		}));
		const locationActors = new Map<string, Actor>([['loc-tavern', tavernActor]]);

		const system = createRestSystem(
			() => [agent],
			() => [restLoc],
			() => worldEntity,
			() => locationActors,
		);
		system.execute(createDeps());

		const facility = tavernActor.get(FacilityComponent);
		expect(facility.state.fund).toBe(101); // 100 + rest_price (1)
		expect(facility.dirty).toBe(true);
	});

	it('emits GoldFlowed event on public shelter payment', () => {
		const eventBus = createEventBus();
		const events: GameEvent[] = [];
		eventBus.on('GoldFlowed', (e) => { events.push(e); });

		const agent = new AgentActor(createTestAgentData('agent-1', 300, 200), defaultMoodConfig);
		agent.behaviorAgent = createStubBehaviorAgent();
		const restLoc = createRestLocation('loc-tavern', 300, 200);
		const worldEntity = createWorldEntity();

		const system = createRestSystem(() => [agent], () => [restLoc], () => worldEntity);
		system.execute(createDeps(eventBus));

		expect(events.length).toBe(1);
		expect(events[0]?.payload.subcategory).toBe('rest');
		expect(events[0]?.payload.amount).toBe(1);
		expect(events[0]?.payload.fromEntity).toBe('agent-1');
		expect(events[0]?.payload.toEntity).toBe('loc-tavern');
	});

	it('applies rest when energy is zero (edge case)', () => {
		const eventBus = createEventBus();

		const agent = new AgentActor(
			createTestAgentData('agent-1', 0, 0, { needs: { hunger: 50, energy: 0, social: 50, thirst: 50 } }),
			defaultMoodConfig,
		);
		agent.behaviorAgent = createStubBehaviorAgent();
		const worldEntity = createWorldEntity();

		// No rest location — outdoors fallback (recovery_rate = 1.5)
		const system = createRestSystem(() => [agent], () => [], () => worldEntity);
		system.execute(createDeps(eventBus));

		const needs = agent.get(NeedsComponent);
		expect(needs.state.energy).toBeCloseTo(1.5); // 0 + 1.5 outdoors recovery
	});

	it('energy does not exceed 100 when resting at owned home with high energy', () => {
		const eventBus = createEventBus();

		const agent = new AgentActor(
			createTestAgentData('agent-1', 300, 200, {
				needs: { hunger: 50, energy: 99.5, social: 50, thirst: 50 },
				property: ['loc-tavern'],
			}),
			defaultMoodConfig,
		);
		agent.behaviorAgent = createStubBehaviorAgent();
		const restLoc = createRestLocation('loc-tavern', 300, 200);
		const worldEntity = createWorldEntity();

		const system = createRestSystem(() => [agent], () => [restLoc], () => worldEntity);
		system.execute(createDeps(eventBus));

		const needs = agent.get(NeedsComponent);
		// owned_home recovery_rate=4.0, 99.5 + 4.0 = 103.5, clamped to 100
		expect(needs.state.energy).toBe(100);
	});

	it('does not deduct gold more than once per shelter stay', () => {
		const eventBus = createEventBus();

		const agent = new AgentActor(createTestAgentData('agent-1', 300, 200), defaultMoodConfig);
		agent.behaviorAgent = createStubBehaviorAgent();
		const restLoc = createRestLocation('loc-tavern', 300, 200);
		const worldEntity = createWorldEntity();

		const system = createRestSystem(() => [agent], () => [restLoc], () => worldEntity);

		// First tick — should deduct gold
		system.execute(createDeps(eventBus, 1));
		const walletAfterFirst = agent.get(WalletComponent).state.gold;
		expect(walletAfterFirst).toBe(49);

		// Second tick at same location — should NOT deduct again
		system.execute(createDeps(eventBus, 2));
		const walletAfterSecond = agent.get(WalletComponent).state.gold;
		expect(walletAfterSecond).toBe(49); // unchanged
	});

	it('outdoor rest fallback when rest location exists but agent is too far', () => {
		const eventBus = createEventBus();
		const events: GameEvent[] = [];
		eventBus.on('RestStarted', (e) => { events.push(e); });

		const agent = new AgentActor(createTestAgentData('agent-1', 0, 0), defaultMoodConfig);
		agent.behaviorAgent = createStubBehaviorAgent();
		// Rest location is at 1000,1000 — far beyond interaction_radius (default 25)
		const restLoc = createRestLocation('loc-tavern', 1000, 1000);
		const worldEntity = createWorldEntity();

		const system = createRestSystem(() => [agent], () => [restLoc], () => worldEntity);
		system.execute(createDeps(eventBus));

		const needs = agent.get(NeedsComponent);
		// Outdoors tier, recovery_rate = 1.5
		expect(needs.state.energy).toBeCloseTo(51.5);

		expect(events.length).toBe(1);
		expect(events[0]?.payload.tier).toBe('outdoors');
		expect(events[0]?.payload.locationId).toBeNull();
	});

	it('rest tier recovery rates differ across all three tiers', () => {
		// Verify the three different recovery rates produce different energy gains
		const makeAgent = (id: string, x: number, y: number, overrides: Record<string, unknown> = {}) => {
			const agent = new AgentActor(
				createTestAgentData(id, x, y, { needs: { hunger: 50, energy: 50, social: 50, thirst: 50 }, ...overrides }),
				defaultMoodConfig,
			);
			agent.behaviorAgent = createStubBehaviorAgent();
			return agent;
		};

		// Owned home agent
		const homeAgent = makeAgent('home', 300, 200, { property: ['loc-tavern'] });
		// Public shelter agent
		const shelterAgent = makeAgent('shelter', 300, 200);
		// Outdoors agent (far from rest)
		const outdoorsAgent = makeAgent('outdoors', 0, 0);

		const restLoc = createRestLocation('loc-tavern', 300, 200);
		const worldEntity = createWorldEntity();

		const system1 = createRestSystem(() => [homeAgent], () => [restLoc], () => worldEntity);
		system1.execute(createDeps());
		const homeEnergy = homeAgent.get(NeedsComponent).state.energy;

		const worldEntity2 = createWorldEntity();
		const system2 = createRestSystem(() => [shelterAgent], () => [restLoc], () => worldEntity2);
		system2.execute(createDeps());
		const shelterEnergy = shelterAgent.get(NeedsComponent).state.energy;

		const worldEntity3 = createWorldEntity();
		const system3 = createRestSystem(() => [outdoorsAgent], () => [], () => worldEntity3);
		system3.execute(createDeps());
		const outdoorsEnergy = outdoorsAgent.get(NeedsComponent).state.energy;

		// owned_home (4.0) > public_shelter (3.0) > outdoors (1.5)
		expect(homeEnergy).toBeGreaterThan(shelterEnergy);
		expect(shelterEnergy).toBeGreaterThan(outdoorsEnergy);
		expect(homeEnergy).toBeCloseTo(54.0);
		expect(shelterEnergy).toBeCloseTo(53.0);
		expect(outdoorsEnergy).toBeCloseTo(51.5);
	});

	it('clears restingAt when agent starts working (non-rest btAction)', () => {
		const eventBus = createEventBus();

		const agent = new AgentActor(createTestAgentData('agent-1', 300, 200), defaultMoodConfig);
		agent.behaviorAgent = createStubBehaviorAgent({ btAction: 'rest' });
		const restLoc = createRestLocation('loc-tavern', 300, 200);
		const worldEntity = createWorldEntity();

		const system = createRestSystem(() => [agent], () => [restLoc], () => worldEntity);

		// First tick — agent rests
		system.execute(createDeps(eventBus, 1));
		expect(agent.behaviorAgent.restingAt).toBe('loc-tavern');

		// Agent starts working — btAction changes to 'work'
		agent.behaviorAgent.btAction = 'work';
		system.execute(createDeps(eventBus, 2));

		// restingAt should be cleared since btAction is not rest-compatible
		expect(agent.behaviorAgent.restingAt).toBeNull();
	});
});
