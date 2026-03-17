---
type: Component
domain: Flowti
stage: done
description: "Collapsible section showing which queries power a dashboard's tiles, with source basenames and freshness"
source: "[[Development/flowti/src/ui/analytics/DashboardQueryMap.ts|DashboardQueryMap.ts]]"
parent: "[[DashboardsTab]]"
tags:
  - analytics
  - dashboard
  - cross-domain
  - component
---

# DashboardQueryMap

## Description

DashboardQueryMap renders a collapsible "Queries" section in the dashboard detail view showing which saved queries power the dashboard's tiles. Each entry shows the query name, source CSV basenames (e.g., "Suppliers.csv + 1 more"), tile count, and freshness indicator. Provides query transparency — users can see exactly which data feeds each tile.

## Features

| Feature | Description |
|---------|-------------|
| Query list | Unique queries per dashboard with tile counts |
| Source basenames | Shows CSV file names per query |
| Freshness | Relative time since last refresh with color coding |
| Collapsible | Section collapses to save space |

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `container` | `HTMLElement` | Section container |
| `dashboard` | `Dashboard` | Dashboard with tile references |
| `queryMap` | `DashboardQueryMapEntry[]` | From `getDashboardQueryMap()` |

## Related

- Parent: [[DashboardsTab]]
- Service method: `AnalyticsService.getDashboardQueryMap()`
- Introduced: [[Cycle 37 - Analytics Hub Cross-Domain Integration]] (PBI-ANA-061)
