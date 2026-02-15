---
severity: medium
category: feature-gap
layer: domain
status: open
created: 2026-02-15
effort: small
description: "PRD claims per-record progress events during export. ImportService correctly emits per-row progress, but ExportService has no progress emission during the export loop."
source: "[[PRD Audit 2026-02-15]]"
tags:
  - prd-audit
---
# TD-68: Export emits no per-record progress events

## Problem

`dataExchange.export.progress` event does not exist in `DataExchangeEventMap`. The `ExportService.executeExport()` method processes files in a loop but emits no per-file progress events. By contrast, `ImportService` correctly emits `dataExchange.import.progress` for each row processed.

The PRD specifies per-record progress events for both import and export operations, but only import fulfills this contract.

## Impact

- Export UI cannot show real-time progress for large exports.
- Users see no feedback between the start and completion of an export operation.
- For exports spanning hundreds of files, this creates a perception of the plugin being unresponsive.

## Suggested Fix

1. Add `dataExchange.export.progress` event to `DataExchangeEventMap` with a payload matching the import progress pattern (e.g., `{ current: number; total: number; currentFile: string }`).
2. Emit the progress event per-file inside the `executeExport()` loop.
3. Wire the Export UI to listen for progress and update a progress bar or counter.

## Affected Files

- `src/domain/dataExchange/ExportService.ts` (lines 222-296)
- `src/domain/dataExchange/events.ts`
