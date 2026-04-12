import { describe, it, expect } from 'vitest';
import { NeedsComponent } from '../../../src/infrastructure/components/needs-component.js';
import { MoodComponent } from '../../../src/infrastructure/components/mood-component.js';
import { MemoryComponent } from '../../../src/infrastructure/components/memory-component.js';
import { WalletComponent } from '../../../src/infrastructure/components/wallet-component.js';
import { StaminaComponent } from '../../../src/infrastructure/components/stamina-component.js';
import { AttributesComponent } from '../../../src/infrastructure/components/attributes-component.js';
import { PerceptionComponent } from '../../../src/infrastructure/components/perception-component.js';
import { EconomyComponent } from '../../../src/infrastructure/components/economy-component.js';
import { FacilityComponent } from '../../../src/infrastructure/components/facility-component.js';
import { InventoryComponent } from '../../../src/infrastructure/components/inventory-component.js';
import { QuestBoardComponent } from '../../../src/infrastructure/components/quest-board-component.js';
import { RelationshipComponent } from '../../../src/infrastructure/components/relationship-component.js';
import { SocialComponent } from '../../../src/infrastructure/components/social-component.js';
import { TimeComponent } from '../../../src/infrastructure/components/time-component.js';
import { TraitsComponent } from '../../../src/infrastructure/components/traits-component.js';
import { TrackedComponent } from '../../../src/infrastructure/components/tracked-component.js';

describe('NeedsComponent', () => {
	it('holds NeedsState and is dirty on creation', () => {
		const comp = new NeedsComponent({ hunger: 80, energy: 90, social: 70, thirst: 80 });
		expect(comp.state.hunger).toBe(80);
		expect(comp.dirty).toBe(true);
		expect(comp).toBeInstanceOf(TrackedComponent);
	});

	it('supports state mutation with dirty tracking', () => {
		const comp = new NeedsComponent({ hunger: 80, energy: 90, social: 70, thirst: 80 });
		comp.clearDirty();
		comp.state.hunger -= 10;
		comp.markDirty();
		expect(comp.state.hunger).toBe(70);
		expect(comp.dirty).toBe(true);
	});
});

describe('MoodComponent', () => {
	it('holds MoodState and is dirty on creation', () => {
		const comp = new MoodComponent({ value: 50, bucket: 'content' });
		expect(comp.state.value).toBe(50);
		expect(comp.state.bucket).toBe('content');
		expect(comp.dirty).toBe(true);
		expect(comp).toBeInstanceOf(TrackedComponent);
	});

	it('supports state mutation with dirty tracking', () => {
		const comp = new MoodComponent({ value: 50, bucket: 'content' });
		comp.clearDirty();
		comp.state.value = 30;
		comp.state.bucket = 'stressed';
		comp.markDirty();
		expect(comp.state.value).toBe(30);
		expect(comp.dirty).toBe(true);
	});
});

describe('MemoryComponent', () => {
	it('holds MemoryState and is dirty on creation', () => {
		const comp = new MemoryComponent({ entries: [], maxEntries: 50 });
		expect(comp.state.entries).toEqual([]);
		expect(comp.state.maxEntries).toBe(50);
		expect(comp.dirty).toBe(true);
		expect(comp).toBeInstanceOf(TrackedComponent);
	});

	it('supports state mutation with dirty tracking', () => {
		const comp = new MemoryComponent({ entries: [], maxEntries: 50 });
		comp.clearDirty();
		comp.state.entries.push({
			tick: 1, type: 'test', description: 'test', participants: [],
			outcome: 'neutral', significance: 1, mood_impact: 0,
		});
		comp.markDirty();
		expect(comp.state.entries).toHaveLength(1);
		expect(comp.dirty).toBe(true);
	});
});

describe('WalletComponent', () => {
	it('holds WalletState and is dirty on creation', () => {
		const comp = new WalletComponent({ gold: 100 });
		expect(comp.state.gold).toBe(100);
		expect(comp.dirty).toBe(true);
		expect(comp).toBeInstanceOf(TrackedComponent);
	});

	it('supports state mutation with dirty tracking', () => {
		const comp = new WalletComponent({ gold: 100 });
		comp.clearDirty();
		comp.state.gold -= 25;
		comp.markDirty();
		expect(comp.state.gold).toBe(75);
		expect(comp.dirty).toBe(true);
	});
});

describe('StaminaComponent', () => {
	it('holds StaminaState and is dirty on creation', () => {
		const comp = new StaminaComponent({ current: 80, max: 100 });
		expect(comp.state.current).toBe(80);
		expect(comp.state.max).toBe(100);
		expect(comp.dirty).toBe(true);
		expect(comp).toBeInstanceOf(TrackedComponent);
	});

	it('supports state mutation with dirty tracking', () => {
		const comp = new StaminaComponent({ current: 80, max: 100 });
		comp.clearDirty();
		comp.state.current = 60;
		comp.markDirty();
		expect(comp.state.current).toBe(60);
		expect(comp.dirty).toBe(true);
	});
});

describe('AttributesComponent', () => {
	it('holds AttributesState and is dirty on creation', () => {
		const comp = new AttributesComponent({ ST: 12, DX: 10, IQ: 14, HT: 11 });
		expect(comp.state.ST).toBe(12);
		expect(comp.state.DX).toBe(10);
		expect(comp.state.IQ).toBe(14);
		expect(comp.state.HT).toBe(11);
		expect(comp.dirty).toBe(true);
		expect(comp).toBeInstanceOf(TrackedComponent);
	});

	it('supports state mutation with dirty tracking', () => {
		const comp = new AttributesComponent({ ST: 12, DX: 10, IQ: 14, HT: 11 });
		comp.clearDirty();
		comp.state.ST = 13;
		comp.markDirty();
		expect(comp.state.ST).toBe(13);
		expect(comp.dirty).toBe(true);
	});

	it('getByName returns attribute value for known attributes', () => {
		const comp = new AttributesComponent({ ST: 12, DX: 10, IQ: 14, HT: 11 });
		expect(comp.getByName('ST')).toBe(12);
		expect(comp.getByName('IQ')).toBe(14);
	});

	it('getByName returns 0 for unknown attribute names', () => {
		const comp = new AttributesComponent({ ST: 12, DX: 10, IQ: 14, HT: 11 });
		expect(comp.getByName('WIS')).toBe(0);
		expect(comp.getByName('')).toBe(0);
	});
});

describe('PerceptionComponent', () => {
	it('holds PerceptionState and is dirty on creation', () => {
		const comp = new PerceptionComponent({ nearbyAgents: [], nearbyLocations: [] });
		expect(comp.state.nearbyAgents).toEqual([]);
		expect(comp.state.nearbyLocations).toEqual([]);
		expect(comp.dirty).toBe(true);
		expect(comp).toBeInstanceOf(TrackedComponent);
	});

	it('supports state mutation with dirty tracking', () => {
		const comp = new PerceptionComponent({ nearbyAgents: [], nearbyLocations: [] });
		comp.clearDirty();
		comp.state.nearbyAgents.push({ id: 'agent-1', distance: 5 });
		comp.markDirty();
		expect(comp.state.nearbyAgents).toHaveLength(1);
		expect(comp.dirty).toBe(true);
	});
});

describe('EconomyComponent', () => {
	it('holds EconomyState and is dirty on creation', () => {
		const comp = new EconomyComponent({
			treasury: 1000,
			ledger: [],
			dailySummary: {
				totalWages: 0, totalTax: 0, totalSales: 0, totalConsumption: 0,
				avgWage: 0, wageSpread: 0, vacancyCount: 0, unemploymentCount: 0,
				jobSwitchesThisDay: 0, supplyDeliveries: 0, questsCompletedThisDay: 0,
			},
		});
		expect(comp.state.treasury).toBe(1000);
		expect(comp.state.ledger).toEqual([]);
		expect(comp.dirty).toBe(true);
		expect(comp).toBeInstanceOf(TrackedComponent);
	});

	it('supports state mutation with dirty tracking', () => {
		const comp = new EconomyComponent({
			treasury: 1000,
			ledger: [],
			dailySummary: {
				totalWages: 0, totalTax: 0, totalSales: 0, totalConsumption: 0,
				avgWage: 0, wageSpread: 0, vacancyCount: 0, unemploymentCount: 0,
				jobSwitchesThisDay: 0, supplyDeliveries: 0, questsCompletedThisDay: 0,
			},
		});
		comp.clearDirty();
		comp.state.treasury -= 100;
		comp.markDirty();
		expect(comp.state.treasury).toBe(900);
		expect(comp.dirty).toBe(true);
	});
});

describe('FacilityComponent', () => {
	it('holds FacilityState and is dirty on creation', () => {
		const comp = new FacilityComponent({
			stock: [{ item_id: 'bread', quantity: 5 }],
			fund: 200,
			workProgress: 0,
			status: 'idle',
			workerId: null,
		});
		expect(comp.state.fund).toBe(200);
		expect(comp.state.stock).toEqual([{ item_id: 'bread', quantity: 5 }]);
		expect(comp.state.status).toBe('idle');
		expect(comp.dirty).toBe(true);
		expect(comp).toBeInstanceOf(TrackedComponent);
	});

	it('supports state mutation with dirty tracking', () => {
		const comp = new FacilityComponent({
			stock: [], fund: 0, workProgress: 0, status: 'idle', workerId: null,
		});
		comp.clearDirty();
		comp.state.status = 'producing';
		comp.state.workerId = 'agent-1';
		comp.markDirty();
		expect(comp.state.status).toBe('producing');
		expect(comp.state.workerId).toBe('agent-1');
		expect(comp.dirty).toBe(true);
	});

	it('lastPulseTick defaults to undefined when omitted', () => {
		const comp = new FacilityComponent({
			stock: [], fund: 0, workProgress: 0, status: 'idle', workerId: null,
		});
		expect(comp.state.lastPulseTick).toBeUndefined();
	});

	it('lastPulseTick preserves the value passed at construction (area_effect spawn seeding)', () => {
		// Mirrors how `game-view.ts populateScene` seeds area_effect facilities:
		// `lastPulseTick: deps.tickCount` at spawn so the first pulse fires on
		// or after `spawnTick + ticks_per_pulse`.
		const spawnTick = 12345;
		const comp = new FacilityComponent({
			stock: [], fund: 100, workProgress: 0, status: 'idle', workerId: null,
			lastPulseTick: spawnTick,
		});
		expect(comp.state.lastPulseTick).toBe(spawnTick);
	});
});

describe('InventoryComponent', () => {
	it('holds InventoryState and is dirty on creation', () => {
		const comp = new InventoryComponent({ items: [] });
		expect(comp.state.items).toEqual([]);
		expect(comp.dirty).toBe(true);
		expect(comp).toBeInstanceOf(TrackedComponent);
	});

	it('supports state mutation with dirty tracking', () => {
		const comp = new InventoryComponent({ items: [] });
		comp.clearDirty();
		comp.state.items.push({ item_id: 'sword', quantity: 1 });
		comp.markDirty();
		expect(comp.state.items).toHaveLength(1);
		expect(comp.state.items[0]?.item_id).toBe('sword');
		expect(comp.dirty).toBe(true);
	});
});

describe('QuestBoardComponent', () => {
	it('holds QuestBoardState and is dirty on creation', () => {
		const comp = new QuestBoardComponent({ quests: [] });
		expect(comp.state.quests).toEqual([]);
		expect(comp.dirty).toBe(true);
		expect(comp).toBeInstanceOf(TrackedComponent);
	});

	it('supports state mutation with dirty tracking', () => {
		const comp = new QuestBoardComponent({ quests: [] });
		comp.clearDirty();
		comp.state.quests.push({
			id: 'q-1', type: 'supply', facilityId: 'fac-1', itemId: 'wheat',
			quantity: 3, reward: 10, rewardXp: 5, state: 'open', claimedBy: null,
			createdTick: 1, expiryTicks: 100, repairProgress: 0,
		});
		comp.markDirty();
		expect(comp.state.quests).toHaveLength(1);
		expect(comp.dirty).toBe(true);
	});
});

describe('RelationshipComponent', () => {
	it('holds RelationshipState and is dirty on creation', () => {
		const comp = new RelationshipComponent({ entries: [] });
		expect(comp.state.entries).toEqual([]);
		expect(comp.dirty).toBe(true);
		expect(comp).toBeInstanceOf(TrackedComponent);
	});

	it('supports state mutation with dirty tracking', () => {
		const comp = new RelationshipComponent({ entries: [] });
		comp.clearDirty();
		comp.state.entries.push({
			agentId: 'agent-2', disposition: 5, familiarity: 2,
			tags: ['friend'], lastInteractionTick: 10,
		});
		comp.markDirty();
		expect(comp.state.entries).toHaveLength(1);
		expect(comp.state.entries[0]?.agentId).toBe('agent-2');
		expect(comp.dirty).toBe(true);
	});
});

describe('SocialComponent', () => {
	it('holds SocialState and is dirty on creation', () => {
		const comp = new SocialComponent({ status: 0, reputation: 0, charisma: 10 });
		expect(comp.state.status).toBe(0);
		expect(comp.state.reputation).toBe(0);
		expect(comp.state.charisma).toBe(10);
		expect(comp.dirty).toBe(true);
		expect(comp).toBeInstanceOf(TrackedComponent);
	});

	it('supports state mutation with dirty tracking', () => {
		const comp = new SocialComponent({ status: 0, reputation: 0, charisma: 10 });
		comp.clearDirty();
		comp.state.reputation = 5;
		comp.state.status = 1;
		comp.markDirty();
		expect(comp.state.reputation).toBe(5);
		expect(comp.state.status).toBe(1);
		expect(comp.dirty).toBe(true);
	});
});

describe('TimeComponent', () => {
	it('holds TimeState and is dirty on creation', () => {
		const comp = new TimeComponent({
			phase: 'dawn', tickInCycle: 0, dayCount: 1, dayBoundaryThisTick: false,
		});
		expect(comp.state.phase).toBe('dawn');
		expect(comp.state.tickInCycle).toBe(0);
		expect(comp.state.dayCount).toBe(1);
		expect(comp.state.dayBoundaryThisTick).toBe(false);
		expect(comp.dirty).toBe(true);
		expect(comp).toBeInstanceOf(TrackedComponent);
	});

	it('supports state mutation with dirty tracking', () => {
		const comp = new TimeComponent({
			phase: 'dawn', tickInCycle: 0, dayCount: 1, dayBoundaryThisTick: false,
		});
		comp.clearDirty();
		comp.state.phase = 'day';
		comp.state.tickInCycle = 10;
		comp.markDirty();
		expect(comp.state.phase).toBe('day');
		expect(comp.state.tickInCycle).toBe(10);
		expect(comp.dirty).toBe(true);
	});
});

describe('TraitsComponent', () => {
	it('holds traitIds and is dirty on creation', () => {
		const comp = new TraitsComponent(['brave', 'cunning']);
		expect(comp.traitIds).toEqual(['brave', 'cunning']);
		expect(comp.dirty).toBe(true);
		expect(comp).toBeInstanceOf(TrackedComponent);
	});

	it('supports state mutation with dirty tracking', () => {
		const comp = new TraitsComponent(['brave']);
		comp.clearDirty();
		comp.traitIds.push('stoic');
		comp.markDirty();
		expect(comp.traitIds).toEqual(['brave', 'stoic']);
		expect(comp.dirty).toBe(true);
	});
});

