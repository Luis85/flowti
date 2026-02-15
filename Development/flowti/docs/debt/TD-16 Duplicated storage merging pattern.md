---
severity: medium
category: duplication
layer: cross-cutting
status: resolved
effort: medium
resolved: 2026-02-15
description: The pattern ((await this.storage.load()) as object) || {} was copy-pasted across 8+ services without type safety. Resolved by creating TypedStorage<T> abstraction and migrating all 9 persistent services.
---
# TD-16: Duplicated storage merging pattern across 8+ services

**Status: RESOLVED** (2026-02-15)

## Problem

Every service that persisted state used this pattern:

```typescript
const existingData = ((await this.storage.load()) as object) || {};
await this.storage.save({ ...existingData, ...this.state });
```

This appeared in 10 services. Issues: unsafe `as object` casts, no error handling, no type safety.

## Resolution

Created `TypedStorage<T>` abstraction (`src/utils/TypedStorage.ts`) with:
- `ITypedStorage<T>` interface: `load()`, `save()`, `safeLoad()`, `safeSave()`
- `TypedStorage<T>` class: key-scoped, mutex-protected read-merge-write
- Module-level `PathMutex` for atomic storage operations

Migrated 9 services from raw `IStorageProvider` to `ITypedStorage<T>`:
- UserService, InstallerService, EventFilterService, EventNotificationService
- SubscriptionService, DiscoveryService, DataExchangeService
- IngestionService, EventDefinitionService

Registry (`registry.ts`) wraps shared storage: `new TypedStorage(storage, "key")`.

SettingsService was intentionally NOT migrated — it uses root-level Zod-validated storage with a different pattern (settings spread at root level, not keyed).

Updated 11 test files to use `ITypedStorage<T>` mocks. 9 tests added for TypedStorage itself.

## Affected Files

- NEW: `src/utils/TypedStorage.ts`, `tests/utils/TypedStorage.test.ts`
- MODIFIED: 9 domain service files, `registry.ts`, 11 test files
