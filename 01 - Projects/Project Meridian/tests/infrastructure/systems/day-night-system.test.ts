import { describe, it, expect } from 'vitest';
import { Actor } from 'excalibur';
import { createDayNightSystem } from '../../../src/infrastructure/systems/day-night-system.js';
import { TimeComponent } from '../../../src/infrastructure/components/time-component.js';
import { EconomyComponent } from '../../../src/infrastructure/components/economy-component.js';
import { AgentActor } from '../../../src/infrastructure/entity/agent-actor.js';
import { GameConfigSchema } from '../../../src/domain/schemas/game-config-schema.js';
import { createPerformanceTracker } from '../../../src/infrastructure/performance/performance-tracker.js';
import { createEventBus } from '../../../src/infrastructure/event-bus.js';
import type { GameCoreDeps } from '../../../src/domain/core/game-deps.js';
import type { GameEvent } from '../../../src/domain/core/events.js';

function createWorldEntity(): Actor {
	const actor = new Actor();
	actor.addComponent(new TimeComponent({ phase: 'dawn', tickInCycle: 0, dayCount: 0, dayBoundaryThisTick: false }));
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
		expect(time.state.phase).toBe('day');
		expect(time.state.tickInCycle).toBe(60);
		expect(time.state.dayCount).toBe(0);
		expect(time.dirty).toBe(true);
	});

	it('emits DayPhaseChanged event when phase transitions', () => {
		const worldEntity = createWorldEntity();
		worldEntity.get(TimeComponent).state = { phase: 'dawn', tickInCycle: 59, dayCount: 0, dayBoundaryThisTick: false };
		const eventBus = createEventBus();
		const events: GameEvent[] = [];
		eventBus.on('DayPhaseChanged', (e) => { events.push(e); });

		const system = createDayNightSystem(() => worldEntity);
		system.execute(createDeps(eventBus, 60));

		expect(events.length).toBe(1);
		expect(events[0]?.payload.oldPhase).toBe('dawn');
		expect(events[0]?.payload.newPhase).toBe('day');
		expect(events[0]?.payload.dayCount).toBe(0);
	});

	it('does not emit DayPhaseChanged when phase is unchanged', () => {
		const worldEntity = createWorldEntity();
		worldEntity.get(TimeComponent).state = { phase: 'day', tickInCycle: 61, dayCount: 0, dayBoundaryThisTick: false };
		const eventBus = createEventBus();
		const events: GameEvent[] = [];
		eventBus.on('DayPhaseChanged', (e) => { events.push(e); });

		const system = createDayNightSystem(() => worldEntity);
		system.execute(createDeps(eventBus, 62));

		expect(events.length).toBe(0);
	});

	it('advances day count when cycling through a full day', () => {
		const worldEntity = createWorldEntity();
		const config = GameConfigSchema.parse({});
		const system = createDayNightSystem(() => worldEntity);

		system.execute(createDeps(createEventBus(), config.ticks_per_day));

		const time = worldEntity.get(TimeComponent);
		expect(time.state.dayCount).toBe(1);
	});

	it('sets dayBoundaryThisTick flag on day increment', () => {
		const config = GameConfigSchema.parse({});
		const worldEntity = createWorldEntity();
		worldEntity.addComponent(new EconomyComponent({ treasury: 500, ledger: [], dailySummary: { totalWages: 0, totalTax: 0, totalSales: 0, totalConsumption: 0, avgWage: 0, wageSpread: 0, vacancyCount: 0, unemploymentCount: 0, jobSwitchesThisDay: 0, supplyDeliveries: 0, questsCompletedThisDay: 0 } }));

		const system = createDayNightSystem(() => worldEntity);
		system.execute(createDeps(createEventBus(), 0));
		expect(worldEntity.get(TimeComponent).state.dayBoundaryThisTick).toBe(false);

		system.execute(createDeps(createEventBus(), config.ticks_per_day));
		expect(worldEntity.get(TimeComponent).state.dayBoundaryThisTick).toBe(true);
	});

	it('clears dayBoundaryThisTick flag at start of next tick', () => {
		const config = GameConfigSchema.parse({});
		const worldEntity = createWorldEntity();
		worldEntity.addComponent(new EconomyComponent({ treasury: 500, ledger: [], dailySummary: { totalWages: 0, totalTax: 0, totalSales: 0, totalConsumption: 0, avgWage: 0, wageSpread: 0, vacancyCount: 0, unemploymentCount: 0, jobSwitchesThisDay: 0, supplyDeliveries: 0, questsCompletedThisDay: 0 } }));

		const system = createDayNightSystem(() => worldEntity);
		system.execute(createDeps(createEventBus(), 0));
		system.execute(createDeps(createEventBus(), config.ticks_per_day));
		expect(worldEntity.get(TimeComponent).state.dayBoundaryThisTick).toBe(true);

		system.execute(createDeps(createEventBus(), config.ticks_per_day + 1));
		expect(worldEntity.get(TimeComponent).state.dayBoundaryThisTick).toBe(false);
	});

	it('adds treasury regen at day boundary', () => {
		const config = GameConfigSchema.parse({});
		const worldEntity = createWorldEntity();
		worldEntity.addComponent(new EconomyComponent({ treasury: 500, ledger: [], dailySummary: { totalWages: 0, totalTax: 0, totalSales: 0, totalConsumption: 0, avgWage: 0, wageSpread: 0, vacancyCount: 0, unemploymentCount: 0, jobSwitchesThisDay: 0, supplyDeliveries: 0, questsCompletedThisDay: 0 } }));
		const defaultMoodConfig = {
			factor_weights: { needs: 30, positive_memories: 20, negative_memories: 20, goal_progress: 10, wallet: 10, equipment: 5, relationships: 5 },
			buckets: [{ name: 'stressed', min: -100, max: 100 }],
			external_modifier_cap: 30,
		};
		const agent1 = new AgentActor({
			id: 'a1', name: 'a1', kind: 'villager',
			attributes: { ST: 10, DX: 10, IQ: 10, HT: 10 },
			social: { status: 0, reputation: 0, charisma: 10 },
			needs: { hunger: 50, energy: 50, social: 50, thirst: 50 },
			mood: 0, memory: [], goals: [], skills: [], inventory: [],
			equipment: { head: null, body: null, hands: null, tool: null, accessory: null },
			traits: [], wallet: { gold: 100 }, xp: 0, level: 1,
			position: { x: 0, y: 0, region: 'test' }, relationships: '',
			color: '#b0b0b0', property: [],
			tools: [], behavior_tree: 'bt-villager', job: null,
		}, defaultMoodConfig);
		const agent2 = new AgentActor({
			id: 'a2', name: 'a2', kind: 'villager',
			attributes: { ST: 10, DX: 10, IQ: 10, HT: 10 },
			social: { status: 0, reputation: 0, charisma: 10 },
			needs: { hunger: 50, energy: 50, social: 50, thirst: 50 },
			mood: 0, memory: [], goals: [], skills: [], inventory: [],
			equipment: { head: null, body: null, hands: null, tool: null, accessory: null },
			traits: [], wallet: { gold: 100 }, xp: 0, level: 1,
			position: { x: 0, y: 0, region: 'test' }, relationships: '',
			color: '#b0b0b0', property: [],
			tools: [], behavior_tree: 'bt-villager', job: null,
		}, defaultMoodConfig);

		const agents = [agent1, agent2];
		const system = createDayNightSystem(() => worldEntity, () => agents);
		system.execute(createDeps(createEventBus(), 0));
		const before = worldEntity.get(EconomyComponent).state.treasury;

		system.execute(createDeps(createEventBus(), config.ticks_per_day));
		const after = worldEntity.get(EconomyComponent).state.treasury;

		expect(after - before).toBe(config.economy.treasury_regen_per_agent_per_day * agents.length);
	});
});

// ── Tests moved to dedicated system test files ────────────────────────────
// Economy liveness: → tests/infrastructure/systems/daily-report-system.test.ts
// Welfare: → tests/infrastructure/systems/welfare-system.test.ts
// Stipends: → tests/infrastructure/systems/stipend-system.test.ts
// Subsidies: → tests/infrastructure/systems/subsidy-system.test.ts
// Equipment decay: → tests/infrastructure/systems/equipment-decay-system.test.ts
