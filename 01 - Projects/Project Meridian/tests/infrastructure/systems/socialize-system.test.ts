import { describe, it, expect } from 'vitest';
import { createSocializeSystem } from '../../../src/infrastructure/systems/socialize-system.js';
import { AgentActor } from '../../../src/infrastructure/entity/agent-actor.js';
import { NeedsComponent } from '../../../src/infrastructure/components/needs-component.js';
import { BlackboardComponent } from '../../../src/infrastructure/components/blackboard-component.js';
import { MemoryComponent } from '../../../src/infrastructure/components/memory-component.js';
import { PerceptionComponent } from '../../../src/infrastructure/components/perception-component.js';
import { GameConfigSchema } from '../../../src/domain/schemas/game-config-schema.js';
import { createPerformanceTracker } from '../../../src/infrastructure/performance/performance-tracker.js';
import { createEventBus } from '../../../src/infrastructure/event-bus.js';
import type { GameCoreDeps } from '../../../src/domain/core/game-deps.js';
import type { GameEvent } from '../../../src/domain/core/events.js';

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
		needs: { hunger: 50, energy: 50, social: 50 },
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
	};
}

function setupPair(
	opts: { agent1Social?: number; agent2Social?: number; distance?: number; btAction1?: string; btAction2?: string } = {},
) {
	const { agent1Social = 50, agent2Social = 50, distance = 10, btAction1 = 'talk', btAction2 } = opts;

	const agent1 = new AgentActor(
		createTestAgentData('agent-elena', 100, 100, { name: 'Elena', needs: { hunger: 50, energy: 50, social: agent1Social } }),
		defaultMoodConfig,
	);
	const agent2 = new AgentActor(
		createTestAgentData('agent-marcus', 110, 100, { name: 'Marcus', needs: { hunger: 50, energy: 50, social: agent2Social } }),
		defaultMoodConfig,
	);

	// Add PerceptionComponent (normally added by game-view, not AgentActor constructor)
	agent1.addComponent(new PerceptionComponent({ nearbyAgents: [{ id: 'agent-marcus', distance }], nearbyLocations: [] }));
	agent2.addComponent(new PerceptionComponent({ nearbyAgents: [{ id: 'agent-elena', distance }], nearbyLocations: [] }));

	// Set BT actions
	const bb1 = agent1.get(BlackboardComponent);
	bb1.state = { ...bb1.state, btAction: btAction1 };

	if (btAction2 !== undefined) {
		const bb2 = agent2.get(BlackboardComponent);
		bb2.state = { ...bb2.state, btAction: btAction2 };
	}

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

		// Both agents should have social recovery (recovery_rate = 0.5)
		expect(agent1.get(NeedsComponent).state.social).toBeCloseTo(50.5);
		expect(agent2.get(NeedsComponent).state.social).toBeCloseTo(50.5);

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

		// Second tick at 110 — within cooldown_ticks (50), no new memory
		// Reset BT action (it doesn't persist between ticks in a real system)
		const bb1 = agent1.get(BlackboardComponent);
		bb1.state = { ...bb1.state, btAction: 'talk' };

		const eventBus2 = createEventBus();
		const events: GameEvent[] = [];
		eventBus2.on('SocialInteraction', (e) => { events.push(e); });

		system.execute(createDeps(eventBus2, 110));

		// Social should still recover (second tick)
		// First tick: 50 + 0.5 = 50.5, second tick: 50.5 + 0.5 = 51.0
		expect(agent1.get(NeedsComponent).state.social).toBeCloseTo(51.0);
		expect(agent2.get(NeedsComponent).state.social).toBeCloseTo(51.0);

		// Memory should NOT have increased — still just 1 entry from first tick
		expect(agent1.get(MemoryComponent).state.entries.length).toBe(1);
		expect(agent2.get(MemoryComponent).state.entries.length).toBe(1);

		// Event still emitted (with memoryCreated: false)
		expect(events.length).toBe(1);
		expect(events[0]?.payload.memoryCreated).toBe(false);
	});

	it('skips agent with non-social btAction', () => {
		const eventBus = createEventBus();
		const events: GameEvent[] = [];
		eventBus.on('SocialInteraction', (e) => { events.push(e); });

		const { agent1, agent2 } = setupPair({ btAction1: 'seek_food' });
		const system = createSocializeSystem(() => [agent1, agent2]);
		system.execute(createDeps(eventBus, 100));

		// No social recovery
		expect(agent1.get(NeedsComponent).state.social).toBe(50);
		expect(agent2.get(NeedsComponent).state.social).toBe(50);

		// No event
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

		// Both still get social recovery (from the single processing)
		expect(agent1.get(NeedsComponent).state.social).toBeCloseTo(50.5);
		expect(agent2.get(NeedsComponent).state.social).toBeCloseTo(50.5);

		// Both get memory
		expect(agent1.get(MemoryComponent).state.entries.length).toBe(1);
		expect(agent2.get(MemoryComponent).state.entries.length).toBe(1);
	});
});
