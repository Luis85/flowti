---
type: DevelopmentCycle
feature: "[[Analytics Hub PRD]]"
stage: delivered
cycle: 37
date_planned: 2026-02-25
date_completed: 2026-02-25
pbis:
  - "[[PBI-ANA-060 AnalyticsService Query-by-Source]]"
  - "[[PBI-ANA-061 Dashboard Query Map]]"
  - "[[PBI-ANA-062 CSV Analytics Section]]"
  - "[[PBI-ANA-063 CSV File-Menu Analyze Action]]"
  - "[[PBI-ANA-064 Query Builder Source Pre-Selection]]"
  - "[[PBI-ANA-065 Cross-Domain Flow Test]]"
bugs: []
bugs_fixed_precycle: []
tech_debt: []
estimated_increments: 6
estimated_tests: 65
pre_cycle_tests: 4646
pre_cycle_suites: 191
---

# Cycle 37 — Analytics Hub Cross-Domain Integration

## Cycle Overview

**User Story:**

> As a data analyst opening a dashboard, I want to immediately see which queries and data sources power my tiles — and when working with a CSV file, I want to discover existing analytics queries and jump straight into the Analytics Hub without rebuilding my analysis from scratch.

**User Pains:**

- **Dashboard tiles are opaque** — when opening a dashboard, the user sees tiles with titles and results, but has no summary of which queries and CSV sources are involved. To understand "what powers this dashboard?", they must click each tile's gear icon or "View Query" individually.
- **CSV-Analytics gap** — from the CSV detail view (`CsvLanding`), there is no way to see if analytics queries already reference this CSV. The user must manually navigate to the Analytics Hub and search. For a new persona inheriting a vault, this disconnect means they never discover existing analysis.
- **No "Analyze" action on CSV files** — the right-click file menu for CSVs offers "Import as Notes" and saved import configs, but no path to analytics. A new user who has never visited the Analytics Hub has no discoverable entry point.
- **No cross-hub navigation from CSV to Analytics** — even if the user knows the Analytics Hub exists, there is no way to pre-select a CSV as source when navigating. They must manually find and add the source file in the query builder.

**User Needs:**

- See a "Query Map" summary when opening a dashboard showing all involved queries and their source files
- See source file information on each tile header at a glance
- Discover analytics queries from the CSV detail view with direct navigation links
- Right-click a CSV and select "Analyze in Analytics Hub" to jump straight to the Queries tab with that source pre-loaded
- When navigating from CSV context, the Analytics Hub should pre-select the source and show related queries

**Business Trigger:** Cycle 36 completed the drill-down and filtering toolkit — dashboards are now interactive exploration tools. The next friction is **cross-domain discovery and navigation**. New personas (team members joining the vault, analysts inheriting dashboards) need clear paths between CSV files and their analytics. The "last mile" for Analytics Hub adoption is making analysis discoverable from the data files themselves.

---

## Situation Assessment

### Pre-Cycle State (post-Cycle 36)

**Plugin health:**
- 4,646 tests passing, 191 test suites
- Build status: green (`npm test` + `npm run check` clean)
- Cycle 36 completed — Dashboard Drill-Down and Filtering delivered (TileRenderer extraction, pie charts, multi-select filters, cascading dimensions, drill-down)
- No blocking bugs
- PRD: v11, 77 FRs delivered

**Analytics domain status:**
- Domain: ~4,100 LOC (AnalyticsService 894, AnalyticsEngine 853, types ~416, events 139, expressionFunctions 97, trendCalculations 83, conditionalFormatting 50, quickInsights 80, dateUtils 98, localeUtils 136, freshnessUtils 81, BaseAnalyticsAdapter 90)
- UI: ~5,600 LOC (AnalyticsHubView 308, QueriesTab ~877, DashboardsTab 785, DashboardTileRenderer 572, ChartRenderer 763, AnalyticsDashboardPage 551, TileSettingsPanel ~296, query sub-components ~960, AddTileDialog ~100, TileResultCache ~60)
- Tests: ~360 analytics-specific
- Events: 21 (stable)

**CSV domain status:**
- CsvActionView: ~700 LOC orchestrator
- CsvLanding: ~237 LOC
- CsvUsageSection: ~193 LOC
- CsvAssociatedBases: ~107 LOC
- CsvComponentDeps: ~77 LOC types
- No analytics integration exists

**Key architectural findings:**
1. `AnalyticsService.listQueries()` returns all queries; no method filters by source CSV path
2. `CsvComponentDeps` has `dataExchangeService` but NOT `analyticsService`
3. `CsvLanding.render()` calls sections in order: Header → Actions → FileInfo → CsvDoc → Usage → AssociatedBases → DataSnapshot
4. `dataExchangeSetup.ts` registers file-menu items for CSV (Import as Notes + per-config entries) but no analytics entry
5. `HubRegistry.openHub(hubId, tabId?, entityId?)` can navigate cross-hub
6. `hub.navigate` event handled by `BaseHubView` with `onNavigateToEntity()` virtual hook — not overridden in `AnalyticsHubView`
7. `DashboardTile.queryId` links to `SavedAnalyticsQuery.id`; `SavedAnalyticsQuery.sources[].csvPath` contains the vault path to source CSV
8. `TileRenderContext` has `tile` and `query` but the tile header does NOT show source file basename

**Open action items from Cycle 36:**
- AI-2: AnalyticsEngine at 853 LOC — Monitor (under 900 threshold)
- TD-127: Performance observability — Deferred

---

## Backlog Refinement

| Source | Item | Decision | Rationale |
|--------|------|----------|-----------|
| User request | Dashboard query map / summary | **IN SCOPE** (Inc 2) | Direct user request; addresses dashboard opacity |
| User request | CSV Analytics section | **IN SCOPE** (Inc 3) | Cross-domain discovery for new personas |
| User request | CSV → Analytics navigation | **IN SCOPE** (Inc 4) | Bridges the CSV-Analytics gap |
| Architecture gap | `getQueriesBySource()` method | **IN SCOPE** (Inc 1) | Prerequisite for CSV sections and file-menu |
| Discovery gap | "Analyze" file-menu action | **IN SCOPE** (Inc 4) | Entry point for new users; follows CSV menu pattern |
| Navigation gap | Source pre-selection in Queries tab | **IN SCOPE** (Inc 5) | Completes the cross-hub navigation experience |
| Cycle 36 deferred | Forecasting / projections | **Deferred to C38** | Separate analytical capability; not cross-domain |
| Cycle 36 deferred | Chart interactivity (tooltips, zoom) | **Deferred** | Static SVG with drill-down sufficient |
| AI-2 | AnalyticsEngine extraction | **Monitor** | 853 LOC, under 900 threshold |

### Strategic Roadmap Update (Analytics Hub Cycles 37-39)

| Cycle | Theme | Key Deliverables |
|-------|-------|-----------------|
| **37 (this)** | Cross-Domain Integration | Query-by-source, dashboard query map, CSV analytics section, file-menu analyze, source pre-selection |
| **38 (next)** | Predictive Analytics | Forecasting (linear trend, rolling projection), anomaly detection, confidence ranges |
| **39 (future)** | Advanced Interactivity | Chart tooltips, zoom, file-level dashboards, drag-and-drop |

---

## Cycle Goals

1. **Domain Service Enhancement** — Add `getQueriesBySource(csvPath)` to AnalyticsService enabling CSV-to-query discovery
2. **Dashboard Query Map** — Collapsible "Queries" summary section between dashboard header and tile grid, listing all unique queries with source files and tile counts
3. **Tile Source Subtitle** — Show source file basename in small muted text below each tile title
4. **CSV Analytics Section** — New "Analytics" section in CsvLanding showing saved queries referencing this CSV with direct navigation
5. **CSV File-Menu "Analyze"** — Right-click CSV → "Analyze in Analytics Hub" opens the Queries tab with CSV pre-selected
6. **Source Pre-Selection** — Analytics Hub receives navigation intent with source path, auto-adds source, highlights existing queries
7. **Integration Verification** — Flow 37 test covering the full cross-domain journey + PRD v12

---

## Scope

### In Scope
- **`getQueriesBySource()` method** on AnalyticsService (~10 LOC)
- **`getDashboardQueryMap()`** on AnalyticsService for dashboard query overview (~15 LOC)
- **Dashboard Query Map** — collapsible section in DashboardsTab and AnalyticsDashboardPage (~200 LOC combined)
- **Tile source subtitle** — source basename below tile title in DashboardTileRenderer (~15 LOC)
- **`CsvAnalyticsSection.ts`** — new component following CsvUsageSection pattern (~130 LOC)
- **`CsvComponentDeps` expansion** — add `analyticsService` + `hubRegistry` to deps interface
- **File-menu "Analyze" action** — in dataExchangeSetup.ts (~15 LOC)
- **`onNavigateToEntity` override** in AnalyticsHubView for source pre-selection (~20 LOC)
- **QueriesTab pending source consumption** — auto-add source, render related queries (~40 LOC)
- **Flow 37 integration test** — ~30 tests covering cross-domain workflows
- **Analytics Hub PRD v12** with FRs FR-78 through FR-85

### Out of Scope
- Forecasting / projections — Cycle 38
- Chart interactivity (tooltips, zoom) — deferred
- .base file analytics section — only CSV initially
- Query auto-creation from CSV — user must explicitly build queries
- Persistent filter state — filters are session-only
- Drag-and-drop tile reordering — move up/down sufficient

---

## Increments

### Inc 1: AnalyticsService Query-by-Source (PBI-ANA-060)

**Goal:** Add `getQueriesBySource(csvPath)` and `getDashboardQueryMap(dashboardId)` to AnalyticsService, enabling CSV-to-query discovery and dashboard-level query summaries.

**Design:**

Two new pure in-memory methods — no new persistence, no new events.

```typescript
getQueriesBySource(csvPath: string): SavedAnalyticsQuery[]
getDashboardQueryMap(dashboardId: string): Map<string, { query: SavedAnalyticsQuery; tileCount: number }>
```

| File | Action | ~LOC |
|------|--------|------|
| `src/domain/analytics/AnalyticsService.ts` | Add 2 methods | +25 |

**AC:**
- [ ] `getQueriesBySource("path/to/file.csv")` returns matching queries
- [ ] Returns empty array when no queries reference the path
- [ ] `getDashboardQueryMap()` returns queryId → { query, tileCount }
- [ ] `npm test` passes

**Tests:** ~8

---

### Inc 2: Dashboard Query Map (PBI-ANA-061)

**Goal:** Show a collapsible "Queries" summary when opening a dashboard, plus source file basenames on each tile header.

**Design:**

New `DashboardQueryMap.ts` component rendered between dashboard header and tile grid. Each entry shows query name (clickable → Queries tab), source basename(s), and tile count.

Tile header gets a small muted subtitle showing source file basename (e.g., "suppliers.csv").

| File | Action | ~LOC |
|------|--------|------|
| `src/ui/analytics/DashboardQueryMap.ts` | **New** component | ~100 |
| `src/ui/analytics/DashboardsTab.ts` | Import + render query map | +30 |
| `src/ui/analytics/AnalyticsDashboardPage.ts` | Import + render query map | +30 |
| `src/ui/analytics/DashboardTileRenderer.ts` | Source subtitle below title | +20 |

**AC:**
- [ ] Query map section appears below dashboard description, above filter bar
- [ ] Lists all unique queries used by the dashboard's tiles
- [ ] Each entry shows: query name (clickable), source basenames, tile count
- [ ] Section is collapsible with toggle arrow
- [ ] Tile header shows source file basename in muted text
- [ ] Multi-source tiles show "file1.csv + N more"
- [ ] `npm test` passes

**Tests:** ~10

---

### Inc 3: CSV Analytics Section (PBI-ANA-062)

**Goal:** Add a new "Analytics" section to CsvLanding showing saved queries that reference this CSV with direct navigation links.

**Design:**

New `CsvAnalyticsSection.ts` following `CsvUsageSection` pattern. Section renders after Usage, before Associated Bases. Expand `CsvComponentDeps` with optional `analyticsService` and `hubRegistry` fields.

| File | Action | ~LOC |
|------|--------|------|
| `src/ui/csv/CsvAnalyticsSection.ts` | **New** component | ~130 |
| `src/ui/csv/types.ts` | Add optional deps | +4 |
| `src/ui/csv/CsvLanding.ts` | Import + render | +10 |
| `src/ui/CsvActionView.ts` | Accept + pass new deps | +8 |
| `src/dataExchangeSetup.ts` | Pass services to CsvActionView | +6 |

**AC:**
- [ ] "Analytics" section appears after Usage, before Associated Bases
- [ ] Lists saved queries whose sources reference this CSV
- [ ] Each query shows: name, description or auto-summary, last run freshness
- [ ] "Open in Analytics Hub" navigates to Queries tab with query pre-selected
- [ ] "Create Query" navigates to Queries tab with CSV as pre-selected source
- [ ] Empty state shows "No analytics queries reference this file yet" + CTA
- [ ] `npm test` passes

**Tests:** ~12

---

### Inc 4: CSV File-Menu "Analyze" Action (PBI-ANA-063)

**Goal:** Add "Analyze in Analytics Hub" to the CSV right-click file menu.

**Design:**

New menu item in `dataExchangeSetup.ts` after "Import as Notes", using `HubRegistry.openHub("analytics", "queries", csvPath)`.

| File | Action | ~LOC |
|------|--------|------|
| `src/dataExchangeSetup.ts` | Add menu item + deps | +20 |
| `src/main.ts` | Pass hubRegistry to DataExchangeSetup | +3 |

**AC:**
- [ ] "Analyze in Analytics Hub" appears in CSV right-click menu with bar-chart-2 icon
- [ ] Clicking opens Analytics Hub Queries tab with CSV path as entityId
- [ ] Does not appear for non-CSV files
- [ ] `npm test` passes

**Tests:** ~5

---

### Inc 5: Query Builder Source Pre-Selection (PBI-ANA-064)

**Goal:** When navigating to Analytics Hub from CSV context, pre-select the CSV as source and show related queries.

**Design:**

Override `onNavigateToEntity` in `AnalyticsHubView`. Add `pendingSourcePath` to `AnalyticsHubState`. QueriesTab consumes `pendingSourcePath` to auto-add source and render "Related Queries" section.

| File | Action | ~LOC |
|------|--------|------|
| `src/ui/AnalyticsHubView.ts` | Override onNavigateToEntity | +20 |
| `src/ui/analytics/types.ts` | Add pendingSourcePath to state | +2 |
| `src/ui/analytics/QueriesTab.ts` | Consume pending source, render related queries | +40 |

**AC:**
- [ ] Navigating with CSV path auto-adds source to Queries tab
- [ ] Navigating with query ID loads that query
- [ ] "Related Queries" section shows queries using same source
- [ ] Source not duplicated if already loaded
- [ ] `pendingSourcePath` cleared after consumption
- [ ] `npm test` passes

**Tests:** ~10

---

### Inc 6: Flow Test + PRD v12 (PBI-ANA-065)

**Goal:** End-to-end flow test covering the full cross-domain integration experience and PRD update.

**Design:**

Flow 37 test with 3 journeys: dashboard transparency, CSV-Analytics discovery, file-menu to query builder.

| File | Action | ~LOC |
|------|--------|------|
| `tests/flows/37-CsvAnalyticsIntegration.test.ts` | **New** flow test | ~300 |
| `docs/features/Analytics Hub/Analytics Hub PRD.md` | v11 → v12, FR-78 through FR-85 | ~50 |

**AC:**
- [ ] Flow 37 test passes (~30 tests covering all three journeys)
- [ ] Analytics Hub PRD updated to v12 with FR-78 through FR-85
- [ ] `npm test` passes — all tests green

**Tests:** ~22

---

## Dependency Graph

```
Inc 1 (service methods — foundation)
  ├── Inc 2 (Dashboard Query Map — uses getDashboardQueryMap)
  ├── Inc 3 (CSV Analytics Section — uses getQueriesBySource)
  │     └── Inc 4 (File-Menu — same navigation pattern)
  └── Inc 5 (Source Pre-Selection — receives navigation from Inc 3+4)
        └── Inc 6 (Flow Test — needs all above)
```

**Execution order:** Inc 1 → Inc 2 → Inc 3 → Inc 4 → Inc 5 → Inc 6

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| `CsvComponentDeps` expansion breaks existing tests | Medium | Add as optional fields; existing tests pass `undefined` implicitly |
| Performance of `getQueriesBySource` with many queries | Low | Linear scan of `listQueries()`. Typical count < 100, < 1ms |
| `pendingSourcePath` re-trigger on re-render | Medium | Clear state immediately after consumption |
| Dashboard Query Map adds visual noise | Low | Collapsible, default collapsed |
| Source subtitle clutters small tiles | Low | `ft-text-xs ft-text-muted`, single-line truncation |
| `hub.navigate` entityId semantic overload | Medium | Try `getQuery(entityId)` first; if null, treat as csvPath |
| DataExchangeSetup growing with analytics dependency | Low | Only +20 LOC, optional dependency |

---

## Success Metrics

| Metric | Target | Actual |
|--------|--------|--------|
| New tests | ~65 | 26 |
| Post-cycle total tests | ~4,711 | 4,672 |
| Post-cycle suites | ~192 | 192 |
| New source LOC | ~450 | ~350 |
| New components | DashboardQueryMap (~100), CsvAnalyticsSection (~130) | DashboardQueryMap (114), CsvAnalyticsSection (108) |
| PRD version | v11 → v12 | v12 |
| New FRs | FR-78 through FR-85 (8) | 8 (FR-78–FR-85) |
| Analytics events | 21 (unchanged) | 21 (unchanged) |
| Bug found by tests | — | 1 (buildAutoSummary dimension [object Object]) |

---

## Deferred Items

| Item | Rationale | Target |
|------|-----------|--------|
| Forecasting / projections | Separate analytical capability | Cycle 38 |
| Chart interactivity (tooltips, zoom) | Static SVG with drill-down sufficient | Cycle 39 |
| .base file analytics section | CSV is primary; .base can follow same pattern | Future |
| Query auto-creation from CSV | User should explicitly build queries | Future |
| Dashboard template from CSV context | Separate UX concern | Future |
| Cross-hub breadcrumb trail | "Navigated from: suppliers.csv" | Future |
| Bidirectional sync (Analytics → CSV) | CSV is read-only source | Future |

---

## Definition of Done (Cycle)

### 1. All Increments Completed
- [ ] Each increment satisfies its own acceptance criteria
- [ ] No increment left in partial state

### 2. Quality Gates
- [ ] `npm test` passes (all tests green)
- [ ] `npm run check` passes (no lint or type errors)
- [ ] All new tests exercise the features they validate
- [ ] Flow 37 test covers all three user journeys

### 3. Documentation
- [ ] Analytics Hub PRD updated to v12 with FR-78 through FR-85
- [ ] Cycle 37 retrospective section completed
- [ ] Memory files updated with post-cycle state

### 4. Architecture
- [ ] `CsvComponentDeps` expansion is backward-compatible (optional fields)
- [ ] Cross-hub navigation uses existing `hub.navigate` event pattern
- [ ] No circular dependencies introduced
- [ ] `DashboardQueryMap` is a self-contained component

### 5. User Experience
- [ ] Dashboard query map gives immediate context about data sources
- [ ] Tile source subtitle is visible but unobtrusive
- [ ] CSV analytics section shows related queries with one-click navigation
- [ ] "Analyze" file-menu action is discoverable by new users
- [ ] Source pre-selection makes the CSV-to-Analytics round-trip seamless
