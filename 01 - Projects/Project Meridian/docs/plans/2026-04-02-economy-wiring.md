# Economy Wiring — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect pure domain economy modules (pricing, demand tracking, price memory, monetary policy) into the live simulation — making prices dynamic, velocity tracking complete, and agents price-aware.

**Architecture:** Two halves. Plumbing: item data files + vault loading, dynamic pricing in trade flow, GoldFlowed emission from all gold-moving systems, effective tax rate wiring. Agent intelligence: BehaviorAgent price memory (CircularBuffer), price-aware conditions/actions, MDSL tree update for cheapest-source shopping. All changes follow the existing dual-layer pattern (pure domain functions tested independently, infrastructure wrappers connect to ECS).

**Tech Stack:** TypeScript (strict), ExcaliburJS ECS, mistreevous MDSL, Zod v4, mnemonist CircularBuffer, Vitest

**Spec:** `docs/specs/2026-04-02-economy-wiring-design.md`

**Project root for all commands:** `cd "01 - Projects/Project Meridian"`

---

## Chunk 1: Item Data + Loading

Create item JSON data files, build an item loader following the existing VaultReader pattern, and wire it into the world-loader pipeline.

---

### Task 1: Create Item Data Files

**Files:**
- Create: `items/bread.json`
- Create: `items/wheat.json`
- Create: `items/leather-goods.json`

- [ ] **Step 1: Create the items directory and files**

All item files go under the project root `items/` directory (same level as `agents/`, `locations/`). The world-loader will read from this path.

Create `items/bread.json`:
```json
{
	"id": "bread",
	"name": "Bread",
	"baseValue": 5,
	"category": "subsistence"
}
```

Create `items/wheat.json`:
```json
{
	"id": "wheat",
	"name": "Wheat",
	"baseValue": 2,
	"category": "trade_goods"
}
```

Create `items/leather-goods.json`:
```json
{
	"id": "leather-goods",
	"name": "Leather Goods",
	"baseValue": 8,
	"category": "trade_goods"
}
```

- [ ] **Step 2: Commit**

```bash
git add "01 - Projects/Project Meridian/items/"
git commit -m "data(meridian): add item JSON files — bread, wheat, leather-goods"
```

---

### Task 2: Item Loader — TDD

**Files:**
- Create: `src/infrastructure/entity/item-loader.ts`
- Create: `tests/infrastructure/entity/item-loader.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/infrastructure/entity/item-loader.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { createItemLoader } from '../../../src/infrastructure/entity/item-loader.js';
import type { Logger } from '../../../src/domain/core/logger.js';
import type { VaultReader } from '../../../src/infrastructure/entity/agent-spawner.js';

function stubLogger(): Logger {
	return {
		info: () => {},
		warn: () => {},
		debug: () => {},
		error: () => {},
	};
}

function stubVault(files: Record<string, string>): VaultReader {
	return {
		list: async (path: string) => Object.keys(files).filter(f => f.startsWith(path)),
		read: async (path: string) => files[path] ?? '',
	};
}

describe('ItemLoader', () => {
	it('loads valid item files', async () => {
		const vault = stubVault({
			'items/bread.json': JSON.stringify({ id: 'bread', name: 'Bread', baseValue: 5, category: 'subsistence' }),
			'items/wheat.json': JSON.stringify({ id: 'wheat', name: 'Wheat', baseValue: 2 }),
		});
		const loader = createItemLoader(stubLogger());
		const result = await loader.loadFromVault(vault, 'items');
		expect(result.items).toHaveLength(2);
		expect(result.errors).toHaveLength(0);
		expect(result.items[0].id).toBe('bread');
		expect(result.items[0].category).toBe('subsistence');
		expect(result.items[1].category).toBe('trade_goods'); // default
	});

	it('reports errors for invalid files', async () => {
		const vault = stubVault({
			'items/bad.json': JSON.stringify({ id: '', name: 'Bad', baseValue: -1 }),
		});
		const loader = createItemLoader(stubLogger());
		const result = await loader.loadFromVault(vault, 'items');
		expect(result.items).toHaveLength(0);
		expect(result.errors).toHaveLength(1);
		expect(result.errors[0].file).toBe('items/bad.json');
	});

	it('handles malformed JSON', async () => {
		const vault = stubVault({
			'items/broken.json': '{ not valid json',
		});
		const loader = createItemLoader(stubLogger());
		const result = await loader.loadFromVault(vault, 'items');
		expect(result.items).toHaveLength(0);
		expect(result.errors).toHaveLength(1);
	});

	it('returns empty result for empty directory', async () => {
		const vault = stubVault({});
		const loader = createItemLoader(stubLogger());
		const result = await loader.loadFromVault(vault, 'items');
		expect(result.items).toHaveLength(0);
		expect(result.errors).toHaveLength(0);
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd "01 - Projects/Project Meridian"
npx vitest run tests/infrastructure/entity/item-loader.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `src/infrastructure/entity/item-loader.ts`:

```typescript
import type { Logger } from '../../domain/core/logger.js';
import type { VaultReader } from './agent-spawner.js';
import { ItemSchema, type Item } from '../../domain/schemas/item-schema.js';
import type { LoadResult } from './location-loader.js';

export function createItemLoader(
	logger: Logger,
): { loadFromVault(vault: VaultReader, path: string): Promise<LoadResult<Item>> } {
	return {
		async loadFromVault(vault: VaultReader, path: string): Promise<LoadResult<Item>> {
			const items: Item[] = [];
			const errors: { file: string; message: string }[] = [];
			const files = await vault.list(path);
			for (const file of files) {
				try {
					const content = await vault.read(file);
					const parsed: unknown = JSON.parse(content);
					items.push(ItemSchema.parse(parsed));
				} catch (err: unknown) {
					const message = err instanceof Error ? err.message : String(err);
					logger.warn('ItemLoader', `Failed to load ${file}: ${message}`);
					errors.push({ file, message });
				}
			}
			logger.info('ItemLoader', `Loaded ${String(items.length)} items, ${String(errors.length)} errors`);
			return { items, errors };
		},
	};
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd "01 - Projects/Project Meridian"
npx vitest run tests/infrastructure/entity/item-loader.test.ts
```

Expected: All 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Project Meridian/src/infrastructure/entity/item-loader.ts" "01 - Projects/Project Meridian/tests/infrastructure/entity/item-loader.test.ts"
git commit -m "feat(meridian): add item loader following VaultReader pattern"
```

---

### Task 3: Wire Item Loader into World Loader

**Files:**
- Modify: `src/infrastructure/engine/world-loader.ts`

- [ ] **Step 1: Read the current world-loader.ts**

Read `src/infrastructure/engine/world-loader.ts` to find:
- The `WorldData` interface (line 19)
- The `STEPS` array (line 48)
- The loading pipeline (lines 113-148)
- The final return assembly (lines 183-191)

- [ ] **Step 2: Add items to WorldData interface**

Add `items: Map<string, Item>` to the `WorldData` interface. Add the import for `Item` from `../../domain/schemas/item-schema.js` and `createItemLoader` from `../entity/item-loader.js`.

- [ ] **Step 3: Add items loading step to STEPS array**

Add `'Loading items...'` to the STEPS array.

- [ ] **Step 4: Add item loading logic to the pipeline**

After the behavior trees loading and before the final assembly, add:

```typescript
onProgress?.(stepIndex, total, 'Loading items...');
const itemResult = await createItemLoader(logger).loadFromVault(vault, 'items');
collectErrors('items', itemResult.errors, errors);
const itemRegistry = new Map<string, Item>();
for (const item of itemResult.items) {
	itemRegistry.set(item.id, item);
}
```

The items directory is at the project root (`items/`), matching where the JSON files were created in Task 1.

- [ ] **Step 5: Add items to the return object**

Add `items: itemRegistry` to the return statement.

- [ ] **Step 6: Verify types compile**

```bash
cd "01 - Projects/Project Meridian"
npx tsc --noEmit --project configs/tsconfig.json
```

Expected: No type errors.

- [ ] **Step 7: Run existing tests to verify no regressions**

```bash
cd "01 - Projects/Project Meridian"
npx vitest run tests/domain/
```

Expected: All existing tests pass.

- [ ] **Step 8: Commit**

```bash
git add "01 - Projects/Project Meridian/src/infrastructure/engine/world-loader.ts"
git commit -m "feat(meridian): wire item loader into world-loader pipeline"
```

---

## Chunk 2: Plumbing — GoldFlowed, Dynamic Pricing, Tax Rate

Complete velocity tracking by emitting GoldFlowed from all gold-moving systems, switch trade to dynamic pricing, and wire effective tax rate.

---

### Task 4: Add monetarySnapshot to EconomyState

**Files:**
- Modify: `src/domain/core/component-data.ts`

- [ ] **Step 1: Add monetarySnapshot field**

In `src/domain/core/component-data.ts`, add to `EconomyState` (after line 105, before the closing `}`):

```typescript
monetarySnapshot?: MonetarySnapshot;
```

Add the import at the top of the file:

```typescript
import type { MonetarySnapshot } from '../systems/monetary-policy.js';
```

- [ ] **Step 2: Verify types compile**

```bash
cd "01 - Projects/Project Meridian"
npx tsc --noEmit --project configs/tsconfig.json
```

Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Project Meridian/src/domain/core/component-data.ts"
git commit -m "feat(meridian): add monetarySnapshot to EconomyState for velocity-driven tax"
```

---

### Task 5: MonetaryPolicySystem Writes Snapshot

**Files:**
- Modify: `src/infrastructure/systems/monetary-policy-system.ts`

- [ ] **Step 1: Add snapshot write to execute()**

In `monetary-policy-system.ts`, after the `calculateMonetarySnapshot()` call (around line 52-57), add:

```typescript
// Write snapshot to EconomyComponent for other systems to read
economy.state = { ...economy.state, monetarySnapshot: snapshot };
economy.markDirty();
```

- [ ] **Step 2: Verify types compile**

```bash
cd "01 - Projects/Project Meridian"
npx tsc --noEmit --project configs/tsconfig.json
```

- [ ] **Step 3: Run tests**

```bash
cd "01 - Projects/Project Meridian"
npx vitest run tests/domain/
```

Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Project Meridian/src/infrastructure/systems/monetary-policy-system.ts"
git commit -m "feat(meridian): MonetaryPolicySystem writes velocity snapshot to EconomyComponent"
```

---

### Task 6: GoldFlowed Emissions — Day-Night System

**Files:**
- Modify: `src/infrastructure/systems/day-night-system.ts`

The day-boundary processing is in `day-night-system.ts`, not facility-system.ts. Functions: `processDayBoundary()` (line 274), `processStipends()` (line 168), `processFacilitySubsidies()` (line 226).

- [ ] **Step 1: Add GoldFlowed to treasury regen**

In `processDayBoundary()`, after line 290 (`economy.state = { ...economy.state, treasury: economy.state.treasury + treasuryRegen }`), add:

```typescript
deps.eventBus.emit({
	type: 'GoldFlowed',
	tick: deps.tickCount,
	wallClock: Date.now(),
	source: 'DayNightSystem',
	payload: {
		category: 'faucet' as const,
		subcategory: 'treasury_regen',
		amount: treasuryRegen,
		fromEntity: null,
		toEntity: 'treasury',
	},
});
```

- [ ] **Step 2: Add GoldFlowed to stipends**

In `processStipends()`, after the wallet update and ledger recording (after the `economy.markDirty()` around line 214), add:

```typescript
deps.eventBus.emit({
	type: 'GoldFlowed',
	tick: deps.tickCount,
	wallClock: Date.now(),
	source: 'DayNightSystem',
	payload: {
		category: 'transfer' as const,
		subcategory: 'stipend',
		amount: stipendAmount,
		fromEntity: 'treasury',
		toEntity: agent.agentId,
	},
});
```

- [ ] **Step 3: Add GoldFlowed to facility subsidies**

In `processFacilitySubsidies()`, after the `economy.markDirty()` (around line 262), add:

```typescript
deps.eventBus.emit({
	type: 'GoldFlowed',
	tick: deps.tickCount,
	wallClock: Date.now(),
	source: 'DayNightSystem',
	payload: {
		category: 'transfer' as const,
		subcategory: 'subsidy',
		amount: subsidyAmount,
		fromEntity: 'treasury',
		toEntity: loc.id,
	},
});
```

- [ ] **Step 4: Verify types compile**

```bash
cd "01 - Projects/Project Meridian"
npx tsc --noEmit --project configs/tsconfig.json
```

- [ ] **Step 5: Run tests**

```bash
cd "01 - Projects/Project Meridian"
npx vitest run tests/domain/
```

Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Project Meridian/src/infrastructure/systems/day-night-system.ts"
git commit -m "feat(meridian): emit GoldFlowed for treasury regen, stipends, and subsidies"
```

---

### Task 7: GoldFlowed Emissions — Facility Wages/Tax + Rest Payment

**Files:**
- Modify: `src/infrastructure/systems/facility-system.ts`
- Modify: `src/infrastructure/systems/rest-system.ts`

- [ ] **Step 1: Add GoldFlowed to facility wages**

In `facility-system.ts`, in `recordCycleComplete()`, after the wallet update (around line 86), add:

```typescript
deps.eventBus.emit({
	type: 'GoldFlowed',
	tick: deps.tickCount,
	wallClock: Date.now(),
	source: 'FacilitySystem',
	payload: {
		category: 'transfer' as const,
		subcategory: 'wage',
		amount: result.workerGoldChange,
		fromEntity: loc.id,
		toEntity: worker.agentId,
	},
});
```

- [ ] **Step 2: Add GoldFlowed to facility tax**

In the same function, after the treasury update (after the `economy.markDirty()` around line 118), add:

```typescript
if (result.taxCollected > 0) {
	deps.eventBus.emit({
		type: 'GoldFlowed',
		tick: deps.tickCount,
		wallClock: Date.now(),
		source: 'FacilitySystem',
		payload: {
			category: 'transfer' as const,
			subcategory: 'tax',
			amount: result.taxCollected,
			fromEntity: loc.id,
			toEntity: 'treasury',
		},
	});
}
```

- [ ] **Step 3: Add GoldFlowed to rest payment**

In `rest-system.ts`, after the wallet deduction and tavern fund credit (around line 134), add:

```typescript
deps.eventBus.emit({
	type: 'GoldFlowed',
	tick: deps.tickCount,
	wallClock: Date.now(),
	source: 'RestSystem',
	payload: {
		category: 'transfer' as const,
		subcategory: 'rest',
		amount: restPrice,
		fromEntity: agent.agentId,
		toEntity: nearestRest?.id ?? 'outdoors',
	},
});
```

- [ ] **Step 4: Verify types compile and tests pass**

```bash
cd "01 - Projects/Project Meridian"
npx tsc --noEmit --project configs/tsconfig.json && npx vitest run tests/domain/
```

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Project Meridian/src/infrastructure/systems/facility-system.ts" "01 - Projects/Project Meridian/src/infrastructure/systems/rest-system.ts"
git commit -m "feat(meridian): emit GoldFlowed for wages, tax, and rest payments"
```

---

### Task 8: Effective Tax Rate + Demand Recording in EconomySystem

**Files:**
- Modify: `src/infrastructure/systems/facility-system.ts`
- Modify: `src/infrastructure/systems/economy-system.ts`

- [ ] **Step 1: Wire effective tax rate in facility-system**

Read `src/infrastructure/systems/facility-system.ts` to find where `applyFacilityTick` is called and the tax rate is passed. The domain function `applyFacilityTick()` in `src/domain/systems/facility.ts` receives a `taxRate` input. Find where this is constructed in the infrastructure wrapper and replace the static rate with velocity-driven rate.

Add import at top of facility-system.ts:
```typescript
import { getEffectiveTaxRate } from '../../domain/systems/monetary-policy.js';
```

Where the tax rate is passed to `applyFacilityTick`, replace:
```typescript
// Before:
taxRate: deps.config.economy.tax_base_rate,

// After:
taxRate: (() => {
	const snapshot = economy.state.monetarySnapshot;
	if (snapshot === undefined) return deps.config.economy.tax_base_rate;
	const mp = deps.config.economy.monetary_policy;
	return getEffectiveTaxRate(
		mp.tax_base_rate,
		snapshot.velocity,
		{ stagnant: mp.velocity_stagnant, overheated: mp.velocity_overheated },
		{ stagnant: mp.tax_stagnant_multiplier, overheated: mp.tax_overheated_multiplier },
	);
})(),
```

- [ ] **Step 2: Add demand recording to EconomySystem**

In `src/infrastructure/systems/economy-system.ts`, inside `execute()`, before the recalc queue loop (after the `initialized` block), add:

```typescript
// Record consumption from completed purchases for demand tracking
const purchases = deps.eventBus.history({ type: 'PurchaseComplete' })
	.filter(e => e.tick === deps.tickCount);
for (const e of purchases) {
	const itemId = e.payload.itemId;
	if (typeof itemId === 'string') {
		recordConsumption(demandTracker, itemId, 1, deps.tickCount);
	}
}
```

Add import for `recordConsumption` (it should already be partially imported — check the existing imports).

- [ ] **Step 3: Verify types compile and tests pass**

```bash
cd "01 - Projects/Project Meridian"
npx tsc --noEmit --project configs/tsconfig.json && npx vitest run tests/domain/
```

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Project Meridian/src/infrastructure/systems/facility-system.ts" "01 - Projects/Project Meridian/src/infrastructure/systems/economy-system.ts"
git commit -m "feat(meridian): wire effective tax rate from velocity + demand recording from purchases"
```

---

### Task 9: Dynamic Pricing in Trade System

**Files:**
- Modify: `src/infrastructure/systems/trade-system.ts`

- [ ] **Step 1: Add itemRegistry parameter to factory**

In `trade-system.ts`, modify the `createTradeSystem` factory signature (line 178) to add `itemRegistry`:

```typescript
export function createTradeSystem(
	agents: () => AgentActor[],
	locations: () => WorldLocation[],
	getLocationActors: () => Map<string, Actor>,
	worldEntity: () => Actor,
	itemRegistry: () => Map<string, Item>,
): GameSystem {
```

Add import: `import type { Item } from '../../domain/schemas/item-schema.js';`

- [ ] **Step 2: Replace static food_price with dynamic price**

In the `execute()` method (around line 195), replace:

```typescript
const foodPrice = deps.config.economy.food_price;
```

with:

```typescript
const facility = target.actor.get(FacilityComponent);
const item = itemRegistry().get(target.foodItemId);
const foodPrice = facility.state.currentPrices?.[target.foodItemId]
	?? item?.baseValue
	?? deps.config.economy.food_price;
```

Note: `target.actor.get(FacilityComponent)` is already called later — move the `facility` variable to before the `applyTrade` call to avoid a duplicate `.get()`.

- [ ] **Step 3: Verify types compile**

```bash
cd "01 - Projects/Project Meridian"
npx tsc --noEmit --project configs/tsconfig.json
```

There will be a type error where `createTradeSystem` is called (in game-view.ts or world-loader). Update the call site to pass the `itemRegistry` parameter.

- [ ] **Step 4: Fix the call site**

Find where `createTradeSystem()` is called (likely in `game-view.ts` or wherever systems are registered) and pass the item registry. The world data should now have `items: Map<string, Item>` from Task 3.

- [ ] **Step 5: Run tests**

```bash
cd "01 - Projects/Project Meridian"
npx vitest run tests/domain/
```

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Project Meridian/src/infrastructure/systems/trade-system.ts" "01 - Projects/Project Meridian/src/infrastructure/engine/game-view.ts"
git commit -m "feat(meridian): dynamic pricing in trade system — facility prices replace static food_price"
```

---

## Chunk 3: Agent Intelligence — Price Memory + BT Update

Add price memory to BehaviorAgent, implement price-aware conditions and actions, record price observations in TradeSystem, and update the MDSL tree.

---

### Task 10: BehaviorAgent Interface + Factory — Price Memory

**Files:**
- Modify: `src/domain/systems/behavior-agent.ts`
- Modify: `src/infrastructure/entity/behavior-agent-factory.ts`

- [ ] **Step 1: Add price memory members to BehaviorAgent interface**

In `behavior-agent.ts`, add imports at the top:

```typescript
import type { CircularBuffer } from 'mnemonist';
import type { PriceMemory } from './price-memory.js';
```

Add to the interface (after line 81, in the working memory section):

```typescript
	// Price memory
	priceMemories: CircularBuffer<PriceMemory>;
```

Add new condition method (after line 102, with the other conditions):

```typescript
	KnowsFoodSource(): boolean;
```

Add new action method and utility (after line 120, with the other actions):

```typescript
	SeekBestFoodSource(): ActionResult;
	recordPriceObservation(itemId: string, price: number, locationId: string, tick: number): void;
```

- [ ] **Step 2: Initialize CircularBuffer in factory**

In `behavior-agent-factory.ts`, add imports:

```typescript
import { CircularBuffer } from 'mnemonist';
import type { PriceMemory } from '../../domain/systems/price-memory.js';
import { isPriceStale, getBestKnownSource, getRememberedPrice } from '../../domain/systems/price-memory.js';
import { FOOD_ITEMS } from '../../domain/systems/food-items.js';
```

In the working memory section (after line 57), add:

```typescript
const priceMemories = new CircularBuffer<PriceMemory>(Array, deps.config.economy.price_memory_max);
```

Add `priceMemories` to the agent object returned by the factory.

- [ ] **Step 3: Implement recordPriceObservation**

In the factory's agent object, add:

```typescript
recordPriceObservation(itemId: string, price: number, locationId: string, tick: number): void {
	priceMemories.push({ itemId, price, locationId, tick });
},
```

- [ ] **Step 4: Implement KnowsFoodSource condition**

```typescript
KnowsFoodSource(): boolean {
	const staleTicks = deps.config.economy.price_memory_stale_ticks;
	const tick = deps.tickCount();
	for (const mem of priceMemories) {
		if (FOOD_ITEMS.has(mem.itemId) && !isPriceStale(mem, tick, staleTicks)) {
			return true;
		}
	}
	return false;
},
```

- [ ] **Step 5: Implement SeekBestFoodSource action**

```typescript
SeekBestFoodSource(): ActionResult {
	const staleTicks = deps.config.economy.price_memory_stale_ticks;
	const tick = deps.tickCount();
	let cheapestLocation: string | null = null;
	let cheapestPrice = Infinity;

	for (const foodId of FOOD_ITEMS) {
		const loc = getBestKnownSource(priceMemories, foodId, tick, staleTicks);
		if (loc === null) continue;
		const mem = getRememberedPrice(priceMemories, foodId, tick, staleTicks);
		if (mem !== null && mem.price < cheapestPrice) {
			cheapestPrice = mem.price;
			cheapestLocation = loc;
		}
	}

	if (cheapestLocation === null) return FAILED;
	btAction = 'seek_food';
	movementTarget = { id: cheapestLocation, type: 'location' };
	if (atLocation === cheapestLocation) return SUCCEEDED;
	return RUNNING;
},
```

- [ ] **Step 6: Update CanAffordFood to use price memories**

Replace the existing `CanAffordFood()` (line 248-250) with:

```typescript
CanAffordFood(): boolean {
	const staleTicks = deps.config.economy.price_memory_stale_ticks;
	const tick = deps.tickCount();
	let cheapestPrice = deps.config.economy.food_price;
	for (const mem of priceMemories) {
		if (FOOD_ITEMS.has(mem.itemId) && !isPriceStale(mem, tick, staleTicks)) {
			if (mem.price < cheapestPrice) cheapestPrice = mem.price;
		}
	}
	return agent.gold >= cheapestPrice;
},
```

- [ ] **Step 7: Update Buy() to remove redundant guards**

Replace the existing `Buy()` (lines 343-354) with:

```typescript
Buy(): ActionResult {
	const hasStock = agent.nearbyFacilities.some(f =>
		f.stock.some(s => FOOD_ITEMS.has(s.item_id) && s.quantity > 0),
	);
	if (!hasStock) return FAILED;
	agent.btAction = 'buy';
	return SUCCEEDED;
},
```

This removes the redundant wallet check (CanAffordFood gates in the BT) and replaces hardcoded `'bread'` with `FOOD_ITEMS`.

- [ ] **Step 8: Verify types compile**

```bash
cd "01 - Projects/Project Meridian"
npx tsc --noEmit --project configs/tsconfig.json
```

- [ ] **Step 9: Run tests**

```bash
cd "01 - Projects/Project Meridian"
npx vitest run tests/domain/
```

- [ ] **Step 10: Commit**

```bash
git add "01 - Projects/Project Meridian/src/domain/systems/behavior-agent.ts" "01 - Projects/Project Meridian/src/infrastructure/entity/behavior-agent-factory.ts"
git commit -m "feat(meridian): add price memory to BehaviorAgent — KnowsFoodSource, SeekBestFoodSource, CanAffordFood update"
```

---

### Task 11: Price Recording in TradeSystem

**Files:**
- Modify: `src/infrastructure/systems/trade-system.ts`

- [ ] **Step 1: Record price on successful purchase**

In `applySuccessfulTrade()` (around line 133, after the GoldFlowed emission), add:

```typescript
// Record price observation — agent learns current price
agent.behaviorAgent.recordPriceObservation(
	target.foodItemId,
	foodPrice,
	target.location.id,
	deps.tickCount,
);
```

- [ ] **Step 2: Record price on failed purchase**

In the `execute()` method, in the `else` branch (around line 218, after the PurchaseFailed event emission), add. Note: `facility` is already in scope from the dynamic price lookup added in Task 9 Step 2 — reuse it, don't re-fetch:

```typescript
// Agent still learns the price even when purchase fails
const failItem = itemRegistry().get(target.foodItemId);
const observedPrice = facility.state.currentPrices?.[target.foodItemId]
	?? failItem?.baseValue
	?? deps.config.economy.food_price;
agent.behaviorAgent.recordPriceObservation(
	target.foodItemId,
	observedPrice,
	target.location.id,
	deps.tickCount,
);
```

- [ ] **Step 3: Verify types compile and tests pass**

```bash
cd "01 - Projects/Project Meridian"
npx tsc --noEmit --project configs/tsconfig.json && npx vitest run tests/domain/
```

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Project Meridian/src/infrastructure/systems/trade-system.ts"
git commit -m "feat(meridian): record price observations in TradeSystem — success and failure paths"
```

---

### Task 12: MDSL Tree Update — Price-Aware Survival Branch

**Files:**
- Modify: `behavior-trees/base.mdsl`

- [ ] **Step 1: Update P0 survival branch**

In `behavior-trees/base.mdsl`, replace the P0 buy sequences (lines 13-23):

```
                sequence {
                    condition [IsHungry]
                    condition [CanAffordFood]
                    condition [FacilityHasStock, "bread"]
                    action [Buy]
                }
                sequence {
                    condition [IsHungry]
                    condition [CanAffordFood]
                    action [SeekFood] while(IsHungry)
                }
```

With (spec §6.1 — navigation and buy are separate steps in a sequence):

```
                /* Already at a food facility with stock — buy immediately */
                sequence {
                    condition [IsHungry]
                    condition [CanAffordFood]
                    condition [FacilityHasStock, "bread"]
                    action [Buy]
                }
                /* Not at facility — navigate to cheapest known or nearest, then buy */
                sequence {
                    condition [IsHungry]
                    condition [CanAffordFood]
                    selector {
                        sequence {
                            condition [KnowsFoodSource]
                            action [SeekBestFoodSource] while(IsHungry)
                        }
                        action [SeekFood] while(IsHungry)
                    }
                    action [Buy]
                }
```

The first sequence handles the "already at facility" case (fast path). The second sequence separates navigation (selector chooses cheapest-known vs nearest) from buying (Buy fires after arrival). This matches the spec's intent of navigation → buy as separate sequence steps.

- [ ] **Step 2: Update P1 hunger branch**

Replace the P1 buy sequences (lines 40-50):

```
                /* Buy food if at a facility with stock */
                sequence {
                    condition [CanAffordFood]
                    condition [FacilityHasStock, "bread"]
                    action [Buy]
                }
                /* Go find food to buy */
                sequence {
                    condition [CanAffordFood]
                    action [SeekFood]
                }
```

With:

```
                /* Buy food if at a facility with stock */
                sequence {
                    condition [CanAffordFood]
                    condition [FacilityHasStock, "bread"]
                    action [Buy]
                }
                /* Navigate to cheapest known food source, or nearest, then buy */
                sequence {
                    condition [CanAffordFood]
                    selector {
                        sequence {
                            condition [KnowsFoodSource]
                            action [SeekBestFoodSource]
                        }
                        action [SeekFood]
                    }
                    action [Buy]
                }
```

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Project Meridian/behavior-trees/base.mdsl"
git commit -m "feat(meridian): MDSL tree — price-aware food source selection via SeekBestFoodSource"
```

---

### Task 13: Integration Tests

**Files:**
- Create: `tests/integration/price-memory-shopping.test.ts`
- Modify: `tests/integration/economy-flow.test.ts`

- [ ] **Step 1: Write price memory shopping integration test**

Create `tests/integration/price-memory-shopping.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { CircularBuffer } from 'mnemonist';
import { isPriceStale, getBestKnownSource, getRememberedPrice, type PriceMemory } from '../../src/domain/systems/price-memory.js';
import { FOOD_ITEMS } from '../../src/domain/systems/food-items.js';

describe('Price memory shopping integration', () => {
	it('agent with two memories targets cheapest source', () => {
		const memories = new CircularBuffer<PriceMemory>(Array, 20);
		memories.push({ itemId: 'bread', price: 8, locationId: 'loc-bakery', tick: 100 });
		memories.push({ itemId: 'bread', price: 4, locationId: 'loc-market', tick: 110 });

		const staleTicks = 200;
		const currentTick = 150;

		// Find cheapest known bread source
		let cheapestLoc: string | null = null;
		let cheapestPrice = Infinity;
		for (const foodId of FOOD_ITEMS) {
			const loc = getBestKnownSource(memories, foodId, currentTick, staleTicks);
			if (loc === null) continue;
			const mem = getRememberedPrice(memories, foodId, currentTick, staleTicks);
			if (mem !== null && mem.price < cheapestPrice) {
				cheapestPrice = mem.price;
				cheapestLoc = loc;
			}
		}

		expect(cheapestLoc).toBe('loc-market');
		expect(cheapestPrice).toBe(4);
	});

	it('agent with only stale memories returns null', () => {
		const memories = new CircularBuffer<PriceMemory>(Array, 20);
		memories.push({ itemId: 'bread', price: 5, locationId: 'loc-bakery', tick: 10 });

		const staleTicks = 200;
		const currentTick = 300;

		let found = false;
		for (const foodId of FOOD_ITEMS) {
			const loc = getBestKnownSource(memories, foodId, currentTick, staleTicks);
			if (loc !== null) found = true;
		}
		expect(found).toBe(false);
	});

	it('agent with empty memories returns null', () => {
		const memories = new CircularBuffer<PriceMemory>(Array, 20);
		const loc = getBestKnownSource(memories, 'bread', 100, 200);
		expect(loc).toBeNull();
	});
});
```

- [ ] **Step 2: Add velocity completeness integration test**

Add to `tests/integration/economy-flow.test.ts`:

```typescript
describe('Complete velocity tracking', () => {
	it('monetary snapshot includes all gold flow categories', () => {
		const ledger = createMonetaryLedger(500);

		// Simulate all flow types
		recordFlow(ledger, { category: 'transfer', subcategory: 'purchase', amount: 5, tick: 10, fromEntity: 'agent-1', toEntity: 'loc-bakery' });
		recordFlow(ledger, { category: 'transfer', subcategory: 'wage', amount: 3, tick: 10, fromEntity: 'loc-farm', toEntity: 'agent-2' });
		recordFlow(ledger, { category: 'transfer', subcategory: 'tax', amount: 0.3, tick: 10, fromEntity: 'loc-farm', toEntity: 'treasury' });
		recordFlow(ledger, { category: 'transfer', subcategory: 'stipend', amount: 2, tick: 10, fromEntity: 'treasury', toEntity: 'agent-1' });
		recordFlow(ledger, { category: 'transfer', subcategory: 'subsidy', amount: 30, tick: 10, fromEntity: 'treasury', toEntity: 'loc-bakery' });
		recordFlow(ledger, { category: 'transfer', subcategory: 'rest', amount: 1, tick: 10, fromEntity: 'agent-1', toEntity: 'loc-tavern' });
		recordFlow(ledger, { category: 'faucet', subcategory: 'treasury_regen', amount: 50, tick: 10, fromEntity: null, toEntity: 'treasury' });

		const snap = calculateMonetarySnapshot(ledger, 20, [100, 80], 500);

		// All transfers included in velocity
		expect(snap.velocity).toBeGreaterThan(0);
		// Faucet tracked
		expect(snap.faucetRate).toBe(50);
		// Money supply = agent balances + treasury
		expect(snap.moneySupply).toBe(680);
	});
});
```

- [ ] **Step 3: Run all integration tests**

```bash
cd "01 - Projects/Project Meridian"
npx vitest run tests/integration/
```

Expected: All tests pass.

- [ ] **Step 4: Run full domain + integration test suite**

```bash
cd "01 - Projects/Project Meridian"
npx vitest run tests/domain/ tests/integration/
```

Expected: All tests pass (same baseline failures from ExcaliburJS window issue).

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Project Meridian/tests/integration/price-memory-shopping.test.ts" "01 - Projects/Project Meridian/tests/integration/economy-flow.test.ts"
git commit -m "test(meridian): add price memory shopping + complete velocity tracking integration tests"
```

---

## Final Verification

- [ ] **Run full test suite**

```bash
cd "01 - Projects/Project Meridian"
npx vitest run
```

Expected: All domain + integration tests pass. Infrastructure test failures are pre-existing ExcaliburJS window issue only.

- [ ] **Verify type compilation**

```bash
cd "01 - Projects/Project Meridian"
npx tsc --noEmit --project configs/tsconfig.json
```

Expected: No type errors.

- [ ] **Verify new file count**

New source files: 1 (`item-loader.ts`)
New test files: 2 (`item-loader.test.ts`, `price-memory-shopping.test.ts`)
New data files: 3 (`bread.json`, `wheat.json`, `leather-goods.json`)

Modified source files: ~10
- `component-data.ts` (monetarySnapshot on EconomyState)
- `behavior-agent.ts` (priceMemories, KnowsFoodSource, SeekBestFoodSource, recordPriceObservation)
- `behavior-agent-factory.ts` (CircularBuffer init, CanAffordFood, Buy, new conditions/actions)
- `world-loader.ts` (item loading step)
- `trade-system.ts` (dynamic pricing, itemRegistry, price recording)
- `facility-system.ts` (GoldFlowed for wages/tax, effective tax rate)
- `rest-system.ts` (GoldFlowed for rest payment)
- `day-night-system.ts` (GoldFlowed for regen/stipends/subsidies)
- `economy-system.ts` (PurchaseComplete → demand recording)
- `monetary-policy-system.ts` (write monetarySnapshot)
- `base.mdsl` (price-aware survival branches)

Modified test files: 1 (`economy-flow.test.ts`)
