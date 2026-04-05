# Autonomous Agent Depth — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deepen agent autonomy through activity commitment, personal thresholds, sleep debt, and debug overlay enrichment — no new features, just making existing systems emergent.

**Architecture:** Extends WorkingMemory + BehaviorAgent interface with 4 new fields; modifies 5 BT conditions to use per-agent thresholds; adds commitment guard to BT; integrates sleep debt into rest-system and needs-decay-system; enriches debug overlay with quest board, event log, and mood factors.

**Tech Stack:** TypeScript, mistreevous BT, ExcaliburJS ECS, Zod schemas, Vitest

**Spec:** `01 - Projects/Project Meridian/docs/specs/2026-04-05-autonomous-agent-depth-design.md`

**Commands (all from `cd "01 - Projects/Project Meridian"`):**
```bash
npx vitest run --config configs/vitest.config.ts                    # Full suite
npx vitest run tests/path/file.test.ts --config configs/vitest.config.ts  # Single file
npx tsc --noEmit --project configs/tsconfig.json                    # Type check
npx eslint src/ --config configs/eslint.config.mjs                  # Lint
```

---

## Chunk 1: Working Memory + Commitment Foundation (Tasks 1-4)

### Task 1: Extend WorkingMemory interface + schema

**Files:**
- Modify: `src/infrastructure/entity/bt-working-memory.ts`
- Modify: `src/domain/systems/behavior-agent.ts`
- Modify: `src/domain/schemas/game-config-schema.ts`
- Modify: `configs/game-config.json`

- [ ] **Step 1: Add fields to WorkingMemory interface**

In `src/infrastructure/entity/bt-working-memory.ts`, add to the `WorkingMemory` interface (after `insideFacility: boolean;` line 30):

```typescript
commitmentTicks: number;
sleepDebt: number;
ticksRestedThisDay: number;
personalThresholds: { hunger: number; energy: number; thirst: number };
```

- [ ] **Step 2: Initialize fields in createWorkingMemory**

In the return object of `createWorkingMemory` (after `insideFacility: false,` line 60):

```typescript
commitmentTicks: 0,
sleepDebt: 0,
ticksRestedThisDay: 0,
personalThresholds: { hunger: 40, energy: 30, thirst: 40 },
```

- [ ] **Step 3: Add getter/setter pairs to BehaviorAgent interface**

In `src/domain/systems/behavior-agent.ts`, add to the interface after `insideFacility: boolean;` (line 95):

```typescript
commitmentTicks: number;
sleepDebt: number;
ticksRestedThisDay: number;
readonly personalThresholds: { hunger: number; energy: number; thirst: number };
```

- [ ] **Step 4: Wire getter/setters in behavior-agent-factory.ts**

In `src/infrastructure/entity/behavior-agent-factory.ts`, add after the `insideFacility` getter/setter pair (after line 180):

```typescript
get commitmentTicks() { return memory.commitmentTicks; },
set commitmentTicks(v) { memory.commitmentTicks = v; },
get sleepDebt() { return memory.sleepDebt; },
set sleepDebt(v) { memory.sleepDebt = v; },
get ticksRestedThisDay() { return memory.ticksRestedThisDay; },
set ticksRestedThisDay(v) { memory.ticksRestedThisDay = v; },
get personalThresholds() { return memory.personalThresholds; },
```

- [ ] **Step 5: Add config schema fields**

In `src/domain/schemas/game-config-schema.ts`, add to the top-level `GameConfigSchema` object (find the last field before the closing `})`):

```typescript
commitment_ticks: z.record(z.string(), z.number()).default({}),
sleep_debt_max: z.number().default(100),
min_rest_ticks: z.number().default(80),
```

- [ ] **Step 6: Add config values to game-config.json**

Add after the `day_night` section in `configs/game-config.json`:

```json
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
  "claim_job": 0,
  "seek_quest": 0,
  "claim_quest": 0
},
"sleep_debt_max": 100,
"min_rest_ticks": 80
```

- [ ] **Step 7: Run tsc to verify**

Run: `npx tsc --noEmit --project configs/tsconfig.json`
Expected: 0 errors

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(meridian): extend working memory — commitmentTicks, sleepDebt, personalThresholds, config schema"
```

---

### Task 2: IsCommitted condition + ContinueCommitment action + beginAction helper

**Files:**
- Modify: `src/infrastructure/entity/bt-conditions.ts`
- Modify: `src/infrastructure/entity/bt-actions.ts`
- Modify: `src/domain/systems/behavior-agent.ts`

- [ ] **Step 1: Add IsCommitted to ConditionMethods + BehaviorAgent**

In `src/infrastructure/entity/bt-conditions.ts`, add to `ConditionMethods` interface (after `QuestCargoReady(): boolean;` line 56):
```typescript
IsCommitted(): boolean;
ShouldSleep(): boolean;
```

In `src/domain/systems/behavior-agent.ts`, add to the condition methods list (after `QuestCargoReady(): boolean;` line 138):
```typescript
IsCommitted(): boolean;
ShouldSleep(): boolean;
```

- [ ] **Step 2: Implement IsCommitted condition**

In the `createConditions` return object in `bt-conditions.ts`, add after the last condition:

```typescript
IsCommitted(): boolean {
  return memory.commitmentTicks > 0;
},
```

- [ ] **Step 3: Add ContinueCommitment to ActionMethods + BehaviorAgent**

In `src/infrastructure/entity/bt-actions.ts`, add to `ActionMethods` interface (after `AbandonQuest(): ActionResult;`):
```typescript
ContinueCommitment(): ActionResult;
```

In `src/domain/systems/behavior-agent.ts`, add to the action methods list (after `AbandonQuest(): ActionResult;` line 170):
```typescript
ContinueCommitment(): ActionResult;
```

- [ ] **Step 4: Implement ContinueCommitment action**

In the `createActions` return object in `bt-actions.ts`, add after `AbandonQuest`:

```typescript
ContinueCommitment(): ActionResult {
  memory.commitmentTicks--;
  if (memory.commitmentTicks <= 0) {
    memory.committedAction = null;
    return FAILED;
  }
  return RUNNING;
},
```

- [ ] **Step 5: Add beginAction helper in bt-actions.ts**

Inside `createActions`, before the return object, add a closure-scoped helper. The function needs `commitmentMultiplier` passed in — for now use 1.0 (will be wired in Task 3):

```typescript
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

This requires `commitmentMultiplier` to be in scope. Add it as a parameter to `createActions`. Update the `createActions` signature to accept `commitmentMultiplier: number` as the last parameter (default 1.0). Update the call site in `behavior-agent-factory.ts` to pass `1.0` for now.

- [ ] **Step 6: Convert action methods to use beginAction**

Replace `memory.btAction = '<name>';` with `beginAction('<name>');` in all action methods that return `RUNNING` or `SUCCEEDED`. Only on the success/running path — never before precondition checks. Key actions to convert:

- `Rest()`: `beginAction('rest');`
- `Work()`: `beginAction('work');` (only on the RUNNING path after `AtJobFacility` succeeds)
- `Harvest()`: `beginAction('harvest');`
- `SellAtMarket()`: `beginAction('sell');`
- `Buy()`: `beginAction('buy');`
- `Eat()`: `beginAction('eat');`
- `Drink()`: `beginAction('drink');`
- `Wander()`: `beginAction('wander');`
- `Talk()`: `beginAction('talk');`
- `WorkRepair()`: `beginAction('repair');`
- `SeekWork()`: `beginAction('seek_work');`
- `SeekFood()`: `beginAction('seek_food');`
- `SeekRest()`: `beginAction('seek_rest');`
- `SeekWater()`: `beginAction('seek_water');`
- `SeekMarket()`: `beginAction('seek_market');`
- `Idle()`: `beginAction('idle');`

- [ ] **Step 7: Run tsc**

Run: `npx tsc --noEmit --project configs/tsconfig.json`
Expected: 0 errors

- [ ] **Step 8: Run tests**

Run: `npx vitest run --config configs/vitest.config.ts`
Expected: All pass (beginAction sets same btAction as before; commitment is additive behavior)

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(meridian): IsCommitted + ContinueCommitment + beginAction helper for activity commitment"
```

---

### Task 3: Personal thresholds + commitmentMultiplier in factory

**Files:**
- Modify: `src/infrastructure/entity/behavior-agent-factory.ts`
- Modify: `src/infrastructure/entity/bt-conditions.ts`

- [ ] **Step 1: Compute personalThresholds + commitmentMultiplier in factory**

In `behavior-agent-factory.ts`, after the `wakeOffset` computation (around line 44), add:

```typescript
const attrs = actor.get(AttributesComponent).state;
const aptitudeBaseline = config.jobs?.aptitude_baseline ?? 12;

const personalThresholds = {
  hunger: config.needs.hunger_threshold * (aptitudeBaseline / (attrs.HT ?? aptitudeBaseline)),
  energy: config.needs.energy_threshold * (aptitudeBaseline / (attrs.IQ ?? aptitudeBaseline)),
  thirst: config.needs.thirst_threshold * (aptitudeBaseline / (attrs.HT ?? aptitudeBaseline)),
};
memory.personalThresholds = personalThresholds;

const commitmentMultiplier = (attrs.ST ?? aptitudeBaseline) / aptitudeBaseline;
```

Ensure `AttributesComponent` is imported (it should already be).

- [ ] **Step 2: Pass commitmentMultiplier to createActions**

Update the `createActions` call to pass `commitmentMultiplier` instead of `1.0`.

- [ ] **Step 3: Compute personalSleepOffset in factory**

After the `wakeOffset` line, add:

```typescript
const duskDuration = config.day_night.dusk.end - config.day_night.dusk.start + 1;
const personalSleepOffset = Math.abs(staggerSeed * 7) % Math.floor(duskDuration / 2);
```

- [ ] **Step 4: Pass personalSleepOffset to createConditions**

Update the `createConditions` call to pass `personalSleepOffset` as the 9th argument. Update the `createConditions` function signature in `bt-conditions.ts` to accept `personalSleepOffset: number` as the 9th parameter.

- [ ] **Step 5: Update conditions to use personalThresholds**

In `bt-conditions.ts`, replace the four conditions:

```typescript
IsHungry(): boolean {
  return actor.get(NeedsComponent).state.hunger < memory.personalThresholds.hunger;
},

IsExhausted(): boolean {
  const threshold = memory.personalThresholds.energy;
  const exhausted = actor.get(NeedsComponent).state.energy < threshold;
  if (exhausted) memory.recovering = true;
  return exhausted;
},

IsRecovering(): boolean {
  if (!memory.recovering) return false;
  const threshold = memory.personalThresholds.energy;
  const recoveredThreshold = threshold + config.needs.recovery_hysteresis;
  if (actor.get(NeedsComponent).state.energy >= recoveredThreshold) {
    memory.recovering = false;
    return false;
  }
  return true;
},

IsThirsty(): boolean {
  return actor.get(NeedsComponent).state.thirst < memory.personalThresholds.thirst;
},
```

- [ ] **Step 6: Implement ShouldSleep condition**

In the `createConditions` return object (near IsCommitted):

```typescript
ShouldSleep(): boolean {
  const time = worldEntity().get(TimeComponent).state;
  if (time.phase === 'night') return true;
  if (time.phase === 'dusk') {
    return time.tickInCycle >= config.day_night.dusk.start + personalSleepOffset;
  }
  return false;
},
```

- [ ] **Step 7: Run tsc + tests**

Run: `npx tsc --noEmit --project configs/tsconfig.json && npx vitest run --config configs/vitest.config.ts`
Expected: Some tests may fail if they relied on exact global threshold values. Fix by seeding `personalThresholds` in test setup helpers.

- [ ] **Step 8: Fix failing tests**

In test setup helpers that create mock `WorkingMemory` or `BehaviorAgent`, ensure `personalThresholds` is set to match the config defaults `{ hunger: 40, energy: 30, thirst: 40 }` and `commitmentTicks: 0`, `sleepDebt: 0`, `ticksRestedThisDay: 0`.

- [ ] **Step 9: Run full suite**

Run: `npx vitest run --config configs/vitest.config.ts`
Expected: All pass

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat(meridian): personal thresholds from GURPS attributes + commitmentMultiplier from ST"
```

---

### Task 4: BT structure change + conditional tree.reset()

**Files:**
- Modify: `behavior-trees/base.mdsl`
- Modify: `src/infrastructure/systems/behavior-tree-system.ts`

- [ ] **Step 1: Add P-1 commitment guard to base.mdsl**

Add at the top of the root selector (before P0):

```mdsl
        /* P-1: Honor current commitment (unless critical override) */
        sequence {
            condition [IsCommitted]
            flip { condition [NeedsCritical] }
            action [ContinueCommitment]
        }
```

- [ ] **Step 2: Replace IsNighttime with ShouldSleep in P6**

Change P6 from:
```mdsl
        /* P6: Night — go home and sleep */
        sequence {
            condition [IsNighttime]
            action [SeekRest]
            action [Rest] while(IsNighttime)
        }
```
To:
```mdsl
        /* P6: Personal sleep time */
        sequence {
            condition [ShouldSleep]
            action [SeekRest]
            action [Rest] while(ShouldSleep)
        }
```

- [ ] **Step 3: Make tree.reset() conditional**

In `src/infrastructure/systems/behavior-tree-system.ts`, change:

```typescript
agent.behaviorTree.reset();
agent.behaviorTree.step();
```

To:

```typescript
if (agent.behaviorAgent.commitmentTicks <= 0) {
  agent.behaviorTree.reset();
}
agent.behaviorTree.step();
```

- [ ] **Step 4: Run tsc + tests**

Run: `npx tsc --noEmit --project configs/tsconfig.json && npx vitest run --config configs/vitest.config.ts`
Expected: All pass

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(meridian): BT commitment guard + conditional reset + ShouldSleep replaces IsNighttime in P6"
```

---

## Chunk 2: Sleep Debt + Needs Integration (Tasks 5-6)

### Task 5: Sleep debt in rest-system

**Files:**
- Modify: `src/infrastructure/systems/rest-system.ts`

- [ ] **Step 1: Add sleep debt reduction**

In `rest-system.ts`, inside the `for (const agent of agentList)` loop, after `const ba = agent.behaviorAgent;` and after `const btAction = ba.btAction;`, add rest-tick tracking:

```typescript
// Track rest ticks for sleep debt calculation
if (btAction === 'rest' || btAction === 'idle') {
  ba.ticksRestedThisDay++;
}
```

After the `applyRest` call and energy update (after line 91), add sleep debt reduction:

```typescript
// Reduce sleep debt while resting
if (ba.sleepDebt > 0 && restTier !== null) {
  ba.sleepDebt = Math.max(0, ba.sleepDebt - restConfig[restTier].recovery_rate);
}
```

- [ ] **Step 2: Add day-boundary sleep debt accumulation**

The rest-system needs to check for day boundary. Add at the top of `execute`, before the agent loop:

```typescript
const world = worldEntity();
const time = world.get(TimeComponent);

// Day boundary: compute sleep deficit and reset counter
if (time.state.dayBoundaryThisTick) {
  const minRest = deps.config.min_rest_ticks ?? 80;
  const maxDebt = deps.config.sleep_debt_max ?? 100;
  for (const agent of agentList) {
    const ba = agent.behaviorAgent;
    const deficit = minRest - ba.ticksRestedThisDay;
    if (deficit > 0) {
      ba.sleepDebt = Math.min(ba.sleepDebt + deficit, maxDebt);
    }
    ba.ticksRestedThisDay = 0;
  }
}
```

Add import for `TimeComponent` at the top of the file.

- [ ] **Step 3: Run tsc + tests**

Run: `npx tsc --noEmit --project configs/tsconfig.json && npx vitest run tests/infrastructure/systems/rest-system.test.ts --config configs/vitest.config.ts`
Expected: Existing tests pass (new behavior is additive)

- [ ] **Step 4: Write tests for sleep debt**

Add to `tests/infrastructure/systems/rest-system.test.ts`:

```typescript
it('increments ticksRestedThisDay when agent btAction is rest', () => {
  // Setup agent with btAction = 'rest', verify ticksRestedThisDay increments
});

it('reduces sleepDebt while resting', () => {
  // Setup agent with sleepDebt = 50, rest for 1 tick, verify debt decreases
});

it('accumulates sleep debt at day boundary when rest is insufficient', () => {
  // Setup agent with ticksRestedThisDay = 30 (deficit of 50 from min 80)
  // Trigger day boundary, verify sleepDebt increases by 50
});

it('caps sleepDebt at sleep_debt_max', () => {
  // Setup agent with sleepDebt = 90, deficit = 20, max = 100
  // Verify sleepDebt capped at 100
});

it('resets ticksRestedThisDay at day boundary', () => {
  // Setup agent with ticksRestedThisDay = 45
  // Trigger day boundary, verify reset to 0
});
```

- [ ] **Step 5: Run tests**

Run: `npx vitest run tests/infrastructure/systems/rest-system.test.ts --config configs/vitest.config.ts`
Expected: All pass

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(meridian): sleep debt tracking in rest-system — accumulation, reduction, day boundary reset"
```

---

### Task 6: Sleep debt multiplier in needs-decay-system

**Files:**
- Modify: `src/infrastructure/systems/needs-decay-system.ts`

- [ ] **Step 1: Apply sleep debt multiplier to energy decay**

In `needs-decay-system.ts`, after the equipment decay reduction block (after line 54), add:

```typescript
// Sleep debt increases energy drain
const sleepDebtMult = 1 + (entity.behaviorAgent.sleepDebt / 100);
mergedMods.energyDecayScale = (mergedMods.energyDecayScale ?? 1) * sleepDebtMult;
```

- [ ] **Step 2: Run tsc + tests**

Run: `npx tsc --noEmit --project configs/tsconfig.json && npx vitest run tests/infrastructure/systems/needs-decay-system.test.ts --config configs/vitest.config.ts`
Expected: Existing tests pass (sleepDebt is 0 by default, multiplier is 1.0)

- [ ] **Step 3: Write test for sleep debt multiplier**

Add to `tests/infrastructure/systems/needs-decay-system.test.ts`:

```typescript
it('sleep debt increases energy decay rate', () => {
  // Setup agent with sleepDebt = 50 → multiplier 1.5
  // Run one tick, compare energy decay to agent with sleepDebt = 0
  // Debt=50 agent should lose ~50% more energy
});
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/infrastructure/systems/needs-decay-system.test.ts --config configs/vitest.config.ts`
Expected: All pass

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(meridian): sleep debt multiplier on energy decay in needs-decay-system"
```

---

## Chunk 3: Mood Factors + Debug Overlay (Tasks 7-9)

### Task 7: Store mood factor breakdown

**Files:**
- Modify: `src/domain/core/component-data.ts`
- Modify: `src/infrastructure/systems/mood-system.ts`

- [ ] **Step 1: Extend MoodState with factors**

In `src/domain/core/component-data.ts`, extend the `MoodState` interface (line 16-19):

```typescript
export interface MoodState {
  value: number;
  bucket: string;
  factors?: {
    needs: number;
    positiveMemories: number;
    negativeMemories: number;
    goalProgress: number;
    walletHealth: number;
    equipmentCondition: number;
    relationshipQuality: number;
  };
}
```

- [ ] **Step 2: Write factors in mood-system.ts**

In `mood-system.ts`, change the `mood.state = { value: result.value, bucket: result.bucket };` line (line 84) to:

```typescript
mood.state = { value: result.value, bucket: result.bucket, factors };
```

- [ ] **Step 3: Run tsc + tests**

Run: `npx tsc --noEmit --project configs/tsconfig.json && npx vitest run --config configs/vitest.config.ts`
Expected: All pass

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(meridian): store mood factor breakdown on MoodState for debug overlay"
```

---

### Task 8: Debug overlay — agent enrichment + quest board

**Files:**
- Modify: `src/infrastructure/engine/debug-overlay.ts`

- [ ] **Step 1: Add quest action display entries**

In `debug-overlay.ts`, add to `ACTION_DISPLAY` (after `deliver_cargo`):

```typescript
claim_quest: { emoji: '📜', label: 'Claiming quest' },
seek_quest: { emoji: '🗺️', label: 'Quest journey' },
repair: { emoji: '🔧', label: 'Repairing' },
```

- [ ] **Step 2: Enrich agent panel with commitment + thresholds + sleep debt**

In `renderAgentsPanel`, modify the action line to show commitment:

```typescript
const commitLabel = ba.commitmentTicks > 0 ? ` [${ba.commitmentTicks}t]` : '';
lines.push(`<b style="color:${agent.agentColor}">${agent.agentName}</b> <span style="color:#6c7086">${agent.kind}</span> &middot; ${actionInfo.emoji} ${actionInfo.label}${commitLabel}`);
```

Modify the needs bars to show personal thresholds. Update the hunger bar line:

```typescript
const hungerThr = ba.personalThresholds.hunger;
const energyThr = ba.personalThresholds.energy;
lines.push(`<div style="margin:3px 0">${needBar(needs.hunger, 'Food', '🍖')} <span style="color:#6c7086;font-size:9px">thr:${hungerThr.toFixed(0)}</span> ${needBar(needs.thirst, 'Water', '💧')}</div>`);
lines.push(`<div style="margin:3px 0">${needBar(needs.energy, 'Energy', '⚡')} <span style="color:#6c7086;font-size:9px">thr:${energyThr.toFixed(0)}</span> ${needBar(needs.social, 'Social', '👥')}</div>`);
```

Add sleep debt to the status line:

```typescript
const debtLabel = ba.sleepDebt > 0 ? ` · 😴 debt:${ba.sleepDebt.toFixed(0)}` : '';
lines.push(`${moodEmoji} ${mood.bucket} &middot; 🏃 ${stamina.current.toFixed(0)}/${stamina.max} &middot; 💰 ${wallet.gold.toFixed(0)}g${debtLabel}`);
```

Add mood factor breakdown:

```typescript
if (mood.factors !== undefined) {
  const f = mood.factors;
  const parts = [
    `needs:${(f.needs * 100).toFixed(0)}`,
    `mem:+${(f.positiveMemories * 100).toFixed(0)}/-${(f.negativeMemories * 100).toFixed(0)}`,
    `goal:${(f.goalProgress * 100).toFixed(0)}`,
    `rel:${(f.relationshipQuality * 100).toFixed(0)}`,
  ].join(' ');
  lines.push(`<span style="color:#6c7086;font-size:9px">${parts}</span>`);
}
```

- [ ] **Step 3: Add quest board to world panel**

In `renderWorldPanel`, after the non-facility locations section, add:

```typescript
// Quest board
const world = deps.getWorldEntity();
if (world.has(QuestBoardComponent)) {
  const board = world.get(QuestBoardComponent);
  if (board.state.quests.length > 0) {
    lines.push('<br><b style="color:#89b4fa">Quest Board</b>');
    const tickCount = deps.getTickCount();
    for (const quest of board.state.quests) {
      const icon = quest.type === 'repair' ? '🔧' : quest.type === 'supply' ? '📦' : '🏪';
      const remaining = quest.expiryTicks - (tickCount - quest.createdTick);
      const stateLabel = quest.state === 'claimed'
        ? `<span style="color:#f9e2af">claimed by ${quest.claimedBy?.replace('agent-', '') ?? '?'}</span>`
        : quest.state === 'completed'
          ? '<span style="color:#a6e3a1">completed</span>'
          : `<span style="color:#6c7086">open</span>`;
      lines.push(`<div style="margin:2px 0">${icon} ${quest.type} → ${quest.facilityId.replace('loc-', '')} — ${stateLabel} <span style="color:#6c7086">(${remaining}t)</span></div>`);
    }
  }
}
```

Import `QuestBoardComponent` at the top of the file.

- [ ] **Step 4: Run tsc**

Run: `npx tsc --noEmit --project configs/tsconfig.json`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(meridian): debug overlay — commitment display, thresholds, sleep debt, quest board, mood factors"
```

---

### Task 9: Debug overlay — event log

**Files:**
- Modify: `src/infrastructure/engine/debug-overlay.ts`
- Modify: `src/infrastructure/engine/game-view.ts`

- [ ] **Step 1: Add eventBus to OverlayDeps**

In `debug-overlay.ts`, add to the `OverlayDeps` interface:

```typescript
getEventBus?: () => { history: (opts?: { limit?: number }) => { type: string; tick: number; source: string; payload: Record<string, unknown> }[] };
```

- [ ] **Step 2: Pass eventBus in game-view.ts**

In `game-view.ts`, where `createDebugOverlay` is called, add `getEventBus: () => deps.eventBus` to the deps object.

- [ ] **Step 3: Add event log to stats panel**

In `renderStatsPanel`, after the existing content, add:

```typescript
// Event log
const eventBus = deps.getEventBus?.();
if (eventBus !== undefined) {
  const events = eventBus.history({ limit: 15 }).reverse();
  if (events.length > 0) {
    lines.push('<br><b style="color:#89b4fa">Recent Events</b>');
    const EVENT_ICONS: Record<string, string> = {
      QuestGenerated: '📜', QuestClaimed: '📋', QuestCompleted: '✅', QuestExpired: '⏰', QuestAbandoned: '❌',
      JobSwitched: '🔄', GoldFlowed: '💰', MoodChanged: '😶', MoodBreakdown: '💔',
      FacilityAbandoned: '🏚️', FacilityRestored: '🏗️', RestStarted: '😴',
      DayPhaseChanged: '🌅', SupplyDelivered: '📦', TickBudgetExceeded: '⚠️',
    };
    for (const e of events) {
      const icon = EVENT_ICONS[e.type] ?? '📋';
      const detail = formatEventPayload(e);
      lines.push(`<span style="color:#585b70">t${e.tick}</span> ${icon} <span style="color:#bac2de">${detail}</span>`);
    }
  }
}
```

- [ ] **Step 4: Add formatEventPayload helper**

Add before `createDebugOverlay`:

```typescript
function formatEventPayload(e: { type: string; payload: Record<string, unknown> }): string {
  const p = e.payload;
  switch (e.type) {
    case 'QuestGenerated': return `Quest: ${String(p['type'])} → ${String(p['facilityId'])}`;
    case 'QuestClaimed': return `${String(p['agentId']).replace('agent-', '')} claimed ${String(p['questType'])} quest`;
    case 'QuestCompleted': return `${String(p['agentId']).replace('agent-', '')} completed quest (+${String(p['reward'])}g)`;
    case 'JobSwitched': return `${String(p['agentId']).replace('agent-', '')} switched job`;
    case 'GoldFlowed': return `${String(p['subcategory'])}: ${String(p['amount'])}g ${String(p['fromEntity']).replace('agent-', '')} → ${String(p['toEntity']).replace('agent-', '')}`;
    case 'MoodChanged': return `${String(p['agentId']).replace('agent-', '')} mood: ${String(p['oldBucket'])} → ${String(p['newBucket'])}`;
    case 'DayPhaseChanged': return `${String(p['previousPhase'])} → ${String(p['newPhase'])}`;
    case 'FacilityAbandoned': return `${String(p['facilityId'])} abandoned`;
    case 'FacilityRestored': return `${String(p['facilityId'])} restored`;
    default: return e.type;
  }
}
```

- [ ] **Step 5: Run tsc**

Run: `npx tsc --noEmit --project configs/tsconfig.json`
Expected: 0 errors

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(meridian): debug overlay — event log with icons and formatted payloads"
```

---

## Chunk 4: Verification (Task 10)

### Task 10: Full verification pass

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run --config configs/vitest.config.ts`
Expected: All tests pass

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit --project configs/tsconfig.json`
Expected: 0 errors

- [ ] **Step 3: Run lint**

Run: `npx eslint src/ --config configs/eslint.config.mjs`
Expected: 0 errors

- [ ] **Step 4: Fix any issues found**

- [ ] **Step 5: Verify success criteria**

| Metric | Target | Check |
|--------|--------|-------|
| commitmentTicks on WorkingMemory | Present, initialized to 0 | `grep "commitmentTicks" src/infrastructure/entity/bt-working-memory.ts` |
| personalThresholds computed | From GURPS attributes | Check behavior-agent-factory.ts |
| IsCommitted condition | Returns true when commitmentTicks > 0 | Check bt-conditions.ts |
| ShouldSleep condition | Personal sleep offset | Check bt-conditions.ts |
| base.mdsl P-1 guard | IsCommitted + !NeedsCritical → ContinueCommitment | Check base.mdsl |
| base.mdsl P6 | ShouldSleep instead of IsNighttime | Check base.mdsl |
| tree.reset() conditional | Skipped when committed | Check behavior-tree-system.ts |
| Sleep debt reduction | During rest | Check rest-system.ts |
| Sleep debt accumulation | At day boundary | Check rest-system.ts |
| Energy decay multiplier | sleepDebt / 100 | Check needs-decay-system.ts |
| Mood factors on MoodState | 7 factors stored | Check component-data.ts |
| Debug: commitment display | Shown in agent panel | Check debug-overlay.ts |
| Debug: quest board | Shown in world panel | Check debug-overlay.ts |
| Debug: event log | 15 recent events in stats | Check debug-overlay.ts |
| Lint errors | 0 | eslint output |

- [ ] **Step 6: Commit any final fixes**
