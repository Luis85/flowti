---
type: TechDebt
severity: high
category: memory-leak
layer: domain
status: resolved
effort: small
resolved: 2026-02-14
description: IngestionService manages a batch timer for flush operations but does not clear it if the service is disposed while a flush is pending. The timer callback will fire against a disposed service.
---
# TD-10: IngestionService batch timer leak on dispose

## Problem

`IngestionService` sets a `batchTimer` via `setTimeout` for batch flush operations. If `dispose()` is called (or the plugin unloads) while the timer is pending, it fires after the service is logically dead.

The service does not implement `IDisposable` and has no `dispose()` method.

## Impact

- Timer callback accesses disposed service state
- Potential errors in the console during plugin unload
- State could be written to storage after the plugin has released resources

## Suggested Remediation

1. Implement `IDisposable` on `IngestionService`
2. In `dispose()`: clear `batchTimer`, unsubscribe all event listeners, flush pending jobs
3. Guard timer callbacks: check a `disposed` flag before proceeding

## Affected Files

- `src/domain/ingestion/IngestionService.ts`

## Resolution (2026-02-14)

`IngestionService` now implements `IDisposable` with a `dispose()` method (lines 391-400) that clears `batchTimer` via `clearTimeout` and calls all stored unsubscribe functions. Called via `ServiceContainer.disposeAll()` on plugin unload.
