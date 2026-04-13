# Recording Diagnostics Enhancement — Design Spec

> **Goal:** Add transition-based diagnostic events to the JSONL recording system so BT preemption, commitment lifecycle, trade failures, and need threshold crossings are visible without per-tick tracing or source-code DebugNote instrumentation.

**Context:** Debugging agent behavior from recordings currently requires cross-referencing thousands of `BtEvaluated` events to infer why agents fail to buy water, get stuck in commitments, or have their actions preempted. Five recordings and hours of manual trace analysis were needed to identify that `seek_well` was being preempted by higher-priority commitments 100% of the time.

**Approach:** Emit events only on state *transitions*, not every tick. This captures the meaningful moments (action changed, commitment broke, need crossed threshold) with ~1% overhead on recording size.

---

## 1. New Events

### 1.1 ActionChanged

**Emitted by:** `behavior-tree-system.ts`
**Fires when:** `btAction` after `step()` differs from the previous tick's value for the same agent.
**Payload:**
```typescript
{
  agentId: string;
  previousAction: string | null;
  newAction: string | null;
  preempted: boolean;        // true when previousAction was non-null and newAction differs (non-null)
  committedAction: string | null;
  commitmentTicks: number;
}
```
The `preempted` flag replaces the separate `BtBranchPreempted` event — it's a strict subset of `ActionChanged`.

**Volume:** ~50/day/agent (includes preemptions).

### 1.2 CommitmentChanged

**Emitted by:** `bt-action-helpers.ts` (`beginAction`) and `bt-actions.ts` (`ContinueCommitment`).
**Fires when:** A commitment is created, expires (timer hits 0), or is broken early.
**Payload:**
```typescript
{
  agentId: string;
  event: 'created' | 'expired' | 'broken';
  action: string;
  reason?: string;       // populated on break/expire: 'critical_need' | 'need_satisfied' | 'higher_priority' | 'timer_expired'
  ticksRemaining: number;
}
```
**Volume:** ~30/day/agent.

### 1.3 NeedThresholdCrossed

**Emitted by:** `needs-decay-system.ts`
**Fires when:** A need's value crosses the agent's personal threshold or the critical threshold (in either direction).
**Payload:**
```typescript
{
  agentId: string;
  need: string;
  value: number;
  threshold: number;
  thresholdType: 'personal' | 'critical';
  direction: 'below' | 'above';
}
```
**Volume:** ~10/day/agent.

### 1.4 TradeAttempted

**Emitted by:** `trade-system.ts`
**Fires when:** The TradeSystem evaluates an agent with a pending buy (either `btAction === 'buy'` or `buyTargetItem !== null`).
**Payload:**
```typescript
{
  agentId: string;
  item: string;
  result: 'purchased' | 'no_facility' | 'insufficient_gold';
  amount?: number;
  facilityId?: string;
}
```
**Volume:** ~5/day/agent.

---

## 2. Implementation

### 2.1 behavior-tree-system.ts

Add a `Map<string, string | null>` to track previous btAction per agent. After `step()`:

1. Compare current `btAction` with previous. If different, emit `ActionChanged` with `preempted: previous !== null && current !== null && previous !== current`.
2. Store current as previous.
3. **Cleanup:** Rebuild the Map keys from the current agent list each tick to avoid leaking entries for removed agents.

**BtEvaluated throttling:** Only emit `BtEvaluated` when the leaf node name changes from the previous tick (same Map approach, track previous leaf). This cuts ~90% of BtEvaluated volume.

### 2.2 bt-action-helpers.ts

In `beginAction`: when a new commitment is created (`commitmentTicks > 0` after assignment), emit `CommitmentChanged` with `event: 'created'`. Requires passing `eventBus` through the `ActionContext` (already available via `ctx.deps.eventBus`).

When an existing commitment is cleared because a different action takes over (`commitmentTicks > 0 && committedAction !== actionName`), emit `CommitmentChanged` with `event: 'broken'` and `reason: 'higher_priority'`.

### 2.3 bt-actions.ts — ContinueCommitment

Refactor `breakCommitment()` to accept a `reason` parameter and emit `CommitmentChanged` internally. The closure already has access to `ctx.deps.eventBus` and `ctx.deps.tickCount()` via `createActions`'s scope. Each call site passes the reason:
- Timer expires (`commitmentTicks <= 0`): `breakCommitment('timer_expired')`
- Critical need break: `breakCommitment('critical_need')`
- Need satisfied break (eat/drink/rest/buy): `breakCommitment('need_satisfied')`
- Travel break: `breakCommitment('critical_need')`

### 2.4 needs-decay-system.ts

**Important:** Snapshot old need values BEFORE applying `applyNeedsDecay` result (the assignment on line 93 overwrites them). After computing new need values, check each need against:
- `personalThresholds[need]` (from WorkingMemory)
- `NEED_CRITICAL_THRESHOLDS[need]` (from ranges.ts)

If `oldValue >= threshold && newValue < threshold`, emit with `direction: 'below'`.
If `oldValue < threshold && newValue >= threshold`, emit with `direction: 'above'`.

### 2.5 trade-system.ts

Replace the early `continue` when no pending buy with an emit. For each agent processed:
- If no pending buy: skip (no event — too noisy).
- If pending buy but `findNearestFacilityWithItem` returns undefined: emit `result: 'no_facility'`.
- If trade fails due to gold: emit `result: 'insufficient_gold'`.
- If trade succeeds: emit `result: 'purchased'`.

Remove the temporary `BuyItem` DebugNote added during debugging.

### 2.6 No recorder changes

The recorder already captures all `eventBus.emit()` calls via `onAny()`. New events flow through automatically.

---

## 3. Cleanup

- Remove the temporary `DebugNote` instrumentation from `BuyItem` in `bt-actions-economy.ts`.
- Remove the `DebugNote` emitters from `SeekService` and `UseService` in `bt-actions-service.ts` — `CommitmentChanged` and `TradeAttempted` cover their diagnostic purpose.

---

## 4. Size Impact

For a 30-day, 3-agent recording:

| Category | Before | After |
|----------|--------|-------|
| Snapshots | ~120 | ~120 |
| BtEvaluated | ~43,200 | ~4,300 |
| NeedChanged | ~170,000 | ~170,000 |
| New transition events | 0 | ~2,850 |
| Other events | ~30,000 | ~30,000 |
| **Total** | **~243,000** | **~208,000** |

Net ~15% reduction despite new events, due to BtEvaluated throttling.

---

## 5. Test Strategy

- **ActionChanged (+ preempted flag):** Unit test in `behavior-tree-system.test.ts` — mock two agents, verify events emit on action change; verify `preempted: true` when both old and new actions are non-null.
- **CommitmentChanged:** Unit tests in `bt-actions.test.ts` — verify created/expired/broken events with correct reasons.
- **NeedThresholdCrossed:** Unit test in `needs-decay-system.test.ts` — verify crossing personal and critical thresholds in both directions.
- **TradeAttempted:** Unit test in `trade-system.test.ts` — verify all 3 failure reasons and the success case.
- **BtEvaluated throttle:** Existing tests updated to expect fewer emissions.

---

## 6. Files Modified

| File | Change |
|------|--------|
| `src/infrastructure/systems/behavior-tree-system.ts` | ActionChanged (with preempted flag), BtEvaluated throttle |
| `src/infrastructure/entity/bt-action-helpers.ts` | CommitmentChanged on create/higher_priority |
| `src/infrastructure/entity/bt-actions.ts` | CommitmentChanged on expire/break in ContinueCommitment |
| `src/infrastructure/systems/needs-decay-system.ts` | NeedThresholdCrossed |
| `src/infrastructure/systems/trade-system.ts` | TradeAttempted |
| `src/infrastructure/entity/bt-actions-economy.ts` | Remove BuyItem DebugNote |
| `src/infrastructure/entity/bt-actions-service.ts` | Remove SeekService/UseService DebugNotes |
| Tests for each modified system | New test cases for new events |
