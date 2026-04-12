# Cycle 1: Fix What's Broken — Design Spec

**Date:** 2026-04-12
**Status:** Approved
**Scope:** 5 targeted fixes from the architecture review. 3 code fixes + 2 documentation updates. All independent — no ordering dependencies.

---

## Fix 1: Service visit gold sink

### Problem

`bt-actions-service.ts:95-98` deducts `cost_per_visit` from agent wallet but never credits it anywhere. Gold evaporates. Service facilities earn no revenue from customers, making them permanently dependent on subsidies. The monetary policy velocity calculation also undercounts because no `GoldFlowed` event is emitted.

### Fix

In `UseService()`, after deducting `cost_per_visit` from the agent's wallet, credit the same amount to the facility's fund and emit a `GoldFlowed` event.

```typescript
// After wallet deduction (existing code at line 95-98):
if (ft.cost_per_visit > 0) {
    wallet.state = { ...wallet.state, gold: wallet.state.gold - ft.cost_per_visit };
    wallet.markDirty();

    // NEW: credit the facility fund
    const locationActorMap = ctx.deps.getLocationActors();
    const locActor = locationActorMap.get(targetId);
    if (locActor !== undefined) {
        const facility = locActor.get(FacilityComponent);
        facility.state = { ...facility.state, fund: facility.state.fund + ft.cost_per_visit };
        facility.markDirty();
    }

    // NEW: emit GoldFlowed for velocity tracking
    ctx.deps.eventBus.emit({
        type: 'GoldFlowed',
        tick: ctx.deps.tickCount(),
        wallClock: Date.now(),
        source: 'UseService',
        payload: {
            category: 'transfer',
            subcategory: 'service_fee',
            amount: ft.cost_per_visit,
            fromEntity: ctx.actor.agentId,
            toEntity: targetId,
        },
    });
}
```

### Files modified

- `src/infrastructure/entity/bt-actions-service.ts` — add fund credit + event emission in `UseService`

### Test

- Existing `bt-actions-service.test.ts`: add test case "UseService credits cost_per_visit to facility fund"
- Verify `GoldFlowed` event is emitted with correct payload

---

## Fix 2: nearbyAgents position always {0,0}

### Problem

`behavior-agent-factory.ts:125` in `resolveNearbyAgents()` returns `position: { x: 0, y: 0 }` for all perceived agents. Any BT condition or system using perceived agent positions gets incorrect data.

### Fix

Look up the actual agent from the agents list (available via the `agents()` getter already used by systems) and read `pos.x`/`pos.y`. The `resolveNearbyAgents` function is inside `createBehaviorAgent` which has access to the full agent list via the closure.

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

This requires adding `getAgents` to `BehaviorAgentDeps`. It's already available in `game-view.ts` as the `getAgents` closure — just needs wiring.

### Files modified

- `src/infrastructure/entity/behavior-agent-factory.ts` — fix `resolveNearbyAgents`, add `getAgents` to `BehaviorAgentDeps`
- `src/infrastructure/engine/game-view.ts` — pass `getAgents` when constructing `BehaviorAgentDeps`

### Test

- Existing `behavior-agent-factory.test.ts`: update or add test verifying `nearbyAgents[i].position` reflects actual agent position

---

## Fix 3: Work commitment critical-needs break

### Problem

Work commitment is 30 ticks. Work activity costs 2.5 hunger + 2.0 thirst + 2.0 energy per tick. Starting at 100, after 30 ticks: hunger ~25, thirst ~40, energy ~40. Agents regularly hit critical needs before the BT can respond because the commitment window exceeds the safe needs window.

### Fix

In `ContinueCommitment` (`bt-actions.ts`), add a critical-needs break for the `work` action. This follows the same pattern already established for `use_service` in the C1 critical fix from the facility production review.

```typescript
// Inside ContinueCommitment, in the "should break?" section:
if (ca === 'work') {
    const needs = actor.get(NeedsComponent).state;
    if (needs.hunger < NEED_CRITICAL_THRESHOLDS.hunger
        || needs.thirst < NEED_CRITICAL_THRESHOLDS.thirst
        || needs.energy < NEED_CRITICAL_THRESHOLDS.energy) {
        memory.commitmentTicks = 0;
        memory.committedAction = null;
        return FAILED;
    }
}
```

`NEED_CRITICAL_THRESHOLDS` is already defined in `bt-conditions-survival.ts` and used by `NeedsCritical`. Import it in `bt-actions.ts`.

### Files modified

- `src/infrastructure/entity/bt-actions.ts` — add critical-needs break in `ContinueCommitment` for `work` action

### Test

- Existing `bt-actions.test.ts`: add test "ContinueCommitment breaks work when hunger/thirst/energy hits critical"

---

## Fix 4: GDD needs table + stale values

### Problem

GDD `Project Meridian.md` section 4.4 is stale: thirst missing from needs table, decay rates are 10x off from `game-config.json`, rest tier values don't match, tick interval references say 500ms instead of 100ms, and several config-present systems (sleep debt, recovery hysteresis) are undocumented.

### Fix

Update `Project Meridian.md`:

1. **Section 4.4 needs table**: add thirst row, update all decay rates to match config (hunger 0.04, energy 0.06, social 0.05, thirst 0.05)
2. **Section 4.4 rest tiers**: update recovery rates to 4.0/3.0/1.5
3. **Section 2.1 tick cycle**: change "1 tick = 500ms" to "1 tick = 100ms (configurable)"
4. **Section 9.2**: same tick interval fix
5. **Add documentation for**: `recovery_hysteresis` (energy must exceed threshold + hysteresis to clear recovering state), `sleep_debt_max`, `min_rest_ticks`

### Files modified

- `Project Meridian.md` — sections 2.1, 4.4, 9.2

---

## Fix 5: Arc42 updates

### Problem

Arc42 documents 18 active systems (actual: 28), contains a stale ADR-06 amendment about a custom BT evaluator that doesn't exist (mistreevous is used), and references 500ms/2Hz tick frequency (actual: 100ms/10Hz).

### Fix

Update `docs/2026-03-28-arc42-architecture.md`:

1. **System count**: update from 18 to 28. Add the missing systems to the pipeline diagram: AreaEffectSystem, ServiceSystem, QuestEvaluationSystem, QuestGenerationSystem, AbandonmentSystem, FacilityMaintenanceSystem, MonetaryPolicySystem, WelfareSystem, StipendSystem, SubsidySystem.
2. **ADR-06**: remove the stale amendment about custom BT evaluator. Add a note: "mistreevous 4.3.1 is the production BT engine. The custom evaluator described in an earlier amendment was never adopted."
3. **Tick frequency**: change all "2 Hz (500ms)" references to "10 Hz (100ms, configurable via `tick_interval_ms`)"

### Files modified

- `docs/2026-03-28-arc42-architecture.md` — sections referenced above

---

## Success criteria

| Fix | Verification |
|-----|-------------|
| 1 — Service gold | Recording shows non-zero facility fund growth at service facilities; `GoldFlowed` events with `subcategory: 'service_fee'` |
| 2 — Agent position | Test verifies `nearbyAgents[i].position` has real coordinates |
| 3 — Work break | Test verifies work commitment breaks on critical hunger/thirst/energy |
| 4 — GDD | Needs table has 4 rows (hunger, energy, social, thirst) with correct decay rates |
| 5 — Arc42 | System count says 28; no custom BT evaluator reference; tick says 100ms |
| All | Full test suite passes (1493+) |
