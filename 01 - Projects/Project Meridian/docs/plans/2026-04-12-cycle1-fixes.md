# Cycle 1: Fix What's Broken — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 3 runtime bugs (service gold sink, agent position, work energy drain) and update 2 stale documents (GDD, arc42).

**Architecture:** Independent fixes — each task produces a self-contained commit. Code fixes use existing patterns (GoldFlowed events, ContinueCommitment break guards, perception resolution). Doc fixes align written specs with actual config values and registered systems.

**Tech Stack:** TypeScript strict, Vitest, mistreevous 4.3.1, Obsidian plugin runtime.

**Spec:** `01 - Projects/Project Meridian/docs/specs/2026-04-12-cycle1-fixes-design.md`

**Test command:** `cd "01 - Projects/Project Meridian" && npx vitest run --config configs/vitest.config.ts`

**Single test:** `cd "01 - Projects/Project Meridian" && npx vitest run tests/<path> --config configs/vitest.config.ts`

**Typecheck:** `cd "01 - Projects/Project Meridian" && npx tsc --noEmit --project configs/tsconfig.json`

**Working directory:** All `cd` commands go to `01 - Projects/Project Meridian`. The git root is `c:\Projects\flowti`.

---

## File Structure

**Modified:**
- `src/infrastructure/entity/bt-actions-service.ts:94-98` — credit cost_per_visit to facility fund + emit GoldFlowed
- `tests/infrastructure/entity/bt-actions-service.test.ts` — add service fee test
- `src/infrastructure/entity/behavior-agent-factory.ts:24-39,123-130` — add getAgents to deps, fix resolveNearbyAgents position
- `src/infrastructure/engine/game-view.ts:263-276` — wire getAgents into BehaviorAgentDeps
- `tests/infrastructure/entity/behavior-agent-factory.test.ts` — update agent position test
- `src/infrastructure/entity/bt-actions.ts:183-191` — add energy check to work/repair break
- `tests/infrastructure/entity/bt-actions.test.ts` — add energy break test
- `Project Meridian.md` — sections 2.1, 4.4, 9.2
- `docs/2026-03-28-arc42-architecture.md` — system count, ADR-06, tick frequency

---

## Chunk 1: Code fixes (Tasks 1-3)

### Task 1: Fix service visit gold sink

**Files:**
- Modify: `src/infrastructure/entity/bt-actions-service.ts:94-98`
- Modify: `tests/infrastructure/entity/bt-actions-service.test.ts`

- [ ] **Step 1: Write failing test**

Add to `tests/infrastructure/entity/bt-actions-service.test.ts`, inside the `UseService` describe block:

```typescript
it('credits cost_per_visit to facility fund and emits GoldFlowed', () => {
    // Setup: agent at a service facility with cost_per_visit > 0
    // (reuse existing test setup pattern from the "deducts cost upfront" test)
    // After UseService() call:
    // - facility.state.fund should increase by cost_per_visit
    // - eventBus should have received a GoldFlowed event with subcategory 'service_fee'
});
```

The test should:
1. Create an agent with gold > cost_per_visit
2. Create a service facility with `cost_per_visit: 5` and initial `fund: 100`
3. Call `UseService()`
4. Assert `facility.state.fund === 105`
5. Assert eventBus received `{ type: 'GoldFlowed', payload: { subcategory: 'service_fee', amount: 5, fromEntity: agentId, toEntity: facilityId } }`

Use the existing test helpers and fixture patterns already in this test file.

- [ ] **Step 2: Run test — expect FAIL**

Run: `npx vitest run tests/infrastructure/entity/bt-actions-service.test.ts --config configs/vitest.config.ts`
Expected: new test FAILS — facility fund unchanged, no GoldFlowed event.

- [ ] **Step 3: Implement the fix**

In `src/infrastructure/entity/bt-actions-service.ts`, add the `FacilityComponent` import at the top:

```typescript
import { FacilityComponent } from '../components/facility-component.js';
```

Then expand the `cost_per_visit > 0` block (lines 95-98) to credit the facility and emit the event:

```typescript
if (ft.cost_per_visit > 0) {
    wallet.state = { ...wallet.state, gold: wallet.state.gold - ft.cost_per_visit };
    wallet.markDirty();

    // Credit the facility fund — service revenue
    const locationActorMap = ctx.deps.getLocationActors();
    const locActor = locationActorMap.get(targetId);
    if (locActor?.has(FacilityComponent) === true) {
        const facility = locActor.get(FacilityComponent);
        facility.state = { ...facility.state, fund: facility.state.fund + ft.cost_per_visit };
        facility.markDirty();
    }

    // Emit GoldFlowed for monetary policy velocity tracking
    ctx.deps.eventBus.emit({
        type: 'GoldFlowed',
        tick: ctx.deps.tickCount(),
        wallClock: Date.now(),
        source: 'UseService',
        payload: {
            category: 'transfer' as const,
            subcategory: 'service_fee',
            amount: ft.cost_per_visit,
            fromEntity: actor.agentId,
            toEntity: targetId,
        },
    });
}
```

- [ ] **Step 4: Run test — pass**

Run: `npx vitest run tests/infrastructure/entity/bt-actions-service.test.ts --config configs/vitest.config.ts`
Expected: all tests pass.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit --project configs/tsconfig.json`

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Project Meridian/src/infrastructure/entity/bt-actions-service.ts" \
       "01 - Projects/Project Meridian/tests/infrastructure/entity/bt-actions-service.test.ts"
git commit -m "fix(meridian): UseService credits cost_per_visit to facility fund + emits GoldFlowed"
```

---

### Task 2: Fix nearbyAgents position {0,0}

**Files:**
- Modify: `src/infrastructure/entity/behavior-agent-factory.ts:24-39,123-130`
- Modify: `src/infrastructure/engine/game-view.ts:263-276`
- Modify: `tests/infrastructure/entity/behavior-agent-factory.test.ts`

- [ ] **Step 1: Add `getAgents` to `BehaviorAgentDeps`**

In `src/infrastructure/entity/behavior-agent-factory.ts`, add to the `BehaviorAgentDeps` interface (after line 38):

```typescript
getAgents?: () => AgentActor[];
```

- [ ] **Step 2: Fix `resolveNearbyAgents` to use actual positions**

Replace lines 123-130:

```typescript
function resolveNearbyAgents(): PerceivedAgent[] {
    const perception = actor.get(PerceptionComponent);
    const allAgents = deps.getAgents?.() ?? [];
    return perception.state.nearbyAgents.map(a => {
        const agentActor = allAgents.find(ag => ag.agentId === a.id);
        return {
            id: a.id,
            position: agentActor !== undefined
                ? { x: agentActor.pos.x, y: agentActor.pos.y }
                : { x: 0, y: 0 },
            distance: a.distance,
        };
    });
}
```

- [ ] **Step 3: Wire `getAgents` in game-view.ts**

In `src/infrastructure/engine/game-view.ts`, find the `createBehaviorAgent` call (around line 263-276). Add `getAgents` to the deps object:

```typescript
getAgents: () => world.agents,
```

Add it alongside the existing `getLocations`, `getLocationActors`, etc.

- [ ] **Step 4: Run typecheck**

Run: `npx tsc --noEmit --project configs/tsconfig.json`
Expected: clean.

- [ ] **Step 5: Update or add test**

In `tests/infrastructure/entity/behavior-agent-factory.test.ts`, find or add a test that verifies nearby agent positions are resolved from actual actor positions, not hardcoded to {0,0}.

- [ ] **Step 6: Run tests**

Run: `npx vitest run --config configs/vitest.config.ts`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add "01 - Projects/Project Meridian/src/infrastructure/entity/behavior-agent-factory.ts" \
       "01 - Projects/Project Meridian/src/infrastructure/engine/game-view.ts" \
       "01 - Projects/Project Meridian/tests/infrastructure/entity/behavior-agent-factory.test.ts"
git commit -m "fix(meridian): resolveNearbyAgents returns actual agent positions instead of {0,0}"
```

---

### Task 3: Add energy check to work/repair commitment break

**Files:**
- Modify: `src/infrastructure/entity/bt-actions.ts:183-201`
- Modify: `tests/infrastructure/entity/bt-actions.test.ts`

- [ ] **Step 1: Write failing test**

Add to `tests/infrastructure/entity/bt-actions.test.ts`, inside the `ContinueCommitment` describe block:

```typescript
it('breaks work commitment when energy drops below personal threshold', () => {
    const actor = new AgentActor(
        createTestAgentData('a1', {
            needs: { hunger: 80, energy: 25, social: 70, thirst: 80 },
            inventory: [{ item_id: 'equipment', quantity: 1, charges: 20 }],
        }),
        defaultMoodConfig,
    );
    actor.get(NeedsComponent).state = { hunger: 80, energy: 25, social: 70, thirst: 80 };
    const { actions, memory } = setupActions(actor, { config });
    memory.commitmentTicks = 20;
    memory.committedAction = 'work';

    const result = actions.ContinueCommitment();
    expect(result).toBe('mistreevous.failed');
    expect(memory.commitmentTicks).toBe(0);
    expect(memory.committedAction).toBeNull();
});
```

Energy 25 is below the default `energy_threshold` of 30 (the personal threshold). The existing hunger/thirst checks use `personalThresholds` — energy should match.

- [ ] **Step 2: Run test — expect FAIL**

Run: `npx vitest run tests/infrastructure/entity/bt-actions.test.ts -t "breaks work commitment when energy" --config configs/vitest.config.ts`
Expected: FAIL — energy check not present, commitment continues.

- [ ] **Step 3: Implement the fix**

In `src/infrastructure/entity/bt-actions.ts`, in the `work || repair` block (after the thirst check at line 191, before the equipment check at line 192), add:

```typescript
if (needs.energy < memory.personalThresholds.energy) {
    breakCommitment();
    return FAILED;
}
```

The full block becomes:
```typescript
if (ca === 'work' || ca === 'repair') {
    if (needs.hunger < memory.personalThresholds.hunger) {
        breakCommitment();
        return FAILED;
    }
    if (needs.thirst < memory.personalThresholds.thirst) {
        breakCommitment();
        return FAILED;
    }
    if (needs.energy < memory.personalThresholds.energy) {
        breakCommitment();
        return FAILED;
    }
    const inv = actor.get(InventoryComponent).state.items;
    // ... equipment checks continue unchanged
```

- [ ] **Step 4: Run test — pass**

Run: `npx vitest run tests/infrastructure/entity/bt-actions.test.ts --config configs/vitest.config.ts`
Expected: all pass including the new test.

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Project Meridian/src/infrastructure/entity/bt-actions.ts" \
       "01 - Projects/Project Meridian/tests/infrastructure/entity/bt-actions.test.ts"
git commit -m "fix(meridian): ContinueCommitment breaks work when energy drops below threshold"
```

---

## Chunk 2: Documentation fixes (Tasks 4-5)

### Task 4: Update GDD needs table + stale values

**Files:**
- Modify: `Project Meridian.md` — sections 2.1, 4.4, 9.2

- [ ] **Step 1: Fix section 2.1 tick interval**

Find "1 tick ≈ 500ms" or "500ms" references in section 2.1 and replace with "1 tick = 100ms (configurable via `tick_interval_ms`)".

- [ ] **Step 2: Fix section 4.4 needs table**

Add thirst row. Update all decay values to match `game-config.json`:

| Need | Decay/tick (base) | Threshold | Critical | Recovery |
|------|-------------------|-----------|----------|----------|
| Hunger | 0.04 | 40 | 20 | 30 (per eat) |
| Energy | 0.06 | 30 | 15 | via rest tier |
| Social | 0.05 | 40 | 15 | 3.0 (per talk) |
| Thirst | 0.05 | 40 | 20 | 30 (per drink) |

- [ ] **Step 3: Update rest tier values**

Update section 4.4 rest tiers to match config: owned_home 4.0, public_shelter 3.0, outdoors 1.5.

- [ ] **Step 4: Add undocumented config mechanics**

Add brief documentation for:
- `recovery_hysteresis: 30` — energy must exceed `personalThreshold + 30` to clear recovering state (prevents oscillation)
- `sleep_debt_max: 100` — maximum accumulated sleep debt
- `min_rest_ticks: 50` — minimum ticks an agent should rest per day

- [ ] **Step 5: Fix section 9.2 tick reference**

Same 500ms → 100ms fix as section 2.1.

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Project Meridian/Project Meridian.md"
git commit -m "docs(meridian): GDD needs table adds thirst, fixes stale decay/tier values, documents sleep debt"
```

---

### Task 5: Update arc42

**Files:**
- Modify: `docs/2026-03-28-arc42-architecture.md`

- [ ] **Step 1: Update system count**

Find the "18 active" system count references and update to 28. Add the missing systems to any pipeline listing: AreaEffectSystem, ServiceSystem, QuestEvaluationSystem, QuestGenerationSystem, AbandonmentSystem, FacilityMaintenanceSystem, MonetaryPolicySystem, WelfareSystem, StipendSystem, SubsidySystem.

- [ ] **Step 2: Fix ADR-06**

Find the ADR-06 amendment about "Custom pure-function BT evaluator." Replace or annotate with: "Superseded: mistreevous 4.3.1 is the production BT engine. The custom evaluator described here was explored but never adopted."

- [ ] **Step 3: Fix tick frequency**

Find all "2 Hz (500ms)" references and replace with "10 Hz (100ms, configurable via `tick_interval_ms`)".

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Project Meridian/docs/2026-03-28-arc42-architecture.md"
git commit -m "docs(meridian): arc42 system count 18→28, fix stale ADR-06 + tick frequency"
```

---

### Task 6: Full verification + deploy

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run --config configs/vitest.config.ts`
Expected: 1493+ tests passing, 0 failures.

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit --project configs/tsconfig.json && npx eslint src/ --config configs/eslint.config.mjs`
Expected: 0 errors.

---

## Completion

After all tasks land and tests pass, rebuild the plugin and run a recording session. Verify:
- Service facility funds grow when agents visit (GoldFlowed service_fee events)
- Agents break work to eat/drink/rest before needs hit critical
- No `{0,0}` position anomalies in agent perception
- GDD and arc42 match actual config values
