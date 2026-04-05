# Meridian Baseline Stabilization — Design Spec

**Date**: 2026-04-06
**Scope**: P0–P1 fixes + two P2 config tweaks (6 fixes total)
**Goal**: Get the simulation sustaining itself day-over-day with working economy, accurate mood, and correct agent behavior.

---

## Fix 1: Facility Worker Reservation Model

### Problem

`ClaimJob()` and `ClaimBestJob()` set `actor.job` but never write `workerId` on the `FacilityComponent`. The `facility.state.workerId` is only written as a derived observation inside `processFacilityTick()` via `findWorker()`, which requires the agent to simultaneously be within `interaction_radius`, executing `btAction === 'work'`, and have a matching job. Agents get pulled away by hunger/thirst/rest, `workerId` snaps back to `null`, and no production ever happens.

### Design

**Reservation model**: `ClaimJob`/`ClaimBestJob` write `facility.state.workerId` at claim time. The facility remembers its assigned worker persistently. Production still requires physical presence + `btAction === 'work'`, but the assignment survives the agent leaving to eat or rest.

**Changes**:

1. **`behavior-agent-factory.ts`** — Add `claimFacility(facilityId: string): boolean` and `releaseFacility(): void` helpers to `BehaviorAgentDeps`. These find the `FacilityComponent` by location ID from `locationActorMap` and write/clear `workerId`. This keeps BT actions from reaching into ECS internals.

2. **`bt-actions.ts` — `ClaimJob()`** — After setting `actor.job`, call `deps.claimFacility(nearest.id)`. If the claim fails (facility already taken), revert `actor.job` and return `FAILED`.

3. **`bt-actions.ts` — `ClaimBestJob()`** — Same pattern: call `deps.claimFacility(chosen.id)` after setting `actor.job`.

4. **`facility-system.ts` — `findWorker()`** — Change from spatial-query discovery to reservation-based. Read `facility.state.workerId`, then validate the reserved worker is physically present with `btAction === 'work'`. Return the worker for production only if both conditions are met. If reserved but absent → no production, reservation persists. If no reservation → no worker.

5. **`bt-conditions.ts` — `AtJobFacility()`** — Simplify: if `facility.workerId === actor.agentId`, the agent is assigned. Remove the `workerId === null` alternative check.

6. **`bt-conditions.ts` — `OpenProductionFacilityNearby()`** — Check `workerId === null` (same as now, but now authoritative).

7. **`bt-actions.ts` — `ReleaseJob()`** — Currently only clears `actor.job` and `memory.btAction` but does not touch `FacilityComponent.state.workerId`. Add `deps.releaseFacility()` call before clearing `actor.job`.

8. **`bt-actions.ts` — `Work()` and `SeekWork()`** — Remove the `f.workerId === null` fallback from their facility lookups. Post-reservation, these should only match `f.workerId === actor.agentId`. The `SeekWork()` fallback `allLocations` search (which skips `workerId` checks entirely) must also be guarded against occupied facilities.

**Invariant**: `actor.job` and exactly one facility's `workerId` are always in sync. `ReleaseJob()`, `SwitchJob()`, and `releaseFacility()` are the only release paths.

### Files

- `src/infrastructure/entity/behavior-agent-factory.ts` — add `claimFacility`/`releaseFacility`
- `src/infrastructure/entity/bt-actions.ts` — `ClaimJob`, `ClaimBestJob` call `claimFacility`; `ReleaseJob` calls `releaseFacility`; `Work`/`SeekWork` remove `workerId === null` fallback
- `src/infrastructure/systems/facility-system.ts` — `findWorker` reads reservation
- `src/infrastructure/entity/bt-conditions.ts` — `AtJobFacility`, `OpenProductionFacilityNearby`
- `src/domain/systems/behavior-agent.ts` — add `claimFacility`/`releaseFacility` to interface

---

## Fix 2: Mood Formula Recalibration

### Problem

The mood formula `rawMood = ((positivePart - negativePart) / totalWeight) * 200 - 100` sets the neutral point such that factor-average 0.5 maps to mood -100. Additionally:
- When memories are empty (weight 40 total), the effective ceiling is mood +20 even with perfect stats.
- `goalProgress` defaults to 0 for unemployed agents (permanent -2 raw mood penalty).
- Bootstrap mood in `agent-actor.ts` uses hardcoded 0s for wallet/equipment.

All agents are permanently "distressed" (-26 to -34) despite moderate needs.

### Design

**Recenter formula + exclude empty weights + fix defaults**.

1. **`mood.ts` — `calculateMood()`** — Replace formula:
   ```
   Before: rawMood = ((positivePart - negativePart) / totalWeight) * 200 - 100
   After:  rawMood = ((positivePart - negativePart) / totalWeight - 0.5) * 200
   ```
   Factor-average 0.5 now maps to mood 0 ("neutral"). Scale is still -100 to +100.

2. **`mood.ts` — `calculateMood()`** — The `totalWeight` computation lives in `mood.ts`, not `mood-system.ts`. When the incoming `positiveMemories === 0 && negativeMemories === 0`, exclude both memory weights from `totalWeight`. Once any memory exists, full weights apply. This prevents the empty-memory drag at simulation start.

3. **`mood-system.ts`** — Default `goalProgress = 0.5` (not 0) when `entity.job === null`. No goal is neutral, not actively negative.

4. **`agent-actor.ts`** — Bootstrap mood using actual `walletHealth` (gold / 100 clamped) and `equipmentCondition` from the agent's starting state, not hardcoded 0s.

5. **Tests** — Update `mood.test.ts` and `mood-system.test.ts` expected values to match the new formula.

### Files

- `src/domain/systems/mood.ts` — formula change + empty weight exclusion (totalWeight lives here)
- `src/infrastructure/systems/mood-system.ts` — goalProgress default
- `src/infrastructure/entity/agent-actor.ts` — bootstrap values
- `tests/domain/systems/mood.test.ts` — updated expectations
- `tests/infrastructure/systems/mood-system.test.ts` — updated expectations

---

## Fix 3: BT Night-Rest Priority

### Problem

P4 hunger branch has a `HasJob → SeekWork` fallback with no time-of-day guard. Hungry agents seek work at midnight instead of falling through to P6 sleep.

### Design

Add `IsWorkHours` condition to the P4 hunger fallback's `HasJob → SeekWork` sequence in `base.mdsl`:

```
sequence {
    condition [HasJob]
    condition [IsWorkHours]   ← add this
    action [SeekWork]
}
```

Single line addition. `IsWorkHours` already exists in `bt-conditions.ts`. At night, the sequence fails at `IsWorkHours`, the P4 selector continues, and eventually P6 `ShouldSleep` fires.

### Files

- `behavior-trees/base.mdsl` — add `IsWorkHours` guard

---

## Fix 4: Outdoor Rest Penalty During Travel

### Problem

`seek_rest` is in the `isResting` whitelist in `rest-system.ts`. Agents get outdoor-tier energy recovery (1.0/tick) every tick while walking to a shelter. Note: the `moodEffect` returned by `applyRest()` is currently dead code — `rest-system.ts` reads `result.newEnergy` but never applies `result.moodEffect`. The real problem is premature energy recovery during transit, not a mood penalty.

### Design

Remove `seek_rest` from the `isResting` check in `resolveRestTier()`. Only `rest`, `idle`, and `null` trigger rest recovery. Agents in transit don't recover or accumulate outdoor mood penalties — they just walk. Recovery begins when they arrive and `btAction` becomes `rest`.

### Files

- `src/infrastructure/systems/rest-system.ts` — `resolveRestTier` isResting check
- `tests/infrastructure/systems/rest-system.test.ts` — update expectations

---

## Fix 5: Social Decay Config

### Problem

`social_decay` defaults to `0` in the schema (`game-config-schema.ts`). The running config (`game-config.json`) already overrides this to `0.02`, so social need does decay — but very slowly. The schema default is misleading for anyone starting from a bare config.

### Design

Two changes:
1. **`game-config-schema.ts`** — Change schema default for `social_decay` from `0` to `0.05` so bare configs get reasonable behavior.
2. **`game-config.json`** — Bump `social_decay` from `0.02` to `0.05` for slightly more meaningful social pressure.

### Files

- `src/domain/schemas/game-config-schema.ts` — change schema default
- `configs/game-config.json` — bump `social_decay` to `0.05`

---

## Fix 6: Mortality Default

### Problem

`mortality` defaults to `true` in the schema but no mortality system exists. The `SystemPriority.MORTALITY_CHECK` slot is defined but nothing is registered there. Config readers would expect mortality to be active — it silently isn't. Mortality was deferred indefinitely on 2026-04-05.

### Design

Change `mortality` default from `true` to `false` in `GameConfigSchema`.

### Files

- `src/domain/schemas/game-config-schema.ts` — change default

---

## Expected Outcome

After all 6 fixes:

| Metric | Before | After |
|---|---|---|
| Facility workers | 0/3 registered | 3/3 reserved |
| Food production | None (idle farms) | Active (settler → farmland → market) |
| Agent mood (typical) | -26 to -34 (distressed) | 0 to +20 (neutral to content) |
| Night behavior | Seek work when hungry | Sleep, eat available food |
| Travel rest penalty | Premature energy recovery while walking | Recovery only at destination |
| Social need | Frozen at initial value | Slow decay, recoverable via interaction |
| Mortality config | true (misleading) | false (accurate) |

The simulation sustains itself day-over-day: agents work, produce, trade, rest, and their mood reflects their actual state.

---

## Dependencies

Fixes are ordered by dependency:

1. **Fix 1** (worker reservation) — standalone, enables food production
2. **Fix 2** (mood formula) — standalone, independent of Fix 1
3. **Fix 3** (BT night guard) — standalone, single line in MDSL
4. **Fix 4** (rest travel penalty) — standalone
5. **Fix 5** (social decay) — standalone, config-only
6. **Fix 6** (mortality default) — standalone, schema-only

No fix depends on another. All 6 can be implemented in any order. Fixes 5 and 6 are one-line changes.
