---
domain: Analytics
plugin: "[[Development/flowti/README|README]]"
type: ProductRequirementsDocument
stage: draft
version: 1
maturity: L1
created: 2026-02-23
updated: 2026-02-23
foundation: "[[When opening a CSV with Flowti, I want to be able to make an easy dashboard]]"
related_events:
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
  - analytics.loaded
maturity_score_strategy: 4
maturity_score_scope: 4
maturity_score_architecture: 4
maturity_score_event_integration: 3
maturity_score_data_model: 3
maturity_score_ui_consistency: 3
maturity_score_validation_testing: 2
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

- [ ] FR-01: Analytics Hub is a separate BaseHubView subclass with VIEW_TYPE `"flowti-analytics-hub"` and hub ID `"analytics"`
- [ ] FR-02: Analytics Hub has 2 tabs: Dashboards (tile grid), Queries (query builder)
- [ ] FR-03: Hub dashboard page shows overview stats: saved query count, dashboard count, last query run time
- [ ] FR-04: Analytics Hub is accessible via command palette (`flowti:open-analytics-hub`) and User Hub cross-hub card

### Dashboard Domain

- [ ] FR-05: User can create a named dashboard (title, optional description)
- [ ] FR-06: User can add tiles to a dashboard; each tile references a saved query ID and specifies a display mode (table or stat-card)
- [ ] FR-07: User can remove tiles from a dashboard
- [ ] FR-08: User can delete a dashboard
- [ ] FR-09: Dashboard and tile state is persisted via TypedStorage under key `"analytics"`
- [ ] FR-10: Dashboard tiles render query results inline using AnalyticsResultsPanel (table mode) or stat card summary (stat-card mode)

### State Migration

- [ ] FR-11: On first load, AnalyticsService reads `savedAnalyticsQueries` from the `"dataExchange"` storage key and migrates them to the `"analytics"` key; after migration, the old field is cleared

### Source Enhancement

- [ ] FR-12: Analytics source picker shows `.base` files alongside CSV files; user can select a `.base` file as an analytics source
- [ ] FR-13: `BaseAnalyticsAdapter` resolves `.base` files using BaseQueryEngine + vault file scanning to produce headers + rows compatible with the analytics engine

### DX Hub Cleanup

- [ ] FR-14: The Analytics tab is removed from DataExchangeHubView; DX Hub tab definitions no longer include analytics

## 6. Data Model Impact

### New Types

| Type | Fields | Storage |
|------|--------|---------|
| `TileDisplayMode` | `"table" \| "stat-card"` | Runtime |
| `AnalyticsSourceType` | `"csv" \| "base"` | Runtime |
| `DashboardTile` | id, queryId, title?, displayMode, row, col, width, height | `"analytics"` key |
| `Dashboard` | id, name, description?, tiles[], createdAt, updatedAt | `"analytics"` key |
| `AnalyticsState` | savedAnalyticsQueries[], dashboards[] | `"analytics"` key |

### Modified Types

| Type | Change |
|------|--------|
| `SavedAnalyticsQuerySource` | Add `sourcePath`, `sourceType` (`"csv" \| "base"`), `viewIndex?`; backward-compat with existing `csvPath` |

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

### Existing Events (retained)

5 query lifecycle events: `analytics.query.started`, `.completed`, `.failed`, `.saved`, `.deleted`

**Total analytics events after migration:** 12

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

- [ ] Analytics Hub opens via command palette and shows 2 tabs (Dashboards, Queries)
- [ ] Queries tab reproduces all current AnalyticsTab functionality (source picker, query builder, execution, results, save/load)
- [ ] User can create a dashboard, add tiles referencing saved queries, and see results rendered
- [ ] User can delete dashboards and remove tiles
- [ ] Analytics tab no longer appears in Data Exchange Hub
- [ ] Saved queries migrated from DX state to analytics state on first load
- [ ] `.base` files appear in the source picker and produce valid analytics results
- [ ] Analytics Hub appears in User Hub cross-hub card with query + dashboard counts
- [ ] All existing analytics tests pass (163 tests)
- [ ] New tests cover: dashboard CRUD, tile CRUD, state migration, base adapter, hub view

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
| [[PBI-ANA-010 Analytics Hub Shell]] | Hub view + query migration + DX cleanup | Planned | Critical | — |
| [[PBI-ANA-011 Dashboard Domain]] | Types, service CRUD, events, persistence | Planned | Critical | ANA-010 |
| [[PBI-ANA-012 Dashboard Tile Grid UI]] | Tile layout, rendering, dashboard CRUD UI | Planned | Critical | ANA-011 |
| [[PBI-ANA-013 Base File Analytics Source]] | BaseAnalyticsAdapter + source picker | Planned | High | ANA-010 |
| [[PBI-ANA-014 Analytics Integration and Polish]] | HubProvider, command, flow tests, polish | Planned | High | ANA-010–013 |

> **Analytics Hub inception (2026-02-23):** Analytics moves from DX Hub tab to dedicated hub with dashboard tile grid. `.base` file sources and state migration included in first cycle. Planned for [[Cycle 28 - Analytics Hub]].

## Related

- Foundation: [[Data Exchange Hub PRD]] (analytics delivered in Cycle 27)
- Cycle: [[Cycle 27 - Analytics Sprint]] (engine + query builder delivered)
- Review: [[Three Amigos Review 2026-02-23 Analytics Sprint]] (PASS, TASM 31/35)
- Inbox: [[When opening a CSV with Flowti, I want to be able to make an easy dashboard]]
- PBIs: [[PBI-ANA-010 Analytics Hub Shell]], [[PBI-ANA-011 Dashboard Domain]], [[PBI-ANA-012 Dashboard Tile Grid UI]], [[PBI-ANA-013 Base File Analytics Source]], [[PBI-ANA-014 Analytics Integration and Polish]]
