import { describe, it, expect } from 'vitest';
import { Actor } from 'excalibur';
import { createMonetaryPolicySystem } from '../../../src/infrastructure/systems/monetary-policy-system.js';
import { AgentActor } from '../../../src/infrastructure/entity/agent-actor.js';
import { WalletComponent } from '../../../src/infrastructure/components/wallet-component.js';
import { EconomyComponent } from '../../../src/infrastructure/components/economy-component.js';
import { GameConfigSchema } from '../../../src/domain/schemas/game-config-schema.js';
import { createPerformanceTracker } from '../../../src/infrastructure/performance/performance-tracker.js';
import { createEventBus } from '../../../src/infrastructure/event-bus.js';
import type { GameCoreDeps } from '../../../src/domain/core/game-deps.js';
import type { GameEvent } from '../../../src/domain/core/events.js';
import type { BehaviorAgent } from '../../../src/domain/systems/behavior-agent.js';
import type { AgentActor as AgentActorType } from '../../../src/infrastructure/entity/agent-actor.js';

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

function createDeps(eventBus = createEventBus(), tickCount = 1): GameCoreDeps {
	return {
		logger: { debug() {}, info() {}, warn() {}, error() {} },
		eventBus,
		config: GameConfigSchema.parse({}),
		performanceTracker: createPerformanceTracker(),
		tickCount,
		writeFile: null,
		dataRoot: 'test-data',
		getRecipeRegistry: () => new Map(),
		getFacilityTypeRegistry: () => new Map(),
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

function createAgent(id: string, gold = 50): AgentActorType {
	const agent = new AgentActor(createTestAgentData(id, 0, 0, { wallet: { gold } }), defaultMoodConfig);
	agent.behaviorAgent = createStubBehaviorAgent();
	return agent;
}

function emitGoldFlowed(
	eventBus: ReturnType<typeof createEventBus>,
	tick: number,
	category: string,
	amount: number,
	extras: Record<string, unknown> = {},
): void {
	eventBus.emit({
		type: 'GoldFlowed',
		tick,
		wallClock: Date.now(),
		source: 'TestHarness',
		payload: { category, amount, ...extras },
	});
}

describe('MonetaryPolicySystem', () => {
	it('has correct system name and priority', () => {
		const system = createMonetaryPolicySystem(
			() => [],
			() => new Actor(),
		);

		expect(system.name).toBe('MonetaryPolicySystem');
		expect(system.priority).toBeDefined();
	});

	it('calculates monetary snapshot and updates economy component', () => {
		const eventBus = createEventBus();
		const agent = createAgent('agent-1', 100);
		const world = createWorldEntity(500);

		const system = createMonetaryPolicySystem(
			() => [agent],
			() => world,
		);

		system.execute(createDeps(eventBus, 1));

		const economy = world.get(EconomyComponent);
		expect(economy.state.monetarySnapshot).toBeDefined();
		expect(economy.state.monetarySnapshot!.moneySupply).toBe(600); // 100 agent + 500 treasury
		expect(economy.state.monetarySnapshot!.velocity).toBe(0); // No transfers
		expect(economy.state.monetarySnapshot!.faucetRate).toBe(0);
		expect(economy.state.monetarySnapshot!.sinkRate).toBe(0);
		expect(economy.state.monetarySnapshot!.netFlow).toBe(0);
	});

	it('marks economy component dirty after snapshot update', () => {
		const eventBus = createEventBus();
		const agent = createAgent('agent-1', 50);
		const world = createWorldEntity(500);

		const system = createMonetaryPolicySystem(
			() => [agent],
			() => world,
		);

		world.get(EconomyComponent).clearDirty();
		system.execute(createDeps(eventBus, 1));

		expect(world.get(EconomyComponent).dirty).toBe(true);
	});

	it('records transfer GoldFlowed events into ledger and reflects in velocity', () => {
		const eventBus = createEventBus();
		const agent = createAgent('agent-1', 100);
		const world = createWorldEntity(500);

		const system = createMonetaryPolicySystem(
			() => [agent],
			() => world,
		);

		const tick = 10;
		// Emit transfer events at current tick
		emitGoldFlowed(eventBus, tick, 'transfer', 50, {
			subcategory: 'purchase',
			fromEntity: 'agent-1',
			toEntity: 'loc-market',
		});
		emitGoldFlowed(eventBus, tick, 'transfer', 30, {
			subcategory: 'purchase',
			fromEntity: 'agent-2',
			toEntity: 'loc-bakery',
		});

		system.execute(createDeps(eventBus, tick));

		const snapshot = world.get(EconomyComponent).state.monetarySnapshot!;
		// velocity = transferVolume / moneySupply = 80 / 600 = ~0.133
		expect(snapshot.velocity).toBeCloseTo(80 / 600, 3);
	});

	it('records faucet and sink GoldFlowed events into snapshot', () => {
		const eventBus = createEventBus();
		const agent = createAgent('agent-1', 100);
		const world = createWorldEntity(500);

		const system = createMonetaryPolicySystem(
			() => [agent],
			() => world,
		);

		const tick = 5;
		emitGoldFlowed(eventBus, tick, 'faucet', 20, { subcategory: 'welfare' });
		emitGoldFlowed(eventBus, tick, 'sink', 8, { subcategory: 'tax' });

		system.execute(createDeps(eventBus, tick));

		const snapshot = world.get(EconomyComponent).state.monetarySnapshot!;
		expect(snapshot.faucetRate).toBe(20);
		expect(snapshot.sinkRate).toBe(8);
		expect(snapshot.netFlow).toBe(12); // faucet - sink
	});

	it('ignores GoldFlowed events with unrecognized category', () => {
		const eventBus = createEventBus();
		const agent = createAgent('agent-1', 50);
		const world = createWorldEntity(500);

		const system = createMonetaryPolicySystem(
			() => [agent],
			() => world,
		);

		const tick = 5;
		emitGoldFlowed(eventBus, tick, 'unknown_category', 999);

		system.execute(createDeps(eventBus, tick));

		const snapshot = world.get(EconomyComponent).state.monetarySnapshot!;
		expect(snapshot.faucetRate).toBe(0);
		expect(snapshot.sinkRate).toBe(0);
		expect(snapshot.velocity).toBe(0);
	});

	it('ignores GoldFlowed events from different ticks', () => {
		const eventBus = createEventBus();
		const agent = createAgent('agent-1', 100);
		const world = createWorldEntity(500);

		const system = createMonetaryPolicySystem(
			() => [agent],
			() => world,
		);

		// Emit event at tick 5 but execute system at tick 10
		emitGoldFlowed(eventBus, 5, 'transfer', 50, {
			subcategory: 'purchase',
			fromEntity: 'a',
			toEntity: 'b',
		});

		system.execute(createDeps(eventBus, 10));

		// The event at tick 5 should not have been recorded because the system
		// filters for events matching deps.tickCount (10)
		const snapshot = world.get(EconomyComponent).state.monetarySnapshot!;
		expect(snapshot.velocity).toBe(0);
	});

	it('sums balances from multiple agents', () => {
		const eventBus = createEventBus();
		const agent1 = createAgent('agent-1', 100);
		const agent2 = createAgent('agent-2', 200);
		const agent3 = createAgent('agent-3', 50);
		const world = createWorldEntity(300);

		const system = createMonetaryPolicySystem(
			() => [agent1, agent2, agent3],
			() => world,
		);

		system.execute(createDeps(eventBus, 1));

		const snapshot = world.get(EconomyComponent).state.monetarySnapshot!;
		// 100 + 200 + 50 + 300 treasury = 650
		expect(snapshot.moneySupply).toBe(650);
	});

	it('does not emit EmergencyCaravanRequested when velocity is above critical', () => {
		const eventBus = createEventBus();
		const events: GameEvent[] = [];
		eventBus.on('EmergencyCaravanRequested', (e) => { events.push(e); });

		const agent = createAgent('agent-1', 100);
		const world = createWorldEntity(500);

		const system = createMonetaryPolicySystem(
			() => [agent],
			() => world,
		);

		// No transfers at all, but velocity (0) is below critical (0.1)
		// Wait -- velocity=0 IS below critical. Let's create a scenario with velocity above critical.
		// We need transfer volume / money supply > 0.1
		// moneySupply = 100 + 500 = 600, so transferVolume needs to be > 60
		const tick = 1;
		emitGoldFlowed(eventBus, tick, 'transfer', 100, {
			subcategory: 'purchase', fromEntity: 'a', toEntity: 'b',
		});

		system.execute(createDeps(eventBus, tick));

		// velocity = 100 / 600 = ~0.167, above critical (0.1) so no recovery event
		expect(events.length).toBe(0);
	});

	it('emits EmergencyCaravanRequested when velocity is below critical threshold', () => {
		const eventBus = createEventBus();
		const events: GameEvent[] = [];
		eventBus.on('EmergencyCaravanRequested', (e) => { events.push(e); });

		const agent = createAgent('agent-1', 100);
		const world = createWorldEntity(500);

		const system = createMonetaryPolicySystem(
			() => [agent],
			() => world,
		);

		// No transfers: velocity = 0 which is < critical (0.1)
		system.execute(createDeps(eventBus, 1));

		expect(events.length).toBe(1);
		expect(events[0]!.type).toBe('EmergencyCaravanRequested');
		expect(events[0]!.source).toBe('MonetaryPolicySystem');
		expect(typeof events[0]!.payload.velocity).toBe('number');
	});

	it('respects caravan cooldown — does not re-emit within cooldown period', () => {
		const eventBus = createEventBus();
		const events: GameEvent[] = [];
		eventBus.on('EmergencyCaravanRequested', (e) => { events.push(e); });

		const agent = createAgent('agent-1', 100);
		const world = createWorldEntity(500);
		const config = GameConfigSchema.parse({});
		const cooldown = config.economy.monetary_policy.caravan_cooldown_ticks; // 500

		const system = createMonetaryPolicySystem(
			() => [agent],
			() => world,
		);

		// Tick 1: velocity=0 triggers caravan
		system.execute(createDeps(eventBus, 1));
		expect(events.length).toBe(1);

		// Tick 100: still within cooldown (1 + 500), should not emit again
		system.execute(createDeps(eventBus, 100));
		expect(events.length).toBe(1);

		// Tick past cooldown: should emit again
		system.execute(createDeps(eventBus, 1 + cooldown));
		expect(events.length).toBe(2);
	});

	it('emits EconomicStimulusActivated after enough consecutive stagnant ticks', () => {
		const eventBus = createEventBus();
		const stimulusEvents: GameEvent[] = [];
		eventBus.on('EconomicStimulusActivated', (e) => { stimulusEvents.push(e); });

		const agent = createAgent('agent-1', 100);
		const world = createWorldEntity(500);
		const config = GameConfigSchema.parse({});
		const triggerTicks = config.economy.monetary_policy.stimulus_trigger_ticks; // 50

		const system = createMonetaryPolicySystem(
			() => [agent],
			() => world,
		);

		// Run system for triggerTicks consecutive stagnant ticks (velocity=0 < stagnant=0.2)
		for (let t = 1; t <= triggerTicks - 1; t++) {
			system.execute(createDeps(eventBus, t));
		}
		// Before reaching the trigger threshold, no stimulus
		expect(stimulusEvents.length).toBe(0);

		// One more tick reaches the threshold
		system.execute(createDeps(eventBus, triggerTicks));
		expect(stimulusEvents.length).toBe(1);
		expect(stimulusEvents[0]!.type).toBe('EconomicStimulusActivated');
		expect(stimulusEvents[0]!.payload.duration).toBe(config.economy.monetary_policy.stimulus_duration_ticks);
	});

	it('resets consecutive stagnant counter when velocity rises above stagnant threshold', () => {
		const eventBus = createEventBus();
		const stimulusEvents: GameEvent[] = [];
		eventBus.on('EconomicStimulusActivated', (e) => { stimulusEvents.push(e); });

		const agent = createAgent('agent-1', 100);
		const world = createWorldEntity(500);
		const config = GameConfigSchema.parse({});
		const triggerTicks = config.economy.monetary_policy.stimulus_trigger_ticks;
		const stagnantThreshold = config.economy.monetary_policy.velocity_stagnant; // 0.2

		const system = createMonetaryPolicySystem(
			() => [agent],
			() => world,
		);

		// Accumulate stagnant ticks nearly to the threshold
		for (let t = 1; t <= triggerTicks - 5; t++) {
			system.execute(createDeps(eventBus, t));
		}
		expect(stimulusEvents.length).toBe(0);

		// Now inject enough transfer volume to push velocity above stagnant
		// moneySupply = 100 + 500 = 600, need transferVolume/600 > 0.2 => transferVolume > 120
		const healthyTick = triggerTicks - 4;
		emitGoldFlowed(eventBus, healthyTick, 'transfer', 200, {
			subcategory: 'purchase', fromEntity: 'a', toEntity: 'b',
		});
		system.execute(createDeps(eventBus, healthyTick));

		// Counter should be reset. Now run again for less than triggerTicks more stagnant ticks.
		for (let t = healthyTick + 1; t <= healthyTick + triggerTicks - 1; t++) {
			system.execute(createDeps(eventBus, t));
		}
		// Should NOT have triggered stimulus because counter was reset mid-way
		expect(stimulusEvents.length).toBe(0);
	});

	it('handles non-numeric amount in GoldFlowed payload gracefully', () => {
		const eventBus = createEventBus();
		const agent = createAgent('agent-1', 100);
		const world = createWorldEntity(500);

		const system = createMonetaryPolicySystem(
			() => [agent],
			() => world,
		);

		const tick = 1;
		// Emit GoldFlowed with non-numeric amount
		eventBus.emit({
			type: 'GoldFlowed',
			tick,
			wallClock: Date.now(),
			source: 'TestHarness',
			payload: { category: 'transfer', amount: 'not-a-number', subcategory: 'test' },
		});

		// Should not throw — amount defaults to 0
		system.execute(createDeps(eventBus, tick));

		const snapshot = world.get(EconomyComponent).state.monetarySnapshot!;
		expect(snapshot.velocity).toBe(0);
	});

	it('handles missing subcategory in GoldFlowed payload gracefully', () => {
		const eventBus = createEventBus();
		const agent = createAgent('agent-1', 100);
		const world = createWorldEntity(500);

		const system = createMonetaryPolicySystem(
			() => [agent],
			() => world,
		);

		const tick = 1;
		// Emit GoldFlowed with no subcategory
		eventBus.emit({
			type: 'GoldFlowed',
			tick,
			wallClock: Date.now(),
			source: 'TestHarness',
			payload: { category: 'faucet', amount: 10 },
		});

		system.execute(createDeps(eventBus, tick));

		const snapshot = world.get(EconomyComponent).state.monetarySnapshot!;
		expect(snapshot.faucetRate).toBe(10);
	});

	it('handles empty agent list correctly', () => {
		const eventBus = createEventBus();
		const world = createWorldEntity(1000);

		const system = createMonetaryPolicySystem(
			() => [],
			() => world,
		);

		system.execute(createDeps(eventBus, 1));

		const snapshot = world.get(EconomyComponent).state.monetarySnapshot!;
		// No agents, only treasury contributes to money supply
		expect(snapshot.moneySupply).toBe(1000);
	});

	it('handles missing fromEntity and toEntity in GoldFlowed payload gracefully', () => {
		const eventBus = createEventBus();
		const agent = createAgent('agent-1', 100);
		const world = createWorldEntity(500);

		const system = createMonetaryPolicySystem(
			() => [agent],
			() => world,
		);

		const tick = 1;
		emitGoldFlowed(eventBus, tick, 'transfer', 50);

		// Should not throw — fromEntity/toEntity default to null
		system.execute(createDeps(eventBus, tick));

		const snapshot = world.get(EconomyComponent).state.monetarySnapshot!;
		expect(snapshot.velocity).toBeCloseTo(50 / 600, 3);
	});
});
