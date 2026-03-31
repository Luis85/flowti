import { describe, it, expect, vi } from 'vitest';
import { createTickRunner } from '../../src/infrastructure/engine/tick-runner.js';
import { createEventBus } from '../../src/infrastructure/event-bus.js';
import { createPerformanceTracker } from '../../src/infrastructure/performance/performance-tracker.js';
import { GameConfigSchema } from '../../src/domain/schemas/game-config-schema.js';
import { AgentActor } from '../../src/infrastructure/entity/agent-actor.js';
import { BlackboardComponent } from '../../src/infrastructure/components/blackboard-component.js';
import { MoodComponent } from '../../src/infrastructure/components/mood-component.js';
import { MemoryComponent } from '../../src/infrastructure/components/memory-component.js';
import { RelationshipComponent } from '../../src/infrastructure/components/relationship-component.js';
import { PerceptionComponent } from '../../src/infrastructure/components/perception-component.js';
import { NeedsComponent } from '../../src/infrastructure/components/needs-component.js';
import { TimeComponent } from '../../src/infrastructure/components/time-component.js';
import { EconomyComponent } from '../../src/infrastructure/components/economy-component.js';
import { createSocializeSystem } from '../../src/infrastructure/systems/socialize-system.js';
import { createDialogueSystem } from '../../src/infrastructure/systems/dialogue-system.js';
import { createGossipSystem } from '../../src/infrastructure/systems/gossip-system.js';
import { createRelationshipCheckpointSystem } from '../../src/infrastructure/systems/relationship-checkpoint-system.js';
import { Actor } from 'excalibur';
import type { GameCoreDeps } from '../../src/domain/core/game-deps.js';
import type { WorldLocation } from '../../src/domain/schemas/location-schema.js';
import type { Agent } from '../../src/domain/schemas/agent-schema.js';

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

function createTestAgent(id: string, name: string, kind: string, x: number, y: number): Agent {
	return {
		id, name, kind,
		attributes: { ST: 10, DX: 10, IQ: 10, HT: 10 },
		social: { status: 0, reputation: 0, charisma: 10 },
		needs: { hunger: 80, energy: 80, social: 50 },
		mood: 0, memory: [], goals: [], skills: [], inventory: [],
		equipment: { head: null, body: null, hands: null, tool: null, accessory: null },
		traits: [], wallet: { gold: 50 }, xp: 0, level: 1,
		position: { x, y, region: 'test' }, relationships: '',
		color: '#b0b0b0', persona: null, property: [],
		tools: [], behavior_tree: 'bt-test', job: null,
	} as Agent;
}

function createWorldEntity(): Actor {
	const world = new Actor();
	world.addComponent(new TimeComponent({ phase: 'day', tickInCycle: 60, dayCount: 0 }));
	world.addComponent(new EconomyComponent({
		treasury: 500, ledger: [], dailySummary: { totalWages: 0, totalTax: 0, totalSales: 0, totalConsumption: 0 },
	}));
	return world;
}

function createDeps(eventBus: ReturnType<typeof createEventBus>, writeFile: GameCoreDeps['writeFile'] = null): GameCoreDeps {
	return {
		logger: { debug() {}, info() {}, warn() {}, error() {} },
		eventBus,
		config: GameConfigSchema.parse({}),
		performanceTracker: createPerformanceTracker(),
		tickCount: 0,
		writeFile,
	};
}

describe('Social Pipeline Integration', () => {
	it('socialize → dialogue → gossip produces full social interaction', () => {
		const eventBus = createEventBus();

		// Create two agents: Elena (merchant) and Marcus (guard)
		const elenaData = createTestAgent('agent-elena', 'Elena', 'merchant', 100, 100);
		const marcusData = createTestAgent('agent-marcus', 'Marcus', 'guard', 100, 100);

		const elena = new AgentActor(elenaData, defaultMoodConfig);
		const marcus = new AgentActor(marcusData, defaultMoodConfig);

		// Set btAction='talk' on both agents
		const elenaBb = elena.get(BlackboardComponent);
		elenaBb.state = { ...elenaBb.state, btAction: 'talk', knownLocations: ['loc-bakery'] };
		elenaBb.markDirty();

		const marcusBb = marcus.get(BlackboardComponent);
		marcusBb.state = { ...marcusBb.state, btAction: 'talk' };
		marcusBb.markDirty();

		// Set perception: each agent sees the other at distance 5
		const elenaPerception = elena.get(PerceptionComponent);
		elenaPerception.state = {
			nearbyAgents: [{ id: 'agent-marcus', distance: 5 }],
			nearbyLocations: [],
		};
		elenaPerception.markDirty();

		const marcusPerception = marcus.get(PerceptionComponent);
		marcusPerception.state = {
			nearbyAgents: [{ id: 'agent-elena', distance: 5 }],
			nearbyLocations: [],
		};
		marcusPerception.markDirty();

		// Set mood to 'content' for predictable positive tone
		const elenaMood = elena.get(MoodComponent);
		elenaMood.state = { value: 30, bucket: 'content' };
		elenaMood.markDirty();

		const marcusMood = marcus.get(MoodComponent);
		marcusMood.state = { value: 30, bucket: 'content' };
		marcusMood.markDirty();

		// Give them existing relationship with familiarity 5 (above gossip threshold of 3)
		const elenaRel = elena.get(RelationshipComponent);
		elenaRel.state = {
			entries: [{
				agentId: 'agent-marcus',
				disposition: 10,
				familiarity: 5,
				tags: [],
				lastInteractionTick: 0,
			}],
		};
		elenaRel.markDirty();

		const marcusRel = marcus.get(RelationshipComponent);
		marcusRel.state = {
			entries: [{
				agentId: 'agent-elena',
				disposition: 10,
				familiarity: 5,
				tags: [],
				lastInteractionTick: 0,
			}],
		};
		marcusRel.markDirty();

		// Create location data including a bakery
		const bakeryLocation: WorldLocation = {
			id: 'loc-bakery', name: 'Village Bakery', type: 'food',
			position: { x: 200, y: 200, region: 'test' }, capacity: 10, color: '#d4a574',
			production: null,
		};

		const agents = [elena, marcus];
		const locations = [bakeryLocation];
		const getAgents = () => agents;
		const getLocations = () => locations;

		// Create tick runner and register all 4 social pipeline systems
		const runner = createTickRunner(eventBus);
		runner.register(createSocializeSystem(getAgents));
		runner.register(createDialogueSystem(getAgents, Date.now()));
		runner.register(createGossipSystem(getAgents, getLocations));
		runner.register(createRelationshipCheckpointSystem(getAgents));

		// Run one tick
		const deps = createDeps(eventBus);
		runner.tick(deps);

		// Assert: both agents have dialogue memories (type='dialogue', not 'social')
		const elenaMemories = elena.get(MemoryComponent).state.entries;
		const marcusMemories = marcus.get(MemoryComponent).state.entries;

		const elenaDialogue = elenaMemories.filter(m => m.type === 'dialogue');
		const marcusDialogue = marcusMemories.filter(m => m.type === 'dialogue');
		expect(elenaDialogue.length).toBeGreaterThanOrEqual(1);
		expect(marcusDialogue.length).toBeGreaterThanOrEqual(1);

		// The original social memories should have been replaced by dialogue
		const elenaSocial = elenaMemories.filter(m => m.type === 'social');
		const marcusSocial = marcusMemories.filter(m => m.type === 'social');
		expect(elenaSocial.length).toBe(0);
		expect(marcusSocial.length).toBe(0);

		// Assert: Marcus has gossip about the bakery (from Elena's knownLocations)
		const marcusGossip = marcusMemories.filter(m => m.type === 'gossip');
		expect(marcusGossip.length).toBeGreaterThanOrEqual(1);
		const bakeryGossip = marcusGossip.find(m =>
			m.metadata !== undefined && (m.metadata as Record<string, unknown>)['locationId'] === 'loc-bakery',
		);
		expect(bakeryGossip).toBeDefined();

		// Assert: RelationshipComponent disposition changed (dialogue adds disposition change)
		const elenaRelAfter = elena.get(RelationshipComponent).state.entries;
		const marcusRelAfter = marcus.get(RelationshipComponent).state.entries;
		const elenaToMarcus = elenaRelAfter.find(e => e.agentId === 'agent-marcus');
		const marcusToElena = marcusRelAfter.find(e => e.agentId === 'agent-elena');
		expect(elenaToMarcus).toBeDefined();
		expect(marcusToElena).toBeDefined();
		// 'talked_with' tag should be set by dialogue system
		expect(elenaToMarcus!.tags).toContain('talked_with');
		expect(marcusToElena!.tags).toContain('talked_with');

		// Assert: gossipPending cleared on both agents
		const elenaBbAfter = elena.get(BlackboardComponent);
		const marcusBbAfter = marcus.get(BlackboardComponent);
		expect(elenaBbAfter.state.gossipPending).toBeUndefined();
		expect(marcusBbAfter.state.gossipPending).toBeUndefined();
	});

	it('checkpoint writes canvas after interval', () => {
		const eventBus = createEventBus();

		const elenaData = createTestAgent('agent-elena', 'Elena', 'merchant', 100, 100);
		const marcusData = createTestAgent('agent-marcus', 'Marcus', 'guard', 100, 100);

		const elena = new AgentActor(elenaData, defaultMoodConfig);
		const marcus = new AgentActor(marcusData, defaultMoodConfig);

		// Give them a relationship for the canvas to serialize
		const elenaRel = elena.get(RelationshipComponent);
		elenaRel.state = {
			entries: [{
				agentId: 'agent-marcus',
				disposition: 10,
				familiarity: 5,
				tags: ['talked_with'],
				lastInteractionTick: 0,
			}],
		};
		elenaRel.markDirty();

		const agents = [elena, marcus];
		const locations: WorldLocation[] = [];
		const getAgents = () => agents;
		const getLocations = () => locations;

		const writeFile = vi.fn().mockResolvedValue(undefined);

		const runner = createTickRunner(eventBus);
		runner.register(createSocializeSystem(getAgents));
		runner.register(createDialogueSystem(getAgents, Date.now()));
		runner.register(createGossipSystem(getAgents, getLocations));
		runner.register(createRelationshipCheckpointSystem(getAgents));

		const deps = createDeps(eventBus, writeFile);

		// Default canvas_checkpoint_interval_ticks is 50 — run 50 ticks
		for (let i = 0; i < 50; i++) {
			deps.tickCount = i;
			runner.tick(deps);
		}

		// Assert writeFile was called with valid canvas JSON
		expect(writeFile).toHaveBeenCalled();
		const lastCall = writeFile.mock.calls[writeFile.mock.calls.length - 1] as [string, string];
		expect(lastCall[0]).toContain('relationships.canvas');

		const canvasContent = JSON.parse(lastCall[1]) as { nodes: unknown[]; edges: unknown[] };
		expect(canvasContent.nodes).toBeDefined();
		expect(canvasContent.edges).toBeDefined();
		expect(Array.isArray(canvasContent.nodes)).toBe(true);
		expect(Array.isArray(canvasContent.edges)).toBe(true);
	});
});
