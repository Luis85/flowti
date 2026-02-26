---
type: DevelopmentCycle
feature: "[[Analytics Hub PRD]]"
stage: planned
cycle: 44
date_planned: 2026-02-25
date_completed:
pbis:
  - "[[PBI-ANA-140 QueriesTab Decomposition]]"
  - "[[PBI-ANA-130 Date Range Filter]]"
  - "[[PBI-ANA-131 Day Week Time Bucket Granularity]]"
  - "[[PBI-ANA-141 DashboardTileRenderer Extraction]]"
  - "[[PBI-ANA-132 Cross-Tile Filtering]]"
  - "[[PBI-ANA-133 Dashboard File Watcher]]"
  - "[[PBI-ANA-142 Analytics Flow Test Expansion]]"
bugs: []
bugs_fixed_precycle: []
bugs_fixed: []
tech_debt:
  - "QueriesTab still 930 LOC after SourceManager extraction (C43)"
  - "DashboardTileRenderer 827 LOC with mixed rendering concerns"
  - "No measurement lifecycle flow tests"
estimated_increments: 7
actual_increments:
estimated_tests: 85
actual_new_tests:
pre_cycle_tests: 4941
pre_cycle_suites: 206
post_cycle_tests:
post_cycle_suites:
---

# Cycle 44 — Analytics Hub Filtering & Decomposition

## Cycle Overview

**User Story:**

> As a Supplier Manager who tracks monthly procurement across 6 CSV reports, I want to filter my dashboards by date range, see cross-tile interactions when I click a chart segment, and have my dashboards refresh automatically when source files update — so that my morning review workflow takes 2 minutes instead of 10 minutes of manual refreshing and mental filtering.

**User Pains:**

- **No date range filtering** — dashboards show all historical data. Users mentally filter by date or resort to pre-filtering CSV files before analysis. The #1 gap identified in market research: every competing tool (Metabase, Superset, Grafana) has date range pickers
- **Tiles are isolated islands** — clicking a chart segment or table value drills down within that tile only. Sibling tiles sharing the same dimension don't react. Users must manually apply the same filter to each tile via the filter bar. Market research identifies this as the "aha moment" that distinguishes dashboards from Excel
- **Manual refresh required** — when source CSV files are updated (e.g., new export from ERP), dashboards show stale data until the user clicks "Refresh All". No file watcher, no auto-update
- **QueriesTab still 930 LOC** — SourceManager extraction (C43) was the first step. The tab still mixes query building, execution, state management, and rendering. Adding new query features requires touching a monolithic file
- **DashboardTileRenderer is 827 LOC** — renders 6 display modes (table, stat-card, 4 chart types) plus conditional formatting, drill-down, sparklines, and tile settings. Each new tile feature (like cross-tile filtering) increases coupling

**Business Trigger:** Cycle 43 completed performance and navigation improvements — SourceManager extracted, render batching, breadcrumbs, and filter row-count preview. The Analytics Hub is feature-rich (96 FRs) but the two highest-priority market gaps remain: date filtering and cross-tile interaction. Meanwhile, the two largest UI files (QueriesTab 930 LOC, DashboardTileRenderer 827 LOC) slow down feature development. Cycle 44 balances the top P1/P2 roadmap features with architectural decomposition to sustain velocity.

---

## Situation Assessment

### Pre-Cycle State (post-Cycle 43)

**Plugin health:**
- 4,941 tests passing, 206 test suites
- Build status: green (`npm test` clean)
- PRD: v17, 96 FRs delivered, 8 roadmap PBIs (ANA-130–137)
- No blocking bugs, no open action items from Cycle 43

**Analytics domain status:**
- Domain: ~4,900 LOC (AnalyticsService 619, AnalyticsEngine 960, SourceManager 226, dashboardHandlers ~427, measurementHandlers ~114, expressionFunctions ~125, types ~490)
- UI: ~5,300 LOC (AnalyticsHubView 429, QueriesTab ~930, DashboardsTab ~894, MeasurementsTab ~606, DashboardTileRenderer ~827, ChartRenderer ~775, AnalyticsDashboardPage ~395, DashboardFilterBar ~170, DashboardBreadcrumbs ~120, QueryBuilderPanel ~490, TileSettingsPanel ~150)
- Tests: ~685 analytics-specific (including 35 flow integration tests from C43)
- Events: 30 (21 core + 9 measurement)
- Flow integration tests: 3 suites (Flows 17, 18, 19)

**Architecture audit findings:**
1. QueriesTab (930 LOC) still mixes query building, execution state, result caching orchestration, and rendering — SourceManager extraction was step 1 of multi-step decomposition
2. DashboardTileRenderer (827 LOC) handles 6 display modes, conditional formatting, drill-down click handlers, sparkline rendering, and tile settings panel — single-file bottleneck for dashboard UI changes
3. DashboardFilterBar supports dimension-value filters but has no date-aware filtering — date columns treated as regular strings
4. Cross-tile interaction limited to drill-down within a single tile — no dashboard-level filter propagation from tile clicks
5. No file change detection — dashboards are static snapshots until manual refresh
6. Flow test coverage: 3 suites covering query pipeline, dashboard lifecycle, and source management — no measurement lifecycle or filter-specific flows

---

## Backlog Refinement

| Source | Item | Decision | Rationale |
|--------|------|----------|-----------|
| C43 deferred | QueriesTab full extraction (beyond SourceManager) | **IN SCOPE** (Inc 1) | Largest UI file; extraction unlocks faster feature development |
| Market research P1 | Date Range Filter (PBI-ANA-130) | **IN SCOPE** (Inc 2) | #1 market gap; critical for daily-use dashboards |
| Market research P1 | Day/Week Time Bucket Granularity (PBI-ANA-131) | **IN SCOPE** (Inc 3) | Natural pair with date range filter; small scope (~37 LOC) |
| C43 deferred | DashboardTileRenderer extraction (827 LOC) | **IN SCOPE** (Inc 4) | Prerequisite for clean cross-tile filtering; reduces coupling |
| Market research P2 | Cross-Tile Filtering (PBI-ANA-132) | **IN SCOPE** (Inc 5) | #2 market gap; the "aha moment" differentiator |
| Market research P2 | Dashboard File Watcher (PBI-ANA-133) | **IN SCOPE** (Inc 6) | Completes auto-refresh story; small scope (~60 LOC) |
| C43 deferred | Measurement lifecycle flow tests | **IN SCOPE** (Inc 7) | Gap identified in C43 retro; new features need flow coverage |
| Market research P3 | KPI Targets & RAG Status (PBI-ANA-134) | **Deferred** | Valuable but lower priority than filtering; Cycle 45 candidate |
| Market research P3 | Goal Lines on Charts (PBI-ANA-135) | **Deferred** | Depends on PBI-ANA-134; Cycle 45 candidate |
| Market research P4 | Dashboard PDF Export (PBI-ANA-136) | **Deferred** | Requires html2canvas dependency evaluation; Cycle 46+ |
| Market research P4 | Dashboard Markdown Export (PBI-ANA-137) | **Deferred** | Lower urgency; template export covers most needs |
| TD-127 | Performance observability for growing state | **Deferred** | Requires dedicated PRD; too large for one increment |
| C43 deferred | ChartRenderer refactor (775 LOC) | **Deferred** | No new chart types planned; works well as-is |
| C43 deferred | types.ts split (490 LOC) | **Deferred** | Low impact; IDE search handles navigation |
| TD-48 | CSV parsing off-thread | **Deferred** | No user complaints at current data sizes |
| TD-44 | List virtualization | **Deferred** | Fine at current scale (<200 items per list) |

---

## Cycle Goals

1. **QueriesTab Decomposition** — Extract query execution and result management into focused modules, reducing QueriesTab from 930 LOC to ~550 orchestrator
2. **Date Range Filter** — Add date-aware filtering to DashboardFilterBar with presets and custom range picker
3. **Day/Week Time Buckets** — Extend time bucketing with day and ISO week granularity
4. **DashboardTileRenderer Extraction** — Decompose 827 LOC renderer into focused sub-renderers per display mode
5. **Cross-Tile Filtering** — Enable click-to-filter propagation across sibling dashboard tiles
6. **Dashboard File Watcher** — Auto-refresh affected tiles when source CSV files change
7. **Flow Test Expansion** — Add flow tests for measurement lifecycle, date range filtering, and cross-tile interaction

---

## Scope

### In Scope

- **QueryExecutionManager** — extract query execution orchestration (run, cancel, cache coordination) from QueriesTab
- **QueryResultHandler** — extract result processing and display state management from QueriesTab
- **QueriesTab orchestrator** — delegates to SourceManager + QueryExecutionManager + QueryResultHandler; owns only layout and routing
- **Date range picker** — dropdown in DashboardFilterBar with presets: Last 7 days, Last 30 days, This month, Last month, This quarter, Last quarter, This year, Last year, Year to date, Custom range
- **Custom date range** — start/end date inputs with validation
- **Date column auto-detection** — leverage existing `guessColumnType()` date detection + `ColumnTypeHint` date markers
- **Pre-aggregation date filtering** — date range applied before AnalyticsEngine aggregation (not post-filter)
- **Day time bucket** — YYYY-MM-DD format grouping
- **Week time bucket** — ISO 8601 week number (YYYY-W01 through YYYY-W53) grouping
- **TableTileRenderer** — extracted from DashboardTileRenderer; owns table rendering + conditional formatting
- **StatCardTileRenderer** — extracted; owns stat-card + sparkline rendering
- **ChartTileRenderer** — extracted; delegates to existing ChartRenderer for line/bar/area/pie
- **TileRendererFactory** — maps `TileDisplayMode` → renderer; DashboardTileRenderer becomes thin orchestrator
- **Cross-tile click events** — clicking a chart segment or table value emits dashboard-level filter event
- **Sibling tile propagation** — tiles sharing the clicked dimension column apply the filter and re-render
- **Filter-source indicator** — visual badge on the tile that originated the cross-tile filter
- **Clear cross-tile filter** — button to reset cross-tile filters (separate from dimension filters)
- **File watcher** — subscribe to `vault.on("modify")` for source paths used by dashboard tiles
- **Debounced refresh** — 2-second debounce on file changes to avoid rapid re-execution
- **Selective refresh** — only tiles using the modified source file re-execute (not all tiles)
- **Watcher lifecycle** — register on dashboard open, unregister on dashboard close / hub close
- **4 new flow test suites** — measurement lifecycle, date range, cross-tile, file watcher

### Out of Scope

- KPI targets & RAG status (PBI-ANA-134) — Cycle 45
- Goal lines on charts (PBI-ANA-135) — Cycle 45
- Dashboard PDF/image export (PBI-ANA-136) — Cycle 46+
- Dashboard Markdown export (PBI-ANA-137) — Cycle 46+
- ChartRenderer refactor (775 LOC) — no new chart types planned
- Performance observability / telemetry (TD-127) — needs dedicated PRD
- Real-time tile preview during settings — requires live re-rendering pipeline
- Keyboard shortcuts — low ROI
- types.ts split — low impact

---

## Increments

### Inc 1: QueriesTab Decomposition (PBI-ANA-140)

**Goal:** Continue the QueriesTab decomposition started with SourceManager (C43). Extract query execution orchestration and result management into focused modules, reducing QueriesTab from ~930 LOC to ~550 LOC orchestrator.

| File | Action | ~LOC |
|------|--------|------|
| `src/ui/analytics/queries/QueryExecutionManager.ts` | **New** — owns run/cancel/retry, cache coordination with QueryResultCache, execution state (running, error, results) | +160 |
| `src/ui/analytics/queries/QueryResultHandler.ts` | **New** — owns result processing, column sorting, computed column resolution, result display state | +120 |
| `src/ui/analytics/QueriesTab.ts` | Delegate execution + result ops; keep layout, routing, tab state | -380 |
| `src/ui/analytics/queries/types.ts` | Add `QueryExecutionManagerDeps`, `QueryResultHandlerDeps` interfaces | +25 |
| `tests/ui/analytics/QueryExecutionManager.test.ts` | **New** — execution orchestration, caching, error handling | +80 |
| `tests/ui/analytics/QueryResultHandler.test.ts` | **New** — result processing, sorting, computed columns | +60 |

**Design:**
- **QueryExecutionManager**: follows the callback-based deps pattern from SourceManager (C43). Receives `QueryExecutionManagerDeps` with callbacks for state access + UI notifications. Owns: `executeQuery()`, `cancelExecution()`, `getLastResult()`, `clearCache()`. Coordinates with `QueryResultCache` from C43.
- **QueryResultHandler**: processes raw engine output into display-ready state. Owns: `processResults(rawRows, columns)`, `applySorting(results, sortSpecs)`, `resolveComputedColumns(results, expressions)`, `getDisplayState()`.
- **QueriesTab becomes orchestrator**: creates SourceManager, QueryExecutionManager, QueryResultHandler in constructor. Layout rendering + tab routing only. Delegates user actions to the appropriate manager.

**AC:**
- [ ] QueryExecutionManager owns all execution orchestration (run, cancel, cache)
- [ ] QueryResultHandler owns result processing and display state
- [ ] QueriesTab reduced from ~930 to ~550 LOC (orchestrator only)
- [ ] Both new modules use callback-based deps pattern (consistent with SourceManager)
- [ ] Existing query functionality unchanged (execute, save, load, sort, computed columns)
- [ ] `npm test` passes

**Tests:** ~12 (target ~10)
**Docs:** No documentation changes (internal refactor).

---

### Inc 2: Date Range Filter (PBI-ANA-130)

**Goal:** Add date-aware filtering to DashboardFilterBar with 10 presets and a custom range picker, so users can scope dashboards to specific time periods.

| File | Action | ~LOC |
|------|--------|------|
| `src/ui/analytics/DashboardFilterBar.ts` | Add date range dropdown with presets + custom start/end inputs | +90 |
| `src/domain/analytics/dateUtils.ts` | `resolveDatePreset(preset)` → `{ start: Date, end: Date }`; `filterRowsByDateRange(rows, column, start, end)` | +60 |
| `src/domain/analytics/AnalyticsEngine.ts` | Apply date range filter pre-aggregation in execution pipeline | +25 |
| `src/domain/analytics/types.ts` | `DateRangePreset` enum, `DateRangeFilter` type, add `dateRangeFilter?` to dashboard state | +20 |
| `src/ui/analytics/DashboardsTab.ts` | Wire date range state to filter execution flow | +15 |
| `tests/domain/analytics/dateUtils.test.ts` | Date preset resolution, row filtering, edge cases (empty, null, invalid dates) | +80 |
| `tests/ui/analytics/DashboardFilterBar.test.ts` | Date range dropdown rendering and selection | +30 |

**Design:**
- **Date range presets** (10): Last 7 days, Last 30 days, This month, Last month, This quarter, Last quarter, This year, Last year, Year to date, Custom
- **`resolveDatePreset(preset, referenceDate?)`**: pure function returning `{ start, end }` Date objects. Uses `referenceDate` parameter for testability (defaults to `new Date()`).
- **Pre-aggregation filtering**: date range filter applied in `AnalyticsEngine.execute()` as step 2 (after source loading, before joins/aggregation). This ensures date filtering works correctly with `GROUP BY` and aggregate functions.
- **Column detection**: auto-detects date columns from `ColumnTypeHint` (`type: "date"`). If multiple date columns exist, user selects which column to filter on.
- **State**: `DateRangeFilter { column: string, preset: DateRangePreset, customStart?: string, customEnd?: string }` stored transiently per dashboard session (not persisted — consistent with existing filter behavior per ADR-004).

**AC:**
- [ ] Date range dropdown in DashboardFilterBar with 10 presets
- [ ] Custom date range with start/end date inputs and validation
- [ ] Date range propagates to all tiles via `runSavedQueryWithFilters()` (pre-aggregation)
- [ ] Auto-detects date columns from column type hints
- [ ] Date range filter composes with existing dimension filters (AND logic)
- [ ] Row-count preview badge updates when date range changes
- [ ] `npm test` passes

**Tests:** ~15 (target ~12)
**Docs:** Update Analytics Hub PRD → v18 with FR-97 (Date Range Filter).

---

### Inc 3: Day/Week Time Bucket Granularity (PBI-ANA-131)

**Goal:** Add day and ISO week-level time bucketing to complement existing month/quarter/year granularity, enabling granular trend analysis.

| File | Action | ~LOC |
|------|--------|------|
| `src/domain/analytics/AnalyticsEngine.ts` | Add "day" and "week" cases to time bucket switch | +15 |
| `src/domain/analytics/dateUtils.ts` | `getISOWeekNumber(date)` utility; `formatTimeBucket(date, granularity)` updated | +22 |
| `src/domain/analytics/types.ts` | Add `"day" | "week"` to `TimeBucketGranularity` union | +2 |
| `src/ui/analytics/queries/QueryBuilderPanel.ts` | Add "Day" and "Week" options to time bucket dropdown | +5 |
| `tests/domain/analytics/dateUtils.test.ts` | ISO week number edge cases (year boundaries, leap years) | +40 |
| `tests/domain/analytics/AnalyticsEngine.test.ts` | Day/week bucketing with aggregation | +30 |

**Design:**
- **Day bucketing**: `formatTimeBucket(date, "day")` → `"2026-02-25"` (YYYY-MM-DD). Simple `toISOString().slice(0,10)`.
- **Week bucketing**: `formatTimeBucket(date, "week")` → `"2026-W09"` (YYYY-Wnn). Uses `getISOWeekNumber()` following ISO 8601 (Monday start, week containing first Thursday of the year).
- **Charts**: Line/bar/area charts render correctly with daily/weekly x-axis labels. No special chart logic needed — existing label rendering handles string labels.
- **Small scope**: This increment is intentionally paired with Inc 2 (Date Range Filter) as a natural complement. The two together deliver the full P1 date filtering story.

**AC:**
- [ ] "Day" and "Week" options in time bucket dropdown
- [ ] Day bucketing formats as YYYY-MM-DD
- [ ] Week bucketing uses ISO 8601 week numbers (YYYY-W01 through YYYY-W53)
- [ ] Aggregation (SUM, COUNT, AVG, etc.) works correctly with day/week buckets
- [ ] Charts render correctly with daily/weekly x-axis labels
- [ ] `npm test` passes

**Tests:** ~10 (target ~8)
**Docs:** Update Analytics Hub PRD → v18 with FR-98 (Day/Week Time Buckets).

---

### Inc 4: DashboardTileRenderer Extraction (PBI-ANA-141)

**Goal:** Decompose the 827 LOC DashboardTileRenderer into focused sub-renderers per display mode, creating a TileRendererFactory for clean dispatch.

| File | Action | ~LOC |
|------|--------|------|
| `src/ui/analytics/tiles/TableTileRenderer.ts` | **New** — table rendering, sortable columns, conditional formatting | +180 |
| `src/ui/analytics/tiles/StatCardTileRenderer.ts` | **New** — stat-card value, sparkline, KPI comparison | +120 |
| `src/ui/analytics/tiles/ChartTileRenderer.ts` | **New** — delegates to ChartRenderer; handles chart config + value column selection | +80 |
| `src/ui/analytics/tiles/TileRendererFactory.ts` | **New** — maps TileDisplayMode → renderer; `render(container, tile, context)` dispatch | +40 |
| `src/ui/analytics/tiles/types.ts` | **New** — `TileRenderer` interface, shared tile rendering types | +30 |
| `src/ui/analytics/DashboardTileRenderer.ts` | Thin orchestrator: tile frame (header, mode toggle, settings) + delegates body to factory | -500 |
| `tests/ui/analytics/tiles/TileRendererFactory.test.ts` | **New** — factory dispatch, unknown mode fallback | +40 |
| `tests/ui/analytics/tiles/TableTileRenderer.test.ts` | **New** — table rendering, sorting, conditional formatting | +50 |

**Design:**
- **TileRenderer interface**: `{ render(container: HTMLElement, tile: DashboardTile, context: TileDataContext): void }`. Each renderer is a class with a single `render()` method.
- **TileRendererFactory**: `Map<TileDisplayMode, TileRenderer>`. Registers: `"table"` → TableTileRenderer, `"stat-card"` → StatCardTileRenderer, `"line-chart" | "bar-chart" | "area-chart" | "pie-chart"` → ChartTileRenderer. Unknown modes fall back to a "No renderer" message.
- **DashboardTileRenderer** becomes tile frame only (~327 LOC): renders tile header (title, mode toggle, settings gear, remove button), tile body container, then calls `factory.render(body, tile, context)`. Tile-level concerns (header, layout, error boundary) stay in the orchestrator.
- **ChartTileRenderer** wraps existing ChartRenderer — no chart logic is moved or rewritten. ChartTileRenderer owns chart configuration (value column selection, multi-series config) while ChartRenderer owns SVG generation.
- **Conditional formatting** moves to TableTileRenderer (only applies to table mode).

**AC:**
- [ ] TableTileRenderer owns table rendering + conditional formatting (~180 LOC)
- [ ] StatCardTileRenderer owns stat-card + sparkline (~120 LOC)
- [ ] ChartTileRenderer owns chart config + delegates to ChartRenderer (~80 LOC)
- [ ] TileRendererFactory dispatches by display mode
- [ ] DashboardTileRenderer reduced from ~827 to ~327 LOC (frame orchestrator only)
- [ ] All 6 display modes render identically to pre-extraction behavior
- [ ] Mode switching works through factory dispatch
- [ ] `npm test` passes

**Tests:** ~8 (target ~8)
**Docs:** No documentation changes (internal refactor).

---

### Inc 5: Cross-Tile Filtering (PBI-ANA-132)

**Goal:** Enable click-to-filter propagation across sibling dashboard tiles, so clicking a chart segment or table value filters all tiles sharing that dimension.

| File | Action | ~LOC |
|------|--------|------|
| `src/ui/analytics/DashboardsTab.ts` | Cross-tile filter state management; propagation to sibling tiles | +50 |
| `src/ui/analytics/tiles/TableTileRenderer.ts` | Emit cross-tile filter event on string cell click | +20 |
| `src/ui/analytics/tiles/ChartTileRenderer.ts` | Emit cross-tile filter event on chart segment click | +20 |
| `src/ui/analytics/DashboardFilterBar.ts` | Cross-tile filter badge display + clear button | +25 |
| `src/ui/analytics/DashboardBreadcrumbs.ts` | Show cross-tile filter in breadcrumb path | +10 |
| `src/domain/analytics/types.ts` | `CrossTileFilter` type, `CrossTileFilterEvent` | +15 |
| `tests/ui/analytics/DashboardsTab.test.ts` | Cross-tile filter propagation, clear, multi-filter composition | +70 |
| `tests/ui/analytics/tiles/ChartTileRenderer.test.ts` | Chart segment click emits filter event | +30 |

**Design:**
- **CrossTileFilter**: `{ sourceTileId: string, dimension: string, value: string }`. Stored as transient state on DashboardsTab.
- **Click-to-filter**: TableTileRenderer and ChartTileRenderer call `onCrossTileFilter(dimension, value)` callback (part of TileNavContext) when user clicks a string value.
- **Propagation**: DashboardsTab receives the callback, stores the CrossTileFilter, then calls `runSavedQueryWithFilters()` on all sibling tiles that have the same dimension column. The originating tile also filters (self-inclusive).
- **Composition with existing filters**: Cross-tile filters compose with dimension filters and date range filters via AND logic. All three filter types are applied pre-aggregation.
- **Filter-source indicator**: The tile that originated the filter gets a subtle accent border + "filter source" badge via CSS class `ft-tile-filter-source`.
- **Clear**: "Clear cross-filter" button in DashboardFilterBar. Also clears when clicking a different value in the same dimension (replaces filter) or clicking the × on the cross-filter badge.
- **Breadcrumbs**: Cross-tile filter adds a breadcrumb segment: "Dashboards > [Name] > [Dim: Value]".

**AC:**
- [ ] Click chart bar/segment filters sibling tiles by clicked dimension value
- [ ] Click table string cell filters sibling tiles by cell dimension + value
- [ ] Visual indicator on filter-source tile (`ft-tile-filter-source` CSS class)
- [ ] Clear button resets cross-tile filters
- [ ] Cross-tile filter composes with dimension filters and date range (AND logic)
- [ ] Breadcrumb shows cross-tile filter context
- [ ] Only tiles sharing the clicked dimension are affected (others unchanged)
- [ ] `npm test` passes

**Tests:** ~12 (target ~10)
**Docs:** Update Analytics Hub PRD → v18 with FR-99 (Cross-Tile Filtering).

---

### Inc 6: Dashboard File Watcher (PBI-ANA-133)

**Goal:** Auto-refresh affected dashboard tiles when source CSV files are modified in the vault, eliminating manual "Refresh All" clicks.

| File | Action | ~LOC |
|------|--------|------|
| `src/ui/analytics/DashboardsTab.ts` | Register/unregister file watcher on dashboard open/close; map source paths to tiles | +35 |
| `src/domain/analytics/AnalyticsService.ts` | `getSourcePathsForDashboard(dashboardId)` — collect unique source paths from dashboard tile queries | +20 |
| `src/ui/analytics/types.ts` | `FileWatcherState` type | +5 |
| `tests/ui/analytics/DashboardsTab.test.ts` | File watcher: register, debounce, selective refresh, cleanup | +50 |

**Design:**
- **Watcher registration**: When a dashboard is opened (detail panel renders), DashboardsTab calls `AnalyticsService.getSourcePathsForDashboard(id)` to collect all unique CSV source paths. Registers `app.vault.on("modify", callback)` for matching paths.
- **Debounce**: File change events are debounced at 2 seconds using `setTimeout` + clear pattern. Multiple rapid saves coalesce into a single refresh cycle.
- **Selective refresh**: Only tiles whose source query references the modified file are re-executed. Uses `QueryResultCache.invalidate(queryId)` to clear stale cache, then re-executes affected tiles.
- **Toast notification**: After refresh completes, shows a brief "Dashboard updated" notice via Obsidian's `Notice` API.
- **Watcher cleanup**: Unregisters the `vault.on("modify")` handler when:
  - User navigates away from the dashboard (back to list)
  - User switches tabs
  - Hub closes (via `onHubClose()`)
- **Memory safety**: Uses `addUnsubscribe()` from BaseHubView to ensure cleanup even on unexpected close.

**AC:**
- [ ] Auto-refresh when source CSV files are modified in vault
- [ ] 2-second debounce to avoid rapid re-execution
- [ ] Only affected tiles refresh (selective, not all tiles)
- [ ] "Dashboard updated" toast notification after refresh
- [ ] Watcher cleaned up on dashboard close, tab switch, and hub close
- [ ] Watcher re-registers when switching between dashboards
- [ ] No performance impact when no files change (passive listener)
- [ ] `npm test` passes

**Tests:** ~8 (target ~6)
**Docs:** Update Analytics Hub PRD → v18 with FR-100 (Dashboard File Watcher).

---

### Inc 7: Analytics Flow Test Expansion (PBI-ANA-142)

**Goal:** Expand flow integration test coverage to include measurement lifecycle, date range filtering, and cross-tile interaction — the three flows added or enhanced in this cycle.

| File | Action | ~LOC |
|------|--------|------|
| `tests/flows/analytics-measurement-lifecycle.test.ts` | **New** — Flow 20: Create measurement → link to tile → cross-refs → delete cascade | +120 |
| `tests/flows/analytics-date-range-filter.test.ts` | **New** — Flow 21: Add date source → set date range → verify filtered aggregation → change preset → verify update | +100 |
| `tests/flows/analytics-cross-tile-filter.test.ts` | **New** — Flow 22: Create multi-tile dashboard → click segment → verify sibling filter → clear → verify reset | +100 |
| `tests/flows/analytics-file-watcher.test.ts` | **New** — Flow 23: Open dashboard → modify source file → verify selective refresh → cleanup | +80 |

**Design:**
- All flows test through AnalyticsService + AnalyticsEngine (domain-level, consistent with C43 flow test pattern)
- Each flow creates its own AnalyticsService instance with mock storage (test isolation)
- Flows use deterministic mock CSV data with known date columns, string dimensions, and numeric measures
- Assertion style: verify final state, not intermediate steps (resilient to refactoring)

**Flow 20 — Measurement Lifecycle:**
1. Create and save a query with numeric measures
2. Create a measurement referencing the query
3. Add measurement to a dashboard tile
4. Verify cross-references: query → measurement → dashboard
5. Delete measurement → verify cascade (tile reference cleared)
6. Re-save query → verify measurement re-linkable

**Flow 21 — Date Range Filter:**
1. Add CSV source with date column (known date range)
2. Build query with date dimension + SUM measure
3. Execute without date range → verify full row count
4. Apply "Last 30 days" preset → verify filtered aggregation
5. Switch to "Custom" range → verify custom date filtering
6. Compose with dimension filter → verify AND logic

**Flow 22 — Cross-Tile Filter:**
1. Create dashboard with 3 tiles sharing a "region" dimension
2. Click "EMEA" in tile 1 table → verify tiles 2 and 3 filter by region=EMEA
3. Verify filter-source indicator on tile 1
4. Click different value "APAC" → verify filter updates (replace, not stack)
5. Clear cross-tile filter → verify all tiles show unfiltered data

**Flow 23 — File Watcher:**
1. Create dashboard with 2 tiles from different CSV sources
2. Simulate file modification event on source 1
3. Verify tile 1 re-executed, tile 2 unchanged
4. Verify debounce: rapid modifications produce single refresh
5. Close dashboard → verify watcher unregistered

**AC:**
- [ ] Flow 20: Measurement lifecycle — create, link, cross-ref, delete cascade (8+ tests)
- [ ] Flow 21: Date range filter — presets, custom, composition with dimension filters (8+ tests)
- [ ] Flow 22: Cross-tile filter — click propagation, replace, clear, composition (8+ tests)
- [ ] Flow 23: File watcher — selective refresh, debounce, cleanup (6+ tests)
- [ ] All flows use isolated AnalyticsService instances (no test leakage)
- [ ] All flows use deterministic mock CSV data with date columns
- [ ] Total: ~30 tests across 4 suites
- [ ] `npm test` passes (including new flow tests)

**Tests:** ~20 (target ~20)
**Docs:** No documentation changes (test-only).

---

## Dependency Graph

```
PBI-ANA-140 (QueriesTab Decomposition) ── independent (foundation refactor)

PBI-ANA-130 (Date Range Filter) ── independent (DashboardFilterBar + AnalyticsEngine)
    |
    v
PBI-ANA-131 (Day/Week Buckets) ── depends on ANA-130 (shared dateUtils, same PR context)

PBI-ANA-141 (TileRenderer Extraction) ── independent (tile decomposition)
    |
    v
PBI-ANA-132 (Cross-Tile Filtering) ── depends on ANA-141 (tile renderers emit click events)

PBI-ANA-133 (File Watcher) ── independent (vault.on modify)

PBI-ANA-142 (Flow Tests) ── runs last (tests final state after all changes)
```

**Execution order:** Inc 1 → Inc 2 → Inc 3 → Inc 4 → Inc 5 → Inc 6 → Inc 7

**Critical path:** Inc 4 → Inc 5 (TileRenderer Extraction → Cross-Tile Filtering)

**Parallelizable pairs:** Inc 1 + Inc 2 (independent); Inc 4 + Inc 6 (independent)

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| QueriesTab extraction breaks execution flow | High | Extract one concern at a time; run `npm test` after each move; keep QueriesTab as delegating orchestrator |
| Date range presets miscalculate edge cases | Medium | Extensive unit tests for each preset (month boundaries, year boundaries, leap years); `referenceDate` parameter for deterministic testing |
| ISO week number edge cases (year boundary weeks) | Low | Follow ISO 8601 strictly; test W52→W01 transitions across year boundary |
| TileRenderer extraction changes rendering behavior | Medium | 1:1 extraction — move code, not refactor logic; visual verification for each display mode |
| Cross-tile filtering creates cascading re-executions | Medium | Batch filter propagation — update all sibling tiles in one pass; use QueryResultCache to avoid redundant execution |
| File watcher fires too frequently | Low | 2-second debounce; only listen to paths used by current dashboard; unregister on navigation |
| File watcher leaks on unexpected close | Medium | Use `addUnsubscribe()` from BaseHubView for guaranteed cleanup |
| Cross-tile filter conflicts with existing drill-down | Medium | Cross-tile and drill-down are separate filter layers; both compose via AND logic; clear one doesn't clear other |

---

## Success Metrics

| Metric | Target | Actual |
|--------|--------|--------|
| New tests | ~85 | |
| Post-cycle total tests | ~5,026 | |
| Post-cycle suites | ~214 | |
| QueriesTab LOC reduction | ~380 (930 → ~550) | |
| DashboardTileRenderer LOC reduction | ~500 (827 → ~327) | |
| New source files | ~8 (QueryExecutionManager, QueryResultHandler, 3 tile renderers, TileRendererFactory, tile types, file watcher state) | |
| New flow test suites | 4 (Flows 20–23) | |
| Planned increments | 7 | |
| Date range presets | 10 | |
| PRD FRs delivered | 4 new (FR-97 through FR-100) | |

---

## Deferred Items

| Item | Rationale | Target |
|------|-----------|--------|
| KPI Targets & RAG Status (PBI-ANA-134) | Valuable but lower priority than filtering features | Cycle 45 |
| Goal Lines on Charts (PBI-ANA-135) | Depends on PBI-ANA-134 (target values) | Cycle 45 |
| Dashboard PDF Export (PBI-ANA-136) | Requires html2canvas dependency evaluation | Cycle 46+ |
| Dashboard Markdown Export (PBI-ANA-137) | Template export covers most needs; lower urgency | Cycle 46+ |
| ChartRenderer refactor (775 LOC) | No new chart types planned; current SVG works well | Future |
| types.ts split (490 LOC) | Low impact; IDE search handles navigation | Future |
| Performance observability (TD-127) | Too large for one increment; needs dedicated PRD | Future |
| CSV parsing off-thread (TD-48) | No user complaints at current data sizes | Future |
| List virtualization (TD-44) | Fine at current scale (<200 items per list) | Future |
| Real-time tile preview during settings | Requires live re-rendering pipeline | Future |
| Keyboard shortcuts (Alt+1/2/3) | Low ROI | Future |

---

## Definition of Ready (Pre-Cycle)

- [ ] Cycle 43 delivered — all tests green, performance & navigation complete
- [ ] No blocking bugs or data integrity issues
- [ ] QueriesTab source management delegated to SourceManager (C43 foundation in place)
- [ ] QueryResultCache available in AnalyticsService (C43 Inc 2)
- [ ] DashboardBreadcrumbs component available (C43 Inc 3)
- [ ] DashboardFilterBar row-count preview working (C43 Inc 4)
- [ ] TileRenderContext partitioned into focused sub-interfaces (C43 Inc 5)
- [ ] Semantic CSS classes established (C43 Inc 6)
- [ ] 3 analytics flow test suites as test pattern reference (C43 Inc 7)
- [ ] `dateUtils.ts` exists with date parsing utilities (foundation for Inc 2/3)
- [ ] `guessColumnType()` detects date columns (existing foundation)
- [ ] Mock CSV data with date columns prepared for flow tests

## Definition of Done

### 1. All Increments Completed
- [ ] 7 increments delivered, no partial state

### 2. Quality Gates
- [ ] `npm test` passes — ~5,026 tests green (target ~85 new)
- [ ] `npm run check` passes — no lint or type errors
- [ ] All new tests exercise the features they validate
- [ ] 4 new flow test suites passing (Flows 20–23)

### 3. Architecture
- [ ] QueriesTab reduced to ~550 LOC orchestrator (delegates to 3 managers)
- [ ] DashboardTileRenderer reduced to ~327 LOC frame (delegates to factory)
- [ ] TileRendererFactory dispatches to 3 sub-renderers by display mode
- [ ] Date range filter applied pre-aggregation in AnalyticsEngine
- [ ] Cross-tile filter composes with dimension + date range filters (AND logic)
- [ ] File watcher lifecycle managed via addUnsubscribe() (guaranteed cleanup)
- [ ] All new modules follow callback-based deps pattern

### 4. User Experience
- [ ] Date range picker with 10 presets + custom range in filter bar
- [ ] Day and week time bucket options in query builder
- [ ] Click chart segment or table value to filter sibling tiles
- [ ] Visual indicator on filter-source tile
- [ ] Auto-refresh when source CSV files change (2s debounce)
- [ ] "Dashboard updated" toast notification after file-triggered refresh
- [ ] All existing analytics functionality works as before
- [ ] Breadcrumbs show date range and cross-tile filter context
