---
type: Component
domain: Flowti
stage: done
description: "Analytics query results display with stat cards, sortable table (max 100 rows), and CSV export"
source: "[[Development/flowti/src/ui/hub/AnalyticsResultsPanel.ts|AnalyticsResultsPanel.ts]]"
parent: "[[AnalyticsTab]]"
tags:
  - hub
  - analytics
  - component
---

# AnalyticsResultsPanel

## Description

AnalyticsResultsPanel renders the results of an analytics query execution. It displays stat cards (row count, group count, source rows, duration), a sortable results table capped at 100 rows, and a CSV export button. Table headers are clickable to toggle sort direction.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `container` | `HTMLElement` | Parent DOM element to render into |
| `options.result` | `AnalyticsResult` | Query result containing headers and rows |
| `options.durationMs` | `number` (optional) | Query execution duration for stat card |
| `options.onExportCsv` | callback (optional) | Handler for CSV export button click |

## State

**Internal:**
- `sort: SortState | null` — Current sort column and direction, toggled by clicking headers

## Renders

- **Stat cards row**: Row count, group count, source rows processed, duration (ms)
- **Results table**: Column headers (clickable for sort), data rows (max 100 displayed)
- **CSV export button**: Generates CSV string with proper escaping and calls `onExportCsv` callback

## Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| (none) | -- | Stateless presentation component; uses callback for CSV export |

## Related

- Parent: [[AnalyticsTab]]
