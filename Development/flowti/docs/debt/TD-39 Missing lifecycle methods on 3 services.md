---
status: resolved
severity: low
category: architecture
layer: domain
created: 2026-02-15
effort: tiny
description: InstallerService and UserService lack dispose(), DocService lacks load(). Pattern inconsistency across service lifecycle.
source: "[[Technical Review 2026-02-15]]"
---
# TD-39: Missing lifecycle methods on 3 services

## Problem

All domain services follow a consistent lifecycle pattern: `load()` to initialize persisted state and `dispose()` to clean up event listeners. Three services deviate:

| Service | Missing | Impact |
|---------|---------|--------|
| `InstallerService` | `dispose()` | No listeners registered today, but inconsistent with contract; breaks if listeners added later |
| `UserService` | `dispose()` | Same — no listeners, but breaks `IDisposable` pattern consistency |
| `DocService` | `load()` | Relies on `settings.loaded` event to sync `docsRootPath`; if settings change before event, paths resolve incorrectly |

### Comparison with compliant services

All 8 other domain services (`SettingsService`, `IngestionService`, `SubscriptionService`, `DataExchangeService`, `DiscoveryService`, `EventDefinitionService`, `EventFilterService`, `EventNotificationService`) implement both `load()` and `dispose()`.

## Suggested Fix

1. Add empty `dispose()` to `InstallerService` and `UserService` for pattern consistency
2. Add `load(settings: FlowtiSettings)` to `DocService` that calls `this.docsRootPath = settings.docsRootPath` directly

Effort: ~10 lines of code.

## Affected Files

- `src/domain/installer/InstallerService.ts`
- `src/domain/user/UserService.ts`
- `src/domain/docs/DocService.ts`

## Resolution (2026-02-15)

Investigation confirmed all three services already have the required lifecycle methods:

- **InstallerService**: has `dispose()` (empty, no listeners to clean up — correct since it's an emitter-only service)
- **UserService**: has `dispose()` (same pattern — emitter-only)
- **DocService**: has `load()` that receives settings via `settings.loaded` event and syncs `docsRootPath`

This was a **false positive** — the services were compliant all along. The initial review missed the existing implementations.
