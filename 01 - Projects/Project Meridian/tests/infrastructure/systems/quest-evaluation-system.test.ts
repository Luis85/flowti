import { describe, it, expect } from 'vitest';
import { Actor } from 'excalibur';
import { createQuestEvaluationSystem } from '../../../src/infrastructure/systems/quest-evaluation-system.js';
import { QuestBoardComponent } from '../../../src/infrastructure/components/quest-board-component.js';
import { GameConfigSchema } from '../../../src/domain/schemas/game-config-schema.js';
import { createPerformanceTracker } from '../../../src/infrastructure/performance/performance-tracker.js';
import { createEventBus } from '../../../src/infrastructure/event-bus.js';
import type { GameCoreDeps } from '../../../src/domain/core/game-deps.js';
import type { GameEvent } from '../../../src/domain/core/events.js';
import type { QuestRuntime } from '../../../src/domain/schemas/quest-schema.js';
import type { AgentActor } from '../../../src/infrastructure/entity/agent-actor.js';
import type { BehaviorAgent } from '../../../src/domain/systems/behavior-agent.js';

function createDeps(eventBus = createEventBus(), tickCount = 480): GameCoreDeps {
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

function makeQuest(overrides: Partial<QuestRuntime> = {}): QuestRuntime {
	return {
		id: 'q-test-1',
		type: 'supply',
		facilityId: 'loc-bakery',
		itemId: 'wheat',
		quantity: 1,
		reward: 10,
		rewardXp: 5,
		state: 'open',
		claimedBy: null,
		createdTick: 100,
		expiryTicks: 960,
		repairProgress: 0,
		...overrides,
	};
}

function createWorldEntity(quests: QuestRuntime[] = []): Actor {
	const actor = new Actor();
	actor.addComponent(new QuestBoardComponent({ quests }));
	return actor;
}

function createMockAgent(id: string, btAction: string | null, atLocation: string | null): AgentActor {
	return {
		agentId: id,
		behaviorAgent: {
			btAction,
			atLocation,
		} as unknown as BehaviorAgent,
	} as unknown as AgentActor;
}

describe('QuestEvaluationSystem', () => {
	it('returns early when QuestBoardComponent not present', () => {
		const worldEntity = new Actor(); // no QuestBoardComponent
		const system = createQuestEvaluationSystem(() => worldEntity, () => []);

		// Should not throw
		expect(() => system.execute(createDeps())).not.toThrow();
	});

	it('expires open quests past expiryTicks', () => {
		const expired = makeQuest({
			id: 'q-old-1',
			facilityId: 'loc-old',
			state: 'open',
			createdTick: 100,
			expiryTicks: 200,
		});
		const worldEntity = createWorldEntity([expired]);
		const system = createQuestEvaluationSystem(() => worldEntity, () => []);

		// tickCount 480 > 100 + 200 = 300, so quest is expired
		system.execute(createDeps(createEventBus(), 480));

		expect(worldEntity.get(QuestBoardComponent).state.quests.length).toBe(0);
	});

	it('emits QuestExpired event with correct payload', () => {
		const expired = makeQuest({
			id: 'q-old-1',
			facilityId: 'loc-mine',
			state: 'open',
			createdTick: 100,
			expiryTicks: 200,
		});
		const worldEntity = createWorldEntity([expired]);
		const system = createQuestEvaluationSystem(() => worldEntity, () => []);

		const eventBus = createEventBus();
		const events: GameEvent[] = [];
		eventBus.on('QuestExpired', (e) => { events.push(e); });

		system.execute(createDeps(eventBus, 480));

		expect(events.length).toBe(1);
		expect(events[0]?.payload.questId).toBe('q-old-1');
		expect(events[0]?.payload.facilityId).toBe('loc-mine');
	});

	it('removes expired quests from the board', () => {
		const expired = makeQuest({
			id: 'q-expired-1',
			state: 'open',
			createdTick: 10,
			expiryTicks: 50,
		});
		const fresh = makeQuest({
			id: 'q-fresh-1',
			state: 'open',
			createdTick: 400,
			expiryTicks: 960,
		});
		const worldEntity = createWorldEntity([expired, fresh]);
		const system = createQuestEvaluationSystem(() => worldEntity, () => []);

		system.execute(createDeps(createEventBus(), 480));

		const board = worldEntity.get(QuestBoardComponent);
		expect(board.state.quests.length).toBe(1);
		expect(board.state.quests[0]?.id).toBe('q-fresh-1');
	});

	it('does not expire claimed quests', () => {
		const claimed = makeQuest({
			id: 'q-claimed-1',
			state: 'claimed',
			claimedBy: 'agent-1',
			createdTick: 100,
			expiryTicks: 200,
		});
		const worldEntity = createWorldEntity([claimed]);
		const system = createQuestEvaluationSystem(() => worldEntity, () => []);

		const eventBus = createEventBus();
		const events: GameEvent[] = [];
		eventBus.on('QuestExpired', (e) => { events.push(e); });

		// tickCount 480 > 100 + 200, but state is 'claimed'
		system.execute(createDeps(eventBus, 480));

		expect(events.length).toBe(0);
		expect(worldEntity.get(QuestBoardComponent).state.quests.length).toBe(1);
	});

	it('increments repairProgress for repair quests when agent is at facility with btAction=repair', () => {
		const quest = makeQuest({
			id: 'q-repair-1',
			type: 'repair',
			facilityId: 'loc-mine',
			state: 'claimed',
			claimedBy: 'agent-1',
			repairProgress: 0,
		});
		const worldEntity = createWorldEntity([quest]);
		const agent = createMockAgent('agent-1', 'repair', 'loc-mine');
		const system = createQuestEvaluationSystem(() => worldEntity, () => [agent]);

		system.execute(createDeps());

		const board = worldEntity.get(QuestBoardComponent);
		expect(board.state.quests[0]?.repairProgress).toBe(1);
	});

	it('does not increment repairProgress when agent not at facility', () => {
		const quest = makeQuest({
			id: 'q-repair-1',
			type: 'repair',
			facilityId: 'loc-mine',
			state: 'claimed',
			claimedBy: 'agent-1',
			repairProgress: 0,
		});
		const worldEntity = createWorldEntity([quest]);
		const agent = createMockAgent('agent-1', 'repair', 'loc-tavern'); // wrong location
		const system = createQuestEvaluationSystem(() => worldEntity, () => [agent]);

		system.execute(createDeps());

		const board = worldEntity.get(QuestBoardComponent);
		expect(board.state.quests[0]?.repairProgress).toBe(0);
	});

	it('does not increment repairProgress when btAction is not repair', () => {
		const quest = makeQuest({
			id: 'q-repair-1',
			type: 'repair',
			facilityId: 'loc-mine',
			state: 'claimed',
			claimedBy: 'agent-1',
			repairProgress: 0,
		});
		const worldEntity = createWorldEntity([quest]);
		const agent = createMockAgent('agent-1', 'work', 'loc-mine'); // wrong action
		const system = createQuestEvaluationSystem(() => worldEntity, () => [agent]);

		system.execute(createDeps());

		const board = worldEntity.get(QuestBoardComponent);
		expect(board.state.quests[0]?.repairProgress).toBe(0);
	});

	it('has correct system name and priority', () => {
		const system = createQuestEvaluationSystem(() => new Actor(), () => []);
		expect(system.name).toBe('QuestEvaluationSystem');
		expect(system.priority).toBe(7);
	});
});
