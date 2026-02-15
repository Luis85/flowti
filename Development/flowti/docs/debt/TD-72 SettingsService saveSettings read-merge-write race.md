---
severity: high
category: concurrency
layer: domain
status: open
created: 2026-02-15
effort: small
description: "SettingsService.saveSettings() performs non-atomic read-merge-write. Unlike domain services using saveStateToStorage (protected by PathMutex per TD-33), SettingsService has its own save method without mutex protection."
source: "[[PRD Audit 2026-02-15]]"
tags:
  - prd-audit
---
# TD-72: SettingsService saveSettings read-merge-write race

## Problem

`SettingsService.saveSettings()` performs a non-atomic read-merge-write sequence. While domain services like IngestionService and EventDefinitionService route through `saveStateToStorage()` (which was protected by a `PathMutex` in the TD-33 fix), SettingsService has its own `saveSettings()` method that bypasses this protection entirely.

Five event listeners call `updateSettings()` in a fire-and-forget pattern. If two settings events arrive in close succession (e.g., toggling `showSystemEvents` while catalog categories update simultaneously), both handlers read the same stale settings snapshot, merge their respective changes, and the second write overwrites the first's changes.

## Impact

- Settings values silently lost during concurrent updates.
- The bug is probabilistic — depends on event timing, making it difficult to reproduce but real in production.
- User-visible symptoms: toggling a setting appears to "not stick" intermittently.

## Suggested Fix

Either:

1. **Route through `saveStateToStorage()`** — which already has `PathMutex` protection from the TD-33 fix.
2. **Add a local mutex** to `saveSettings()`:

```typescript
private readonly saveMutex = new PathMutex();

private async saveSettings(): Promise<void> {
    await this.saveMutex.withLock("settings", async () => {
        // read-merge-write here
    });
}
```

Option 1 is preferred for consistency with other domain services.

## Affected Files

- `src/domain/settings/SettingsService.ts` (lines 163-172)
