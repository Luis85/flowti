/**
 * Minimal BehaviorAgent + BehaviourTree stubs for integration tests
 * that need agents with behaviorAgent set but don't step the real mistreevous tree.
 */
import type { AgentActor } from '../../src/infrastructure/entity/agent-actor.js';
import type { BehaviorAgent } from '../../src/domain/systems/behavior-agent.js';
import type { BehaviourTree } from 'mistreevous';

/**
 * Creates a minimal BehaviorAgent stub that provides working memory fields
 * and no-op condition/action methods. State fields (hunger, energy, etc.)
 * are proxied from the agent's ECS components.
 *
 * Pass `overrides` to pre-set working memory like btAction or knownLocations.
 */
export function stubBehaviorAgent(
	agent: AgentActor,
	overrides: Partial<Pick<BehaviorAgent,
		'btAction' | 'gossipPending' | 'knownLocations' | 'traitModifiers' |
		'movementTarget' | 'atLocation' | 'currentRegion' | 'feedingAt' | 'restingAt'
	>> = {},
): BehaviorAgent {
	const SUCCEEDED = 'mistreevous.succeeded' as const;
	const FAILED = 'mistreevous.failed' as const;
	const RUNNING = 'mistreevous.running' as const;

	const ba: BehaviorAgent = {
		// Read-only getters — not used in most tests but present for type compat
		get hunger() { return 50; },
		get energy() { return 50; },
		get social() { return 50; },
		get thirst() { return 50; },
		get gold() { return 50; },
		get mood() { return 0; },
		get moodBucket() { return 'content'; },
		get timePhase() { return 'day'; },
		get job() { return agent.job; },
		get position() { return { x: agent.pos.x, y: agent.pos.y }; },
		get inventory() { return []; },
		get nearbyAgents() { return []; },
		get nearbyLocations() { return []; },
		get nearbyFacilities() { return []; },

		// Working memory
		movementTarget: overrides.movementTarget ?? null,
		journey: null,
		atLocation: overrides.atLocation ?? null,
		currentRegion: overrides.currentRegion ?? '',
		haulCargo: null,
		socialCooldowns: new Map(),
		committedAction: null,
		btAction: overrides.btAction ?? null,
		gossipPending: overrides.gossipPending ?? null,
		knownLocations: overrides.knownLocations ?? [],
		traitModifiers: overrides.traitModifiers ?? null,
		skills: [],
		feedingAt: overrides.feedingAt ?? null,
		restingAt: overrides.restingAt ?? null,
		arrivalSlot: null,
		priceMemories: [] as unknown as BehaviorAgent['priceMemories'],

		// Condition stubs — all return false
		IsHungry() { return false; },
		IsExhausted() { return false; },
		IsLonely() { return false; },
		IsThirsty() { return false; },
		HasWater() { return false; },
		NeedsCritical() { return false; },
		HasFood() { return false; },
		HasFoodReserve() { return false; },
		HasGold(_amount: number) { return false; },
		CanAffordFood() { return false; },
		AtLocation(_type: string) { return false; },
		NearLocation(_type: string) { return false; },
		NearAgent() { return false; },
		NearAgentClose() { return false; },
		IsDaytime() { return true; },
		IsNighttime() { return false; },
		IsWorkHours() { return false; },
		HasJob() { return false; },
		AtJobFacility() { return false; },
		FacilityHasStock(_itemId: string) { return false; },
		HasCargo() { return false; },
		CargoDestinationNearby() { return false; },
		FacilityNeedsSupply() { return false; },
		KnowsFoodSource() { return false; },
		HasNoJob() { return true; },
		OpenFacilityNearby() { return false; },

		// Action stubs — all succeed
		Eat() { return SUCCEEDED; },
		Rest() { return RUNNING; },
		Drink() { return SUCCEEDED; },
		Harvest() { return RUNNING; },
		SeekFood() { return RUNNING; },
		SeekRest() { return RUNNING; },
		SeekWater() { return RUNNING; },
		FillWaterskin() { return SUCCEEDED; },
		SellAtMarket() { return SUCCEEDED; },
		SeekWork() { return RUNNING; },
		SeekSocial() { return RUNNING; },
		SeekMarket() { return RUNNING; },
		Work() { return RUNNING; },
		Talk() { return RUNNING; },
		Buy() { return SUCCEEDED; },
		PickupCargo() { return SUCCEEDED; },
		DeliverCargo() { return SUCCEEDED; },
		SeekDeliveryTarget() { return RUNNING; },
		SeekSupplySource() { return RUNNING; },
		SeekBestFoodSource() { return RUNNING; },
		ClaimJob() { return SUCCEEDED; },
		Idle() { return RUNNING; },
		Wander() { return RUNNING; },

		// Utility
		recordPriceObservation() {},
	};

	return ba;
}

/**
 * Creates a no-op BehaviourTree stub that does nothing on step().
 */
export function stubBehaviorTree(): BehaviourTree {
	return {
		step: () => {},
		reset: () => {},
		isRunning: () => false,
		getState: () => 'mistreevous.ready',
	} as unknown as BehaviourTree;
}

/**
 * Attaches a stubbed BehaviorAgent and BehaviourTree to an AgentActor
 * for tests that don't use the real mistreevous engine.
 */
export function attachBehaviorStubs(
	agent: AgentActor,
	overrides: Partial<Pick<BehaviorAgent,
		'btAction' | 'gossipPending' | 'knownLocations' | 'traitModifiers' |
		'movementTarget' | 'atLocation' | 'currentRegion' | 'feedingAt' | 'restingAt'
	>> = {},
): void {
	agent.behaviorAgent = stubBehaviorAgent(agent, overrides);
	agent.behaviorTree = stubBehaviorTree();
}
