---
severity: medium
category: type-safety
layer: domain
status: resolved
effort: small
description: ExportService casts event payloads to Record<string, unknown> without validation. If the event shape changes, the cast silently passes and produces incorrect output.
resolved: 2026-02-15
---
# TD-22: ExportService type-unsafe payload cast

## Problem

In `ExportService.ts`:

```typescript
const payload = event.payload as Record<string, unknown>;
```

This bypasses TypeScript's type checking. If the event payload structure changes, no compile-time error is raised.

## Resolution

The unsafe cast was removed during the DataExchangeService refactoring (Phase 8). `ExportService` no longer uses wildcard listeners or casts event payloads. All event handling is routed through `DataExchangeService`, which uses typed event listeners with compile-time safety. The current `ExportService` exposes only imperative methods (`executeExport`, `scanColumns`, etc.) and does not subscribe to events directly.

## Affected Files

- `src/domain/dataExchange/ExportService.ts` — no longer contains unsafe casts
