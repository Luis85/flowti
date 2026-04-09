# Economy Balance & Needs Triage Design

**Status:** Approved
**Date:** 2026-04-09
**Scope:** 5 changes to fix gold inflation, market starvation, and cascading needs failure
**Data source:** Day 58 long-run snapshot — 6,570g total (411% inflation), Celia at energy 0/social 0, Market Stall empty

---

## Problem Statement

After 58 simulation days, three structural economy problems emerged:

1. **Gold inflation.** Treasury regen injects 75g/day with no sink. Total gold grew from ~1,600g to 6,570g (411%). Agents hoard: Bram 2,253g, Celia 834g, Aldric 663g. Velocity collapsed to 0.038.

2. **Empty market starvation.** Market Stall ran out of food. Aldric's overload threshold (10) means he carries 10 food before selling, and sells infrequently. Between sell trips, demand from Bram and Celia drains the market to zero. Agents starve while Aldric has food in his pockets.

3. **Cascading needs failure.** Celia hit energy 0.0 AND social 0.0 simultaneously. The P0 selector tries hunger first (eat/buy/seek food), but with no food at market, the hunger branches loop on `SeekFood` while energy and social decay unchecked. The agent spirals into multi-need collapse.

---

## Fix 1: Reduce treasury regen

**File:** `configs/game-config.json`

Change `treasury_regen_per_agent_per_day` from `25` to `15`.

New daily faucet: 15g × 3 agents = 45g/day (was 75g/day). Still enough to fund subsidies (30g/facility) and guard stipends (5g), but doesn't flood the economy. Over 58 days: 2,610g injected instead of 4,350g.

---

## Fix 2: Facility maintenance sink

**Files:**
- Modify: `src/domain/schemas/game-config-schema.ts` — add `facility_maintenance_per_day` to EconomyConfigSchema
- Create: `src/infrastructure/systems/facility-maintenance-system.ts` — new system
- Create: `tests/infrastructure/systems/facility-maintenance-system.test.ts`
- Modify: `src/infrastructure/engine/game-view.ts` — register new system
- Modify: `configs/game-config.json` — add config value

**Design:**

New `FacilityMaintenanceSystem` follows the existing day-boundary reactive pattern (same as EquipmentDecaySystem, DailyReportSystem):

```typescript
execute(deps: GameCoreDeps): void {
    const time = worldEntity().get(TimeComponent);
    if (!time.state.dayBoundaryThisTick) return;

    const maintenanceCost = deps.config.economy.facility_maintenance_per_day;
    const minFundForMaintenance = 10; // don't drain below 10g to avoid death spiral

    for (const [locId, locActor] of locationActors()) {
        if (!locActor.has(FacilityComponent)) continue;
        const facility = locActor.get(FacilityComponent);
        if (facility.state.status === 'abandoned') continue;
        if (facility.state.fund <= minFundForMaintenance) continue;

        const deduction = Math.min(maintenanceCost, facility.state.fund - minFundForMaintenance);
        facility.state = { ...facility.state, fund: facility.state.fund - deduction };
        facility.markDirty();

        deps.eventBus.emit({
            type: 'GoldFlowed',
            tick: deps.tickCount,
            wallClock: Date.now(),
            source: 'FacilityMaintenanceSystem',
            payload: {
                category: 'sink' as const,
                subcategory: 'facility_maintenance',
                amount: deduction,
                fromEntity: locId,
                toEntity: null,
            },
        });
    }
}
```

**Config:** `facility_maintenance_per_day: 5` in economy section. Schema default matches.

**Registration:** In `game-view.ts`, register after `DayNightSystem` (which sets the `dayBoundaryThisTick` flag) and before `DailyReportSystem`. Use a new `SystemPriority` slot if needed, or place at an existing gap (e.g., priority 0.85, between DAY_NIGHT at 0.5 and DAILY_REPORT at 0.84).

**Gold destroyed, not transferred.** Maintenance costs are a pure sink — gold disappears from the economy. The `toEntity: null` signals this. Over 58 days with ~10 active facilities: 5g × 10 × 58 = 2,900g destroyed. Combined with reduced faucet (2,610g in), the economy runs roughly neutral.

**Minimum fund guard (10g):** Facilities at or below 10g skip maintenance. This prevents a death spiral where maintenance drains a facility to 0, triggering abandonment, triggering repair quests, draining agent time. Facilities in trouble rely on subsidies (30g/day if below 100g threshold) to recover.

---

## Fix 3: Lower overload food threshold

**File:** `configs/game-config.json`

Change `overload_food_threshold` from `10` to `5`.

Aldric sells when food > 5. He keeps a smaller buffer, sells more frequently, market stays stocked. At 1 food per 15-tick production cycle, he hits threshold after ~75 ticks (vs ~150 at threshold 10). Market restocking cadence doubles.

---

## Fix 4: Reorder P0 — rest first, then thirst, then hunger

**File:** `behavior-trees/base.mdsl`

Replace the P0 critical survival block. New priority order based on danger severity:

```
/* P0: Critical survival — most dangerous need first */
sequence {
    condition [NeedsCritical]
    selector {
        /* Rest if exhausted — energy depletion is most dangerous */
        sequence {
            condition [IsExhausted]
            action [SeekRest]
            action [Rest] while(IsExhausted)
        }
        /* Drink if thirsty and have water */
        sequence {
            condition [IsThirsty]
            condition [HasWater]
            action [Drink]
        }
        /* Go fill waterskin and drink if thirsty */
        sequence {
            condition [IsThirsty]
            action [SeekWater]
            action [FillWaterskin]
            action [Drink]
        }
        /* Eat if hungry and have food */
        sequence {
            condition [IsHungry]
            condition [HasFood]
            action [Eat] while(IsHungry)
        }
        /* Buy food if hungry and available at current location */
        sequence {
            condition [IsHungry]
            condition [CanAffordFood]
            condition [FacilityHasStock, "food"]
            action [Buy]
        }
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
    }
}
```

**Key changes from current P0:**

1. **Rest moved to first position.** Energy at 0 is more dangerous than hunger at 39. Agent rests and recovers before seeking food. Directly fixes the Celia Day 58 scenario.

2. **KnowsFoodSource guard on primary seek-food.** Agents with price memory go to known food sources first. Only the final fallback uses blind `SeekFood`. This prevents agents from endlessly seeking food that doesn't exist — if they don't know a source, they try the blind seek as last resort, which will also fail and let the selector fall through.

3. **Thirst stays above hunger.** Thirst depletes faster than hunger (0.05 vs 0.04 decay) and has a lower critical threshold (20 vs 20 — same, but thirst recovery requires travelling to Spring which takes more time).

4. **Fallback seek-food still exists.** Agents without any price memory can still discover food sources. But it's last in the selector, so rest and thirst are handled first.

---

## Expected Outcome

After all 5 changes:

1. **Gold stabilizes.** ~45g/day in (regen) vs ~50g/day out (maintenance). Slight deflation keeps velocity healthy. Agent hoards slowly drain via purchases/rest/maintenance.
2. **Market stays stocked.** Aldric sells at food > 5. Market receives food every ~75-100 ticks. Bram and Celia buy without starvation.
3. **Cascading needs resolved.** Celia at energy 0 rests first, recovers, then handles food and social. No more multi-need death spiral.
4. **Velocity recovers.** Maintenance creates constant gold demand on facilities. Facilities need sales revenue to survive. Agents need to spend to eat. Target: velocity 0.15+ sustained.

---

## Non-Goals

- Memory decay tuning (deferred to quality-of-life cycle)
- Relationship negativity bias (deferred)
- Tools/security demand mechanic (deferred)
- Dynamic need severity comparison (static reorder is sufficient)
- Market-aware restocking condition (overload threshold reduction is sufficient)
