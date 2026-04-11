import { describe, it, expect } from 'vitest';
import { createSocializeSystem } from '../../../src/infrastructure/systems/socialize-system.js';
import { AgentActor } from '../../../src/infrastructure/entity/agent-actor.js';
import { NeedsComponent } from '../../../src/infrastructure/components/needs-component.js';
import { MemoryComponent } from '../../../src/infrastructure/components/memory-component.js';
import { PerceptionComponent } from '../../../src/infrastructure/components/perception-component.js';
import { GameConfigSchema } from '../../../src/domain/schemas/game-config-schema.js';
import { createPerformanceTracker } from '../../../src/infrastructure/performance/performance-tracker.js';
import { createEventBus } from '../../../src/infrastructure/event-bus.js';
import type { GameCoreDeps } from '../../../src/domain/core/game-deps.js';
import type { GameEvent } from '../../../src/domain/core/events.js';
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

function createDeps(eventBus = createEventBus(), tickCount = 100): GameCoreDeps {
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

function setupPair(
	opts: { agent1Social?: number; agent2Social?: number; distance?: number; btAction1?: string; btAction2?: string } = {},
) {
	const { agent1Social = 50, agent2Social = 50, distance = 10, btAction1 = 'talk', btAction2 = 'talk' } = opts;

	const agent1 = new AgentActor(
		createTestAgentData('agent-elena', 100, 100, { name: 'Elena', needs: { hunger: 50, energy: 50, social: agent1Social, thirst: 50 } }),
		defaultMoodConfig,
	);
	const agent2 = new AgentActor(
		createTestAgentData('agent-marcus', 110, 100, { name: 'Marcus', needs: { hunger: 50, energy: 50, social: agent2Social, thirst: 50 } }),
		defaultMoodConfig,
	);

	// Set perception data (component is added by AgentActor constructor)
	agent1.get(PerceptionComponent).state = { nearbyAgents: [{ id: 'agent-marcus', distance }], nearbyLocations: [] };
	agent2.get(PerceptionComponent).state = { nearbyAgents: [{ id: 'agent-elena', distance }], nearbyLocations: [] };

	// Set BT actions via behaviorAgent
	agent1.behaviorAgent = createStubBehaviorAgent({ btAction: btAction1 });
	agent2.behaviorAgent = createStubBehaviorAgent({ btAction: btAction2 });

	return { agent1, agent2 };
}

describe('SocializeSystem', () => {
	it('recovers social for both agents and emits SocialInteraction event', () => {
		const eventBus = createEventBus();
		const events: GameEvent[] = [];
		eventBus.on('SocialInteraction', (e) => { events.push(e); });

		const { agent1, agent2 } = setupPair();
		const system = createSocializeSystem(() => [agent1, agent2]);
		system.execute(createDeps(eventBus, 100));

		// Both agents should have social recovery: passive 0.3 + active 3.0 = 3.3
		expect(agent1.get(NeedsComponent).state.social).toBeCloseTo(53.3);
		expect(agent2.get(NeedsComponent).state.social).toBeCloseTo(53.3);

		// SocialInteraction event emitted
		expect(events.length).toBe(1);
		expect(events[0]?.payload.agentId).toBe('agent-elena');
		expect(events[0]?.payload.partnerId).toBe('agent-marcus');
		expect(events[0]?.payload.memoryCreated).toBe(true);
	});

	it('appends memory to both agents when not on cooldown', () => {
		const { agent1, agent2 } = setupPair();
		const system = createSocializeSystem(() => [agent1, agent2]);
		system.execute(createDeps(createEventBus(), 100));

		const mem1 = agent1.get(MemoryComponent).state.entries;
		const mem2 = agent2.get(MemoryComponent).state.entries;

		// Both should have a social memory
		expect(mem1.length).toBe(1);
		expect(mem1[0]?.type).toBe('social');
		expect(mem1[0]?.description).toBe('Talked with Marcus');
		expect(mem1[0]?.participants).toEqual(['agent-marcus']);

		expect(mem2.length).toBe(1);
		expect(mem2[0]?.type).toBe('social');
		expect(mem2[0]?.description).toBe('Talked with Elena');
		expect(mem2[0]?.participants).toEqual(['agent-elena']);
	});

	it('skips memory creation on cooldown but still recovers social', () => {
		const { agent1, agent2 } = setupPair();
		const system = createSocializeSystem(() => [agent1, agent2]);

		// First tick at 100 — should create memory
		system.execute(createDeps(createEventBus(), 100));

		// Second tick at 110 — within cooldown_ticks (20), no new memory
		// Reset BT actions (they don't persist between ticks in a real system)
		agent1.behaviorAgent.btAction = 'talk';
		agent2.behaviorAgent.btAction = 'talk';

		const eventBus2 = createEventBus();
		const events: GameEvent[] = [];
		eventBus2.on('SocialInteraction', (e) => { events.push(e); });

		system.execute(createDeps(eventBus2, 110));

		// Social should still recover (second tick)
		// First tick: 50 + 0.3(passive) + 3.0(active) = 53.3
		// Second tick: 53.3 + 0.3(passive) + 3.0(active) = 56.6
		expect(agent1.get(NeedsComponent).state.social).toBeCloseTo(56.6);
		expect(agent2.get(NeedsComponent).state.social).toBeCloseTo(56.6);

		// Memory should NOT have increased — still just 1 entry from first tick
		expect(agent1.get(MemoryComponent).state.entries.length).toBe(1);
		expect(agent2.get(MemoryComponent).state.entries.length).toBe(1);

		// Event still emitted (with memoryCreated: false)
		expect(events.length).toBe(1);
		expect(events[0]?.payload.memoryCreated).toBe(false);
	});

	it('non-talking agents get passive social recovery but no active talk', () => {
		const eventBus = createEventBus();
		const events: GameEvent[] = [];
		eventBus.on('SocialInteraction', (e) => { events.push(e); });

		const { agent1, agent2 } = setupPair({ btAction1: 'seek_food' });
		const system = createSocializeSystem(() => [agent1, agent2]);
		system.execute(createDeps(eventBus, 100));

		// Passive social recovery only (0.3) — no active talk
		expect(agent1.get(NeedsComponent).state.social).toBeCloseTo(50.3);
		expect(agent2.get(NeedsComponent).state.social).toBeCloseTo(50.3);

		// No active SocialInteraction event
		expect(events.length).toBe(0);
	});

	it('skips agent when no nearby agents within radius', () => {
		const eventBus = createEventBus();
		const events: GameEvent[] = [];
		eventBus.on('SocialInteraction', (e) => { events.push(e); });

		// Distance 999 is well beyond the default interaction_radius (25)
		const { agent1, agent2 } = setupPair({ distance: 999 });
		const system = createSocializeSystem(() => [agent1, agent2]);
		system.execute(createDeps(eventBus, 100));

		// No social recovery
		expect(agent1.get(NeedsComponent).state.social).toBe(50);
		expect(agent2.get(NeedsComponent).state.social).toBe(50);

		// No event
		expect(events.length).toBe(0);
	});

	it('processes pair only once when both agents have social actions', () => {
		const eventBus = createEventBus();
		const events: GameEvent[] = [];
		eventBus.on('SocialInteraction', (e) => { events.push(e); });

		// Both agents have talk action
		const { agent1, agent2 } = setupPair({ btAction1: 'talk', btAction2: 'talk' });
		const system = createSocializeSystem(() => [agent1, agent2]);
		system.execute(createDeps(eventBus, 100));

		// Only ONE event — pair deduplication prevents double-processing
		expect(events.length).toBe(1);

		// Both still get social recovery: passive 0.3 + active 3.0 = 3.3
		expect(agent1.get(NeedsComponent).state.social).toBeCloseTo(53.3);
		expect(agent2.get(NeedsComponent).state.social).toBeCloseTo(53.3);

		// Both get memory
		expect(agent1.get(MemoryComponent).state.entries.length).toBe(1);
		expect(agent2.get(MemoryComponent).state.entries.length).toBe(1);
	});
});
