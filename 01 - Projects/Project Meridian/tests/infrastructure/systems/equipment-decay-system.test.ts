import { describe, it, expect } from 'vitest';
import { Actor } from 'excalibur';
import { createEquipmentDecaySystem } from '../../../src/infrastructure/systems/equipment-decay-system.js';
import { TimeComponent } from '../../../src/infrastructure/components/time-component.js';
import { InventoryComponent } from '../../../src/infrastructure/components/inventory-component.js';
import { AgentActor } from '../../../src/infrastructure/entity/agent-actor.js';
import { GameConfigSchema } from '../../../src/domain/schemas/game-config-schema.js';
import { createPerformanceTracker } from '../../../src/infrastructure/performance/performance-tracker.js';
import { createEventBus } from '../../../src/infrastructure/event-bus.js';
import type { GameCoreDeps } from '../../../src/domain/core/game-deps.js';

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

function createTestAgent(id: string, inventory: { item_id: string; quantity: number; charges?: number }[] = []): AgentActor {
	const agent = new AgentActor(
		createTestAgentData(id, { inventory }) as never,
		defaultMoodConfig,
	);
	return agent;
}

function createWorldEntity(dayBoundary: boolean): Actor {
	const actor = new Actor();
	actor.addComponent(new TimeComponent({ phase: 'day', tickInCycle: 60, dayCount: 1, dayBoundaryThisTick: dayBoundary }));
	return actor;
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

describe('EquipmentDecaySystem', () => {
	it('skips when dayBoundaryThisTick is false', () => {
		const worldEntity = createWorldEntity(false);
		const agent = createTestAgent('a1', [{ item_id: 'equipment', quantity: 1, charges: 5 }]);
		const system = createEquipmentDecaySystem(() => worldEntity, () => [agent]);

		system.execute(createDeps());

		const inv = agent.get(InventoryComponent);
		expect(inv.state.items).toEqual([{ item_id: 'equipment', quantity: 1, charges: 5 }]);
	});

	it('decrements equipment charges by 1 at day boundary', () => {
		const worldEntity = createWorldEntity(true);
		const agent = createTestAgent('a1', [{ item_id: 'equipment', quantity: 1, charges: 5 }]);
		const system = createEquipmentDecaySystem(() => worldEntity, () => [agent]);

		system.execute(createDeps());

		const inv = agent.get(InventoryComponent);
		expect(inv.state.items).toEqual([{ item_id: 'equipment', quantity: 1, charges: 4 }]);
	});

	it('removes equipment when charges reach 0 after decay', () => {
		const worldEntity = createWorldEntity(true);
		const agent = createTestAgent('a1', [{ item_id: 'equipment', quantity: 1, charges: 1 }]);
		const system = createEquipmentDecaySystem(() => worldEntity, () => [agent]);

		system.execute(createDeps());

		const inv = agent.get(InventoryComponent);
		expect(inv.state.items).toEqual([]);
	});

	it('does not affect other inventory items during equipment decay', () => {
		const worldEntity = createWorldEntity(true);
		const agent = createTestAgent('a1', [
			{ item_id: 'food', quantity: 3 },
			{ item_id: 'equipment', quantity: 1, charges: 2 },
			{ item_id: 'potion', quantity: 1 },
		]);
		const system = createEquipmentDecaySystem(() => worldEntity, () => [agent]);

		system.execute(createDeps());

		const inv = agent.get(InventoryComponent);
		expect(inv.state.items).toEqual([
			{ item_id: 'food', quantity: 3 },
			{ item_id: 'equipment', quantity: 1, charges: 1 },
			{ item_id: 'potion', quantity: 1 },
		]);
	});

	it('skips agents without equipment during decay pass', () => {
		const worldEntity = createWorldEntity(true);
		const agentWithEquip = createTestAgent('a1', [{ item_id: 'equipment', quantity: 1, charges: 3 }]);
		const agentWithout = createTestAgent('a2', [{ item_id: 'food', quantity: 5 }]);
		const system = createEquipmentDecaySystem(() => worldEntity, () => [agentWithEquip, agentWithout]);

		system.execute(createDeps());

		const inv1 = agentWithEquip.get(InventoryComponent);
		expect(inv1.state.items).toEqual([{ item_id: 'equipment', quantity: 1, charges: 2 }]);

		const inv2 = agentWithout.get(InventoryComponent);
		expect(inv2.state.items).toEqual([{ item_id: 'food', quantity: 5 }]);
	});

	it('has correct system name and priority', () => {
		const system = createEquipmentDecaySystem(() => new Actor(), () => []);
		expect(system.name).toBe('EquipmentDecaySystem');
		expect(system.priority).toBe(0.83);
	});
});
