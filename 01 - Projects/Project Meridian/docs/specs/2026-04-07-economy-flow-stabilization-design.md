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
5. **Completed quests persist on the board** — `QuestEvaluationSystem` only removes completed quests after their expiry timer. Completed quests are already excluded from `openCount` so they don't block generation, but they accumulate indefinitely and clutter the board.
6. **Social need has no critical floor** — Celia at social=10 gets no emergency response. `NeedsCritical` only checks hunger, energy, thirst. Social at P5.7 is too low to ever fire when agents are busy with higher priorities.
7. **No traits assigned** — all agents have `traits: []`, the modifier pipeline runs on empty.

---

## Fix 1: Reorder settler.mdsl — work before sell

**File:** `jobs/settler.mdsl`

Current order in the selector:
1. Harvest (at facility, stock available)
2. Sell at market (at market, has reserve, not hungry)
3. **Seek market to sell** (has reserve, not hungry) -- **fires before work**
4. Buy tools at market (at market, needs tools, can afford)
5. Seek market for tools (needs tools, can afford)
6. Work at facility
7. Seek work
8. Wander

New order:
1. Harvest (at facility, stock available)
2. Work at facility (at facility)
3. **Seek work** (has job) -- **agent travels to farm first**
4. Buy tools at market (at market, needs tools, can afford)
5. Seek market for tools (needs tools, can afford)
6. Sell at market (at market, has reserve, not hungry)
7. Seek market to sell (has reserve, not hungry)
8. Wander

Key changes:
- Work/seek-work moved to positions 2-3 (before any sell/buy behavior)
- Buy-tools stays as two sequences (at-market + buy, then seek-market for tools) and is placed BEFORE sell — tools are needed for production, selling is discretionary
- Sell behavior drops to positions 6-7 — only fires when work branches fail (not at facility, no job) or during non-work-hours when `Work while(IsWorkHours)` exits

**Expected behavior:** Aldric goes to Farmland at dawn, farms during work hours, buys tools if needed, sells excess at market during dusk/evening.

---

## Fix 2: Reorder craftsman.mdsl — work before sell

**File:** `jobs/craftsman.mdsl`

Current order:
1. Sell at market (at market, has trade goods, not hungry)
2. **Seek market to sell** (has trade goods, not hungry) -- **fires before work**
3. Work at workshop
4. Seek work
5. Wander

New order:
1. Work at workshop (at facility)
2. **Seek work** (has job) -- **agent travels to workshop first**
3. Sell at market (at market, has trade goods, not hungry)
4. Seek market to sell (has trade goods, not hungry)
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
| `rest` | 0 | 20 | Minimum preemption guard for rest |

The 20-tick commitment is a **preemption guard**, not the actual rest duration. It prevents the agent from being kicked out of rest during the first 20 ticks. The actual rest duration is controlled by the `while(IsExhausted)` clause in `base.mdsl` P5/P0, which keeps the agent resting until energy rises above their personal threshold + hysteresis. In practice, agents will rest much longer than 20 ticks — the commitment just prevents instant wake-up from lower-priority distractions.

The existing `min_rest_ticks: 50` config controls sleep debt accounting (rest sessions shorter than 50 ticks don't fully count toward daily rest). No change needed there — the 20-tick commitment guard is compatible.

---

## Fix 5: Immediate quest board cleanup

**File:** `src/infrastructure/systems/quest-evaluation-system.ts`

Current behavior: completed quests are only removed when `tickCount - createdTick > expiryTicks` (the `staleCompleted` filter). Completed quests are already excluded from `openCount` in `QuestGenerationSystem`, so they don't actually block new quest generation. However, they accumulate on the board indefinitely, cluttering the quest board display and wasting memory.

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

All completed quests are removed on the next tick. The `QuestCompleted` event has already been emitted synchronously in `CompleteQuest()` before this system runs, so no information is lost.

**Test:** Verify that a quest with `state: 'completed'` is removed from the board on the next system tick, regardless of remaining expiry time.

---

## Fix 6: Social emergency via dedicated condition

**Files:**
- `src/domain/schemas/ranges.ts` — add `social` to `NEED_CRITICAL_THRESHOLDS`
- `src/infrastructure/entity/bt-conditions-survival.ts` — add new `IsSociallyCritical()` condition
- `src/infrastructure/entity/bt-conditions.ts` — add to ConditionMethods interface
- `behavior-trees/base.mdsl` — add P0.5 social emergency branch

### Why NOT add social to NeedsCritical

Adding social to `NeedsCritical` would break the P-1 commitment guard. The guard checks `IsCommitted AND !NeedsCritical`. If an agent at social=10 starts `SeekSocial` (committed for 10 ticks), `NeedsCritical` remains true (social still < 15 since talking hasn't started). On the next tick, P-1 evaluates `!NeedsCritical` = false, the commitment is broken, and the tree falls through to P0 which starts `SeekSocial` again — an infinite re-entrant loop.

This problem doesn't exist for hunger/thirst/energy because those P0 actions (Eat, Drink, Rest) directly and immediately improve the critical need. Social recovery via `Talk` requires travel + interaction over multiple ticks.

### Design: Separate condition + separate BT branch

**Step 1:** Add social threshold to ranges.ts (for reference, not used by NeedsCritical):
```typescript
export const NEED_CRITICAL_THRESHOLDS = { hunger: 20, energy: 15, thirst: 20, social: 15 } as const;
```

**Step 2:** Add new condition `IsSociallyCritical()` in `bt-conditions-survival.ts`:
```typescript
IsSociallyCritical(): boolean {
    return actor.get(NeedsComponent).state.social < NEED_CRITICAL_THRESHOLDS.social;
}
```

This condition is NOT part of `NeedsCritical()` — it's standalone. The P-1 commitment guard (`!NeedsCritical`) is unaffected, so `SeekSocial` commitments are honored normally.

**Step 3:** Add `IsSociallyCritical` to `ConditionMethods` interface in `bt-conditions.ts` and wire it into the barrel.

**Step 4:** Add P0.5 branch in `base.mdsl` between P0 and P1:
```
/* P0.5: Social emergency — extreme isolation */
sequence {
    condition [IsSociallyCritical]
    selector {
        sequence {
            condition [NearAgentClose]
            action [Talk]
        }
        action [SeekSocial]
    }
}
```

This fires independently of `NeedsCritical`. The `SeekSocial` action gets its 10-tick commitment from Fix 3, and since `IsSociallyCritical` is NOT in `NeedsCritical`, the P-1 guard protects it normally. The agent travels to find someone to talk to without being re-preempted.

**Threshold 15:** Lower than hunger/thirst (20) because social isolation is uncomfortable but not lethal. Only extreme cases (Celia at 10) trigger the emergency.

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
3. **Rest is meaningful** — 20-tick preemption guard lets agents stay asleep; actual duration governed by `while(IsExhausted)`
4. **Quest board stays clean** — completed quests removed immediately for board hygiene
5. **Social emergencies handled** — `IsSociallyCritical` at P0.5 rescues agents below social=15 without breaking the P-1 commitment guard
6. **Agents have personality** — traits visible in overlay, hardy modifier active

**Gold flow should look like:** Treasury → wages → agents → purchases → facilities → tax → treasury. Faucet AND sink active. Velocity should rise from 0.275 to healthy range.

---

## Non-Goals

- No new systems or components (IsSociallyCritical is a new condition, not a system)
- No UI changes
- No new agent types or locations
- No mortality mechanics
- No changes to the modifier pipeline itself (just activate it with data)
- No trait effect additions for brave/curious (future increment)
