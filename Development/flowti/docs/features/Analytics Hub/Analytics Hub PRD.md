---
domain: Analytics
plugin: "[[Development/flowti/README|README]]"
type: ProductRequirementsDocument
stage: delivered
version: 5
maturity: L2
created: 2026-02-23
updated: 2026-02-24
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
- [x] FR-22: User can add ORDER BY sorting to queries; `SortSpec` with column and direction (asc/desc)
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

## 6. Data Model Impact

### New Types

| Type | Fields | Storage |
|------|--------|---------|
| `TileDisplayMode` | `"table" \| "stat-card"` | Runtime |
| `AnalyticsSourceType` | `"csv" \| "base"` | Runtime |
| `DashboardTile` | id, queryId, title?, displayMode, row, col, width, height | `"analytics"` key |
| `Dashboard` | id, name, description?, isFavorite?, tiles[], createdAt, updatedAt | `"analytics"` key |
| `AnalyticsState` | savedAnalyticsQueries[], dashboards[], defaultDashboardId? | `"analytics"` key |

### Modified Types

| Type | Change |
|------|--------|
| `SavedAnalyticsQuerySource` | Add `sourcePath`, `sourceType` (`"csv" \| "base"`), `viewIndex?`; backward-compat with existing `csvPath` |
| `SavedAnalyticsQuery` | Add `isFavorite?: boolean` (v2); add `filters?: FilterSpec[]`, `sort?: SortSpec`, `limit?: number` (v3); add `computedColumns?: ComputedColumn[]` (v4) |
| `AnalyticsQuery` | Add `filters?: FilterSpec[]`, `sort?: SortSpec`, `limit?: number` (v3); add `computedColumns?: ComputedColumn[]` (v4) |

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

**Total analytics events:** 19 (12 v1 + 1 loaded + 3 v2 + 3 v3)

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

- [ ] User can add computed columns with arithmetic expressions referencing result column labels
- [ ] Engine evaluates computed columns after aggregation; division by zero returns 0
- [ ] Quick Insight cards appear in source preview when source is loaded (up to 3 suggestions)
- [ ] Clicking a Quick Insight populates query builder and auto-executes
- [ ] Dashboard tiles show relative time since last refresh with color coding (green/amber/red)
- [ ] Dashboard header shows freshness summary
- [ ] After CSV import, inbox item "Analyze [filename] in Analytics Hub" is created
- [ ] Analytics Hub overview shows "Recent Sources" section with up to 5 CSVs
- [ ] Flow 31 integration test passes (BI workflow)

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
| [[PBI-ANA-025 Computed Columns]] | Formula engine: arithmetic expressions on aggregated columns | Planned | Critical | — |
| [[PBI-ANA-026 Quick Insights]] | Auto-suggested queries from detected column types | Planned | Critical | ANA-025 |
| [[PBI-ANA-027 Data Freshness Tracking]] | Per-tile staleness indicator + dashboard freshness summary | Planned | High | — |
| [[PBI-ANA-028 Import Analytics Bridge]] | Import completion → inbox item + Recent Sources section | Planned | High | — |
| [[PBI-ANA-029 Business Intelligence Flow Test]] | End-to-end BI workflow integration test | Planned | High | ANA-025–028 |

> **Analytics Hub v1 delivered (2026-02-23):** 5 PBIs in Cycle 28. Hub shell, dashboards, .base sources, independent persistence. 4,338 tests (178 suites).
> **Analytics Hub v2 delivered (2026-02-23):** 5 PBIs in Cycle 29. Favorites, default dashboard, dashboard-first overview, per-tile refresh, Supplier Manager persona. 4,358 tests (179 suites).
> **Analytics Hub v3 delivered (2026-02-24):** 5 PBIs in Cycle 30. Query power (filters/sort/limit), source preview, query usability, enhanced stat-cards, tile management, dashboard polish. 4,385 tests (180 suites).
> **Analytics Hub v4 planned (2026-02-24):** 5 PBIs in Cycle 31. Computed columns (formula engine), Quick Insights (auto-suggest), data freshness tracking, import-to-analytics bridge.

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
- Cycle: [[Cycle 31 - Analytics Business Intelligence]] (computed columns, quick insights, freshness, import bridge — planned)
- PBIs (v4): [[PBI-ANA-025 Computed Columns]], [[PBI-ANA-026 Quick Insights]], [[PBI-ANA-027 Data Freshness Tracking]], [[PBI-ANA-028 Import Analytics Bridge]], [[PBI-ANA-029 Business Intelligence Flow Test]]
