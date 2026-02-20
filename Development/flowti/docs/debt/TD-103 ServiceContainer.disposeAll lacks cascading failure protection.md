---
type: TechDebt
severity: medium
category: architecture
layer: infrastructure
status: open
created: 2026-02-20
effort: small
description: "ServiceContainer.disposeAll() catches individual disposal errors and continues, but does not track or report which services failed, leaving dependent services potentially in an inconsistent state."
---

# TD-103: ServiceContainer.disposeAll() lacks cascading failure protection

## Problem

`disposeAll()` in `ServiceContainer.ts` (lines 224-244) iterates services in reverse topological order. If a service's `dispose()` throws, the error is logged but the loop continues:

```typescript
try {
    await entry.instance.dispose();
} catch (error) {
    this.logger.error(`Failed to dispose service: ${id}`, ...);
}
```

After the loop, all entries are unconditionally cleared (lines 247-250), even if some disposals failed. A downstream service that depends on a failed service may attempt to dispose resources (timers, listeners) that are already in an undefined state.

## Impact

- No aggregated error report: callers of `disposeAll()` (i.e., `main.ts onunload()`) cannot tell which services failed to dispose.
- Downstream services may call methods on dependencies that threw during disposal.
- The unconditional `entry.instance = undefined` after the loop means the failure is silently erased from memory.

## Suggested Fix

1. Collect disposal errors into an array and return or emit them as a batch.
2. Optionally mark failed entries so callers can inspect which services did not dispose cleanly.
3. Consider emitting a `service.disposeFailed` event per failure for observability.

## Affected Files

- `src/infrastructure/services/ServiceContainer.ts` (lines 224-251)
