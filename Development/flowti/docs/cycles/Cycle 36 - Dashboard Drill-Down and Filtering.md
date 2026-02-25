---
type: DevelopmentCycle
feature: "[[Analytics Hub PRD]]"
stage: delivered
cycle: 36
date_planned: 2026-02-25
date_completed: 2026-02-25
pbis:
  - "[[PBI-ANA-054 TileRenderer Extraction]]"
  - "[[PBI-ANA-055 Pie Chart Visualization]]"
  - "[[PBI-ANA-056 Dashboard Filter UI]]"
  - "[[PBI-ANA-057 Filter Propagation to Tiles]]"
  - "[[PBI-ANA-058 Tile Drill-Down]]"
  - "[[PBI-ANA-059 Drill-Down Flow Test]]"
bugs: []
bugs_fixed_precycle:
  - "1-col tile header overflow — actions now wrap at narrow widths"
tech_debt:
  - "DashboardTileRenderer at 794 LOC (AI-4 threshold: 700)"
estimated_increments: 6
estimated_tests: 55
pre_cycle_tests: 4603
pre_cycle_suites: 190
---

# Cycle 36 — Dashboard Drill-Down & Filtering

## Cycle Overview

**User Story:**

> As a Supplier Manager reviewing my morning dashboards, I want to click on a supplier name in a KPI tile and instantly see all my dashboard tiles filtered to that supplier — so that I can investigate anomalies without leaving the dashboard context or manually rebuilding queries.

**User Pains:**

- **Dashboard tiles are isolated** — each tile runs its own query independently. When the Supplier Manager sees high costs for "SUP-A" in one tile, they cannot click to see SUP-A's inventory, POs, and trends across all tiles simultaneously.
- **Drill-down is query-level only** — the "View Query" icon (C35) navigates away from the dashboard to the Queries tab. The dashboard context (which tiles, which dashboard) is lost. The user must mentally reconstruct their investigation path.
- **No filter controls on dashboards** — the only way to filter data is by editing each tile's underlying query. For a dashboard with 6 tiles, this means 6 separate query edits to focus on one supplier.
- **No categorical visualization** — pie/donut charts for showing supplier share or category distribution are missing. The Supplier Manager must read tables or stat-cards to understand proportional relationships.
- **DashboardTileRenderer is bloated** — at 794 LOC, it exceeds the 700 LOC monitoring threshold (AI-4). Adding drill-down interaction to this file without extraction would worsen maintainability.

**User Needs:**

- Click on a value in a tile (e.g., "SUP-A") and have all dashboard tiles filter to that value
- See a breadcrumb showing active filters with the ability to clear them
- Dashboard-level filter dropdown for common dimensions (supplier, category)
- Pie/donut chart for proportional comparisons
- Clean component architecture for the tile renderer before adding new interaction patterns

**Business Trigger:** Cycle 35 completed the "daily consumption" toolkit — tiles can be removed, reconfigured, exported, and investigated. The Supplier Manager's morning routine now works for reading dashboards. The next friction is **exploration within the dashboard** — clicking a value to focus, comparing proportions, and navigating a drill-down path. This is the core analytics interaction pattern that transforms dashboards from static reports into interactive exploration tools.

---

## Situation Assessment

### Pre-Cycle State (post-Cycle 35)

**Plugin health:**
- 4,603 tests passing, 190 test suites
- Build status: green (`npm test` + `npm run check` clean)
- Cycle 35 completed — Supplier Manager Daily Experience delivered (tile management, Add to Dashboard, tile actions, CSV extraction, query descriptions)
- Pre-cycle bug fixed: 1-col tile header overflow (actions now wrap at narrow widths)
- No blocking bugs; TD-126 resolved (Phase 1-3), TD-127 deferred

**Analytics domain status:**
- Domain: ~3,800 LOC (AnalyticsEngine 853, AnalyticsService 862, types ~400, events 139, expressionFunctions 97, trendCalculations 83, conditionalFormatting 50, quickInsights 80, dateUtils 98, localeUtils 136, freshnessUtils 81, BaseAnalyticsAdapter 90)
- UI: ~5,200 LOC (AnalyticsHubView 308, QueriesTab 877, DashboardsTab 551, DashboardTileRenderer 794, ChartRenderer 620, AnalyticsDashboardPage 355, query sub-components ~960, AddTileDialog ~100, TileResultCache ~60)
- Tests: ~350 analytics-specific across domain + flow + UI suites
- Events: 21 (stable)
- PRD: v9, FRI 35/35, 67 FRs all delivered
- Templates: 2 (Supplier Management, Inventory Health)
- Test data: 5 CSVs (Suppliers, Items, Sales, Inventory, PurchaseOrders)

**Supplier Management PRD coverage:**

| PRD Section | Status | Gap |
|-------------|--------|-----|
| §6.1 Cost by SKU/Supplier/Month | Delivered | — |
| §6.2 Sales by SKU/Supplier/Month | Delivered | — |
| §6.3 QTY on Hand by SKU/Month | Delivered | — |
| §6.4 Open Purchase Orders | Delivered | — |
| §6.5 Historical Development | Delivered | — |
| §6.6 Future Development (Forecasting) | Not started | Cycle 37 |
| §9.1 Filtering & Controls | **Partial** | No dashboard-level filtering |
| §9.2 Dashboard Components: Drilldown | **Partial** | View Query only (no filter context) |
| §10 UX: Drill-down via click | **Partial** | Lightweight only (view source query) |
| §10 UX: CSV Export | Delivered | — |
| §10 UX: Conditional Coloring | Delivered | — |
| §11 Visualization Types | Delivered | Line, Area, Bar, Table (no pie) |

**Key friction points (addressed in this cycle):**
1. No dashboard-level filter controls — user must edit each tile's query individually
2. No cross-tile drill-down — clicking a value has no effect on other tiles
3. No proportional visualization — pie/donut charts missing
4. DashboardTileRenderer at 794 LOC — exceeds 700 threshold, extraction needed before adding interaction

**Open action items from Cycle 35:**
- AI-2: AnalyticsEngine at 853 LOC (under 900 threshold) — Monitor
- AI-4: DashboardTileRenderer at 794 LOC (exceeds 700 threshold) — **IN SCOPE** (Inc 1)
- TD-127: Performance observability — Deferred (infrastructure)

**Vault inbox signals:**
- "I want to drill-down my Dashboard by item_id" — direct user request for drill-down with extension to other string values
- "Quality Dashboard for Software Products" — deferred (meta domain)
- "Every analytics-able file has dashboard capabilities" — deferred (separate UX pattern)

**Plugin inbox signals:**
- No new analytics feature requests post-Cycle 35
- Filter management is a recurring theme across domains

---

## Backlog Refinement

| Source | Item | Decision | Rationale |
|--------|------|----------|-----------|
| Cycle 35 deferred | Dashboard drill-down navigation | **IN SCOPE** (Inc 5) | Core cycle theme; user requested in vault inbox |
| Cycle 35 deferred | Dashboard-level filtering | **IN SCOPE** (Inc 3-4) | Prerequisite for drill-down; addresses §9.1 |
| Cycle 35 deferred | Pie charts | **IN SCOPE** (Inc 2) | Proportional visualization for supplier/category share |
| AI-4 monitoring | DashboardTileRenderer extraction | **IN SCOPE** (Inc 1) | Prerequisite; renderer at 794 LOC |
| Cycle 35 deferred | Forecasting / projections | **Deferred to C37** | Needs stable drill-down patterns first |
| Cycle 35 deferred | Chart interactivity (tooltips, zoom) | **Deferred** | Static SVG sufficient; drill-down is the priority interaction |
| Cycle 35 deferred | File-level dashboard (right-click CSV) | **Deferred** | Separate UX pattern; not part of drill-down focus |
| Cycle 35 deferred | Drag-and-drop tile reordering | **Deferred** | Move up/down sufficient |
| TD-127 | Performance observability | **Deferred** | Infrastructure; not user-facing |
| Vault inbox | Quality Dashboard for Software Products | **Deferred** | Meta domain, not supplier management |
| Vault inbox | Every analytics-able file has dashboard | **Deferred** | Out of scope for drill-down cycle |
| AI-2 monitoring | AnalyticsEngine extraction | **Monitor** | 853 LOC, under 900 threshold; drill-down adds no new functions |

### Prioritization Criteria

1. **Exploration friction** — What prevents the Supplier Manager from navigating within the dashboard? (highest)
2. **Proportional insight** — What visualization gap prevents understanding category/supplier share? (high)
3. **Architecture health** — What technical debt must be resolved before adding new interaction? (medium, but blocking)
4. **Integration quality** — How do we verify the full drill-down experience end-to-end? (medium)

### Strategic Roadmap Update (Analytics Hub Cycles 36-38)

| Cycle | Theme | Key Deliverables |
|-------|-------|-----------------|
| **36 (this)** | Dashboard Drill-Down & Filtering | TileRenderer extraction, pie charts, dashboard filters, filter propagation, drill-down |
| **37 (next)** | Predictive Analytics | Forecasting (linear trend, rolling projection), anomaly detection, confidence ranges |
| **38 (future)** | Advanced Interactivity | Chart tooltips, zoom, file-level dashboards, drag-and-drop |

---

## Cycle Goals

1. **Architecture Health** — Extract DashboardTileRenderer settings panel into a focused component, bringing the renderer below the 700 LOC threshold
2. **Pie Chart Visualization** — 6th display mode for proportional comparisons (supplier share, category distribution)
3. **Dashboard Filter UI** — Multi-select dropdown controls at the dashboard header for filtering by string dimensions (supplier_id, category, etc.)
4. **Filter Propagation** — Active dashboard filters (multi-value, OR within column) applied to all tile queries at execution time; tiles re-render with filtered results
5. **Tile Drill-Down** — Click a string value in a table or stat-card tile to toggle it in the dashboard filter; per-value breadcrumb chips with individual clear buttons
6. **Multi-Select Comparison** — Users can select multiple values within a single dimension to compare side-by-side across all tiles
7. **Cascading Filters** — Filter dropdowns narrow their options based on active filters (selecting a category narrows item_id to items in that category)
8. **Integration Verification** — Flow 36 test covering the full drill-down experience + PRD v11

---

## Scope

### In Scope
- **DashboardTileRenderer extraction** — settings panel + rule builder into `TileSettingsPanel.ts` (~290 LOC extracted)
- **Pie chart** — SVG pie/donut chart in ChartRenderer; "pie-chart" as 6th TileDisplayMode
- **Dashboard filter UI** — filter bar below dashboard header with dimension dropdowns populated from tile query results
- **Filter propagation** — `DashboardFilterContext` merged into tile query execution at runtime
- **Tile drill-down** — click handler on string values in table cells and stat-card group labels
- **Breadcrumb** — active filter display with clear buttons in dashboard header
- **Flow 36 integration test** — ~25 tests covering filter + drill-down workflows
- **Analytics Hub PRD update to v10** with FRs FR-68 through FR-75

### Out of Scope
- Forecasting / projections — Cycle 37
- Chart interactivity (tooltips, zoom) — deferred
- File-level dashboard (right-click CSV) — separate UX pattern
- Drag-and-drop tile reordering — move up/down sufficient
- TD-127 Performance observability — infrastructure, not daily UX
- Expression evaluator extraction — AnalyticsEngine at 853 LOC, under 900 threshold
- Cross-tile column mapping — exact column name matching only (user controls naming via queries)
- Persistent filter state — filters are runtime only, reset on dashboard switch/close
- Nested drill-down (drill into drill) — single level only for this cycle

---

## Increments

### Inc 1: TD — DashboardTileRenderer Extraction (PBI-ANA-054)

**Goal:** Extract the settings panel from DashboardTileRenderer into a focused component, bringing the renderer below the 700 LOC monitoring threshold.

**Design:**

DashboardTileRenderer is at 794 LOC with two natural extraction boundaries:

1. **`TileSettingsPanel`** — the collapsible settings form (query selector, width/height toggles, sparkline toggle, row limit, auto-height, conditional formatting rule builder)
2. The tile renderer keeps header, body, and display mode rendering

**New component: `src/ui/analytics/TileSettingsPanel.ts`**

Extracts:
- `renderTileSettings()` (~115 LOC) — query selector, width toggle, height toggle, auto-height, sparkline, row limit
- `renderRuleBuilder()` (~140 LOC) — conditional formatting rules CRUD
- `getNumericColumns()` helper (shared with renderer — moved to a shared inline or passed via context)

The renderer calls `new TileSettingsPanel(settingsPanel, ctx).render()` instead of `this.renderTileSettings(settingsPanel, ctx)`.

**Interface:** `TileSettingsPanel` receives the same `TileRenderContext` — no new types needed.

| File | Action | ~LOC |
|------|--------|------|
| `src/ui/analytics/TileSettingsPanel.ts` | **New** — extracted settings panel + rule builder | ~290 |
| `src/ui/analytics/DashboardTileRenderer.ts` | Remove settings methods, import TileSettingsPanel | −270 |

**Post-extraction LOC:**
- DashboardTileRenderer: ~524 LOC (well under 700)
- TileSettingsPanel: ~290 LOC

**AC:**
- [ ] `TileSettingsPanel.ts` renders all settings sections identically to pre-extraction
- [ ] DashboardTileRenderer delegates to TileSettingsPanel for settings rendering
- [ ] DashboardTileRenderer under 600 LOC
- [ ] All existing tests pass without modification
- [ ] `npm test` passes

**Tests:** 0 new tests (behavior-preserving extraction; existing tests verify via integration)

---

### Inc 2: Pie Chart Visualization (PBI-ANA-055)

**Goal:** Add pie/donut chart as the 6th TileDisplayMode for proportional comparisons.

**Design:**

Pie charts fill a visualization gap: when the Supplier Manager wants to see "what share of total cost does each supplier represent?", they need a proportional view that tables and bar charts don't naturally convey.

**1. Add "pie-chart" to TileDisplayMode**

Update `types.ts`:
```typescript
type TileDisplayMode = "table" | "stat-card" | "line-chart" | "bar-chart" | "area-chart" | "pie-chart";
```

Update `DISPLAY_MODE_CYCLE` in DashboardTileRenderer to include `"pie-chart"`.

**2. SVG Pie Chart in ChartRenderer**

New static method: `ChartRenderer.renderPieChart(container, result, valueColumn?)`

- Renders a pure SVG pie chart (no external dependencies)
- Segments sized proportionally by the value column (first numeric column if not specified)
- Labels: dimension value + percentage (e.g., "SUP-A: 42%")
- Colors: 8-color palette cycling (same hue progression as bar charts)
- Legend below chart showing dimension + value + percentage
- Minimum segment size: segments below 3% are grouped into "Other"
- Maximum segments: 12 (beyond that, smaller segments grouped into "Other")

**3. Wire in DashboardTileRenderer**

Add `"pie-chart"` case in the body rendering switch, calling `ChartRenderer.renderPieChart()`.

| File | Action | ~LOC |
|------|--------|------|
| `src/domain/analytics/types.ts` | Add `"pie-chart"` to TileDisplayMode | +1 |
| `src/ui/analytics/ChartRenderer.ts` | Add `renderPieChart()` static method + SVG rendering | +120 |
| `src/ui/analytics/DashboardTileRenderer.ts` | Add pie-chart case in render switch | +5 |

**AC:**
- [ ] "Pie Chart" appears in tile display mode dropdown
- [ ] Pie chart renders SVG segments proportional to numeric column values
- [ ] Labels show dimension value + percentage
- [ ] Legend displays below chart with color swatches
- [ ] Segments below 3% grouped into "Other"
- [ ] Maximum 12 segments (rest grouped into "Other")
- [ ] Pie chart works on dashboard homepage and dashboards tab
- [ ] `npm test` passes

**Tests:** ~8 (3 segment calculation + 2 "Other" grouping + 1 empty data + 1 single value + 1 extraction)

---

### Inc 3: Dashboard Filter UI (PBI-ANA-056)

**Goal:** Add filter controls to the dashboard detail header so the user can filter all tiles by dimension values.

**Design:**

**1. DashboardFilterContext**

New runtime-only state (not persisted):

```typescript
interface DashboardFilter {
  column: string;
  value: string;
}

// Stored in AnalyticsHubState
interface AnalyticsHubState {
  // ... existing fields
  dashboardFilters: DashboardFilter[];
}
```

Initialized to `[]` when a dashboard is selected. Reset when switching dashboards.

**2. Filter Bar in Dashboard Detail Header**

Below the dashboard name/description, above the tile grid:

```
[Dashboard Name]  [Default badge]  [freshness]
[description]
┌────────────────────────────────────────────┐
│  Filters: [supplier_id ▼ SUP-A] [× clear] │
│           [category ▼ All    ]             │
└────────────────────────────────────────────┘
[tile grid]
```

- **Dimension discovery**: Scan all tile queries' results to find common string columns (non-numeric columns that appear in ≥1 tile result). Show a dropdown for each discovered dimension.
- **Dropdown values**: Collect unique values from all tile results for each dimension column.
- **"All" option**: Default selection — no filter applied for this dimension.
- **Clear button**: Removes all active filters. Only visible when filters are active.
- Maximum 4 dimension dropdowns (most useful columns first, sorted by value count ascending — fewer unique values = more useful as filter).

**3. Breadcrumb display**

When filters are active, show breadcrumb-style chips above the tile grid:

```
Showing: supplier_id = SUP-A  [×]  ·  category = Electronics  [×]
```

Each chip has an × to remove that specific filter. Clicking × removes the filter and re-renders.

| File | Action | ~LOC |
|------|--------|------|
| `src/ui/analytics/types.ts` | Add `DashboardFilter` type + `dashboardFilters` to state | +8 |
| `src/ui/analytics/DashboardsTab.ts` | Filter bar + breadcrumb rendering | +80 |
| `src/ui/analytics/AnalyticsDashboardPage.ts` | Filter bar + breadcrumb on homepage | +60 |

**AC:**
- [ ] Filter bar appears below dashboard header when dashboard has tiles
- [ ] Dimension dropdowns populated from tile result string columns
- [ ] Maximum 4 dimension dropdowns
- [ ] Selecting a value sets `dashboardFilters` in state
- [ ] "All" option clears the filter for that dimension
- [ ] Breadcrumb chips show active filters with × to remove
- [ ] "Clear all" button removes all filters
- [ ] Filters reset when switching dashboards
- [ ] Homepage dashboard shows same filter bar
- [ ] `npm test` passes

**Tests:** ~8 (3 dimension discovery + 2 filter state management + 2 breadcrumb + 1 reset)

---

### Inc 4: Filter Propagation to Tiles (PBI-ANA-057)

**Goal:** When dashboard filters are active, apply them to all tile queries at execution time so tiles show filtered results.

**Design:**

**1. Filter injection at query execution time**

When `tileResultCache.tryRun()` is called, if `dashboardFilters` are active, the tile's query is executed with additional filters merged:

```typescript
// In DashboardsTab / AnalyticsDashboardPage tile rendering:
const dashboardFilters = this.deps.getState().dashboardFilters;
const cacheKey = this.buildCacheKey(tile.queryId, dashboardFilters);
const tileResult = this.deps.tileResultCache.tryRun(
  cacheKey,
  () => this.deps.analyticsService.runSavedQueryWithFilters(tile.queryId, dashboardFilters),
  () => this.deps.scheduleRender(),
);
```

**2. New service method: `runSavedQueryWithFilters`**

```typescript
async runSavedQueryWithFilters(
  queryId: string,
  extraFilters: DashboardFilter[],
): Promise<AnalyticsResult>
```

- Loads the saved query
- Merges `extraFilters` into the query's existing `filters` array (additive, not replacing)
- Runs the merged query via `AnalyticsEngine`
- Column matching: exact column name only. If a dashboard filter references a column not in this query's sources, that filter is silently skipped for this tile.

**3. Cache key includes filter state**

The tile result cache key must incorporate active filters so that changing filters triggers re-execution rather than serving stale results:

```typescript
private buildCacheKey(queryId: string, filters: DashboardFilter[]): string {
  if (filters.length === 0) return queryId;
  const suffix = filters.map(f => `${f.column}=${f.value}`).sort().join("&");
  return `${queryId}?${suffix}`;
}
```

When filters change, old cached results (with different filter keys) are automatically bypassed.

**4. Tile rendering with filter awareness**

When dashboard filters are active and a tile's query doesn't contain the filtered column, the tile shows normally (filter is a no-op for that tile). No error, no warning — the filter simply doesn't apply to unrelated tiles.

| File | Action | ~LOC |
|------|--------|------|
| `src/domain/analytics/AnalyticsService.ts` | Add `runSavedQueryWithFilters()` | +25 |
| `src/ui/analytics/DashboardsTab.ts` | Filter-aware cache key + pass filters to execution | +25 |
| `src/ui/analytics/AnalyticsDashboardPage.ts` | Same filter-aware execution on homepage | +20 |

**AC:**
- [ ] Active dashboard filters are applied to all tile queries
- [ ] Filter matching is exact column name (case-sensitive)
- [ ] Filters for columns not in a tile's query are silently skipped
- [ ] Changing a filter value triggers tile re-execution (cache key includes filters)
- [ ] Clearing filters shows unfiltered results
- [ ] Multiple filters combine with AND logic
- [ ] Existing tile-level row limits still apply after filtering
- [ ] `npm test` passes

**Tests:** ~10 (3 filter merging + 2 cache key generation + 2 column skip + 2 multi-filter AND + 1 tile limit after filter)

---

### Inc 5: Tile Drill-Down (PBI-ANA-058)

**Goal:** Enable click-to-filter: clicking a string value in a tile sets it as a dashboard filter, focusing all tiles on that value.

**Design:**

**1. Clickable string values in tables**

In the `renderTable()` method of DashboardTileRenderer, string cells (non-numeric values) become clickable:

- Cursor: `pointer` on string cells
- Hover: subtle background highlight
- Click: calls `ctx.onDrillDown(column, value)` — new callback on TileRenderContext

Only string columns are clickable (numeric values are data, not dimension identifiers).

**2. Clickable group labels in stat-cards**

In `renderStatCard()`, the dimension label (group header) becomes clickable:

- Label "SUP-A" in a stat-card → click sets `supplier_id = SUP-A` as dashboard filter

**3. New callback: `onDrillDown`**

```typescript
interface TileRenderContext {
  // ... existing
  onDrillDown?: (column: string, value: string) => void;
}
```

Wired in DashboardsTab and AnalyticsDashboardPage to add the filter to `dashboardFilters`:

```typescript
onDrillDown: (column, value) => {
  const filters = [...this.deps.getState().dashboardFilters];
  // Replace existing filter for same column, or add new
  const idx = filters.findIndex(f => f.column === column);
  if (idx >= 0) filters[idx] = { column, value };
  else filters.push({ column, value });
  this.deps.setState({ dashboardFilters: filters });
  this.deps.scheduleRender();
},
```

**4. Visual feedback**

When a cell value matches an active dashboard filter, it gets a subtle accent underline or background to indicate "this is the active drill-down value".

| File | Action | ~LOC |
|------|--------|------|
| `src/ui/analytics/DashboardTileRenderer.ts` | Add `onDrillDown` to context, clickable string cells in table + stat-card | +40 |
| `src/ui/analytics/DashboardsTab.ts` | Wire `onDrillDown` callback | +12 |
| `src/ui/analytics/AnalyticsDashboardPage.ts` | Wire `onDrillDown` callback | +12 |

**AC:**
- [ ] String values in table cells are clickable (cursor + hover)
- [ ] Clicking a string cell sets a dashboard filter for that column + value
- [ ] Dimension labels in stat-cards are clickable for drill-down
- [ ] Numeric values are NOT clickable
- [ ] Drill-down filter replaces existing filter for same column
- [ ] Multiple drill-downs across different columns stack (AND)
- [ ] Active drill-down values show visual indicator
- [ ] Clearing breadcrumb filter removes drill-down state
- [ ] `npm test` passes

**Tests:** ~8 (2 table drill-down + 2 stat-card drill-down + 2 filter replacement + 1 multi-column stack + 1 visual feedback)

---

### Inc 6: Flow Test + PRD Update (PBI-ANA-059)

**Goal:** End-to-end flow test covering the full drill-down experience and PRD update.

**Design:**

**Flow 36 test:** Dashboard Drill-Down & Filtering workflow.

Test structure mirrors two user journeys:

**Journey A: Filter-Driven Exploration**
1. **Pie chart rendering** — verify SVG segments with correct proportions
2. **Pie chart "Other" grouping** — verify small segments grouped
3. **Dashboard filter state** — set filter, verify state, clear filter
4. **Filter propagation** — run query with extra filters, verify results are filtered
5. **Column skip** — filter by column not in query, verify result unchanged
6. **Multi-filter AND** — two filters active, verify both applied

**Journey B: Drill-Down Experience**
7. **Table drill-down** — simulate clicking a string value, verify filter set
8. **Stat-card drill-down** — simulate clicking a group label, verify filter set
9. **Filter replacement** — drill on same column twice, verify last value wins
10. **Cross-column drill** — drill on different columns, verify both filters active

**Infrastructure**
11. **TileSettingsPanel extraction** — verify settings render identically post-extraction
12. **Pie chart data extraction** — verify `extractPieData` with edge cases
13. **Cache key generation** — verify filter-aware cache keys

**Edge cases**
14. Empty result after filtering (all rows excluded)
15. Pie chart with single segment (100%)
16. Dashboard filter on a column with no matching tiles

**PRD update:**
- Analytics Hub PRD v11
- Add FR-68 through FR-77 (TileRenderer extraction, pie chart, multi-select filters, cascading dimensions, drill-down toggle, per-value breadcrumbs)
- Update DashboardFilter type to multi-value `values: string[]`
- Update TileDisplayMode in data model with `"pie-chart"`
- Update FRI score

| File | Action | ~LOC |
|------|--------|------|
| `tests/flows/36-DrillDownAndFiltering.test.ts` | **New** — flow integration test | +300 |
| `docs/features/Analytics Hub/Analytics Hub PRD.md` | Update to v11 with FR-68 through FR-77 | ~60 lines |

**AC:**
- [x] Flow 36 test passes (31 tests covering both journeys + multi-select + cascading)
- [x] Filter-driven exploration verified end-to-end (set filter → tiles re-render → clear)
- [x] Drill-down experience verified (click value → toggle filter → breadcrumb shows → clear)
- [x] Multi-select comparison verified (toggle add, toggle remove, clear last value)
- [x] Cascading filter discovery verified (active filters narrow dimension dropdowns)
- [x] Pie chart rendering and edge cases verified
- [x] Edge cases handled (empty filtered result, single segment, no matching columns)
- [x] Analytics Hub PRD updated to v11 with all new FRs
- [x] `npm test` passes — all 4,646 tests green (191 suites)

**Tests:** 31 (6 filter exploration + 4 drill-down + 3 multi-select + 2 cascading + 3 infrastructure + 4 pie chart + 4 edge cases + 5 integration)

---

## Dependency Graph

```
Inc 1 (TileRenderer extraction — prerequisite)
  │
  ├── Inc 2 (pie chart — uses cleaned renderer)
  │
  └── Inc 3 (filter UI — independent of pie chart)
        │
        └── Inc 4 (filter propagation — needs filter UI)
              │
              └── Inc 5 (drill-down — needs propagation)
                    │
                    └── Inc 6 (flow test — needs all above)
```

**Execution order:** Inc 1 → Inc 2 → Inc 3 → Inc 4 → Inc 5 → Inc 6

Inc 1 must go first to reduce DashboardTileRenderer complexity before adding drill-down interaction. Inc 2 (pie chart) is independent but benefits from the cleaned renderer. Inc 3 (filter UI) establishes the state model needed by Inc 4 (propagation) and Inc 5 (drill-down). Inc 6 integrates all prior work.

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Filter propagation performance with many tiles (>10) | Medium | Each tile re-executes its query with merged filters. Query execution is typically <50ms per tile. Profile in Inc 4. |
| Column name mismatch across tiles | Medium | Use exact column name matching. Document that users should use consistent column names across queries. No fuzzy matching in Cycle 36. |
| Pie chart SVG rendering at small tile sizes (1-col) | Low | Pie chart should be used at 2+ col width. If rendered at 1-col, scale SVG to fit available space. |
| TileSettingsPanel extraction regressions | Low | Behavior-preserving refactor. All existing tests verify via integration. Manual visual verification. |
| Cache key collisions with filter state | Low | Sort filter keys alphabetically in cache key generation. Unit test cache key uniqueness. |
| Filter state loss on tab navigation | Medium | Filters are stored in `AnalyticsHubState` which persists across tab switches within the same hub view session. Reset only on dashboard switch. |
| DashboardsTab growing from filter logic | Low | Filter bar is ~80 LOC. DashboardsTab goes from 551→~670 LOC. Well under any threshold. |
| AnalyticsEngine unchanged but Service grows | Low | `runSavedQueryWithFilters` is +25 LOC. AnalyticsService goes from 862→~890 LOC. Under 900 threshold. |

---

## Success Metrics

| Metric | Target | Actual |
|--------|--------|--------|
| New tests | ~55 | 43 (4,603→4,646) |
| Post-cycle total tests | ~4,658 | 4,646 (191 suites) |
| New source LOC | ~400 | ~500 (incl. multi-select + cascading) |
| TileDisplayMode | + `"pie-chart"` (6th mode) | Delivered |
| DashboardTileRenderer LOC | 794 → ~540 | 794 → ~540 |
| TileSettingsPanel LOC | ~290 | ~296 |
| Analytics events | 21 (unchanged) | 21 |
| PRD version | v9 → v10 | v9 → v11 (multi-select + cascading added) |
| New FRs | FR-68 through FR-75 (8) | FR-68 through FR-77 (10) |
| Supplier Management PRD gaps closed | §9.1, §9.2, §10 | §9.1 Filtering, §9.2 Drilldown, §10 Drill-down via click |

---

## Deferred Items

| Item | Rationale | Target |
|------|-----------|--------|
| Forecasting / projections | Needs stable drill-down and daily patterns first | Cycle 37 |
| Chart interactivity (tooltips, zoom) | Static SVG with drill-down sufficient for current needs | Cycle 38 |
| File-level dashboard (right-click CSV) | Separate UX pattern; not part of drill-down focus | Future |
| Drag-and-drop tile reordering | Move up/down + width toggle sufficient | Future |
| TD-127 Performance observability | Infrastructure concern; not user-facing | Future |
| Cross-tile column mapping (fuzzy) | Exact name matching sufficient; fuzzy matching adds complexity without clear user demand | Future |
| Persistent filter state | Filters are session-only; persisting across sessions needs design work | Future |
| Nested drill-down (drill into drill) | Single-level drill sufficient; multi-level adds breadcrumb complexity | Cycle 37+ |
| Donut variant (hollow center) | Pie chart is sufficient; donut is cosmetic | Future |
| Pie chart click-to-drill | Clicking a segment could drill-down; defer until Inc 5 interaction pattern is proven | Cycle 37 |

---

## Definition of Done (Cycle)

### 1. All Increments Completed
- [ ] Each increment satisfies its own acceptance criteria
- [ ] No increment left in partial state

### 2. Quality Gates
- [ ] `npm test` passes (all tests green)
- [ ] `npm run check` passes (no lint or type errors)
- [ ] All new tests exercise the features they validate
- [ ] Flow 36 test covers both filter exploration and drill-down journeys

### 3. Documentation
- [ ] Analytics Hub PRD updated to v10 with FR-68 through FR-75
- [ ] Cycle 36 retrospective section completed
- [ ] Memory files updated with post-cycle state

### 4. Architecture
- [ ] DashboardTileRenderer under 600 LOC (extraction verified)
- [ ] TileSettingsPanel is self-contained component
- [ ] No circular dependencies introduced
- [ ] Filter state model is clean and extensible

### 5. User Experience
- [ ] Pie chart renders correctly at 2+ column widths
- [ ] Filter dropdowns populate from actual tile data
- [ ] Drill-down click interaction feels immediate (no perceptible delay)
- [ ] Breadcrumb clearly shows active filters with easy clear
- [ ] 1-col tiles remain usable (header wraps, no overflow)
