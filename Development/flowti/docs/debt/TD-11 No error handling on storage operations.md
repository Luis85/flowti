---
severity: high
category: error-handling
layer: domain
status: open
effort: medium
description: Storage load/save operations across domain services are not wrapped in try-catch. A corrupted or inaccessible data file will crash the service during initialization instead of falling back gracefully.
---
# TD-11: No error handling on storage load/save across services

## Problem

All domain services follow this storage pattern without error handling:

```typescript
async load(): Promise<void> {
    const raw = await this.storage.load();
    const data = (raw as object) || {};
    // ... parse and apply
}
```

If `storage.load()` throws (corrupted JSON, permissions, Obsidian API error), the entire service initialization fails and propagates up to `onLayoutReady`.

Services affected: SettingsService, UserService, InstallerService, EventDefinitionService, EventFilterService, EventNotificationService, SubscriptionService, DiscoveryService, IngestionService, DataExchangeService.

## Impact

- A single corrupted storage key crashes the entire plugin
- No fallback to defaults on storage failure
- User has no way to recover without manually editing plugin data

## Suggested Remediation

1. Wrap all `storage.load()` calls in try-catch with fallback to default state
2. Log the error with severity `high` via ErrorService
3. Emit a `service.storage.corrupted` event for observability
4. Consider a `SafeStorage` wrapper that centralises this pattern

## Affected Files

- All domain service files under `src/domain/*/`
