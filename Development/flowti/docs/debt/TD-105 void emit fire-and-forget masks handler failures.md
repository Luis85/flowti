---
type: TechDebt
severity: medium
category: error-handling
layer: cross-cutting
status: open
created: 2026-02-20
effort: medium
description: "Widespread use of void this.eventBus.emit() across all layers suppresses unhandled promise rejections. If an event handler throws, the error is silently lost."
---

# TD-105: `void emit()` fire-and-forget masks handler failures

## Problem

The codebase uses `void this.eventBus.emit(...)` extensively to intentionally fire-and-forget event emissions. This pattern appears in 60+ locations across all layers:

- **Infrastructure**: `ServiceContainer.ts` (lines 97, 151, 171, 236), `CommandRegistry.ts` (lines 86, 140, 161, 181), `ViewRegistry.ts`, `ErrorService.ts`
- **Domain**: `SessionService.ts` (~20 occurrences), `IngestionService.ts`, `DataExchangeService.ts`, `NudgeService.ts`
- **UI**: `BaseHubView.ts`, `ImportsTab.ts`, `ExportsTab.ts`

The `void` keyword explicitly discards the returned promise. If any subscriber registered via `eventBus.on()` throws or rejects, the error is not caught by the emitter.

## Impact

- Handler errors are silently swallowed. No logging, no error event, no stack trace.
- Transient bugs in event subscribers (e.g., a null reference in a UI listener) become invisible.
- Contradicts the project's ErrorService architecture which expects errors to flow through a centralized handler.
- Debugging production issues becomes significantly harder when event handlers fail silently.

## Suggested Fix

1. Add a global error handler in `EventBus.emit()` that wraps subscriber invocations in a try-catch and routes failures through `ErrorService`:

```typescript
async emit(type, payload) {
    for (const handler of this.handlers) {
        try {
            await handler({ type, payload });
        } catch (err) {
            this.errorHandler?.(err, type); // route to ErrorService
        }
    }
}
```

2. This preserves the fire-and-forget ergonomics while making failures observable.
3. The `void` usage can remain — the fix is at the EventBus level, not at each call site.

## Related

- [[TD-35 Fire-and-forget persistence risk]] (specific to storage writes)
- [[TD-29 Error handling inconsistency]] (broader error handling theme)

## Affected Files

- `src/infrastructure/events/EventBus.ts` (root cause — no error boundary in emit)
- 60+ files across all layers (call sites)
