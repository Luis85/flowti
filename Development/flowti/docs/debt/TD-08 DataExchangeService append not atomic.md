---
severity: high
category: bug-risk
layer: domain
status: resolved
resolved: 2026-02-14
effort: medium
description: The ExportService append strategy reads then writes without atomicity. Concurrent exports to the same file can lose data because both reads see the old content before either write completes.
---
# TD-08: DataExchangeService append not atomic

## Problem

In `ExportService.ts`, the append strategy:

1. Reads the existing output file content
2. Parses it to find the header
3. Appends new rows
4. Writes the full content back

Between step 1 and step 4, another concurrent export could also read the old content and write its own version, overwriting the first export's changes.

## Impact

- Data loss when two exports target the same output file simultaneously
- Silent corruption — the user sees a successful export but rows are missing

## Suggested Remediation

1. Use a per-file mutex (keyed lock) for export write operations
2. Alternative: use a temp file + rename pattern for atomic writes
3. For external file writes via `setWriteExternalFile`, the callback should handle atomicity

## Affected Files

- `src/domain/dataExchange/ExportService.ts`

## Resolution

A `PathMutex` (keyed lock from `src/utils/mutex.ts`) was added to `ExportService`. All write operations (append, skip, overwrite) are now wrapped in `this.writeMutex.withLock(config.outputPath, ...)`, serializing concurrent writes to the same output path.
