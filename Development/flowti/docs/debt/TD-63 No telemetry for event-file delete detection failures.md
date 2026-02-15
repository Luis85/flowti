---
severity: low
category: observability
layer: infrastructure
status: open
created: 2026-02-15
effort: tiny
description: "EventBridge.emitEventFileTriggered() attempts to read metadataCache during delete, but cache is already cleared. Detection silently fails with no logging or counter."
source: "[[PRD Audit 2026-02-15]]"
tags:
  - prd-audit
---
# TD-63: No telemetry for event-file delete detection failures

## Problem

When a file is deleted, `EventBridge.emitEventFileTriggered()` attempts to read the `metadataCache` to extract frontmatter, but the cache entry for the deleted file has already been cleared by Obsidian. The detection silently fails — no log entry, no counter, no event indicates that a delete-triggered event-file detection was attempted and failed.

Users have no way to know when event-file delete detection fails.

## Impact

Missed event-file triggers on delete go unnoticed. Users who expect file-delete events to trigger downstream processing have no visibility into failures.

## Suggested Fix

Add a debug-level log entry when delete detection fails due to missing cache. For example:

```typescript
this.logger.debug("event-file delete detection skipped: cache cleared for path", { path });
```

This provides observability without noise at normal log levels.

## Affected Files

- `src/infrastructure/events/EventBridge.ts` (lines 499-516)
