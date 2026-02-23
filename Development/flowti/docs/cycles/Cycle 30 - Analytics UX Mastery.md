---
type: DevelopmentCycle
feature: "[[Analytics Hub PRD]]"
stage: ready
cycle: 30
date_planned: 2026-02-23
pbis:
  - "[[PBI-ANA-020 Query Power Features]]"
  - "[[PBI-ANA-021 Source Preview and Query Usability]]"
  - "[[PBI-ANA-022 Enhanced Stat-Card and Tile Management]]"
  - "[[PBI-ANA-023 Dashboard Actions and Hub Polish]]"
  - "[[PBI-ANA-024 Analytics UX Flow Test]]"
bugs: []
bugs_fixed_precycle: []
tech_debt: []
estimated_increments: 5
estimated_tests: 60
pre_cycle_tests: 4358
pre_cycle_suites: 179
---

# Cycle 30: Analytics Hub — UX Mastery

## Cycle Overview

**User Story:**

> As a Supplier Manager who has built dashboards with saved queries, I want to filter results (e.g. "show only Electronics"), sort by any column, preview source columns before building a query, rename and clone queries, reorder tiles, and see all dimension groups as stat cards — so that I can work confidently and efficiently without leaving the Analytics Hub.

**User Pains:**
- Cannot filter results — every query returns all rows; manager must scroll to find a single category
- No sort or row limit — large result sets are overwhelming; "top 10 suppliers" requires mental scanning
- Source selection is blind — user picks a CSV with no idea what columns it contains
- Queries named by timestamp ("Query 2026-02-23 22:52") — useless for identification after 5+ queries
- Stat-card tiles show only the first row — monthly stat dashboard is useless (shows only January)
- Cannot reorder, rename, or toggle tile display mode after creation — locked layout
- Dashboard name and description unchangeable after creation
- No "Refresh All" button — must click refresh on each tile individually
- No top bar shortcuts for common actions (new query, new dashboard)

**User Needs:**
- WHERE clause for filtering rows by dimension values
- ORDER BY + LIMIT for sorted, bounded results
- Source preview showing columns, types, row count, and sample data
- Query rename and duplicate for iterative analysis
- Multi-row stat-card display grouped by dimension
- Tile reorder/rename/display-mode-toggle for dashboard tuning
- Dashboard rename + description editing
- One-click "Refresh All" for dashboard-wide data refresh
- Top bar quick actions (New Query, New Dashboard)
- Export dashboard summary as markdown for sharing

**Business Trigger:** Cycles 28–29 built the analytics engine room and cockpit. Cycle 30 makes the cockpit comfortable for daily power use. The Supplier Manager can now configure dashboards once and maintain them with minimal friction.

---

## Situation Assessment

### Pre-Cycle State (post-Cycle 29)

**Plugin health:**
- 4,358 tests passing, 179 test suites
- Build status: green (`npm test` + `npm run check` clean)
- Cycles 28–29 completed — Analytics Hub v1 + v2 delivered
- No pre-cycle bug fixes needed

**Analytics domain status:**
- Domain: ~1,524 LOC (AnalyticsEngine 331, AnalyticsService 482, BaseAnalyticsAdapter 89, types 270, localeUtils 136, dateUtils 98, events 118)
- UI: ~2,203 LOC (AnalyticsHubView 270, QueriesTab 890, DashboardsTab 339, AnalyticsDashboardPage 234, DashboardTileRenderer 161, TileResultCache 59, AddTileDialog 110, DashboardNameModal 73, types 67)
- Tests: ~383 analytics-specific across 8 files
- Events: 16 (query lifecycle + dashboard CRUD + favorites + loaded)
- Personas: 1 (Supplier Manager)

**Key UX gaps:**
- No filtering, sorting, or row limiting in query engine or UI
- Source selection is blind (no column preview)
- Queries auto-named by timestamp with no rename
- Stat-card truncated to first row
- Tiles immutable after creation (no reorder, rename, mode toggle)
- Dashboard metadata immutable after creation
- No bulk refresh or export

---

## Cycle Goals

1. **Query Power** — Filters (WHERE), sort (ORDER BY), and row limit (LIMIT) in engine and UI
2. **Source Intelligence** — Column preview with types and sample data on source selection
3. **Query Usability** — Rename, duplicate, collapsible builder sections
4. **Dashboard Mastery** — Multi-row stat cards, tile reorder/rename/mode-toggle, dashboard edit
5. **Hub Polish** — Refresh All, top bar shortcuts, markdown export, comprehensive flow test

---

## Scope

### In Scope
- `FilterSpec` type: column, operator, value (=, !=, >, <, >=, <=, contains, startsWith)
- `SortSpec` type: column, direction (asc/desc)
- AnalyticsEngine pipeline: filter stage (after joins, before grouping), sort + limit (after aggregation)
- SavedAnalyticsQuery persistence: add filters, sort, limit fields
- Source preview panel: columns, inferred types, row count, first 5 sample rows
- Query rename (`renameQuery(id, name)`) and duplicate (`duplicateQuery(id)`)
- Collapsible sections in query builder (Sources, Columns, Joins, Dimensions, Measures, Time Bucket, Filters, Sort)
- Multi-row stat-card display: all dimension groups rendered as cards
- Tile reorder (move up/down), title edit (inline), display mode toggle (table ↔ stat-card)
- Dashboard rename and description editing (inline in detail header)
- "Refresh All" button: clears TileResultCache and re-renders
- Top bar actions: "New Query", "New Dashboard" shortcut buttons
- Export dashboard summary as markdown (copy to clipboard)
- 3 new events: `analytics.query.renamed`, `analytics.query.duplicated`, `analytics.dashboard.tile.reordered`
- Flow 30 integration test

### Out of Scope
- Charts or visualizations (bar, line, pie) — tables + stat cards + filters sufficient
- Dashboard auto-refresh / polling — manual Refresh All covers the need
- Drag-and-drop tile reordering — move up/down is simpler and sufficient
- Calculated columns / derived measures — not needed for current use cases
- Cross-dashboard drill-down — parametrized navigation is a later feature
- Dashboard sharing beyond clipboard markdown export

---

## Increments

### Inc 1: Query Power Features — Filters, Sort, Limit

**Goal:** Add WHERE filtering, ORDER BY sorting, and LIMIT to the analytics engine and query builder UI.

**Design:**
- Add `FilterSpec`, `FilterOperator`, `SortSpec` types
- Extend `AnalyticsQuery` and `SavedAnalyticsQuery` with `filters?`, `sort?`, `limit?`
- Engine pipeline: filter rows after joins (before grouping), sort result rows after aggregation, limit output
- QueriesTab: new Filters section (add/remove filter rows: column + operator + value), Sort dropdown (column + direction), Limit number input
- Save/load preserves filters, sort, limit

| File | Action | ~LOC |
|------|--------|------|
| `src/domain/analytics/types.ts` | Add FilterSpec, FilterOperator, SortSpec; extend AnalyticsQuery + SavedAnalyticsQuery | +30 |
| `src/domain/analytics/AnalyticsEngine.ts` | Add applyFilters(), applySort(), applyLimit() pipeline stages | +80 |
| `src/ui/analytics/QueriesTab.ts` | Filters section, sort/limit UI, save/load integration | +120 |

**AC:**
- [ ] Filters section in query builder: add/remove filter rows (column, operator, value)
- [ ] At least 8 operators: =, !=, >, <, >=, <=, contains, startsWith
- [ ] Sort dropdown: select column + direction (asc/desc)
- [ ] Limit input: optional max row count
- [ ] Engine applies filters before grouping
- [ ] Engine sorts result rows after aggregation
- [ ] Engine limits output row count
- [ ] Saved queries persist filters, sort, limit
- [ ] `npm test` passes

---

### Inc 2: Source Preview + Query Usability

**Goal:** Source preview panel with columns/types/sample data; query rename and duplicate; collapsible builder sections.

**Design:**
- When a source is loaded in QueriesTab, show a preview panel: columns (with inferred types), row count, first 5 sample rows as mini table
- `renameQuery(id, newName)` service method + event
- `duplicateQuery(id)` service method + event (deep-copies query with new ID + " (copy)" name)
- QueriesTab: collapsible sections via toggle arrows on section headers (collapsed by default except active)
- 2 new events registered in catalog

| File | Action | ~LOC |
|------|--------|------|
| `src/ui/analytics/SourcePreviewPanel.ts` | **New** — column preview table + sample rows | +80 |
| `src/domain/analytics/AnalyticsService.ts` | Add renameQuery(), duplicateQuery() | +40 |
| `src/domain/analytics/events.ts` | Add 2 events (renamed, duplicated) | +15 |
| `src/infrastructure/events/catalog.ts` | Register 2 events | +5 |
| `src/ui/analytics/QueriesTab.ts` | Source preview integration, rename/duplicate actions, collapsible sections | +80 |

**AC:**
- [ ] Loaded source shows column names, inferred types, row count, and first 5 sample rows
- [ ] "Rename" action prompts for new name and persists it
- [ ] "Clone" action creates duplicate query with " (copy)" suffix
- [ ] Both actions emit events
- [ ] Query builder sections are collapsible (click header to toggle)
- [ ] `npm test` passes

---

### Inc 3: Enhanced Stat-Card + Tile Management

**Goal:** Multi-row stat-card display and dashboard tile management (reorder, rename, display mode toggle).

**Design:**
- DashboardTileRenderer stat-card mode: render ALL result rows as dimension-grouped stat cards (not just first row). Each row becomes a card group with dimension label + value cards.
- Tile reordering: move-up / move-down buttons in tile header; `reorderTile(dashboardId, tileId, direction)` service method
- Tile title editing: editable title text in tile header (contenteditable or inline input)
- Tile display mode toggle: button in tile header toggles table ↔ stat-card via `updateTile()`
- 1 new event: `analytics.dashboard.tile.reordered`

| File | Action | ~LOC |
|------|--------|------|
| `src/ui/analytics/DashboardTileRenderer.ts` | Multi-row stat-card, title edit, mode toggle, reorder buttons | +80 |
| `src/domain/analytics/AnalyticsService.ts` | Add reorderTile() method | +25 |
| `src/domain/analytics/events.ts` | Add tile.reordered event | +5 |
| `src/infrastructure/events/catalog.ts` | Register 1 event | +2 |
| `src/ui/analytics/DashboardsTab.ts` | Wire reorder/rename/toggle callbacks in TileRenderContext | +30 |

**AC:**
- [ ] Stat-card tiles show all result rows as grouped cards (dimension label + numeric values)
- [ ] Each tile has move-up / move-down buttons for reordering
- [ ] Tile title is editable inline (persisted on blur/enter)
- [ ] Display mode toggle button switches table ↔ stat-card
- [ ] Reorder persists tile positions in dashboard
- [ ] `npm test` passes

---

### Inc 4: Dashboard Actions + Hub Polish

**Goal:** Dashboard rename/description editing, Refresh All, top bar shortcuts, markdown export.

**Design:**
- Dashboard detail header: editable name (inline input), description text area below
- DashboardsTab: "Refresh All" button clears TileResultCache + schedules render
- AnalyticsHubView top bar: "New Query" and "New Dashboard" shortcut buttons (navigates to tab + triggers create)
- "Export Summary" action: generates markdown with dashboard name, tile names + query names, copies to clipboard
- Subscribe to tile.reordered event for re-render

| File | Action | ~LOC |
|------|--------|------|
| `src/ui/analytics/DashboardsTab.ts` | Dashboard rename/description edit, Refresh All button, export markdown | +80 |
| `src/ui/AnalyticsHubView.ts` | Top bar actions (New Query, New Dashboard), tile.reordered subscription | +30 |

**AC:**
- [ ] Dashboard name is editable inline in detail header (persisted on blur/enter)
- [ ] Dashboard description is editable below the title
- [ ] "Refresh All" button clears all tile caches and re-renders
- [ ] Top bar has "New Query" and "New Dashboard" shortcut buttons
- [ ] "Export Summary" copies markdown summary to clipboard
- [ ] `npm test` passes

---

### Inc 5: Flow Test + Integration

**Goal:** End-to-end flow test and final polish.

**Design:**
- Flow 30 test covering:
  - Query with filters (add filter, verify filtered results)
  - Query sort + limit (verify ordering and row count)
  - Source preview (verify column listing)
  - Query rename + duplicate (verify name change and clone)
  - Tile reorder (verify position change)
  - Multi-row stat-card verification
  - Dashboard rename and Refresh All
  - New event emission (renamed, duplicated, tile.reordered)
- Edge case polish: empty filter values, sort on non-numeric column, limit=0, duplicate of duplicate

| File | Action | ~LOC |
|------|--------|------|
| `tests/flows/30-AnalyticsUXMastery.test.ts` | **New** — flow integration test | +120 |

**AC:**
- [ ] Flow 30 test passes (~15 tests)
- [ ] All new event subscriptions complete (no orphan state)
- [ ] Edge cases handled gracefully
- [ ] `npm test` passes

---

## Dependency Graph

```
Inc 1 (filters + sort + limit)
  ├── Inc 2 (source preview + query usability)
  │     └── Inc 3 (stat-card + tile management)
  ├── Inc 4 (dashboard actions + hub polish)
  └── Inc 5 (flow test — needs all above)
```

**Execution order:** Inc 1 → Inc 2 → Inc 3 → Inc 4 → Inc 5

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Filter logic complexity with mixed types | Medium | Operators type-aware: string comparisons for string columns, numeric for number columns |
| Engine performance with filters on large CSVs | Low | Filter applied before grouping (reduces work); no streaming needed for typical vault CSVs |
| QueriesTab LOC growth (890 → ~1,090) | Medium | Collapsible sections reduce visual complexity; extraction to sub-components if LOC >1,200 |
| Stat-card multi-row layout with many groups | Low | Cap at 20 groups with "and N more..." overflow message |
| Inline editing contenteditable browser compat | Low | Use `<input>` element for title editing; cross-browser safe |
| Tile reorder conflicts with grid layout | Low | Reorder changes `tiles[]` array order (CSS Grid follows array order) |

---

## Success Metrics

| Metric | Target |
|--------|--------|
| New tests | ~60 |
| Post-cycle total tests | ~4,418 |
| New source LOC | ~600 |
| New/modified UI components | 1 new (SourcePreviewPanel), 5 modified |
| Analytics events | 16 → 19 |
| Filter operators | 8 |
| Engine pipeline stages | 5 → 8 (+ filter, sort, limit) |
| Query builder sections | 7 → 9 (+ Filters, Sort & Limit) |

---

## Deferred Items

| Item | Rationale | Target |
|------|-----------|--------|
| Charts / visualizations | Tables + enhanced stat cards + filters cover analysis needs | Future |
| Dashboard auto-refresh | Manual Refresh All covers the workflow | Future |
| Drag-and-drop tile reordering | Move up/down buttons sufficient; DnD complex in Obsidian | Future |
| Calculated columns | Filter + sort addresses immediate data exploration needs | Future |
| Cross-dashboard drill-down | Parametrized navigation is architecturally separate | Future |
| Dashboard sharing (beyond clipboard) | Clipboard markdown export covers immediate sharing | Future |
| Query builder sub-component extraction | Monitor QueriesTab LOC; extract if >1,200 | TD candidate |

---

## Definition of Done (Cycle)

### 1. All Increments Completed
- [ ] Each increment satisfies its own acceptance criteria
- [ ] No increment left in partial state
- [ ] Deferred items documented with rationale

### 2. Build & Test Quality
- [ ] `npm test` passes — all tests green
- [ ] `npm run check` passes (tsc + eslint clean)
- [ ] No test regressions on existing 4,358 tests
- [ ] Flow 30 integration test passes

### 3. Three Amigos Review
- [ ] Cycle-level review conducted
- [ ] All three perspectives represented
- [ ] TASM scores recorded

### 4. PRD & Backlog Updates
- [ ] Analytics Hub PRD updated to v4 with v3 FRs
- [ ] PBIs created and tracked (ANA-020 through ANA-024)
- [ ] Event model current (19 events in catalog)

### 5. Cycle Plan Completion
- [ ] Frontmatter updated (stage, date_completed, actual values)
- [ ] Deviations documented

### 6. Cycle Retrospective
- [ ] "What Went Well" completed
- [ ] "Deviations from Plan" completed
- [ ] "Learnings" completed

---

## Verification

1. `npm test` — all tests pass after each increment
2. Manual: Build a query with filters → verify filtered results
3. Manual: Sort results + limit → verify ordering and row cap
4. Manual: Select a source → verify column preview with types
5. Manual: Rename a query → verify new name persists
6. Manual: Clone a query → verify duplicate appears
7. Manual: Stat-card tile shows all dimension groups
8. Manual: Reorder tiles, edit title, toggle display mode → verify persistence
9. Manual: Rename dashboard, edit description → verify persistence
10. Manual: "Refresh All" updates all tiles
11. Manual: "Export Summary" copies markdown to clipboard
12. Flow 30 integration test covers the full power-user workflow
