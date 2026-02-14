---
severity: critical
category: architecture
layer: ui
status: open
effort: large
description: Four UI files exceed 1,000 LOC, violating the project convention of 200-300 lines per file. They are monolithic view classes that mix state management, rendering logic, and direct Obsidian API access.
---
# TD-01: UI files exceed size convention

## Problem

The project convention in `AGENTS.md` states files should not exceed 200-300 lines. Four UI files massively exceed this:

| File | Lines | Ratio |
|------|-------|-------|
| `CsvActionView.ts` | 2,288 | 7.6x |
| `DataExchangeHubView.ts` | 2,297 | 7.7x |
| `ExportView.ts` | 1,350 | 4.5x |
| `EventsTab.ts` | 1,040 | 3.5x |

Additional files in the 600-900 LOC range: `EventCatalogView.ts` (839), `eventDocTemplate.ts` (862), `EventConfigModal.ts` (756), `EventLogView.ts` (603).

## Impact

- Hard to review and maintain
- High cognitive load when making changes
- Encourages further growth because the pattern is established
- Increases merge conflict surface area

## Root Cause

Views were built incrementally with each feature (pages, forms, previews) added to the existing class rather than decomposed into child components.

## Suggested Remediation

1. **CsvActionView** — Extract into `CsvImportWizard` (orchestrator), `CsvColumnMapper`, `CsvPreviewTable`, `CsvImportConfigForm`.
2. **DataExchangeHubView** — Extract into `HubDashboard`, `ImportListPage`, `ExportListPage`, `ReportsPage`, `PropertyDictionaryPage`.
3. **ExportView** — Extract into `ExportConfigForm`, `ExportPreviewTable`, `PropertyGrid`, `ExportResultPage`.
4. **EventsTab** — Extract `EventDetailPanel` from the tab, move category tree rendering into `EventCategoryTree`.

## Affected Files

- `src/ui/CsvActionView.ts`
- `src/ui/DataExchangeHubView.ts`
- `src/ui/ExportView.ts`
- `src/ui/catalog/EventsTab.ts`
