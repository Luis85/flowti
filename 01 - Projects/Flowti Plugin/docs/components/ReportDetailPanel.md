---
type: Component
domain: Flowti
stage: done
description: "Detail panel for Reports tab showing report metadata, CSV association, and undocumented CSV details"
source: "[[Development/flowti/src/ui/hub/ReportDetailPanel.ts|ReportDetailPanel.ts]]"
parent: "[[ReportsTab]]"
tags:
  - hub
  - component
---

# ReportDetailPanel

## Description

ReportDetailPanel renders the detail view for the Data Exchange Hub's Reports tab. Handles two scenarios: documented reports (with frontmatter metadata and CSV file association) and undocumented CSV files (showing file stats and offering doc creation). Includes helper functions for matching reports to CSV files and resolving CSV paths from frontmatter.

## Exported Helpers

| Export | Purpose |
|--------|---------|
| `reportMatchesCsv(report, entry)` | Checks if a report references a CSV file |
| `resolveCsvPath(fm)` | Extracts CSV path from frontmatter (`filePath` or `csvFile` wikilink) |
| `findReportForCsv(reports, entry)` | Finds the report doc for a CSV file entry |
| `sortCsvUsedFirst(entries)` | Sorts CSV entries: used files first, then alphabetical |
| `createDocForCsvEntry(deps, entry)` | Creates a report doc for an undocumented CSV |

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `HubComponentDeps` | interface | Hub-level deps with `app`, `getState()`, `setState()` |
| `ReportEntry`, `CsvFileEntry` | types | Report and CSV file data structures |
| `CsvParser` | class | Parses CSV file for preview in detail view |
| `ConfirmModal` | class | Confirmation dialog for delete operations |

## Related

- Parent: [[ReportsTab]]
- Grandparent: [[DataExchangeHubView]]
