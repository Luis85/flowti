---
severity: high
category: memory-leak
layer: domain
status: resolved
effort: small
resolved: 2026-02-14
description: SettingsService registers event listeners in its constructor/initialize but does not store unsubscribe handles and has no dispose() method. Listeners persist for the plugin lifetime and accumulate on hot-reload.
---
# TD-14: SettingsService event listeners leak

## Problem

`SettingsService` registers listeners in `initialize()`:

```typescript
this.eventBus.on("settings.changed", (event) => { ... });
```

The return value (unsubscribe function) is discarded. The service has no `dispose()` method.

## Impact

- On hot-reload during development, each reload adds a new listener without removing the old one
- After N reloads, N copies of the handler fire for each `settings.changed` event
- The handler modifies service state, so stale handlers may conflict with the current instance

## Suggested Remediation

1. Store the unsubscribe return value: `this.unsubscribers.push(this.eventBus.on(...))`
2. Implement `IDisposable` with a `dispose()` method that calls all unsubscribers
3. This is part of the broader TD-02 pattern

## Affected Files

- `src/domain/settings/SettingsService.ts`

## Resolution (2026-02-14)

`SettingsService` now stores unsubscribe functions from all `eventBus.on()` calls and implements `IDisposable` with a `dispose()` method that calls all unsubscribers. Part of the broader TD-02 resolution.
