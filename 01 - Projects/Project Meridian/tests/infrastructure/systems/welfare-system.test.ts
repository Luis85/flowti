import { describe, it, expect } from 'vitest';
import { Actor } from 'excalibur';
import { createWelfareSystem } from '../../../src/infrastructure/systems/welfare-system.js';
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
		dailySummary: { totalWages: 0, totalTax: 0, totalSales: 0, totalConsumption: 0 },
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
	};
}

describe('WelfareSystem', () => {
	it('skips when dayBoundaryThisTick is false', () => {
		const worldEntity = createWorldEntity(false);
		const poorAgent = createTestAgent('poor', 0);
		const system = createWelfareSystem(() => worldEntity, () => [poorAgent]);

		const eventBus = createEventBus();
		const events: GameEvent[] = [];
		eventBus.on('WelfareGranted', (e) => { events.push(e); });

		system.execute(createDeps(eventBus));

		expect(events.length).toBe(0);
		expect(poorAgent.get(WalletComponent).state.gold).toBe(0);
	});

	it('grants welfare to agents below threshold', () => {
		const config = GameConfigSchema.parse({});
		const worldEntity = createWorldEntity(true, 1000);
		const poorAgent = createTestAgent('poor', 5);
		const system = createWelfareSystem(() => worldEntity, () => [poorAgent]);

		const eventBus = createEventBus();
		const events: GameEvent[] = [];
		eventBus.on('WelfareGranted', (e) => { events.push(e); });

		system.execute(createDeps(eventBus));

		expect(events.length).toBe(1);
		expect(events[0]?.payload.agentId).toBe('poor');
		expect(events[0]?.payload.amount).toBe(config.economy.welfare_reward_min);
		expect(poorAgent.get(WalletComponent).state.gold).toBe(5 + config.economy.welfare_reward_min);
		expect(worldEntity.get(EconomyComponent).state.treasury).toBe(1000 - config.economy.welfare_reward_min);
	});

	it('respects maxGrants limit', () => {
		const config = GameConfigSchema.parse({});
		const maxGrants = config.economy.max_active_welfare_quests; // 3
		const worldEntity = createWorldEntity(true, 10000);

		// Create more agents than maxGrants, all below threshold
		const agents = Array.from({ length: maxGrants + 2 }, (_, i) =>
			createTestAgent(`agent-${i}`, 1),
		);

		const system = createWelfareSystem(() => worldEntity, () => agents);

		const eventBus = createEventBus();
		const events: GameEvent[] = [];
		eventBus.on('WelfareGranted', (e) => { events.push(e); });

		system.execute(createDeps(eventBus));

		expect(events.length).toBe(maxGrants);
	});

	it('skips agents above threshold', () => {
		const config = GameConfigSchema.parse({});
		const worldEntity = createWorldEntity(true, 1000);
		const richAgent = createTestAgent('rich', config.economy.welfare_threshold_gold + 50);
		const system = createWelfareSystem(() => worldEntity, () => [richAgent]);

		const eventBus = createEventBus();
		const events: GameEvent[] = [];
		eventBus.on('WelfareGranted', (e) => { events.push(e); });

		system.execute(createDeps(eventBus));

		expect(events.length).toBe(0);
		expect(richAgent.get(WalletComponent).state.gold).toBe(config.economy.welfare_threshold_gold + 50);
	});

	it('skips when treasury is insufficient', () => {
		const config = GameConfigSchema.parse({});
		const worldEntity = createWorldEntity(true, config.economy.welfare_reward_min - 1);
		const poorAgent = createTestAgent('poor', 0);
		const system = createWelfareSystem(() => worldEntity, () => [poorAgent]);

		const eventBus = createEventBus();
		const events: GameEvent[] = [];
		eventBus.on('WelfareGranted', (e) => { events.push(e); });

		system.execute(createDeps(eventBus));

		expect(events.length).toBe(0);
		expect(poorAgent.get(WalletComponent).state.gold).toBe(0);
	});

	it('has correct system name and priority', () => {
		const system = createWelfareSystem(() => new Actor(), () => []);
		expect(system.name).toBe('WelfareSystem');
		expect(system.priority).toBe(0.8);
	});

	it('adds ledger entry for each welfare grant', () => {
		const worldEntity = createWorldEntity(true, 1000);
		const poorAgent = createTestAgent('poor', 0);
		const system = createWelfareSystem(() => worldEntity, () => [poorAgent]);

		system.execute(createDeps(createEventBus()));

		const economy = worldEntity.get(EconomyComponent);
		expect(economy.state.ledger.length).toBe(1);
		expect(economy.state.ledger[0]?.type).toBe('welfare');
		expect(economy.state.ledger[0]?.from).toBe('treasury');
		expect(economy.state.ledger[0]?.to).toBe('poor');
	});
});
