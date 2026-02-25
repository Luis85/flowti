---
type: Component
domain: Flowti
stage: done
description: "Multi-select dimension filter dropdowns with cascading discovery and row-count preview for dashboards"
source: "[[Development/flowti/src/ui/analytics/DashboardFilterBar.ts|DashboardFilterBar.ts]]"
parent: "[[DashboardsTab]]"
tags:
  - analytics
  - filter
  - dashboard
  - component
---

# DashboardFilterBar

## Description

DashboardFilterBar renders a row of multi-select dimension filter dropdowns above the dashboard tile grid. Supports cascading dimension discovery — selecting a value in one filter narrows the available values in sibling filters. Displays a "~N rows" badge showing the estimated row count impact of active filters (FR-96). Filter selections propagate to all tiles via `runSavedQueryWithFilters()` with OR logic within a column and AND logic across columns.

## Features

| Feature | Description |
|---------|-------------|
| Multi-select dropdowns | Toggle individual values, "N selected" label |
| Cascading discovery | Active filters narrow sibling filter options |
| Row-count preview | "~N rows" badge updates as filters change |
| Filter propagation | OR within column, AND across columns |
| Clear all | Reset button clears all active filters |

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `container` | `HTMLElement` | Filter bar container |
| `dimensions` | `string[]` | Available dimension columns |
| `onFilterChange` | callback | Propagates filter selections to tiles |

## Related

- Parent: [[DashboardsTab]]
- Introduced: [[Cycle 36 - Dashboard Drill-Down and Filtering]] (PBI-ANA-056)
- Row-count preview: [[Cycle 43 - Analytics Hub Performance & Navigation]] (PBI-ANA-123)
