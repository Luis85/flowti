# Echo-Driven Spontaneity — Design Spec

**Date:** 2026-03-24
**Status:** Approved
**Scope:** Flowti Plugin — Agent World atmosphere deepening

## Problem

Agents follow a rigid BT priority ladder (urgent → needs → work → idle) and never break their routine. The echo system tracks preferences, bonds, and mood-residue, but these echoes don't influence decisions. Interactions happen but leave no emotional trace. Cascades rarely fire because nothing reaches the threshold. The world feels deterministic.

## Goal

Make agents spontaneously break routine based on personality and experience. Close the feedback loops so gameplay events create lasting preferences that drive visible, surprising behavior.

## Non-Goals

- New UI panels or visual systems
- Vault operation execution
- New interaction templates (existing 63+ are sufficient)
- Changes to locomotion or needs systems

---

## Part 1: Feedback Loop Wiring

Two missing connections that prevent the echo system from accumulating meaningful data.

### 1a. Interaction → Echo Production

After `tickInteractions` processes the interaction bus each frame, feed results into the echo producer.

| Interaction Result | Echo Kind | Weight Formula | Decay |
|-|-|-|-|
| Affinity change | `opinion` | `clamp(affinityDelta × 3, -30, 30)` | 2 |
| Memory record | `memory` | +4 | 5 |
| Positive need change | `preference` | +5 | 3 |
| Negative need change | `aversion` | -5 | 3 |

**Weight clamping:** The `affinityDelta × 3` formula is clamped to ±30 to prevent a single large interaction from immediately overwhelming the cascade system. With the lowered cascade threshold of 10 (Part 3a), an unclamped delta of +4 would produce +12 and immediately cascade — clamping keeps the system predictable.

**Where:** End of `tickInteractions()` in `engine-simulation.ts`. Call existing `echoProducer` methods with interaction results. The interaction bus already returns affinity changes, memory records, and need changes — they're just discarded today.

### 1b. Cascade Hints → BT Consumption

The blackboard has `cascadeHint` and `cascadeTarget` fields. Currently, `tickSocial` in engine-simulation.ts handles cascade reactions imperatively: it calls `conversation.tryScript()` for vents, writes `bb.roomAvoidance` for avoid-room, and writes `bb.cascadeHint` for `"seek-proximity"` and `"force-break"` — but nobody reads those last two. The BT subtree consumes the values that `tickSocial` already writes.

**Architecture: additive, not replacement.** The existing `tickSocial` cascade handling stays. It already handles `"vent"` (conversation scripts), `"avoid-room"` (writes `bb.roomAvoidance` → `tickNeeds` transfers), and `"adjust-opinion"` (reputation → opinion echo). The BT subtree handles the two cases that need physical movement: `"seek-proximity"` and `"force-break"`, which `tickSocial` writes to the blackboard but nothing currently acts on.

**New subtree: `CascadeReaction`** — inserted after `UrgentReaction` and before `TalkingTimeout` in the master MDSL selector. High priority ensures cascade reactions preempt normal behavior.

```
root [CascadeReaction] {
  sequence {
    condition [HasCascadeHint]
    action [ReactToCascade]
  }
}
```

**`HasCascadeHint`:** Returns `bb.cascadeHint === "seek-proximity" || bb.cascadeHint === "force-break"`. Only matches the two movement-based hints; other cascade types are handled imperatively by `tickSocial`.

**`ReactToCascade`:** Reads `bb.cascadeHint` and acts:

| Cascade Hint | Intent | Movement |
|-|-|-|
| `"seek-proximity"` | `"seeking"` | `seekStation(bb, bb.cascadeTarget, "seeking", "cascade-seek")` |
| `"force-break"` | `"on-break"` | `seekStation(bb, bb.nearestRestStation, "on-break", "cascade-break")` |

After acting, clears `bb.cascadeHint = null` and `bb.cascadeTarget = null` to prevent re-triggering.

### 1c. Gossip Propagation (Already Wired)

Gossip forwarding is already implemented in `tickSocial` (engine-simulation.ts lines 728-741). The cascade resolver's `shouldForwardGossip()` is called there, and `echoProducer.onGossipHeard()` fires on a random roommate. The reason gossip rarely fires today is that interactions don't produce echoes — so reputation echoes never accumulate to cascade threshold. Part 1a fixes this by feeding interaction results into the echo producer, which naturally feeds the existing gossip pipeline. No new gossip code is needed.

---

## Part 2: Whim Subtree

A new BT subtree that generates spontaneous activities from echo preferences.

### Position in Master MDSL

After `MerchantVisit`, before the `ActiveGoal` branch. Fires when no urgent need or work demands attention, but before the agent falls to idle.

```
root [Whim] {
  sequence {
    condition [HasWhim]
    action [ExecuteWhim]
  }
}
```

### HasWhim Condition

Probability-gated condition using echo data:

```
P = min(0.4, 0.15 + strongestEchoWeight / 200)
```

- Base chance: 15% per BT tick
- Boosted by strong echoes (weight 50 → P = 0.40 cap)
- Returns false if energy < 40 or hunger < 40 (needs take priority)
- Returns false if agent whimmed within last 6000ms (cooldown via `context.lastWhimTick`, consistent with `intentTimer` ms pattern)
- Returns false if `context.echoStore` is undefined (graceful degradation)

**Reads:** `context.echoStore.getStrongest(name, kind)` for each echo kind, picks the one with highest absolute weight.

**Re-entry safety:** When `ExecuteWhim` returns `"running"` (seekStation-based whims), mistreevous re-enters the running child directly on subsequent ticks without re-evaluating `HasWhim`. The probability gate is only rolled once per whim, not on every re-entry tick.

### ExecuteWhim Action

Picks whim type based on strongest echo, writes to blackboard. The selection cascades through the table top-to-bottom — if a whim type can't execute (e.g., no merchant stall nearby), it falls through to the next row.

| Strongest Echo | Condition | Whim Type | Blackboard Effect |
|-|-|-|-|
| `bond` | weight > 15, target in `bb.nearbyAgents` | Visit bonded agent | `seekStation(bb, bb.whimTarget, "seeking", "whim-visit")` |
| `preference` | weight > 10, echo has tag "shop", `bb.nearestMerchantStall` not null | Browse merchant | `seekStation(bb, bb.nearestMerchantStall, "seeking", "whim-shop")` |
| `aversion` | weight < -10, target matches `bb.currentRoom` | Leave room | Write `bb.roomAvoidance = bb.currentRoom` (engine handles transfer) |
| `mood-residue` | weight > 20 | Celebrate | `bb.intent = "idle"`, `bb.speechRequest = { text, kind: "speech" }` |
| `mood-residue` | weight < -10 | Mope | `bb.intent = "idle"`, `bb.movementCommand = "wander"` |
| fallback | no qualifying echo | Random wander | Same as `CommandWander` |

**Tag inspection for preferences:** `ExecuteWhim` calls `echoStore.getStrongest(name, "preference")` and then inspects the returned echo's `tags` array for `"shop"`. If the tag doesn't match, the row is skipped and falls through. No changes to `IEchoStore` interface needed.

**Bond target position:** The BT cannot access other agents' blackboards. A new blackboard field `whimTarget` is populated by the sensor phase: when the agent's strongest bond echo has weight > 15 and the bonded agent is in the same room, the sensor writes the bonded agent's position to `bb.whimTarget`. This is similar to the existing `wanderHint` but deterministic (no 40% probability gate) and only populated when a strong bond exists.

**Room preference via `roomAvoidance`:** The whim uses the existing `bb.roomAvoidance` mechanism to trigger room transfers. Writing `bb.roomAvoidance = bb.currentRoom` causes `tickNeeds` to call `roomSwitcher.requestTransfer()` on the next frame. No direct room-switcher access from the BT.

**Returns:** `"running"` for seekStation-based whims (waits for arrival), `"succeeded"` for emote/wander/room-avoidance whims.

### Context Extension

Add to `BTAgentContext` (in `bt-types.ts`):
- `lastWhimTick: number` — initialized to 0, set to current wall-clock ms (`deps.clock.ms()`) when ExecuteWhim fires

### Blackboard Extension

Add to `AgentBlackboard` (in `blackboard.ts`):
- `whimTarget: { x: number; y: number } | null` — default `null`

### Sensor Extension

Add to `SensorDeps` (in `sensor-phase.ts`):
- `getWhimTarget(name: string): { x: number; y: number } | null`

Implementation in `tickBlackboardSensors`: read strongest bond echo via `echoStore.getStrongest(name, "bond")`, check weight > 15, check target agent is in same room, return their position. Otherwise null.

---

## Part 3: Tuning Adjustments

Three constant changes in existing files.

### 3a. Cascade Threshold: 15 → 10

**Files:** `echo-store.ts` constant `CASCADE_THRESHOLD`, AND `cascade-resolver.ts` constant `CASCADE_WEIGHT_THRESHOLD`. Both must be changed together — the echo store flags echoes as cascade-eligible, and the resolver gates whether `shouldCascade()` returns true. If only one is lowered, echoes at weight 10-14 would be flagged but rejected.

**Effect:** A single strong event (drama ±15, task failure -15) immediately cascades. Moderate events (conversation +5) cascade after one reinforcement (+10). The world becomes visibly more reactive.

### 3b. Cascade Base Probability: 0.3 → 0.4

**File:** `cascade-resolver.ts`, constant `BASE_PROBABILITY`

**Formula becomes:** `P = min(0.6, 0.4 + |weight| / 100)`

**Effect at threshold (10):** P = 0.50 (up from 0.40). Cascades become the norm for strong echoes rather than a coin flip.

### 3c. Gossip Forward Chance: 0.3 → 0.5

**File:** `cascade-resolver.ts`, constant `GOSSIP_FORWARD_CHANCE`

**Effect:** Gossip reliably reaches 2-3 agents. Chain probability: 0.5 → 0.25 → 0.125 → dies. Creates visible "news spreading" moments.

### Unchanged Constants

| Constant | Value | Reason |
|-|-|-|
| `MAX_ECHOES` | 20 | Sufficient headroom |
| `MAX_CASCADE_DEPTH` | 3 | Prevents runaway chains |
| `MAX_CASCADE_BUDGET` | 5/cycle | Prevents cascade storms |
| `EVICTION_THRESHOLD` | 2 | Low echoes should fade |
| Decay rates | Per-event | Already well-tuned |

---

## Part 4: Testing Strategy

### Unit Tests

**Whim condition (`HasWhim`):**
- Returns true when echo weight high + probability seeded to pass
- Returns false when energy < 40 (needs suppress whim)
- Returns false during cooldown period
- Returns false when no echoes present (base 15% tested with seeded random)
- Returns false when `echoStore` is undefined

**Whim action (`ExecuteWhim`):**
- Bond echo with nearby target → writes seekStation with whimTarget position
- Preference "shop" echo → writes seekStation with merchant stall
- Aversion for current room → writes roomAvoidance
- Mood-residue positive → writes idle intent + speech request
- Mood-residue negative → writes wander command
- No qualifying echo → writes wander (fallback)

**Cascade reaction (`HasCascadeHint` + `ReactToCascade`):**
- `"seek-proximity"` hint → writes seeking intent + seekStation to cascade target
- `"force-break"` hint → writes on-break intent + seekStation to rest station
- Other hints (vent, avoid-room) → HasCascadeHint returns false (handled by tickSocial)
- Clears cascadeHint/cascadeTarget after acting

**Interaction → echo feedback:**
- Affinity delta +10 → produces opinion echo with weight +30 (clamped)
- Affinity delta +20 → produces opinion echo with weight +30 (clamped at max)
- Memory record → produces memory echo with weight +4
- Need change negative → produces aversion echo with weight -5

**Gossip propagation:**
- Existing test coverage is sufficient — Part 1a enables the pipeline, no new gossip code

### Integration Tests

- Full BT tick with cascade hint → cascade reaction fires before idle
- Full BT tick with strong bond echo + whimTarget → whim fires, agent walks to bonded target
- Full BT tick with critical needs + strong echo → whim suppressed, needs win
- Whim cooldown prevents double-firing across consecutive ticks

---

## File Impact

### New Files (2)
- `src/game/brain/behavior-tree/subtrees/whim.ts` — MDSL string
- `src/game/brain/behavior-tree/subtrees/cascade-reaction.ts` — MDSL string

### Modified Source Files (8)
- `bt-agent.ts` — Add HasWhim, ExecuteWhim, HasCascadeHint, ReactToCascade
- `bt-types.ts` — Add `lastWhimTick` to BTAgentContext
- `bt-factory.ts` — Insert CascadeReaction and Whim subtrees in master MDSL
- `engine-simulation.ts` — Wire interaction results → echo producer in tickInteractions
- `cascade-resolver.ts` — Tuning constants (BASE_PROBABILITY, GOSSIP_FORWARD_CHANCE)
- `echo-store.ts` — CASCADE_THRESHOLD 15 → 10
- `blackboard.ts` — Add `whimTarget` field
- `sensor-phase.ts` — Add `getWhimTarget` to SensorDeps, write to bb in writeSensorData

### New Test Files (2)
- `tests/game/brain/behavior-tree/subtrees/whim.test.ts`
- `tests/game/brain/behavior-tree/subtrees/cascade-reaction.test.ts`

### Modified Test Files (2)
- `tests/game/brain/behavior-tree/integration.test.ts` — Whim + cascade integration cases
- `tests/game/systems/sensor-phase.test.ts` — Add getWhimTarget to makeDeps

### Estimated Size
- ~350 LOC source
- ~300 LOC tests
