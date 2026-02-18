---
type: TechDebt
severity: low
category: dead-code
layer: domain
status: open
created: 2026-02-15
effort: tiny
description: "IngestionService.processJobPayload() is a protected no-op method intended as an extensibility hook, but nothing in the codebase overrides it. The retry/backoff logic can never trigger."
source: "[[PRD Audit 2026-02-15]]"
tags:
  - prd-audit
---
# TD-61: IngestionService processJobPayload is dead no-op

## Problem

`IngestionService.processJobPayload()` is a protected no-op method intended as an extensibility hook for subclasses that need custom event processing. However, nothing in the codebase overrides it. As a result, the retry and exponential backoff logic that wraps calls to this method can never trigger, since the no-op never throws.

This creates a false impression of functionality — the retry mechanism exists in code but is effectively dead.

## Impact

Minor code confusion; no functional impact. Developers may assume retry logic is active when it is not.

## Suggested Fix

Either:

1. **Remove the hook and simplify** — delete `processJobPayload()` and the retry/backoff wrapper if no extension is planned
2. **Document it** — add a JSDoc comment explicitly marking it as the intended extension point for custom processing, noting that the base implementation is intentionally a no-op

## Affected Files

- `src/domain/ingestion/IngestionService.ts` (lines 327-329)
