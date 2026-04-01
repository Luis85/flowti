import { describe, it, expect } from 'vitest';
import { Actor } from 'excalibur';
import { createTradeSystem } from '../../../src/infrastructure/systems/trade-system.js';
import { AgentActor } from '../../../src/infrastructure/entity/agent-actor.js';
import { FacilityComponent } from '../../../src/infrastructure/components/facility-component.js';
import { EconomyComponent } from '../../../src/infrastructure/components/economy-component.js';
import { WalletComponent } from '../../../src/infrastructure/components/wallet-component.js';
import { InventoryComponent } from '../../../src/infrastructure/components/inventory-component.js';
import { BlackboardComponent } from '../../../src/infrastructure/components/blackboard-component.js';
import { GameConfigSchema } from '../../../src/domain/schemas/game-config-schema.js';
import { createPerformanceTracker } from '../../../src/infrastructure/performance/performance-tracker.js';
import { createEventBus } from '../../../src/infrastructure/event-bus.js';
import type { GameCoreDeps } from '../../../src/domain/core/game-deps.js';
import type { GameEvent } from '../../../src/domain/core/events.js';
import type { WorldLocation } from '../../../src/domain/schemas/location-schema.js';

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

function createBakeryLocation(): WorldLocation {
	return {
		id: 'loc-bakery',
		name: 'Bakery',
		type: 'work',
		position: { x: 100, y: 100, region: 'test' },
		capacity: 10,
		color: '#808080',
		production: {
			job: 'baker',
			output: { item_id: 'bread', quantity: 1 },
			input: { item_id: 'wheat', quantity: 1 },
			wage: 5,
			ticks_per_cycle: 30,
		},
	};
}

function createWorldEntity(): Actor {
	const entity = new Actor();
	entity.addComponent(new EconomyComponent({
		treasury: 500,
		ledger: [],
		dailySummary: { totalWages: 0, totalTax: 0, totalSales: 0, totalConsumption: 0 },
	}));
	return entity;
}

describe('TradeSystem', () => {
	it('agent buys bread from facility with stock', () => {
		const eventBus = createEventBus();
		const events: GameEvent[] = [];
		eventBus.on('PurchaseComplete', (e) => { events.push(e); });

		const agent = new AgentActor(createTestAgentData('agent-1', 100, 100), defaultMoodConfig);
		const bb = agent.get(BlackboardComponent);
		bb.state = { ...bb.state, btAction: 'buy' };

		const bakery = createBakeryLocation();
		const bakeryActor = new Actor();
		bakeryActor.addComponent(new FacilityComponent({
			stock: [{ item_id: 'bread', quantity: 5 }],
			fund: 100,
			workProgress: 0,
			status: 'idle',
			workerId: null,
		}));

		const locationActors = new Map<string, Actor>([['loc-bakery', bakeryActor]]);
		const world = createWorldEntity();

		const system = createTradeSystem(
			() => [agent],
			() => [bakery],
			() => locationActors,
			() => world,
		);
		system.execute(createDeps(eventBus));

		// Agent wallet: 50 - 3 (food_price default) = 47
		const wallet = agent.get(WalletComponent);
		expect(wallet.state.gold).toBe(47);

		// Agent inventory: bread added
		const inv = agent.get(InventoryComponent);
		expect(inv.state.items).toContainEqual({ item_id: 'bread', quantity: 1 });

		// Facility stock decremented: 5 - 1 = 4
		const facility = bakeryActor.get(FacilityComponent);
		expect(facility.state.stock).toContainEqual({ item_id: 'bread', quantity: 4 });

		// Facility fund increased: 100 + 3 = 103
		expect(facility.state.fund).toBe(103);

		// PurchaseComplete emitted
		expect(events.length).toBe(1);
		expect(events[0]?.payload.agentId).toBe('agent-1');
		expect(events[0]?.payload.facilityId).toBe('loc-bakery');
	});

	it('emits PurchaseFailed when agent has no gold', () => {
		const eventBus = createEventBus();
		const events: GameEvent[] = [];
		eventBus.on('PurchaseFailed', (e) => { events.push(e); });

		const agent = new AgentActor(createTestAgentData('agent-1', 100, 100, { wallet: { gold: 0 } }), defaultMoodConfig);
		const bb = agent.get(BlackboardComponent);
		bb.state = { ...bb.state, btAction: 'buy' };

		const bakery = createBakeryLocation();
		const bakeryActor = new Actor();
		bakeryActor.addComponent(new FacilityComponent({
			stock: [{ item_id: 'bread', quantity: 5 }],
			fund: 100,
			workProgress: 0,
			status: 'idle',
			workerId: null,
		}));

		const locationActors = new Map<string, Actor>([['loc-bakery', bakeryActor]]);
		const world = createWorldEntity();

		const system = createTradeSystem(
			() => [agent],
			() => [bakery],
			() => locationActors,
			() => world,
		);
		system.execute(createDeps(eventBus));

		expect(events.length).toBe(1);
		expect(events[0]?.payload.reason).toBe('no_gold');

		// Wallet unchanged
		const wallet = agent.get(WalletComponent);
		expect(wallet.state.gold).toBe(0);

		// Stock unchanged
		const facility = bakeryActor.get(FacilityComponent);
		expect(facility.state.stock).toContainEqual({ item_id: 'bread', quantity: 5 });
	});
});
