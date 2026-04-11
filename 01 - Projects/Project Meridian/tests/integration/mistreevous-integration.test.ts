import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BehaviourTree } from 'mistreevous';
import { AgentSchema } from '../../src/domain/schemas/agent-schema.js';
import { LocationSchema } from '../../src/domain/schemas/location-schema.js';
import { GameConfigSchema } from '../../src/domain/schemas/game-config-schema.js';
import { AgentActor } from '../../src/infrastructure/entity/agent-actor.js';
import { TimeComponent } from '../../src/infrastructure/components/time-component.js';
import { EconomyComponent } from '../../src/infrastructure/components/economy-component.js';
import { FacilityComponent } from '../../src/infrastructure/components/facility-component.js';
import { NeedsComponent } from '../../src/infrastructure/components/needs-component.js';
import { PerceptionComponent } from '../../src/infrastructure/components/perception-component.js';
import { createBehaviorAgent } from '../../src/infrastructure/entity/behavior-agent-factory.js';
import { createGameRNG, hashString } from '../../src/domain/core/game-rng.js';
import { Actor } from 'excalibur';
import type { WorldLocation } from '../../src/domain/schemas/location-schema.js';
import type { EventBus } from '../../src/domain/core/events.js';

const noopEventBus: EventBus = {
	emit: () => {},
	on: () => () => {},
	off: () => {},
	onAny: () => () => {},
	filter: () => () => {},
	history: () => [],
};

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '../..');

function loadJobMdsl(jobName: string): string {
	const btDir = resolve(projectRoot, 'behavior-trees');
	const jobsDir = resolve(projectRoot, 'jobs');
	const base = readFileSync(resolve(btDir, 'base.mdsl'), 'utf-8');
	const job = readFileSync(resolve(jobsDir, `${jobName}.mdsl`), 'utf-8');
	return base + '\n\n' + job;
}

function loadJoblessMdsl(): string {
	const btDir = resolve(projectRoot, 'behavior-trees');
	const base = readFileSync(resolve(btDir, 'base.mdsl'), 'utf-8');
	return base.replace(/branch\s*\[Job\]/, 'action [Wander]');
}

const defaultMoodConfig = {
	factor_weights: { needs: 30, positive_memories: 20, negative_memories: 20, goal_progress: 10, wallet: 10, equipment: 5, relationships: 5 },
	buckets: [
		{ name: 'elated', min: 60, max: 100 },
		{ name: 'content', min: 20, max: 59 },
		{ name: 'stressed', min: -19, max: 19 },
		{ name: 'distressed', min: -59, max: -20 },
		{ name: 'breakdown', min: -100, max: -60 },
	],
	external_modifier_cap: 30,
};

function createSettlerData(overrides: Record<string, unknown> = {}) {
	const raw = JSON.parse(readFileSync(resolve(projectRoot, 'agents/aldric.json'), 'utf-8'));
	const parsed = AgentSchema.parse(raw);
	return { ...parsed, ...overrides };
}

const locations: WorldLocation[] = [
	LocationSchema.parse({
		id: 'loc-farm', name: 'Farm', facility_type: 'farm', active_recipe: 'recipe-farm-wheat',
		position: { x: 100, y: 100 }, capacity: 8, color: '#7cba3f',
	}),
	LocationSchema.parse({
		id: 'loc-bakery', name: 'Bakery', facility_type: 'bakery', active_recipe: 'recipe-bake-bread',
		position: { x: 200, y: 100 }, capacity: 6, color: '#d2691e',
	}),
	LocationSchema.parse({
		id: 'loc-market', name: 'Market', facility_type: 'market_stall',
		position: { x: 300, y: 100 }, capacity: 20, color: '#ccaa00',
	}),
	LocationSchema.parse({
		id: 'loc-tavern', name: 'Tavern', facility_type: 'tavern',
		position: { x: 400, y: 100 }, capacity: 10, color: '#8b4513',
	}),
];

describe('mistreevous BT integration', () => {
	it('Settler selects actions via BT evaluation', () => {
		const config = GameConfigSchema.parse({});
		const mdsl = loadJoblessMdsl();

		// Create Settler with low hunger so BT triggers survival behavior
		const elenaData = createSettlerData({ needs: { hunger: 20, energy: 80, social: 80, thirst: 80 } });
		const actor = new AgentActor(elenaData, defaultMoodConfig);

		const worldEntity = new Actor();
		worldEntity.addComponent(new TimeComponent({ phase: 'dusk', tickInCycle: 300, dayCount: 0, dayBoundaryThisTick: false }));
		worldEntity.addComponent(new EconomyComponent({
			treasury: 500, ledger: [],
			dailySummary: { totalWages: 0, totalTax: 0, totalSales: 0, totalConsumption: 0, avgWage: 0, wageSpread: 0, vacancyCount: 0, unemploymentCount: 0, jobSwitchesThisDay: 0, supplyDeliveries: 0, questsCompletedThisDay: 0 },
		}));

		const locationActors = new Map<string, Actor>();
		for (const loc of locations) {
			const marker = new Actor({ x: loc.position.x, y: loc.position.y });
			marker.addComponent(new FacilityComponent({
				stock: [{ item_id: 'food', quantity: 5 }],
				fund: 200, workProgress: 0, status: 'idle', workerId: null,
			}));
			locationActors.set(loc.id, marker);
		}

		const getWorld = () => worldEntity;
		const getLocationActors = () => locationActors;
		const getLocations = () => locations;

		const behaviorAgent = createBehaviorAgent({
			actor,
			worldEntity: getWorld,
			config,
			getLocationActors,
			getLocations,
			tickCount: () => 300,
			eventBus: noopEventBus,
		});

		const rng = createGameRNG(hashString(actor.agentId));
		const tree = new BehaviourTree(mdsl, behaviorAgent, {
			random: () => rng.next(),
			getDeltaTime: () => config.tick_interval_ms / 1000,
		});

		actor.behaviorAgent = behaviorAgent;
		actor.behaviorTree = tree;

		// Seed perception so BT conditions have data to work with
		const perception = actor.get(PerceptionComponent);
		perception.state = {
			nearbyAgents: [],
			nearbyLocations: locations.map(l => ({
				id: l.id,
				type: l.type,
				distance: Math.abs(actor.pos.x - l.position.x) + Math.abs(actor.pos.y - l.position.y),
			})),
		};
		perception.markDirty();

		// Step the tree multiple times and collect actions
		const actions = new Set<string | null>();
		for (let i = 0; i < 5; i++) {
			tree.step();
			actions.add(behaviorAgent.btAction);
		}

		// With hunger=20 (<50), BT should trigger survival branch
		// Settler has gold >= food_price (3) and nearby facilities have food,
		// so should buy, seek food, or eat
		expect(actions.has('seek_food') || actions.has('eat') || actions.has('buy'),
			`Expected seek_food, eat, or buy, got: ${JSON.stringify([...actions])}`).toBe(true);

		// If agent chose buy (at facility with stock), movementTarget may be null.
		// If agent chose seek_food, movementTarget should be set.
		if (actions.has('seek_food')) {
			expect(behaviorAgent.movementTarget).not.toBeNull();
		}
	});

	it('agents commit to actions via RUNNING state', () => {
		const config = GameConfigSchema.parse({});
		const mdsl = loadJoblessMdsl();

		// Settler with low hunger + has food → Eat action should fire
		// Use dusk phase so work-hours priorities (P1, P2) don't preempt hunger behavior
		const elenaData = createSettlerData({
			needs: { hunger: 20, energy: 80, social: 80, thirst: 80 },
			inventory: [{ item_id: 'food', quantity: 5 }],
		});
		const actor = new AgentActor(elenaData, defaultMoodConfig);

		const worldEntity = new Actor();
		worldEntity.addComponent(new TimeComponent({ phase: 'dusk', tickInCycle: 300, dayCount: 0, dayBoundaryThisTick: false }));
		worldEntity.addComponent(new EconomyComponent({
			treasury: 500, ledger: [],
			dailySummary: { totalWages: 0, totalTax: 0, totalSales: 0, totalConsumption: 0, avgWage: 0, wageSpread: 0, vacancyCount: 0, unemploymentCount: 0, jobSwitchesThisDay: 0, supplyDeliveries: 0, questsCompletedThisDay: 0 },
		}));

		const locationActors = new Map<string, Actor>();
		const getWorld = () => worldEntity;
		const getLocationActors = () => locationActors;
		const getLocations = () => locations;

		const behaviorAgent = createBehaviorAgent({
			actor,
			worldEntity: getWorld,
			config,
			getLocationActors,
			getLocations,
			tickCount: () => 300,
			eventBus: noopEventBus,
		});

		const rng = createGameRNG(hashString(actor.agentId));
		const tree = new BehaviourTree(mdsl, behaviorAgent, {
			random: () => rng.next(),
			getDeltaTime: () => config.tick_interval_ms / 1000,
		});

		actor.behaviorAgent = behaviorAgent;
		actor.behaviorTree = tree;

		// Seed empty perception
		const perception = actor.get(PerceptionComponent);
		perception.state = { nearbyAgents: [], nearbyLocations: [] };
		perception.markDirty();

		// Step 1: BT evaluates — should select Eat (has food, is hungry)
		tree.step();
		const firstAction = behaviorAgent.btAction;
		expect(firstAction, 'First step should select an action').not.toBeNull();

		// Step 2: Same state — should continue same action (RUNNING, not oscillate)
		tree.step();
		const secondAction = behaviorAgent.btAction;
		expect(secondAction).toBe(firstAction);

		// Step 3: Satisfy hunger by setting it high — BT guard should switch action
		const needs = actor.get(NeedsComponent);
		needs.state = { ...needs.state, hunger: 90 };
		needs.markDirty();

		tree.step();
		const thirdAction = behaviorAgent.btAction;
		// With hunger=90 (>50), the IsHungry condition fails, so BT should fall through
		// to role-specific behavior or wander
		expect(thirdAction).not.toBe('eat');
	});
});
