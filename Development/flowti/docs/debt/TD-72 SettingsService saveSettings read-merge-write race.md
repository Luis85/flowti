---
type: TechDebt
severity: high
category: concurrency
layer: domain
status: resolved
created: 2026-02-15
updated: 2026-02-21
effort: small
resolved_in: "Pre-Cycle 10 (confirmed Cycle 10 Inc 3)"
description: "SettingsService.saveSettings() now uses PathMutex.withLock() to serialize concurrent saves. The read-merge-write race condition is eliminated."
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

## Resolution (2026-02-21)

The fix is already in place in `SettingsService.ts`. A `PathMutex` was added with `withLock("settings", ...)` wrapping the read-merge-write sequence, matching the pattern from the TD-33 resolution. Discovered during documentation review — the code was fixed but the debt item was not updated.

## Related

- [[TD-33 Storage save race condition]] — same class of issue, resolved for domain services via PathMutex
- [[TD-115 saveSettings unsafe cast of loadData result]] — additional saveSettings issue (type safety)
