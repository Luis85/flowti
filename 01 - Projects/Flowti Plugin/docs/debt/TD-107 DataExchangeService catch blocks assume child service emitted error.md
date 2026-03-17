---
type: TechDebt
severity: medium
category: error-handling
layer: domain
status: resolved
resolved: 2026-02-21
resolved_in: "Cycle 10 Inc 1"
created: 2026-02-20
effort: small
description: "DataExchangeService catches errors from ImportService and ExportService with empty catch blocks, assuming the child service already emitted a failure event. If the child service throws before emitting, the error is silently lost."
---

# TD-107: DataExchangeService catch blocks assume child service emitted error

## Problem

In `DataExchangeService.ts` (lines 94-121), import and export command handlers use empty catch blocks:

```typescript
this.eventBus.on("dataExchange.import.execute", async (event) => {
    try {
        await this.importService.executeImport(event.payload.config, { operationId });
    } catch {
        // ImportService already emitted import.failed
    }
});

this.eventBus.on("dataExchange.export.execute", async (event) => {
    try {
        await this.exportService.executeExport(event.payload.config, { operationId });
    } catch {
        // ExportService already emitted export.failed
    }
});
```

The assumption in the comments is that `ImportService`/`ExportService` emitted a `.failed` event before throwing. However, if the child service throws at a point before the emit (e.g., during initial config validation, or if the EventBus itself is unavailable), the error is silently discarded.

## Impact

- If ImportService or ExportService throws before emitting the failure event, the error is lost entirely.
- The UI shows no feedback (no progress, no completion, no failure) because the active operation tracker never receives a terminal event.
- The same pattern appears for `dataExchange.pipeline.execute` (line 126).

## Suggested Fix

Add a fallback error emission in the catch block:

```typescript
catch (err) {
    // Emit failure event as a safety net in case the child service didn't
    await this.eventBus.emit("dataExchange.import.failed", {
        operationId,
        error: err instanceof Error ? err.message : String(err),
    });
}
```

Alternatively, log the error via the logger so it's at least visible in the console.

## Affected Files

- `src/domain/dataExchange/DataExchangeService.ts` (lines 94-135)
