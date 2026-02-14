---
severity: medium
category: bug-risk
layer: infrastructure
status: open
created: 2026-02-14
effort: small
description: saveStateToStorage performs read-merge-write without locking. Concurrent saves from different services can cause lost updates when their reads overlap.
source: "[[Technical Review 2026-02-14]]"
---
# TD-33: Storage save race condition

## Problem

`saveStateToStorage()` in `src/utils/persistence.ts` performs a non-atomic read-merge-write:

```typescript
const existingData = ((await storage.load()) as object) || {};
await storage.save({ ...existingData, [key]: state });
```

When two services save concurrently (e.g., IngestionService and EventDefinitionService both calling `void this.saveState()` after processing events), the sequence can be:

1. Service A reads snapshot `{user: {...}, ingestion: {...}}`
2. Service B reads same snapshot `{user: {...}, ingestion: {...}}`
3. Service A writes `{user: {...}, ingestion: {UPDATED}, eventDefinition: {...}}`
4. Service B writes `{user: {...}, ingestion: {...}, eventDefinition: {UPDATED}}` — **overwrites A's ingestion update**

### Fire-and-forget callers that make this likely

| File | Line | Pattern |
|------|------|---------|
| `IngestionService.ts` | 245 | `void this.saveState()` after batch processing |
| `IngestionService.ts` | 290 | `void this.saveState()` after job completion |
| `EventDefinitionService.ts` | 248 | `void this.saveState()` after emission tracking |

## Impact

- Silent data loss: persisted state can lose updates from concurrent saves
- After restart, services may re-process events or re-emit custom events due to lost ledger entries
- The bug is probabilistic — depends on save timing, making it hard to reproduce

## Suggested Remediation

Wrap `saveStateToStorage` with a mutex. `PathMutex` already exists at `src/utils/mutex.ts`:

```typescript
import { PathMutex } from "./mutex";
const storageMutex = new PathMutex();

export async function saveStateToStorage<T>(
    storage: IStorageProvider, key: string, state: T
): Promise<void> {
    await storageMutex.withLock("storage", async () => {
        const existingData = ((await storage.load()) as object) || {};
        await storage.save({ ...existingData, [key]: state });
    });
}
```

Effort: small — single function change + import.

## Affected Files

- `src/utils/persistence.ts` (add mutex)
- `src/utils/mutex.ts` (already exists, no changes needed)
