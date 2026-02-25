---
type: DevelopmentCycle
feature: "[[Analytics Hub PRD]]"
stage: ready
cycle: 42
date_planned: 2026-02-25
pbis:
  - "[[PBI-ANA-100 Cross-Tab Navigation]]"
  - "[[PBI-ANA-101 Measurement Creation from Query]]"
  - "[[PBI-ANA-102 Broken Reference Error States]]"
  - "[[PBI-ANA-103 Master List Sort Options]]"
  - "[[PBI-ANA-104 Tile Settings UX]]"
  - "[[PBI-ANA-105 Query-Measurement Cross-References]]"
  - "[[PBI-ANA-106 Button and Style Consistency]]"
bugs: []
bugs_fixed_precycle: []
tech_debt: []
estimated_increments: 7
estimated_tests: 30
pre_cycle_tests: 4847
pre_cycle_suites: 199
---

# Cycle 42 — Analytics Hub UX Coherence

## Cycle Overview

**User Story:**

> As a data analyst who has built queries, measurements, and dashboards, I want a coherent experience that guides me between these concepts — creating measurements from query results, seeing where measurements are used, getting clear errors when references break, and sorting my growing lists — so that the Analytics Hub feels like an integrated tool rather than three disconnected tabs.

**User Pains:**

- **No "Create Measurement" from query** — after running a query and seeing useful results, the user must switch to the Measurements tab and manually re-select the query. There's no shortcut to create a measurement directly from query results
- **Broken references are silent** — when a query is deleted but a measurement still references it (shouldn't happen with cascade delete, but can happen via data corruption), the tile shows generic "Query not found" with no context about what went wrong
- **Flat, unsorted lists** — dashboards, measurements, and queries all sort favorites-first with no user control; as lists grow beyond 10 items, finding specific entries requires scrolling
- **No "used by" cross-references** — a query detail doesn't show which measurements or dashboards use it; a measurement detail doesn't show which dashboard tiles display it
- **Inconsistent button styles** — tile settings use inline-styled div toggles, measurement type selectors use custom divs, format selectors use yet another pattern; no unified interactive element style
- **Settings panel hard to find** — tile settings is a toggle panel that requires scrolling to discover; no visual indicator that settings are available

**Business Trigger:** Cycles 40–41 completed the measurement layer and hardened data integrity. The hub now has all core features (queries, dashboards, measurements, charts, filters, presets, aliases). The bottleneck is no longer missing features — it's friction between features. Users build queries but don't discover measurements. They create measurements but can't find which dashboards use them. The "next mile" is making the three tabs feel like one integrated experience.

---

## Situation Assessment

### Pre-Cycle State (post-Cycle 41)

**Plugin health:**
- 4,847 tests passing, 199 test suites
- Build status: green (`npm test` clean)
- PRD: v14, 94 FRs
- No blocking bugs, no open action items from Cycle 41

**Analytics domain status:**
- Domain: ~4,800 LOC (AnalyticsService 619, AnalyticsEngine 853, measurementHandlers 114, dashboardHandlers ~400, expressionFunctions ~125, types ~480)
- UI: ~7,800 LOC (AnalyticsHubView 308, QueriesTab 820, DashboardsTab ~480, MeasurementsTab 606, DashboardTileRenderer ~566, AnalyticsDashboardPage ~400, DashboardFilterBar ~170, QueryBuilderPanel ~490, AddTileDialog ~300, TileSettingsPanel ~150)
- Tests: ~600 analytics-specific
- Events: 21 + 9 measurement events = 30

**UX audit findings:**
1. No cross-tab navigation shortcuts (Create Measurement from Query, View Dashboard from Measurement)
2. DashboardsTab and MeasurementsTab have no sort selectors (hardcoded favorites-first)
3. Tile error states are minimal — "Query not found" with no context or recovery action
4. Button styles vary across 4+ patterns (ft-nav-link, mod-cta, inline div, custom toggle)
5. No "used by" cross-references between entities
6. Tile settings panel requires toggle + scroll — no visual indicator on the tile itself

---

## Backlog Refinement

| Source | Item | Decision | Rationale |
|--------|------|----------|-----------|
| User pain | Create Measurement from query | **IN SCOPE** (Inc 2) | Closes the query→measurement loop |
| User pain | Broken reference error states | **IN SCOPE** (Inc 3) | Silent failures erode trust |
| User pain | Master list sort options | **IN SCOPE** (Inc 4) | Growing lists need organization |
| User pain | Tile settings positioning | **IN SCOPE** (Inc 5) | Discoverability improvement |
| User pain | Cross-references | **IN SCOPE** (Inc 6) | Coherent flow between entities |
| User pain | Button consistency | **IN SCOPE** (Inc 7) | Visual polish |
| UX audit | Cross-tab navigation | **IN SCOPE** (Inc 1) | Foundation for all cross-links |
| UX audit | Keyboard shortcuts (Alt+1/2/3) | **Deferred** | Tab bar already clickable; low ROI |
| UX audit | Filter row-count preview | **Deferred** | Requires pre-execution scan; performance concern |
| UX audit | Drag-drop tile reorder | **Deferred** | Obsidian DOM model makes this fragile |
| C41 AI-1 | extractScalarFunction registry | **Deferred** | Works fine; no new functions planned |

---

## Cycle Goals

1. **Cross-Tab Navigation** — Hub-level navigation API for switching tabs with pre-selected entities
2. **Create Measurement from Query** — "Create Measurement" button in ActionsBar after running a query
3. **Broken Reference Error States** — Visible, actionable errors on tiles and measurements with missing references
4. **Master List Sort** — Sort selectors on DashboardsTab, MeasurementsTab, and SavedQueryList
5. **Tile Settings UX** — Settings indicator on tiles + improved panel visibility
6. **Cross-References** — "Used by" sections on query and measurement detail panels
7. **Button Consistency** — Standardize toggle/selector patterns across all analytics UI

---

## Scope

### In Scope

- **AnalyticsHubView.navigateToTab(tabId, entityId?)** — programmatic tab switch with entity pre-selection
- **ActionsBar "Create Measurement"** — button after query execution with sensible defaults
- **Tile error callouts** — red callout when query/measurement reference is broken, with "Fix" action
- **Measurement orphan warning** — badge when source query is missing
- **Sort selectors** — Name / Updated / Count sort on all 3 master lists
- **Tile settings gear icon** — always visible on tile header, not just a hidden toggle
- **Query detail: "Measurements" section** — list of measurements using this query
- **Query detail: "Dashboards" section** — list of dashboards with tiles using this query
- **Measurement detail: "Used in Dashboards" section** — list of tiles using this measurement
- **Button class consolidation** — `ft-toggle-btn` class for all binary/multi-option selectors

### Out of Scope

- Keyboard shortcuts for tab switching — low ROI vs. effort
- Drag-and-drop tile reordering — Obsidian DOM constraints
- Query complexity warnings — requires performance profiling infrastructure
- Dashboard drill-down breadcrumbs — requires navigation stack (future cycle)
- Real-time tile preview during settings changes — requires live re-rendering pipeline

---

## Increments

### Inc 1: Cross-Tab Navigation API (PBI-ANA-100)

**Goal:** Add a `navigateToTab(tabId, entityId?)` method to AnalyticsHubView that switches tabs and optionally pre-selects an entity (query, dashboard, measurement). This is the foundation for all cross-links.

| File | Action | ~LOC |
|------|--------|------|
| `src/ui/AnalyticsHubView.ts` | Add `navigateToTab(tabId, entityId?)` method; emit event for tab components | +25 |
| `src/ui/analytics/types.ts` | Add `navigateToTab` to deps interfaces; add `pendingEntityId` state | +10 |
| `src/ui/analytics/DashboardsTab.ts` | Handle `pendingEntityId` → auto-select dashboard | +15 |
| `src/ui/analytics/QueriesTab.ts` | Handle `pendingEntityId` → auto-select + auto-load query | +15 |
| `src/ui/analytics/MeasurementsTab.ts` | Handle `pendingEntityId` → auto-select measurement | +15 |

**AC:**
- [ ] `navigateToTab("queries", queryId)` switches to Queries tab and selects the query
- [ ] `navigateToTab("dashboards", dashboardId)` switches to Dashboards tab and selects the dashboard
- [ ] `navigateToTab("measurements", measurementId)` switches to Measurements tab and selects the measurement
- [ ] `navigateToTab("queries")` switches to Queries tab without pre-selection
- [ ] Navigation deps passed to all tab components
- [ ] `npm test` passes

**Tests:** ~4

---

### Inc 2: Create Measurement from Query (PBI-ANA-101)

**Goal:** Add a "Create Measurement" button in ActionsBar (next to "Add to Dashboard") that appears after a query is executed. Creates a measurement with sensible defaults from the query result.

| File | Action | ~LOC |
|------|--------|------|
| `src/ui/analytics/queries/ActionsBar.ts` | "Create Measurement" button + mini-form (name, type, column) | +60 |
| `src/ui/analytics/queries/types.ts` | Add `onCreateMeasurement` callback to deps | +5 |
| `src/ui/analytics/QueriesTab.ts` | Wire callback → analyticsService.createMeasurement + navigateToTab | +20 |

**Design:**
- Button appears when: (1) query is saved AND (2) query has been executed (result available)
- Click shows inline dropdown: name input (default: first measure label), type toggle (single/series), column selector (populated from query measures)
- On create → save measurement → navigate to Measurements tab with new measurement selected
- Default type: "single" if query has exactly 1 measure, "series" if query has time bucket

**AC:**
- [ ] "Create Measurement" button visible after successful query execution
- [ ] Mini-form shows name, type, and column selector
- [ ] Created measurement has correct queryId, type, and measureColumn
- [ ] After creation, user is navigated to Measurements tab with measurement selected
- [ ] Button hidden when query is unsaved (no queryId to reference)
- [ ] `npm test` passes

**Tests:** ~4

---

### Inc 3: Broken Reference Error States (PBI-ANA-102)

**Goal:** Show visible, contextual error states when tiles or measurements reference deleted/missing entities.

| File | Action | ~LOC |
|------|--------|------|
| `src/ui/analytics/DashboardTileRenderer.ts` | Enhanced error rendering: show query name if available, "Fix" button to open tile settings | +30 |
| `src/ui/analytics/DashboardsTab.ts` | Pass query-lookup info to tile renderer for error context | +10 |
| `src/ui/analytics/AnalyticsDashboardPage.ts` | Same pattern | +10 |
| `src/ui/analytics/MeasurementsTab.ts` | Red badge on measurements whose queryId doesn't match any saved query | +20 |

**Design:**
- Tiles with missing query: show "Query '[name]' not found — it may have been deleted" with gear icon to open settings
- Tiles with missing measurement: show "Measurement '[name]' not found" with option to clear measurementId
- Measurements with missing query: show red "Missing query" badge in master list + warning in detail panel with link to delete the measurement

**AC:**
- [ ] Tile with missing queryId shows contextual error message (not just "Query not found")
- [ ] Error tile shows "Settings" button to fix the reference
- [ ] Measurement with missing query shows red badge in master list
- [ ] Measurement detail panel shows warning callout with "Delete" option
- [ ] No errors for valid references
- [ ] `npm test` passes

**Tests:** ~4

---

### Inc 4: Master List Sort Options (PBI-ANA-103)

**Goal:** Add sort selectors to all three master lists — DashboardsTab, MeasurementsTab, and SavedQueryList.

| File | Action | ~LOC |
|------|--------|------|
| `src/ui/analytics/DashboardsTab.ts` | Sort dropdown: "Name" / "Updated" / "Tiles" + favorites always first | +30 |
| `src/ui/analytics/MeasurementsTab.ts` | Sort dropdown: "Name" / "Type" / "Updated" + favorites always first | +30 |
| `src/ui/analytics/queries/SavedQueryList.ts` | Sort dropdown: "Name" / "Sources" / "Last Run" + favorites always first | +30 |

**Design:**
- Small `<select>` in master list header area (right-aligned, next to "+" button)
- Sort state persisted in component (not in domain state — resets on tab switch)
- Favorites always sort to top regardless of selected sort order
- Default sort: "Name" (alphabetical ascending)

**AC:**
- [ ] DashboardsTab: sort by Name, Updated, Tiles count
- [ ] MeasurementsTab: sort by Name, Type (single first), Updated
- [ ] SavedQueryList: sort by Name, Sources count, Last Run date
- [ ] Favorites always sort to top
- [ ] Sort selector visible in master list header
- [ ] `npm test` passes

**Tests:** ~0 (UI-only; no domain logic)

---

### Inc 5: Tile Settings UX (PBI-ANA-104)

**Goal:** Make tile settings more discoverable by adding a persistent gear icon in the tile header and making the settings panel slide in from the bottom of the tile.

| File | Action | ~LOC |
|------|--------|------|
| `src/ui/analytics/DashboardTileRenderer.ts` | Always show gear icon (not just on toggle state); settings panel animation | +25 |
| `src/ui/analytics/TileSettingsPanel.ts` | Collapsible sections: "Display", "Data", "Formatting" headers | +30 |

**Design:**
- Gear icon always visible in tile header action bar (currently it's a text button "Settings")
- When settings are open, gear icon gets accent color
- Settings panel sections: "Display" (mode, width, height, auto-height), "Data" (query, measurement, row limit, chart value column), "Formatting" (conditional rules, number format, sparkline)
- Each section has a collapsible header (consistent with QueryBuilderPanel collapsible sections)

**AC:**
- [ ] Gear icon always visible on every tile's header
- [ ] Click toggles settings panel open/closed
- [ ] Open state indicated by accent-colored icon
- [ ] Settings organized into labeled sections
- [ ] Sections are collapsible (default: all expanded)
- [ ] `npm test` passes

**Tests:** ~0 (UI-only)

---

### Inc 6: Query-Measurement Cross-References (PBI-ANA-105)

**Goal:** Show "used by" cross-references between queries, measurements, and dashboards.

| File | Action | ~LOC |
|------|--------|------|
| `src/ui/analytics/QueriesTab.ts` | "Measurements" section in query detail: list measurements using this query | +35 |
| `src/ui/analytics/QueriesTab.ts` | "Dashboards" section in query detail: list dashboards with tiles using this query | +35 |
| `src/ui/analytics/MeasurementsTab.ts` | "Used in Dashboards" section: list dashboard tiles using this measurement | +30 |

**Design:**
- Cross-reference sections render below the main detail content
- Each item is a clickable link that uses `navigateToTab()` from Inc 1
- Show count badge: "3 measurements", "2 dashboards"
- Empty state: "Not used by any measurements" (muted text)
- Compute cross-references from AnalyticsState (scan queries, measurements, dashboards in-memory)

**AC:**
- [ ] Query detail shows list of measurements using this query (clickable → Measurements tab)
- [ ] Query detail shows list of dashboards with tiles referencing this query (clickable → Dashboards tab)
- [ ] Measurement detail shows list of dashboard tiles using this measurement (clickable → Dashboards tab)
- [ ] Cross-reference counts shown as badges
- [ ] Clicking a cross-reference navigates to the correct tab + entity
- [ ] Empty states shown for unused entities
- [ ] `npm test` passes

**Tests:** ~6

---

### Inc 7: Button & Style Consistency (PBI-ANA-106)

**Goal:** Standardize interactive element styles across all analytics UI components.

| File | Action | ~LOC |
|------|--------|------|
| (Multiple analytics UI files) | Replace inline-styled toggle divs with consistent `ft-toggle-btn` class pattern | ~80 total |

**Targets:**
- TileSettingsPanel width/height toggle buttons → `ft-toggle-btn` + `is-active` class
- MeasurementsTab type selector (single/series) → same pattern
- MeasurementsTab format style selector (plain/currency/percent) → same pattern
- AddTileDialog tab buttons (query/measurement) → same pattern
- DashboardFilterBar preset dropdown → consistent with other dropdowns

**Pattern:**
```css
.ft-toggle-btn {
  padding: 2px 8px;
  border: 1px solid var(--background-modifier-border);
  border-radius: 4px;
  background: var(--background-primary);
  cursor: pointer;
  font-size: var(--font-ui-smaller);
}
.ft-toggle-btn.is-active {
  background: var(--interactive-accent);
  color: var(--text-on-accent);
  border-color: var(--interactive-accent);
}
```

**AC:**
- [ ] All toggle/selector buttons use `ft-toggle-btn` pattern
- [ ] Active state indicated by `is-active` class (accent background)
- [ ] Consistent padding, border, and border-radius across all toggles
- [ ] No inline CSS for toggle button styling
- [ ] `npm test` passes

**Tests:** ~0 (CSS-only changes)

---

## Dependency Graph

```
PBI-ANA-100 (Cross-Tab Nav) ─┬─> PBI-ANA-101 (Create Measurement)
                               ├─> PBI-ANA-105 (Cross-References)
                               └─> PBI-ANA-102 (Error States, partial)

PBI-ANA-103 (Sort Options) ── independent
PBI-ANA-104 (Tile Settings) ── independent
PBI-ANA-106 (Button Consistency) ── independent
```

**Execution order:** Inc 1 → Inc 2 → Inc 3 → Inc 4 → Inc 5 → Inc 6 → Inc 7

Inc 3, 4, 5, 7 are independent and can parallelize with Inc 2 or 6 if needed.

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| navigateToTab timing | Medium | Use `pendingEntityId` state + `requestAnimationFrame` to ensure tab renders before selection |
| Cross-reference scan performance | Low | In-memory scan of AnalyticsState arrays — typically < 100 items each |
| Button style changes break existing layouts | Medium | Use new class only on changed elements; don't modify existing `.ft-nav-link` or `.mod-cta` patterns |
| Sort state lost on tab switch | Low | Acceptable — sort is a view preference, not persisted data; consistent with QueriesTab scroll reset |
| "Create Measurement" button adds clutter to ActionsBar | Low | Only visible after successful execution + saved query; same conditional pattern as "Add to Dashboard" |

---

## Success Metrics

| Metric | Target |
|--------|--------|
| New tests | ~18 |
| Post-cycle total tests | ~4,865 |
| Post-cycle suites | ~200 |
| Cross-tab navigation paths | 6+ (Q→M, Q→D, M→D, D→Q, tile→Q, error→settings) |
| Sort options | 3 lists × 3 options each |
| Broken reference error coverage | Tiles + Measurements |
| Button style patterns | 1 unified pattern (`ft-toggle-btn`) |

---

## Deferred Items

| Item | Rationale | Target |
|------|-----------|--------|
| Keyboard shortcuts (Alt+1/2/3) | Tab bar is clickable; low ROI | Future |
| Filter row-count preview | Requires pre-execution scan; performance concern | Future |
| Drag-drop tile reorder | Obsidian DOM model makes this fragile | Future |
| Dashboard drill-down breadcrumbs | Requires navigation stack architecture | Future |
| Query complexity warnings | Requires performance profiling infrastructure | Future |
| Real-time tile preview | Requires live re-rendering pipeline | Future |
| extractScalarFunction registry | Works fine with regex; no new functions planned | Future |
| Weighted average for single-type measurements | Standard BI tools use same approach | Future |

---

## Definition of Ready (Pre-Cycle)

- [x] Cycle 41 delivered — all tests green, cascade delete working, expressions expanded
- [x] UX audit completed — 10 areas analyzed, 7 priority items identified
- [x] No blocking bugs or data integrity issues
- [x] navigateToTab pattern validated (QueriesTab already has `lastLoadedQueryId` + `pendingExecute` precedent)
- [x] Cross-reference data available in AnalyticsState (queries, measurements, dashboards all in-memory)
- [x] `ft-toggle-btn` pattern compatible with existing Obsidian CSS variables

## Definition of Done

### 1. All Increments Completed
- [ ] 7 increments delivered, no partial state

### 2. Quality Gates
- [ ] `npm test` passes — all tests green
- [ ] `npm run check` passes — no lint or type errors
- [ ] All new tests exercise the features they validate

### 3. Architecture
- [ ] `navigateToTab()` API on AnalyticsHubView — reusable for future cross-links
- [ ] Cross-reference scan is pure function (testable, no side effects)
- [ ] `ft-toggle-btn` CSS class consolidates toggle patterns
- [ ] No new domain events needed (UI-only navigation)

### 4. User Experience
- [ ] Users can create a measurement directly from query results (1 click + form)
- [ ] Broken references show clear error messages with recovery actions
- [ ] Master lists can be sorted by multiple criteria
- [ ] Tile settings are always discoverable (persistent gear icon)
- [ ] Cross-references show how entities relate (query → measurements → dashboards)
- [ ] Toggle/selector buttons look consistent across all analytics pages
