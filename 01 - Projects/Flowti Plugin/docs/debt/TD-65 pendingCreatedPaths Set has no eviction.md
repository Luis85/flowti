---
type: TechDebt
severity: low
category: memory
layer: infrastructure
status: resolved
resolved: 2026-02-21
resolved_in: "Cycle 10 Inc 2"
created: 2026-02-15
effort: tiny
description: "EventBridge.pendingCreatedPaths grows unboundedly if metadata.changed never fires for a created file (e.g., binary file, corrupted file, or Obsidian cache issue)."
source: "[[PRD Audit 2026-02-15]]"
tags:
  - prd-audit
---
# TD-65: pendingCreatedPaths Set has no eviction

## Problem

`EventBridge.pendingCreatedPaths` is a `Set<string>` that tracks file paths added on `file.created` events. Paths are only removed when the corresponding `metadata.changed` event fires. If `metadata.changed` never fires for a created file (e.g., binary files, corrupted files, or Obsidian cache issues), the path remains in the Set permanently.

## Impact

Minor memory leak over long sessions with many file creations. Binary files and files that fail to index will accumulate paths in the Set indefinitely.

## Suggested Fix

Add a TTL (e.g., 30 seconds) or max size with oldest-first eviction, similar to IngestionService's ledger eviction pattern:

1. **TTL approach**: Store `{ path, timestamp }` and periodically evict entries older than 30 seconds
2. **Max size approach**: Cap the Set at a reasonable size (e.g., 100) and evict oldest entries when full
3. **Combined**: Use both TTL and max size for defense in depth

## Affected Files

- `src/infrastructure/events/EventBridge.ts` (line 42, 431, 594)
