---
type: TechDebt
severity: medium
category: consistency
layer: infrastructure
status: resolved
created: 2026-02-15
updated: 2026-02-21
effort: small
resolved_in: "Pre-Cycle 10 (confirmed Cycle 10 Inc 4)"
description: "file.renamed payload now includes path (= newPath) alongside oldPath and newPath. Both the type definition in events.ts and the emission in EventBridge.ts already have this fix."
source: "[[PRD Audit 2026-02-15]]"
tags:
  - prd-audit
---
# TD-64: file.renamed payload inconsistency breaks path extraction

## Problem

The `file.renamed` event uses `{ oldPath, newPath }` in its payload, while all other file events (`file.created`, `file.modified`, `file.deleted`) use `{ path }`. Any generic code that extracts the file path via `extractStringField(payload, 'path')` returns `undefined` for rename events.

This causes two downstream failures:

1. **IngestionService deduplication**: `generateEventKey()` falls back to UUID for rename events (see TD-62), bypassing deduplication
2. **SubscriptionService path matching**: Subscriptions that filter on path patterns silently skip rename events

## Impact

Rename events bypass deduplication and may not match path-based subscriptions. Downstream processing that relies on the `path` field in event payloads silently fails for renames.

## Suggested Fix

Add `path: newPath` to the rename payload alongside `oldPath` and `newPath` for backward compatibility:

```typescript
// Before
{ oldPath: string; newPath: string }

// After
{ path: string; oldPath: string; newPath: string }
```

This ensures generic path extraction works while preserving the rename-specific fields.

## Affected Files

- `src/infrastructure/events/events.ts` (lines 271-278)
- `src/infrastructure/events/EventBridge.ts`
