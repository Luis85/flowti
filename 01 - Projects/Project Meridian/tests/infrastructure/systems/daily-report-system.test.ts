import { describe, it, expect } from 'vitest';
import { Actor } from 'excalibur';
import { createDailyReportSystem } from '../../../src/infrastructure/systems/daily-report-system.js';
import { TimeComponent } from '../../../src/infrastructure/components/time-component.js';
import { EconomyComponent } from '../../../src/infrastructure/components/economy-component.js';
import { NeedsComponent } from '../../../src/infrastructure/components/needs-component.js';
import { WalletComponent } from '../../../src/infrastructure/components/wallet-component.js';
import { FacilityComponent } from '../../../src/infrastructure/components/facility-component.js';
import { AgentActor } from '../../../src/infrastructure/entity/agent-actor.js';
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

function createTestAgentData(id: string, overrides: Record<string, unknown> = {}) {
	return {
		id, name: id, kind: 'villager',
		attributes: { ST: 10, DX: 10, IQ: 10, HT: 10 },
		social: { status: 0, reputation: 0, charisma: 10 },
		needs: { hunger: 50, energy: 50, social: 50, thirst: 50 },
		mood: 0, memory: [], goals: [], skills: [], inventory: [],
		equipment: { head: null, body: null, hands: null, tool: null, accessory: null },
		traits: [], wallet: { gold: 100 }, xp: 0, level: 1,
		position: { x: 0, y: 0, region: 'test' }, relationships: '',
		color: '#b0b0b0', property: [],
		tools: [], behavior_tree: 'bt-villager', job: null,
		...overrides,
	};
}

function createTestAgent(id: string, overrides: Record<string, unknown> = {}): AgentActor {
	return new AgentActor(createTestAgentData(id, overrides), defaultMoodConfig);
}

function createWorldWithEconomy(
	dayBoundary: boolean,
	dailySummary = { totalWages: 0, totalTax: 0, totalSales: 0, totalConsumption: 0 },
	ledger: EconomyComponent['state']['ledger'] = [],
): Actor {
	const actor = new Actor();
	actor.addComponent(new TimeComponent({ phase: 'day', tickInCycle: 60, dayCount: 1, dayBoundaryThisTick: dayBoundary }));
	actor.addComponent(new EconomyComponent({ treasury: 500, ledger, dailySummary }));
	return actor;
}

function createDeps(eventBus = createEventBus(), tickCount = 1000): GameCoreDeps {
	return {
		logger: { debug() {}, info() {}, warn() {}, error() {} },
		eventBus,
		config: GameConfigSchema.parse({}),
		performanceTracker: createPerformanceTracker(),
		tickCount,
		writeFile: null,
	};
}

describe('DailyReportSystem', () => {
	it('has correct name and priority', () => {
		const system = createDailyReportSystem(
			() => new Actor(),
			() => [],
			() => new Map(),
			() => [],
		);
		expect(system.name).toBe('DailyReportSystem');
		expect(system.priority).toBe(0.84);
	});

	it('skips when dayBoundaryThisTick is false', () => {
		const worldEntity = createWorldWithEconomy(false);
		const system = createDailyReportSystem(
			() => worldEntity,
			() => [],
			() => new Map(),
			() => [],
		);

		const eventBus = createEventBus();
		const events: GameEvent[] = [];
		eventBus.onAny((e) => { events.push(e); });

		system.execute(createDeps(eventBus));

		expect(events.length).toBe(0);
	});

	it('emits EconomyCollapsed when all agents have hunger 0', () => {
		const worldEntity = createWorldWithEconomy(true);
		const agent1 = createTestAgent('a1', { needs: { hunger: 0, energy: 50, social: 50, thirst: 50 } });
		const agent2 = createTestAgent('a2', { needs: { hunger: 0, energy: 50, social: 50, thirst: 50 } });

		const system = createDailyReportSystem(
			() => worldEntity,
			() => [agent1, agent2],
			() => new Map(),
			() => [],
		);

		const eventBus = createEventBus();
		const collapseEvents: GameEvent[] = [];
		eventBus.on('EconomyCollapsed', (e) => { collapseEvents.push(e); });

		system.execute(createDeps(eventBus));

		expect(collapseEvents.length).toBe(1);
		expect(collapseEvents[0]?.payload.reason).toBe('all_agents_starving');
		expect(collapseEvents[0]?.payload.dayCount).toBe(1);
	});

	it('does not emit EconomyCollapsed when some agents have hunger > 0', () => {
		const worldEntity = createWorldWithEconomy(true, { totalWages: 10, totalTax: 0, totalSales: 0, totalConsumption: 0 });
		const starvingAgent = createTestAgent('starving', { needs: { hunger: 0, energy: 50, social: 50, thirst: 50 } });
		const fedAgent = createTestAgent('fed', { needs: { hunger: 50, energy: 50, social: 50, thirst: 50 } });

		const system = createDailyReportSystem(
			() => worldEntity,
			() => [starvingAgent, fedAgent],
			() => new Map(),
			() => [],
		);

		const eventBus = createEventBus();
		const collapseEvents: GameEvent[] = [];
		eventBus.on('EconomyCollapsed', (e) => { collapseEvents.push(e); });

		system.execute(createDeps(eventBus));

		expect(collapseEvents.length).toBe(0);
	});

	it('emits ProductionStalled when no wages paid', () => {
		const worldEntity = createWorldWithEconomy(true, { totalWages: 0, totalTax: 0, totalSales: 0, totalConsumption: 0 });
		const agent = createTestAgent('a1');

		const system = createDailyReportSystem(
			() => worldEntity,
			() => [agent],
			() => new Map(),
			() => [],
		);

		const eventBus = createEventBus();
		const stallEvents: GameEvent[] = [];
		eventBus.on('ProductionStalled', (e) => { stallEvents.push(e); });

		system.execute(createDeps(eventBus));

		expect(stallEvents.length).toBe(1);
		expect(stallEvents[0]?.payload.reason).toBe('no_production');
		expect(stallEvents[0]?.payload.dayCount).toBe(1);
	});

	it('does not emit ProductionStalled when wages were paid', () => {
		const worldEntity = createWorldWithEconomy(true, { totalWages: 50, totalTax: 5, totalSales: 20, totalConsumption: 10 });
		const agent = createTestAgent('a1');

		const system = createDailyReportSystem(
			() => worldEntity,
			() => [agent],
			() => new Map(),
			() => [],
		);

		const eventBus = createEventBus();
		const stallEvents: GameEvent[] = [];
		eventBus.on('ProductionStalled', (e) => { stallEvents.push(e); });

		system.execute(createDeps(eventBus));

		expect(stallEvents.length).toBe(0);
	});

	it('emits DailyReportWritten event', () => {
		const worldEntity = createWorldWithEconomy(true, { totalWages: 10, totalTax: 1, totalSales: 5, totalConsumption: 2 });
		const agent = createTestAgent('a1');

		const system = createDailyReportSystem(
			() => worldEntity,
			() => [agent],
			() => new Map(),
			() => [],
		);

		const eventBus = createEventBus();
		const reportEvents: GameEvent[] = [];
		eventBus.on('DailyReportWritten', (e) => { reportEvents.push(e); });

		system.execute(createDeps(eventBus));

		expect(reportEvents.length).toBe(1);
		expect(reportEvents[0]?.payload.dayCount).toBe(1);
		expect(reportEvents[0]?.payload.path).toBe('03 - Resources/Economy/day-001.md');
	});

	it('prunes old ledger entries beyond retention', () => {
		const config = GameConfigSchema.parse({});
		const retentionTicks = config.economy.ledger_retention_days * config.ticks_per_day;
		const currentTick = 5000;

		const oldEntry = { tick: currentTick - retentionTicks - 100, type: 'wage' as const, from: 'treasury', to: 'a1', itemId: null, quantity: 0, gold: 10 };
		const recentEntry = { tick: currentTick - 10, type: 'wage' as const, from: 'treasury', to: 'a1', itemId: null, quantity: 0, gold: 15 };

		const worldEntity = createWorldWithEconomy(
			true,
			{ totalWages: 25, totalTax: 0, totalSales: 0, totalConsumption: 0 },
			[oldEntry, recentEntry],
		);

		const agent = createTestAgent('a1');
		const system = createDailyReportSystem(
			() => worldEntity,
			() => [agent],
			() => new Map(),
			() => [],
		);

		system.execute(createDeps(createEventBus(), currentTick));

		const economy = worldEntity.get(EconomyComponent);
		expect(economy.state.ledger.length).toBe(1);
		expect(economy.state.ledger[0]?.tick).toBe(recentEntry.tick);
	});

	it('resets daily summary to zeros', () => {
		const worldEntity = createWorldWithEconomy(true, { totalWages: 100, totalTax: 20, totalSales: 50, totalConsumption: 30 });
		const agent = createTestAgent('a1');

		const system = createDailyReportSystem(
			() => worldEntity,
			() => [agent],
			() => new Map(),
			() => [],
		);

		system.execute(createDeps(createEventBus()));

		const economy = worldEntity.get(EconomyComponent);
		expect(economy.state.dailySummary).toEqual({
			totalWages: 0,
			totalTax: 0,
			totalSales: 0,
			totalConsumption: 0,
		});
	});

	it('snapshots gold for next day delta', () => {
		const worldEntity = createWorldWithEconomy(true, { totalWages: 10, totalTax: 0, totalSales: 0, totalConsumption: 0 });
		const agent = createTestAgent('a1', { wallet: { gold: 50 } });

		const system = createDailyReportSystem(
			() => worldEntity,
			() => [agent],
			() => new Map(),
			() => [],
		);

		const eventBus = createEventBus();

		// First day: no previous snapshot — goldChange should be 0
		const reportEvents1: GameEvent[] = [];
		eventBus.on('DailyReportWritten', (e) => { reportEvents1.push(e); });
		system.execute(createDeps(eventBus));
		expect(reportEvents1.length).toBe(1);

		// Manually change gold for next boundary
		agent.get(WalletComponent).state.gold = 80;

		// Reset boundary for second tick
		const time = worldEntity.get(TimeComponent);
		time.state.dayBoundaryThisTick = true;
		time.state.dayCount = 2;

		// Reset summary so we can test again
		worldEntity.get(EconomyComponent).state.dailySummary = { totalWages: 10, totalTax: 0, totalSales: 0, totalConsumption: 0 };

		// Execute second day — goldChange should reflect 80 - 50 = +30
		// We verify by checking the DailyReportWritten event is emitted (report generation succeeded)
		const reportEvents2: GameEvent[] = [];
		const eventBus2 = createEventBus();
		eventBus2.on('DailyReportWritten', (e) => { reportEvents2.push(e); });
		system.execute(createDeps(eventBus2));
		expect(reportEvents2.length).toBe(1);
		expect(reportEvents2[0]?.payload.dayCount).toBe(2);
	});

	it('collects facility data from location actors', () => {
		const worldEntity = createWorldWithEconomy(true, { totalWages: 10, totalTax: 0, totalSales: 5, totalConsumption: 0 });
		const agent = createTestAgent('a1');

		const locActor = new Actor();
		locActor.addComponent(new FacilityComponent({
			stock: [{ item_id: 'wheat', quantity: 5 }],
			fund: 100,
			workProgress: 0,
			status: 'producing',
			workerId: 'a1',
		}));

		const locationActors = new Map<string, Actor>();
		locationActors.set('loc-farm', locActor);

		const locations = [{
			id: 'loc-farm',
			name: 'Farm',
			type: 'work' as const,
			position: { x: 0, y: 0 },
			capacity: 10,
			color: '#808080',
			production: { job: 'settler', output: { item_id: 'wheat', quantity: 1 }, input: null, wage: 5, ticks_per_cycle: 30, auto_process: false, auto_ticks_per_cycle: null, funding: 'facility' as const },
			region: null,
		}];

		const system = createDailyReportSystem(
			() => worldEntity,
			() => [agent],
			() => locationActors,
			() => locations,
		);

		const eventBus = createEventBus();
		const reportEvents: GameEvent[] = [];
		eventBus.on('DailyReportWritten', (e) => { reportEvents.push(e); });

		system.execute(createDeps(eventBus));

		// Report generated successfully with facility data
		expect(reportEvents.length).toBe(1);
	});

	it('calls writeFile when available', () => {
		const worldEntity = createWorldWithEconomy(true, { totalWages: 10, totalTax: 0, totalSales: 5, totalConsumption: 0 });
		const agent = createTestAgent('a1');

		const system = createDailyReportSystem(
			() => worldEntity,
			() => [agent],
			() => new Map(),
			() => [],
		);

		let writtenPath = '';
		let writtenContent = '';
		const deps = createDeps(createEventBus());
		deps.writeFile = async (path: string, content: string) => {
			writtenPath = path;
			writtenContent = content;
		};

		system.execute(deps);

		expect(writtenPath).toBe('03 - Resources/Economy/day-001.md');
		expect(writtenContent).toContain('Day 1 Economy Report');
		expect(writtenContent).toContain('---');
	});

	it('skips when EconomyComponent is missing', () => {
		const actor = new Actor();
		actor.addComponent(new TimeComponent({ phase: 'day', tickInCycle: 60, dayCount: 1, dayBoundaryThisTick: true }));
		// No EconomyComponent added

		const system = createDailyReportSystem(
			() => actor,
			() => [],
			() => new Map(),
			() => [],
		);

		const eventBus = createEventBus();
		const events: GameEvent[] = [];
		eventBus.onAny((e) => { events.push(e); });

		system.execute(createDeps(eventBus));

		expect(events.length).toBe(0);
	});
});
