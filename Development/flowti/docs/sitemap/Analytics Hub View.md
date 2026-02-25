---
stage: done
domain: Flowti
plugin: "[[Development/flowti/README|README]]"
tags:
  - analytics
  - view
  - hub
description: Dedicated analytics hub for CSV and .base data analysis with dashboards and query builder
type: View
viewType: flowti-analytics-hub
extends: BaseHubView
source: "[[Development/flowti/src/ui/AnalyticsHubView.ts|AnalyticsHubView.ts]]"
feature: "[[Analytics Hub PRD]]"
parent: "[[User Hub View]]"
---

# Analytics Hub View

## Description

The Analytics Hub is the dedicated view for data analysis, query building, and dashboard management. It extends BaseHubView with 2 tabs: **Dashboards** and **Queries**. The hub provides a complete analytics workflow from data source selection through query execution to dashboard composition with tile grids.

The hub supports 3 data source types (CSV files, `.base` vault views, csv-folder merge), a visual query builder with dimensions/measures/filters/sort/computed columns, 6 tile display modes (table, stat-card, line-chart, bar-chart, area-chart, pie-chart), and interactive features including drill-down, cross-filtering, breadcrumb navigation, and conditional formatting.

## Pages

### Dashboard Overview (landing page)

The default page shows:
- Pinned dashboard summary cards (up to 3)
- Default dashboard tile grid (if set)
- Stats fallback (query count, dashboard count) when no default dashboard
- "Refresh All" button for dashboard data refresh
- Quick navigation to Dashboards and Queries tabs

### Dashboards Tab

Master-detail layout:
- **Master**: Dashboard list with tile counts, favorite stars, search filter
- **Detail**: CSS Grid tile layout (5-column), filter bar with cascading dimension filters, breadcrumb navigation for drill-down context, "Add Tile" dialog

### Queries Tab

Master-detail layout:
- **Master**: Saved query list (favorites first) + collapsible source picker (CSV, .base, csv-folder)
- **Detail**: Query builder form (schema panel, dimensions, measures, filters, sort, computed columns, time bucket), results section (stat cards + sortable table), actions bar (Run, Save, Export CSV, Add to Dashboard)

## Components

### Core Components
| Component | Source | Description |
|-----------|--------|-------------|
| [[AnalyticsHubView]] | `src/ui/AnalyticsHubView.ts` | Hub orchestrator (308 LOC), BaseHubView subclass |
| [[AnalyticsDashboardPage]] | `src/ui/analytics/AnalyticsDashboardPage.ts` | Landing page with pinned dashboards and stats |
| [[DashboardsTab]] | `src/ui/analytics/DashboardsTab.ts` | Dashboard master-detail with tile grid |
| [[QueriesTab]] | `src/ui/analytics/QueriesTab.ts` | Query builder master-detail (930 LOC) |

### Dashboard Components
| Component | Source | Description |
|-----------|--------|-------------|
| [[DashboardTileRenderer]] | `src/ui/analytics/DashboardTileRenderer.ts` | Tile rendering (table/stat-card/chart modes) |
| [[DashboardFilterBar]] | `src/ui/analytics/DashboardFilterBar.ts` | Multi-select dimension filter dropdowns |
| [[DashboardBreadcrumbs]] | `src/ui/analytics/DashboardBreadcrumbs.ts` | Navigation breadcrumbs for drill-down context |
| [[DashboardQueryMap]] | `src/ui/analytics/DashboardQueryMap.ts` | Query transparency: shows queries per dashboard |
| [[DashboardNameModal]] | `src/ui/analytics/DashboardNameModal.ts` | Modal for creating/editing dashboard names |
| [[TileSettingsPanel]] | `src/ui/analytics/TileSettingsPanel.ts` | Per-tile conditional formatting and display settings |
| [[AddTileDialog]] | `src/ui/analytics/AddTileDialog.ts` | Inline dialog for tile creation |
| [[ChartRenderer]] | `src/ui/analytics/ChartRenderer.ts` | SVG chart rendering (line, bar, area, pie) |

### Query Sub-Components
| Component | Source | Description |
|-----------|--------|-------------|
| [[QueryBuilderPanel]] | `src/ui/analytics/queries/QueryBuilderPanel.ts` | Main query configuration form |
| [[SchemaPanel]] | `src/ui/analytics/queries/SchemaPanel.ts` | Column browser with click-to-insert |
| [[FilterBuilderPanel]] | `src/ui/analytics/queries/FilterBuilderPanel.ts` | Type-aware filter row builder |
| [[SourcePanel]] | `src/ui/analytics/queries/SourcePanel.ts` | Source picker and management |
| [[ResultsSection]] | `src/ui/analytics/queries/ResultsSection.ts` | Results display (stat cards + table) |
| [[ActionsBar]] | `src/ui/analytics/queries/ActionsBar.ts` | Run/Save/Export/Add to Dashboard buttons |
| [[SavedQueryList]] | `src/ui/analytics/queries/SavedQueryList.ts` | Saved query list with favorites |
| [[ComputedColumnsSection]] | `src/ui/analytics/queries/ComputedColumnsSection.ts` | Formula expressions with function help |

### Other Components
| Component | Source | Description |
|-----------|--------|-------------|
| [[MeasurementsTab]] | `src/ui/analytics/MeasurementsTab.ts` | Measurement/column type management |
| [[SourcePreviewPanel]] | `src/ui/analytics/SourcePreviewPanel.ts` | Source column preview with sample data |
| [[NewQueryModal]] | `src/ui/analytics/NewQueryModal.ts` | Modal for creating new queries |
| [[TileResultCache]] | `src/ui/analytics/TileResultCache.ts` | Client-side tile result caching |

## Domain Services

| Service | Source | Description |
|---------|--------|-------------|
| AnalyticsService | `src/domain/analytics/AnalyticsService.ts` | Query + dashboard CRUD, persistence, events (619 LOC) |
| AnalyticsEngine | `src/domain/analytics/AnalyticsEngine.ts` | In-memory aggregation, 3-tier evaluator (853 LOC) |
| SourceManager | `src/domain/analytics/SourceManager.ts` | Source CRUD lifecycle (226 LOC) |
| BaseAnalyticsAdapter | `src/domain/analytics/BaseAnalyticsAdapter.ts` | .base file resolution (90 LOC) |
| dashboardHandlers | `src/domain/analytics/handlers/dashboardHandlers.ts` | Dashboard/tile/favorites CRUD (355 LOC) |

## Use Cases

### Build and run an analytics query
Open Analytics Hub → Queries tab → add CSV/base source → configure dimensions, measures, filters → Run Query → view results in stat cards + table → Save Query.

### Create a dashboard with tiles
Dashboards tab → New Dashboard → Add Tile (pick saved query + display mode) → view tile grid → configure tile settings (conditional formatting, chart value column) → set as default dashboard.

### Drill-down into dashboard data
View dashboard → click table cell or stat-card label → tile filters to clicked value → breadcrumbs show drill-down path → click breadcrumb to navigate back → clear filters via × buttons.

### Analyze a CSV from file explorer
Right-click CSV file → "Analyze in Analytics Hub" → hub opens with source pre-selected → build query → save to dashboard.

## Related Flows

- [[Build Analytics Dashboard]] — End-to-end dashboard creation journey
- [[Import CSV as Notes]] — CSV files used as analytics sources originate from imports
- [[Navigate the User Hub]] — Analytics Hub card shows query + dashboard counts

## Related Decisions

- [[ADR-024 BaseHubView Shell Extraction]] — AnalyticsHubView extends BaseHubView
- [[ADR-004 Single JSON Blob Storage]] — AnalyticsState persisted under "analytics" TypedStorage key

## Events

21 analytics events: `analytics.loaded`, `analytics.query.*` (9), `analytics.dashboard.*` (10), `analytics.template.*` (2). See [[Analytics Hub PRD]] Section 7 for full catalog.

## Test Coverage

- **Domain tests**: 16 test files in `tests/domain/analytics/`
- **UI tests**: 6 test files in `tests/ui/analytics/`
- **Flow tests**: 8 integration test suites in `tests/flows/` (Flows 17, 18, 19, 25, 28, 29, 30, 31, 32, 37)
- **Total**: ~557 analytics-specific tests
