import { describe, it, expect } from 'vitest';
import { Actor } from 'excalibur';
import { createMovementSystem, JOURNEY_SENTINEL } from '../../../src/infrastructure/systems/movement-system.js';
import { AgentActor } from '../../../src/infrastructure/entity/agent-actor.js';
import { NeedsComponent } from '../../../src/infrastructure/components/needs-component.js';
import { StaminaComponent } from '../../../src/infrastructure/components/stamina-component.js';
import { FacilityComponent } from '../../../src/infrastructure/components/facility-component.js';
import { GameConfigSchema } from '../../../src/domain/schemas/game-config-schema.js';
import { createPerformanceTracker } from '../../../src/infrastructure/performance/performance-tracker.js';
import { createEventBus } from '../../../src/infrastructure/event-bus.js';
import type { GameCoreDeps } from '../../../src/domain/core/game-deps.js';
import type { GameEvent } from '../../../src/domain/core/events.js';
import type { WorldLocation } from '../../../src/domain/schemas/location-schema.js';
import type { BehaviorAgent } from '../../../src/domain/systems/behavior-agent.js';
import type { JourneyState } from '../../../src/domain/core/component-data.js';

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
		position: { x, y, region: 'test' },
		relationships: '',
		tools: [],
		color: '#b0b0b0',
		persona: null,
		behavior_tree: 'bt/merchant.md',
		job: null,
		property: [],
		...overrides,
	};
}

function createTestLocation(id: string, x: number, y: number): WorldLocation {
	return { id, name: id, type: 'food', position: { x, y, region: 'test' }, capacity: 10, color: '#808080' };
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

function createAgentWithBa(id: string, x = 0, y = 0, overrides: Record<string, unknown> = {}, baOverrides: Partial<BehaviorAgent> = {}): AgentActor {
	const agent = new AgentActor(createTestAgentData(id, x, y, overrides), defaultMoodConfig);
	agent.behaviorAgent = createStubBehaviorAgent(baOverrides);
	return agent;
}

describe('MovementSystem', () => {
	it('sets velocity toward target location', () => {
		const agent = createAgentWithBa('agent-1', 0, 0, {}, {
			movementTarget: { id: 'loc-food-1', type: 'location' },
		});

		const locations = [createTestLocation('loc-food-1', 100, 0)];
		const system = createMovementSystem(() => [agent], () => locations);

		system.execute(createDeps());

		// Velocity should point toward target (positive x, zero y)
		expect(agent.vel.x).toBeGreaterThan(0);
		expect(agent.vel.y).toBeCloseTo(0);
		// DX=10, divisor=4, interval=500ms -> speedPerTick=2.5, speedPerSec=5.0
		expect(agent.vel.x).toBeCloseTo(5.0, 2);
		expect(agent.vel.y).toBeCloseTo(0, 2);
	});

	it('emits AgentArrived and clears movementTarget on arrival', () => {
		const eventBus = createEventBus();
		const events: GameEvent[] = [];
		eventBus.on('AgentArrived', (e) => { events.push(e); });

		// Place agent very close to target — within one step
		const agent = createAgentWithBa('agent-2', 0, 0, {}, {
			movementTarget: { id: 'loc-food-1', type: 'location' },
		});

		const locations = [createTestLocation('loc-food-1', 1, 0)];
		const system = createMovementSystem(() => [agent], () => locations);

		system.execute(createDeps(eventBus));

		// Should have arrived
		expect(events.length).toBe(1);
		expect(events[0]?.payload.agentId).toBe('agent-2');
		expect(events[0]?.payload.targetId).toBe('loc-food-1');
		expect(events[0]?.payload.targetType).toBe('location');

		// movementTarget should be cleared
		expect(agent.behaviorAgent.movementTarget).toBeNull();

		// Agent should be snapped to the target position
		expect(agent.pos.x).toBeCloseTo(1, 1);
		expect(agent.pos.y).toBeCloseTo(0, 1);
	});

	it('zeroes velocity when no movementTarget', () => {
		const agent = createAgentWithBa('agent-3', 50, 50);

		const system = createMovementSystem(() => [agent], () => []);

		expect(() => { system.execute(createDeps()); }).not.toThrow();
		expect(agent.vel.x).toBe(0);
		expect(agent.vel.y).toBe(0);
		expect(agent.pos.x).toBeCloseTo(50);
		expect(agent.pos.y).toBeCloseTo(50);
	});

	it('sets velocity toward another agent target', () => {
		const agent1 = createAgentWithBa('agent-1', 0, 0, {}, {
			movementTarget: { id: 'agent-2', type: 'agent' },
		});
		const agent2 = createAgentWithBa('agent-2', 200, 0);

		const system = createMovementSystem(() => [agent1, agent2], () => []);

		system.execute(createDeps());

		// Velocity should point toward agent2 (positive x)
		expect(agent1.vel.x).toBeGreaterThan(0);
		expect(agent1.vel.y).toBeCloseTo(0);
	});

	it('higher DX produces higher velocity', () => {
		const slowAgent = createAgentWithBa('slow', 0, 0, { attributes: { ST: 10, DX: 4, IQ: 10, HT: 10 } }, {
			movementTarget: { id: 'loc-food-1', type: 'location' },
		});
		const fastAgent = createAgentWithBa('fast', 0, 0, { attributes: { ST: 10, DX: 20, IQ: 10, HT: 10 } }, {
			movementTarget: { id: 'loc-food-1', type: 'location' },
		});

		const locations = [createTestLocation('loc-food-1', 1000, 0)];
		const system = createMovementSystem(() => [slowAgent, fastAgent], () => locations);

		system.execute(createDeps());

		// Fast agent has higher velocity
		expect(fastAgent.vel.x).toBeGreaterThan(slowAgent.vel.x);
	});

	it('moving agent loses energy each tick', () => {
		const agent = createAgentWithBa('agent-1', 0, 0, { needs: { hunger: 80, energy: 90, social: 70, thirst: 80 } }, {
			movementTarget: { id: 'loc-food-1', type: 'location' },
		});

		const locations = [createTestLocation('loc-food-1', 100, 0)];
		const system = createMovementSystem(() => [agent], () => locations);

		system.execute(createDeps());

		const needs = agent.get(NeedsComponent);
		// DX=10, divisor=4 -> speedPerTick=2.5, movement_energy_cost=0.005 -> drain=0.0125
		expect(needs.state.energy).toBeCloseTo(90 - 0.0125);
	});

	it('exhausted agent moves at half speed', () => {
		// energy < 15 (NEED_CRITICAL_THRESHOLDS.energy) -> exhaustion_speed_modifier = 0.5
		const agent = createAgentWithBa('agent-1', 0, 0, { needs: { hunger: 80, energy: 10, social: 70, thirst: 80 } }, {
			movementTarget: { id: 'loc-food-1', type: 'location' },
		});

		const locations = [createTestLocation('loc-food-1', 100, 0)];
		const system = createMovementSystem(() => [agent], () => locations);

		system.execute(createDeps());

		// Normal speed: DX=10, divisor=4, interval=500ms -> 5.0 px/sec
		// Exhausted: 5.0 * 0.5 = 2.5 px/sec
		expect(agent.vel.x).toBeCloseTo(2.5, 2);
	});

	it('does not re-arrive when agent is already at target location', () => {
		const eventBus = createEventBus();
		const events: GameEvent[] = [];
		eventBus.on('AgentArrived', (e) => { events.push(e); });

		const agent = createAgentWithBa('agent-1', 10, 0, {}, {
			atLocation: 'loc-food-1',
			movementTarget: { id: 'loc-food-1', type: 'location' },
		});

		const locations = [createTestLocation('loc-food-1', 10, 0)];
		const system = createMovementSystem(() => [agent], () => locations);

		system.execute(createDeps(eventBus));

		// movementTarget should be consumed silently
		expect(agent.behaviorAgent.movementTarget).toBeNull();
		// atLocation should be preserved
		expect(agent.behaviorAgent.atLocation).toBe('loc-food-1');
		// No arrival event — agent was already there
		expect(events.length).toBe(0);
		// Agent should not be moving
		expect(agent.vel.x).toBe(0);
		expect(agent.vel.y).toBe(0);
	});

	it('populates knownLocations on first arrival at a location', () => {
		const agent = createAgentWithBa('agent-1', 0, 0, {}, {
			movementTarget: { id: 'loc-food-1', type: 'location' },
		});

		const locations = [createTestLocation('loc-food-1', 1, 0)];
		const system = createMovementSystem(() => [agent], () => locations);

		system.execute(createDeps());

		expect(agent.behaviorAgent.knownLocations).toContain('loc-food-1');
	});

	it('does not duplicate knownLocations on repeat arrival', () => {
		const agent = createAgentWithBa('agent-1', 0, 0, {}, {
			knownLocations: ['loc-food-1'],
			movementTarget: { id: 'loc-food-1', type: 'location' },
		});

		const locations = [createTestLocation('loc-food-1', 1, 0)];
		const system = createMovementSystem(() => [agent], () => locations);

		system.execute(createDeps());

		expect(agent.behaviorAgent.knownLocations.filter(l => l === 'loc-food-1')).toHaveLength(1);
	});

	it('emits AgentExhausted when energy crosses 0', () => {
		const eventBus = createEventBus();
		const events: GameEvent[] = [];
		eventBus.on('AgentExhausted', (e) => { events.push(e); });

		// Start with very low energy that will cross 0 (drain = speed 2.5 * cost 0.02 = 0.05)
		const agent = createAgentWithBa('agent-1', 0, 0, { needs: { hunger: 80, energy: 0.01, social: 70, thirst: 80 } }, {
			movementTarget: { id: 'loc-food-1', type: 'location' },
		});

		const locations = [createTestLocation('loc-food-1', 100, 0)];
		const system = createMovementSystem(() => [agent], () => locations);

		system.execute(createDeps(eventBus));

		expect(events.length).toBe(1);
		expect(events[0]?.payload.agentId).toBe('agent-1');

		const needs = agent.get(NeedsComponent);
		expect(needs.state.energy).toBe(0);
	});

	it('navigates journey waypoints — advances waypointIndex on arrival', () => {
		const eventBus = createEventBus();
		const events: GameEvent[] = [];
		eventBus.on('RegionEntered', (e) => { events.push(e); });

		const journey: JourneyState = {
			waypoints: [
				{ regionId: 'region-forest', crossingPoint: { x: 1, y: 0 }, travelCost: 5 },
				{ regionId: 'region-mountain', crossingPoint: { x: 50, y: 0 }, travelCost: 10 },
			],
			waypointIndex: 0,
			finalTarget: { id: 'loc-village', type: 'location' },
			totalCost: 15,
		};

		const agent = createAgentWithBa('agent-1', 0, 0, {}, {
			movementTarget: { id: JOURNEY_SENTINEL, type: 'location' },
			journey,
			currentRegion: 'region-start',
		});

		const system = createMovementSystem(() => [agent], () => []);
		system.execute(createDeps(eventBus));

		// Agent should arrive at first waypoint and advance to waypointIndex 1
		expect(agent.behaviorAgent.journey).not.toBeNull();
		expect(agent.behaviorAgent.journey!.waypointIndex).toBe(1);
		expect(agent.behaviorAgent.currentRegion).toBe('region-forest');
		expect(agent.behaviorAgent.movementTarget).toEqual({ id: JOURNEY_SENTINEL, type: 'location' });

		// RegionEntered event should be emitted
		expect(events.length).toBe(1);
		expect(events[0]?.payload.fromRegion).toBe('region-start');
		expect(events[0]?.payload.toRegion).toBe('region-forest');
		expect(events[0]?.payload.travelCost).toBe(5);
	});

	it('completes journey — routes to finalTarget after last waypoint', () => {
		const eventBus = createEventBus();
		const events: GameEvent[] = [];
		eventBus.on('RegionEntered', (e) => { events.push(e); });

		const journey: JourneyState = {
			waypoints: [
				{ regionId: 'region-village', crossingPoint: { x: 1, y: 0 }, travelCost: 3 },
			],
			waypointIndex: 0,
			finalTarget: { id: 'loc-market', type: 'location' },
			totalCost: 3,
		};

		const agent = createAgentWithBa('agent-1', 0, 0, {}, {
			movementTarget: { id: JOURNEY_SENTINEL, type: 'location' },
			journey,
			currentRegion: 'region-start',
		});

		const system = createMovementSystem(() => [agent], () => []);
		system.execute(createDeps(eventBus));

		// Journey complete — should route to final target
		expect(agent.behaviorAgent.journey).toBeNull();
		expect(agent.behaviorAgent.movementTarget).toEqual({ id: 'loc-market', type: 'location' });
		expect(agent.behaviorAgent.currentRegion).toBe('region-village');
		expect(events.length).toBe(1);
	});

	it('halts journey when stamina depleted at waypoint arrival', () => {
		const eventBus = createEventBus();

		const journey: JourneyState = {
			waypoints: [
				{ regionId: 'region-far', crossingPoint: { x: 1, y: 0 }, travelCost: 100 },
				{ regionId: 'region-farther', crossingPoint: { x: 200, y: 0 }, travelCost: 50 },
			],
			waypointIndex: 0,
			finalTarget: { id: 'loc-dest', type: 'location' },
			totalCost: 150,
		};

		const agent = createAgentWithBa('agent-1', 0, 0, {}, {
			movementTarget: { id: JOURNEY_SENTINEL, type: 'location' },
			journey,
			currentRegion: 'region-start',
		});
		// Set stamina to exactly the cost — will reach 0
		const stamina = agent.get(StaminaComponent);
		stamina.state = { current: 100, max: 200 };

		const system = createMovementSystem(() => [agent], () => []);
		system.execute(createDeps(eventBus));

		// Stamina depleted — journey should be halted, agent stopped
		expect(stamina.state.current).toBe(0);
		expect(agent.behaviorAgent.journey).toBeNull();
		expect(agent.behaviorAgent.movementTarget).toBeNull();
		expect(agent.behaviorAgent.currentRegion).toBe('region-far');
		expect(agent.vel.x).toBe(0);
		expect(agent.vel.y).toBe(0);
	});

	it('stops and zeroes velocity when movementTarget references non-existent location', () => {
		const agent = createAgentWithBa('agent-1', 50, 50, {}, {
			movementTarget: { id: 'loc-nonexistent', type: 'location' },
		});

		const system = createMovementSystem(() => [agent], () => []);
		system.execute(createDeps());

		// Target not found — agent should stop
		expect(agent.vel.x).toBe(0);
		expect(agent.vel.y).toBe(0);
		// Position unchanged
		expect(agent.pos.x).toBe(50);
		expect(agent.pos.y).toBe(50);
	});

	it('stops and zeroes velocity when movementTarget references non-existent agent', () => {
		const agent = createAgentWithBa('agent-1', 30, 40, {}, {
			movementTarget: { id: 'ghost-agent', type: 'agent' },
		});

		const system = createMovementSystem(() => [agent], () => []);
		system.execute(createDeps());

		expect(agent.vel.x).toBe(0);
		expect(agent.vel.y).toBe(0);
		expect(agent.pos.x).toBe(30);
		expect(agent.pos.y).toBe(40);
	});

	it('assigns unique arrivalSlots when multiple agents arrive at the same location', () => {
		const eventBus = createEventBus();
		const events: GameEvent[] = [];
		eventBus.on('AgentArrived', (e) => { events.push(e); });

		// First agent already at location (simulating prior arrival)
		const agent1 = createAgentWithBa('agent-1', 10, 0, {}, {
			atLocation: 'loc-food-1',
		});

		// Second agent arriving very close to target
		const agent2 = createAgentWithBa('agent-2', 9.5, 0, {}, {
			movementTarget: { id: 'loc-food-1', type: 'location' },
		});

		const locations = [createTestLocation('loc-food-1', 10, 0)];
		const system = createMovementSystem(() => [agent1, agent2], () => locations);
		system.execute(createDeps(eventBus));

		// agent2 should arrive with slotIndex=1 (agent1 occupies slot 0)
		expect(agent2.behaviorAgent.atLocation).toBe('loc-food-1');
		expect(agent2.behaviorAgent.arrivalSlot).toBe(1);
		expect(events.length).toBe(1);
		expect(events[0]?.payload.agentId).toBe('agent-2');
	});

	it('clears atLocation and arrivalSlot when agent starts moving to a new target', () => {
		const agent = createAgentWithBa('agent-1', 10, 0, {}, {
			atLocation: 'loc-food-1',
			arrivalSlot: 0,
			movementTarget: { id: 'loc-food-2', type: 'location' },
		});

		const locations = [
			createTestLocation('loc-food-1', 10, 0),
			createTestLocation('loc-food-2', 200, 0),
		];
		const system = createMovementSystem(() => [agent], () => locations);
		system.execute(createDeps());

		// atLocation and arrivalSlot should be cleared upon departure
		expect(agent.behaviorAgent.atLocation).toBeNull();
		expect(agent.behaviorAgent.arrivalSlot).toBeNull();
		// Agent should be moving toward the new target
		expect(agent.vel.x).toBeGreaterThan(0);
	});

	it('recovers stamina when idle (no movementTarget)', () => {
		const agent = createAgentWithBa('agent-1', 0, 0);
		const stamina = agent.get(StaminaComponent);
		stamina.state = { current: 50, max: 100 };

		const system = createMovementSystem(() => [agent], () => []);
		const deps = createDeps();
		system.execute(deps);

		// Should recover by recovery_per_idle_tick (default 0.05)
		expect(stamina.state.current).toBe(50.05);
	});

	it('does not recover stamina beyond max when idle', () => {
		const agent = createAgentWithBa('agent-1', 0, 0);
		const stamina = agent.get(StaminaComponent);
		stamina.state = { current: 100, max: 100 };

		const system = createMovementSystem(() => [agent], () => []);
		system.execute(createDeps());

		// Already at max — no change
		expect(stamina.state.current).toBe(100);
	});

	it('sets insideFacility = true when arriving at location with FacilityComponent', () => {
		const agent = createAgentWithBa('agent-1', 0, 0, {}, {
			movementTarget: { id: 'loc-farm', type: 'location' },
		});

		const locations = [createTestLocation('loc-farm', 1, 0)];

		// Create a location actor with FacilityComponent
		const locActor = new Actor();
		locActor.addComponent(new FacilityComponent({
			stock: [], fund: 100, workProgress: 0, status: 'idle', workerId: null,
		}));
		const locationActors = new Map<string, Actor>([['loc-farm', locActor]]);

		const system = createMovementSystem(() => [agent], () => locations, () => locationActors);
		system.execute(createDeps());

		expect(agent.behaviorAgent.atLocation).toBe('loc-farm');
		expect(agent.behaviorAgent.insideFacility).toBe(true);
	});

	it('sets insideFacility = false when departing (atLocation cleared)', () => {
		const agent = createAgentWithBa('agent-1', 10, 0, {}, {
			atLocation: 'loc-farm',
			arrivalSlot: 0,
			insideFacility: true,
			movementTarget: { id: 'loc-food-2', type: 'location' },
		});

		const locations = [
			createTestLocation('loc-farm', 10, 0),
			createTestLocation('loc-food-2', 200, 0),
		];
		const system = createMovementSystem(() => [agent], () => locations);
		system.execute(createDeps());

		// Agent departed — insideFacility should be cleared
		expect(agent.behaviorAgent.atLocation).toBeNull();
		expect(agent.behaviorAgent.insideFacility).toBe(false);
	});

	it('does not set insideFacility when arriving at non-facility location', () => {
		const agent = createAgentWithBa('agent-1', 0, 0, {}, {
			movementTarget: { id: 'loc-plain', type: 'location' },
		});

		const locations = [createTestLocation('loc-plain', 1, 0)];

		// Location actor without FacilityComponent
		const locActor = new Actor();
		const locationActors = new Map<string, Actor>([['loc-plain', locActor]]);

		const system = createMovementSystem(() => [agent], () => locations, () => locationActors);
		system.execute(createDeps());

		expect(agent.behaviorAgent.atLocation).toBe('loc-plain');
		expect(agent.behaviorAgent.insideFacility).toBe(false);
	});
});
