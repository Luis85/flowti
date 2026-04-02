# BT Work Priority Reorder — Design Spec

> Date: 2026-04-02 | Status: Implemented

---

## Problem

Agents never reach their role behavior (P3) because non-critical hunger (P1) and energy (P2) pre-empt it. The economy deadlocks: no one works, no food is produced, agents burn through starting supplies and get stuck in survival loops.

Additionally, P3 is gated by `IsDaytime()` which only matches the `'day'` phase — agents idle during dawn when they could be working.

## Solution

Reorder base.mdsl priorities so role behavior executes before non-critical needs. Add `IsWorkHours()` condition that covers dawn + day (everything except dusk + night).

### Priority Order

| Priority | Before | After |
|----------|--------|-------|
| P0 | Critical survival (`NeedsCritical`) | Critical survival (`NeedsCritical`) — unchanged |
| P1 | Hunger (`IsHungry`) | **Role behavior (`IsWorkHours`)** |
| P2 | Energy (`IsExhausted`) | Hunger (`IsHungry`) — demoted |
| P3 | Role behavior (`IsDaytime`) | Energy (`IsExhausted`) — demoted |
| P4-P6 | Social, night, wander | Social, night, wander — unchanged |

### New Condition: `IsWorkHours()`

Returns true when `timePhase` is `'dawn'` or `'day'`. Returns false for `'dusk'` and `'night'`.

This replaces `IsDaytime()` in the role behavior gate. `IsDaytime()` remains available for other uses (role branches reference it via `while(IsDaytime)` guards).

### Bootstrap Sequence After Fix

1. **Tick 1 (dawn)**: `IsWorkHours` = true. Wren's scholar branch fires: `SeekWork` → walks to farm
2. **Tick ~5**: Wren at farm. `Work while(IsDaytime)` — wait, this uses IsDaytime. Need to update role branches too.

**Correction**: The `while(IsDaytime)` guard in artisan/scholar branches also needs updating to `while(IsWorkHours)` — otherwise Work stops at dawn even though the agent reached the facility.

### Files Changed

- `behavior-trees/base.mdsl` — reorder priorities, `IsDaytime` → `IsWorkHours` in P1 gate
- `behavior-trees/branch-artisan.mdsl` — `while(IsDaytime)` → `while(IsWorkHours)`
- `behavior-trees/branch-scholar.mdsl` — `while(IsDaytime)` → `while(IsWorkHours)`
- `behavior-trees/branch-guard.mdsl` — `while(IsDaytime)` → `while(IsWorkHours)` (if applicable)
- `src/domain/systems/behavior-agent.ts` — add `IsWorkHours(): boolean` to interface
- `src/infrastructure/entity/behavior-agent-factory.ts` — implement `IsWorkHours()`
