---
type: TechDebt
stage: resolved
resolved_in: "[[Cycle 35 - Supplier Manager Daily Experience]]"
date_resolved: 2026-02-25
domain: infrastructure
severity: medium
source: "[[Cycle 34 - Inventory Discovery & Dashboard Integration]]"
related:
  - "[[TD-101 SessionService Handler Extraction]]"
---

# TD-126: CSV Utilities Scattered Across Domains

## Problem

CSV parsing, generation, escaping, and file download logic is duplicated across multiple domains and UI layers. As CSV becomes a first-class data format in Flowti (analytics queries, data exchange imports/exports, session exports, dashboard tiles), this scatter creates maintenance risk and inconsistency.

### Current locations

| Location | Responsibility | Key functions |
|----------|---------------|---------------|
| `src/domain/dataExchange/CsvImportService.ts` | Vault CSV import | CSV parsing, delimiter detection |
| `src/domain/analytics/AnalyticsService.ts` | Analytics CSV loading | `loadCsv()` — parse CSV for query engine |
| `src/domain/analytics/AnalyticsEngine.ts` | Column type detection | `detectColumnTypes()` on parsed CSV data |
| `src/ui/analytics/QueriesTab.ts` | Query result export | `resultToCsv()`, `downloadCsv()`, `escapeCsvField` |
| `src/ui/hub/AnalyticsResultsPanel.ts` | Results table export | `generateCsv()`, `escapeCsvField()` |
| `src/domain/session/handlers/` | Session CSV export | CSV generation for session data |

### Duplication

- **Two `generateCsv` / `resultToCsv` implementations** — `AnalyticsResultsPanel` and `QueriesTab` both produce CSV from column+row data with nearly identical logic
- **Two `escapeCsvField` implementations** — same quoting logic duplicated
- **Two CSV parsing paths** — `CsvImportService` and `AnalyticsService.loadCsv()` both parse CSV but with different APIs
- **`downloadCsv()` is UI-specific** — file download via Blob+anchor could be shared infrastructure

## Proposed Fix

Extract a shared `CsvUtils` module under `src/utils/csv.ts` (or `src/infrastructure/csv/`):

```typescript
// src/utils/csv.ts
export function escapeCsvField(value: string): string;
export function rowsToCsv(columns: string[], rows: Record<string, unknown>[]): string;
export function downloadCsvFile(csv: string, filename: string): void;
```

- **Phase 1**: Extract `escapeCsvField` and `rowsToCsv` as pure functions (zero-risk refactor)
- **Phase 2**: Replace all call sites in `QueriesTab`, `AnalyticsResultsPanel`, session handlers
- **Phase 3**: Extract `downloadCsvFile` as shared UI utility
- **Phase 4** (future): Consolidate CSV parsing under a single `CsvParser` if `CsvImportService` and `AnalyticsService.loadCsv()` converge

## Impact

- **Maintenance**: Every new CSV consumer must rewrite escape/generate logic or copy-paste
- **Consistency**: Different implementations may handle edge cases differently (newlines, quotes, encoding)
- **Testing**: Same logic tested in multiple places; a bug fix must be applied everywhere

## References

- Cycle 34 retrospective — CSV file download added to QueriesTab
- `src/ui/hub/AnalyticsResultsPanel.ts` lines 172–195 — `generateCsv()` + `escapeCsvField()`
- `src/ui/analytics/QueriesTab.ts` lines 633–644 — `resultToCsv()`
