# Autonomous Agent Depth — Design Spec

**Date:** 2026-04-05
**Status:** Approved
**Scope:** Deepen existing agent autonomy — activity commitment, personal thresholds, sleep debt/rhythms, debug overlay enrichment. No new features; hardens and deepens what exists.

## Problem

Agents are too rigidly bound to day/night cycles. All agents simultaneously switch behavior at phase transitions — dropping work at dusk, waking at dawn in lockstep. Despite the 30-tick wake stagger, there is no visible emergence, no surprise, no individuality. The simulation feels clockwork rather than autonomous.

**Root causes:**

1. **No activity commitment** — BT resets and re-evaluates from root every tick. Agents flip-flop between actions instead of finishing what they started.
2. **Uniform thresholds** — all agents share identical hunger/energy/thirst thresholds from config. A strong laborer and a frail scholar behave identically.
3. **Binary time gates** — `IsWorkHours` and `IsNighttime` are global switches. When dusk hits tick 300, every agent simultaneously enters sleep mode.
4. **No fatigue memory** — sleep is purely energy-based with no carryover. An agent who barely slept has the same energy curve as one who rested fully.
5. **Opaque debug overlay** — shows current state but not reasoning. No quest visibility, no event log, no mood breakdown, no commitment display.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Commitment model | Tick-based minimum duration per action | Simple, tunable, BT-compatible. Critical needs still preempt. |
| Personal thresholds | Derived from existing GURPS attributes | No new data needed — uses AttributesComponent values already present |
| Sleep rhythm | Personal wake/sleep offsets + sleep debt | Extends existing wakeOffset pattern; debt creates multi-day emergence |
| Debug enrichment | Extend existing overlay panels | No new UI framework; builds on the HTML overlay already in place |

---

## Section 1: Activity Commitment

### Working Memory Additions

```typescript
// bt-working-memory.ts — add to WorkingMemory interface
commitmentTicks: number;      // remaining ticks on current commitment (0 = free)
// NOTE: reuses existing `committedAction` field (already on WorkingMemory)
```

`commitmentTicks` initialized to `0` in `createWorkingMemory()`. The existing `committedAction: string | null` field is repurposed for commitment tracking (already initialized to `null`).

### Config Additions

```json
// game-config.json
"commitment_ticks": {
  "work": 30,
  "harvest": 20,
  "rest": 40,
  "sell": 8,
  "buy": 8,
  "eat": 6,
  "drink": 4,
  "wander": 10,
  "talk": 12,
  "repair": 25,
  "seek_work": 0,
  "seek_food": 0,
  "seek_rest": 0,
  "seek_water": 0,
  "seek_market": 0,
  "seek_social": 0,
  "idle": 0,
  "fill_waterskin": 0,
  "claim_job": 0
}
```

Navigation and instantaneous actions get 0 (no commitment). Multi-tick sustained actions get meaningful durations.

### Schema Addition

Add `commitment_ticks` to `GameConfigSchema`:

```typescript
commitment_ticks: z.record(z.string(), z.number()).default({})
```

### BT Condition: IsCommitted

```typescript
// bt-conditions.ts
IsCommitted(): boolean {
  return memory.commitmentTicks > 0;
}
```

### BT Action: ContinueCommitment

```typescript
// bt-actions.ts
ContinueCommitment(): ActionResult {
  memory.commitmentTicks--;
  if (memory.commitmentTicks <= 0) {
    memory.committedAction = null;
    return FAILED; // commitment expired — re-evaluate next tick
  }
  return RUNNING;
}
```

### Commitment Activation

When any action sets `memory.btAction`, it also sets commitment if configured:

```typescript
// bt-actions.ts — helper used by action methods on their RUNNING/SUCCEEDED path
function beginAction(actionName: string): void {
  memory.btAction = actionName;
  if (memory.commitmentTicks <= 0) {
    const duration = Math.round((config.commitment_ticks?.[actionName] ?? 0) * commitmentMultiplier);
    if (duration > 0) {
      memory.commitmentTicks = duration;
      memory.committedAction = actionName;
    }
  }
}
```

**Important:** `beginAction` must only be called on the `RUNNING` or `SUCCEEDED` return path — never before precondition checks. If an action fails its preconditions (e.g., `Work()` when not at facility), it must return `FAILED` without calling `beginAction`. This prevents failed actions from incorrectly acquiring commitment.

All existing action methods that set `memory.btAction = '...'` on their RUNNING/SUCCEEDED path switch to calling `beginAction('...')`.

### BT Structure Change

```mdsl
root {
    selector {
        /* P-1: Honor current commitment (unless critical override) */
        sequence {
            condition [IsCommitted]
            flip { condition [NeedsCritical] }
            action [ContinueCommitment]
        }

        /* P0: Critical survival ... (existing, unchanged) */
        ...
    }
}
```

If committed and no critical need, keep doing what you're doing. Critical needs still preempt (uses `NEED_CRITICAL_THRESHOLDS` from `ranges.ts`).

**Important: `behavior-tree-system.ts` change required.** The system currently calls `agent.behaviorTree.reset()` unconditionally every tick, which clears all RUNNING state. The `reset()` must be skipped when the agent is committed:

```typescript
// behavior-tree-system.ts
if (agent.behaviorAgent.commitmentTicks <= 0) {
  agent.behaviorTree.reset();
}
agent.behaviorTree.step();
```

Without this change, `reset()` would clear the BT's internal state each tick, making the P-1 guard the sole mechanism (which works but wastes the RUNNING return from `ContinueCommitment`). With the conditional reset, the BT properly re-enters running nodes when committed.

### ST-Scaled Commitment Duration

Agents with higher ST sustain effort longer. `commitmentMultiplier` is computed once in `behavior-agent-factory.ts` and passed to `createActions`:

```typescript
// behavior-agent-factory.ts — computed once at creation
const commitmentMultiplier = (attrs.ST ?? aptitudeBaseline) / aptitudeBaseline;
```

The `beginAction` helper (shown above) applies `commitmentMultiplier` when reading from config.

ST 14 agent: `work` commitment = `round(30 * 14/12)` = 35 ticks.
ST 8 agent: `work` commitment = `round(30 * 8/12)` = 20 ticks.

---

## Section 2: Personal Thresholds

### Derivation from Attributes

Per-agent thresholds computed once in `createBehaviorAgent` and stored in working memory:

```typescript
// behavior-agent-factory.ts
const attrs = actor.get(AttributesComponent).state;
const baseline = config.jobs.aptitude_baseline; // 12

const personalThresholds = {
  hunger: config.needs.hunger_threshold * (baseline / (attrs.HT ?? baseline)),
  energy: config.needs.energy_threshold * (baseline / (attrs.IQ ?? baseline)),
  thirst: config.needs.thirst_threshold * (baseline / (attrs.HT ?? baseline)),
};
```

**Design note — attribute mapping rationale:** HT (Health/Toughness) governs hunger and thirst thresholds because these are physical tolerances — a tougher body endures deprivation longer. IQ (Intelligence) governs the energy threshold because mental discipline allows better fatigue management — a smarter agent recognizes they can push through tiredness. This is intentionally asymmetric with `needs-decay-system.ts`, which uses HT for the energy *decay rate*. The distinction: HT determines how fast energy *drains* (physical endurance), while IQ determines how low energy can *go* before the agent decides to rest (self-regulation). Both influence the effective work duration, but through different mechanisms.

### Working Memory Addition

```typescript
// bt-working-memory.ts
personalThresholds: {
  hunger: number;
  energy: number;
  thirst: number;
};
```

### Condition Changes

```typescript
// bt-conditions.ts — replace global threshold reads

IsHungry(): boolean {
  return actor.get(NeedsComponent).state.hunger < memory.personalThresholds.hunger;
}

IsExhausted(): boolean {
  const threshold = memory.personalThresholds.energy;
  const exhausted = actor.get(NeedsComponent).state.energy < threshold;
  if (exhausted) memory.recovering = true;
  return exhausted;
}

IsRecovering(): boolean {
  if (!memory.recovering) return false;
  const threshold = memory.personalThresholds.energy;
  const recoveredThreshold = threshold + config.needs.recovery_hysteresis;
  if (actor.get(NeedsComponent).state.energy >= recoveredThreshold) {
    memory.recovering = false;
    return false;
  }
  return true;
}

IsThirsty(): boolean {
  return actor.get(NeedsComponent).state.thirst < memory.personalThresholds.thirst;
}

NeedsCritical(): boolean {
  // Critical thresholds stay global — uses NEED_CRITICAL_THRESHOLDS from ranges.ts
  // (hunger: 20, energy: 15, social: 25, thirst: 20) — unchanged from current implementation
  // This condition is NOT personalized; it's a survival floor.
}
```

### Example Behavior

| Agent | HT | IQ | Hunger Threshold | Energy Threshold |
|-------|----|----|-----------------|-----------------|
| Elena (farmer) | 14 | 10 | 34 | 36 |
| Marcus (craftsman) | 10 | 14 | 48 | 26 |
| Kira (guard) | 12 | 12 | 40 | 30 |

Elena (HT 14) works through mild hunger — she doesn't eat until hunger drops to 34. Marcus (IQ 14) manages fatigue better — he doesn't rest until energy drops to 26. Kira uses defaults.

---

## Section 3: Sleep Debt & Personal Rhythms

### Personal Sleep Offset

Extend the existing wake stagger pattern to cover bedtime:

```typescript
// behavior-agent-factory.ts
const duskDuration = config.day_night.dusk.end - config.day_night.dusk.start + 1; // 60
const personalSleepOffset = Math.abs(staggerSeed * 7) % Math.floor(duskDuration / 2); // 0-29
```

Different hash multiplier (`* 7`) ensures sleep offset differs from wake offset for the same agent.

**Note:** `createConditions` signature must be extended to accept `personalSleepOffset: number` alongside the existing `wakeOffset: number` parameter. The `createBehaviorAgent` call in the factory must pass both values.

### New Condition: ShouldSleep

Replaces `IsNighttime` in the P6 sleep branch:

```typescript
// bt-conditions.ts
ShouldSleep(): boolean {
  const time = worldEntity().get(TimeComponent).state;
  if (time.phase === 'night') return true;
  if (time.phase === 'dusk') {
    return time.tickInCycle >= config.day_night.dusk.start + personalSleepOffset;
  }
  return false;
}
```

`IsNighttime` remains available for other uses (perception radius reduction, etc.) but the sleep decision is now personal.

### Sleep Debt Mechanics

**Working memory addition:**
```typescript
sleepDebt: number;  // 0 = fully rested, >0 = accumulated deficit
```

**Rest system integration** (`rest-system.ts`):
Each tick of rest reduces sleepDebt:
```typescript
if (memory.sleepDebt > 0) {
  memory.sleepDebt = Math.max(0, memory.sleepDebt - restConfig.recovery_rate);
}
```

**Day boundary update** — tracked in rest-system or a lightweight hook:
At each day boundary, compute rest deficit. If the agent rested fewer than `min_rest_ticks` ticks (default 80) during the previous day, the shortfall adds to sleepDebt:
```typescript
const restDeficit = config.min_rest_ticks - ticksRestedThisDay;
if (restDeficit > 0) {
  memory.sleepDebt = Math.min(memory.sleepDebt + restDeficit, config.sleep_debt_max);
}
```

**Energy decay modifier** (`needs-decay-system.ts`):
Sleep debt makes energy drain faster:
```typescript
const sleepDebtMultiplier = 1 + (memory.sleepDebt / 100);
// Applied to energy decay: effectiveDecay = baseDecay * activityCost * sleepDebtMultiplier
```

Agent with 0 debt: normal decay. Agent with 50 debt: 1.5x energy decay — gets exhausted 50% faster. Agent with 100 debt (max): 2x decay — crashes mid-day.

### Config Additions

```json
"sleep_debt_max": 100,
"min_rest_ticks": 80
```

### Working Memory: Rest Tracking

```typescript
ticksRestedThisDay: number;  // reset at day boundary, incremented each tick where btAction is 'rest'
```

### BT Change

```mdsl
/* P6: Personal sleep time */
sequence {
    condition [ShouldSleep]
    action [SeekRest]
    action [Rest] while(ShouldSleep)
}
```

### Emergence Result

- At dusk, agents peel off to rest one by one over 30 ticks (15 seconds) instead of all at once
- An overworked agent (sleepDebt 50) gets exhausted by mid-afternoon and rests early, independent of phase
- A well-rested agent (sleepDebt 0) pushes deep into dusk, finishing their work commitment before heading home
- Over multiple days, agents with demanding jobs accumulate debt and need longer recovery periods

---

## Section 4: Debug Overlay Enrichment

### A) Agent Panel — Context Rows

Add per-agent: commitment countdown, personal threshold with attribute source, sleep debt.

```
Elena (settler) · ⛏️ Working [committed 22t]
🍖 Food ██████░░░ 58  (thr: 34 ← HT 14)
💧 Water █████░░░░ 45  ⚡ Energy ███████░░ 71
😊 Content (32) = needs 8 + social 5 + equip 4 + goal 5 + base 10
🏃 42/50 · 💰 85g · 😴 debt: 12
📍 At Riverside Farm
```

Changes to `renderAgentsPanel`:
- Show `[committed Nt]` next to action when `commitmentTicks > 0`
- Show `(thr: N ← ATTR V)` next to hunger/energy bars
- Show mood factor breakdown inline (read from MoodComponent's computed factors)
- Show sleep debt when > 0

### B) Quest Board in World Panel

Add quest section to `renderWorldPanel`:

```typescript
// Read from QuestBoardComponent on worldEntity
const board = world.get(QuestBoardComponent);
for (const quest of board.state.quests) {
  const icon = quest.type === 'repair' ? '🔧' : quest.type === 'supply' ? '📦' : '🏪';
  const stateLabel = quest.state === 'claimed'
    ? `claimed by ${quest.claimedBy}`
    : quest.state;
  const remaining = quest.expiryTicks - (tickCount - quest.createdTick);
  lines.push(`${icon} ${quest.type} ${quest.facilityId} — ${stateLabel} (${remaining}t left)`);
}
```

### C) Event Log in Stats Panel

Show last 15 events from `eventBus.history()`.

**Prerequisite:** Add `eventBus?: EventBus` to the `OverlayDeps` interface in `debug-overlay.ts`, and update the `createDebugOverlay` call site in `game-view.ts` to pass `deps.eventBus`. Use the `history({ limit: 15 })` built-in parameter instead of `.slice(-15)`:

```typescript
const events = deps.eventBus?.history({ limit: 15 })?.reverse() ?? [];
for (const e of events) {
  const icon = EVENT_ICONS[e.type] ?? '📋';
  lines.push(`<span style="color:#6c7086">t${e.tick}</span> ${icon} ${formatEvent(e)}`);
}
```

`EVENT_ICONS` mapping for the ~20 event types already emitted. `formatEvent` produces human-readable one-liners from payload.

### D) Mood Factor Breakdown

The `MoodComponent` stores the computed `value` but not the individual factors. Two options:

**Option chosen:** Store factor breakdown on MoodComponent state:
```typescript
// component-data.ts — extend MoodState interface (NOT mood-component.ts — MoodState lives here)
factors?: {
  base: number;
  needs: number;
  social: number;
  goalProgress: number;
  equipmentCondition: number;
  environment: number;
  sleepDebt: number;
};
```

Written by `mood-system.ts` during computation. Read by debug overlay for display.

---

## Execution Order

```
Step 1: Working memory + commitment system (foundation)
Step 2: Personal thresholds (builds on step 1 — uses working memory)
Step 3: Sleep debt & personal rhythms (builds on step 1 — uses working memory)
Step 4: Debug overlay enrichment (independent of 2-3, depends on 1 for commitment display)
```

Steps 2 and 3 are independent of each other and can run in parallel.

## Files Modified

| File | Changes |
|------|---------|
| `bt-working-memory.ts` | Add commitmentTicks, personalThresholds, sleepDebt, ticksRestedThisDay |
| `bt-conditions.ts` | Personal thresholds in IsHungry/IsExhausted/IsThirsty/IsRecovering; new IsCommitted, ShouldSleep |
| `bt-actions.ts` | beginAction helper, ContinueCommitment action |
| `behavior-agent-factory.ts` | Compute personalThresholds, personalSleepOffset, commitmentMultiplier |
| `behavior-agent.ts` (domain) | Add getter/setter pairs for commitmentTicks, personalThresholds, sleepDebt, ticksRestedThisDay on BehaviorAgent interface |
| `behavior-tree-system.ts` | Skip `tree.reset()` when `commitmentTicks > 0` |
| `rest-system.ts` | Sleep debt reduction during rest, ticksRestedThisDay tracking |
| `needs-decay-system.ts` | Sleep debt multiplier on energy decay |
| `mood-system.ts` | Store factor breakdown on MoodComponent; add sleepDebt factor |
| `component-data.ts` | Extend MoodState with factors object |
| `debug-overlay.ts` | Add `eventBus` to OverlayDeps; commitment display, threshold context, quest board, event log, mood breakdown |
| `game-view.ts` | Pass `eventBus` to `createDebugOverlay` |
| `base.mdsl` | P-1 commitment guard, P6 ShouldSleep |
| `game-config.json` | commitment_ticks, sleep_debt_max, min_rest_ticks |
| `game-config-schema.ts` | Schema additions for new config fields |
| Tests | bt-conditions.test.ts, bt-actions.test.ts, rest-system.test.ts, needs-decay-system.test.ts, mood-system.test.ts. **Also update:** `behavior-agent.test.ts` (existing threshold tests must seed `personalThresholds`), `behavior-tree-system.test.ts` (conditional reset) |

## Success Criteria

| Metric | Before | After |
|--------|--------|-------|
| Agent dusk→rest spread | 0 ticks (simultaneous) | 30 ticks (staggered) |
| Agent dawn→work spread | 30 ticks | 30 ticks (maintained) |
| Mid-day action variety | Low (all working or all eating) | High (commitment timers desync actions) |
| Threshold diversity | 0 (identical) | Per-agent (3 distinct thresholds per agent) |
| Sleep debt effect | None | Visible multi-day fatigue patterns |
| Quest visibility | None | Full board in debug overlay |
| Event visibility | None | Last 15 events with icons |
| Mood explainability | Single number | 7-factor breakdown |
