# Composite Buy Actions — Design Spec

> **Goal:** Replace broken multi-step BT sequences (`SeekWell → BuyItem → Drink`, `SeekFood → Buy → Eat`) with single composite actions that travel, buy, and consume inline — eliminating the commitment preemption death spiral that prevents agents from buying water and food.

**Context:** The BT resets every tick, destroying sequence state. The commitment system compensates but breaks travel commitments when competing needs arise (78% of commitments broken by critical needs, avg duration 1.7 ticks vs 8 configured). Multi-step buy sequences are structurally impossible: agents arrive at facilities 800+ times but complete only 10-18 purchases per 14-day recording. The `SeekService` merge (seek + use visit inline) proved the composite pattern works.

**Approach:** Two new composite actions (`BuyAndDrink`, `BuyAndEat`) with internal state machines. Purchases use a shared `executePurchase` function extracted from TradeSystem (preserving ledger, relationship, memory, and price observation side effects). Commitment exemption prevents cross-need oscillation while still allowing same-category breaks. BT simplified from 3-4 seek/buy/consume branches to one composite call per need.

---

## 1. Composite Actions

### 1.1 BuyAndDrink

**File:** `src/infrastructure/entity/bt-actions-buy.ts`

Internal state machine (driven by WorkingMemory fields, not explicit state enum):

1. **Find source:** Check `locationMemories` for wells with water, then markets with water. Pick nearest. If none known, check full location list. If none found → FAILED.
2. **Travel:** Set `memory.serviceTarget = targetId`, `memory.movementTarget = { id, type: 'location' }`. If `memory.atLocation !== targetId`, call `beginAction(ctx, 'buy_and_drink')` and return RUNNING.
3. **Buy (inline on arrival):** Verify facility has water in stock and agent can afford it. Deduct gold from agent wallet, deduct stock from facility, add water to agent inventory. Emit `GoldFlowed` event for monetary tracking. Call `recordPriceObservation`.
4. **Consume (inline, same tick as buy):** Remove 1 water from inventory, apply `config.needs.drink_recovery` to thirst. Emit `NeedChanged` event.
5. **Cleanup:** Clear `memory.serviceTarget`. Return SUCCEEDED.

**Failure cases:**
- No source with water → FAILED (BT falls through to other branches)
- Can't afford → FAILED
- Stock depleted on arrival → clear `buyTarget`, FAILED (agent re-evaluates next tick)

### 1.2 BuyAndEat

**File:** Same file (`bt-actions-buy.ts`)

Same pattern as BuyAndDrink with food-specific logic:

1. **Find source:** Check `resolveNearbyFacilities` for any facility with food in stock (prefer cheapest via price memory). Fallback: full location list for farms/markets.
2. **Travel:** Set `memory.serviceTarget`, `memory.movementTarget`. If not at target, `beginAction(ctx, 'buy_and_eat')`, return RUNNING.
3. **Buy (inline):** Same as BuyAndDrink but for food items. Use `findFoodInInventory` pattern from existing `Eat` action to handle multiple food types.
4. **Consume (inline):** Remove 1 food, apply food recovery to hunger. Emit `NeedChanged`.
5. **Cleanup:** Clear `buyTarget`. Return SUCCEEDED.

### 1.3 Shared Purchase Function

**File:** `src/infrastructure/systems/trade-system.ts` (extracted, not new file)

Extract `executePurchase(agent, facilityActor, itemId, deps)` from the existing `applySuccessfulTrade` + surrounding logic in TradeSystem. This function:

1. Resolves price (facility.currentPrices → item.baseValue → config fallback)
2. Checks agent wallet >= price
3. Applies the trade (gold transfer, stock/inventory update, fund credit)
4. Records ledger entry on EconomyComponent
5. Applies buyer relationship update
6. Creates purchase memory on MemoryComponent
7. Emits `GoldFlowed`, `TradeAttempted`
8. Calls `recordPriceObservation`

Returns `{ success: boolean; failReason?: string }`.

Both TradeSystem's existing buy loop and the composite actions call this function. This ensures all purchase side effects (ledger, relationships, mood-pipeline memory) stay consistent. The composite actions call it inline during BT evaluation (priority 5) instead of waiting for TradeSystem (priority 11).

---

## 2. BT Tree Changes

### 2.1 P0 Critical Survival — Thirst

**Before:**
```
sequence { condition [IsThirsty], condition [HasWater], action [Drink] }
sequence { condition [IsThirsty], flip { condition [HasWater] }, condition [CanAffordItem, "water"], action [SeekWell], action [BuyItem, "water"], action [Drink] }
sequence { condition [IsThirsty], flip { condition [HasWater] }, condition [CanAffordItem, "water"], action [SeekMarket], action [BuyItem, "water"], action [Drink] }
```

**After:**
```
sequence { condition [IsThirsty], condition [HasWater], action [Drink] }
sequence { condition [IsThirsty], flip { condition [HasWater] }, condition [CanAffordItem, "water"], action [BuyAndDrink] }
```

### 2.2 P0 Critical Survival — Hunger

**Before (base.mdsl lines 54-81):**
```
sequence { condition [IsHungry], condition [HasFood], action [Eat] while(IsHungry) }
sequence { condition [IsHungry], condition [CanAffordFood], condition [FacilityHasStock, "food"], action [Buy] }
sequence { condition [IsHungry], condition [CanAffordFood], condition [KnowsFoodSource], action [SeekBestFoodSource], action [Buy] }
sequence { condition [IsHungry], condition [CanAffordFood], action [SeekFood], action [Buy] }
```

**After:**
```
sequence { condition [IsHungry], condition [HasFood], action [Eat] while(IsHungry) }
sequence { condition [IsHungry], condition [CanAffordFood], condition [FacilityHasStock, "food"], action [Buy] }
sequence { condition [IsHungry], condition [CanAffordFood], action [BuyAndEat] }
```

### 2.3 P3 Non-critical Thirst (base.mdsl lines 162-183)

**Before:** `IsThirsty → selector { HasWater→Drink, CanAffordItem→SeekWell→BuyItem→Drink, CanAffordItem→SeekMarket→BuyItem→Drink }`

**After:** `IsThirsty → selector { HasWater→Drink, CanAffordItem→BuyAndDrink }`

### 2.4 P4 Non-critical Hunger (base.mdsl lines 185-215)

**Before:** `IsHungry → selector { HasFood→Eat, CanAffordFood+FacilityHasStock→Buy, CanAffordFood→selector{KnowsFoodSource→SeekBestFoodSource, SeekFood}→Buy, HasJob+IsWorkHours→SeekWork }`

**After:** `IsHungry → selector { HasFood→Eat, CanAffordFood+FacilityHasStock→Buy, CanAffordFood→BuyAndEat, HasJob+IsWorkHours→SeekWork }`

The `HasJob+IsWorkHours→SeekWork` fallback stays — it handles the case where the agent can't afford food and should work instead.

### 2.5 Removed Actions

These actions are no longer referenced in the BT after the changes:
- `SeekWell` — fully replaced by `BuyAndDrink`
- `SeekFood` — fully replaced by `BuyAndEat`
- `SeekBestFoodSource` — replaced by `BuyAndEat` (which internally picks best source)

Keep the implementations in `bt-actions-needs.ts` and `bt-actions-economy.ts` for now (dead code removal in a separate pass). Removing them changes the action type exports and touches many test files.

---

## 3. WorkingMemory — No New Fields

Reuse existing `serviceTarget: string | null` for the buy target location ID. `serviceTarget` is set by `ChooseServiceFacility`/`SeekService` (service visits) and by the new composite actions (buy visits). These are mutually exclusive BT branches — an agent is never in both a service visit and a buy visit simultaneously.

No changes to WorkingMemory, BehaviorAgent, or the factory.

---

## 4. ContinueCommitment Exemption

In `bt-actions.ts`, the critical need break guard currently exempts only `use_service`:

```typescript
if (memory.committedAction !== 'use_service') {
    // break on critical needs
}
```

Change to **selective exemption** — each composite action is only exempt from the cross-need it resolves, not all critical needs:

```typescript
const ca = memory.committedAction;
if (ca !== 'use_service') {
    const critNeeds = actor.get(NeedsComponent).state;
    // buy_and_drink: exempt from thirst breaks (that's what it's resolving)
    //   but still breaks on critical hunger or energy
    // buy_and_eat: exempt from hunger breaks, still breaks on thirst or energy
    const checkHunger = ca !== 'buy_and_eat' && critNeeds.hunger < NEED_CRITICAL_THRESHOLDS.hunger;
    const checkEnergy = critNeeds.energy < NEED_CRITICAL_THRESHOLDS.energy;
    const checkThirst = ca !== 'buy_and_drink' && critNeeds.thirst < NEED_CRITICAL_THRESHOLDS.thirst;
    if (checkHunger || checkEnergy || checkThirst) {
        breakCommitment('critical_need');
        return FAILED;
    }
}
```

This prevents the oscillation (thirst won't break food buying and vice versa) while still allowing truly dangerous situations (energy critical during any buy, or hunger critical during water buying) to interrupt.

---

## 5. Event Emissions

The composite actions emit the same events as the systems they bypass:

- `GoldFlowed` — for monetary policy velocity tracking (same payload as TradeSystem)
- `NeedChanged` — for recording (same payload as NeedsDecaySystem, but with source `'BuyAndDrink'`/`'BuyAndEat'`)
- `TradeAttempted` — with result `'purchased'` or failure reason

No new event types needed.

---

## 6. Files Modified

| File | Change |
|------|--------|
| `src/infrastructure/entity/bt-actions-buy.ts` | **NEW** — BuyAndDrink + BuyAndEat composite actions |
| `src/infrastructure/systems/trade-system.ts` | Extract `executePurchase` shared function |
| `src/infrastructure/entity/bt-actions.ts` | Import + spread new actions, update ContinueCommitment exemption |
| `behavior-trees/base.mdsl` | Replace seek/buy/consume sequences with composite calls |
| `tests/infrastructure/entity/bt-actions-buy.test.ts` | **NEW** — tests for both composite actions |

---

## 7. Test Strategy

- **BuyAndDrink:** Test travel (RUNNING), buy+consume on arrival (SUCCEEDED), no source (FAILED), can't afford (FAILED), stock depleted on arrival (FAILED)
- **BuyAndEat:** Same test cases with food
- **ContinueCommitment exemption:** Test that `buy_and_drink`/`buy_and_eat` commitments survive critical need checks
- **Inline buy correctness:** Verify gold deducted, stock decremented, inventory updated, GoldFlowed emitted, price observation recorded
