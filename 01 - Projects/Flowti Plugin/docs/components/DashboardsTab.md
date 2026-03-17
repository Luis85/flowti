---
type: Component
domain: Flowti
stage: done
description: "Dashboard management with master/detail split — dashboard list in master, CSS Grid tile layout in detail"
source: "[[Development/flowti/src/ui/analytics/DashboardsTab.ts|DashboardsTab.ts]]"
parent: "[[AnalyticsHubView]]"
tags:
  - hub
  - analytics
  - dashboard
  - component
---

# DashboardsTab

## Description

DashboardsTab renders the dashboard management interface within the Analytics Hub. The master panel shows a list of dashboards with tile counts and create/delete actions. The detail panel renders a CSS Grid tile layout for the selected dashboard, with each tile showing query results via DashboardTileRenderer.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `masterEl` | `HTMLElement` | Master panel DOM element |
| `detailEl` | `HTMLElement` | Detail panel DOM element |
| `deps` | `AnalyticsHubDeps` | Shared dependency bag |
| `deps.analyticsService` | `AnalyticsService` | Dashboard/tile CRUD, query execution |
| `DashboardTileRenderer` | class | Renders individual tiles |
| `AddTileDialog` | class | Inline dialog for adding tiles |

## State

- `addTileDialogVisible: boolean` — controls inline add-tile dialog
- `tileResults: Map<queryId, { result, error }>` — async tile result cache

## Renders

### Master Panel
- Dashboard list items with name, tile count badge
- Selected dashboard highlight
- "New Dashboard" button
- Delete button per dashboard

### Detail Panel
- CSS Grid layout (`grid-template-columns: repeat(2, 1fr)`)
- DashboardTileRenderer per tile
- AddTileDialog (inline, shown on demand)
- Empty state when no dashboards or no tiles

## Public API

| Method | Purpose |
|--------|---------|
| `renderMaster()` | Render dashboard list in master panel |
| `renderDetail()` | Render tile grid in detail panel |
| `clearResultCache()` | Clear async tile results (called on tile add/remove events) |

## Related

- Parent: [[AnalyticsHubView]]
- Children: [[DashboardTileRenderer]], [[AddTileDialog]]
