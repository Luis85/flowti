import { describe, it, expect, vi } from 'vitest';
import { createTraitResolverSystem } from '../../../src/infrastructure/systems/trait-resolver-system.js';
import { AgentActor } from '../../../src/infrastructure/entity/agent-actor.js';
import { GameConfigSchema } from '../../../src/domain/schemas/game-config-schema.js';
import { createPerformanceTracker } from '../../../src/infrastructure/performance/performance-tracker.js';
import { createEventBus } from '../../../src/infrastructure/event-bus.js';
import type { GameCoreDeps } from '../../../src/domain/core/game-deps.js';
import type { TraitDefinition } from '../../../src/domain/systems/trait-resolver.js';
import type { BehaviorAgent } from '../../../src/domain/systems/behavior-agent.js';

const traitDefs: Record<string, TraitDefinition> = {
	'hardy': {
		id: 'hardy',
		effects: [{ system: 'NeedsDecaySystem', modifier: { hungerDecayScale: 0.8 } }],
		conflicts_with: [],
	},
	'frail': {
		id: 'frail',
		effects: [{ system: 'NeedsDecaySystem', modifier: { hungerDecayScale: 1.5 } }],
		conflicts_with: ['hardy'],
	},
};

function createDeps(eventBus = createEventBus()): GameCoreDeps {
	return {
		logger: { debug() {}, info() {}, warn: vi.fn(), error() {} },
		eventBus,
		config: GameConfigSchema.parse({}),
		performanceTracker: createPerformanceTracker(),
		tickCount: 1,
		writeFile: null,
	};
}

function createTestAgent(traits: string[]) {
	return {
		id: 'agent-test' as const,
		name: 'Test',
		kind: 'merchant',
		attributes: { ST: 10, DX: 10, IQ: 10, HT: 10 },
		social: { status: 0, reputation: 0, charisma: 10 },
		needs: { hunger: 80, energy: 90, social: 70, thirst: 80 },
		mood: 0,
		memory: [] as never[],
		goals: [] as never[],
		skills: [] as never[],
		inventory: [] as never[],
		equipment: { head: null, body: null, hands: null, tool: null, accessory: null },
		traits,
		wallet: { gold: 50 },
		xp: 0,
		level: 1,
		position: { x: 0, y: 0, region: 'test' },
		relationships: '',
		tools: [] as never[],
		color: '#b0b0b0', behavior_tree: 'bt/test.md',
		job: null,
		property: [] as never[],
	};
}

const defaultMoodConfig = {
	factor_weights: { needs: 30, positive_memories: 20, negative_memories: 20, goal_progress: 10, wallet: 10, equipment: 5, relationships: 5 },
	buckets: [{ name: 'stressed', min: -100, max: 100 }],
	external_modifier_cap: 30,
};

function createStubBehaviorAgent(overrides: Partial<BehaviorAgent> = {}): BehaviorAgent {
	return {
		hunger: 80, energy: 90, social: 70, thirst: 80, gold: 50, mood: 0, moodBucket: 'stressed',
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
		SwitchJob: () => 'mistreevous.failed', ClaimQuest: () => 'mistreevous.failed',
		SeekQuestFacility: () => 'mistreevous.failed', WorkRepair: () => 'mistreevous.failed',
		CompleteQuest: () => 'mistreevous.failed', AbandonQuest: () => 'mistreevous.failed',
		ContinueCommitment: () => 'mistreevous.failed',
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

describe('TraitResolverSystem', () => {
	it('writes modifier map to behaviorAgent', () => {
		const agent = new AgentActor(createTestAgent(['hardy']), defaultMoodConfig);
		agent.behaviorAgent = createStubBehaviorAgent();
		const system = createTraitResolverSystem(() => [agent], traitDefs);
		system.execute(createDeps());

		const modifiers = agent.behaviorAgent.traitModifiers as Record<string, Record<string, unknown>> | null;
		expect(modifiers).not.toBeNull();
		expect(modifiers?.['NeedsDecaySystem']).toEqual({ hungerDecayScale: 0.8 });
	});

	it('writes empty map on trait conflict', () => {
		const agent = new AgentActor(createTestAgent(['hardy', 'frail']), defaultMoodConfig);
		agent.behaviorAgent = createStubBehaviorAgent();
		const system = createTraitResolverSystem(() => [agent], traitDefs);
		const deps = createDeps();
		system.execute(deps);

		const modifiers = agent.behaviorAgent.traitModifiers as Record<string, unknown> | null;
		expect(Object.keys(modifiers ?? {})).toHaveLength(0);
		expect(deps.logger.warn).toHaveBeenCalled();
	});

	it('handles agent with no traits', () => {
		const agent = new AgentActor(createTestAgent([]), defaultMoodConfig);
		agent.behaviorAgent = createStubBehaviorAgent();
		const system = createTraitResolverSystem(() => [agent], traitDefs);
		system.execute(createDeps());

		const modifiers = agent.behaviorAgent.traitModifiers as Record<string, unknown> | null;
		expect(Object.keys(modifiers ?? {})).toHaveLength(0);
	});

	it('first tick computes trait modifiers', () => {
		const agent = new AgentActor(createTestAgent(['hardy']), defaultMoodConfig);
		agent.behaviorAgent = createStubBehaviorAgent();
		const system = createTraitResolverSystem(() => [agent], traitDefs);

		system.execute(createDeps());

		const modifiers = agent.behaviorAgent.traitModifiers as Record<string, Record<string, unknown>> | null;
		expect(modifiers).not.toBeNull();
		expect(modifiers?.['NeedsDecaySystem']).toEqual({ hungerDecayScale: 0.8 });
	});

	it('second tick skips re-computation', () => {
		const agent = new AgentActor(createTestAgent(['hardy']), defaultMoodConfig);
		agent.behaviorAgent = createStubBehaviorAgent();
		const system = createTraitResolverSystem(() => [agent], traitDefs);

		system.execute(createDeps());

		// Reset modifiers to detect if system re-computes
		agent.behaviorAgent.traitModifiers = null;

		system.execute(createDeps());

		// Should still be null because second tick is skipped
		expect(agent.behaviorAgent.traitModifiers).toBeNull();
	});
});
