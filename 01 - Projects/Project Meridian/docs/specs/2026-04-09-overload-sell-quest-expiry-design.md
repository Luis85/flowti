# Overload Sell & Quest Expiry Extension Design

**Status:** Approved
**Date:** 2026-04-09
**Scope:** 4 changes to fix inventory hoarding and quest repair expiry
**Data source:** 14 simulation snapshots across 2 runs (Days 0-8 run 1, Days 0-3 run 2)

---

## Problem Statement

The P2.75 dusk sell window (introduced in the economy circulation increment) doesn't work in practice. Two root causes:

1. **Sell window too short for map distances.** Dusk is 60 ticks. Travel from Farmland to Market Stall takes 20+ ticks. Agents start `SeekMarket` during dusk, arrive during night when `IsDusk` is false, and the BT re-evaluates without selling. Result: Aldric accumulated 28 food across 3 days with zero sales across 14 snapshots.

2. **Quest repair expires before completion.** Quests expire in ~860 ticks (~1.8 days). Repair quests require ~50 ticks of on-site work, but P2 (job work) beats P4.25 (quest work) during the day. Agents only repair during off-hours fragments (dusk, dawn, between-task gaps). Celia's Guard Post repair stalled at 42/50 and expired — twice across two simulation runs. Guard Post stays abandoned, Bram stays unemployed (1,827 ticks in run 1).

---

## Fix 1: IsOverloaded condition

**Files:**
- Modify: `src/infrastructure/entity/bt-conditions-economy.ts` — add IsOverloaded method
- Modify: `src/infrastructure/entity/bt-conditions.ts` — add to ConditionMethods interface and EconomyKeys
- Modify: `configs/game-config.json` — add threshold values
- Test: `tests/infrastructure/entity/bt-conditions.test.ts`

**New condition:**

```typescript
IsOverloaded(): boolean {
	const inv = actor.get(InventoryComponent).state.items;
	const food = inv.find(i => FOOD_ITEMS.has(i.item_id));
	if (food !== undefined && food.quantity > config.needs.overload_food_threshold) return true;
	const goods = inv.find(i => TRADE_GOODS.has(i.item_id));
	if (goods !== undefined && goods.quantity > config.economy.overload_goods_threshold) return true;
	return false;
}
```

Uses existing `FOOD_ITEMS` and `TRADE_GOODS` sets from `food-items.ts` (already imported in economy conditions).

**Config additions in game-config.json:**

In `needs` section:
```json
"overload_food_threshold": 10
```

In `economy` section:
```json
"overload_goods_threshold": 15
```

**Threshold rationale:**
- `food_reserve: 3` is the minimum reserve before selling. `overload_food_threshold: 10` is ~3x that — agents sell when carrying 10+ food regardless of time of day.
- `overload_goods_threshold: 15` is slightly higher since tools are produced more slowly (every 25 ticks vs food every 15 ticks).

**Config schema update:** Add these two new fields to `game-config-schema.ts` with their defaults matching the config values.

---

## Fix 2: Replace P2.75 dusk sell with overload sell

**File:** `behavior-trees/base.mdsl`

Remove the existing P2.75 dusk sell block and replace with:

```
/* P2.75: Sell excess goods when overloaded */
sequence {
    condition [IsOverloaded]
    flip { condition [IsNighttime] }
    flip { condition [IsRecovering] }
    selector {
        sequence {
            condition [AtLocation, "market"]
            action [SellAtMarket]
        }
        action [SeekMarket]
    }
}
```

**Guards:**
- `IsOverloaded` — only fires when inventory exceeds thresholds (food > 10 or trade goods > 15)
- `!IsNighttime` — don't sell at night (sleep instead). `IsNighttime` includes dusk, so selling happens during dawn and day only. This is intentional — agents sell during the workday when they're overloaded, not at the margins.
- `!IsRecovering` — don't divert exhausted agents to sell

**Simplification over previous design:** No `HasFoodReserve`/`HasTradeGoods`/`IsHungry`/`IsDusk` checks. The `IsOverloaded` threshold already implies meaningful excess. `SellAtMarket` handles which item to sell. The sell conditions inside the action remain unchanged.

**Expected behavior:** Aldric farms → food accumulates → at food > 10, P2.75 fires → he goes to market, sells, returns to farm. Self-regulating inventory. During night, P6 sleep wins. During recovery, agent rests.

---

## Fix 3: Quest expiry extension

**Files:** Find the expiry tick value and double it.

Current quest expiry: ~860 ticks (~1.8 game days). This is too short for repair quests that progress in off-hours fragments. Celia consistently reaches 42/50 progress before expiry — she needs approximately 1 more day of off-hours repair windows.

**Diagnostic step:** Search for where quest expiry is set:
1. Check `configs/game-config.json` for a `quests` section with expiry config
2. Check `src/infrastructure/systems/quest-generation-system.ts` for hardcoded expiry values
3. Check `src/domain/schemas/quest-schema.ts` for default expiry

**Fix:** Double the expiry value from ~860 to ~1720 ticks (~3.6 game days). If hardcoded, move to config. If already in config, change the value.

**Expected outcome:** Repair quests that previously expired at 42/50 progress will now complete with the extra day of off-hours repair windows. Guard Post restores → Bram claims guard job → third production loop starts.

---

## Expected Outcome

After all fixes:

1. **Inventory self-regulates** — agents sell when overloaded (food > 10, goods > 15), regardless of time of day. No more 28-food hoards.
2. **Market Stall restocks** — sold food appears in market inventory. Other agents buy when hungry. Gold flows back to facilities.
3. **Quest repairs complete** — doubled expiry gives agents enough off-hours windows to finish 50-tick repairs across 3+ days.
4. **Guard Post restores** — Bram gets employed. Three production loops run simultaneously.
5. **Velocity recovers** — sell→buy→consume loop activates. Target: 0.25+ sustained.

---

## Non-Goals

- Tools/security consumer demand (no one buys these outputs — future increment)
- Negative dialogue spiral (emergent social dynamics, not a bug)
- Sleep debt management (working correctly)
- Leisure gold flow (confirmed working, ledger labels as 'purchase')
- Memory system (confirmed working with 480-tick min_lifespan)
