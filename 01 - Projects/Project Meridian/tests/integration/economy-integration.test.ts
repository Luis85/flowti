import { describe, it, expect } from 'vitest';
import { AgentActor } from '../../src/infrastructure/entity/agent-actor.js';
import { WalletComponent } from '../../src/infrastructure/components/wallet-component.js';
import { InventoryComponent } from '../../src/infrastructure/components/inventory-component.js';
import { FacilityComponent } from '../../src/infrastructure/components/facility-component.js';
import { EconomyComponent } from '../../src/infrastructure/components/economy-component.js';
import { NeedsComponent } from '../../src/infrastructure/components/needs-component.js';
import { GameConfigSchema } from '../../src/domain/schemas/game-config-schema.js';
import { createPerformanceTracker } from '../../src/infrastructure/performance/performance-tracker.js';
import { createEventBus } from '../../src/infrastructure/event-bus.js';
import { createFacilitySystem } from '../../src/infrastructure/systems/facility-system.js';
import { createTradeSystem } from '../../src/infrastructure/systems/trade-system.js';
import { createFeedSystem } from '../../src/infrastructure/systems/feed-system.js';
import { attachBehaviorStubs } from './test-behavior-stub.js';
import type { GameCoreDeps } from '../../src/domain/core/game-deps.js';
import type { WorldLocation } from '../../src/domain/schemas/location-schema.js';
import { Actor } from 'excalibur';

const defaultMoodConfig = {
	factor_weights: { needs: 30, positive_memories: 20, negative_memories: 20, goal_progress: 10, wallet: 10, equipment: 5, relationships: 5 },
	buckets: [{ name: 'stressed', min: -100, max: 100 }],
	external_modifier_cap: 30,
};

function createTestAgentData(id: string, x = 0, y = 0, overrides: Record<string, unknown> = {}) {
	return {
		id, name: id, kind: 'merchant',
		attributes: { ST: 10, DX: 10, IQ: 10, HT: 10 },
		social: { status: 0, reputation: 0, charisma: 10 },
		needs: { hunger: 40, energy: 50, social: 50, thirst: 50 },
		mood: 0, memory: [], goals: [], skills: [], inventory: [],
		equipment: { head: null, body: null, hands: null, tool: null, accessory: null },
		traits: [], wallet: { gold: 50 }, xp: 0, level: 1,
		position: { x, y, region: 'test' }, relationships: '',
		color: '#b0b0b0', persona: null, property: [],
		tools: [], behavior_tree: 'bt-merchant', job: null,
		...overrides,
	};
}

function createDeps(tickCount = 1): GameCoreDeps {
	return {
		logger: { debug() {}, info() {}, warn() {}, error() {} },
		eventBus: createEventBus(),
		config: GameConfigSchema.parse({}),
		performanceTracker: createPerformanceTracker(),
		tickCount,
		writeFile: null,
	};
}

describe('Economy integration', () => {
	it('full cycle: agent works at farm, earns gold, buys food, eats', () => {
		const farmLoc: WorldLocation = {
			id: 'loc-farm', name: 'Farm', type: 'food',
			position: { x: 100, y: 100 }, capacity: 8, color: '#7cba3f',
			production: { job: 'farmer', output: { item_id: 'wheat', quantity: 1 }, input: null, wage: 3, ticks_per_cycle: 2 },
		};
		const bakeryLoc: WorldLocation = {
			id: 'loc-bakery', name: 'Bakery', type: 'food',
			position: { x: 100, y: 100 }, capacity: 6, color: '#d2691e',
			production: { job: 'baker', output: { item_id: 'food', quantity: 1 }, input: { item_id: 'wheat', quantity: 1 }, wage: 4, ticks_per_cycle: 2 },
		};
		const locations = [farmLoc, bakeryLoc];

		const farmer = new AgentActor(createTestAgentData('agent-farmer', 100, 100, { job: 'farmer' }), defaultMoodConfig);
		attachBehaviorStubs(farmer, { btAction: 'work' });
		const baker = new AgentActor(createTestAgentData('agent-baker', 100, 100, { job: 'baker' }), defaultMoodConfig);
		attachBehaviorStubs(baker, { btAction: 'work' });
		const buyer = new AgentActor(createTestAgentData('agent-buyer', 100, 100, { inventory: [] }), defaultMoodConfig);
		attachBehaviorStubs(buyer);

		const farmActor = new Actor({ x: 100, y: 100 });
		farmActor.addComponent(new FacilityComponent({ stock: [], fund: 200, workProgress: 1, status: 'producing', workerId: null }));
		const bakeryActor = new Actor({ x: 100, y: 100 });
		bakeryActor.addComponent(new FacilityComponent({ stock: [{ item_id: 'wheat', quantity: 1 }], fund: 200, workProgress: 1, status: 'producing', workerId: null }));

		const locationActors = new Map([['loc-farm', farmActor], ['loc-bakery', bakeryActor]]);
		const worldEntity = new Actor();
		worldEntity.addComponent(new EconomyComponent({ treasury: 500, ledger: [], dailySummary: { totalWages: 0, totalTax: 0, totalSales: 0, totalConsumption: 0, avgWage: 0, wageSpread: 0, vacancyCount: 0, unemploymentCount: 0, jobSwitchesThisDay: 0, supplyDeliveries: 0, questsCompletedThisDay: 0 } }));

		const allAgents = [farmer, baker, buyer];

		// Phase 1: Workers work (tick to complete cycle)
		const deps = createDeps();
		const facilitySys = createFacilitySystem(() => allAgents, () => locations, () => locationActors, () => worldEntity);
		facilitySys.execute(deps);

		// Farmer should have earned gold
		const farmerWallet = farmer.get(WalletComponent);
		expect(farmerWallet.state.gold).toBeGreaterThan(50);

		// Bakery should have produced food (wheat consumed)
		const bakeryFacility = bakeryActor.get(FacilityComponent);
		const producedFood = bakeryFacility.state.stock.find(s => s.item_id === 'food');
		expect(producedFood?.quantity).toBe(1);

		// Phase 2: Buyer buys food from bakery
		buyer.behaviorAgent.btAction = 'buy';

		const tradeSys = createTradeSystem(() => allAgents, () => locations, () => locationActors, () => worldEntity, () => new Map());
		tradeSys.execute(deps);

		const buyerWallet = buyer.get(WalletComponent);
		expect(buyerWallet.state.gold).toBe(47);

		const buyerInv = buyer.get(InventoryComponent);
		expect(buyerInv.state.items).toContainEqual({ item_id: 'food', quantity: 1 });

		// Phase 3: Buyer eats food
		buyer.behaviorAgent.btAction = 'eat';

		const feedSys = createFeedSystem(() => allAgents, () => worldEntity);
		feedSys.execute(deps);

		const buyerNeeds = buyer.get(NeedsComponent);
		expect(buyerNeeds.state.hunger).toBeGreaterThan(40);

		const buyerInvAfter = buyer.get(InventoryComponent);
		const foodAfter = buyerInvAfter.state.items.find(i => i.item_id === 'food');
		expect(foodAfter).toBeUndefined();

		// Ledger should have entries
		const economy = worldEntity.get(EconomyComponent);
		expect(economy.state.ledger.length).toBeGreaterThan(0);
	});
});
