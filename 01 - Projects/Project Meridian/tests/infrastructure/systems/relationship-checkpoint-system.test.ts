import { describe, it, expect, vi } from 'vitest';
import { createRelationshipCheckpointSystem } from '../../../src/infrastructure/systems/relationship-checkpoint-system.js';
import { AgentActor } from '../../../src/infrastructure/entity/agent-actor.js';
import { RelationshipComponent } from '../../../src/infrastructure/components/relationship-component.js';
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

function createTestAgentData(id: string, name: string, overrides: Record<string, unknown> = {}) {
	return {
		id,
		name,
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
		property: [],
		tools: [],
		behavior_tree: 'bt-merchant',
		job: null,
		...overrides,
	};
}

function createDeps(overrides: Partial<GameCoreDeps> = {}): GameCoreDeps {
	return {
		logger: { debug() {}, info() {}, warn() {}, error() {} },
		eventBus: createEventBus(),
		config: GameConfigSchema.parse({}),
		performanceTracker: createPerformanceTracker(),
		tickCount: 1,
		writeFile: null,
		dataRoot: 'test-data',
		...overrides,
	};
}

function makeAgentPair(): [AgentActor, AgentActor] {
	const alice = new AgentActor(createTestAgentData('agent-alice', 'Alice'), defaultMoodConfig);
	const bob = new AgentActor(createTestAgentData('agent-bob', 'Bob'), defaultMoodConfig);

	// Give Alice a relationship with Bob
	const aliceRel = alice.get(RelationshipComponent);
	aliceRel.state = {
		entries: [{ agentId: 'agent-bob', disposition: 25, familiarity: 5, tags: ['friend'], lastInteractionTick: 0 }],
	};

	return [alice, bob];
}

describe('RelationshipCheckpointSystem', () => {
	it('writes canvas file every N ticks (default 50)', () => {
		const writeFile = vi.fn<(path: string, content: string) => Promise<void>>().mockResolvedValue(undefined);
		const [alice, bob] = makeAgentPair();
		const system = createRelationshipCheckpointSystem(() => [alice, bob]);

		// Run 50 ticks to reach the interval
		for (let i = 1; i <= 50; i++) {
			system.execute(createDeps({ writeFile, tickCount: i }));
		}

		expect(writeFile).toHaveBeenCalledTimes(1);
	});

	it('does not write before interval reached', () => {
		const writeFile = vi.fn<(path: string, content: string) => Promise<void>>().mockResolvedValue(undefined);
		const [alice, bob] = makeAgentPair();
		const system = createRelationshipCheckpointSystem(() => [alice, bob]);

		// Run 49 ticks — one short of the interval
		for (let i = 1; i <= 49; i++) {
			system.execute(createDeps({ writeFile, tickCount: i }));
		}

		expect(writeFile).not.toHaveBeenCalled();
	});

	it('writeFile called with correct path', () => {
		const writeFile = vi.fn<(path: string, content: string) => Promise<void>>().mockResolvedValue(undefined);
		const [alice, bob] = makeAgentPair();
		const system = createRelationshipCheckpointSystem(() => [alice, bob]);

		for (let i = 1; i <= 50; i++) {
			system.execute(createDeps({ writeFile, tickCount: i }));
		}

		expect(writeFile).toHaveBeenCalledWith(
			'test-data/Graphs/relationships.canvas',
			expect.any(String),
		);
	});

	it('written content is parseable JSON with nodes and edges', () => {
		const writeFile = vi.fn<(path: string, content: string) => Promise<void>>().mockResolvedValue(undefined);
		const [alice, bob] = makeAgentPair();
		const system = createRelationshipCheckpointSystem(() => [alice, bob]);

		for (let i = 1; i <= 50; i++) {
			system.execute(createDeps({ writeFile, tickCount: i }));
		}

		const content = writeFile.mock.calls[0]?.[1] as string;
		const parsed = JSON.parse(content) as { nodes: unknown[]; edges: unknown[] };
		expect(Array.isArray(parsed.nodes)).toBe(true);
		expect(Array.isArray(parsed.edges)).toBe(true);
		expect(parsed.nodes).toHaveLength(2);
		expect(parsed.edges).toHaveLength(1);
	});

	it('emits RelationshipGraphCheckpointed event', () => {
		const eventBus = createEventBus();
		const events: GameEvent[] = [];
		eventBus.on('RelationshipGraphCheckpointed', (e) => { events.push(e); });

		const [alice, bob] = makeAgentPair();
		const system = createRelationshipCheckpointSystem(() => [alice, bob]);

		for (let i = 1; i <= 50; i++) {
			system.execute(createDeps({ eventBus, tickCount: i }));
		}

		expect(events).toHaveLength(1);
		expect(events[0]?.payload.agentCount).toBe(2);
		expect(events[0]?.payload.edgeCount).toBe(1);
		expect(events[0]?.payload.path).toBe('test-data/Graphs/relationships.canvas');
	});

	it('handles RequestAgentRelationshipView from event history', () => {
		const eventBus = createEventBus();
		const writeFile = vi.fn<(path: string, content: string) => Promise<void>>().mockResolvedValue(undefined);

		const [alice, bob] = makeAgentPair();
		const system = createRelationshipCheckpointSystem(() => [alice, bob]);

		// Emit a view request event at tick 1
		eventBus.emit({
			type: 'RequestAgentRelationshipView',
			tick: 1,
			wallClock: Date.now(),
			source: 'DirectorUI',
			payload: { agentId: 'agent-alice' },
		});

		system.execute(createDeps({ eventBus, writeFile, tickCount: 1 }));

		// Should write the per-agent view file (not the checkpoint — that needs 50 ticks)
		expect(writeFile).toHaveBeenCalledWith(
			'test-data/Graphs/Alice-relationships.canvas',
			expect.any(String),
		);
	});

	it('uses deps.dataRoot for graph checkpoint path', () => {
		const writeFile = vi.fn<(path: string, content: string) => Promise<void>>().mockResolvedValue(undefined);
		const eventBus = createEventBus();
		const events: GameEvent[] = [];
		eventBus.on('RelationshipGraphCheckpointed', (e) => { events.push(e); });

		const [alice, bob] = makeAgentPair();
		const system = createRelationshipCheckpointSystem(() => [alice, bob]);

		for (let i = 1; i <= 50; i++) {
			system.execute(createDeps({ writeFile, eventBus, tickCount: i, dataRoot: '01 - Projects/Project Meridian' }));
		}

		expect(writeFile).toHaveBeenCalledWith(
			'01 - Projects/Project Meridian/Graphs/relationships.canvas',
			expect.any(String),
		);
		expect(events[0]?.payload.path).toBe('01 - Projects/Project Meridian/Graphs/relationships.canvas');
	});

	it('uses deps.dataRoot for per-agent relationship view path', () => {
		const eventBus = createEventBus();
		const writeFile = vi.fn<(path: string, content: string) => Promise<void>>().mockResolvedValue(undefined);

		const [alice, bob] = makeAgentPair();
		const system = createRelationshipCheckpointSystem(() => [alice, bob]);

		eventBus.emit({
			type: 'RequestAgentRelationshipView',
			tick: 1,
			wallClock: Date.now(),
			source: 'DirectorUI',
			payload: { agentId: 'agent-alice' },
		});

		system.execute(createDeps({ eventBus, writeFile, tickCount: 1, dataRoot: '01 - Projects/Project Meridian' }));

		expect(writeFile).toHaveBeenCalledWith(
			'01 - Projects/Project Meridian/Graphs/Alice-relationships.canvas',
			expect.any(String),
		);
	});

	it('skips write when deps.writeFile is null', () => {
		const eventBus = createEventBus();
		const events: GameEvent[] = [];
		eventBus.on('RelationshipGraphCheckpointed', (e) => { events.push(e); });

		const [alice, bob] = makeAgentPair();
		const system = createRelationshipCheckpointSystem(() => [alice, bob]);

		// Run 50 ticks with writeFile = null — should not throw
		for (let i = 1; i <= 50; i++) {
			system.execute(createDeps({ eventBus, writeFile: null, tickCount: i }));
		}

		// Event should still be emitted even though writeFile is null
		expect(events).toHaveLength(1);
		expect(events[0]?.payload.agentCount).toBe(2);
	});
});
