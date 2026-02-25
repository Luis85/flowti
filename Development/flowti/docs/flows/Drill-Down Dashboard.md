---
type: Flow
domain: Flowti
stage: done
description: Interactive dashboard filtering and drill-down navigation with breadcrumbs, cascading filters, and per-tile value exploration
domains:
  - Analytics
services:
  - AnalyticsService
  - AnalyticsEngine
events:
  - analytics.dashboard.refreshed
  - analytics.query.started
  - analytics.query.completed
tags:
  - analytics
  - dashboard
  - drill-down
  - filter
---

# Drill-Down Dashboard

## Overview

The drill-down flow enables interactive data exploration within a dashboard. Users can filter across all tiles using global dimension filters, click individual values in tables or stat-cards to drill into specific data subsets, and navigate their exploration path via breadcrumbs. This flow transforms static dashboards into interactive data exploration tools.

## Trigger

User interacts with a dashboard that has tiles with query results:
- Selects values in DashboardFilterBar dimension dropdowns
- Clicks a string value in a table cell or stat-card label
- Clicks a breadcrumb to navigate back

## Steps

### 1. Open Dashboard with Filters

- **View/Service**: DashboardsTab + DashboardFilterBar
- **User Action**: User selects a dashboard from the master list
- **System Response**: Dashboard renders with tile grid. DashboardFilterBar appears above tiles showing multi-select dropdowns for each dimension column detected across all tile queries. Each dropdown lists distinct values from the query results
- **Events**: (none — render only)

### 2. Apply Global Filters

- **View/Service**: DashboardFilterBar → AnalyticsService
- **User Action**: User clicks a dimension dropdown and toggles one or more values. Label updates to "N selected"
- **System Response**: Filter selections propagate to all tiles via `runSavedQueryWithFilters()`. Each tile re-executes its query with the active filters applied: OR logic within a column (any selected value), AND logic across columns (all conditions must match). "~N rows" badge updates to show estimated row count impact. Cascading dimension discovery narrows sibling filter options based on active selections
- **Events**: `analytics.query.started` → `analytics.query.completed` (per tile)

### 3. Drill-Down by Value

- **View/Service**: DashboardTileRenderer → DashboardBreadcrumbs
- **User Action**: User clicks a string value in a table cell or stat-card label
- **System Response**: The clicked value is added as a filter. The tile (and optionally siblings sharing that dimension) re-renders with the drill-down filter applied. DashboardBreadcrumbs updates to show the drill-down path. Breadcrumb chips show each active drill-down value with × clear buttons. Visual accent color highlights the active drill-down state
- **Events**: `analytics.dashboard.refreshed`

### 4. Navigate Breadcrumbs

- **View/Service**: DashboardBreadcrumbs
- **User Action**: User clicks a breadcrumb item to navigate back to that level, or clicks × on a specific value chip
- **System Response**: Navigation stack pops to the selected level. Filters update accordingly. All affected tiles re-execute with the updated filter state. Breadcrumb bar reflects the new position
- **Events**: `analytics.query.started` → `analytics.query.completed` (per affected tile)

### 5. Clear All Filters

- **View/Service**: DashboardFilterBar
- **User Action**: User clicks "Clear" button in the filter bar
- **System Response**: All dimension filters and drill-down state are reset. All tiles re-execute with no filters. Breadcrumb bar clears. Filter dropdowns reset to show all values
- **Events**: `analytics.dashboard.refreshed`

## Decision Points

| Decision | Options | Default |
|----------|---------|---------|
| Filter scope | Global (all tiles) / Per-tile drill-down | Global |
| Multi-select | Single value / Multiple values | Multiple |
| Drill-down depth | 1-4 levels | Up to 4 |
| Clear scope | Clear all / Clear single value | Per-value × buttons |

## Events Sequence

```
[select filter] → analytics.query.started (per tile) → analytics.query.completed →
[click value] → analytics.dashboard.refreshed → analytics.query.started → analytics.query.completed →
[click breadcrumb] → analytics.query.started → analytics.query.completed →
[clear filters] → analytics.dashboard.refreshed
```

## Related Use Cases

- [[Build Analytics Dashboard]] — Dashboard creation flow (prerequisite)
- [[Analyze CSV in Analytics Hub]] — CSV files provide the source data for drill-down

## Related Decisions

- [[ADR-004 Single JSON Blob Storage]] — Filter state is transient (not persisted)

## Components Involved

- [[DashboardFilterBar]] — Global dimension filter dropdowns
- [[DashboardBreadcrumbs]] — Navigation breadcrumb bar (FR-95)
- [[DashboardTileRenderer]] — Click-to-drill-down on string values
- [[DashboardsTab]] — Orchestrates filter propagation
