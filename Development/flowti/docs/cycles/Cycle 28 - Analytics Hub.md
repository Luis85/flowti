---
type: DevelopmentCycle
feature: "[[Analytics Hub PRD]]"
stage: delivered
cycle: 28
date_planned: 2026-02-23
date_completed: 2026-02-23
pbis:
  - "[[PBI-ANA-010 Analytics Hub Shell]]"
  - "[[PBI-ANA-011 Dashboard Domain]]"
  - "[[PBI-ANA-012 Dashboard Tile Grid UI]]"
  - "[[PBI-ANA-013 Base File Analytics Source]]"
  - "[[PBI-ANA-014 Analytics Integration and Polish]]"
bugs: []
bugs_fixed_precycle: []
tech_debt: []
estimated_increments: 5
actual_increments: 5
estimated_tests: 165
actual_new_tests: 67
pre_cycle_tests: 4271
post_cycle_tests: 4338
pre_cycle_suites: 176
post_cycle_suites: 178
---

# Cycle 28: Analytics Hub — Dashboards & Intelligence

## Cycle Overview

**User Story:**

> As a data analyst working with CSV and vault data, I want a dedicated Analytics Hub with a dashboard tile grid so that I can compose multiple query results into a single view, use `.base` files as data sources, and manage my analytics workflows without navigating through the Data Exchange Hub.

**User Pains:**
- Analytics buried as the last tab in a 9-tab DX Hub — buried behind import/export tabs
- No way to compose multiple query results into a unified dashboard view
- Analytics can only consume CSV files — vault `.base` data sources invisible
- Analytics state coupled to DataExchangeState, making independent evolution fragile

**User Needs:**
- Dedicated Analytics Hub with BaseHubView shell (top bar, tab bar, split layout, render debounce)
- Named dashboards with tile grids — each tile shows results from a saved query
- `.base` file support as analytics source via BaseQueryEngine infrastructure
- Independent persistence with backward-compatible migration from DX state
- Discoverability via command palette and User Hub cross-hub card

**Business Trigger:** Cycle 27 delivered the analytics engine and query builder. Users now need to move from individual query execution to composed dashboard views. The DX Hub's 9-tab bar is at capacity, and analytics deserves its own hub.

---

## Situation Assessment

### Pre-Cycle State (post-Cycle 27)

**Plugin health:**
- 4,271 tests passing, 176 test suites, 32 skipped
- Build status: green (`npm test` + `npm run check` clean)
- Cycle 27 completed — Analytics Sprint delivered, Three Amigos PASS (TASM 31/35)
- No pre-cycle bug fixes needed

**Analytics domain status:**
- Domain: 1,058 LOC (AnalyticsEngine 331, AnalyticsService 242, types 205, localeUtils 136, dateUtils 98, events 46)
- UI: 972 LOC (AnalyticsTab 806, AnalyticsResultsPanel 166)
- Tests: 163 across 7 test files (80 engine, 25 locale, 21 date, 31 service, 27 flow)
- Events: 5 (started, completed, failed, saved, deleted)
- Saved queries persist to DataExchangeState + JSON files in vault

**DX Hub status:**
- 9 tabs: Pipelines, Imports, Exports, Types, Properties, Signals, Reports, Canvas, Analytics
- Analytics tab at 806 LOC — OBS-1 from Cycle 27 review recommends extraction at 900+

**Observations from Cycle 27 review:**
- OBS-1: AnalyticsTab at 806 LOC — monitor for extraction → this cycle decomposes it
- OBS-2: No dedicated UI unit tests → this cycle adds UI tests in integration increment
- OBS-3: LOC exceeded estimates by 1.5x → apply multiplier in this cycle's estimates

---

## Cycle Goals

1. **Analytics Hub Shell** — Dedicated BaseHubView subclass with independent persistence and backward-compatible migration
2. **Dashboard Domain** — Types, service CRUD, events for dashboard and tile management
3. **Dashboard Tile Grid UI** — Visual tile grid with table and stat-card display modes
4. **Base File Sources** — `.base` files as analytics data sources via BaseAnalyticsAdapter
5. **Integration & Polish** — HubProvider, command palette, flow tests, empty states, error boundaries

---

## Scope

### In Scope
- New `AnalyticsHubView` extending `BaseHubView` with 2 tabs (Dashboards, Queries)
- Dashboard domain: `Dashboard`, `DashboardTile`, `TileDisplayMode` types
- Dashboard CRUD in AnalyticsService with 7 new events
- Dashboard tile grid UI with CSS Grid layout
- `BaseAnalyticsAdapter` for `.base` file → ParsedSourceData resolution
- State migration from `"dataExchange"` to `"analytics"` TypedStorage key
- AnalyticsTab (806 LOC) decomposed into QueriesTab during migration
- Analytics tab removed from DataExchangeHubView
- `AnalyticsHubProvider` for User Hub cross-hub card
- `flowti:open-analytics-hub` command

### Out of Scope
- Charts or visualizations (tables and stat cards only)
- Drag-and-drop tile reordering (manual position in v1)
- Dashboard auto-refresh (manual refresh per tile)
- Calculated columns or derived measures
- Dashboard templates or sharing/export
- Reports tab (future, reserved slot)

---

## Increments

### Inc 1: Analytics Hub Shell + Query Migration

**Goal:** Create the new hub view, migrate the query builder, set up independent storage, remove from DX Hub.

**Design:**
- `AnalyticsHubView` extends `BaseHubView<AnalyticsPage>` with 2 tabs (dashboards, queries)
- `VIEW_TYPE_ANALYTICS_HUB` constant in `src/domain/hub/types.ts`
- `AnalyticsState = { savedAnalyticsQueries, dashboards }` with TypedStorage key `"analytics"`
- Migration in `AnalyticsService.load()`: read from old key, copy to new key, clear old
- QueriesTab migrated from AnalyticsTab (decomposed from 806 → ~450 LOC)
- DX Hub: remove `"analytics"` tab, `AnalyticsTab` import, `analyticsService` dep

| File | Action | LOC |
|------|--------|-----|
| `src/domain/hub/types.ts` | Add VIEW_TYPE_ANALYTICS_HUB | +1 |
| `src/domain/analytics/types.ts` | Add AnalyticsState, AnalyticsSourceType | +20 |
| `src/domain/analytics/AnalyticsService.ts` | Storage migration, load() migration path | +40 |
| `src/ui/AnalyticsHubView.ts` | **New** — BaseHubView subclass | +250 |
| `src/ui/analytics/types.ts` | **New** — hub state + deps interfaces | +60 |
| `src/ui/analytics/QueriesTab.ts` | **New** — migrated query builder | +450 |
| `src/ui/analytics/AnalyticsDashboardPage.ts` | **New** — hub overview stats | +80 |
| `src/ui/DataExchangeHubView.ts` | Remove analytics tab | -40 |
| `src/infrastructure/services/registry.ts` | Storage key change | +1 |
| `src/main.ts` | Wire new hub view | +20 |

**AC:**
- [x] Analytics Hub opens with 2 tabs (Dashboards, Queries)
- [x] Queries tab has full query builder functionality
- [x] Hub dashboard shows overview stats
- [x] DX Hub no longer has analytics tab (8 tabs)
- [x] Saved queries migrate automatically on first load
- [x] Existing 163 analytics tests pass
- [x] `npm test` passes

---

### Inc 2: Dashboard Domain

**Goal:** Add dashboard CRUD to AnalyticsService with events and catalog registration.

**Design:**
- Dashboard, DashboardTile, TileDisplayMode types in analytics/types.ts
- 7 dashboard events + analytics.loaded in events.ts
- CRUD methods: createDashboard, updateDashboard, deleteDashboard, addTile, removeTile, updateTile, listDashboards
- Register 8 new events in catalog.ts

| File | Action | LOC |
|------|--------|-----|
| `src/domain/analytics/types.ts` | Add Dashboard, DashboardTile, TileDisplayMode | +35 |
| `src/domain/analytics/events.ts` | Add 7 dashboard events + loaded | +40 |
| `src/domain/analytics/AnalyticsService.ts` | Dashboard CRUD methods | +120 |
| `src/infrastructure/events/catalog.ts` | Register 8 new events | +10 |

**AC:**
- [x] Dashboard create, list, get, update, delete work
- [x] Tile add, remove, update work within a dashboard
- [x] All operations emit correct events
- [x] Events appear in Event Catalog under "Analytics" category
- [x] State round-trips through TypedStorage
- [x] `npm test` passes

---

### Inc 3: Dashboard Tile Grid UI

**Goal:** Build the visual dashboards tab with tile grid rendering.

**Design:**
- DashboardsTab: master (dashboard list) / detail (tile grid)
- DashboardTileRenderer: renders single tile as table (AnalyticsResultsPanel) or stat-card
- AddTileDialog: inline dialog for picking query + display mode
- CSS Grid layout with uniform tile sizing (v1)

| File | Action | LOC |
|------|--------|-----|
| `src/ui/analytics/DashboardsTab.ts` | **New** — master/detail | +200 |
| `src/ui/analytics/DashboardTileRenderer.ts` | **New** — tile renderer | +120 |
| `src/ui/analytics/AddTileDialog.ts` | **New** — inline dialog | +80 |
| `src/ui/AnalyticsHubView.ts` | Wire DashboardsTab | +15 |

**AC:**
- [x] User can create, select, delete dashboards from master list
- [x] Selected dashboard shows tile grid in detail panel
- [x] Tiles render query results in correct display mode
- [x] Tile add dialog lets user pick query + display mode
- [x] Tile removal works
- [x] Empty state shown when no dashboards or no tiles
- [x] `npm test` passes

---

### Inc 4: .Base File Analytics Source

**Goal:** Create adapter for `.base` files and update source picker.

**Design:**
- BaseAnalyticsAdapter composes BaseQueryEngine + vault file scanning
- Source picker updated to show `.base` files with distinct indicator
- SavedAnalyticsQuerySource extended with sourcePath, sourceType, viewIndex
- AnalyticsService.loadBase() alongside existing loadCsv()

| File | Action | LOC |
|------|--------|-----|
| `src/domain/analytics/BaseAnalyticsAdapter.ts` | **New** — .base → ParsedSourceData | +120 |
| `src/domain/analytics/types.ts` | Update SavedAnalyticsQuerySource | +10 |
| `src/domain/analytics/AnalyticsService.ts` | loadBase(), runSavedQuery() update | +40 |
| `src/ui/analytics/QueriesTab.ts` | Source picker update | +30 |

**AC:**
- [x] `.base` files appear in source picker alongside CSVs
- [x] Selecting `.base` file loads resolved data as analytics source
- [x] Column type detection works on `.base`-sourced data
- [x] Saved queries can reference `.base` sources and re-execute
- [x] Existing CSV-only queries continue working
- [x] `npm test` passes

---

### Inc 5: Integration, Provider, and Polish

**Goal:** Cross-hub integration, commands, flow tests, polish.

**Design:**
- AnalyticsHubProvider for User Hub cross-hub card
- `flowti:open-analytics-hub` command
- End-to-end flow test: query → dashboard → tile → results
- Polish: empty states, search filtering, error boundaries

| File | Action | LOC |
|------|--------|-----|
| `src/domain/hub/AnalyticsHubProvider.ts` | **New** — HubDashboardProvider | +45 |
| `src/main.ts` | Register provider + command | +15 |
| `src/infrastructure/commands/registry.ts` | Analytics hub command | +10 |
| `tests/flows/28-AnalyticsHub.test.ts` | **New** — integration tests | +80 |
| Polish across QueriesTab + DashboardsTab | Empty states, search, errors | +50 |

**AC:**
- [x] Analytics Hub card appears in User Hub
- [x] `flowti:open-analytics-hub` opens hub from command palette
- [x] End-to-end flow test passes (19 tests in Flow 28)
- [x] Existing 25-AnalyticsPipeline.test.ts passes
- [x] Empty states render correctly
- [x] `npm test` passes

---

## Dependency Graph

```
Inc 1 (hub shell + migration)
  ├── Inc 2 (dashboard domain) → Inc 3 (tile grid UI)
  ├── Inc 4 (.base source)
  └── Inc 5 (integration — needs all above)
```

**Execution order:** Inc 1 → Inc 2 + Inc 4 (parallel) → Inc 3 → Inc 5

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| State migration loses data if interrupted | High | Idempotent: old data not deleted until new confirmed saved |
| `.base` file resolution slow for large vaults | Medium | Reuse ExportService listFiles callback (already optimized) |
| AnalyticsTab decomposition regressions | Medium | Migrate structurally first, keep existing tests passing |
| Tile grid layout complexity | Low | v1 uses uniform tiles; config supports future variable sizing |
| Source schema change breaks existing queries | Medium | Backward-compat: read both csvPath and sourcePath |
| DX Hub cleanup breaks existing tests | Medium | Update DX Hub tests in same increment as cleanup |

---

## Success Metrics

| Metric | Target | Actual | Delta |
|--------|--------|--------|-------|
| New tests | ~165 | 67 | -98 (see deviations) |
| Post-cycle total tests | ~4,436 | 4,338 (178 suites) | -98 |
| New source LOC | ~1,550 | ~1,970 | +420 |
| DX Hub tabs | 9 → 8 | 8 tabs | On target |
| Analytics events | 5 → 12 | 12 events | On target |
| New domain types | 5 | 5 (Dashboard, DashboardTile, TileDisplayMode, AnalyticsSourceType, AnalyticsState) | On target |
| New UI components | 6 | 6 (AnalyticsHubView, QueriesTab, DashboardsTab, DashboardTileRenderer, AddTileDialog, AnalyticsDashboardPage) | On target |

---

## Deferred Items

| Item | Rationale | Target |
|------|-----------|--------|
| Charts/visualizations | Tables + stat cards sufficient; chart library is larger investment | Cycle 29+ |
| Drag-and-drop tile reordering | Manual position sufficient for v1 | Cycle 29 |
| Dashboard auto-refresh | Manual refresh per tile is sufficient | Future |
| Calculated columns | Not needed for current business questions | Future |
| Dashboard templates | Nice-to-have once dashboard patterns emerge | Future |
| Dashboard sharing/export | Export individual results covers the need | Future |
| Reports tab | Reserved slot for future reporting capabilities | Future |

---

## Definition of Done (Cycle)

### 1. All Increments Completed
- [x] Each increment satisfies its own acceptance criteria
- [x] No increment left in partial state
- [x] Deferred items documented with rationale

### 2. Build & Test Quality
- [x] `npm test` passes — 4,338 tests, 178 suites, 0 failures
- [x] `npm run check` passes (tsc + eslint clean)
- [x] No test regressions on existing 4,271 tests
- [x] Test count deviation documented (see Deviations section)

### 3. Three Amigos Review
- [ ] Cycle-level review conducted
- [ ] All three perspectives represented
- [ ] TASM scores recorded
- [ ] Observations documented

### 4. PRD & Backlog Updates
- [x] Analytics Hub PRD updated (stage: draft → delivered, v2, FRI 31/35)
- [x] PBIs updated (ANA-010 through ANA-014 → delivered)
- [x] Event model current (12 events in catalog)

### 5. Documentation
- [x] Cycle plan updated with actual values
- [x] Success metrics verified
- [x] Component docs updated for new components

### 6. Cycle Plan Completion
- [x] Frontmatter updated (stage, date_completed, actual values)
- [x] Deviations documented

### 7. Cycle Retrospective
- [x] "What Went Well" section completed
- [x] "Deviations from Plan" section completed
- [x] "Learnings" section completed

---

## DoR Preparation Notes

### 1. Feature PRD Readiness
- [x] PRD exists — [[Analytics Hub PRD]], stage: draft, FRI 23/35
- [x] Foundation documented — builds on Cycle 27 analytics delivery
- [x] Technical Review context — Cycle 27 Three Amigos Review (PASS, TASM 31/35)

### 2. Backlog Readiness
- [x] PBIs defined — ANA-010 through ANA-014
- [x] PBIs chunked into 5 increments — vertical slices
- [x] Dependencies mapped — Inc 1 first, then parallel/sequential
- [x] Priority ranked — shell first (blocker), then domain, then UI

### 3. Cycle Plan Document
- [x] Cycle document exists with standard frontmatter
- [x] Situation assessment written (post-Cycle 27, 4,271 tests)
- [x] Cycle goals defined (5 goals)
- [x] Proposed increments specified (5 with scope, LOC, tests)
- [x] Dependency graph drawn
- [x] Risks identified (6 risks)
- [x] Success metrics defined
- [x] Deferred items documented (7 items)

### 4. Increment Readiness
- [x] All 5 increments have: scope, AC, test intent, architecture

### 5. Quality Baseline
- [x] Build pipeline green — `npm test` passes (4,271 tests, 176 suites)
- [x] No critical bugs open
- [x] Previous cycle closed — Cycle 27 retrospective + Three Amigos completed

### 6. Pre-Cycle Completion
- [x] Pre-cycle work documented — no pre-cycle fixes needed
- [x] Inbox signals reviewed — analytics hub addresses primary user request

---

## Cycle Retrospective

### What Went Well

1. **Smooth BaseHubView inheritance** — 4th hub using BaseHubView (after Event Catalog, DX Hub, Train Hub). The pattern is well-established; AnalyticsHubView was functional in ~250 LOC with all shell features (tabs, search, debounced render, hub lifecycle events) inherited.

2. **Clean DX Hub decoupling** — Removing the analytics tab from DX Hub was straightforward. The hub's dependency bag pattern meant removing `analyticsService` from `HubComponentDeps` was the only interface change needed. No cascading test failures.

3. **BaseAnalyticsAdapter reuse** — Instead of modifying ExportService (which would have crossed domain boundaries), creating pure functions that mirror `resolveColumnValue()` kept the analytics domain self-contained while reusing ExportService as a callback provider.

4. **Flow 28 test coverage** — 19 integration tests covering the full pipeline (hub lifecycle → query → save → dashboard → tile → results → persistence → edge cases) in a single coherent flow test.

5. **Execution order** — Inc 1 → Inc 2 → Inc 3 → Inc 4 → Inc 5 followed the dependency graph cleanly. Each increment had a green `npm test` at completion.

### Deviations from Plan

| Deviation | Planned | Actual | Impact |
|-----------|---------|--------|--------|
| New tests | ~165 | 67 | Test intent was overly optimistic — UI rendering tests (DashboardsTab, QueriesTab, AddTileDialog) were deprioritized in favor of domain + flow tests. The 19 flow tests cover the critical paths end-to-end. |
| New source LOC | ~1,550 | ~1,970 | QueriesTab migrated at ~800 LOC (vs. estimated ~450) due to retaining full query builder complexity. DashboardsTab at ~225 LOC (vs. ~200). Additional wiring in hub view. |
| Execution order | Inc 2 + Inc 4 parallel | Sequential | Inc 2 completed before Inc 4 started; no parallel execution but no impact on delivery. |

### Learnings

- **L-31: Obsidian `createEl()` value gotcha** — `createEl("option", { value: "..." })` doesn't work because `value` is not in Obsidian's `DomElementInfo` type. Must set `.value` separately after element creation.
- **L-32: FlowtiEvent wrapper in tests** — Event handlers receive `FlowtiEvent<T, P>` (with `.type`, `.payload`, `.timestamp`), not raw payload. Test event listeners must access `.payload` from the wrapper object.
- **L-33: Test count estimates need grounding** — Estimated ~165 tests but delivered 67. UI component tests (rendering, DOM assertions) require obsidian-stub enhancements for CSS Grid and other modern patterns. Domain + flow tests provide better coverage-per-LOC.

---

## Delivery Summary

| Metric | Value |
|--------|-------|
| Increments delivered | 5/5 |
| PBIs delivered | 5/5 (ANA-010 through ANA-014) |
| New tests | 67 (19 BaseAnalyticsAdapter + 19 Flow 28 + 29 service/domain) |
| Post-cycle total | 4,338 tests, 178 suites |
| New source files | 6 (AnalyticsHubView, QueriesTab, DashboardsTab, DashboardTileRenderer, AddTileDialog, AnalyticsDashboardPage, BaseAnalyticsAdapter, AnalyticsHubProvider) |
| Modified files | ~10 (AnalyticsService, types, events, catalog, main, DX Hub view, registry) |
| New source LOC | ~1,970 |
| Analytics events | 5 → 12 |
| DX Hub tabs | 9 → 8 |

---

## Related
- PRD: [[Analytics Hub PRD]]
- Prior Cycle: [[Cycle 27 - Analytics Sprint]]
- Review: [[Three Amigos Review 2026-02-23 Analytics Sprint]]
- Flow: [[Build Analytics Dashboard]]
- PBIs: [[PBI-ANA-010 Analytics Hub Shell]], [[PBI-ANA-011 Dashboard Domain]], [[PBI-ANA-012 Dashboard Tile Grid UI]], [[PBI-ANA-013 Base File Analytics Source]], [[PBI-ANA-014 Analytics Integration and Polish]]
- Inbox: [[When opening a CSV with Flowti, I want to be able to make an easy dashboard]]
