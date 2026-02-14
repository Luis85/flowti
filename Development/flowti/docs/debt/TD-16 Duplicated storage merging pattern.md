---
severity: medium
category: duplication
layer: cross-cutting
status: open
effort: medium
description: The pattern ((await this.storage.load()) as object) || {} is copy-pasted across 8+ services without type safety. A shared SafeStorage abstraction would eliminate the duplication and add error handling.
---
# TD-16: Duplicated storage merging pattern across 8+ services

## Problem

Every service that persists state uses this pattern:

```typescript
const existingData = ((await this.storage.load()) as object) || {};
await this.storage.save({ ...existingData, ...this.state });
```

This appears in: SettingsService, UserService, InstallerService, EventDefinitionService, EventFilterService, EventNotificationService, SubscriptionService, DiscoveryService, IngestionService, DataExchangeService.

Issues:
- `as object` cast has no type safety
- No error handling if `load()` throws
- No validation that the loaded data matches expected schema
- Merge strategy (spread) does not handle nested objects correctly

## Suggested Remediation

1. Create a `TypedStorage<T>` wrapper that encapsulates load, validate (Zod), merge, and save
2. Inject it via the service factory instead of raw `IStorageProvider`
3. Each service defines its schema; the wrapper handles the rest

## Affected Files

- All domain service files that use `IStorageProvider`
