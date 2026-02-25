---
type: DevelopmentCycle
feature: "[[Analytics Hub PRD]]"
stage: planned
cycle: 43
date_planned: 2026-02-25
date_completed:
pbis:
  - "[[PBI-ANA-120 Source Manager Extraction]]"
  - "[[PBI-ANA-121 Render Performance]]"
  - "[[PBI-ANA-122 Dashboard Breadcrumb Navigation]]"
  - "[[PBI-ANA-123 Filter Row-Count Preview]]"
  - "[[PBI-ANA-124 TileRenderContext Simplification]]"
  - "[[PBI-ANA-125 CSS & Style Consolidation]]"
  - "[[PBI-ANA-126 Analytics Flow Integration Tests]]"
bugs: []
bugs_fixed_precycle: []
bugs_fixed: []
tech_debt:
  - "Source Manager inline in QueriesTab (deferred C38)"
  - "TileRenderContext 23-property interface"
  - "200+ inline style strings across analytics UI"
estimated_increments: 7
actual_increments:
estimated_tests: 52
actual_new_tests:
pre_cycle_tests: 4856
pre_cycle_suites: 199
post_cycle_tests:
post_cycle_suites:
---

# Cycle 43 — Analytics Hub Performance & Navigation

## Cycle Overview

**User Story:**

> As a data analyst who has built extensive dashboards and queries across multiple CSV sources, I want the Analytics Hub to handle growing complexity gracefully — with organized source management, faster rendering on filter changes, navigable drill-down paths, and predictable filter effects — so that I can scale my analytics practice without hitting performance walls or losing context.

**User Pains:**

- **Sources buried in query builder** — adding, removing, or inspecting sources requires editing individual queries. There's no centralized view of available data sources, no way to see which queries use a given source, and source resolution logic (CSV path → parsed data → type detection) is tangled into QueriesTab at 1,026 LOC
- **Dashboard navigation is flat** — drilling from a dashboard list into a specific dashboard, then into a filtered view or tile detail, has no breadcrumb trail. After 2–3 navigation steps users lose context and must click "back" repeatedly or switch tabs to reorient
- **Filter changes re-execute everything** — changing a dashboard filter re-runs all tile queries from scratch. With 8+ tiles on a dashboard, this causes noticeable lag. TileResultCache handles basic TTL but has no filtered-result memoization
- **No row-count feedback before execution** — selecting a filter gives no indication of how many rows will match. Users must execute to discover that their filter returns 0 rows or 10,000 rows
- **23 callback properties on TileRenderContext** — the internal interface for tile rendering has grown to 23 optional callbacks with mixed concerns (data, UI, navigation). Adding a new tile feature means touching a sprawling interface
- **Inline CSS everywhere** — analytics UI components contain 200+ char inline style strings. Styling changes require hunting through TypeScript files instead of a CSS file

**Business Trigger:** Cycle 42 completed the UX coherence pass — cross-tab navigation, cross-references, error states, sort options, and button consistency. The hub's feature set is mature (94 FRs delivered). The bottleneck is now internal complexity: the QueriesTab is the largest UI file (1,026 LOC), render performance degrades with dashboard complexity, and navigation depth has no breadcrumb support. Cycle 43 balances architecture improvements with user-facing features to sustain development velocity while delivering visible navigation enhancements.

---

## Situation Assessment

### Pre-Cycle State (post-Cycle 42)

**Plugin health:**
- 4,856 tests passing, 199 test suites
- Build status: green (`npm test` clean)
- PRD: v15, 96 FRs (94 delivered + FR-95, FR-96 planned)
- No blocking bugs, no open action items from Cycle 42

**Analytics domain status:**
- Domain: ~4,700 LOC (AnalyticsService 619, AnalyticsEngine 960, dashboardHandlers ~427, measurementHandlers ~114, expressionFunctions ~125, types ~490)
- UI: ~5,400 LOC (AnalyticsHubView 429, QueriesTab 1,026, DashboardsTab ~894, MeasurementsTab ~606, DashboardTileRenderer ~827, ChartRenderer ~775, AnalyticsDashboardPage ~395, DashboardFilterBar ~170, QueryBuilderPanel ~490, TileSettingsPanel ~150)
- Tests: ~600 analytics-specific
- Events: 30 (21 core + 9 measurement)
- Flow integration tests: **0** (no analytics flows in `tests/flows/`)

**Architecture audit findings:**
1. QueriesTab (1,026 LOC) mixes source management, query building, execution, and state tracking — 14 private properties, 23 render call sites
2. Source resolution logic (CSV path → parsed data → type detection → locale) is inline in QueriesTab with no reusable abstraction
3. TileRenderContext has 23 optional callback properties spanning data, UI, and navigation concerns
4. DashboardFilterBar shows filter controls but provides no row-count feedback before execution
5. Dashboard navigation is flat — no breadcrumb trail for drill-down paths
6. 200+ char inline style strings across analytics UI components (SourcePanel, DashboardsTab, DashboardTileRenderer, QueryBuilderPanel)
7. TileResultCache handles per-tile TTL but doesn't cache filtered query results — each filter change triggers full re-execution

---

## Backlog Refinement

| Source | Item | Decision | Rationale |
|--------|------|----------|-----------|
| C38 deferred | Source Manager extraction | **IN SCOPE** (Inc 1) | Sources outgrew inline QueriesTab management; first step of QueriesTab decomposition |
| Code health | Render batching + filtered result caching | **IN SCOPE** (Inc 2) | Largest performance bottleneck on dashboard filter changes |
| C42 deferred | Dashboard drill-down breadcrumbs | **IN SCOPE** (Inc 3) | Navigation context lost during drill-down; requires navigation stack |
| C42 deferred | Filter row-count preview | **IN SCOPE** (Inc 4) | Users can't predict filter effects before execution |
| Code health | TileRenderContext simplification | **IN SCOPE** (Inc 5) | 23 optional callbacks hinder tile feature development |
| Code health | CSS consolidation | **IN SCOPE** (Inc 6) | 200+ inline style strings are unmaintainable |
| Test gaps | Analytics flow integration tests | **IN SCOPE** (Inc 7) | Zero flow tests protect analytics user journeys |
| C42 deferred | Real-time tile preview during settings | **Deferred** | Requires live re-rendering pipeline; high effort for low frequency use |
| C42 deferred | Keyboard shortcuts (Alt+1/2/3) | **Deferred** | Tab bar is clickable; low ROI |
| C42 deferred | Query complexity warnings | **Deferred** | Requires profiling infrastructure; no user complaints yet |
| C42 deferred | extractScalarFunction registry | **Deferred** | Regex approach works fine; no new functions planned |
| C42 deferred | Weighted average for measurements | **Deferred** | Standard BI tools use same approach; no user demand |
| Code health | QueriesTab full extraction (beyond SourceManager) | **Deferred** | Source Manager (Inc 1) is first step; full extraction is Cycle 44+ |
| Code health | DashboardTileRenderer extraction (827 LOC) | **Deferred** | Lower priority than QueriesTab; defer to Cycle 44+ |
| Code health | ChartRenderer refactor (775 LOC) | **Deferred** | No new chart types planned; current structure works |
| Code health | types.ts split (490 LOC) | **Deferred** | Low impact; file is navigable with IDE search |
| TD-48 | CSV parsing blocks UI thread | **Deferred** | No user complaints at current data sizes |
| TD-44 | List virtualization | **Deferred** | Fine at current scale (<200 items per list) |
| Feature | Reports tab (reserved in PRD) | **Deferred** | No clear user demand yet |
| Feature | Dashboard sharing/export (beyond templates) | **Deferred** | Template export covers current needs |
| Feature | Real-time auto-refresh | **Deferred** | No streaming data sources yet |
| Inbox | Performance metrics service | **Deferred** | Too large for one cycle; requires dedicated PRD |

---

## Cycle Goals

1. **Source Manager Extraction** — Extract source management from QueriesTab into a dedicated SourceManager class
2. **Render Performance** — Batch render calls in QueriesTab + add filtered-result caching to AnalyticsEngine
3. **Dashboard Breadcrumb Navigation** — Navigation stack with breadcrumb bar for drill-down context
4. **Filter Row-Count Preview** — Show estimated row count in filter bar before execution
5. **TileRenderContext Simplification** — Partition 23-property interface into focused concern groups
6. **CSS Consolidation** — Move inline style strings to semantic CSS classes
7. **Analytics Flow Integration Tests** — First flow test suites covering core analytics user journeys

---

## Scope

### In Scope

- **SourceManager class** — owns source CRUD (add, remove, reorder), source resolution (CSV path → parsed data), and type detection delegation
- **QueriesTab source delegation** — QueriesTab delegates all source operations to SourceManager; ~100 LOC reduction
- **SourcePanel updated deps** — SourcePanel works through SourceManager interface
- **Render batching** — QueriesTab batches state mutations before calling render (max 1 render per animation frame)
- **Filtered result cache** — AnalyticsEngine caches filtered query results with LRU eviction (max 20 entries)
- **Breadcrumb bar component** — shows navigation path: "Dashboards > [Name] > [Filter Context]"
- **Navigation stack** — tracks drill-down path (dashboard list → dashboard → filtered view → tile detail)
- **Back navigation** — breadcrumb segment click + back button navigate up the stack
- **Filter row-count badge** — "~N rows" badge in DashboardFilterBar after filter selection
- **TileRenderContext partitioning** — split into TileDataContext + TileUIContext + TileNavContext
- **Semantic CSS classes** — ft-source-row, ft-tile-header, ft-tile-body, ft-filter-bar, ft-breadcrumb-bar, etc.
- **Inline style elimination** — 80%+ of analytics inline styles moved to styles.css
- **3 flow test suites** — query-to-dashboard, measurement lifecycle, source-to-filtered-execution

### Out of Scope

- Full QueriesTab decomposition (beyond SourceManager extraction) — Cycle 44+
- DashboardTileRenderer extraction — Cycle 44+
- ChartRenderer refactor — no new chart types planned
- Real-time tile preview during settings — requires live re-rendering pipeline
- Keyboard shortcuts for tab switching — low ROI
- Query complexity warnings — requires profiling infrastructure
- List virtualization — fine at current scale
- Reports tab — no clear user demand

---

## Increments

### Inc 1: Source Manager Extraction (PBI-ANA-120)

**Goal:** Extract source management from QueriesTab into a dedicated SourceManager class that owns source CRUD, resolution, and type detection delegation. This is the first step of the QueriesTab decomposition (deferred since Cycle 38).

| File | Action | ~LOC |
|------|--------|------|
| `src/domain/analytics/SourceManager.ts` | **New** — source CRUD (add/remove/reorder), resolution (CSV → parsed data), type detection delegation | +180 |
| `src/domain/analytics/types.ts` | Add SourceManagerDeps interface + SourceManagerState type | +20 |
| `src/ui/analytics/QueriesTab.ts` | Delegate source ops to SourceManager; remove inline source state management | -100 |
| `src/ui/analytics/queries/SourcePanel.ts` | Update deps to use SourceManager interface | +10 |
| `tests/domain/analytics/SourceManager.test.ts` | **New** — source CRUD, resolution, type detection, reorder | +150 |

**Design:**
- SourceManager is a pure domain class (no UI concerns)
- Receives `AnalyticsSource[]` from QueriesTab state; returns updated array on mutations
- Owns: `addSource(path)`, `removeSource(id)`, `reorderSources(ids)`, `resolveSource(source)` → parsed rows + headers
- Delegates type detection to existing `autoDetectTypeHints()` and `detectNumberLocale()`
- QueriesTab creates SourceManager once in constructor; passes it to SourcePanel via deps

**AC:**
- [ ] SourceManager class owns all source CRUD operations
- [ ] SourceManager handles source resolution (CSV path → parsed data)
- [ ] SourceManager delegates type detection to existing utilities
- [ ] QueriesTab delegates all source operations to SourceManager
- [ ] SourcePanel works through SourceManager deps
- [ ] QueriesTab reduced by ~100 LOC (source management extracted)
- [ ] Existing source functionality unchanged (add, remove, reorder, preview)
- [ ] `npm test` passes

**Tests:** ~8
**Docs:** No documentation changes (internal refactor).

---

### Inc 2: Render Performance (PBI-ANA-121)

**Goal:** Reduce redundant renders in QueriesTab via batching, and add filtered-result memoization to AnalyticsEngine for faster dashboard filter changes.

| File | Action | ~LOC |
|------|--------|------|
| `src/ui/analytics/QueriesTab.ts` | Add render batching: dirty flag + `requestAnimationFrame` coalescing | +30 / -40 |
| `src/domain/analytics/AnalyticsEngine.ts` | Add `FilteredResultCache` with LRU eviction; cache filtered query results | +60 |
| `src/domain/analytics/types.ts` | `FilteredResultCacheEntry` type, cache key generation | +15 |
| `tests/domain/analytics/AnalyticsEngine.test.ts` | Filtered result cache: hit, miss, eviction, invalidation | +50 |

**Design:**
- **QueriesTab batching**: Introduce `scheduleRender()` that sets a dirty flag and calls `requestAnimationFrame`. Multiple state mutations in the same frame coalesce into a single render. Replaces direct `renderMaster()` / `renderDetail()` calls.
- **Filtered result cache**: `Map<string, FilteredResultCacheEntry>` where key = `queryId:filterHash:sortHash`. LRU eviction at 20 entries. Cache invalidated on: query save, source change, schema edit, measurement change.
- **Cache key generation**: deterministic hash of filter values + sort specs (JSON.stringify + simple hash)

**AC:**
- [ ] QueriesTab batches state mutations — max 1 render per animation frame
- [ ] AnalyticsEngine caches filtered query results (cache key: queryId + filters + sort)
- [ ] LRU eviction: max 20 cached filtered results
- [ ] Cache invalidated on query save, source change, or schema edit
- [ ] Dashboard filter changes use cached results when available (cache hit → skip re-execution)
- [ ] No behavioral changes to query execution or dashboard rendering
- [ ] `npm test` passes

**Tests:** ~6
**Docs:** No documentation changes (internal performance improvement).

---

### Inc 3: Dashboard Breadcrumb Navigation (PBI-ANA-122)

**Goal:** Add a navigation stack with breadcrumb bar to the Dashboard experience, providing context during drill-down and easy back-navigation.

| File | Action | ~LOC |
|------|--------|------|
| `src/ui/analytics/DashboardBreadcrumbs.ts` | **New** — breadcrumb bar component: renders path segments, handles click navigation | +120 |
| `src/ui/analytics/types.ts` | `NavigationStackEntry` type, `BreadcrumbDeps` interface | +20 |
| `src/ui/analytics/DashboardsTab.ts` | Push/pop navigation stack on drill-down; render breadcrumbs above dashboard content | +45 |
| `src/ui/analytics/AnalyticsDashboardPage.ts` | Push stack entry when opening specific dashboard; breadcrumb integration | +30 |
| `tests/ui/analytics/DashboardBreadcrumbs.test.ts` | **New** — navigation stack push/pop, breadcrumb rendering, click navigation | +100 |

**Design:**
- **NavigationStackEntry**: `{ level: "list" | "dashboard" | "filtered" | "tile", label: string, dashboardId?: string, filterId?: string, tileId?: string }`
- **Navigation stack**: array of entries, max depth 4. Maintained by DashboardsTab.
- **Breadcrumb bar**: renders above dashboard content area. Each segment is clickable. Current segment is bold (non-clickable). Separator: " > ".
- **Back button**: (←) icon in breadcrumb bar, navigates one level up.
- **Stack lifecycle**: clears on explicit tab switch (via `onTabChanged()`). Pushing a new entry at the same level replaces it (no duplicates).
- **Integration**: uses existing `navigateToTab()` API from Cycle 42 for cross-tab navigation from breadcrumbs.

**AC:**
- [ ] Breadcrumb bar shows navigation path: "Dashboards > [Name] > [Filter Context]"
- [ ] Clicking a breadcrumb segment navigates back to that level
- [ ] Back button (←) navigates one level up in the stack
- [ ] Navigation stack tracks: dashboard list → dashboard → filtered view → tile detail
- [ ] Stack clears on explicit tab switch
- [ ] Maximum depth: 4 levels (list → dashboard → filter → tile)
- [ ] Breadcrumb bar hidden when at root level (dashboard list)
- [ ] `npm test` passes

**Tests:** ~8
**Docs:** Update Analytics Hub PRD → v15 with FR-95 (Dashboard Breadcrumb Navigation).

---

### Inc 4: Filter Row-Count Preview (PBI-ANA-123)

**Goal:** Show the estimated row count in the filter bar after selecting a filter value, giving users feedback before executing.

| File | Action | ~LOC |
|------|--------|------|
| `src/domain/analytics/AnalyticsEngine.ts` | `estimateFilteredRowCount(queryId, filters)` — count matching rows from cached results | +35 |
| `src/ui/analytics/DashboardFilterBar.ts` | Row-count badge: "N rows" rendered next to active filters | +30 |
| `src/ui/analytics/types.ts` | `FilterPreviewState` type | +5 |
| `tests/domain/analytics/AnalyticsEngine.test.ts` | Row count estimation: basic, empty, no cache, multiple filters | +40 |

**Design:**
- **Estimation method**: `estimateFilteredRowCount()` applies filter predicates to the cached (unfiltered) query result. Returns exact count — no sampling, no approximation. If no cached result exists, returns `null`.
- **Badge rendering**: small `ft-text-xs` badge next to the "Apply" area in DashboardFilterBar. Shows "N rows" when estimate is available, hidden when `null`.
- **Update timing**: recalculates with 300ms debounce on filter value change. Uses `FilteredResultCache` from Inc 2 when available.
- **Multi-filter**: when multiple filters are active, applies all filter predicates in sequence to get combined count.

**AC:**
- [ ] After selecting a filter value, "N rows" badge appears in filter bar
- [ ] Row count is exact (computed from cached query results, not sampled)
- [ ] Badge hidden when no cached results are available
- [ ] Updates with 300ms debounce on filter change
- [ ] Multi-filter combinations show combined row count
- [ ] Badge uses `ft-text-xs` styling (consistent with existing badges)
- [ ] `npm test` passes

**Tests:** ~6
**Docs:** Update Analytics Hub PRD → v15 with FR-96 (Filter Row-Count Preview).

---

### Inc 5: TileRenderContext Simplification (PBI-ANA-124)

**Goal:** Partition the 23-property TileRenderContext interface into focused concern groups, reducing cognitive load when working with tile rendering.

| File | Action | ~LOC |
|------|--------|------|
| `src/ui/analytics/types.ts` | Split TileRenderContext → TileDataContext + TileUIContext + TileNavContext; keep TileRenderContext as intersection type | +45 / -23 |
| `src/ui/analytics/DashboardTileRenderer.ts` | Accept partitioned context; destructure by concern group | +15 / -15 |
| `src/ui/analytics/DashboardsTab.ts` | Construct partitioned context objects | +15 |
| `src/ui/analytics/AnalyticsDashboardPage.ts` | Construct partitioned context objects | +15 |

**Design:**
- **TileDataContext** (~8 props): query result, measurement, tile config, filter state, refresh callback, execute callback
- **TileUIContext** (~8 props): display mode toggle, settings toggle, title change, remove, resize, reorder, conditional formatting
- **TileNavContext** (~4 props): navigateToTab, navigateToQuery, navigateToMeasurement, onDrillDown
- **TileRenderContext** = `TileDataContext & TileUIContext & TileNavContext` (backward compatible)
- Existing code that passes full TileRenderContext still works. New code can import focused interfaces.
- DashboardTileRenderer destructures by group for clarity: `const { query, measurement } = ctx as TileDataContext`

**AC:**
- [ ] TileRenderContext split into 3 focused interfaces (TileDataContext, TileUIContext, TileNavContext)
- [ ] TileRenderContext = intersection of all 3 (backward compatible)
- [ ] Each focused interface has <10 properties
- [ ] DashboardTileRenderer destructures by concern group
- [ ] All existing tile rendering works unchanged
- [ ] No runtime behavior changes
- [ ] `npm test` passes

**Tests:** ~0 (type-only refactor; existing tests validate behavior)
**Docs:** No documentation changes (internal type refactor).

---

### Inc 6: CSS & Style Consolidation (PBI-ANA-125)

**Goal:** Move inline style strings from analytics UI components to semantic CSS classes in styles.css, reducing maintenance burden and improving consistency.

| File | Action | ~LOC |
|------|--------|------|
| `styles.css` | Add semantic analytics CSS classes | +80 |
| `src/ui/analytics/queries/SourcePanel.ts` | Replace inline styles with CSS classes | -30 |
| `src/ui/analytics/DashboardsTab.ts` | Replace inline styles with CSS classes | -25 |
| `src/ui/analytics/DashboardTileRenderer.ts` | Replace inline styles with CSS classes | -20 |
| `src/ui/analytics/queries/QueryBuilderPanel.ts` | Replace inline styles with CSS classes | -15 |
| `src/ui/analytics/AnalyticsDashboardPage.ts` | Replace inline styles with CSS classes | -10 |
| (Other analytics UI files) | Inline style replacement | -30 total |

**New CSS classes:**
```css
/* Layout */
.ft-analytics-row          { display: flex; align-items: center; gap: 4px; }
.ft-analytics-row-between  { display: flex; align-items: center; justify-content: space-between; }

/* Sources */
.ft-source-row             { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.ft-source-badge           { font-size: 0.7rem; opacity: 0.7; }

/* Tiles */
.ft-tile-header            { display: flex; align-items: center; justify-content: space-between; padding: 4px 8px; }
.ft-tile-body              { padding: 8px; overflow: auto; }

/* Navigation */
.ft-breadcrumb-bar         { display: flex; align-items: center; gap: 4px; padding: 4px 0; font-size: var(--font-ui-smaller); }
.ft-breadcrumb-segment     { cursor: pointer; color: var(--text-muted); }
.ft-breadcrumb-segment:hover { color: var(--text-normal); text-decoration: underline; }
.ft-breadcrumb-current     { color: var(--text-normal); font-weight: 600; }

/* Filters */
.ft-filter-bar             { display: flex; flex-wrap: wrap; gap: 4px; padding: 4px 0; }
.ft-filter-badge           { font-size: 0.7rem; padding: 1px 6px; border-radius: 3px; background: var(--background-modifier-hover); }
```

**AC:**
- [ ] All analytics inline style strings (200+ chars) replaced with semantic CSS classes
- [ ] New CSS classes added to styles.css with clear naming (ft-* prefix)
- [ ] Inline styles reduced by 80%+ across analytics UI components
- [ ] Visual appearance unchanged (1:1 CSS mapping verified)
- [ ] Dark theme compatibility maintained (uses CSS variables, not hardcoded colors)
- [ ] `npm test` passes

**Tests:** ~0 (CSS-only; visual verification)
**Docs:** No documentation changes (CSS-only).

---

### Inc 7: Analytics Flow Integration Tests (PBI-ANA-126)

**Goal:** Create the first flow integration test suites for the Analytics domain, covering the three core user journeys.

| File | Action | ~LOC |
|------|--------|------|
| `tests/flows/analytics-query-dashboard.test.ts` | **New** — Flow 20: Build query → Execute → Save → Add tile to dashboard → Verify rendering | +180 |
| `tests/flows/analytics-measurement-flow.test.ts` | **New** — Flow 21: Create measurement → Link to tile → Verify cross-references | +140 |
| `tests/flows/analytics-source-filter.test.ts` | **New** — Flow 22: Add source → Detect types → Apply filter → Execute → Verify results | +140 |

**Design:**
- All flows test through AnalyticsService + AnalyticsEngine (domain-level, no UI mocking)
- Each flow creates its own AnalyticsService instance with mock storage (test isolation)
- Flows use mock CSV data (small, deterministic datasets)
- Assertion style: verify final state, not intermediate steps (resilient to refactoring)

**Flow 20 — Query to Dashboard:**
1. Create a query with 2 sources (CSV mock data)
2. Add dimensions and measures
3. Execute query → verify row count and column structure
4. Save query → verify persistence
5. Create dashboard → add tile referencing query
6. Verify tile renders with correct data

**Flow 21 — Measurement Lifecycle:**
1. Create and save a query with numeric measures
2. Create a measurement referencing the query
3. Add measurement to a dashboard tile
4. Verify cross-references: query → measurement → dashboard
5. Delete measurement → verify cascade (tile reference cleared)

**Flow 22 — Source to Filtered Execution:**
1. Add CSV source → verify type detection (string, number, date columns)
2. Add locale-specific source → verify locale detection
3. Build query with filters (string equality, number range, date range)
4. Execute → verify filtered results match expected rows
5. Change filter → re-execute → verify updated results

**AC:**
- [ ] Flow 20: full query-to-dashboard journey passes (build, execute, save, tile, render)
- [ ] Flow 21: measurement lifecycle passes (create, link, cross-ref, cascade delete)
- [ ] Flow 22: source-to-filtered-execution passes (add, detect, filter, execute, verify)
- [ ] All flows use isolated AnalyticsService instances (no test leakage)
- [ ] All flows use deterministic mock CSV data
- [ ] Total: ~24 tests across 3 suites
- [ ] `npm test` passes (including new flow tests)

**Tests:** ~24
**Docs:** No documentation changes (test-only).

---

## Dependency Graph

```
PBI-ANA-120 (Source Manager) ──> PBI-ANA-121 (Render Perf, partial — easier after source extraction)

PBI-ANA-121 (Render Perf) ──> PBI-ANA-123 (Filter Preview — depends on filtered result cache)

PBI-ANA-122 (Breadcrumbs) ── independent (uses existing navigateToTab from C42)

PBI-ANA-124 (TileRenderContext) ── independent

PBI-ANA-125 (CSS Consolidation) ── independent

PBI-ANA-126 (Flow Tests) ── runs last (tests final state after all changes)
```

**Execution order:** Inc 1 → Inc 2 → Inc 3 → Inc 4 → Inc 5 → Inc 6 → Inc 7

**Critical path:** Inc 1 → Inc 2 → Inc 4 (Source Manager → Render Cache → Filter Preview)

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Source Manager extraction breaks QueriesTab | High | Incremental extraction — move one operation at a time; run `npm test` after each move |
| Render batching causes missed renders | Medium | Use `requestAnimationFrame` (browser-standard); keep synchronous render as fallback for critical updates |
| Breadcrumb navigation stack memory | Low | Max depth 4; explicit clear on tab switch; entries are lightweight (strings + IDs) |
| Filtered result cache serves stale data | Medium | Conservative invalidation — clear on any query save, source change, or schema edit |
| Filter row-count preview causes confusion | Low | Show exact count (not estimate); hide badge when no cached data available |
| CSS consolidation changes visual appearance | Medium | 1:1 class mapping; verify each component visually before committing |
| Flow tests are brittle to implementation details | Medium | Assert on final state only (not intermediate steps); use public API surface |

---

## Success Metrics

| Metric | Target |
|--------|--------|
| New tests | ~52 |
| Post-cycle total tests | ~4,908 |
| Post-cycle suites | ~202 |
| QueriesTab LOC reduction | ~100 (1,026 → ~926) |
| Inline style strings eliminated | 80%+ |
| TileRenderContext properties per sub-interface | <10 (down from 23) |
| Filtered result cache hit rate | >50% on dashboard filter changes |
| Analytics flow test suites | 3 new (Flow 20, 21, 22) |
| New source files | 4 (SourceManager, Breadcrumbs, 3 test files) |
| Planned increments | 7 |

---

## Deferred Items

| Item | Rationale | Target |
|------|-----------|--------|
| QueriesTab full extraction (beyond SourceManager) | Source Manager is first step; full decomposition is a Cycle 44 objective | Cycle 44 |
| DashboardTileRenderer extraction (827 LOC) | Lower priority than QueriesTab; revisit after QueriesTab is stable | Cycle 44+ |
| ChartRenderer refactor (775 LOC) | No new chart types planned; current hand-crafted SVG works | Future |
| types.ts split (490 LOC) | Low impact; IDE search handles navigation | Future |
| Real-time tile preview during settings | Requires live re-rendering pipeline; high effort | Future |
| Keyboard shortcuts (Alt+1/2/3) | Tab bar is clickable; low ROI | Future |
| Query complexity warnings | Requires profiling infrastructure; no user complaints | Future |
| extractScalarFunction registry | Regex approach works fine; no new functions planned | Future |
| Weighted average for measurements | No user demand | Future |
| CSV parsing off-thread (TD-48) | No user complaints at current data sizes | Future |
| List virtualization (TD-44) | Fine at current scale (<200 items per list) | Future |
| Reports tab (PRD reserved) | No clear user demand yet | Future |
| Dashboard sharing/export (beyond templates) | Template export covers current needs | Future |
| Real-time auto-refresh | No streaming data sources yet | Future |

---

## Definition of Ready (Pre-Cycle)

- [ ] Cycle 42 delivered — all tests green, UX coherence complete
- [ ] No blocking bugs or data integrity issues
- [ ] QueriesTab source management code identified and mapped for extraction
- [ ] TileRenderContext callback inventory complete (23 properties documented by concern)
- [ ] Analytics inline style strings audited (200+ chars, 6+ files)
- [ ] `navigateToTab()` API available from Cycle 42 (breadcrumb foundation)
- [ ] TileResultCache TTL working from Cycle 41 (filtered cache extension foundation)
- [ ] Mock CSV data for flow tests prepared (deterministic, small datasets)

## Definition of Done

### 1. All Increments Completed
- [ ] 7 increments delivered, no partial state

### 2. Quality Gates
- [ ] `npm test` passes — ~4,908 tests green
- [ ] `npm run check` passes — no lint or type errors
- [ ] All new tests exercise the features they validate
- [ ] 3 new flow test suites passing

### 3. Architecture
- [ ] SourceManager class owns all source operations (no source logic in QueriesTab)
- [ ] QueriesTab render-batched (max 1 render per animation frame)
- [ ] FilteredResultCache with LRU eviction (max 20 entries)
- [ ] TileRenderContext partitioned into 3 focused interfaces (<10 props each)
- [ ] 80%+ inline styles moved to semantic CSS classes
- [ ] Navigation stack with breadcrumb bar (max depth 4)

### 4. User Experience
- [ ] Dashboard drill-down has breadcrumb trail with back navigation
- [ ] Filter changes show row-count preview before execution
- [ ] Dashboard filter changes are faster (cached result hits)
- [ ] Source management works through SourceManager (no behavioral changes)
- [ ] Visual appearance unchanged after CSS consolidation
- [ ] All existing analytics functionality works as before
