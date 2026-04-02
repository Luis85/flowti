# Economy Wiring — Design Spec

> Companion to: `2026-04-01-economy-depth-local-information-design.md` (domain foundations)
> Prerequisite: Economy depth Chunks 1-3 implemented (pricing, demand tracker, price memory, monetary policy, EconomySystem, MonetaryPolicySystem)
> Date: 2026-04-02 | Status: Draft

---

## Overview

Connect the pure domain economy modules into the live simulation. Two halves:

1. **Plumbing** — Make prices dynamic, complete GoldFlowed velocity tracking, wire effective tax rate
2. **Agent intelligence** — Agents remember prices and shop at the cheapest known source

### Success Criteria

- Facility prices change dynamically based on supply and demand (not static `food_price` config)
- All gold movements emit `GoldFlowed` events — velocity tracking is complete
- Tax rate adjusts based on economic velocity (stagnant = lower tax, overheated = higher)
- Agents record price observations when buying and prefer the cheapest known food source
- A new agent with no price memories falls back to nearest food facility (graceful degradation)
- Item definitions live in `items/*.json` files, validated by `ItemSchema`, loaded at startup

---

## 1 · Item Data Files + Vault Loading

### 1.1 Item JSON Files

Create `items/*.json` in the game data directory alongside `agents/` and `locations/`. Each file is a single item definition validated by the existing `ItemSchema`.

**Initial items:**

`items/bread.json`:
```json
{
  "id": "bread",
  "name": "Bread",
  "baseValue": 5,
  "category": "subsistence"
}
```

`items/wheat.json`:
```json
{
  "id": "wheat",
  "name": "Wheat",
  "baseValue": 2,
  "category": "trade_goods"
}
```

`items/leather-goods.json`:
```json
{
  "id": "leather-goods",
  "name": "Leather Goods",
  "baseValue": 8,
  "category": "trade_goods"
}
```

### 1.2 Item Loader

New file: `src/infrastructure/entity/item-loader.ts`

Follows the same pattern as `location-loader.ts` and `trait-loader.ts`:
- Reads all `.json` files from the `items/` directory via VaultAdapter
- Validates each against `ItemSchema` (Zod safeParse)
- Returns `Map<string, Item>` keyed by item ID
- Invalid files are quarantined (same pattern as other loaders)

```typescript
export function loadItems(
  files: { path: string; content: string }[],
): { items: Map<string, Item>; errors: string[] } {
  const items = new Map<string, Item>();
  const errors: string[] = [];
  for (const file of files) {
    const parsed = JSON.parse(file.content);
    const result = ItemSchema.safeParse(parsed);
    if (result.success) {
      items.set(result.data.id, result.data);
    } else {
      errors.push(`${file.path}: ${result.error.message}`);
    }
  }
  return { items, errors };
}
```

### 1.3 Wiring

In `world-loader.ts` (or wherever the world is hydrated), call `loadItems()` and pass the resulting `Map<string, Item>` to `createEconomySystem()` as the `itemRegistry` parameter. This replaces any hardcoded or empty registry.

---

## 2 · Dynamic Pricing in Trade Flow

### 2.1 The Change

In `trade-system.ts`, replace the static price lookup:

```typescript
// Before
const foodPrice = deps.config.economy.food_price;

// After
const facility = target.actor.get(FacilityComponent);
const foodPrice = facility.state.currentPrices?.[target.foodItemId]
  ?? itemRegistry.get(target.foodItemId)?.baseValue
  ?? deps.config.economy.food_price;
```

Fallback chain: dynamic price → item baseValue → config food_price. The config value becomes a last-resort fallback for the first few ticks before EconomySystem has run.

### 2.2 Item Registry Access

`createTradeSystem()` needs access to the item registry. Add an `itemRegistry: () => Map<string, Item>` parameter to the factory function, same pattern as EconomySystem.

### 2.3 Demand Recording

When a purchase completes, call `recordConsumption()` on the demand tracker so that future price recalculations reflect actual demand. The EconomySystem's demand tracker needs to be accessible — either:

- **(Recommended)** Listen for `PurchaseComplete` events in EconomySystem and record consumption there. No coupling between TradeSystem and EconomySystem — pure event-driven.
- Alternative: Pass the demand tracker to TradeSystem (creates coupling).

The event-driven approach is cleaner. EconomySystem already has access to the demand tracker and the EventBus. On each tick, before processing the recalc queue, it scans for `PurchaseComplete` events and calls `recordConsumption()`.

---

## 3 · GoldFlowed Emission (Complete Velocity Tracking)

### 3.1 Systems to Wire

Every gold movement gets a `GoldFlowed` event with the standard shape:

```typescript
deps.eventBus.emit({
  type: 'GoldFlowed',
  tick: deps.tickCount,
  wallClock: Date.now(),
  source: '<SystemName>',
  payload: {
    category: '<faucet|sink|transfer>',
    subcategory: '<type>',
    amount: <number>,
    fromEntity: <string | null>,
    toEntity: <string | null>,
  },
});
```

### 3.2 FacilitySystem Emissions

**Wages** (in `recordCycleComplete`, after wallet update):
```
category: 'transfer', subcategory: 'wage'
fromEntity: facilityId, toEntity: workerId
amount: netWage (after tax)
```

**Tax** (in `recordCycleComplete`, after treasury update):
```
category: 'transfer', subcategory: 'tax'
fromEntity: facilityId, toEntity: 'treasury'
amount: taxCollected
```

**Treasury regen** (in day-boundary processing):
```
category: 'faucet', subcategory: 'treasury_regen'
fromEntity: null, toEntity: 'treasury'
amount: treasury_regen_per_day
```

**Stipends** (in day-boundary processing, for guards/merchants):
```
category: 'transfer', subcategory: 'stipend'
fromEntity: 'treasury', toEntity: agentId
amount: stipend amount
```

**Facility subsidies** (in day-boundary processing):
```
category: 'transfer', subcategory: 'subsidy'
fromEntity: 'treasury', toEntity: facilityId
amount: subsidy amount
```

### 3.3 RestSystem Emission

**Rest payment** (in rest payment block, after wallet deduction):
```
category: 'transfer', subcategory: 'rest'
fromEntity: agentId, toEntity: facilityId (tavern)
amount: restPrice
```

---

## 4 · Effective Tax Rate Wiring

### 4.1 Velocity-Driven Tax

Replace the static tax rate in facility wage calculation with `getEffectiveTaxRate()` from `monetary-policy.ts`.

**Current:** `taxRate = deps.config.economy.tax_base_rate` (always 0.10)

**New:**
```typescript
const snapshot = economy.state.monetarySnapshot;
const mpConfig = deps.config.economy.monetary_policy;
const taxRate = snapshot !== undefined
  ? getEffectiveTaxRate(
      mpConfig.tax_base_rate,
      snapshot.velocity,
      { stagnant: mpConfig.velocity_stagnant, overheated: mpConfig.velocity_overheated },
      { stagnant: mpConfig.tax_stagnant_multiplier, overheated: mpConfig.tax_overheated_multiplier },
    )
  : deps.config.economy.tax_base_rate;
```

### 4.2 Monetary Snapshot on EconomyComponent

Add `monetarySnapshot?: MonetarySnapshot` to `EconomyState` in `component-data.ts`. Import the type from `monetary-policy.ts`.

- **Writer:** `MonetaryPolicySystem` writes the snapshot after computing it each tick.
- **Reader:** `FacilitySystem` reads it for effective tax rate. Other systems may read it for UI/logging.

The field is optional — `undefined` until the first MonetaryPolicySystem tick runs, in which case static tax rate is used as fallback.

---

## 5 · BehaviorAgent Price Memory

### 5.1 New Properties

Add to the `BehaviorAgent` interface:

```typescript
// Price memory buffer (capacity from config.economy.price_memory_max)
priceMemories: CircularBuffer<PriceMemory>;
```

### 5.2 New Methods

**Record observation** (called by `Buy()` action on completion — both success and failure):

```typescript
recordPriceObservation(itemId: string, price: number, locationId: string, tick: number): void;
// Pushes a PriceMemory into the CircularBuffer. Oldest evicted when full.
```

**Condition: KnowsFoodSource** (new BT condition):

```typescript
KnowsFoodSource(): boolean;
// Returns true if any non-stale price memory exists for a subsistence item.
// Uses isPriceStale() with config.economy.price_memory_stale_ticks.
```

**Action: SeekBestFoodSource** (new BT action):

```typescript
SeekBestFoodSource(): ActionResult;
// 1. Query priceMemories for cheapest non-stale subsistence item source
//    using getBestKnownSource()
// 2. If found: set movementTarget to that location, return RUNNING
// 3. If not found (no memories or all stale): return FAILED
//    → BT falls through to SeekFood (nearest food facility)
```

### 5.3 Buy() Modification

After the existing `Buy()` action completes (success or failure), if the agent visited a facility, call:

```typescript
this.recordPriceObservation(
  foodItemId,
  facility.state.currentPrices?.[foodItemId] ?? deps.config.economy.food_price,
  facilityId,
  deps.tickCount,
);
```

Agents always learn the current price — even if they can't afford to buy. This creates information asymmetry: agents who visit more facilities have broader price knowledge.

### 5.4 Factory Changes

In `behavior-agent-factory.ts`, initialize the CircularBuffer:

```typescript
import { CircularBuffer } from 'mnemonist';
import type { PriceMemory } from '../../domain/systems/price-memory.js';

// During BehaviorAgent construction:
priceMemories: new CircularBuffer<PriceMemory>(Array, config.economy.price_memory_max),
```

---

## 6 · MDSL Tree Update

### 6.1 Survival Branch Change

**Current base tree survival branch:**
```
sequence [survival-buy]
  condition [CanAffordFood]
  action [SeekFood]
  action [Buy]
```

**New base tree survival branch:**
```
sequence [survival-buy]
  condition [CanAffordFood]
  selector [find-food-source]
    sequence [known-source]
      condition [KnowsFoodSource]
      action [SeekBestFoodSource]
    action [SeekFood]
  action [Buy]
```

The `selector` tries the price-aware path first. If the agent knows a food source (`KnowsFoodSource` passes) and can navigate to it (`SeekBestFoodSource` returns RUNNING), it goes to the cheapest known source. If either fails (no memories, or all stale), it falls through to `SeekFood` which finds the nearest food facility.

### 6.2 Emergent Behaviors

- **New agents** have empty price memories → always fall through to `SeekFood` (nearest) → learn prices on first buy
- **Experienced agents** accumulate memories from visits → prefer cheapest source → travel further if price difference justifies it
- **Stale memories** expire after `price_memory_stale_ticks` (default 200) → agent may return to a facility expecting old prices, discover they've changed → adapts
- **Merchant advantage** — Elena visits many facilities via hauling → accumulates broad price knowledge → naturally finds cheap sources. Guards/scholars visit fewer locations → narrower knowledge. Role-based economic advantage emerges from movement patterns, not special code.

---

## 7 · Data Flow Summary

```
Startup:
  item-loader.ts loads items/*.json → Map<string, Item>
  → passed to createEconomySystem() and createTradeSystem()

Each tick:
  BehaviorTreeSystem (5)
    → BehaviorAgent evaluates MDSL tree
    → SeekBestFoodSource checks priceMemories (CircularBuffer)
    → targets cheapest known food facility, or falls back to nearest

  FacilitySystem (6)
    → pays wages using getEffectiveTaxRate(monetarySnapshot.velocity)
    → emits GoldFlowed (wage, tax, stipend, subsidy, treasury_regen)

  TradeSystem (11)
    → reads facility.state.currentPrices for dynamic food price
    → executes purchase, emits GoldFlowed
    → Buy() records PriceMemory on agent

  EconomySystem (16)
    → listens for PurchaseComplete events → recordConsumption()
    → recalculates facility prices via pricing formula
    → writes currentPrices to FacilityComponent

  MonetaryPolicySystem (16.5)
    → reads all GoldFlowed events (now complete)
    → calculates velocity snapshot
    → writes monetarySnapshot to EconomyComponent
    → evaluates safety nets
```

---

## 8 · Testing Strategy

### 8.1 Unit Tests

- `item-loader.test.ts` — valid/invalid JSON, missing fields, duplicate IDs
- `behavior-agent` price memory tests — recordPriceObservation, KnowsFoodSource, SeekBestFoodSource (empty, stale, valid)
- `facility-system` GoldFlowed emission tests — verify events emitted for wages, tax, stipends, subsidies, regen
- `rest-system` GoldFlowed emission test
- `trade-system` dynamic pricing test — verify facility.currentPrices used, fallback chain

### 8.2 Integration Tests

- **Price memory → shopping behavior:** Agent with bread memory at two facilities → SeekBestFoodSource → targets cheaper one
- **Dynamic pricing round-trip:** Record consumption → EconomySystem recalculates → TradeSystem uses new price → price changed
- **Complete velocity tracking:** Emit purchases + wages + rest → MonetaryPolicySystem snapshot includes all flows
- **Effective tax rate:** Stagnant economy → lower tax rate applied to wages

### 8.3 Modified Existing Tests

- Trade system tests: update for dynamic price lookup (add facility with currentPrices to fixtures)
- Facility system tests: verify GoldFlowed events emitted alongside existing ProductionComplete/TaxCollected
- Rest system tests: verify GoldFlowed event emitted alongside existing RestStarted

---

## 9 · Files Changed

**New files (4):**
- `items/bread.json`
- `items/wheat.json`
- `items/leather-goods.json`
- `src/infrastructure/entity/item-loader.ts`

**New test files (2):**
- `tests/infrastructure/entity/item-loader.test.ts`
- `tests/integration/price-memory-shopping.test.ts`

**Modified source files (~8):**
- `src/domain/systems/behavior-agent.ts` — add priceMemories, KnowsFoodSource, SeekBestFoodSource, recordPriceObservation
- `src/domain/core/component-data.ts` — add monetarySnapshot to EconomyState
- `src/infrastructure/entity/behavior-agent-factory.ts` — initialize CircularBuffer
- `src/infrastructure/systems/trade-system.ts` — dynamic price lookup, itemRegistry param
- `src/infrastructure/systems/facility-system.ts` — GoldFlowed events, effective tax rate
- `src/infrastructure/systems/rest-system.ts` — GoldFlowed event
- `src/infrastructure/systems/economy-system.ts` — listen for PurchaseComplete → recordConsumption
- `src/infrastructure/systems/monetary-policy-system.ts` — write monetarySnapshot to EconomyComponent
- MDSL base tree file — updated survival-buy branch

**Modified test files (~4):**
- Existing trade-system tests (dynamic price fixtures)
- Existing facility-system tests (GoldFlowed assertions)
- Existing rest-system tests (GoldFlowed assertion)
- BehaviorAgent tests (new conditions/actions)
