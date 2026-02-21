---
type: TechDebt
severity: low
category: race-condition
layer: domain
status: resolved
created: 2026-02-20
updated: 2026-02-21
effort: small
resolved_in: "Cycle 10 Inc 4"
description: "NudgeService.evaluate() now emits nudge.triggered before persisting dismiss state. If the handler fails, the nudge is not consumed and will re-trigger on the next evaluation cycle."
---

# TD-108: NudgeService persists dismiss before emitting trigger event

## Problem

In `NudgeService.evaluate()` (lines 118-121), the dismiss state is persisted before the trigger event is emitted:

```typescript
// Auto-dismiss after triggering (prevents re-trigger same minute)
this.state.dismissedToday.push(config.id);
await this.saveState();
await this.eventBus?.emit("nudge.triggered", { config: { ...config } });
```

If `nudge.triggered` handler throws or the EventBus is unavailable, the nudge is already marked as dismissed for the day. The user will not see the nudge until midnight rollover.

## Impact

- If the UI handler for `nudge.triggered` fails (e.g., modal creation throws), the nudge is consumed but never shown.
- The "auto-dismiss prevents re-trigger same minute" comment explains the intent, but the side effect is that handler failures are permanent for the day.
- Low severity because nudges are non-critical features, but the pattern contradicts event-driven reliability.

## Suggested Fix

Emit first, then persist. If the emit fails, don't mark as dismissed:

```typescript
try {
    await this.eventBus?.emit("nudge.triggered", { config: { ...config } });
    this.state.dismissedToday.push(config.id);
    await this.saveState();
} catch {
    // Don't dismiss — let it re-trigger next cycle
}
```

To prevent rapid re-triggering within the same minute, use a transient in-memory set that is not persisted.

## Affected Files

- `src/domain/nudge/NudgeService.ts` (lines 112-122)
