---
type: DevelopmentCycle
feature: "[[Analytics Hub PRD]]"
stage: ready
cycle: 29
date_planned: 2026-02-23
pbis:
  - "[[PBI-ANA-015 Favorite Types Foundation]]"
  - "[[PBI-ANA-016 Dashboard First Overview]]"
  - "[[PBI-ANA-017 Favorites UI]]"
  - "[[PBI-ANA-018 Dashboard UX Polish]]"
  - "[[PBI-ANA-019 Supplier Manager Flow Test]]"
bugs: []
bugs_fixed_precycle: []
tech_debt: []
estimated_increments: 5
estimated_tests: 60
pre_cycle_tests: 4338
pre_cycle_suites: 178
---

# Cycle 29: Analytics Hub — Supplier Manager Experience

## Cycle Overview

**User Story:**

> As a Supplier Manager receiving daily CSV reports (item master, supplier master, sales facts), I want to open the Analytics Hub and immediately see my key metrics (Sales per Item per Supplier by Month, costs, profit) so that I can confirm everything is in order without navigating through multiple tabs or understanding the underlying query system.

**User Pains:**
- Hub opens to a bare stats page (2 numbers) — useless for daily work
- Reaching a dashboard requires: open hub → click Dashboards tab → select dashboard → wait for tiles to load (4+ clicks)
- Dashboards auto-named "Dashboard 1" — no naming prompt, no way to identify them quickly
- No concept of favorites — all queries and dashboards equally weighted in lists
- No way to refresh a single tile without switching away and back
- The Supplier Manager is not a persona yet — no documented JTBDs or pain points

**User Needs:**
- Hub overview page shows default dashboard tiles directly — zero navigation to see numbers
- Favorite dashboards and queries float to the top of lists and appear on overview
- Default dashboard designation — "this is the one I open every day"
- Named dashboards from creation (prompt on create, not auto-name)
- Per-tile refresh button for stale data
- A documented persona driving ongoing Analytics Hub refinement

**Business Trigger:** Cycle 28 built the analytics engine room. Cycle 29 makes the cockpit usable. The Supplier Manager represents a class of non-technical users who need vault-powered insights without understanding the plumbing.

---

## Situation Assessment

### Pre-Cycle State (post-Cycle 28)

**Plugin health:**
- 4,338 tests passing, 178 test suites
- Build status: green (`npm test` + `npm run check` clean)
- Cycle 28 completed — Analytics Hub delivered (shell, dashboards, .base sources, integration)
- No pre-cycle bug fixes needed

**Analytics domain status:**
- Domain: ~1,380 LOC (AnalyticsEngine 331, AnalyticsService 418, BaseAnalyticsAdapter 120, types 264, localeUtils 136, dateUtils 98, events 96)
- UI: ~2,120 LOC (AnalyticsHubView 246, QueriesTab ~870, DashboardsTab 295, DashboardTileRenderer 141, AddTileDialog 110, AnalyticsDashboardPage 65, AnalyticsResultsPanel 166, types 66)
- Tests: ~230 across flow + unit
- Events: 13 (loaded, 5 query, 7 dashboard/tile)

**Key UX gap:** Opening the hub shows `[Saved Queries: N] [Dashboards: N]` and two buttons. The Supplier Manager must navigate Dashboards tab → pick dashboard → wait for async tile loads. This is 4-7 clicks to see metrics.

**Observations from Cycle 28 review:**
- L-33: Test count estimates need grounding — use conservative estimates this cycle
- AnalyticsDashboardPage at 65 LOC is a placeholder that needs substantial rewrite
- DashboardsTab `tileResults` cache is an inline pattern suitable for extraction

---

## Cycle Goals

1. **Supplier Manager Persona** — Documented persona with JTBDs, pain points, and success criteria
2. **Favorites Foundation** — `isFavorite` flag on Dashboard and SavedAnalyticsQuery, service CRUD, events
3. **Dashboard-First Overview** — AnalyticsDashboardPage rewritten to render default dashboard tiles directly
4. **Favorites UI** — Star icons in master lists, favorites section on overview, sort favorites first
5. **Dashboard UX Polish** — Per-tile refresh, dashboard name prompt on create, default badge

---

## Scope

### In Scope
- New Supplier Manager persona document (following existing pattern)
- `isFavorite?: boolean` on `Dashboard` and `SavedAnalyticsQuery` types
- `defaultDashboardId?: string | null` on `AnalyticsState`
- `toggleFavorite()`, `setDefaultDashboard()` service methods + events
- AnalyticsDashboardPage rewritten: renders default dashboard tile grid on overview
- TileResultCache extracted from DashboardsTab for reuse by overview page
- Star toggle icons in dashboard and query master lists
- Per-tile refresh button (re-executes single query, clears that tile's cache entry)
- Dashboard name prompt modal on creation (replaces auto-naming)
- Flow test covering the Supplier Manager daily workflow

### Out of Scope
- Charts or visualizations (tables and stat cards only)
- Dashboard auto-refresh / polling
- Drag-and-drop tile reordering
- Dashboard templates or sharing
- Per-tile resize (uniform grid in v1)
- Multiple default dashboards (one global default)

---

## Increments

### Inc 1: Supplier Manager Persona + Favorite Types Foundation

**Goal:** Document the Supplier Manager persona and add `isFavorite` + `defaultDashboardId` to the type system and service.

**Design:**
- Create persona doc following Delivery Manager pattern (Identity, Core Goals, JTBDs, Pain Points, Domain Interaction Map)
- Add `isFavorite?: boolean` to `Dashboard` and `SavedAnalyticsQuery` interfaces
- Add `defaultDashboardId?: string | null` to `AnalyticsState`
- Add `toggleQueryFavorite(id)`, `toggleDashboardFavorite(id)`, `setDefaultDashboard(id | null)`, `getDefaultDashboard()` to AnalyticsService
- Add 3 new events: `analytics.query.favorited`, `analytics.dashboard.favorited`, `analytics.dashboard.defaultChanged`
- Register events in catalog

| File | Action | ~LOC |
|------|--------|------|
| `docs/personas/Supplier Manager.md` | **New** — persona document | +120 |
| `src/domain/analytics/types.ts` | Add `isFavorite?` to Dashboard + Query, `defaultDashboardId?` to State | +5 |
| `src/domain/analytics/events.ts` | Add 3 favorite/default events | +20 |
| `src/domain/analytics/AnalyticsService.ts` | 4 new methods (toggle favorites, set/get default) | +50 |
| `src/infrastructure/events/catalog.ts` | Register 3 new events | +5 |

**AC:**
- [ ] Supplier Manager persona doc exists with standard sections
- [ ] `isFavorite` field exists on Dashboard and SavedAnalyticsQuery types
- [ ] `defaultDashboardId` field exists on AnalyticsState
- [ ] Toggle favorite + set default CRUD works with persistence
- [ ] 3 new events emit correctly and appear in Event Catalog
- [ ] `npm test` passes

---

### Inc 2: Dashboard-First Overview Page

**Goal:** Rewrite AnalyticsDashboardPage to render the default dashboard's tiles directly on the hub overview.

**Design:**
- Extract `TileResultCache` from DashboardsTab into `src/ui/analytics/TileResultCache.ts` — pure class with `tryRun(queryId, runner, onDone)`, `get(queryId)`, `clear()`, `clearOne(queryId)`
- Rewrite AnalyticsDashboardPage (~180 LOC):
  - If `defaultDashboardId` is set and dashboard exists → render tile grid (reusing DashboardTileRenderer + TileResultCache)
  - If no default → show current stats + "Set a default dashboard" prompt pointing to Dashboards tab
  - Include a "Favorites" quick-nav section showing favorited queries and dashboards as clickable cards
- DashboardsTab updated to use extracted TileResultCache (replace inline Map)
- Wire AnalyticsDashboardPage to receive scheduleRender for async tile loading

| File | Action | ~LOC |
|------|--------|------|
| `src/ui/analytics/TileResultCache.ts` | **New** — extracted async cache | +45 |
| `src/ui/analytics/AnalyticsDashboardPage.ts` | Rewrite: default dashboard tiles + favorites | +180 (was 65) |
| `src/ui/analytics/DashboardsTab.ts` | Use TileResultCache, remove inline Map | ~0 net (refactor) |
| `src/ui/AnalyticsHubView.ts` | Pass TileResultCache to dashboard page, clear on changes | +15 |

**AC:**
- [ ] Hub overview renders default dashboard tiles directly (zero-click to metrics)
- [ ] Fallback: shows stats + "Set a default dashboard" when no default set
- [ ] Favorites section shows favorited items as clickable cards
- [ ] DashboardsTab continues to work with extracted TileResultCache
- [ ] Async tile loading works on overview page (loading → results)
- [ ] `npm test` passes

---

### Inc 3: Favorites UI + Star Icons

**Goal:** Add star toggle icons to master lists and sort favorites first.

**Design:**
- DashboardsTab master list: add star icon per row, toggle on click, favorites sorted first
- QueriesTab master list: add star icon per saved query row, toggle on click, favorites sorted first
- Star icon: filled `star` for favorite, muted `star` for non-favorite (visual weight difference)
- Update AnalyticsHubView event subscriptions for favorite events → scheduleRender

| File | Action | ~LOC |
|------|--------|------|
| `src/ui/analytics/DashboardsTab.ts` | Star icon in row, sort favorites first | +40 |
| `src/ui/analytics/QueriesTab.ts` | Star icon in saved query list, sort favorites first | +40 |
| `src/ui/AnalyticsHubView.ts` | Subscribe to favorite events → refreshData + scheduleRender | +15 |

**AC:**
- [ ] Star icon visible on each dashboard row in master list
- [ ] Star icon visible on each saved query row in master list
- [ ] Clicking star toggles favorite state (persisted)
- [ ] Favorited items sort to top of their respective lists
- [ ] Hub re-renders when favorites change
- [ ] `npm test` passes

---

### Inc 4: Dashboard UX Polish — Refresh, Naming, Default Badge

**Goal:** Per-tile refresh, dashboard name prompt on creation, default dashboard designation in UI.

**Design:**
- DashboardTileRenderer: add refresh icon button in tile header, `onRefresh?: (tileId: string) => void` in TileRenderContext
- DashboardsTab: `onRefresh` clears single tile from TileResultCache, re-triggers render
- Dashboard creation: replace auto-naming (`"Dashboard N"`) with `DashboardNameModal` (Obsidian Modal subclass, ~45 LOC, single text input + Create/Cancel)
- DashboardsTab detail header: "Default" badge on default dashboard, "Set as Default" action button

| File | Action | ~LOC |
|------|--------|------|
| `src/ui/analytics/DashboardTileRenderer.ts` | Add refresh button in header | +15 |
| `src/ui/analytics/DashboardsTab.ts` | onRefresh handler, name prompt, default badge/action | +70 |
| `src/ui/analytics/DashboardNameModal.ts` | **New** — naming modal | +45 |

**AC:**
- [ ] Each tile has a refresh icon that re-executes its query
- [ ] Refreshed tile shows loading state then updated results
- [ ] Creating a dashboard prompts for a name (not auto-named)
- [ ] Empty name input prevented (validation)
- [ ] "Default" badge shown on default dashboard in master list
- [ ] "Set as Default" action in dashboard detail header
- [ ] `npm test` passes

---

### Inc 5: Flow Test + Final Polish

**Goal:** End-to-end flow test, remaining polish, event subscription completeness.

**Design:**
- Flow 29 test: Supplier Manager daily workflow — create dashboard → name it → add tiles → set as default → verify overview → toggle favorites → verify sort → refresh tile
- AnalyticsDashboardPage polish: show dashboard name in overview header, empty favorites message
- Update AnalyticsHubView subscriptions for `analytics.dashboard.defaultChanged` event

| File | Action | ~LOC |
|------|--------|------|
| `tests/flows/29-AnalyticsSupplierManager.test.ts` | **New** — flow integration test | +100 |
| `src/ui/analytics/AnalyticsDashboardPage.ts` | Polish: dashboard title, empty favorites text | +15 |
| `src/ui/AnalyticsHubView.ts` | Subscribe to defaultChanged event | +5 |

**AC:**
- [ ] Flow 29 test passes (Supplier Manager daily workflow, ~15 tests)
- [ ] Overview page shows dashboard name when rendering default
- [ ] All event subscriptions complete (no orphan state)
- [ ] `npm test` passes

---

## Dependency Graph

```
Inc 1 (persona + types)
  ├── Inc 2 (dashboard-first overview)
  │     └── Inc 3 (favorites UI)
  ├── Inc 4 (refresh + naming + default badge)
  └── Inc 5 (flow test + polish — needs all above)
```

**Execution order:** Inc 1 → Inc 2 → Inc 3 → Inc 4 → Inc 5

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| TileResultCache extraction breaks DashboardsTab | Medium | Extract first, verify existing behavior, then wire to overview |
| Overview tile rendering duplicates DashboardsTab logic | Medium | Reuse DashboardTileRenderer + TileResultCache — no duplication |
| Default dashboard deleted while set as default | Low | Null check: dashboard not found → fall back to stats + prompt |
| `isFavorite` on existing persisted data | Low | Optional field (`?:`), defaults to falsy — backward compatible |
| Naming modal complexity | Low | Minimal Modal subclass (~45 LOC), single text input |
| Test count deviation (L-33 from Cycle 28) | Low | Conservative estimate: ~60 tests |

---

## Success Metrics

| Metric | Target |
|--------|--------|
| New tests | ~60 |
| Post-cycle total tests | ~4,398 |
| New source LOC | ~500 |
| New/rewritten UI components | 3 (AnalyticsDashboardPage rewrite, TileResultCache, DashboardNameModal) |
| Analytics events | 13 → 16 |
| Clicks to daily metrics | 4-7 → 1 (open hub) |
| Persona docs | 9 → 10 (Supplier Manager) |

---

## Deferred Items

| Item | Rationale | Target |
|------|-----------|--------|
| Dashboard auto-refresh / polling | Manual refresh per tile is sufficient | Future |
| Drag-and-drop tile reordering | Grid position via manual tile order | Future |
| Dashboard templates / presets | Let patterns emerge from usage first | Future |
| Multiple default dashboards | One global default covers the primary use case | Future |
| Tile resize (variable width/height) | Uniform 2-col grid is sufficient | Future |
| Charts / visualizations | Tables + stat cards cover current needs | Future |

---

## Definition of Done (Cycle)

### 1. All Increments Completed
- [ ] Each increment satisfies its own acceptance criteria
- [ ] No increment left in partial state
- [ ] Deferred items documented with rationale

### 2. Build & Test Quality
- [ ] `npm test` passes — all tests green
- [ ] `npm run check` passes (tsc + eslint clean)
- [ ] No test regressions on existing 4,338 tests
- [ ] Flow 29 integration test passes

### 3. Three Amigos Review
- [ ] Cycle-level review conducted
- [ ] All three perspectives represented
- [ ] TASM scores recorded

### 4. PRD & Backlog Updates
- [ ] Analytics Hub PRD updated with favorites + default dashboard FRs
- [ ] PBIs created and tracked
- [ ] Event model current (16 events in catalog)

### 5. Documentation
- [ ] Persona doc created (Supplier Manager)
- [ ] Component docs updated for modified components
- [ ] Flow doc updated if needed

### 6. Cycle Plan Completion
- [ ] Frontmatter updated (stage, date_completed, actual values)
- [ ] Deviations documented

### 7. Cycle Retrospective
- [ ] "What Went Well" completed
- [ ] "Deviations from Plan" completed
- [ ] "Learnings" completed

---

## DoR Preparation Notes

### 1. Feature PRD Readiness
- [x] PRD exists — [[Analytics Hub PRD]], stage: delivered, version: 3 (FR-15–FR-20 added)
- [x] Foundation documented — builds on Cycle 28 Analytics Hub delivery
- [x] Technical Review context — Cycle 28 delivered (4,338 tests, 178 suites)

### 2. Backlog Readiness
- [x] PBIs defined — ANA-015 through ANA-019
- [x] PBIs chunked into 5 increments — vertical slices
- [x] Dependencies mapped — Inc 1 first, then sequential
- [x] Priority ranked — types first (blocker), then UX layers

### 3. Cycle Plan Document
- [x] Cycle document exists with standard frontmatter
- [x] Situation assessment written (post-Cycle 28, 4,338 tests)
- [x] Cycle goals defined (5 goals)
- [x] Proposed increments specified (5 with scope, LOC, tests)
- [x] Dependency graph drawn
- [x] Risks identified (6 risks)
- [x] Success metrics defined
- [x] Deferred items documented (6 items)

### 4. Increment Readiness
- [x] All 5 increments have: scope, AC, test intent, architecture

### 5. Quality Baseline
- [x] Build pipeline green — `npm test` passes (4,338 tests, 178 suites)
- [x] No critical bugs open
- [x] Previous cycle closed — Cycle 28 retrospective completed

### 6. Pre-Cycle Completion
- [x] Pre-cycle work documented — no pre-cycle fixes needed
- [x] Persona doc created — [[Supplier Manager]]
- [x] Inbox signals reviewed — Supplier Manager persona drives this cycle

---

## Related
- PRD: [[Analytics Hub PRD]]
- Prior Cycle: [[Cycle 28 - Analytics Hub]]
- Persona: [[Supplier Manager]]
- PBIs: [[PBI-ANA-015 Favorite Types Foundation]], [[PBI-ANA-016 Dashboard First Overview]], [[PBI-ANA-017 Favorites UI]], [[PBI-ANA-018 Dashboard UX Polish]], [[PBI-ANA-019 Supplier Manager Flow Test]]
