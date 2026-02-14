---
severity: medium
category: duplication
layer: cross-cutting
status: resolved
effort: small
updated: 2026-02-14
resolved: 2026-02-14
description: 75+ inline path manipulation operations across 17 files with no centralized utility. Includes basename extraction, dirname extraction, extension stripping, and wildcard payload field extraction.
source: "[[Technical Review 2026-02-14]]"
---
# TD-18: Path extraction pattern duplicated 75+ times

## Problem

The codebase has 75+ inline path manipulation operations across 17 files using 3 sub-patterns, with no centralized path utility module.

### Sub-pattern 1: Basename extraction (31 occurrences, 11 files)

```typescript
path.split("/").pop()  // extract filename from path
```

Top offenders: `configDocContent.ts` (14), `PipelinePreview.ts` (4), `ExportsTab.ts` (2), `DashboardExports.ts` (2).

### Sub-pattern 2: Regex-based path operations (44 occurrences, 6 files)

```typescript
path.replace(/\/+$/, "")   // strip trailing slash
path.replace(/\.md$/, "")  // strip extension
```

Top offenders: `pathResolver.ts` (29 — intentional, it IS the path utility for entity paths), `configDocContent.ts` (7), `ExportView.ts` (3).

### Sub-pattern 3: Wildcard payload extraction (4 occurrences, 4 files)

```typescript
const payload = event.payload as Record<string, unknown>;
const path = typeof payload.path === "string" ? payload.path : undefined;
```

Files: EventDefinitionService, SubscriptionService, IngestionService, EventNotificationService.

## Note

`pathResolver.ts` already centralizes entity-doc path resolution (29 regex operations). The gap is general-purpose path utilities for basename, dirname, and extension operations used across domain and UI layers.

## Suggested Remediation

1. Create `src/utils/pathUtils.ts`:
   ```typescript
   export function basename(path: string): string
   export function dirname(path: string): string
   export function stripExtension(path: string): string
   export function extractStringField(payload: unknown, field: string): string | undefined
   ```
2. Replace inline `.split("/").pop()` calls across 11 files
3. Replace inline `.replace(/\.md$/, "")` calls across 6 files
4. Replace wildcard payload extraction across 4 services

## Affected Files

- `src/domain/dataExchange/configDocContent.ts` (14 + 7 = 21 operations)
- `src/ui/hub/pipelines/PipelinePreview.ts` (4)
- `src/ui/hub/pipelines/PipelineExecution.ts` (2)
- `src/ui/hub/pipelines/SourcesExportsGrid.ts` (2)
- `src/ui/hub/ExportsTab.ts` (2)
- `src/ui/hub/DashboardExports.ts` (2)
- `src/ui/DataExchangeHubView.ts` (1)
- `src/ui/PipelineSourceModal.ts` (1)
- `src/ui/ExportView.ts` (3)
- `src/domain/subscription/SubscriptionService.ts` (1)
- `src/domain/dataExchange/ConfigDocService.ts` (1)
- `src/domain/dataExchange/configDocContent.ts` (7)
- `src/domain/eventDefinition/EventDefinitionService.ts` (1)
- `src/domain/ingestion/IngestionService.ts` (1)
- `src/domain/eventNotify/EventNotificationService.ts` (1)

## Resolution

Resolved 2026-02-14:
- Created `src/utils/pathUtils.ts` with `basename()`, `dirname()`, `stripExtension()`, `normalizeSeparators()`
- Replaced 30+ inline `.split("/").pop()` patterns across 13 source files
- Existing helpers in `csvUtils.ts` and `exportUtils.ts` refactored to delegate to pathUtils
- Centralized path utility now used consistently across domain, infrastructure, and UI layers
