# Dynamic Job Claiming — Design Spec

> Date: 2026-04-02 | Status: Approved

---

## Problem

All 4 agents have hardcoded jobs in their JSON files. No agent has `job: "baker"`, so the bakery relies on slow auto-process. Marcus has `job: "guard"` but no guard facility exists — the world validation already warns about this. There is no mechanism for agents to claim open positions at unstaffed facilities.

## Solution

Add BT-level job claiming: unemployed agents perceive unstaffed facilities and claim the position. No new system needed — just new conditions, an action, and a BT node.

Additionally, remove Marcus's useless guard job so he becomes unemployed and can naturally claim an open facility (likely the bakery).

### New Interface Members

**On `PerceivedFacility` (behavior-agent.ts):**

Add `workerId: string | null` — exposes whether the facility currently has a worker assigned. The `resolveNearbyFacilities()` helper in the factory already reads `FacilityComponent`; it just needs to include `workerId` from `facility.state.workerId`.

**On `BehaviorAgent` interface:**

- `HasNoJob(): boolean` — condition, returns `agent.job === null`
- `OpenFacilityNearby(): boolean` — condition, returns true if any `nearbyFacilities` entry has `workerId === null` and a production job defined
- `ClaimJob(): ActionResult` — action, finds nearest open facility, sets `agent.job` to match facility's production job, returns SUCCEEDED or FAILED

### BT Change (base.mdsl)

Insert new P6 before the existing Wander fallback (which becomes P7):

```
/* P6: Claim a job if unemployed and facility available */
sequence {
    condition [IsWorkHours]
    condition [HasNoJob]
    condition [OpenFacilityNearby]
    action [ClaimJob]
}

/* P7: Fallback */
action [Wander]
```

Job-claiming only fires when:
1. It's work hours (dawn or day)
2. Agent has no job
3. An unstaffed facility is within perception range

This is the lowest priority after social and night rest — agents don't abandon other behaviors to job-hunt.

### ClaimJob Behavior

1. Filter `nearbyFacilities` for entries where `workerId === null`
2. Pick the nearest one (by distance)
3. Set `agent.job` on the AgentActor to match the facility's `production.job`
4. Set `btAction = 'claim_job'`
5. Return SUCCEEDED

On the next BT tick: `HasJob()` is now true, so P1 (role branch) fires. The scholar/artisan branch evaluates `SeekWork` which navigates to the facility. `Work` starts production. FacilitySystem detects the worker by proximity + job match + `btAction === 'work'`.

### Agent Data Change

`agents/marcus.json`: Change `"job": "guard"` to `"job": null`. Marcus becomes unemployed at startup and will claim the first open facility he wanders near (likely the bakery, since it has no worker and is in the market area).

### What Doesn't Change

- FacilitySystem worker detection (already checks proximity + job match + btAction)
- Role branches (scholar/artisan already have SeekWork → Work)
- TradeSystem, EconomySystem, MonetaryPolicySystem
- No new infrastructure system needed

### Emergence Behavior

With Marcus unemployed:
1. Tick 1: Marcus wanders (P7, no job)
2. Eventually Marcus wanders near the bakery
3. `OpenFacilityNearby` returns true → `ClaimJob` fires → Marcus gets `job: "baker"`
4. Next tick: P1 fires → scholar branch → SeekWork → navigates to bakery
5. At bakery: Work fires → FacilitySystem detects worker → bread production begins (20 ticks/cycle with worker vs 40 auto-process)
6. Wages paid → GoldFlowed → velocity rises

### Interface Counts After Change

- Conditions: 21 → 23 (add HasNoJob, OpenFacilityNearby)
- Actions: 17 → 18 (add ClaimJob)

### Files Changed

| File | Change |
|------|--------|
| `src/domain/systems/behavior-agent.ts` | Add `workerId` to PerceivedFacility, add HasNoJob, OpenFacilityNearby, ClaimJob to interface |
| `src/infrastructure/entity/behavior-agent-factory.ts` | Implement all three + add workerId to resolveNearbyFacilities |
| `behavior-trees/base.mdsl` | Add P6 job-claiming sequence |
| `agents/marcus.json` | Set job to null |
| `docs/2026-03-28-arc42-architecture.md` | Update condition/action counts |
