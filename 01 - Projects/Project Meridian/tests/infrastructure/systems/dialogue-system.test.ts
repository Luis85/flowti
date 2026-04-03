import { describe, it, expect } from 'vitest';
import { createDialogueSystem } from '../../../src/infrastructure/systems/dialogue-system.js';
import { AgentActor } from '../../../src/infrastructure/entity/agent-actor.js';
import { MoodComponent } from '../../../src/infrastructure/components/mood-component.js';
import { MemoryComponent } from '../../../src/infrastructure/components/memory-component.js';
import { RelationshipComponent } from '../../../src/infrastructure/components/relationship-component.js';
import { GameConfigSchema } from '../../../src/domain/schemas/game-config-schema.js';
import { createPerformanceTracker } from '../../../src/infrastructure/performance/performance-tracker.js';
import { createEventBus } from '../../../src/infrastructure/event-bus.js';
import type { GameCoreDeps } from '../../../src/domain/core/game-deps.js';
import type { GameEvent } from '../../../src/domain/core/events.js';
import type { BehaviorAgent } from '../../../src/domain/systems/behavior-agent.js';

const defaultMoodConfig = {
	factor_weights: { needs: 30, positive_memories: 20, negative_memories: 20, goal_progress: 10, wallet: 10, equipment: 5, relationships: 5 },
	buckets: [{ name: 'content', min: -100, max: 100 }],
	external_modifier_cap: 30,
};

function createTestAgentData(id: string, overrides: Record<string, unknown> = {}) {
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
		position: { x: 100, y: 100, region: 'test' },
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
		HasTradeGoods: () => false, NeedsTools: () => true, NeedsEquipment: () => true,
		CanAffordItem: () => false,
		Eat: () => 'mistreevous.failed', Rest: () => 'mistreevous.failed',
		Drink: () => 'mistreevous.failed', Harvest: () => 'mistreevous.failed',
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
		recordPriceObservation: () => {}, tickUnemployment: () => {},
		...overrides,
	};
}

function setupPairWithSocialEvent(opts: {
	agentMoodBucket?: string;
	partnerMoodBucket?: string;
	disposition?: number;
	partnerDisposition?: number;
	familiarity?: number;
	memoryCreated?: boolean;
	tickCount?: number;
} = {}) {
	const {
		agentMoodBucket = 'content',
		partnerMoodBucket = 'content',
		disposition = 10,
		partnerDisposition = 10,
		familiarity = 5,
		memoryCreated = true,
		tickCount = 100,
	} = opts;

	const agent = new AgentActor(
		createTestAgentData('agent-elena', { name: 'Elena', kind: 'merchant' }),
		defaultMoodConfig,
	);
	const partner = new AgentActor(
		createTestAgentData('agent-marcus', { name: 'Marcus', kind: 'guard' }),
		defaultMoodConfig,
	);

	// Attach stub behaviorAgent
	agent.behaviorAgent = createStubBehaviorAgent();
	partner.behaviorAgent = createStubBehaviorAgent();

	// Set moods
	const agentMood = agent.get(MoodComponent);
	agentMood.state = { ...agentMood.state, bucket: agentMoodBucket };

	const partnerMood = partner.get(MoodComponent);
	partnerMood.state = { ...partnerMood.state, bucket: partnerMoodBucket };

	// Set relationships
	const agentRelComp = agent.get(RelationshipComponent);
	agentRelComp.state = {
		entries: [{
			agentId: 'agent-marcus',
			disposition,
			familiarity,
			tags: [],
			lastInteractionTick: 0,
		}],
	};

	const partnerRelComp = partner.get(RelationshipComponent);
	partnerRelComp.state = {
		entries: [{
			agentId: 'agent-elena',
			disposition: partnerDisposition,
			familiarity,
			tags: [],
			lastInteractionTick: 0,
		}],
	};

	// Add a social memory from the socialize system to be replaced
	const agentMem = agent.get(MemoryComponent);
	agentMem.state = {
		...agentMem.state,
		entries: [{
			tick: tickCount,
			type: 'social',
			description: 'Talked with Marcus',
			participants: ['agent-marcus'],
			outcome: 'positive',
			significance: 3,
			mood_impact: 2,
		}],
	};

	const partnerMem = partner.get(MemoryComponent);
	partnerMem.state = {
		...partnerMem.state,
		entries: [{
			tick: tickCount,
			type: 'social',
			description: 'Talked with Elena',
			participants: ['agent-elena'],
			outcome: 'positive',
			significance: 3,
			mood_impact: 2,
		}],
	};

	// Create event bus and emit SocialInteraction event
	const eventBus = createEventBus();
	eventBus.emit({
		type: 'SocialInteraction',
		tick: tickCount,
		wallClock: Date.now(),
		source: 'SocializeSystem',
		payload: {
			agentId: 'agent-elena',
			partnerId: 'agent-marcus',
			memoryCreated,
		},
	});

	return { agent, partner, eventBus, tickCount };
}

describe('DialogueSystem', () => {
	it('creates dialogue memories from SocialInteraction events (replaces social memory)', () => {
		const { agent, partner, eventBus, tickCount } = setupPairWithSocialEvent();
		const deps = createDeps(eventBus, tickCount);

		const system = createDialogueSystem(() => [agent, partner], 42);
		system.execute(deps);

		const agentMem = agent.get(MemoryComponent).state.entries;
		const partnerMem = partner.get(MemoryComponent).state.entries;

		// Social memory should be replaced by dialogue memory
		expect(agentMem.length).toBe(1);
		expect(agentMem[0]?.type).toBe('dialogue');
		expect(agentMem[0]?.tick).toBe(tickCount);

		expect(partnerMem.length).toBe(1);
		expect(partnerMem[0]?.type).toBe('dialogue');
		expect(partnerMem[0]?.tick).toBe(tickCount);
	});

	it('skips events where memoryCreated is false', () => {
		const { agent, partner, eventBus, tickCount } = setupPairWithSocialEvent({
			memoryCreated: false,
		});
		const deps = createDeps(eventBus, tickCount);

		const system = createDialogueSystem(() => [agent, partner], 42);
		system.execute(deps);

		// Social memory should remain untouched (not replaced)
		const agentMem = agent.get(MemoryComponent).state.entries;
		expect(agentMem.length).toBe(1);
		expect(agentMem[0]?.type).toBe('social');
	});

	it('emits DialogueCompleted event', () => {
		const { agent, partner, eventBus, tickCount } = setupPairWithSocialEvent();
		const deps = createDeps(eventBus, tickCount);
		const events: GameEvent[] = [];
		eventBus.on('DialogueCompleted', (e) => { events.push(e); });

		const system = createDialogueSystem(() => [agent, partner], 42);
		system.execute(deps);

		expect(events.length).toBe(1);
		expect(events[0]?.payload.agentId).toBe('agent-elena');
		expect(events[0]?.payload.partnerId).toBe('agent-marcus');
		expect(events[0]?.payload.tone).toBeDefined();
		expect(events[0]?.payload.agentLine).toBeDefined();
		expect(events[0]?.payload.partnerLine).toBeDefined();
	});

	it('sets gossipPending on both agents when familiarity >= threshold', () => {
		// Default gossip familiarity_threshold is 3, familiarity is 5 — should trigger gossip
		const { agent, partner, eventBus, tickCount } = setupPairWithSocialEvent({ familiarity: 5 });
		const deps = createDeps(eventBus, tickCount);

		const system = createDialogueSystem(() => [agent, partner], 42);
		system.execute(deps);

		expect(agent.behaviorAgent.gossipPending).toBe('agent-marcus');
		expect(partner.behaviorAgent.gossipPending).toBe('agent-elena');
	});

	it('does not set gossipPending when familiarity < threshold', () => {
		// Set familiarity below default gossip threshold (3)
		const { agent, partner, eventBus, tickCount } = setupPairWithSocialEvent({ familiarity: 1 });
		const deps = createDeps(eventBus, tickCount);

		const system = createDialogueSystem(() => [agent, partner], 42);
		system.execute(deps);

		expect(agent.behaviorAgent.gossipPending).toBeNull();
		expect(partner.behaviorAgent.gossipPending).toBeNull();
	});

	it('updates disposition on RelationshipComponent', () => {
		const { agent, partner, eventBus, tickCount } = setupPairWithSocialEvent({
			agentMoodBucket: 'elated',
			partnerMoodBucket: 'content',
			disposition: 10,
			partnerDisposition: 5,
		});
		const deps = createDeps(eventBus, tickCount);

		const system = createDialogueSystem(() => [agent, partner], 42);
		system.execute(deps);

		const agentRel = agent.get(RelationshipComponent).state.entries.find(e => e.agentId === 'agent-marcus');
		const partnerRel = partner.get(RelationshipComponent).state.entries.find(e => e.agentId === 'agent-elena');

		// Positive tone -> +1 disposition change
		expect(agentRel).toBeDefined();
		expect(agentRel!.disposition).toBe(11);
		expect(agentRel!.tags).toContain('talked_with');
		expect(agentRel!.lastInteractionTick).toBe(tickCount);

		expect(partnerRel).toBeDefined();
		expect(partnerRel!.disposition).toBe(6);
		expect(partnerRel!.tags).toContain('talked_with');
		expect(partnerRel!.lastInteractionTick).toBe(tickCount);
	});

	it('skips when agent in SocialInteraction event is not found', () => {
		const eventBus = createEventBus();
		const tickCount = 100;

		eventBus.emit({
			type: 'SocialInteraction',
			tick: tickCount,
			wallClock: Date.now(),
			source: 'SocializeSystem',
			payload: {
				agentId: 'agent-nonexistent',
				partnerId: 'agent-also-nonexistent',
				memoryCreated: true,
			},
		});

		const deps = createDeps(eventBus, tickCount);
		const events: GameEvent[] = [];
		eventBus.on('DialogueCompleted', (e) => { events.push(e); });

		const system = createDialogueSystem(() => [], 42);
		system.execute(deps);

		expect(events.length).toBe(0);
	});

	it('handles first-meeting agents with no existing relationship', () => {
		const agent = new AgentActor(
			createTestAgentData('agent-elena', { name: 'Elena', kind: 'merchant' }),
			defaultMoodConfig,
		);
		const partner = new AgentActor(
			createTestAgentData('agent-marcus', { name: 'Marcus', kind: 'guard' }),
			defaultMoodConfig,
		);

		agent.behaviorAgent = createStubBehaviorAgent();
		partner.behaviorAgent = createStubBehaviorAgent();

		// Both agents have empty relationship entries (first meeting)
		const agentRelComp = agent.get(RelationshipComponent);
		agentRelComp.state = { entries: [] };

		const partnerRelComp = partner.get(RelationshipComponent);
		partnerRelComp.state = { entries: [] };

		// Set moods
		const agentMood = agent.get(MoodComponent);
		agentMood.state = { ...agentMood.state, bucket: 'content' };

		const partnerMood = partner.get(MoodComponent);
		partnerMood.state = { ...partnerMood.state, bucket: 'content' };

		// Add social memory so dialogue system has something to replace
		const agentMem = agent.get(MemoryComponent);
		agentMem.state = {
			...agentMem.state,
			entries: [{
				tick: 100,
				type: 'social',
				description: 'Talked with Marcus',
				participants: ['agent-marcus'],
				outcome: 'positive',
				significance: 3,
				mood_impact: 2,
			}],
		};

		const partnerMem = partner.get(MemoryComponent);
		partnerMem.state = {
			...partnerMem.state,
			entries: [{
				tick: 100,
				type: 'social',
				description: 'Talked with Elena',
				participants: ['agent-elena'],
				outcome: 'positive',
				significance: 3,
				mood_impact: 2,
			}],
		};

		const eventBus = createEventBus();
		eventBus.emit({
			type: 'SocialInteraction',
			tick: 100,
			wallClock: Date.now(),
			source: 'SocializeSystem',
			payload: {
				agentId: 'agent-elena',
				partnerId: 'agent-marcus',
				memoryCreated: true,
			},
		});

		const deps = createDeps(eventBus, 100);
		const system = createDialogueSystem(() => [agent, partner], 42);
		system.execute(deps);

		const agentMemAfter = agent.get(MemoryComponent).state.entries;
		const partnerMemAfter = partner.get(MemoryComponent).state.entries;
		expect(agentMemAfter.length).toBe(1);
		expect(agentMemAfter[0]?.type).toBe('dialogue');
		expect(partnerMemAfter.length).toBe(1);
		expect(partnerMemAfter[0]?.type).toBe('dialogue');

		const agentRelAfter = agent.get(RelationshipComponent).state.entries;
		const partnerRelAfter = partner.get(RelationshipComponent).state.entries;
		expect(agentRelAfter.length).toBe(1);
		expect(agentRelAfter[0]?.agentId).toBe('agent-marcus');
		expect(agentRelAfter[0]?.tags).toContain('talked_with');
		expect(agentRelAfter[0]?.lastInteractionTick).toBe(100);

		expect(partnerRelAfter.length).toBe(1);
		expect(partnerRelAfter[0]?.agentId).toBe('agent-elena');
		expect(partnerRelAfter[0]?.tags).toContain('talked_with');
		expect(partnerRelAfter[0]?.lastInteractionTick).toBe(100);
	});
});
