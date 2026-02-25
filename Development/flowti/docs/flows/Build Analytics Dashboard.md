---
type: Flow
domain: Flowti
stage: done
description: End-to-end journey from opening the Analytics Hub through building queries, creating dashboards, and composing tile grids with mixed CSV and .base data sources
domains:
  - Analytics
services:
  - AnalyticsService
  - AnalyticsEngine
  - SourceManager
  - BaseAnalyticsAdapter
events:
  - analytics.loaded
  - analytics.query.started
  - analytics.query.completed
  - analytics.query.failed
  - analytics.query.saved
  - analytics.query.deleted
  - analytics.dashboard.created
  - analytics.dashboard.updated
  - analytics.dashboard.deleted
  - analytics.dashboard.tile.added
  - analytics.dashboard.tile.removed
  - analytics.dashboard.tile.updated
  - analytics.dashboard.refreshed
  - analytics.dashboard.favorited
  - analytics.dashboard.defaultChanged
  - analytics.dashboard.tile.reordered
  - analytics.query.favorited
  - analytics.query.renamed
  - analytics.query.duplicated
  - analytics.template.saved
  - analytics.template.used
tags:
  - analytics
  - dashboard
---

# Build Analytics Dashboard

## Overview

The analytics dashboard flow takes a user from opening the Analytics Hub through building queries against CSV, `.base`, and csv-folder data sources, saving them, and composing multiple query results into a named dashboard with a tile grid. Each tile renders query results in 6 display modes: table, stat-card, line-chart, bar-chart, area-chart, and pie-chart. Dashboards support drill-down filtering, breadcrumb navigation, conditional formatting, and template export.

## Trigger

User opens the Analytics Hub via:
- Command palette: `flowti:open-analytics-hub`
- User Hub cross-hub card (Analytics card)
- Hub Registry navigation

## Steps

### 1. Open Analytics Hub

- **View/Service**: AnalyticsHubView (BaseHubView subclass)
- **User Action**: User runs `flowti:open-analytics-hub` or clicks the Analytics card in User Hub
- **System Response**: Hub opens to the dashboard overview page showing query count and dashboard count stats. Tab bar shows "Dashboards" and "Queries" tabs
- **Events**: `analytics.loaded` (emitted during service load with `{ queryCount, dashboardCount }`)

### 2. Add Data Sources

- **View/Service**: QueriesTab (master panel)
- **User Action**: User clicks the "Queries" tab, then selects CSV files from the "CSV Sources" section or `.base` files from the "Base Views" section in the source picker
- **System Response**: CSV files are listed from vault scan (`.csv` extension). Base files are listed from vault scan (`.base` extension). CSV folders can merge timestamped files. Clicking a source adds it to the active query with an alias via SourceManager. For CSV sources, the file is parsed immediately with locale detection; for `.base` sources, the BaseAnalyticsAdapter resolves columns and vault files into tabular data. SourcePreviewPanel shows column names, types, row count, and sample data. Quick Insights suggest auto-queries based on detected column types
- **Events**: (none — UI state only)

### 3. Configure Query

- **View/Service**: QueriesTab (detail panel)
- **User Action**: User configures the query via QueryBuilderPanel: sets column type hints (number, date, currency) via SchemaPanel click-to-insert, defines joins between sources (left/inner), selects dimensions (group-by columns), picks measures (SUM, COUNT, AVG, MIN, MAX, COUNT_DISTINCT), adds filters via FilterBuilderPanel (type-aware operators + value suggestions), configures multi-column sort, adds computed columns with expressions (arithmetic + ROUND/ABS/IF/CHANGE/PCT_CHANGE/ROLLING_AVG), and optionally sets time bucketing (month/quarter/year)
- **System Response**: Detail panel renders the query builder form with sections for each configuration aspect. SchemaPanel shows columns grouped by type with source badges. Per-source locale selection available for CSV sources. Expression validator checks syntax inline on blur. Filter/sort count badges show active configuration
- **Events**: (none — UI state only)

### 4. Execute Query

- **View/Service**: AnalyticsService → AnalyticsEngine
- **User Action**: User clicks "Run Query"
- **System Response**: AnalyticsService emits `analytics.query.started`, delegates to AnalyticsEngine which performs in-memory aggregation, then emits `analytics.query.completed` with row count and duration. Results are displayed via AnalyticsResultsPanel with stat cards for numeric aggregates and a sortable table for all rows
- **Events**: `analytics.query.started` → `analytics.query.completed` (or `analytics.query.failed`)

### 5. Save Query

- **View/Service**: AnalyticsService
- **User Action**: User clicks "Save Query" and enters a name
- **System Response**: Query configuration (sources with paths/types, joins, dimensions, measures, time bucket) is persisted to TypedStorage under `"analytics"` key. A JSON file is also written to the configured query folder in the vault. The saved query appears in the master panel's saved queries list
- **Events**: `analytics.query.saved` (`{ queryId, queryName }`)

### 6. Create Dashboard

- **View/Service**: DashboardsTab (master panel)
- **User Action**: User switches to the "Dashboards" tab and clicks "New Dashboard", entering a name
- **System Response**: A new dashboard is created via `AnalyticsService.createDashboard()` with an empty tile array. It appears in the master panel's dashboard list
- **Events**: `analytics.dashboard.created` (`{ dashboard }`)

### 7. Add Tiles

- **View/Service**: DashboardsTab (detail panel) + AddTileDialog
- **User Action**: User selects a dashboard from the master list, then clicks "Add Tile" in the detail panel. The AddTileDialog shows a saved query dropdown and display mode selector (6 modes: table, stat-card, line-chart, bar-chart, area-chart, pie-chart). `suggestDisplayMode()` auto-suggests the best mode. User picks a query and mode, then clicks "Add"
- **System Response**: A tile is created via `AnalyticsService.addTile()` with auto-positioned row/col. The tile grid re-renders with CSS Grid layout (5-column grid, width/height 1-5). The tile asynchronously executes its referenced query via QueryResultCache (LRU, max 20) and renders results. Freshness indicator shows time since last refresh
- **Events**: `analytics.dashboard.tile.added` (`{ dashboardId, tile }`)

### 8. View Dashboard

- **View/Service**: DashboardsTab + DashboardTileRenderer
- **User Action**: User views the tile grid
- **System Response**: Each tile renders its query results via DashboardTileRenderer. Table mode renders sortable table with conditional formatting. Stat-card mode shows numeric values with sparklines. Chart modes (line, bar, area, pie) render SVG via ChartRenderer. Tiles cache results per query ID via TileResultCache; error boundaries catch render failures. Each tile has a header with title, mode toggle, settings gear, and remove button. DashboardFilterBar shows multi-select dimension filters. DashboardBreadcrumbs shows drill-down navigation path. DashboardQueryMap shows query transparency
- **Events**: (none — read-only render)

### 9. Manage Dashboard (Optional)

- **View/Service**: DashboardsTab
- **User Action**: User can remove tiles (click X on tile header), delete dashboards (click delete in master list), or update dashboard name/description
- **System Response**: Corresponding CRUD operations via AnalyticsService. Tile removal clears result cache and triggers re-render. Dashboard deletion removes from master list
- **Events**: `analytics.dashboard.tile.removed`, `analytics.dashboard.deleted`, `analytics.dashboard.updated`

## Decision Points

| Decision | Options | Default |
|----------|---------|---------|
| Data source type | CSV file / `.base` vault view / csv-folder | CSV |
| Tile display mode | Table / Stat-card / Line-chart / Bar-chart / Area-chart / Pie-chart | Table |
| Aggregation function | SUM, COUNT, AVG, MIN, MAX, COUNT_DISTINCT | SUM |
| Time bucketing | None / Month / Quarter / Year | None |
| Source locale | auto / en-US / de-DE / en-GB / nl-NL / fr-FR | auto |
| Join type | Left / Inner | Left |
| Tile size | 1×1 to 5×5 grid units | 1×1 |

## Events Sequence

```
[open hub] → analytics.loaded →
[run query] → analytics.query.started → analytics.query.completed →
[save query] → analytics.query.saved →
[create dashboard] → analytics.dashboard.created →
[add tile] → analytics.dashboard.tile.added →
[view results] → (tile executes query → analytics.query.started → analytics.query.completed)
```

## Related Flows

- [[Drill-Down Dashboard]] — Interactive dashboard filtering and drill-down navigation
- [[Analyze CSV in Analytics Hub]] — Right-click CSV to open in Analytics Hub with source pre-selected
- [[Export Vault Data]] — `.base` files used as analytics sources are the same files used for exports
- [[Browse and Configure Events]] — analytics events appear in the Event Catalog under "Analytics" category
- [[Navigate the User Hub]] — Analytics Hub card shows query + dashboard counts
- [[Import CSV as Notes]] — Imported CSV files become available as analytics sources

## Related Decisions

- [[ADR-001 EventBus Architecture]] — all analytics operations emit events through EventBus
- [[ADR-004 Single JSON Blob Storage]] — AnalyticsState persisted under `"analytics"` TypedStorage key
- [[ADR-024 BaseHubView Shell Extraction]] — AnalyticsHubView extends BaseHubView for consistent hub shell

## Known Debt

- No drag-and-drop tile reordering — tiles use move up/down buttons
- No date range filter — planned (PBI-ANA-130)
- No cross-tile filtering — planned (PBI-ANA-132)

## Learnings

- [[L-31 Obsidian createEl value gotcha]] — `createEl("option")` doesn't accept `value` in DomElementInfo; set `.value` separately
- [[L-32 FlowtiEvent wrapper in tests]] — event handlers receive wrapper with `.payload`, not raw payload
- [[L-33 Test count estimates need grounding]] — UI component tests require more obsidian-stub enhancements than anticipated
