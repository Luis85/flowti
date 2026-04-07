# Economy Flow Stabilization Design

**Status:** Approved
**Date:** 2026-04-07
**Scope:** 7 fixes to break the economy death spiral and make the simulation sustain day-over-day

---

## Problem Statement

At tick 1004 (Day 2, dawn), the economy is frozen: zero wages, zero sales, zero tax. All three agents are travelling instead of working. The root cause is a cascade:

1. **Settler MDSL prioritizes selling over working** — `HasFoodReserve` triggers `SeekMarket` before the work branch. As long as the settler has food >= `food_reserve` (3), they seek the market instead of farming.
2. **Craftsman MDSL has the same pattern** — `HasTradeGoods` triggers `SeekMarket` before the work branch.
3. **All `seek_*` actions have 0 commitment ticks** — agents get preempted every tick mid-travel, never arriving at their destination.
4. **`rest` has 0 commitment** — agents wake instantly, never clearing sleep debt.
5. **Completed quests persist on the board** — `QuestEvaluationSystem` only removes completed quests after their expiry timer, not when completed. Stale quests may block new generation.
6. **Social need has no critical floor** — Celia at social=10 gets no P0 emergency response. `NeedsCritical` only checks hunger, energy, thirst.
7. **No traits assigned** — all agents have `traits: []`, the modifier pipeline runs on empty.

---

## Fix 1: Reorder settler.mdsl — work before sell

**File:** `behavior-trees/settler.mdsl`

Current order in the selector:
1. Harvest (at facility, stock available)
2. Sell at market (at market, has reserve, not hungry)
3. **Seek market** (has reserve, not hungry) -- **fires before work**
4. Buy tools
5. Work at facility
6. Seek work
7. Wander

New order:
1. Harvest (at facility, stock available)
2. Work at facility (at facility)
3. **Seek work** (has job) -- **agent travels to farm first**
4. Sell at market (at market, has reserve, not hungry)
5. Seek market (has reserve, not hungry)
6. Buy tools
7. Wander

The sell behavior still fires but only after the agent has attempted to work and the work branches failed (not at facility AND can't seek work). In practice: agent works a full shift via `Work while(IsWorkHours)`, and only sells during non-work-hours when they have excess inventory.

**Expected behavior:** Aldric goes to Farmland at dawn, farms during work hours, sells at market during dusk/evening.

---

## Fix 2: Reorder craftsman.mdsl — work before sell

**File:** `behavior-trees/craftsman.mdsl`

Current order:
1. Sell at market (at market, has trade goods, not hungry)
2. **Seek market** (has trade goods, not hungry) -- **fires before work**
3. Work at workshop
4. Seek work
5. Wander

New order:
1. Work at workshop (at facility)
2. **Seek work** (has job) -- **agent travels to workshop first**
3. Sell at market (at market, has trade goods, not hungry)
4. Seek market (has trade goods, not hungry)
5. Wander

Same logic as settler: work first, sell in off-hours.

**Expected behavior:** Celia goes to Workshop at dawn, crafts during work hours, sells tools at market during dusk/evening.

---

## Fix 3: Travel commitment ticks

**File:** `configs/game-config.json` — `commitment_ticks` section

Set non-zero commitment for all travel actions:

| Action | Current | New | Rationale |
|--------|---------|-----|-----------|
| `seek_work` | 0 | 15 | Must reach workplace uninterrupted |
| `seek_market` | 0 | 15 | Must reach market to complete sell/buy |
| `seek_food` | 0 | 10 | Needs-based travel, moderate priority |
| `seek_rest` | 0 | 10 | Must reach rest location |
| `seek_water` | 0 | 10 | Must reach water source |
| `seek_social` | 0 | 10 | Must reach other agent |
| `seek_quest` | 0 | 10 | Must reach quest facility |
| `seek_delivery` | 0 | 10 | Must reach cargo destination |
| `seek_supply` | 0 | 10 | Must reach supply source |
| `seek_job_facility` | 0 | 10 | Must reach distant job |
| `seek_leisure` | 0 | 10 | Must reach leisure location |

The P-1 commitment guard (`IsCommitted AND !NeedsCritical`) ensures agents finish travelling. P0 critical needs still override via the `NeedsCritical` flip.

15 ticks = ~7.5 seconds of uninterrupted travel for work/market (highest-value destinations). 10 ticks = ~5 seconds for needs-based travel.

---

## Fix 4: Rest commitment ticks

**File:** `configs/game-config.json` — `commitment_ticks` section

| Action | Current | New | Rationale |
|--------|---------|-----|-----------|
| `rest` | 0 | 20 | Agents must stay asleep long enough to recover |

20 ticks = ~10 seconds. At `public_shelter` recovery rate of 3.0/tick, that's 60 energy recovered per rest commitment — enough to clear moderate exhaustion. At `outdoors` rate of 1.5/tick, it's 30 energy — partial recovery but still meaningful.

Sleep debt clears proportionally during rest. With a 20-tick minimum commitment, agents accumulate meaningful rest instead of waking every tick.

---

## Fix 5: Immediate quest board cleanup

**File:** `src/infrastructure/systems/quest-evaluation-system.ts`

Current behavior: completed quests are only removed when `tickCount - createdTick > expiryTicks` (the `staleCompleted` filter). This means a quest completed on tick 900 with expiry 480 ticks won't be removed until tick ~1380.

**Fix:** Remove completed quests immediately, regardless of expiry. Change the `staleCompleted` filter:

```typescript
// Before:
const staleCompleted = board.state.quests.filter(
    q => q.state === 'completed' && deps.tickCount - q.createdTick > q.expiryTicks,
);

// After:
const staleCompleted = board.state.quests.filter(
    q => q.state === 'completed',
);
```

All completed quests are removed on the next tick. The `QuestCompleted` event has already been emitted when the quest was completed, so no information is lost.

**Test:** Verify that a quest with `state: 'completed'` is removed from the board on the next system tick, regardless of remaining expiry time.

---

## Fix 6: Social critical threshold

**Files:**
- `src/domain/schemas/ranges.ts` — add `social` to `NEED_CRITICAL_THRESHOLDS`
- `src/infrastructure/entity/bt-conditions-survival.ts` — add social check to `NeedsCritical()`

Current `NEED_CRITICAL_THRESHOLDS`:
```typescript
export const NEED_CRITICAL_THRESHOLDS = { hunger: 20, energy: 15, thirst: 20 } as const;
```

The comment says "Social intentionally excluded — not a survival need; discomfort only." This was true when social isolation was merely uncomfortable. But the snapshot shows Celia at social=10 with no mechanism to recover — she's trapped in recovery/quest loops and never reaches P5.7 (socialize).

**Fix:** Add a social critical floor lower than the other thresholds — this is an emergency, not routine loneliness:

```typescript
export const NEED_CRITICAL_THRESHOLDS = { hunger: 20, energy: 15, thirst: 20, social: 15 } as const;
```

Update `NeedsCritical()` in `bt-conditions-survival.ts`:

```typescript
NeedsCritical(): boolean {
    const needs = actor.get(NeedsComponent).state;
    return (
        needs.hunger < NEED_CRITICAL_THRESHOLDS.hunger ||
        needs.energy < NEED_CRITICAL_THRESHOLDS.energy ||
        needs.thirst < NEED_CRITICAL_THRESHOLDS.thirst ||
        needs.social < NEED_CRITICAL_THRESHOLDS.social
    );
},
```

Then add a social emergency branch to P0 in `base.mdsl`:

```
/* Socialize if critically lonely */
sequence {
    condition [IsLonely]
    selector {
        sequence {
            condition [NearAgentClose]
            action [Talk]
        }
        action [SeekSocial]
    }
}
```

This goes inside the P0 selector, after the rest-if-exhausted branch. It only fires when `NeedsCritical` is true AND `IsLonely` is true (social < social_threshold=40). Since `NeedsCritical` now includes `social < 15`, an agent with social=10 would enter P0, then the lonely branch catches them.

**Threshold 15 vs 20:** Social is less immediately dangerous than hunger/thirst, so a lower threshold (15) means P0 only fires for extreme isolation, not routine loneliness. Normal loneliness (social < 40 but >= 15) still handled at P5.7.

---

## Fix 7: Assign agent traits

**Files:** `agents/aldric.json`, `agents/bram.json`, `agents/celia.json`

| Agent | Traits | Effect |
|-------|--------|--------|
| Aldric | `["hardy"]` | `hungerDecayScale: 0.8` — 20% slower hunger decay, fits endurance farmer |
| Bram | `["brave"]` | No gameplay effect yet (empty effects array), but differentiates identity |
| Celia | `["curious"]` | No gameplay effect yet (empty effects array), but differentiates identity |

Only `hardy` has a mechanical effect today. `brave` and `curious` are cosmetic but activate the trait pipeline (TraitResolverSystem processes them, debug overlay shows them, future trait effects will apply automatically).

**Change in each agent JSON:** Replace `"traits": []` with `"traits": ["hardy"]` / `["brave"]` / `["curious"]`.

---

## Expected Outcome

After all 7 fixes:

1. **Agents work first, sell after** — production cycles fire, wages paid, gold flows
2. **Travel completes uninterrupted** — 10-15 tick commitment prevents preemption
3. **Rest is meaningful** — 20-tick commitment clears sleep debt overnight
4. **Quest board stays clean** — completed quests removed immediately, new quests generate
5. **Social emergencies get P0 treatment** — no more social death at 10
6. **Agents have personality** — traits visible in overlay, hardy modifier active

**Gold flow should look like:** Treasury → wages → agents → purchases → facilities → tax → treasury. Faucet AND sink active. Velocity should rise from 0.275 to healthy range.

---

## Non-Goals

- No new systems or components
- No UI changes
- No new agent types or locations
- No mortality mechanics
- No changes to the modifier pipeline itself (just activate it with data)
- No trait effect additions for brave/curious (future increment)
