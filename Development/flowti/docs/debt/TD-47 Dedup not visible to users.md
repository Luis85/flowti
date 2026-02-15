---
status: open
severity: low
category: ux
layer: ui
created: 2026-02-15
effort: small
description: "Ingestion idempotency ledger and EventDefinition 'once' policy suppress events silently. Users get no feedback about what was skipped or deduplicated."
source: "[[Technical Review 2026-02-15]]"
---
# TD-47: Deduplication and suppression not visible to users

## Problem

Two deduplication mechanisms operate silently with no user-facing feedback:

### 1. Ingestion idempotency ledger

`IngestionService.processedKeys` (Set, max 10,000 entries) tracks `eventType::path` keys. When a file event matches a key already in the ledger, it is silently skipped.

**User impact**: During catch-up scan, previously processed files produce no events. User sees "idle (Y processed, 0 failed)" but no indication of how many files were skipped.

### 2. Event Definition "once" emission policy

`EventDefinitionService.emittedKeys` (array, max 10,000 entries) tracks deterministic keys for the "once" emission policy. Matching files that have already emitted their domain event are silently suppressed.

**User impact**: User configures a definition with "Once per file" policy, modifies the file, and wonders why no new domain event was emitted.

## Impact

Low — both mechanisms work correctly. The issue is transparency, not correctness. Users may be confused about "why didn't my file trigger?" during catch-up or when editing files that match "once" definitions.

## Suggested Fix

### Option A: Counters in Status Bar / Activity Log

Add dedup counters to the IngestionStatusBar:
```
idle (42 processed, 0 failed, 15 skipped)
```

Add suppression info to Event Definition detail panel:
```
Emission policy: Once per file (23 files matched, 18 emitted, 5 suppressed)
```

### Option B: Log-level events

Emit `ingestion.job.skipped` and `eventDefinition.suppressed` events (log-level, not domain events). These would appear in the Activity Log when verbose mode is enabled.

### Recommendation

Option A is simpler and provides immediate value. Option B is more flexible but adds event noise.

## Affected Files

- `src/ui/IngestionStatusBar.ts` — skipped counter
- `src/domain/ingestion/IngestionService.ts` — emit skip count in batch.completed
- `src/ui/catalog/EventDetailPanel.ts` — definition emission stats
- `src/domain/eventDefinition/EventDefinitionService.ts` — track suppression count
