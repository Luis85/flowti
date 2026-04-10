# Commitment Breaks & Survival Escape Design

**Status:** Approved
**Date:** 2026-04-10
**Scope:** 2 files, ~40 lines of logic, ~14 new test cases

## Problem

Two connected issues prevent the tool repair economy (and general agent maintenance) from working:

1. **Commitment blocking:** The P-1 commitment system has absolute priority in the BT selector. When an agent is committed to work (30 ticks), `ContinueCommitment` returns RUNNING on every tick, preventing the selector from ever reaching maintenance branches (P4.45 repair, P4.5 buy equipment, P3 thirst, P4 hunger). Agents work until needs become critical rather than proactively addressing them.

2. **Recovery death spiral:** When an agent's energy drops below threshold, `IsRecovering` stays true until energy >= threshold + hysteresis (~80). During outdoor rest, hunger/thirst decay to critical. The agent tries to seek food but fails (too far from market), then returns to rest, creating an infinite loop. The agent starves with 1175g in their wallet.

## Design

### Change 1: Expand ContinueCommitment Break Conditions

**File:** `src/infrastructure/entity/bt-actions.ts`, `ContinueCommitment()` method (~line 86)

Currently breaks commitment for: eat (hunger satisfied), drink (thirst satisfied), rest (energy satisfied), buy (hunger satisfied).

Add new break conditions for `work` and `leisure` commitments — break when any maintenance need arises:

```typescript
if (ca === 'work' || ca === 'leisure') {
    const needs = actor.get(NeedsComponent).state;
    const inv = actor.get(InventoryComponent).state.items;
    // Break when hungry or thirsty (proactive, before critical)
    if (needs.hunger < memory.personalThresholds.hunger) { clear; return FAILED; }
    if (needs.thirst < memory.personalThresholds.thirst) { clear; return FAILED; }
    // Break when equipment needs attention
    const equip = inv.find(i => i.item_id === 'equipment');
    if (equip === undefined || equip.quantity === 0 || (equip.charges ?? 0) === 0) { clear; return FAILED; }
    if ((equip.charges ?? 0) > 0 && (equip.charges ?? 0) < config.economy.equipment_repair_threshold) { clear; return FAILED; }
}
```

**Note on critical needs:** The BT already handles emergency breakout at critical need levels via the P-1 guard: `flip { condition [NeedsCritical] }`. When any need reaches critical thresholds (hunger < 20, thirst < 20, energy < 15), the P-1 sequence fails and the selector falls through to P0 survival. No additional emergency break logic is needed in `ContinueCommitment`.

**Note on short commitments:** Travel and transaction commitments (`sell`: 8t, `seek_market`: 15t, `seek_work`: 15t, `seek_food`: 10t) are short enough to complete before needs decay significantly. Proactive breaks are only added for `work` (30t) and `leisure` (variable duration), which are long enough that needs can cross thresholds during a single commitment.

**Note on equipment check duplication:** The inline equipment inventory lookup duplicates logic from `NeedsEquipment` and `NeedsRepair` conditions. This is accepted — `ContinueCommitment` cannot call condition methods (separate factory scope). If `NeedsEquipment`/`NeedsRepair` logic changes, update here too.

### Change 2: IsRecovering Critical Hunger/Thirst Override

**File:** `src/infrastructure/entity/bt-conditions-survival.ts`, `IsRecovering()` method

Currently returns true whenever `memory.recovering` is set and energy < recovery threshold.

Add override: **when hunger or thirst are at critical levels, return false even if recovering.**

```typescript
IsRecovering(): boolean {
    if (!memory.recovering) return false;
    const needs = actor.get(NeedsComponent).state;
    // Survival trumps recovery — let agent travel to find food/water
    if (needs.hunger < NEED_CRITICAL_THRESHOLDS.hunger) return false;
    if (needs.thirst < NEED_CRITICAL_THRESHOLDS.thirst) return false;
    // Normal recovery check
    const recoveredThreshold = Math.min(
        memory.personalThresholds.energy + config.needs.recovery_hysteresis, 100
    );
    if (needs.energy >= recoveredThreshold) {
        memory.recovering = false;
        return false;
    }
    return true;
}
```

The `memory.recovering` flag stays set — we don't clear it. We just temporarily allow the agent to act. After eating, if energy is still low, `IsExhausted` will route them back to rest via P0.

**Interaction with P0 `IsExhausted` branch:** P0's rest sub-branch uses `IsExhausted` (energy < personal threshold, ~30), not `IsRecovering`. When hunger is critical and energy is also below the exhaustion threshold, P0 evaluates exhaustion first. However, `NEED_CRITICAL_THRESHOLDS.energy` is 15 — agents resting outdoors at 1.5 energy/tick will typically be well above 15 when hunger reaches critical (20). The P0 selector evaluates hunger/thirst branches before the rest branch when `IsExhausted` is false. If both energy AND hunger are simultaneously critical (energy < 15, hunger < 20), the P0 selector tries exhaustion first — this is the correct prioritization (energy death is faster than hunger death). In practice, simultaneous dual-critical is rare because rest recovers energy 5x faster than it decays hunger (1.5/tick recovery vs 0.3x hunger cost).

## Behavior Traces

### Aldric: Work → equipment repair window
1. Works at farm → 30-tick commitment
2. Equipment charges drop below 10 → ContinueCommitment breaks (`work` + equipment check)
3. Tree evaluates fully → P4.45 fires → buys tools → repairs equipment
4. Returns to work

### Bram: Death spiral escape
1. Resting outdoors, energy=35, recovering=true
2. Hunger decays to critical (< 20) → P-1 BT gate fails (`NeedsCritical` true)
3. P0 fires → `IsExhausted`? energy=35 > threshold 36? No (barely above) → exhaustion branch skipped
4. P0 hunger branch fires → `IsRecovering` returns false (critical hunger override) → agent can travel
5. Agent reaches market → buys food with 1175g → eats
6. Hunger recovers → `IsRecovering` returns true → P0 routes back to rest
7. Sustained rest eventually brings energy to 80 → recovery clears

### Celia: Work → sell overloaded tools
1. Works at workshop → 30-tick commitment
2. Hunger drops below threshold 44 → commitment breaks
3. Tree evaluates → P1.9 checks IsOverloaded → tools > 5 → sells at market
4. Also buys food while at market → returns to work

## Test Plan

### ContinueCommitment tests (bt-actions.test.ts)
1. Work commitment breaks when hunger < personal threshold
2. Work commitment breaks when thirst < personal threshold
3. Work commitment breaks when equipment missing
4. Work commitment breaks when equipment charges < repair threshold
5. Work commitment does NOT break when equipment charges at threshold (boundary)
6. Work commitment does NOT break when all needs healthy and equipment OK
7. Leisure commitment breaks when hunger < personal threshold
8. Leisure commitment breaks when thirst < personal threshold
9. Sell commitment does NOT break at personal hunger threshold (short commitment)
10. Rest commitment does NOT break at personal hunger threshold (existing rest logic handles it)
11. Eat commitment does NOT break when hunger still below threshold (existing logic)

### IsRecovering tests (bt-conditions.test.ts)
12. Returns false when recovering but hunger is critical
13. Returns false when recovering but thirst is critical
14. Returns true when recovering and needs are above critical

## Files Modified

| File | Change |
|------|--------|
| `src/infrastructure/entity/bt-actions.ts` | Add break conditions to ContinueCommitment |
| `src/infrastructure/entity/bt-conditions-survival.ts` | Add critical override to IsRecovering |
| `tests/infrastructure/entity/bt-actions.test.ts` | 11 new test cases |
| `tests/infrastructure/entity/bt-conditions.test.ts` | 3 new test cases |

## Config Dependencies

Uses existing config values — no new config needed:
- `NEED_CRITICAL_THRESHOLDS.hunger` (20) — from `ranges.ts`
- `NEED_CRITICAL_THRESHOLDS.thirst` (20) — from `ranges.ts`
- `NEED_CRITICAL_THRESHOLDS.energy` (15) — from `ranges.ts`
- `config.economy.equipment_repair_threshold` (10)
- `config.needs.recovery_hysteresis` (50)
- `memory.personalThresholds.hunger/thirst/energy` — per-agent, set at BT init
