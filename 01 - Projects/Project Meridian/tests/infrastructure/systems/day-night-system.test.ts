import { describe, it, expect } from 'vitest';
import { Actor } from 'excalibur';
import { createDayNightSystem } from '../../../src/infrastructure/systems/day-night-system.js';
import { TimeComponent } from '../../../src/infrastructure/components/time-component.js';
import { EconomyComponent } from '../../../src/infrastructure/components/economy-component.js';
import { NeedsComponent } from '../../../src/infrastructure/components/needs-component.js';
import { AgentActor } from '../../../src/infrastructure/entity/agent-actor.js';
import { GameConfigSchema } from '../../../src/domain/schemas/game-config-schema.js';
import { createPerformanceTracker } from '../../../src/infrastructure/performance/performance-tracker.js';
import { createEventBus } from '../../../src/infrastructure/event-bus.js';
import type { GameCoreDeps } from '../../../src/domain/core/game-deps.js';
import type { GameEvent } from '../../../src/domain/core/events.js';

function createWorldEntity(): Actor {
	const actor = new Actor();
	actor.addComponent(new TimeComponent({ phase: 'dawn', tickInCycle: 0, dayCount: 0 }));
	return actor;
}

function createDeps(eventBus = createEventBus(), tickCount = 0): GameCoreDeps {
	return {
		logger: { debug() {}, info() {}, warn() {}, error() {} },
		eventBus,
		config: GameConfigSchema.parse({}),
		performanceTracker: createPerformanceTracker(),
		tickCount,
		writeFile: null,
	};
}

describe('DayNightSystem', () => {
	it('writes TimeComponent state from advanceTime', () => {
		const worldEntity = createWorldEntity();
		const system = createDayNightSystem(() => worldEntity);

		system.execute(createDeps(createEventBus(), 60));

		const time = worldEntity.get(TimeComponent);
		// tick 60 is in the 'day' phase per defaults (day: start=60, end=299)
		expect(time.state.phase).toBe('day');
		expect(time.state.tickInCycle).toBe(60);
		expect(time.state.dayCount).toBe(0);
		expect(time.dirty).toBe(true);
	});

	it('emits DayPhaseChanged event when phase transitions', () => {
		const worldEntity = createWorldEntity();
		// Manually set phase to 'dawn' so the transition to 'day' is detectable
		worldEntity.get(TimeComponent).state = { phase: 'dawn', tickInCycle: 59, dayCount: 0 };
		const eventBus = createEventBus();
		const events: GameEvent[] = [];
		eventBus.on('DayPhaseChanged', (e) => { events.push(e); });

		const system = createDayNightSystem(() => worldEntity);
		// tick 60 = start of 'day'; previous tick 59 = end of 'dawn' => phase change
		system.execute(createDeps(eventBus, 60));

		expect(events.length).toBe(1);
		expect(events[0]?.payload.oldPhase).toBe('dawn');
		expect(events[0]?.payload.newPhase).toBe('day');
		expect(events[0]?.payload.dayCount).toBe(0);
	});

	it('does not emit DayPhaseChanged when phase is unchanged', () => {
		const worldEntity = createWorldEntity();
		worldEntity.get(TimeComponent).state = { phase: 'day', tickInCycle: 61, dayCount: 0 };
		const eventBus = createEventBus();
		const events: GameEvent[] = [];
		eventBus.on('DayPhaseChanged', (e) => { events.push(e); });

		const system = createDayNightSystem(() => worldEntity);
		// tick 62 is still 'day', so no phase change
		system.execute(createDeps(eventBus, 62));

		expect(events.length).toBe(0);
	});

	it('advances day count when cycling through a full day', () => {
		const worldEntity = createWorldEntity();
		const config = GameConfigSchema.parse({});
		const system = createDayNightSystem(() => worldEntity);

		// tick = ticks_per_day (480) means dayCount = 1
		system.execute(createDeps(createEventBus(), config.ticks_per_day));

		const time = worldEntity.get(TimeComponent);
		expect(time.state.dayCount).toBe(1);
	});
});

const defaultMoodConfig = {
	factor_weights: { needs: 30, positive_memories: 20, negative_memories: 20, goal_progress: 10, wallet: 10, equipment: 5, relationships: 5 },
	buckets: [{ name: 'stressed', min: -100, max: 100 }],
	external_modifier_cap: 30,
};

function createTestAgentData(id: string, overrides: Record<string, unknown> = {}) {
	return {
		id, name: id, kind: 'villager',
		attributes: { ST: 10, DX: 10, IQ: 10, HT: 10 },
		social: { status: 0, reputation: 0, charisma: 10 },
		needs: { hunger: 50, energy: 50, social: 50 },
		mood: 0, memory: [], goals: [], skills: [], inventory: [],
		equipment: { head: null, body: null, hands: null, tool: null, accessory: null },
		traits: [], wallet: { gold: 100 }, xp: 0, level: 1,
		position: { x: 0, y: 0, region: 'test' }, relationships: '',
		color: '#b0b0b0', persona: null, property: [],
		tools: [], behavior_tree: 'bt-villager', job: null,
		...overrides,
	};
}

function createWorldWithEconomy(dailySummary = { totalWages: 0, totalTax: 0, totalSales: 0, totalConsumption: 0 }): Actor {
	const actor = new Actor();
	actor.addComponent(new TimeComponent({ phase: 'dawn', tickInCycle: 0, dayCount: 0 }));
	actor.addComponent(new EconomyComponent({ treasury: 500, ledger: [], dailySummary }));
	return actor;
}

describe('DayNightSystem — economy liveness', () => {
	it('emits EconomyCollapsed when all agents have hunger 0 at day boundary', () => {
		const config = GameConfigSchema.parse({});
		const worldEntity = createWorldWithEconomy();
		const agent1 = new AgentActor(createTestAgentData('a1', { needs: { hunger: 0, energy: 50, social: 50 } }), defaultMoodConfig);
		const agent2 = new AgentActor(createTestAgentData('a2', { needs: { hunger: 0, energy: 50, social: 50 } }), defaultMoodConfig);

		// Verify hunger is actually 0 on both agents
		expect(agent1.get(NeedsComponent).state.hunger).toBe(0);
		expect(agent2.get(NeedsComponent).state.hunger).toBe(0);

		const eventBus = createEventBus();
		const events: GameEvent[] = [];
		eventBus.on('EconomyCollapsed', (e) => { events.push(e); });

		const system = createDayNightSystem(
			() => worldEntity,
			() => [agent1, agent2],
		);

		// First execute at tick 0 to initialize previousDayCount = 0
		system.execute(createDeps(eventBus, 0));
		expect(events.length).toBe(0);

		// Execute at ticks_per_day to trigger day boundary (dayCount 0 → 1)
		system.execute(createDeps(eventBus, config.ticks_per_day));

		expect(events.length).toBe(1);
		expect(events[0]?.payload.reason).toBe('all_agents_starving');
		expect(events[0]?.payload.dayCount).toBe(1);
	});

	it('emits ProductionStalled when no wages paid in a day', () => {
		const config = GameConfigSchema.parse({});
		const worldEntity = createWorldWithEconomy({ totalWages: 0, totalTax: 0, totalSales: 5, totalConsumption: 0 });

		// Use agents with hunger > 0 so we only test the production stall path
		const agent1 = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);

		const eventBus = createEventBus();
		const events: GameEvent[] = [];
		eventBus.on('ProductionStalled', (e) => { events.push(e); });

		const system = createDayNightSystem(
			() => worldEntity,
			() => [agent1],
		);

		// Initialize previousDayCount
		system.execute(createDeps(eventBus, 0));
		expect(events.length).toBe(0);

		// Trigger day boundary
		system.execute(createDeps(eventBus, config.ticks_per_day));

		expect(events.length).toBe(1);
		expect(events[0]?.payload.reason).toBe('no_production');
		expect(events[0]?.payload.dayCount).toBe(1);
	});

	it('does not emit EconomyCollapsed when some agents have hunger above 0', () => {
		const config = GameConfigSchema.parse({});
		const worldEntity = createWorldWithEconomy();
		const starving = new AgentActor(createTestAgentData('a1', { needs: { hunger: 0, energy: 50, social: 50 } }), defaultMoodConfig);
		const healthy = new AgentActor(createTestAgentData('a2', { needs: { hunger: 50, energy: 50, social: 50 } }), defaultMoodConfig);

		const eventBus = createEventBus();
		const events: GameEvent[] = [];
		eventBus.on('EconomyCollapsed', (e) => { events.push(e); });

		const system = createDayNightSystem(
			() => worldEntity,
			() => [starving, healthy],
		);

		system.execute(createDeps(eventBus, 0));
		system.execute(createDeps(eventBus, config.ticks_per_day));

		expect(events.length).toBe(0);
	});

	it('does not emit ProductionStalled when wages were paid', () => {
		const config = GameConfigSchema.parse({});
		const worldEntity = createWorldWithEconomy({ totalWages: 10, totalTax: 0, totalSales: 0, totalConsumption: 0 });
		const agent1 = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);

		const eventBus = createEventBus();
		const events: GameEvent[] = [];
		eventBus.on('ProductionStalled', (e) => { events.push(e); });

		const system = createDayNightSystem(
			() => worldEntity,
			() => [agent1],
		);

		system.execute(createDeps(eventBus, 0));
		system.execute(createDeps(eventBus, config.ticks_per_day));

		expect(events.length).toBe(0);
	});
});
