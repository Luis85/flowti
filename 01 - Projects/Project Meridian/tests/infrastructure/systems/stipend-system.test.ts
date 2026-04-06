import { describe, it, expect } from 'vitest';
import { Actor } from 'excalibur';
import { createStipendSystem } from '../../../src/infrastructure/systems/stipend-system.js';
import { AgentActor } from '../../../src/infrastructure/entity/agent-actor.js';
import { TimeComponent } from '../../../src/infrastructure/components/time-component.js';
import { EconomyComponent } from '../../../src/infrastructure/components/economy-component.js';
import { WalletComponent } from '../../../src/infrastructure/components/wallet-component.js';
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

function createTestAgent(id: string, gold: number, job: string | null = null): AgentActor {
	return new AgentActor({
		id, name: id, kind: 'villager',
		attributes: { ST: 10, DX: 10, IQ: 10, HT: 10 },
		social: { status: 0, reputation: 0, charisma: 10 },
		needs: { hunger: 50, energy: 50, social: 50, thirst: 50 },
		mood: 0, memory: [], goals: [], skills: [], inventory: [],
		equipment: { head: null, body: null, hands: null, tool: null, accessory: null },
		traits: [], wallet: { gold }, xp: 0, level: 1,
		position: { x: 0, y: 0, region: 'test' }, relationships: '',
		color: '#b0b0b0', property: [], tools: [], behavior_tree: 'bt-villager', job,
	}, defaultMoodConfig);
}

function createWorldEntity(dayBoundary: boolean, treasury = 1000): Actor {
	const actor = new Actor();
	actor.addComponent(new TimeComponent({ phase: 'dawn', tickInCycle: 0, dayCount: 1, dayBoundaryThisTick: dayBoundary }));
	actor.addComponent(new EconomyComponent({
		treasury,
		ledger: [],
		dailySummary: { totalWages: 0, totalTax: 0, totalSales: 0, totalConsumption: 0, avgWage: 0, wageSpread: 0, vacancyCount: 0, unemploymentCount: 0, jobSwitchesThisDay: 0, supplyDeliveries: 0, questsCompletedThisDay: 0 },
	}));
	return actor;
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

describe('StipendSystem', () => {
	it('skips when dayBoundaryThisTick is false', () => {
		const worldEntity = createWorldEntity(false);
		const guard = createTestAgent('guard-1', 50, 'guard');
		const system = createStipendSystem(() => worldEntity, () => [guard]);

		const eventBus = createEventBus();
		const events: GameEvent[] = [];
		eventBus.on('StipendPaid', (e) => { events.push(e); });

		system.execute(createDeps(eventBus));

		expect(events.length).toBe(0);
		expect(guard.get(WalletComponent).state.gold).toBe(50);
	});

	it('pays guard stipend', () => {
		const config = GameConfigSchema.parse({});
		const worldEntity = createWorldEntity(true, 1000);
		const guard = createTestAgent('guard-1', 50, 'guard');
		const system = createStipendSystem(() => worldEntity, () => [guard]);

		const eventBus = createEventBus();
		const events: GameEvent[] = [];
		eventBus.on('StipendPaid', (e) => { events.push(e); });

		system.execute(createDeps(eventBus));

		expect(events.length).toBe(1);
		expect(events[0]?.payload.agentId).toBe('guard-1');
		expect(events[0]?.payload.job).toBe('guard');
		expect(events[0]?.payload.amount).toBe(config.economy.guard_stipend);
		expect(guard.get(WalletComponent).state.gold).toBe(50 + config.economy.guard_stipend);
		expect(worldEntity.get(EconomyComponent).state.treasury).toBe(1000 - config.economy.guard_stipend);
	});

	it('pays merchant stipend', () => {
		const config = GameConfigSchema.parse({});
		const worldEntity = createWorldEntity(true, 1000);
		const merchant = createTestAgent('merchant-1', 50, 'merchant');
		const system = createStipendSystem(() => worldEntity, () => [merchant]);

		const eventBus = createEventBus();
		const events: GameEvent[] = [];
		eventBus.on('StipendPaid', (e) => { events.push(e); });

		system.execute(createDeps(eventBus));

		expect(events.length).toBe(1);
		expect(events[0]?.payload.agentId).toBe('merchant-1');
		expect(events[0]?.payload.job).toBe('merchant');
		expect(events[0]?.payload.amount).toBe(config.economy.merchant_stipend);
		expect(merchant.get(WalletComponent).state.gold).toBe(50 + config.economy.merchant_stipend);
	});

	it('emits StipendSkipped when treasury empty', () => {
		const worldEntity = createWorldEntity(true, 0);
		const guard = createTestAgent('guard-1', 50, 'guard');
		const system = createStipendSystem(() => worldEntity, () => [guard]);

		const eventBus = createEventBus();
		const skipped: GameEvent[] = [];
		const paid: GameEvent[] = [];
		eventBus.on('StipendSkipped', (e) => { skipped.push(e); });
		eventBus.on('StipendPaid', (e) => { paid.push(e); });

		system.execute(createDeps(eventBus));

		expect(skipped.length).toBe(1);
		expect(skipped[0]?.payload.agentId).toBe('guard-1');
		expect(paid.length).toBe(0);
		expect(guard.get(WalletComponent).state.gold).toBe(50);
	});

	it('emits GoldFlowed event', () => {
		const config = GameConfigSchema.parse({});
		const worldEntity = createWorldEntity(true, 1000);
		const guard = createTestAgent('guard-1', 50, 'guard');
		const system = createStipendSystem(() => worldEntity, () => [guard]);

		const eventBus = createEventBus();
		const events: GameEvent[] = [];
		eventBus.on('GoldFlowed', (e) => { events.push(e); });

		system.execute(createDeps(eventBus));

		expect(events.length).toBe(1);
		expect(events[0]?.payload.category).toBe('transfer');
		expect(events[0]?.payload.subcategory).toBe('stipend');
		expect(events[0]?.payload.amount).toBe(config.economy.guard_stipend);
		expect(events[0]?.payload.fromEntity).toBe('treasury');
		expect(events[0]?.payload.toEntity).toBe('guard-1');
	});

	it('skips agents without guard or merchant job', () => {
		const worldEntity = createWorldEntity(true, 1000);
		const settler = createTestAgent('settler-1', 50, 'settler');
		const jobless = createTestAgent('jobless-1', 50, null);
		const system = createStipendSystem(() => worldEntity, () => [settler, jobless]);

		const eventBus = createEventBus();
		const events: GameEvent[] = [];
		eventBus.on('StipendPaid', (e) => { events.push(e); });
		eventBus.on('StipendSkipped', (e) => { events.push(e); });

		system.execute(createDeps(eventBus));

		expect(events.length).toBe(0);
		expect(worldEntity.get(EconomyComponent).state.treasury).toBe(1000);
	});

	it('has correct system name and priority', () => {
		const system = createStipendSystem(() => new Actor(), () => []);
		expect(system.name).toBe('StipendSystem');
		expect(system.priority).toBe(0.81);
	});

	it('adds ledger entry for each stipend payment', () => {
		const worldEntity = createWorldEntity(true, 1000);
		const guard = createTestAgent('guard-1', 50, 'guard');
		const system = createStipendSystem(() => worldEntity, () => [guard]);

		system.execute(createDeps(createEventBus()));

		const economy = worldEntity.get(EconomyComponent);
		expect(economy.state.ledger.length).toBe(1);
		expect(economy.state.ledger[0]?.type).toBe('stipend');
		expect(economy.state.ledger[0]?.from).toBe('treasury');
		expect(economy.state.ledger[0]?.to).toBe('guard-1');
	});
});
