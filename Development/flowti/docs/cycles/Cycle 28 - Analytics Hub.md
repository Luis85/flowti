---
type: DevelopmentCycle
feature: "[[Analytics Hub PRD]]"
stage: planned
cycle: 28
date_planned: 2026-02-23
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
estimated_tests: 165
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
- [ ] Analytics Hub opens with 2 tabs (Dashboards, Queries)
- [ ] Queries tab has full query builder functionality
- [ ] Hub dashboard shows overview stats
- [ ] DX Hub no longer has analytics tab (8 tabs)
- [ ] Saved queries migrate automatically on first load
- [ ] Existing 163 analytics tests pass
- [ ] `npm test` passes

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
- [ ] Dashboard create, list, get, update, delete work
- [ ] Tile add, remove, update work within a dashboard
- [ ] All operations emit correct events
- [ ] Events appear in Event Catalog under "Analytics" category
- [ ] State round-trips through TypedStorage
- [ ] `npm test` passes

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
- [ ] User can create, select, delete dashboards from master list
- [ ] Selected dashboard shows tile grid in detail panel
- [ ] Tiles render query results in correct display mode
- [ ] Tile add dialog lets user pick query + display mode
- [ ] Tile removal works
- [ ] Empty state shown when no dashboards or no tiles
- [ ] `npm test` passes

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
- [ ] `.base` files appear in source picker alongside CSVs
- [ ] Selecting `.base` file loads resolved data as analytics source
- [ ] Column type detection works on `.base`-sourced data
- [ ] Saved queries can reference `.base` sources and re-execute
- [ ] Existing CSV-only queries continue working
- [ ] `npm test` passes

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
- [ ] Analytics Hub card appears in User Hub
- [ ] `flowti:open-analytics-hub` opens hub from command palette
- [ ] End-to-end flow test passes
- [ ] Existing 25-AnalyticsPipeline.test.ts passes
- [ ] Empty states render correctly
- [ ] `npm test` passes

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

| Metric | Target |
|--------|--------|
| New tests | ~165 |
| Post-cycle total tests | ~4,436 |
| New source LOC | ~1,550 |
| DX Hub tabs | 9 → 8 (analytics removed) |
| Analytics events | 5 → 12 |
| New domain types | 5 |
| New UI components | 6 (hub view, 2 tabs, tile renderer, dialog, dashboard page) |

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
- [ ] Each increment satisfies its own acceptance criteria
- [ ] No increment left in partial state
- [ ] Deferred items documented with rationale

### 2. Build & Test Quality
- [ ] `npm test` passes
- [ ] `npm run check` passes (tsc + eslint clean)
- [ ] No test regressions on existing 4,271 tests
- [ ] Test count deviation documented

### 3. Three Amigos Review
- [ ] Cycle-level review conducted
- [ ] All three perspectives represented
- [ ] TASM scores recorded
- [ ] Observations documented

### 4. PRD & Backlog Updates
- [ ] Analytics Hub PRD updated (stage: in-progress → delivered)
- [ ] PBIs updated (ANA-010 through ANA-014)
- [ ] Event model current

### 5. Documentation
- [ ] Cycle plan updated with actual values
- [ ] Success metrics verified
- [ ] Component docs updated for new components

### 6. Cycle Plan Completion
- [ ] Frontmatter updated (stage, date_completed, actual values)
- [ ] Deviations documented

### 7. Cycle Retrospective
- [ ] "What Went Well" section completed
- [ ] "Deviations from Plan" section completed
- [ ] "Learnings" section completed

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

## Related
- PRD: [[Analytics Hub PRD]]
- Prior Cycle: [[Cycle 27 - Analytics Sprint]]
- Review: [[Three Amigos Review 2026-02-23 Analytics Sprint]]
- PBIs: [[PBI-ANA-010 Analytics Hub Shell]], [[PBI-ANA-011 Dashboard Domain]], [[PBI-ANA-012 Dashboard Tile Grid UI]], [[PBI-ANA-013 Base File Analytics Source]], [[PBI-ANA-014 Analytics Integration and Polish]]
- Inbox: [[When opening a CSV with Flowti, I want to be able to make an easy dashboard]]
