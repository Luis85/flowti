# Quest Flow & BT Priority Fixes — Design

**Status:** Draft
**Date:** 2026-04-11
**Source:** Analysis of `recording-2026-04-11-1339.md` (94 snapshots, ~11500 ticks, 24 in-game days)
**Scope:** 6 issues spanning BT priority, quest lifecycle, economy loops, and behavior jitter
**Key files affected:** `bt-actions.ts`, `bt-actions-quest.ts`, `bt-conditions-quest.ts`, `bt-working-memory.ts`, `base.mdsl`, `settler.mdsl`, `craftsman.mdsl`, `guard.mdsl`, `game-config.json`

---

## Problem statement — 6 distinct issues

### 🔴 Issue 1 — Critical needs don't preempt travel commitments

**Evidence:** Bram shows `thirst at 0.0` (critical < 20) for 7+ consecutive snapshots while his action remains `seek_rest [committed]`. The BT has a critical-needs escape hatch at `P-1` via `flip { NeedsCritical }`, but it only re-evaluates when a sequence begins — once `ContinueCommitment` is RUNNING, mistreevous resumes from that node without re-checking earlier guards.

**Existing partial fix:** `ContinueCommitment` in `bt-actions.ts:87` already breaks `work` and `leisure` commitments when hunger/thirst drop below **personal** thresholds. But it does not break **travel** commitments (`seek_rest`, `seek_food`, `seek_water`, `seek_market`, `seek_quest`) on critical needs. Bram committed to `seek_rest` for 10 ticks — during those ticks his critical thirst is ignored.

**Root cause:** `ContinueCommitment`'s break-condition list is incomplete. It was designed to protect productive work from excessive interruption, but the same protection is wrong for short travel commitments where an emergency should always win.

---

### 🔴 Issue 2 — Restock quest death-lock

**Evidence:** Over the 24-day session, Celia (craftsman) claimed **10+ distinct restock quests** (all `restock → Market Stall` for `foodx1`). Only **2 completed** (at t10046 and t10432). None expired or were abandoned — they just sat claimed indefinitely, locking the board so new quests couldn't generate for that slot.

**Root cause analysis:**
1. Celia claims a restock quest while passing by the market during a "free" BT tick
2. She returns to Workshop to honor her 30-tick `work` commitment
3. `QuestCargoReady` in `bt-conditions-quest.ts:52` checks her personal inventory — she has `foodx4` so it returns true
4. `QuestAtFacility` returns false (she's at Workshop)
5. The BT falls through to `SeekQuestFacility`, but only when a commitment window opens
6. Between work cycles she might get hungry/tired and detour, so she rarely makes it to the market **and** has food **and** the BT picks `CompleteQuest`

**The deeper issue the user identified:** restock quests have no dedicated sourcing flow. They magically drain personal inventory when the agent happens to be at the right place with the right items. A craftsman shouldn't need to keep personal food stocked to complete a "restock the market with food" quest — she should go pick up food from the farm and haul it over.

### Supply vs. restock semantics

| Quest | Current completion | Intent |
|---|---|---|
| `supply` | Drain agent inventory | Agent bought food for self → delivers from personal stock. Makes sense. |
| `restock` | Drain agent inventory | Agent is supposed to **source** the item from a production facility and deliver it. Current flow makes the agent's personal inventory a bottleneck. |
| `repair` | Tick repair progress at facility | Works correctly. |

---

### 🟠 Issue 3 — Tools hoarding (partial regression)

**Evidence:** Celia accumulates `tools(10)x6` → `tools(10)x92` over the session. Workshop produces tools every 25 ticks with no destination. Market Stall never stocks tools.

**Context:** There's existing work (git commits `af4d8652`, `92c32f86`, spec `2026-04-10-tool-repair-economy-design.md`) that added a P4.45 repair branch and later moved it into job MDSL files. Settler / guard / craftsman MDSLs now have an "equipment maintenance" gate that buys tools from the market and repairs equipment. The mechanism works — but only if the market **has tools in stock**.

**Missing link:** Tools produced at Workshop never flow to Market Stall. The supply-chain branch (`P4.6 Supply chain`) requires the destination facility to declare tools as an input (`FacilityNeedsSupply`). Market Stall has no input declaration, so no supply route ever gets planned for tools. Result: Celia produces tools, keeps them, and nobody else can repair their equipment.

Celia herself is `overloaded` per the `IsOverloaded` condition but her overload-sell branch at `P1.9` routes to `SellAtMarket`. That action presumably sells items from inventory to the market's sales floor — but the market's fund may not be large enough, or the sale may fail silently. Needs investigation.

---

### 🟠 Issue 4 — Lockstep rest cycles

**Evidence:** `All 3 agents doing "rest" simultaneously` fires 16 times. `All 3 agents doing "wander"` fires 2 times. Agents converge despite having different `wake_offset` / `sleep_offset` values.

**Root cause:** The wake/sleep offsets are per-agent (Aldric=27/9, Bram=12/24, Celia=14/8) but the variance range is narrow and agents share the same day/night phase transitions. Over time, external forces (food cycles, work cycles) re-synchronize them.

---

### 🟡 Issue 5 — Bram wandering while employed

**Evidence:** `has job=guard but wandering` anomaly fires a few times. Inspection of the snapshots shows it happens at night when Bram has no reason to do anything else — `Wander` is the fallback in the BT selector.

**Diagnosis:** Likely resolved by Issue 1's fix — if Bram's critical needs no longer get ignored, he'll pursue water/rest instead of wandering. Plus the anomaly detector may be firing a false positive for night-time wandering (a design choice — agents in Meridian have no bed). Worth a diagnostic pass but no separate fix expected.

---

### 🟡 Issue 6 — Economy velocity decline (derivative)

**Evidence:** Velocity trends from 0.3 (healthy) to 0.08 (slow) over the session. 29 "economy frozen" anomalies.

**Diagnosis:** Symptomatic of Issues 1, 2, 3 compounding:
- Agents stuck in commitments skip shopping (Issue 1)
- Restock quests never complete → facilities run dry (Issue 2)
- Tools don't circulate (Issue 3)

**No separate fix needed.** Verification via a new recording session after fixing 1–3.

---

## Design decisions

### Decision A — Break travel commitments on critical needs only

**Rationale:** Work/leisure commitments break on **personal** thresholds (proactive maintenance). Travel commitments should only break on **critical** thresholds (NEED_CRITICAL_THRESHOLDS = 20/15/20/15 for hunger/energy/thirst/social). This keeps travel productive in normal cases but guarantees emergency escape when the agent is actually dying.

**Alternative considered:** Redesign the BT root to use mistreevous's `reactive` decorator or a `parallel` guard. Rejected — these require deeper changes to how mistreevous composes trees, and `ContinueCommitment` is already the natural choke point. Extending it is a 20-line change.

### Decision B — Restock as haul flow, not inventory drain

**Rationale:** Restock quests should behave like supply-chain hauls: find a source → pick up → deliver. This matches the user's mental model and the existing `haulCargo` mechanism. The agent's personal inventory is left alone unless it's genuinely a "supply from personal stock" quest.

**Approach:** Add two new actions and one new condition:

- `SeekQuestSource()` — find the nearest known facility whose output matches the quest's `itemId`, set movement target
- `PickupForQuest()` — if at a source facility with matching stock, move 1 unit into `memory.questCargo` (new field)
- `HasQuestCargo` — condition that returns true when `questCargo` is non-null and matches the active quest

And modify:

- `CompleteQuest()` — prefer `questCargo` over personal inventory; fall back to personal inventory for `supply` quests where the agent may have bought the item
- `QuestCargoReady` — also returns true when `questCargo` matches the active quest

**BT branch update** (in `base.mdsl` P4.25):

```
sequence {
    condition [HasQuest]
    selector {
        sequence {
            condition [QuestAtFacility]
            condition [QuestCargoReady]
            action [CompleteQuest]
        }
        sequence {
            condition [QuestAtFacility]
            action [WorkRepair]
        }
        /* NEW: if we don't have the item yet, go pick it up from a source */
        sequence {
            flip { condition [QuestCargoReady] }
            action [SeekQuestSource]
            action [PickupForQuest]
        }
        action [SeekQuestFacility]
    }
}
```

**Alternative considered:** Reuse the existing `haulCargo` slot for quest cargo. Rejected — it creates ambiguity between supply-chain hauls (agent wants to profit by delivering between facilities) and quest fulfillment (agent has a claimed quest). Separating `questCargo` keeps the two flows independent.

### Decision C — Tools circulation: overload sell + market as tool buyer

**Rationale:** The cleanest fix is to make the market **willing to buy** tools (either as stock for resale, or as an input). The current `IsOverloaded` + `SellAtMarket` flow is in place but the sale is failing. Needs investigation, but once the sale works, tools will flow from Workshop → Celia's inventory → Market Stall → other agents via the repair branch.

**Approach:**
1. Diagnose why `SellAtMarket` isn't executing or isn't transferring tools
2. Ensure Market Stall accepts tools as a sellable item (stock, pricing)
3. Once tools reach the market, the existing `NeedsRepair` → `BuyItem("tools")` branch in job MDSLs closes the loop

**Alternative considered:** Add an explicit "tool restock" quest type. Rejected — that just adds another loop that suffers the same death-lock until Issue 2 is fixed.

### Decision D — Lockstep mitigation via offset variance + needs jitter

**Rationale:** Per-agent offsets exist but the range is too narrow and agents drift into sync via shared world events. Two complementary changes:

1. **Widen `wakeOffset` / `sleepOffset` ranges** — spread from ±30t to ±60t so agents diverge more
2. **Add small random jitter to needs decay** — each tick, each agent's decay rate is `base_rate * (1 + random(-0.05, 0.05))`. Over time, identical agents diverge rather than converge.

---

## Out of scope

- Equipment condition tuning (decay rates, thresholds) — defer unless verification shows agents can't keep equipment repaired
- New quest types beyond the existing three
- BT visual editor / inspector changes
- Recording format changes (BT paths already work)

---

## Success criteria

A new recording session (24+ days, 3 agents) should show:

1. **Zero "critical need ignored" anomalies.** Agents with thirst < 20 or hunger < 20 must break any travel commitment and head for water/food on the next tick.
2. **Restock quest completion rate ≥ 50%.** Most quests generated should resolve within the expiry window, not sit claimed indefinitely.
3. **Tools move from Workshop to Market Stall.** After ~5 in-game days, Market Stall should have tools in stock at least once; other agents should buy tools for repair.
4. **"All 3 agents resting simultaneously" anomaly drops by 50%+.** Some convergence is expected (3 agents share a world), but not systematic.
5. **Economy velocity stays above 0.15 sustained.** No 5-day periods of "frozen economy" anomalies.

Measurement: compare the new recording's anomaly counts and flow metrics against `recording-2026-04-11-1339.md` baseline.
