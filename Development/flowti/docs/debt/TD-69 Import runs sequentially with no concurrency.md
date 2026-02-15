---
severity: low
category: performance
layer: domain
status: open
created: 2026-02-15
effort: medium
description: "ImportService.executeImport() processes rows one at a time in a for loop. Each row requires 2+ EventBus round-trips. No concurrency despite the existing JobQueue in the Ingestion domain."
source: "[[PRD Audit 2026-02-15]]"
tags:
  - prd-audit
---
# TD-69: Import runs sequentially with no concurrency

## Problem

`ImportService.executeImport()` processes rows one at a time in a sequential `for` loop. Each row requires at minimum 2 EventBus round-trips (file existence check + file creation or update). For a 1000-row import, this means 2000+ sequential event round-trips with linear scaling.

The Ingestion domain already has a `JobQueue` with configurable concurrency that solves this exact problem, but ImportService does not use it.

## Impact

- Large imports are slow due to purely sequential processing.
- The PRD's NFR of "1000 rows in 30 seconds" may not be met on vaults with any I/O latency.
- Users experience long waits with no ability to speed up imports.

## Suggested Fix

Use a batched approach to process multiple rows concurrently:

1. Reuse the `JobQueue` pattern from `IngestionService` with a configurable concurrency level (e.g., 5-10 rows).
2. Alternatively, use `Promise.allSettled()` on small batches within the loop.
3. Ensure progress events still emit in order (or accept out-of-order progress with a total counter).

Care must be taken to avoid overwhelming the vault's file I/O — a bounded concurrency of 5-10 is a reasonable starting point.

## Affected Files

- `src/domain/dataExchange/ImportService.ts` (line 65)
