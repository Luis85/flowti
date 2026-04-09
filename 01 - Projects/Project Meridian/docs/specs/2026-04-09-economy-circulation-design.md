# Economy Circulation & Agent Resilience Design

**Status:** Approved
**Date:** 2026-04-09
**Scope:** 5 fixes to restore gold circulation, fix sleep resilience, and diagnose memory/leisure systems
**Data source:** 10 simulation snapshots collected across Days 2-8 (ticks 1004-4104)

---

## Problem Statement

The economy stabilization increment (2026-04-07) fixed the production loop — agents work, facilities produce, wages flow. But gold circulation is broken: velocity dropped from 0.288 to 0.028 over 6 days. Gold accumulates with agents (672g) and never returns to facilities. Three root causes:

1. **Sell branch is dead code.** The MDSL reorder (work before sell) placed sell inside `branch [Job]` which is gated by P2's `IsWorkHours`. During work hours, work always fires first. During off-hours, P2 never fires. Result: Bram accumulated 30 food, never sold any. Celia crafted 74 tools, never sold any.

2. **P4.5 equipment shopping fires at night**, overriding P6 sleep. Aldric's equipment breaks, he shops all night, maxes sleep debt to 100, then loses half the next work day recovering. Happened Day 5 and Day 8 — repeating every time equipment charges reach 0.

3. **Recovery hysteresis is too aggressive.** `recovery_hysteresis: 50` means Aldric needs energy >= 80 to exit recovery after crashing to ~12. Half a work day lost each cycle.

Additionally, two systems appear non-functional:

4. **Memory system produces no entries.** All agents show 0/50 memories across all 10 snapshots (8 game days). One quest_completed memory appeared briefly for Bram then vanished. The mood formula weights positive/negative memories at 40% — with no memories, mood is permanently deflated.

5. **Leisure spending is invisible.** On Day 7 (rest day), agents visited leisure locations and hit social 100, but no leisure GoldFlowed events appeared. Leisure locations have configured costs (Tavern 3g, Library 1g, Bathhouse 2g) but gold may not be deducted.

---

## Fix 1: Sell during off-hours (P2.75 in base.mdsl)

**Files:**
- Modify: `behavior-trees/base.mdsl` — add P2.75 block
- Modify: `jobs/settler.mdsl` — remove sell branches
- Modify: `jobs/craftsman.mdsl` — remove sell branches
- Create: new `IsDusk` condition in `bt-conditions-context.ts` (+ barrel + interface)

**Design:**

Add a new priority level P2.75 in `base.mdsl`, between P2 (work) and P2.5 (leisure):

```
/* P2.75: Sell excess goods during dusk */
sequence {
    condition [IsDusk]
    flip { condition [IsRecovering] }
    flip { condition [ShouldSleep] }
    selector {
        /* At market — sell */
        sequence {
            condition [AtLocation, "market"]
            selector {
                sequence {
                    condition [HasFoodReserve]
                    flip { condition [IsHungry] }
                    action [SellAtMarket]
                }
                sequence {
                    condition [HasTradeGoods]
                    flip { condition [IsHungry] }
                    action [SellAtMarket]
                }
            }
        }
        /* Go to market to sell */
        selector {
            sequence {
                condition [HasFoodReserve]
                flip { condition [IsHungry] }
                action [SeekMarket]
            }
            sequence {
                condition [HasTradeGoods]
                flip { condition [IsHungry] }
                action [SeekMarket]
            }
        }
    }
}
```

**Why `IsDusk` instead of `!IsWorkHours AND !IsNighttime`:** The existing `IsNighttime` condition returns true for BOTH dusk AND night (`phase === 'night' || phase === 'dusk'`). Combined with `!IsWorkHours`, the two guards are mutually exclusive across all four phases — P2.75 would never fire. A dedicated `IsDusk` condition (`phase === 'dusk'`) targets exactly the sell window.

**New condition — `IsDusk`:**
```typescript
// In bt-conditions-context.ts
IsDusk(): boolean {
    return worldEntity().get(TimeComponent).state.phase === 'dusk';
}
```
Add `IsDusk(): boolean;` to `ConditionMethods` interface in `bt-conditions.ts` and to the context keys type.

**Guards:**
- `IsDusk` — sell only during dusk (ticks 300-359, 60-tick window)
- `!IsRecovering` — don't divert recovering agents to sell (they need rest)
- `!ShouldSleep` — don't sell if sleep-deprived (sleep debt > 50), go to bed instead
- `!IsHungry` — don't sell food you need to eat
- `HasFoodReserve` / `HasTradeGoods` — only sell if you have excess

**Note on commitment spillover:** An agent who starts `SeekMarket` at tick 350 (10 ticks before dusk ends) commits for 15 ticks, spanning into night (ticks 360-364). P-1's commitment guard protects this — the agent finishes the journey and sells. This minor night spillover is acceptable and emergent.

**Job MDSL cleanup:** Strip all sell/seek-market-to-sell sequences from `settler.mdsl` and `craftsman.mdsl`. They become pure work logic:

settler.mdsl:
```
root [Job] {
    selector {
        sequence { condition [AtJobFacility] condition [FacilityHasStock, "food"] action [Harvest] }
        sequence { condition [AtJobFacility] action [Work] while(IsWorkHours) }
        sequence { condition [HasJob] action [SeekWork] }
        /* Buy tools stays — it's a work dependency, not selling */
        sequence { condition [AtLocation, "market"] condition [NeedsTools] condition [CanAffordItem, "tools"] condition [FacilityHasStock, "tools"] action [BuyItem, "tools"] }
        sequence { condition [NeedsTools] condition [CanAffordItem, "tools"] action [SeekMarket] }
        action [Wander]
    }
}
```

craftsman.mdsl:
```
root [Job] {
    selector {
        sequence { condition [AtJobFacility] action [Work] while(IsWorkHours) }
        sequence { condition [HasJob] action [SeekWork] }
        action [Wander]
    }
}
```

**Expected behavior:** Agents work during day hours (dawn+day), sell at market during dusk (60-tick window, skipped if recovering or sleep-deprived), sleep at night. Bram sells excess food → Market Stall restocks → Celia/Aldric buy from market → gold returns to facilities.

---

## Fix 2: Nighttime shopping guard (P4.5)

**File:** `behavior-trees/base.mdsl`

Add `flip { condition [IsNighttime] }` to the P4.5 equipment purchase sequence, after the `IsRecovering` flip:

```
/* P4.5: Buy equipment if affordable, available, and not recovering */
sequence {
    flip { condition [IsRecovering] }
    flip { condition [IsNighttime] }
    condition [NeedsEquipment]
    condition [CanAffordItem, "equipment"]
    selector {
        sequence {
            condition [AtLocation, "market"]
            condition [FacilityHasStock, "equipment"]
            action [BuyItem, "equipment"]
        }
        action [SeekMarket]
    }
}
```

One line change. When Aldric's equipment breaks at night, P4.5 is blocked → P6 ShouldSleep fires → he sleeps. He buys equipment in the morning.

---

## Fix 3: Recovery hysteresis reduction

**File:** `configs/game-config.json`

Change `recovery_hysteresis` from `50` to `30`.

```json
"recovery_hysteresis": 30
```

**Before:** Aldric crashes to energy 12, needs >= 80 to exit recovery (threshold 30 + 50).
**After:** Needs >= 60 to exit recovery (threshold 30 + 30). Still prevents oscillation (won't re-trigger exhaustion at 30), recovers ~40% faster.

---

## Fix 4: Memory system diagnostic and fix

**Files:** TBD after investigation

**Symptom:** All agents show 0/50 memory entries across 8 game days. One quest_completed memory appeared for Bram at t1428 then vanished within ~600 ticks. The mood formula assigns 40% weight to positive/negative memories — with no memories, mood is permanently deflated.

**Diagnostic steps:**
1. Read `MemoryDecaySystem` (domain + infrastructure) — how does decay work? What's the decay rate?
2. Read `MemoryComponent` — what's the data model?
3. Search for all code that writes to `MemoryComponent.state.entries` — which systems create memories?
4. Check if `memory_window_ticks: 960` and the decay/significance mechanism explain Bram's vanishing memory
5. Identify the root cause: creation bug, aggressive decay, or event selectivity

**Expected outcomes (one of):**
- Memories aren't being created by most events → fix the event→memory pipeline to create entries for production, social, rest, quest events
- Decay is too aggressive → tune the decay rate or significance thresholds
- Only rare event types create memories → add memory creation for common daily events

**Fix approach:** TDD — write test for expected memory creation behavior, verify it fails, implement fix, verify pass.

---

## Fix 5: Leisure gold spending diagnostic and fix

**Files:** TBD after investigation

**Symptom:** On Day 7 (rest day), Bram and Celia visited leisure locations, hit social 100, but no leisure `GoldFlowed` events appeared in the event log. Leisure locations have configured costs (Tavern 3g, Park free, Library 1g, Bathhouse 2g).

**Diagnostic steps:**
1. Read `LeisureSystem` (domain + infrastructure) — does it deduct gold on arrival?
2. Check if the `Leisure` BT action triggers the gold deduction
3. Check if agents chose free locations (Park) instead of paid ones
4. Verify the `GoldFlowed` event emission path in the leisure flow

**Expected outcomes (one of):**
- Gold deduction is working but agents chose free Park → not a bug, just agent preference. Consider tuning scoring to favor paid locations.
- Gold deduction code exists but isn't wired → fix the wiring
- Gold deduction is missing entirely → add it to LeisureSystem

**Fix approach:** TDD — write test for expected gold deduction on paid leisure visit, verify it fails or passes, fix if needed.

---

## Expected Outcome

After all 5 fixes:

1. **Gold circulates:** agents sell excess at market during dusk → market restocks → agents buy during work breaks → gold flows back to facilities
2. **Aldric sleeps at night:** equipment shopping blocked at night → sleep debt stays manageable → full work days
3. **Recovery is faster:** hysteresis 30 instead of 50 → agents return to work sooner after crashes
4. **Memories form:** mood system has data → positive events boost mood, negative events create stress → emergent emotional responses
5. **Leisure costs gold:** rest day spending creates another economic sink → velocity improves

**Velocity prediction:** Should recover from 0.028 toward 0.15+ as sell→buy→consume loop activates.

---

## Non-Goals

- Tools/security consumer demand (no one buys tools or security — future economy design increment)
- Equipment=tools unification
- Market Stall as intermediary (agents sell at market, sufficient for now)
- Additional agents, locations, or job types
- New UI or debug overlay changes
- Trait effect additions for brave/curious
