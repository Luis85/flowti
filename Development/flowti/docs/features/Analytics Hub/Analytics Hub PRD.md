---
domain: Analytics
plugin: "[[Development/flowti/README|README]]"
type: ProductRequirementsDocument
stage: delivered
version: 13
maturity: L2
created: 2026-02-23
updated: 2026-02-25
supplier_prd: "[[Feature - Supplier Management]]"
foundation: "[[When opening a CSV with Flowti, I want to be able to make an easy dashboard]]"
related_events:
  - analytics.query.started
  - analytics.query.completed
  - analytics.query.failed
  - analytics.query.saved
  - analytics.query.deleted
  - analytics.query.favorited
  - analytics.dashboard.created
  - analytics.dashboard.updated
  - analytics.dashboard.deleted
  - analytics.dashboard.favorited
  - analytics.dashboard.defaultChanged
  - analytics.dashboard.tile.added
  - analytics.dashboard.tile.removed
  - analytics.dashboard.tile.updated
  - analytics.dashboard.refreshed
  - analytics.loaded
  - analytics.query.renamed
  - analytics.query.duplicated
  - analytics.dashboard.tile.reordered
maturity_score_strategy: 4
maturity_score_scope: 4
maturity_score_architecture: 4
maturity_score_event_integration: 4
maturity_score_data_model: 4
maturity_score_ui_consistency: 4
maturity_score_validation_testing: 3
business_value: 4
implementation_cost: 3
maintenance_cost: 2
discovery_cost: 1
design_cost: 3
test_cost: 3
priority: 4
tags:
  - analytics
  - dashboard
  - hub
  - prd
  - core
---

# Analytics Hub PRD

## 1. Problem Statement

Analytics currently lives as a tab within the Data Exchange Hub (9 tabs total). This creates four problems:

1. **Context switching** — Users who want to build queries and dashboards must navigate through a 9-tab DX Hub whose primary purpose is import/export operations. The Analytics tab is the last in the list, buried behind 8 unrelated tabs.

2. **No dashboard composition** — Users can run individual queries and see results, but there is no way to compose multiple query results into a single view. Each query execution is isolated — the user cannot see "cost per supplier" alongside "sales count per month" in a unified dashboard.

3. **Source limitation** — Analytics can only consume CSV files. The plugin already has a rich `.base` file system (BaseQueryEngine) that filters and projects vault notes via YAML configuration. This structured data source is invisible to the analytics engine.

4. **Domain coupling** — `SavedAnalyticsQuery` is stored inside `DataExchangeState` and `AnalyticsService` shares the `"dataExchange"` TypedStorage key. This couples analytics persistence to data exchange, making independent evolution difficult.

## 2. Outcome

- Users have a **dedicated Analytics Hub** for building, saving, and composing queries
- Users can create **named dashboards** — tile grids where each tile references a saved query and displays its results (table, stat cards, or summary)
- The analytics engine can consume **`.base` files** as data sources, treating vault note frontmatter as tabular data
- Analytics has its **own persistence** (`"analytics"` storage key) with backward-compatible migration from `DataExchangeState`
- DX Hub loses the Analytics tab, returning focus to import/export/pipeline/signal operations (8 tabs)

## 3. Scope

### In Scope

- New `AnalyticsHubView` extending `BaseHubView` with 2 tabs: Dashboards, Queries
- Dashboard domain: `Dashboard` and `DashboardTile` types, service CRUD, events, TypedStorage persistence
- Dashboard tile grid UI: named dashboards, tile layout, tile rendering (table + stat-card display modes)
- `.base` file analytics source adapter via `BaseAnalyticsAdapter`
- Migration of `savedAnalyticsQueries` from `DataExchangeState` to `AnalyticsState`
- Removal of Analytics tab from Data Exchange Hub
- `AnalyticsHubProvider` for cross-hub summary in User Hub
- `flowti:open-analytics-hub` command
- Hub lifecycle events (inherited from BaseHubView)

### Out of Scope

- Charts or visualizations (bar charts, line graphs) — tables and stat cards only in v1
- Drag-and-drop tile reordering — manual position editing in v1
- Dashboard sharing or export (export individual query results stays)
- Real-time dashboard auto-refresh (manual refresh per tile)
- Calculated columns or derived measures
- Dashboard templates
- Reports tab (future, reserved slot)

## 4. UX Entry Points

- **Analytics Hub** — new Obsidian view (`flowti-analytics-hub`), opens via:
  - Command palette: `flowti:open-analytics-hub`
  - User Hub cross-hub card
  - Hub Registry navigation
- **Dashboards tab** (default landing) — overview stats, then drill into named dashboards
- **Queries tab** — migrated from current DX Hub AnalyticsTab; master/detail split with source picker + query builder

Primary interaction path:
1. User opens Analytics Hub (command palette or User Hub card)
2. Hub opens to dashboard overview (query count, dashboard count, recent runs)
3. User clicks a dashboard name to see its tile grid
4. Each tile shows query results (table or stat cards)
5. User navigates to Queries tab to build/edit/save queries
6. User returns to Dashboards tab and adds tiles referencing saved queries

## 5. Functional Requirements

### Analytics Hub Shell

- [x] FR-01: Analytics Hub is a separate BaseHubView subclass with VIEW_TYPE `"flowti-analytics-hub"` and hub ID `"analytics"`
- [x] FR-02: Analytics Hub has 2 tabs: Dashboards (tile grid), Queries (query builder)
- [x] FR-03: Hub dashboard page shows overview stats: saved query count, dashboard count, last query run time
- [x] FR-04: Analytics Hub is accessible via command palette (`flowti:open-analytics-hub`) and User Hub cross-hub card

### Dashboard Domain

- [x] FR-05: User can create a named dashboard (title, optional description)
- [x] FR-06: User can add tiles to a dashboard; each tile references a saved query ID and specifies a display mode (table or stat-card)
- [x] FR-07: User can remove tiles from a dashboard
- [x] FR-08: User can delete a dashboard
- [x] FR-09: Dashboard and tile state is persisted via TypedStorage under key `"analytics"`
- [x] FR-10: Dashboard tiles render query results inline using AnalyticsResultsPanel (table mode) or stat card summary (stat-card mode)

### State Migration

- [x] FR-11: On first load, AnalyticsService reads `savedAnalyticsQueries` from the `"dataExchange"` storage key and migrates them to the `"analytics"` key; after migration, the old field is cleared

### Source Enhancement

- [x] FR-12: Analytics source picker shows `.base` files alongside CSV files; user can select a `.base` file as an analytics source
- [x] FR-13: `BaseAnalyticsAdapter` resolves `.base` files using BaseQueryEngine + vault file scanning to produce headers + rows compatible with the analytics engine

### DX Hub Cleanup

- [x] FR-14: The Analytics tab is removed from DataExchangeHubView; DX Hub tab definitions no longer include analytics

### Favorites & Default Dashboard (v2 — Cycle 29)

- [x] FR-15: User can mark dashboards as favorites; favorited dashboards appear first in dashboard lists
- [x] FR-16: User can mark saved queries as favorites; favorited queries appear first in query lists
- [x] FR-17: User can set one dashboard as the "default"; the default dashboard ID is persisted in AnalyticsState
- [x] FR-18: Hub overview page renders default dashboard tiles directly on open (zero-click to metrics); falls back to stats when no default is set
- [x] FR-19: User can refresh a single dashboard tile without leaving the dashboard; refresh re-executes the tile's query
- [x] FR-20: Creating a dashboard prompts for a name via modal dialog (no auto-naming)

### Query Power & UX Mastery (v3 — Cycle 30)

- [x] FR-21: User can add WHERE filters to queries; `FilterSpec` with column, operator (=, !=, >, <, >=, <=, contains, startsWith), and value
- [x] FR-22: User can add ORDER BY sorting to queries; `SortSpec` with column and direction (asc/desc) (superseded by FR-89 multi-column sort)
- [x] FR-23: User can set a LIMIT on query results; optional max row count applied after aggregation
- [x] FR-24: Source preview panel shows column names, inferred types, row count, and first 5 sample rows when a source is loaded
- [x] FR-25: User can rename a saved query; new name persists
- [x] FR-26: User can duplicate a saved query; clone has new ID and " (copy)" suffix
- [x] FR-27: Stat-card tiles render all result rows as dimension-grouped cards (not just first row); capped at 20 groups with overflow
- [x] FR-28: Dashboard name and description are editable inline in the dashboard detail header; changes persist

### Business Intelligence (v4 — Cycle 31)

- [x] FR-29: User can add computed columns to a query with a name and arithmetic expression (e.g., `{Total Revenue} - {Total Cost}` → "Profit"); supports `+`, `-`, `*`, `/`
- [x] FR-30: Analytics engine evaluates computed column expressions after aggregation and includes computed values in result rows and column lists
- [x] FR-31: When a source is loaded and column types detected, the system generates up to 3 Quick Insight suggestions based on column types (numeric → SUM, text → GROUP BY, date → time bucket)
- [x] FR-32: User can click a Quick Insight to populate the query builder with suggested dimensions, measures, and time bucket, then auto-execute
- [x] FR-33: Each dashboard tile displays a relative time indicator showing when the tile's query was last executed; visual color-coding by freshness (green/amber/red)
- [x] FR-34: Dashboard header shows freshness summary ("All tiles fresh" / "N stale tiles"); tiles show "Not yet refreshed" before first execution
- [x] FR-35: After a CSV import completes in the Data Exchange Hub, an inbox item "Analyze [filename] in Analytics Hub" is created
- [x] FR-36: Analytics Hub overview page shows a "Recent Sources" section with the 5 most recently modified CSV files and an "Analyze" action per source

### Visualization & Formatting (v5 — Cycle 32)

- [x] FR-37: Dashboard tiles support "line-chart" display mode; SVG line chart renders aggregated values with axis labels and data point markers
- [x] FR-38: Dashboard tiles support "bar-chart" display mode; SVG bar chart renders comparison data with value labels above bars
- [x] FR-39: User can configure conditional formatting rules per tile; each rule specifies a column, comparison operator, threshold value, and color
- [x] FR-40: Conditional formatting applies color coding to stat-card values (text color) and table cells (background tint) based on matching rules
- [x] FR-41: Stat-card tiles can show sparkline mini-charts visualizing trend across result rows; sparklines render when ≥3 data points exist and can be toggled per tile
- [x] FR-42: Chart tiles auto-detect axes from query dimensions (x-axis) and measures (y-axis)

### Trend Intelligence (v6 — Cycle 33)

- [x] FR-43: User can add computed columns with window function `CHANGE({column})` that computes the absolute difference from the previous row; returns null for the first row
- [x] FR-44: User can add computed columns with window function `PCT_CHANGE({column})` that computes percentage change from the previous row; handles zero-division by returning null
- [x] FR-45: User can add computed columns with window function `ROLLING_AVG({column}, n)` that computes a rolling average over the last n rows; supports partial windows for the first n-1 rows
- [x] FR-46: User can add computed columns with scalar function `ROUND({column}, n)` that rounds numeric values to n decimal places
- [x] FR-47: User can add computed columns with scalar function `ABS({column})` that returns the absolute value
- [x] FR-48: User can add computed columns with scalar function `IF({column} op threshold, thenValue, elseValue)` that returns conditional values; supports string and numeric return types
- [x] FR-49: User can visually add, edit, and remove conditional formatting rules per dashboard tile via a collapsible settings panel with column dropdown (including computed columns), operator, threshold, and color preset picker
- [x] FR-50: User can pin up to 3 dashboards to the Analytics Hub homepage; pinned dashboards render as compact summary cards above the default dashboard; pin state persists
- [x] FR-51: Saved queries section appears above source files section in the Queries tab master list; sources section is collapsible and defaults to collapsed when saved queries exist

### Inventory Discovery & Dashboard Integration (v7 — Cycle 34)

- [x] FR-52: Dashboard tiles support "area-chart" display mode; SVG area chart renders filled regions with line overlay and dot markers; supports single-series and multi-series (time bucket + dimension)
- [x] FR-53: User can save a dashboard as a reusable template capturing queries + tiles; template stores source paths as placeholders for remapping
- [x] FR-54: User can create a new dashboard from a saved template with source path mapping; template tiles reference queries by index, fresh IDs generated on instantiation
- [x] FR-55: User can import a dashboard template from a JSON file via the Dashboards tab; file picker accepts `.json` files conforming to the DashboardTemplate schema
- [x] FR-56: Analytics Hub dashboard page renders Dashboards and Queries navigation links above the favorites section for quick tab switching
- [x] FR-57: User Hub dashboard widget renders stat-card KPI values from the default dashboard's first 3 stat-card tiles; values refresh asynchronously with 5-minute cache
- [x] FR-58: `evalIf` condition right side supports column references (e.g., `IF({Stock} < {Reorder}, 1, 0)`) in addition to numeric literals
- [x] FR-59: Query builder dimensions section shows only string/date columns (excludes columns typed as "number"); measure column dropdown shows only numeric columns when type hints exist
- [x] FR-60: `updateTile` uses a whitelist array (`TILE_MUTABLE_KEYS`) for field assignment; new DashboardTile fields are automatically included when added to the whitelist

### Supplier Manager Daily Experience (v8 — Cycle 35)

- [x] FR-61: Dashboard tile header includes a trash icon that removes the tile from the dashboard via the existing `onRemove` callback; tile settings panel allows reconfiguring query, width (1–5 columns), height (1–5 rows), auto-height, sparkline toggle, and row limit
- [x] FR-62: User can add a saved query result to any existing dashboard or a new dashboard directly from the Queries tab via an "Add to Dashboard" dropdown; display mode is auto-suggested based on result shape (stat-card for ≤5 rows, line-chart for time bucket, bar-chart for category groups, table as fallback)
- [x] FR-63: Dashboard tile header includes a download icon that exports the tile's cached result as a CSV file via the shared `downloadCsvFile` utility
- [x] FR-64: Dashboard tile header includes a "View Query" icon that navigates to the Queries tab with the tile's source query loaded and auto-executed
- [x] FR-65: Saved queries support an optional `description` field ("What question does this query answer?") editable inline in the query detail header; description is shown in the saved query master list and tile settings query selector
- [x] FR-66: Dashboard tile header shows a row count badge displaying the number of rows in the cached result; dashboard detail header shows a freshness summary indicating the staleness of tile data
- [x] FR-67: CSV generation utilities (`escapeCsvField`, `rowsToCsv`, `downloadCsvFile`) are consolidated in `src/utils/csvUtils.ts` as shared infrastructure (TD-126 resolved)

### Dashboard Drill-Down & Filtering (v10 — Cycle 36)

- [x] FR-68: DashboardTileRenderer settings panel is extracted into a dedicated `TileSettingsPanel.ts` component (~296 LOC), reducing the renderer from 794 to ~540 LOC (below 700 LOC threshold)
- [x] FR-69: Pie chart is available as the 6th TileDisplayMode; renders pure SVG segments proportional to value column with legend showing label + percentage; segments below 3% or beyond 12 are grouped into "Other"
- [x] FR-70: Dashboard detail header shows a filter bar with multi-select dimension dropdowns populated from tile result string columns (max 4 dimensions, sorted by value count ascending); dropdowns support toggle selection with checkmarks on selected values and "N selected" label; cascading dimension discovery narrows dropdown options based on active filters (e.g., filtering by category narrows item_id dropdown to items in that category)
- [x] FR-71: Active dashboard filters are propagated to all tile queries at execution time via `runSavedQueryWithFilters()`; multi-value filters use OR logic within a column (`values.includes()`) and AND logic across columns; filter-aware cache keys (sorted values) ensure re-execution on filter change
- [x] FR-72: String values in table cells and dimension labels in stat-card tiles are clickable for drill-down — clicking toggles the value in the dashboard filter for that column (adds if absent, removes if present); clicking the last value for a column removes the column filter entirely; numeric values are not clickable
- [x] FR-73: Active filters display as per-value breadcrumb chips above the tile grid — each selected value has its own chip with an individual clear button (x); "Clear all" action removes all filters; filters reset automatically when switching dashboards
- [x] FR-74: Active drill-down values show visual feedback — accent color on matching stat-card labels and bold + accent on matching table cells
- [x] FR-75: Dashboard tile grid supports 6x6 layout (6 columns, width and height 1-6); favourite queries section moved below dashboard tiles with headline, description, and query description display
- [x] FR-76: Dashboard filter dropdowns support multi-select comparison — users can select multiple values within a single dimension (e.g., SUP-A + SUP-B) to compare suppliers side-by-side across all dashboard tiles; toggle behavior (add/remove) replaces single-select replace
- [x] FR-77: Dashboard filter dimensions are cascading/dependent — `discoverFilterDimensions()` uses filtered results for dimension value discovery so selecting a category narrows other dimension dropdowns to only values present in the filtered dataset; active filter columns are retained even when cascading reduces them to a single unique value

### Cross-Domain Integration (v12 — Cycle 37)

- [x] FR-78: `AnalyticsService.getQueriesBySource(csvPath)` returns saved queries that reference a specific CSV source path; supports multi-source queries (matches any source)
- [x] FR-79: `AnalyticsService.getDashboardQueryMap(dashboardId)` returns a map of unique queries powering a dashboard's tiles with per-query tile counts
- [x] FR-80: Dashboard detail view shows a collapsible "Queries" section between header and tile grid listing all unique queries with source file basenames, tile counts, and freshness; each query name is clickable (navigates to Queries tab)
- [x] FR-81: Dashboard tile headers display a source subtitle showing the source CSV filename(s) below the tile title (e.g., "Suppliers.csv" or "Orders.csv + 1 more")
- [x] FR-82: CsvLanding page includes an "Analytics" section showing saved queries that reference this CSV file, with query name, auto-summary (description or "FUNCTION(col) by dim"), freshness, and "Open in Analytics Hub" navigation
- [x] FR-83: CsvLanding Analytics section shows empty state with "Create Query" action that navigates to Analytics Hub Queries tab with the CSV pre-selected as source
- [x] FR-84: CSV right-click file menu includes "Analyze in Analytics Hub" item that opens the Analytics Hub Queries tab with the CSV file path as navigation entity
- [x] FR-85: Analytics Hub `onNavigateToEntity` routes CSV file paths to Queries tab with automatic source addition; routes query IDs to query loading; routes dashboard IDs to dashboard selection. Related queries section in master list shows saved queries sharing sources with the active query

### Query Builder Improvements (v13 — Cycle 38)

- [x] FR-86: Schema panel displays all available columns grouped by detected type (number, date, string) with column count and source alias badges for multi-source queries; panel is collapsible (default expanded)
- [x] FR-87: Column picker utility renders `<select>` elements with `<optgroup>` by type; used in dimension, measure, filter column, and sort column dropdowns
- [x] FR-88: Filter builder displays type-appropriate operators per column: string columns show `=, !=, contains, startsWith`; number/date columns show `=, !=, >, <, >=, <=`; string columns show a `<datalist>` with up to 20 distinct values from loaded source data (scanned up to 1,000 rows)
- [x] FR-89: Queries support multi-column sort — `SortSpec[]` array with independent direction per column; engine chains comparisons left-to-right with stable tie-breaking; saved queries with legacy single `SortSpec` are migrated to array on load
- [x] FR-90: Expression validator checks computed column expressions in real-time on blur: validates balanced braces, valid column references, valid function names (ROUND, ABS, IF, CHANGE, PCT_CHANGE, ROLLING_AVG), and argument counts; inline error messages displayed below input
- [x] FR-91: Quick Insights generates up to 6 auto-suggested queries (up from 3): Total by, Count by, Over Time, Average by, Top 5, Distribution; "Top 5" includes sort desc + limit 5; "Distribution" groups by 2 text columns
- [x] FR-92: Schema panel columns are clickable — clicking a number column adds it as a SUM measure, clicking a text/date column adds it as a dimension; de-duplicates (no-op if already present)
- [x] FR-93: Filter and sort section headers show count badges indicating the number of active filters and sort columns
- [x] FR-94: Ctrl+Enter (Cmd+Enter on Mac) keyboard shortcut runs the query from anywhere within the detail panel

## 6. Data Model Impact

### New Types

| Type | Fields | Storage |
|------|--------|---------|
| `TileDisplayMode` | `"table" \| "stat-card" \| "line-chart" \| "bar-chart" \| "area-chart" \| "pie-chart"` | Runtime |
| `AnalyticsSourceType` | `"csv" \| "base"` | Runtime |
| `DashboardTile` | id, queryId, title?, displayMode, row, col, width, height, conditionalRules?, showSparkline? | `"analytics"` key |
| `Dashboard` | id, name, description?, isFavorite?, tiles[], createdAt, updatedAt | `"analytics"` key |
| `AnalyticsState` | savedAnalyticsQueries[], dashboards[], defaultDashboardId? | `"analytics"` key |

### Modified Types

| Type | Change |
|------|--------|
| `SavedAnalyticsQuerySource` | Add `sourcePath`, `sourceType` (`"csv" \| "base"`), `viewIndex?`; backward-compat with existing `csvPath` |
| `SavedAnalyticsQuery` | Add `isFavorite?: boolean` (v2); add `filters?: FilterSpec[]`, `sort?: SortSpec[]`, `limit?: number` (v3, v13 array); add `computedColumns?: ComputedColumn[]` (v4); add `description?: string` (v8) |
| `AnalyticsQuery` | Add `filters?: FilterSpec[]`, `sort?: SortSpec[]`, `limit?: number` (v3, v13 array); add `computedColumns?: ComputedColumn[]` (v4) |

### v3 Types (Cycle 30)

| Type | Fields | Storage |
|------|--------|---------|
| `FilterSpec` | column, operator (FilterOperator), value | `"analytics"` key (in SavedAnalyticsQuery) |
| `FilterOperator` | `"=" \| "!=" \| ">" \| "<" \| ">=" \| "<=" \| "contains" \| "startsWith"` | Runtime |
| `SortSpec` | column, direction (`"asc" \| "desc"`) | `"analytics"` key (in SavedAnalyticsQuery) |

### v4 Types (Cycle 31)

| Type | Fields | Storage |
|------|--------|---------|
| `ComputedColumn` | name, expression | `"analytics"` key (in SavedAnalyticsQuery) |
| `QuickInsightSuggestion` | title, description, dimensions, measures, timeBucket? | Runtime (not persisted) |

### v5 Types (Cycle 32)

| Type | Fields | Storage |
|------|--------|---------|
| `ConditionalRule` | column, operator (`">" \| "<" \| ">=" \| "<=" \| "=" \| "!="`), threshold (number), color (preset or CSS string) | `"analytics"` key (in DashboardTile) |

### Modified Types (v5)

| Type | Change |
|------|--------|
| `TileDisplayMode` | Add `"line-chart" \| "bar-chart"` to union |
| `DashboardTile` | Add `conditionalRules?: ConditionalRule[]`, `showSparkline?: boolean` |

### v6 Types (Cycle 33)

| Type | Fields | Storage |
|------|--------|---------|
| `FunctionToken` | name, args[] | Runtime (expression parser internal) |

### Modified Types (v6)

| Type | Change |
|------|--------|
| `evaluateExpression` return type | `number` → `string \| number` (IF function can return strings) |
| `AnalyticsState` | Add `pinnedDashboardIds?: string[]` (max 3 dashboard IDs) |

### v7 Types (Cycle 34)

| Type | Fields | Storage |
|------|--------|---------|
| `SavedQueryTemplate` | originalSources[], queryConfig (Omit<SavedAnalyticsQuery, "id"\|"createdAt"\|"sources"\|...>) | `"analytics"` key (in DashboardTemplate) |
| `DashboardTileTemplate` | queryIndex, title, displayMode, width, height, conditionalRules?, chartValueColumn? | `"analytics"` key (in DashboardTemplate) |
| `DashboardTemplate` | id, name, description, domain, queries[], tiles[], createdAt | `"analytics"` key |
| `DashboardStatItem` | label, value, icon?, color? | Runtime (HubSummary) |

### Modified Types (v7)

| Type | Change |
|------|--------|
| `TileDisplayMode` | Add `"area-chart"` to union |
| `AnalyticsState` | Add `templates?: DashboardTemplate[]` |
| `DashboardTile` | Add `chartValueColumn?: string` |
| `HubSummary` | Add `dashboardStats?: DashboardStatItem[]` |

### Modified Types (v10)

| Type | Change |
|------|--------|
| `TileDisplayMode` | Add `"pie-chart"` to union |
| `AnalyticsHubState` | Add `dashboardFilters: DashboardFilter[]` (runtime-only, not persisted) |

### New Types (v10)

| Type | Fields | Storage |
|------|--------|---------|
| `DashboardFilter` | `{ column: string; values: string[] }` | Runtime (multi-select, OR within column) |
| `FilterDimension` | `{ column: string; values: string[] }` | Runtime (discovered from tile results) |

### Modified Types (v12)

| Type | Change |
|------|--------|
| `AnalyticsHubState` | Add `pendingSourcePath: string \| null` (runtime, consumed once on render) |
| `CsvComponentDeps` | Add optional `getQueriesBySource?`, `openAnalyticsHub?` |

### New Types (v12)

| Type | Fields | Storage |
|------|--------|---------|
| `QueryMapEntry` | `{ query: SavedAnalyticsQuery; tileCount: number; sourceBasenames: string[] }` | Runtime (DashboardQueryMap component) |

### Modified Types (v13)

| Type | Change |
|------|--------|
| `AnalyticsQuery.sort` | `SortSpec \| undefined` → `SortSpec[] \| undefined` (multi-column sort) |
| `SavedAnalyticsQuery.sort` | `SortSpec \| undefined` → `SortSpec[] \| undefined` (migration on load) |
| `QuickInsightSuggestion` | Add `sort?: SortSpec[]`, `limit?: number` |

### New Types (v13)

| Type | Fields | Storage |
|------|--------|---------|
| `ExpressionValidationResult` | `{ valid: boolean; errors: string[] }` | Runtime (expressionValidator) |
| `AnalyticsHandlerContext` | getState, save, eventBus, generateId, getQuery, getDashboard | Runtime (handler module context) |

### Removed from DataExchangeState

| Field | Reason |
|-------|--------|
| `savedAnalyticsQueries?: SavedAnalyticsQuery[]` | Migrated to `AnalyticsState` |

## 7. Event Impact

### New Events (8)

| Event | Payload | Category | Tags |
|-------|---------|----------|------|
| `analytics.dashboard.created` | `{ dashboardId, name }` | Analytics | — |
| `analytics.dashboard.updated` | `{ dashboardId, name }` | Analytics | — |
| `analytics.dashboard.deleted` | `{ dashboardId, name }` | Analytics | — |
| `analytics.dashboard.tile.added` | `{ dashboardId, tileId, queryId }` | Analytics | — |
| `analytics.dashboard.tile.removed` | `{ dashboardId, tileId }` | Analytics | — |
| `analytics.dashboard.tile.updated` | `{ dashboardId, tileId }` | Analytics | — |
| `analytics.loaded` | `{ queryCount, dashboardCount }` | Analytics | `["system"]` |

### v2 Events (3 — Cycle 29)

| Event | Payload | Category | Tags |
|-------|---------|----------|------|
| `analytics.query.favorited` | `{ queryId, queryName, isFavorite }` | Analytics | — |
| `analytics.dashboard.favorited` | `{ dashboardId, dashboardName, isFavorite }` | Analytics | — |
| `analytics.dashboard.defaultChanged` | `{ dashboardId: string \| null, dashboardName?: string }` | Analytics | — |

### Existing Events (retained)

5 query lifecycle events: `analytics.query.started`, `.completed`, `.failed`, `.saved`, `.deleted`

### v3 Events (3 — Cycle 30)

| Event | Payload | Category | Tags |
|-------|---------|----------|------|
| `analytics.query.renamed` | `{ queryId, oldName, newName }` | Analytics | — |
| `analytics.query.duplicated` | `{ originalQueryId, newQueryId, newQueryName }` | Analytics | — |
| `analytics.dashboard.tile.reordered` | `{ dashboardId, tileId, direction }` | Analytics | — |

### v7 Events (2 — Cycle 34)

| Event | Payload | Category | Tags |
|-------|---------|----------|------|
| `analytics.template.saved` | `{ templateId, templateName, domain }` | Analytics | — |
| `analytics.template.used` | `{ templateId, dashboardId, dashboardName }` | Analytics | — |

**Total analytics events:** 21 (12 v1 + 1 loaded + 3 v2 + 3 v3 + 2 v7)

### Consumed

- `settings.changed` — update `queryFolder` path
- Hub lifecycle events (inherited from BaseHubView)

## 8. UI Layout Impact

**New View:** `AnalyticsHubView` extending `BaseHubView<AnalyticsPage>`

Layout: BaseHubView shell (wrapper → top bar → tab bar → dashboard/split)

```
+-------------------------------------------------------------+
|  Analytics Hub                                      [gear]   |
+-------------------------------------------------------------+
|  Dashboards | Queries                                        |
+---------------------+---------------------------------------+
|  Search dashboards  |                                       |
+---------------------+  My Sales Dashboard                   |
|                     |                                       |
|  > My Sales Dash    |  +----------+ +----------+ +--------+ |
|    3 tiles          |  | Cost/Item| | Count/Mo | | Total  | |
|                     |  | (table)  | | (table)  | | (stat) | |
|  > Budget Overview  |  |          | |          | |        | |
|    2 tiles          |  +----------+ +----------+ +--------+ |
|                     |                                       |
|  [+ New Dashboard]  |                                       |
+---------------------+---------------------------------------+
```

**Tabs:**
- `Dashboards` — master: dashboard list with tile count; detail: CSS Grid tile layout
- `Queries` — master: saved queries list + source picker; detail: query builder form + results

**Removed from DX Hub:** `"analytics"` tab, `AnalyticsTab` component, `analyticsService` dependency

## 9. Adapter Impact

**New Provider:** `AnalyticsHubProvider implements HubDashboardProvider`
- `getHubId()` → `"analytics"`
- `getViewType()` → `VIEW_TYPE_ANALYTICS_HUB`
- `getDisplayName()` → `"Analytics"`
- `getIcon()` → `"bar-chart-2"`
- `getSummary()` → query count, dashboard count

**New Adapter:** `BaseAnalyticsAdapter`
- Composes `BaseQueryEngine` + vault file scanning → `ParsedSourceData` (headers + rows)
- Method: `resolveBaseSource(basePath, viewIndex, listFiles) → ParsedSourceData`
- Transforms `VaultFileInfo[]` frontmatter into tabular format for `AnalyticsEngine`

## 10. Non-Functional Requirements

- **Render debounce:** 16ms (inherited from BaseHubView)
- **Tile rendering:** on-demand per tile; max 100 rows per tile table
- **State migration:** one-time, idempotent — checks `"analytics"` key before migrating from `"dataExchange"`
- **No polling:** tiles render on hub open and on manual refresh; event-driven re-render on query execution
- **Memory:** dashboards store tile config only, not query results; results computed on demand

## 11. Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| State migration loses data if interrupted | High | Migration is idempotent; old data not deleted until new data confirmed saved |
| `.base` file resolution slow for large vaults | Medium | Reuse ExportService's `listFiles` callback (already optimized) |
| AnalyticsTab decomposition during migration creates regressions | Medium | Migrate structurally first (copy, adapt), then remove from DX Hub; keep existing tests passing |
| Tile grid layout complex with variable-sized tiles | Low | v1 uses uniform tiles (all width=1, height=1); config supports future variable sizing |
| SavedAnalyticsQuerySource schema change breaks existing queries | Medium | Backward-compat: read both `csvPath` and `sourcePath`; migration normalizes to new schema |

## 12. Acceptance Criteria

- [x] Analytics Hub opens via command palette and shows 2 tabs (Dashboards, Queries)
- [x] Queries tab reproduces all current AnalyticsTab functionality (source picker, query builder, execution, results, save/load)
- [x] User can create a dashboard, add tiles referencing saved queries, and see results rendered
- [x] User can delete dashboards and remove tiles
- [x] Analytics tab no longer appears in Data Exchange Hub
- [x] Saved queries migrated from DX state to analytics state on first load
- [x] `.base` files appear in the source picker and produce valid analytics results
- [x] Analytics Hub appears in User Hub cross-hub card with query + dashboard counts
- [x] All existing analytics tests pass (163 tests)
- [x] New tests cover: dashboard CRUD, tile CRUD, state migration, base adapter, hub view

### v2 Acceptance Criteria (Cycle 29)

- [x] User can favorite/unfavorite dashboards and queries via star icons
- [x] Favorited items sort to top of their respective lists
- [x] User can set a default dashboard; overview renders its tiles on hub open
- [x] Hub overview falls back to stats page when no default dashboard is set
- [x] Per-tile refresh re-executes the query and updates the tile
- [x] Dashboard creation prompts for a name
- [x] Flow 29 integration test passes (Supplier Manager daily workflow)

### v3 Acceptance Criteria (Cycle 30)

- [x] Query builder has Filters section: add/remove filter rows (column, operator, value) with 8 operators
- [x] Query builder has Sort dropdown (column + direction) and Limit input
- [x] Engine applies filters before grouping, sort + limit after aggregation
- [x] Source preview shows columns, types, row count, and sample data when source loaded
- [x] User can rename and duplicate saved queries
- [x] Stat-card tiles show all dimension groups (capped at 20 with overflow)
- [x] Tiles can be reordered (move up/down), renamed inline, and toggled between table/stat-card
- [x] Dashboard name and description are editable inline
- [x] "Refresh All" button clears all tile caches and re-renders
- [x] Top bar has "New Query" and "New Dashboard" shortcut buttons
- [x] "Export Summary" copies markdown summary to clipboard
- [x] 3 new events: renamed, duplicated, tile.reordered
- [x] Flow 30 integration test passes (27 tests)

### v4 Acceptance Criteria (Cycle 31)

- [x] User can add computed columns with arithmetic expressions referencing result column labels
- [x] Engine evaluates computed columns after aggregation; division by zero returns 0
- [x] Quick Insight cards appear in source preview when source is loaded (up to 3 suggestions)
- [x] Clicking a Quick Insight populates query builder and auto-executes
- [x] Dashboard tiles show relative time since last refresh with color coding (green/amber/red)
- [x] Dashboard header shows freshness summary
- [x] After CSV import, inbox item "Analyze [filename] in Analytics Hub" is created
- [x] Analytics Hub overview shows "Recent Sources" section with up to 5 CSVs
- [x] Flow 31 integration test passes (BI workflow)

### v5 Acceptance Criteria (Cycle 32)

- [x] QueriesTab decomposed into 5 sub-components; orchestrator reduced to ~350 LOC
- [x] "line-chart" and "bar-chart" tile display modes render SVG charts
- [x] Charts auto-detect x-axis (first dimension) and y-axis (first measure)
- [x] Conditional formatting rules configurable per tile (column, operator, threshold, color)
- [x] Stat-card values colored and table cells tinted based on matching rules
- [x] Built-in color presets: positive (green), negative (red), warning (amber)
- [x] Sparklines appear in stat-card tiles when ≥3 result rows; toggleable per tile
- [x] Tile mode cycles through 4 modes (table, stat-card, line-chart, bar-chart)
- [x] Flow 32 integration test passes (visualization workflow)

### v6 Acceptance Criteria (Cycle 33)

- [x] Function call parser recognizes `FUNCTION(args)` in computed column expressions
- [x] CHANGE, PCT_CHANGE, ROLLING_AVG window functions compute correct trend values
- [x] Window functions return null for insufficient data (first row, zero-division)
- [x] ROUND, ABS, IF scalar functions produce correct values per row
- [x] IF function returns string or number; string results display correctly in tables and stat-cards
- [x] Function reference help section in ComputedColumnsSection shows all 6 available functions
- [x] Collapsible tile settings panel with conditional formatting rule builder UI
- [x] Rule builder column dropdown includes computed columns; string-typed columns excluded
- [x] Up to 3 dashboards pinnable to homepage; compact summary cards render above default dashboard
- [x] Saved queries section above sources in QueriesTab; sources collapsible
- [x] Flow 33 integration test passes (trend intelligence workflow)

### v10 Acceptance Criteria (Cycle 36)

- [x] TileSettingsPanel extracted; DashboardTileRenderer under 600 LOC
- [x] Pie chart renders SVG segments with legend, "Other" grouping for <3% and >12 segments
- [x] Multi-select dimension filter dropdowns with toggle selection and "N selected" label
- [x] Cascading dimension discovery — filter dropdowns narrow based on active filters
- [x] `runSavedQueryWithFilters()` applies multi-value OR within column, AND across columns
- [x] Click-to-toggle drill-down on string values (table cells + stat-card labels)
- [x] Per-value breadcrumb chips with individual × clear buttons
- [x] Visual feedback on active drill-down values (accent color)
- [x] 6x6 tile grid layout (width/height 1-6)
- [x] Flow 36 integration test passes (31 tests)

### v12 Acceptance Criteria (Cycle 37)

- [x] `getQueriesBySource()` returns queries matching a CSV path; supports multi-source queries
- [x] `getDashboardQueryMap()` returns unique queries per dashboard with tile counts
- [x] Dashboard detail shows collapsible "Queries" section with source basenames and freshness
- [x] Dashboard tile headers show source CSV subtitle (e.g., "Suppliers.csv + 1 more")
- [x] CsvLanding "Analytics" section shows queries referencing the file with auto-summary
- [x] CsvLanding empty state shows "Create Query" action navigating to Analytics Hub
- [x] CSV right-click menu includes "Analyze in Analytics Hub" item
- [x] `onNavigateToEntity` routes CSV paths to auto-add source in Queries tab
- [x] Related queries section in master list shows queries sharing sources
- [x] Flow 37 integration test passes (26 tests)

### v13 Acceptance Criteria (Cycle 38)

- [x] Schema panel shows columns grouped by type with source badges; collapsible
- [x] Column picker utility used in dimension, measure, filter, and sort dropdowns
- [x] Filter builder shows type-appropriate operators; string columns have value datalist
- [x] Multi-column sort works with 1-N sort columns, each with independent direction
- [x] Saved queries with legacy single SortSpec migrated to array on load
- [x] Expression validator catches: empty, unbalanced braces, unknown columns, unknown functions, wrong arg counts
- [x] Validation errors display inline below expression input on blur
- [x] Quick Insights generates up to 6 suggestions; "Top 5" uses sort+limit, "Distribution" groups 2 text columns
- [x] Schema panel click-to-insert: number columns add as SUM measure, text/date as dimension
- [x] Filter/sort count badges visible in section headers
- [x] Ctrl+Enter runs query from anywhere in detail panel
- [x] AnalyticsService ≤ 620 LOC after dashboard handler extraction
- [x] QueriesTab ≤ 830 LOC after ActionsBar extraction
- [x] All existing flow tests pass (backward compat)
- [x] 4,746 tests passing (196 suites)

## 13. Definition of Done

- `VIEW_TYPE_ANALYTICS_HUB` constant added to `src/domain/hub/types.ts`
- `AnalyticsHubView` extends `BaseHubView` with all abstract methods implemented
- `AnalyticsState` type with `dashboards` and `savedAnalyticsQueries` fields
- `AnalyticsService` uses `"analytics"` storage key with migration from `"dataExchange"`
- Dashboard CRUD in AnalyticsService with events
- `AnalyticsEventMap` extended with 7 dashboard events + `analytics.loaded`
- Events registered in `src/infrastructure/events/catalog.ts`
- `AnalyticsHubProvider` registered in HubRegistry
- DX Hub `getTabDefinitions()` no longer includes `"analytics"`
- `BaseAnalyticsAdapter` in `src/domain/analytics/`
- `npm test` green
- Component docs updated

## 14. Extended Backlog

| PBI | Title | Status | Priority | Dependencies |
|-----|-------|--------|----------|-------------|
| [[PBI-ANA-010 Analytics Hub Shell]] | Hub view + query migration + DX cleanup | Delivered | Critical | — |
| [[PBI-ANA-011 Dashboard Domain]] | Types, service CRUD, events, persistence | Delivered | Critical | ANA-010 |
| [[PBI-ANA-012 Dashboard Tile Grid UI]] | Tile layout, rendering, dashboard CRUD UI | Delivered | Critical | ANA-011 |
| [[PBI-ANA-013 Base File Analytics Source]] | BaseAnalyticsAdapter + source picker | Delivered | High | ANA-010 |
| [[PBI-ANA-014 Analytics Integration and Polish]] | HubProvider, command, flow tests, polish | Delivered | High | ANA-010–013 |
| [[PBI-ANA-015 Favorite Types Foundation]] | isFavorite + defaultDashboardId types, service CRUD, events | Delivered | Critical | — |
| [[PBI-ANA-016 Dashboard First Overview]] | Overview renders default dashboard tiles on open | Delivered | Critical | ANA-015 |
| [[PBI-ANA-017 Favorites UI]] | Star icons in master lists, sort favorites first | Delivered | High | ANA-015, ANA-016 |
| [[PBI-ANA-018 Dashboard UX Polish]] | Per-tile refresh, name prompt, default badge | Delivered | High | ANA-015 |
| [[PBI-ANA-019 Supplier Manager Flow Test]] | End-to-end flow test + final polish | Delivered | High | ANA-015–018 |
| [[PBI-ANA-020 Query Power Features]] | Filters (WHERE), sort (ORDER BY), limit in engine + UI | Delivered | Critical | — |
| [[PBI-ANA-021 Source Preview and Query Usability]] | Source preview, rename, duplicate, collapsible sections | Delivered | High | ANA-020 |
| [[PBI-ANA-022 Enhanced Stat-Card and Tile Management]] | Multi-row stat cards, tile reorder/rename/mode-toggle | Delivered | High | ANA-021 |
| [[PBI-ANA-023 Dashboard Actions and Hub Polish]] | Dashboard rename/description, Refresh All, top bar, export | Delivered | High | ANA-020 |
| [[PBI-ANA-024 Analytics UX Flow Test]] | End-to-end flow test + edge cases | Delivered | High | ANA-020–023 |
| [[PBI-ANA-025 Computed Columns]] | Formula engine: arithmetic expressions on aggregated columns | Delivered | Critical | — |
| [[PBI-ANA-026 Quick Insights]] | Auto-suggested queries from detected column types | Delivered | Critical | ANA-025 |
| [[PBI-ANA-027 Data Freshness Tracking]] | Per-tile staleness indicator + dashboard freshness summary | Delivered | High | — |
| [[PBI-ANA-028 Import Analytics Bridge]] | Import completion → inbox item + Recent Sources section | Delivered | High | — |
| [[PBI-ANA-029 Business Intelligence Flow Test]] | End-to-end BI workflow integration test | Delivered | High | ANA-025–028 |
| [[PBI-ANA-030 QueriesTab Extraction]] | Sub-component extraction (1,264 → ~350 LOC orchestrator) | Delivered | Critical | — |
| [[PBI-ANA-031 Chart Tile Foundation]] | SVG line chart + bar chart as new tile display modes | Delivered | Critical | ANA-030 |
| [[PBI-ANA-032 Conditional Formatting]] | Threshold-based color coding for stat-card + table cells | Delivered | High | — |
| [[PBI-ANA-033 Chart Polish and Sparklines]] | Sparkline mini-charts in stat-card tiles + chart polish | Delivered | High | ANA-031 |
| [[PBI-ANA-034 Visualization Flow Test]] | End-to-end visualization workflow integration test | Delivered | High | ANA-030–033 |
| [[PBI-ANA-035 Trend Calculation Engine]] | Function call parser + CHANGE, PCT_CHANGE, ROLLING_AVG window functions | Delivered | Critical | ANA-025 |
| [[PBI-ANA-036 Expression Functions]] | ROUND, ABS, IF scalar functions + function help text + string\|number contract | Delivered | Critical | ANA-035 |
| [[PBI-ANA-037 Conditional Formatting Rule Builder UI]] | Collapsible tile settings panel + visual rule config (completes C32 DEV-2) | Delivered | High | ANA-032 |
| [[PBI-ANA-038 Analytics Hub Homepage Polish]] | Pinned dashboards, queries above sources, collapsible sources | Delivered | High | ANA-016 |
| [[PBI-ANA-039 Trend Intelligence Flow Test]] | End-to-end trend + formatting + homepage integration test | Delivered | High | ANA-035–038 |
| [[PBI-ANA-054 TileRenderer Extraction]] | Extract settings panel into TileSettingsPanel.ts (~296 LOC) | Delivered | Critical | — |
| [[PBI-ANA-055 Pie Chart Visualization]] | SVG pie chart as 6th TileDisplayMode | Delivered | High | ANA-054 |
| [[PBI-ANA-056 Dashboard Filter UI]] | Multi-select dimension filter dropdowns with cascading discovery | Delivered | Critical | — |
| [[PBI-ANA-057 Filter Propagation to Tiles]] | Multi-value filter execution via `runSavedQueryWithFilters()` | Delivered | Critical | ANA-056 |
| [[PBI-ANA-058 Tile Drill-Down]] | Click-to-toggle filter on string values + per-value breadcrumbs | Delivered | Critical | ANA-057 |
| [[PBI-ANA-059 Drill-Down Flow Test]] | End-to-end drill-down + filter + multi-select flow test | Delivered | High | ANA-054–058 |
| [[PBI-ANA-060 Query-by-Source Service]] | `getQueriesBySource()` + `getDashboardQueryMap()` service methods | Delivered | Critical | — |
| [[PBI-ANA-061 Dashboard Query Map]] | Collapsible query map component + tile source subtitle | Delivered | High | ANA-060 |
| [[PBI-ANA-062 CSV Analytics Section]] | CsvLanding analytics section with query list + auto-summary + navigation | Delivered | Critical | ANA-060 |
| [[PBI-ANA-063 CSV File-Menu Analyze]] | "Analyze in Analytics Hub" right-click menu item for CSV files | Delivered | High | ANA-060 |
| [[PBI-ANA-064 Source Pre-Selection]] | `onNavigateToEntity` override + related queries in Queries tab master | Delivered | High | ANA-060 |
| [[PBI-ANA-065 Cross-Domain Flow Test]] | Flow 37 integration test (26 tests) + PRD v12 | Delivered | High | ANA-060–064 |
| [[PBI-ANA-070 Schema Browser and Column Picker]] | Collapsible schema panel + reusable column picker utility | Delivered | Critical | — |
| [[PBI-ANA-071 Visual Filter Builder]] | Type-aware filter rows with value suggestions | Delivered | Critical | ANA-070 |
| [[PBI-ANA-072 Multi-Column Sort]] | SortSpec[] migration + multi-column engine + sort UI | Delivered | Critical | ANA-070 |
| [[PBI-ANA-073 Expression Validation]] | Pure expression validator + inline error display | Delivered | High | — |
| [[PBI-ANA-074 AnalyticsService Dashboard CRUD Extraction]] | Handler extraction (916→619 LOC, TD-ANA-002) | Delivered | High | — |
| [[PBI-ANA-075 QueriesTab Source and Actions Extraction]] | ActionsBar extraction (950→820 LOC, TD-ANA-003) | Delivered | High | ANA-071 |
| [[PBI-ANA-076 Enhanced Quick Insights and UX Polish]] | 3 new insight rules + schema click-to-insert + badges + Ctrl+Enter | Delivered | High | ANA-070, ANA-072 |

> **Analytics Hub v1 delivered (2026-02-23):** 5 PBIs in Cycle 28. Hub shell, dashboards, .base sources, independent persistence. 4,338 tests (178 suites).
> **Analytics Hub v2 delivered (2026-02-23):** 5 PBIs in Cycle 29. Favorites, default dashboard, dashboard-first overview, per-tile refresh, Supplier Manager persona. 4,358 tests (179 suites).
> **Analytics Hub v3 delivered (2026-02-24):** 5 PBIs in Cycle 30. Query power (filters/sort/limit), source preview, query usability, enhanced stat-cards, tile management, dashboard polish. 4,385 tests (180 suites).
> **Analytics Hub v4 delivered (2026-02-24):** 5 PBIs in Cycle 31. Computed columns (formula engine), Quick Insights (auto-suggest), data freshness tracking, import-to-analytics bridge. 4,403 tests (181 suites).
> **Analytics Hub v5 delivered (2026-02-24):** 5 PBIs in Cycle 32. QueriesTab extraction (TD), SVG chart tiles (line + bar), conditional formatting engine, sparklines. 4,461 tests (184 suites).
> **Analytics Hub v6 delivered (2026-02-24):** 5 PBIs in Cycle 33. Function call parser, trend window functions (CHANGE, PCT_CHANGE, ROLLING_AVG), scalar expression functions (ROUND, ABS, IF), conditional formatting rule builder UI, homepage pinning, query list UX. 4,533 tests (188 suites).
> **Analytics Hub v10 delivered (2026-02-25):** 6 PBIs in Cycle 36. TileRenderer extraction (794→540 LOC), pie chart (6th display mode), multi-select dashboard filters with cascading dimension discovery, filter propagation with OR/AND logic, click-to-toggle drill-down, per-value breadcrumb chips, 6x6 tile grid. 4,646 tests (191 suites).
> **Analytics Hub v12 delivered (2026-02-25):** 6 PBIs in Cycle 37. Cross-domain integration: dashboard query map (query transparency), CSV analytics section (query discovery from CSV detail), file-menu "Analyze" action, source pre-selection navigation, related queries in master list. 2 new components (DashboardQueryMap, CsvAnalyticsSection). 4,672 tests (192 suites).
> **Analytics Hub v13 delivered (2026-02-25):** 7 PBIs in Cycle 38. Query builder improvements: schema browser + column picker, visual filter builder with value suggestions, multi-column sort with migration, expression validation, AnalyticsService handler extraction (916→619 LOC), QueriesTab ActionsBar extraction (950→820 LOC), 6 quick insight rules, click-to-insert, count badges, Ctrl+Enter. 4 new components (SchemaPanel, FilterBuilderPanel, ActionsBar, expressionValidator). 4,746 tests (196 suites).

## Related

- Foundation: [[Data Exchange Hub PRD]] (analytics delivered in Cycle 27)
- Cycle: [[Cycle 27 - Analytics Sprint]] (engine + query builder delivered)
- Cycle: [[Cycle 28 - Analytics Hub]] (hub + dashboards + .base sources delivered)
- Review: [[Three Amigos Review 2026-02-23 Analytics Sprint]] (PASS, TASM 31/35)
- Flow: [[Build Analytics Dashboard]]
- Inbox: [[When opening a CSV with Flowti, I want to be able to make an easy dashboard]]
- Cycle: [[Cycle 29 - Analytics Supplier Manager]] (favorites, default dashboard, dashboard-first overview — delivered)
- Cycle: [[Cycle 30 - Analytics UX Mastery]] (query power, source preview, tile management, hub polish — delivered)
- Persona: [[Supplier Manager]] (non-technical operations user driving v2/v3 direction)
- PBIs (v1): [[PBI-ANA-010 Analytics Hub Shell]], [[PBI-ANA-011 Dashboard Domain]], [[PBI-ANA-012 Dashboard Tile Grid UI]], [[PBI-ANA-013 Base File Analytics Source]], [[PBI-ANA-014 Analytics Integration and Polish]]
- PBIs (v2): [[PBI-ANA-015 Favorite Types Foundation]], [[PBI-ANA-016 Dashboard First Overview]], [[PBI-ANA-017 Favorites UI]], [[PBI-ANA-018 Dashboard UX Polish]], [[PBI-ANA-019 Supplier Manager Flow Test]]
- PBIs (v3): [[PBI-ANA-020 Query Power Features]], [[PBI-ANA-021 Source Preview and Query Usability]], [[PBI-ANA-022 Enhanced Stat-Card and Tile Management]], [[PBI-ANA-023 Dashboard Actions and Hub Polish]], [[PBI-ANA-024 Analytics UX Flow Test]]
- Cycle: [[Cycle 31 - Analytics Business Intelligence]] (computed columns, quick insights, freshness, import bridge — delivered)
- PBIs (v4): [[PBI-ANA-025 Computed Columns]], [[PBI-ANA-026 Quick Insights]], [[PBI-ANA-027 Data Freshness Tracking]], [[PBI-ANA-028 Import Analytics Bridge]], [[PBI-ANA-029 Business Intelligence Flow Test]]
- Cycle: [[Cycle 32 - Analytics Visualization Sprint]] (charts, conditional formatting, sparklines, QueriesTab extraction — planned)
- PBIs (v5): [[PBI-ANA-030 QueriesTab Extraction]], [[PBI-ANA-031 Chart Tile Foundation]], [[PBI-ANA-032 Conditional Formatting]], [[PBI-ANA-033 Chart Polish and Sparklines]], [[PBI-ANA-034 Visualization Flow Test]]
- Supplier PRD: [[Feature - Supplier Management]] (strategic direction for analytics visualization)
- Cycle: [[Cycle 33 - Trend Intelligence]] (trend calculations, expression functions, formatting UI, homepage polish — delivered)
- PBIs (v6): [[PBI-ANA-035 Trend Calculation Engine]], [[PBI-ANA-036 Expression Functions]], [[PBI-ANA-037 Conditional Formatting Rule Builder UI]], [[PBI-ANA-038 Analytics Hub Homepage Polish]], [[PBI-ANA-039 Trend Intelligence Flow Test]]
- Cycle: [[Cycle 36 - Dashboard Drill-Down and Filtering]] (tile extraction, pie chart, multi-select filters, cascading dimensions, drill-down — delivered)
- PBIs (v10): [[PBI-ANA-054 TileRenderer Extraction]], [[PBI-ANA-055 Pie Chart Visualization]], [[PBI-ANA-056 Dashboard Filter UI]], [[PBI-ANA-057 Filter Propagation to Tiles]], [[PBI-ANA-058 Tile Drill-Down]], [[PBI-ANA-059 Drill-Down Flow Test]]
- Cycle: [[Cycle 37 - Analytics Hub Cross-Domain Integration]] (dashboard query map, CSV analytics section, file-menu analyze, source pre-selection — delivered)
- PBIs (v12): [[PBI-ANA-060 Query-by-Source Service]], [[PBI-ANA-061 Dashboard Query Map]], [[PBI-ANA-062 CSV Analytics Section]], [[PBI-ANA-063 CSV File-Menu Analyze]], [[PBI-ANA-064 Source Pre-Selection]], [[PBI-ANA-065 Cross-Domain Flow Test]]
- Cycle: [[Cycle 38 - Analytics Hub Query Builder Improvements]] (schema browser, filter builder, multi-sort, expression validation, extractions, quick insights — delivered)
- PBIs (v13): [[PBI-ANA-070 Schema Browser and Column Picker]], [[PBI-ANA-071 Visual Filter Builder]], [[PBI-ANA-072 Multi-Column Sort]], [[PBI-ANA-073 Expression Validation]], [[PBI-ANA-074 AnalyticsService Dashboard CRUD Extraction]], [[PBI-ANA-075 QueriesTab Source and Actions Extraction]], [[PBI-ANA-076 Enhanced Quick Insights and UX Polish]]
