---
type: TechDebt
severity: critical
category: memory-leak
layer: domain
status: resolved
effort: medium
resolved: 2026-02-14
description: Most domain services register EventBus listeners during initialize() but lack a dispose() method. References accumulate across hot-reloads during development and are only cleared implicitly by EventBus.clear() on plugin unload.
---
# TD-02: Missing dispose() on domain services

## Problem

The following services register EventBus listeners but never unsubscribe them:

- `SettingsService` — listens to `settings.changed`
- `EventDefinitionService` — listens to wildcard `*` and multiple typed events
- `EventFilterService` — stores unsubscribers but has no `dispose()` in interface
- `EventNotificationService` — wildcard `*` listener
- `SubscriptionService` — wildcard `*` listener
- `DiscoveryService` — multiple typed listeners
- `IngestionService` — multiple typed listeners + batch timer

The `ServiceContainer.disposeAll()` calls `dispose()` on services implementing `IDisposable`, but most domain services do not implement this interface.

## Impact

- During hot-reload development cycles, listeners accumulate because old instances are not disposed
- Wildcard listeners on `*` fire for every event, multiplying the performance cost
- Potential for stale service references to process events after logical disposal

## Suggested Remediation

1. Add `IDisposable` to all service interfaces that register listeners
2. Implement `dispose()` in each service: iterate stored unsubscribers, clear timers
3. Consider a base class or mixin: `DisposableService` that provides `addCleanup()` / `dispose()` pattern
4. Audit: ensure every `eventBus.on()` call stores the unsubscribe function

## Affected Files

- `src/domain/settings/SettingsService.ts`
- `src/domain/eventDefinition/EventDefinitionService.ts`
- `src/domain/eventFilter/EventFilterService.ts`
- `src/domain/eventNotify/EventNotificationService.ts`
- `src/domain/subscription/SubscriptionService.ts`
- `src/domain/discovery/DiscoveryService.ts`
- `src/domain/ingestion/IngestionService.ts`

## Resolution (2026-02-14)

9 of 11 domain services now implement `IDisposable` with proper `dispose()` methods that clear timers and call stored unsubscribe functions: SettingsService, EventDefinitionService, EventFilterService, EventNotificationService, SubscriptionService, DiscoveryService, IngestionService, DocService, DataExchangeService.

The remaining 5 services (UserService, InstallerService, ImportService, ExportService, ConfigDocService) are stateless -- they register no event listeners and hold no timers, so `dispose()` is unnecessary.

`ServiceContainer.disposeAll()` iterates all registered services and calls `dispose()` on those implementing `IDisposable`. Called from `main.ts onunload()`.
