# Composite Buy Actions Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement `BuyAndDrink` and `BuyAndEat` composite BT actions that travel + buy + consume in a single atomic action, bypassing the broken multi-step BT sequence pattern.

**Architecture:** Extract `executePurchase` shared function from TradeSystem. Build two composite actions that call it inline during BT evaluation. Add selective commitment exemption to ContinueCommitment so cross-need breaks don't cause oscillation. Simplify BT tree to use composite calls.

**Tech Stack:** TypeScript, ExcaliburJS ECS, Vitest, mistreevous BT

**Spec:** `01 - Projects/Project Meridian/docs/specs/2026-04-14-composite-buy-actions-design.md`

**Test command:** `cd "01 - Projects/Project Meridian" && npx vitest run --config configs/vitest.config.ts`

**Typecheck:** `cd "01 - Projects/Project Meridian" && npx tsc --noEmit --project configs/tsconfig.json`

---

## Chunk 1: Extract executePurchase from TradeSystem

### Task 1: Extract shared executePurchase function

**Files:**
- Modify: `01 - Projects/Project Meridian/src/infrastructure/systems/trade-system.ts`

- [ ] **Step 1: Add executePurchase function to trade-system.ts**

Add a new exported function `executePurchase` that encapsulates the full purchase logic (wallet, inventory, stock, ledger, relationships, memory, events). Place it after `applyBuyerRelationship` (around line 208) and before `createTradeSystem`:

```typescript
export interface PurchaseResult {
	success: boolean;
	failReason?: string;
	price?: number;
}

/**
 * Execute a purchase: wallet + inventory + stock + fund transfers,
 * ledger, buyer relationship, purchase memory, price observation.
 * Called by both TradeSystem's buy loop AND composite BT actions
 * (BuyAndDrink / BuyAndEat) that need to transact inline.
 */
export function executePurchase(
	agent: AgentActor,
	target: NearestFacility,
	economy: EconomyComponent,
	deps: GameCoreDeps,
	itemDef: Item | undefined,
	configFallbackPrice: number,
): PurchaseResult {
	const facility = target.actor.get(FacilityComponent);
	const price = facility.state.currentPrices?.[target.itemId]
		?? itemDef?.baseValue
		?? configFallbackPrice;

	const wallet = agent.get(WalletComponent);
	const result = applyTrade({
		agentGold: wallet.state.gold,
		price,
		facilityFund: facility.state.fund,
		itemId: target.itemId,
		quantity: 1,
	});

	if (!result.success) {
		// Agent still learns the price on failure
		agent.behaviorAgent.recordPriceObservation(target.itemId, price, target.location.id, deps.tickCount);
		return { success: false, failReason: result.failReason, price };
	}

	applySuccessfulTrade(agent, result, target, price, economy, deps, itemDef);
	return { success: true, price };
}
```

- [ ] **Step 2: Refactor createTradeSystem to use executePurchase**

Replace the body of the buy loop in `createTradeSystem.execute` (lines 229-305). The new loop is simpler because executePurchase handles all side effects:

```typescript
			for (const agent of agentList) {
				const btAction = agent.behaviorAgent.btAction;
				const pendingBuy = agent.behaviorAgent.buyTargetItem;
				if (btAction !== 'buy' && pendingBuy === null) continue;

				const targetItem = pendingBuy ?? 'food';
				const target = findNearestFacilityWithItem(agent, locationList, locationActorMap, radius, targetItem);
				if (target === undefined) {
					deps.eventBus.emit({
						type: 'TradeAttempted',
						tick: deps.tickCount,
						wallClock: Date.now(),
						source: 'TradeSystem',
						payload: { agentId: agent.agentId, item: targetItem, result: 'no_facility' },
					});
					agent.behaviorAgent.buyTargetItem = null;
					continue;
				}

				const item = itemRegistry().get(target.itemId);
				const result = executePurchase(agent, target, economy, deps, item, deps.config.economy.food_price);
				agent.behaviorAgent.buyTargetItem = null;

				if (result.success) {
					deps.eventBus.emit({
						type: 'TradeAttempted',
						tick: deps.tickCount,
						wallClock: Date.now(),
						source: 'TradeSystem',
						payload: { agentId: agent.agentId, item: targetItem, result: 'purchased', amount: result.price, facilityId: target.location.id },
					});
				} else {
					deps.eventBus.emit({
						type: 'TradeAttempted',
						tick: deps.tickCount,
						wallClock: Date.now(),
						source: 'TradeSystem',
						payload: { agentId: agent.agentId, item: targetItem, result: 'insufficient_gold', facilityId: target.location.id },
					});
					deps.eventBus.emit({
						type: 'PurchaseFailed',
						tick: deps.tickCount,
						wallClock: Date.now(),
						source: 'TradeSystem',
						payload: { agentId: agent.agentId, reason: result.failReason },
					});
				}
			}
```

Also export the `NearestFacility` interface (change `interface` to `export interface`) so composite actions can construct/pass it. And export `findNearestFacilityWithItem` (add `export` keyword).

- [ ] **Step 3: Run typecheck + full test suite**

Run: `cd "01 - Projects/Project Meridian" && npx tsc --noEmit --project configs/tsconfig.json && npx vitest run --config configs/vitest.config.ts`
Expected: clean typecheck, all existing tests pass. Behavior is unchanged — this is a pure refactor.

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Project Meridian/src/infrastructure/systems/trade-system.ts"
git commit -m "refactor(meridian): extract executePurchase + findNearestFacilityWithItem for reuse by composite actions"
```

---

## Chunk 2: BuyAndDrink composite action

### Task 2: Create bt-actions-buy.ts with BuyAndDrink

**Files:**
- Create: `01 - Projects/Project Meridian/src/infrastructure/entity/bt-actions-buy.ts`
- Create: `01 - Projects/Project Meridian/tests/infrastructure/entity/bt-actions-buy.test.ts`
- Modify: `01 - Projects/Project Meridian/src/infrastructure/entity/bt-actions.ts` (add to ActionMethods, spread into createActions)

- [ ] **Step 1: Add BuyAndDrink to ActionMethods interface**

In `bt-actions.ts` around line 52, add inside `interface ActionMethods`:
```typescript
	BuyAndDrink(): ActionResult;
	BuyAndEat(): ActionResult;
```

- [ ] **Step 2: Write failing tests for BuyAndDrink**

Create `tests/infrastructure/entity/bt-actions-buy.test.ts`. Start with travel + success cases:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Actor } from 'excalibur';
import { createBuyActions } from '../../../src/infrastructure/entity/bt-actions-buy.js';
import { AgentActor } from '../../../src/infrastructure/entity/agent-actor.js';
import { NeedsComponent } from '../../../src/infrastructure/components/needs-component.js';
import { WalletComponent } from '../../../src/infrastructure/components/wallet-component.js';
import { InventoryComponent } from '../../../src/infrastructure/components/inventory-component.js';
import { FacilityComponent } from '../../../src/infrastructure/components/facility-component.js';
import { EconomyComponent } from '../../../src/infrastructure/components/economy-component.js';
import { GameConfigSchema } from '../../../src/domain/schemas/game-config-schema.js';
import { createEventBus } from '../../../src/infrastructure/event-bus.js';
import type { ActionContext } from '../../../src/infrastructure/entity/bt-action-helpers.js';
import type { BehaviorAgentDeps } from '../../../src/infrastructure/entity/behavior-agent-factory.js';
import type { WorldLocation } from '../../../src/domain/schemas/location-schema.js';

const defaultMoodConfig = {
	factor_weights: { needs: 30, positive_memories: 20, negative_memories: 20, goal_progress: 10, wallet: 10, equipment: 5, relationships: 5 },
	buckets: [{ name: 'stressed', min: -100, max: 100 }],
	external_modifier_cap: 30,
};

function createTestAgent(x = 0, y = 0, gold = 50): AgentActor {
	const actor = new AgentActor({
		id: 'agent-test', name: 'Test', kind: 'merchant',
		attributes: { ST: 10, DX: 10, IQ: 10, HT: 10 },
		social: { status: 0, reputation: 0, charisma: 10 },
		needs: { hunger: 80, energy: 90, social: 70, thirst: 30 },
		mood: 0, memory: [], goals: [], skills: [], inventory: [],
		equipment: { head: null, body: null, hands: null, tool: null, accessory: null },
		traits: [], wallet: { gold }, xp: 0, level: 1,
		position: { x, y, region: 'test' },
		relationships: '', tools: [],
		color: '#b0b0b0', behavior_tree: 'bt/test.md',
		job: null, property: [],
	} as unknown as Parameters<typeof AgentActor>[0][0], defaultMoodConfig);
	actor.pos.x = x;
	actor.pos.y = y;
	return actor;
}

function createWellLocation(id = 'loc-well', x = 100, y = 0): WorldLocation {
	return { id, name: 'Well', type: 'well', position: { x, y, region: 'test' }, capacity: 10, color: '#808080' } as unknown as WorldLocation;
}

function createWellActor(waterStock = 5): Actor {
	const a = new Actor();
	a.addComponent(new FacilityComponent({
		stock: [{ item_id: 'water', quantity: waterStock }],
		fund: 100, workProgress: 0, status: 'idle', workerId: null,
	}));
	return a;
}

function createWorldEntity(): Actor {
	const w = new Actor();
	w.addComponent(new EconomyComponent({
		treasury: 500, ledger: [],
		dailySummary: { totalSales: 0, totalWages: 0, totalTaxes: 0, totalStipends: 0, totalWelfare: 0, totalSubsidies: 0 },
	} as unknown as Parameters<typeof EconomyComponent>[0]));
	return w;
}

function createCtx(actor: AgentActor, locations: WorldLocation[], actorMap: Map<string, Actor>, world: Actor): ActionContext {
	const eventBus = createEventBus();
	const config = GameConfigSchema.parse({});
	const deps: BehaviorAgentDeps = {
		config, actor: null as unknown as Actor, worldEntity: () => world,
		tickCount: () => 100, eventBus,
		getLocations: () => locations, getLocationActors: () => actorMap,
		getFacilityTypeRegistry: () => new Map(), getRecipeRegistry: () => new Map(),
		getAgents: () => [actor],
		getItemRegistry: () => new Map(),
	} as unknown as BehaviorAgentDeps;
	return {
		memory: actor.behaviorAgent as unknown as ActionContext['memory'],
		actor, deps,
		resolveNearbyFacilities: () => [],
		resolveNearbyAgents: () => [],
		resolveNearbyLocations: () => [],
		commitmentMultiplier: 1.0,
	};
}

describe('BuyAndDrink', () => {
	it('returns FAILED when no water source is known or visible', () => {
		const agent = createTestAgent();
		const ctx = createCtx(agent, [], new Map(), createWorldEntity());
		const actions = createBuyActions(ctx);
		expect(actions.BuyAndDrink()).toBe('mistreevous.failed');
	});

	it('returns RUNNING while traveling to well', () => {
		const agent = createTestAgent(0, 0);
		const well = createWellLocation('loc-well', 100, 0);
		const wellActor = createWellActor(5);
		const ctx = createCtx(agent, [well], new Map([['loc-well', wellActor]]), createWorldEntity());
		const actions = createBuyActions(ctx);
		const result = actions.BuyAndDrink();
		expect(result).toBe('mistreevous.running');
		expect(ctx.memory.serviceTarget).toBe('loc-well');
		expect(ctx.memory.movementTarget).toEqual({ id: 'loc-well', type: 'location' });
	});

	it('buys + drinks inline when at well, returns SUCCEEDED', () => {
		const agent = createTestAgent(100, 0, 50);
		agent.get(NeedsComponent).state = { hunger: 80, energy: 90, social: 70, thirst: 30 };
		const well = createWellLocation('loc-well', 100, 0);
		const wellActor = createWellActor(5);
		const ctx = createCtx(agent, [well], new Map([['loc-well', wellActor]]), createWorldEntity());
		ctx.memory.atLocation = 'loc-well';
		const actions = createBuyActions(ctx);
		const result = actions.BuyAndDrink();
		expect(result).toBe('mistreevous.succeeded');
		// Thirst restored
		expect(agent.get(NeedsComponent).state.thirst).toBeGreaterThan(30);
		// Gold deducted
		expect(agent.get(WalletComponent).state.gold).toBeLessThan(50);
		// Stock decremented
		const stock = wellActor.get(FacilityComponent).state.stock;
		const water = stock.find(s => s.item_id === 'water');
		expect(water?.quantity).toBe(4);
		// serviceTarget cleared
		expect(ctx.memory.serviceTarget).toBeNull();
	});

	it('returns FAILED when at well but stock is depleted', () => {
		const agent = createTestAgent(100, 0, 50);
		const well = createWellLocation('loc-well', 100, 0);
		const wellActor = createWellActor(0);
		const ctx = createCtx(agent, [well], new Map([['loc-well', wellActor]]), createWorldEntity());
		ctx.memory.atLocation = 'loc-well';
		const actions = createBuyActions(ctx);
		expect(actions.BuyAndDrink()).toBe('mistreevous.failed');
		expect(ctx.memory.serviceTarget).toBeNull();
	});

	it('returns FAILED when at well but can not afford', () => {
		const agent = createTestAgent(100, 0, 0); // no gold
		const well = createWellLocation('loc-well', 100, 0);
		const wellActor = createWellActor(5);
		const ctx = createCtx(agent, [well], new Map([['loc-well', wellActor]]), createWorldEntity());
		ctx.memory.atLocation = 'loc-well';
		const actions = createBuyActions(ctx);
		expect(actions.BuyAndDrink()).toBe('mistreevous.failed');
	});
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run tests/infrastructure/entity/bt-actions-buy.test.ts --config configs/vitest.config.ts`
Expected: FAIL — module `bt-actions-buy.ts` does not exist.

- [ ] **Step 4: Implement bt-actions-buy.ts**

Create `src/infrastructure/entity/bt-actions-buy.ts`:

```typescript
import type { Actor } from 'excalibur';
import type { ActionResult } from '../../domain/systems/behavior-agent.js';
import type { ActionMethods } from './bt-actions.js';
import type { ActionContext } from './bt-action-helpers.js';
import { SUCCEEDED, FAILED, RUNNING, beginAction } from './bt-action-helpers.js';
import { NeedsComponent } from '../components/needs-component.js';
import { InventoryComponent } from '../components/inventory-component.js';
import { FacilityComponent } from '../components/facility-component.js';
import { EconomyComponent } from '../components/economy-component.js';
import { findFoodInInventory, FOOD_ITEMS } from '../../domain/systems/food-items.js';
import { executePurchase } from '../systems/trade-system.js';

/**
 * Composite actions that travel to a source, buy inline on arrival,
 * and consume in the same tick. Bypasses the broken multi-step BT
 * sequence pattern (SeekWell → BuyItem → Drink).
 */
export function createBuyActions(ctx: ActionContext): Pick<ActionMethods, 'BuyAndDrink' | 'BuyAndEat'> {
	const { memory, actor, deps } = ctx;
	const { config, getLocations, getLocationActors, worldEntity } = deps;

	function findSourceWithItem(itemPredicate: (itemId: string) => boolean): { locationId: string; distance: number } | null {
		const locationActorMap = getLocationActors();
		const locations = getLocations();
		const agentX = actor.pos.x;
		const agentY = actor.pos.y;
		let best: { locationId: string; distance: number } | null = null;
		for (const loc of locations) {
			const locActor = locationActorMap.get(loc.id);
			if (locActor?.has(FacilityComponent) !== true) continue;
			const facility = locActor.get(FacilityComponent);
			const hasItem = facility.state.stock.some(s => itemPredicate(s.item_id) && s.quantity > 0);
			if (!hasItem) continue;
			const dx = loc.position.x - agentX;
			const dy = loc.position.y - agentY;
			const d = Math.sqrt(dx * dx + dy * dy);
			if (best === null || d < best.distance) {
				best = { locationId: loc.id, distance: d };
			}
		}
		return best;
	}

	function runComposite(
		actionName: 'buy_and_drink' | 'buy_and_eat',
		itemPredicate: (itemId: string) => boolean,
		onConsume: (agent: typeof actor, itemId: string) => void,
	): ActionResult {
		// If we already have a target, stick with it (travel in progress)
		let targetId: string | null = memory.serviceTarget;
		if (targetId === null) {
			const found = findSourceWithItem(itemPredicate);
			if (found === null) return FAILED;
			targetId = found.locationId;
			memory.serviceTarget = targetId;
		}

		// Travel phase
		if (memory.atLocation !== targetId) {
			beginAction(ctx, actionName);
			memory.movementTarget = { id: targetId, type: 'location' };
			return RUNNING;
		}

		// Arrival: buy + consume inline
		const locationActorMap = getLocationActors();
		const targetActor = locationActorMap.get(targetId);
		const locations = getLocations();
		const targetLoc = locations.find(l => l.id === targetId);
		if (targetActor === undefined || targetLoc === undefined || !targetActor.has(FacilityComponent)) {
			memory.serviceTarget = null;
			return FAILED;
		}

		const facility = targetActor.get(FacilityComponent);
		const stockItem = facility.state.stock.find(s => itemPredicate(s.item_id) && s.quantity > 0);
		if (stockItem === undefined) {
			memory.serviceTarget = null;
			return FAILED;
		}

		// Build NearestFacility shape for executePurchase
		const target = { location: targetLoc, actor: targetActor, itemId: stockItem.item_id };
		const world = worldEntity();
		const economy = world.get(EconomyComponent);
		const itemReg = deps.getItemRegistry?.() ?? new Map();
		const itemDef = itemReg.get(stockItem.item_id);

		const purchaseResult = executePurchase(
			actor,
			target,
			economy,
			{ ...deps, tickCount: deps.tickCount() } as unknown as Parameters<typeof executePurchase>[3],
			itemDef,
			config.economy.food_price,
		);

		if (!purchaseResult.success) {
			memory.serviceTarget = null;
			return FAILED;
		}

		// Consume inline
		onConsume(actor, stockItem.item_id);

		memory.serviceTarget = null;
		return SUCCEEDED;
	}

	return {
		BuyAndDrink(): ActionResult {
			return runComposite(
				'buy_and_drink',
				(id) => id === 'water',
				(a) => {
					const inv = a.get(InventoryComponent);
					const newItems = inv.state.items
						.map(i => {
							if (i.item_id !== 'water') return { ...i };
							const newQty = i.quantity - 1;
							return newQty > 0 ? { ...i, quantity: newQty } : null;
						})
						.filter((i): i is NonNullable<typeof i> => i !== null);
					inv.state = { ...inv.state, items: newItems };
					inv.markDirty();
					const needs = a.get(NeedsComponent);
					needs.state = { ...needs.state, thirst: Math.min(100, needs.state.thirst + config.needs.drink_recovery) };
					needs.markDirty();
				},
			);
		},

		BuyAndEat(): ActionResult {
			return runComposite(
				'buy_and_eat',
				(id) => FOOD_ITEMS.has(id),
				(a) => {
					const inv = a.get(InventoryComponent);
					const food = findFoodInInventory([...inv.state.items]);
					if (food === null) return;
					const newItems = inv.state.items
						.map(i => {
							if (i.item_id !== food.item_id) return { ...i };
							const newQty = i.quantity - 1;
							return newQty > 0 ? { ...i, quantity: newQty } : null;
						})
						.filter((i): i is NonNullable<typeof i> => i !== null);
					inv.state = { ...inv.state, items: newItems };
					inv.markDirty();
					const needs = a.get(NeedsComponent);
					needs.state = { ...needs.state, hunger: Math.min(100, needs.state.hunger + config.needs.food_recovery_rate) };
					needs.markDirty();
				},
			);
		},
	};
}
```

Note: the `executePurchase` call wraps `deps` to convert `tickCount()` function into a number — TradeSystem uses `GameCoreDeps` with numeric `tickCount`, BehaviorAgent uses function. The cast isolates this.

- [ ] **Step 5: Wire BuyAndDrink/BuyAndEat into createActions**

In `bt-actions.ts`, add the import at the top:
```typescript
import { createBuyActions } from './bt-actions-buy.js';
```

In the `createActions` return spread (around line 114), add:
```typescript
		...createBuyActions(ctx),
```

- [ ] **Step 6: Run tests**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run tests/infrastructure/entity/bt-actions-buy.test.ts --config configs/vitest.config.ts`
Expected: PASS. All 5 BuyAndDrink tests pass.

- [ ] **Step 7: Run typecheck + full test suite**

Run: `cd "01 - Projects/Project Meridian" && npx tsc --noEmit --project configs/tsconfig.json && npx vitest run --config configs/vitest.config.ts`
Expected: clean.

- [ ] **Step 8: Commit**

```bash
git add "01 - Projects/Project Meridian/src/infrastructure/entity/bt-actions-buy.ts" "01 - Projects/Project Meridian/src/infrastructure/entity/bt-actions.ts" "01 - Projects/Project Meridian/tests/infrastructure/entity/bt-actions-buy.test.ts"
git commit -m "feat(meridian): add BuyAndDrink + BuyAndEat composite actions"
```

---

## Chunk 3: ContinueCommitment selective exemption

### Task 3: Selective commitment exemption for composite actions

**Files:**
- Modify: `01 - Projects/Project Meridian/src/infrastructure/entity/bt-actions.ts`
- Modify: `01 - Projects/Project Meridian/tests/infrastructure/entity/bt-actions.test.ts`

- [ ] **Step 1: Write failing tests for selective exemption**

Add tests to the existing `CommitmentChanged events` describe block in `bt-actions.test.ts` (or a new block if preferred):

```typescript
it('does NOT break buy_and_drink commitment when thirst is critical', () => {
	const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
	const { actions, memory } = setupActions(actor);
	memory.committedAction = 'buy_and_drink';
	memory.commitmentTicks = 5;
	// Critical thirst — normally would break, but buy_and_drink is resolving it
	actor.get(NeedsComponent).state = { hunger: 80, energy: 80, social: 70, thirst: 10 };

	const result = actions.ContinueCommitment();
	expect(result).toBe('mistreevous.running');
	expect(memory.commitmentTicks).toBe(4); // decremented, not broken
});

it('DOES break buy_and_drink commitment when hunger is critical', () => {
	const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
	const { actions, memory } = setupActions(actor);
	memory.committedAction = 'buy_and_drink';
	memory.commitmentTicks = 5;
	// Critical hunger — breaks even though buy_and_drink handles thirst
	actor.get(NeedsComponent).state = { hunger: 10, energy: 80, social: 70, thirst: 80 };

	const result = actions.ContinueCommitment();
	expect(result).toBe('mistreevous.failed');
	expect(memory.commitmentTicks).toBe(0);
});

it('does NOT break buy_and_eat commitment when hunger is critical', () => {
	const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
	const { actions, memory } = setupActions(actor);
	memory.committedAction = 'buy_and_eat';
	memory.commitmentTicks = 5;
	actor.get(NeedsComponent).state = { hunger: 10, energy: 80, social: 70, thirst: 80 };

	const result = actions.ContinueCommitment();
	expect(result).toBe('mistreevous.running');
});

it('DOES break buy_and_eat commitment when thirst is critical', () => {
	const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
	const { actions, memory } = setupActions(actor);
	memory.committedAction = 'buy_and_eat';
	memory.commitmentTicks = 5;
	actor.get(NeedsComponent).state = { hunger: 80, energy: 80, social: 70, thirst: 10 };

	const result = actions.ContinueCommitment();
	expect(result).toBe('mistreevous.failed');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run tests/infrastructure/entity/bt-actions.test.ts -t "buy_and" --config configs/vitest.config.ts`
Expected: FAIL — current code breaks ALL non-use_service commitments on any critical need.

- [ ] **Step 3: Update ContinueCommitment critical-need check**

In `bt-actions.ts` (around lines 172-183), replace:

```typescript
			// Break non-recovery commitments when needs are critical.
			// use_service is exempt: it IS the recovery mechanism — breaking it
			// on critical needs prevents energy/mood from ever recovering.
			if (memory.committedAction !== 'use_service') {
				const critNeeds = actor.get(NeedsComponent).state;
				if (critNeeds.hunger < NEED_CRITICAL_THRESHOLDS.hunger ||
					critNeeds.energy < NEED_CRITICAL_THRESHOLDS.energy ||
					critNeeds.thirst < NEED_CRITICAL_THRESHOLDS.thirst) {
					breakCommitment('critical_need');
					return FAILED;
				}
			}
```

With selective exemption:

```typescript
			// Selective exemption for recovery commitments:
			// - use_service: full exemption (already at facility, visit in progress)
			// - buy_and_drink: exempt from thirst (it IS resolving thirst),
			//                  breaks on critical hunger/energy
			// - buy_and_eat:   exempt from hunger (it IS resolving hunger),
			//                  breaks on critical thirst/energy
			const ca = memory.committedAction;
			if (ca !== 'use_service') {
				const critNeeds = actor.get(NeedsComponent).state;
				const hungerCritical = ca !== 'buy_and_eat' && critNeeds.hunger < NEED_CRITICAL_THRESHOLDS.hunger;
				const energyCritical = critNeeds.energy < NEED_CRITICAL_THRESHOLDS.energy;
				const thirstCritical = ca !== 'buy_and_drink' && critNeeds.thirst < NEED_CRITICAL_THRESHOLDS.thirst;
				if (hungerCritical || energyCritical || thirstCritical) {
					breakCommitment('critical_need');
					return FAILED;
				}
			}
```

- [ ] **Step 4: Run tests**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run tests/infrastructure/entity/bt-actions.test.ts --config configs/vitest.config.ts`
Expected: PASS.

- [ ] **Step 5: Run full test suite**

Run: `cd "01 - Projects/Project Meridian" && npx tsc --noEmit --project configs/tsconfig.json && npx vitest run --config configs/vitest.config.ts`
Expected: all clean.

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Project Meridian/src/infrastructure/entity/bt-actions.ts" "01 - Projects/Project Meridian/tests/infrastructure/entity/bt-actions.test.ts"
git commit -m "feat(meridian): selective commitment exemption for composite buy actions"
```

---

## Chunk 4: BT tree integration

### Task 4: Replace seek/buy/consume sequences with composite calls

**Files:**
- Modify: `01 - Projects/Project Meridian/behavior-trees/base.mdsl`

- [ ] **Step 1: Update P0 thirst branch**

In `behavior-trees/base.mdsl`, find the P0 thirst sequences (lines 30-53). Replace:

```
                /* Thirsty: buy water at a well if affordable */
                sequence {
                    condition [IsThirsty]
                    flip { condition [HasWater] }
                    condition [CanAffordItem, "water"]
                    action [SeekWell]
                    action [BuyItem, "water"]
                    action [Drink]
                }
                /* Thirsty: buy water at the market if affordable */
                sequence {
                    condition [IsThirsty]
                    flip { condition [HasWater] }
                    condition [CanAffordItem, "water"]
                    action [SeekMarket]
                    action [BuyItem, "water"]
                    action [Drink]
                }
```

With a single composite branch:

```
                /* Thirsty: travel + buy + drink atomically */
                sequence {
                    condition [IsThirsty]
                    flip { condition [HasWater] }
                    condition [CanAffordItem, "water"]
                    action [BuyAndDrink]
                }
```

- [ ] **Step 2: Update P0 hunger branches**

Replace the three hunger buy branches (lines 67-81):

```
                /* Seek known food source */
                sequence {
                    condition [IsHungry]
                    condition [CanAffordFood]
                    condition [KnowsFoodSource]
                    action [SeekBestFoodSource]
                    action [Buy]
                }
                /* Fallback: seek any food source if desperate */
                sequence {
                    condition [IsHungry]
                    condition [CanAffordFood]
                    action [SeekFood]
                    action [Buy]
                }
```

With:

```
                /* Hungry: travel + buy + eat atomically */
                sequence {
                    condition [IsHungry]
                    condition [CanAffordFood]
                    action [BuyAndEat]
                }
```

- [ ] **Step 3: Update P3 non-critical thirst**

Replace the P3 inner selector (lines 165-182):

```
        sequence {
            condition [IsThirsty]
            selector {
                sequence {
                    condition [HasWater]
                    action [Drink]
                }
                sequence {
                    condition [CanAffordItem, "water"]
                    action [SeekWell]
                    action [BuyItem, "water"]
                    action [Drink]
                }
                sequence {
                    condition [CanAffordItem, "water"]
                    action [SeekMarket]
                    action [BuyItem, "water"]
                    action [Drink]
                }
            }
        }
```

With:

```
        sequence {
            condition [IsThirsty]
            selector {
                sequence {
                    condition [HasWater]
                    action [Drink]
                }
                sequence {
                    condition [CanAffordItem, "water"]
                    action [BuyAndDrink]
                }
            }
        }
```

- [ ] **Step 4: Update P4 non-critical hunger**

Replace the P4 inner selector (lines 188-214). The `HasFood→Eat`, `FacilityHasStock→Buy`, and `HasJob+IsWorkHours→SeekWork` branches stay. The `CanAffordFood → selector{KnowsFoodSource→SeekBestFoodSource, SeekFood} → Buy` branch becomes `CanAffordFood → BuyAndEat`:

```
        sequence {
            condition [IsHungry]
            selector {
                sequence {
                    condition [HasFood]
                    action [Eat] while(IsHungry)
                }
                sequence {
                    condition [CanAffordFood]
                    condition [FacilityHasStock, "food"]
                    action [Buy]
                }
                sequence {
                    condition [CanAffordFood]
                    action [BuyAndEat]
                }
                sequence {
                    condition [HasJob]
                    condition [IsWorkHours]
                    action [SeekWork]
                }
            }
        }
```

- [ ] **Step 5: Run full test suite + build**

Run: `cd "01 - Projects/Project Meridian" && npx tsc --noEmit --project configs/tsconfig.json && npx vitest run --config configs/vitest.config.ts && npm run build`
Expected: all clean. The BT parser should accept the new action names; existing tests shouldn't break since we kept all other actions.

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Project Meridian/behavior-trees/base.mdsl"
git commit -m "feat(meridian): use BuyAndDrink + BuyAndEat composite actions in BT tree"
```

---

## Chunk 5: BuyAndEat tests

### Task 5: Add BuyAndEat tests for full coverage

**Files:**
- Modify: `01 - Projects/Project Meridian/tests/infrastructure/entity/bt-actions-buy.test.ts`

- [ ] **Step 1: Add BuyAndEat test cases**

Append to the test file after the BuyAndDrink describe block:

```typescript
describe('BuyAndEat', () => {
	it('returns FAILED when no food source is visible', () => {
		const agent = createTestAgent();
		const ctx = createCtx(agent, [], new Map(), createWorldEntity());
		const actions = createBuyActions(ctx);
		expect(actions.BuyAndEat()).toBe('mistreevous.failed');
	});

	it('buys + eats inline when at food source, returns SUCCEEDED', () => {
		const agent = createTestAgent(100, 0, 50);
		agent.get(NeedsComponent).state = { hunger: 30, energy: 80, social: 70, thirst: 80 };
		const market: WorldLocation = { id: 'loc-market', name: 'Market', type: 'market_stall', position: { x: 100, y: 0, region: 'test' }, capacity: 10, color: '#808080' } as unknown as WorldLocation;
		const marketActor = new Actor();
		marketActor.addComponent(new FacilityComponent({
			stock: [{ item_id: 'food', quantity: 5 }],
			fund: 100, workProgress: 0, status: 'idle', workerId: null,
		}));
		const ctx = createCtx(agent, [market], new Map([['loc-market', marketActor]]), createWorldEntity());
		ctx.memory.atLocation = 'loc-market';
		const actions = createBuyActions(ctx);
		const result = actions.BuyAndEat();
		expect(result).toBe('mistreevous.succeeded');
		expect(agent.get(NeedsComponent).state.hunger).toBeGreaterThan(30);
		expect(agent.get(WalletComponent).state.gold).toBeLessThan(50);
	});
});
```

- [ ] **Step 2: Run tests**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run tests/infrastructure/entity/bt-actions-buy.test.ts --config configs/vitest.config.ts`
Expected: PASS for both BuyAndDrink and BuyAndEat.

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Project Meridian/tests/infrastructure/entity/bt-actions-buy.test.ts"
git commit -m "test(meridian): add BuyAndEat test coverage"
```
