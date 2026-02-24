---
type: DevelopmentCycle
feature: "[[Analytics Hub PRD]]"
stage: ready
cycle: 32
date_planned: 2026-02-24
pbis:
  - "[[PBI-ANA-030 QueriesTab Extraction]]"
  - "[[PBI-ANA-031 Chart Tile Foundation]]"
  - "[[PBI-ANA-032 Conditional Formatting]]"
  - "[[PBI-ANA-033 Chart Polish and Sparklines]]"
  - "[[PBI-ANA-034 Visualization Flow Test]]"
bugs: []
bugs_fixed_precycle: []
tech_debt:
  - "TD-ANA-001 (QueriesTab extraction — 1,264 LOC, over 1,200 threshold)"
estimated_increments: 5
estimated_tests: 70
pre_cycle_tests: 4403
pre_cycle_suites: 181
---

# Cycle 32 — Analytics Visualization Sprint

## Cycle Overview

**User Story:**

> As a Supplier Manager receiving daily CSV reports, I want to see cost and sales trends as visual charts on my dashboard, with color-coded KPI values highlighting cost increases and margin improvements, so that I can spot anomalies and trends at a glance without reading raw numbers.

**User Pains:**
- Dashboard tiles only show raw tables and stat-card numbers — no visual trend indication
- Cost increases and margin drops are indistinguishable from normal values — everything looks the same
- Comparing month-over-month trends requires mentally scanning columns of numbers
- Charts and visualizations have been deferred for **4 consecutive cycles** (C28–C31) — users repeatedly express need for visual data representation
- QueriesTab at 1,264 LOC is becoming a maintenance risk and blocks confident addition of new UI features
- The Supplier Management Dashboard PRD (inbox) explicitly requires line charts, bar charts, conditional coloring, and trend visualization

**User Needs:**
- Chart tiles: line charts showing trends over time, bar charts comparing categories
- Conditional formatting: red for cost increases, green for margin improvements, amber for warnings
- Sparklines in stat-card tiles: compact trend visualization alongside KPI numbers
- Maintainable query builder: QueriesTab decomposition into focused sub-components

**Business Trigger:** The Supplier Management Dashboard PRD was added to the plugin inbox, demanding visualization capabilities (line charts, bar charts, area charts, conditional coloring, trend panels). These requirements align directly with the 4-cycle deferred "Charts & Visualizations" item, making this the natural next investment.

---

## Situation Assessment

### Pre-Cycle State (post-Cycle 31)

**Plugin health:**
- 4,403 tests passing, 181 test suites
- Build status: green (`npm test` + `npm run check` clean)
- Cycle 31 completed — Business Intelligence delivered (computed columns, Quick Insights, freshness, import bridge)
- No pre-cycle bug fixes needed

**Analytics domain status:**
- Domain: ~2,107 LOC (AnalyticsEngine 573, AnalyticsService 592, types 319, events 139, freshnessUtils 81, quickInsights 80, BaseAnalyticsAdapter 89, dateUtils 98, localeUtils 136)
- UI: ~2,972 LOC (AnalyticsHubView 309, QueriesTab 1,264, DashboardsTab 436, DashboardTileRenderer 254, AnalyticsDashboardPage 312, TileResultCache 68, DashboardNameModal 73, SourcePreviewPanel 79, AddTileDialog 110, types 67)
- Tests: ~280 across 6 domain suites + 5 flow suites + 1 UI suite
- Events: 19 (5 query lifecycle + 4 query CRUD + 7 dashboard + 3 tile)
- PRD: v5, FRI 31/35, 36 FRs all delivered

**Key UX gaps (addressed in this cycle):**
1. No chart visualization — only tables and stat cards (deferred 4 cycles)
2. No conditional formatting — all values rendered identically regardless of significance
3. No sparklines — stat cards show only current values, no trend context
4. QueriesTab at 1,264 LOC — over the 1,200 threshold flagged in Cycle 30 review

**Open action items from previous cycles:**
- AI-1 (C31): Fix stale JSDoc in events.ts ("16 events" → "19 events")
- AI-2 (C31): Consider QueriesTab extraction into sub-components (1,264 LOC)
- OB-1 (C31): QueriesTab growing large
- TD-ANA-001 (C30): Query builder sub-component extraction (if >1,200 LOC — now exceeded)

**Key files (current state):**
- `src/ui/analytics/QueriesTab.ts` (1,264 LOC) — monolithic query builder, extraction candidate
- `src/ui/analytics/DashboardTileRenderer.ts` (254 LOC) — tile rendering, will add chart + formatting support
- `src/ui/analytics/DashboardsTab.ts` (436 LOC) — tile configuration UI
- `src/domain/analytics/types.ts` (319 LOC) — TileDisplayMode to extend
- `src/domain/analytics/events.ts` (139 LOC) — stale JSDoc to fix

---

## Cycle Goals

1. **QueriesTab Extraction** — Decompose 1,264 LOC monolith into focused sub-components (resolves TD-ANA-001 + AI-2)
2. **Chart Foundation** — SVG-based line charts and bar charts as new dashboard tile display modes
3. **Conditional Formatting** — Threshold-based color coding for stat-card values and table cells
4. **Sparklines** — Compact trend mini-charts embedded in stat-card tiles for at-a-glance trend visibility
5. **Integration Verification** — Flow 32 test covering visualization workflow + stale fixes from C31

---

## Scope

### In Scope
- QueriesTab decomposition into 4-5 sub-components (~1,264 LOC redistributed)
- New `TileDisplayMode` values: `"line-chart"`, `"bar-chart"`
- SVG chart renderer component for line charts (trend data) and bar charts (comparison data)
- Charts auto-detect x-axis (first dimension) and y-axis (first measure) from query results
- `ConditionalRule` type: column, operator, threshold value, color
- `conditionalRules?: ConditionalRule[]` on `DashboardTile`
- Conditional formatting applied to stat-card values (text color) and table cells (background tint)
- Built-in color presets: positive (green), negative (red), warning (amber)
- Sparkline mini-charts in stat-card tiles showing trend across result rows
- Tile configuration UI for chart type selection and conditional rule management
- Fix stale JSDoc in events.ts (AI-1 from Cycle 31)
- Flow 32 integration test

### Out of Scope
- Chart interactivity (tooltips, zoom, pan) — static SVG in v1
- Chart legends with toggle visibility — simple label-only in v1
- Area charts, pie charts, heatmaps — line + bar sufficient for v1
- Trend calculations (MoM change %, rolling averages) — deferred to Cycle 33
- Dashboard templates / presets — deferred
- Drag-and-drop tile reordering — move up/down sufficient
- Auto-refresh polling — manual refresh works
- Forecasting / projections — future phase per Supplier PRD
- Drill-down navigation (Supplier → SKU → Month) — deferred
- External chart libraries — pure SVG, no dependencies

---

## Increments

### Inc 1: QueriesTab Sub-Component Extraction (TD-ANA-001)

**Goal:** Decompose the 1,264 LOC QueriesTab monolith into focused sub-components.

**Design:**
- Extract into 5 sub-components following the existing shared pattern (`constructor(el, deps)`, `render()`):
  - `SourcePanel` (~180 LOC): source picker, source preview rendering, Quick Insight cards
  - `QueryBuilderPanel` (~250 LOC): dimensions, measures, filters, sort, limit configuration
  - `ComputedColumnsSection` (~120 LOC): computed column add/remove/edit UI
  - `ResultsSection` (~200 LOC): results rendering, export actions, error display
  - `SavedQueryList` (~150 LOC): saved query master list with star icons, search, CRUD actions
- QueriesTab becomes a thin orchestrator (~350 LOC): state management, event wiring, tab lifecycle, delegates rendering to sub-components
- All behavior preserved — zero functional changes
- Existing tests must continue to pass without modification

| File | Action | ~LOC |
|------|--------|------|
| `src/ui/analytics/queries/SourcePanel.ts` | **New** — source picker + preview + Quick Insights | +180 |
| `src/ui/analytics/queries/QueryBuilderPanel.ts` | **New** — dimensions, measures, filters, sort, limit | +250 |
| `src/ui/analytics/queries/ComputedColumnsSection.ts` | **New** — computed column UI | +120 |
| `src/ui/analytics/queries/ResultsSection.ts` | **New** — results rendering + export | +200 |
| `src/ui/analytics/queries/SavedQueryList.ts` | **New** — saved query master list | +150 |
| `src/ui/analytics/QueriesTab.ts` | **Rewrite** — thin orchestrator | ~350 (was 1,264) |

**AC:**
- [ ] QueriesTab reduced to ~350 LOC orchestrator
- [ ] 5 sub-components extracted into `src/ui/analytics/queries/` directory
- [ ] All existing query builder behavior preserved (source loading, query execution, save/load, favorites, computed columns, Quick Insights)
- [ ] All existing tests pass without modification
- [ ] `npm test` passes

**Tests:** 0 new (refactor — existing tests provide coverage)

---

### Inc 2: Chart Tile Foundation (SVG Line + Bar Charts)

**Goal:** Add line chart and bar chart as dashboard tile display modes using pure SVG rendering.

**Design:**
- Extend `TileDisplayMode`: `"table" | "stat-card" | "line-chart" | "bar-chart"`
- New component: `ChartRenderer` (~200 LOC) in `src/ui/analytics/ChartRenderer.ts`
  - Pure SVG generation — no external dependencies
  - **Line chart**: data points connected by lines; x-axis from first dimension, y-axis from first measure
  - **Bar chart**: vertical bars; one bar per dimension group, height proportional to measure value
  - Common features: axis labels, gridlines, responsive width (fills tile container), value labels on data points
  - Edge cases: single data point → dot, zero values → baseline, empty result → "No data" message
- `DashboardTileRenderer` updated: route `"line-chart"` and `"bar-chart"` display modes to ChartRenderer
- `AddTileDialog` updated: display mode dropdown includes chart options
- `DashboardsTab` tile mode toggle: cycle includes chart modes (table → stat-card → line-chart → bar-chart)
- Chart sizing: fixed aspect ratio (16:9) within tile container, responsive to tile width

| File | Action | ~LOC |
|------|--------|------|
| `src/ui/analytics/ChartRenderer.ts` | **New** — SVG chart rendering (line + bar) | +200 |
| `src/domain/analytics/types.ts` | Extend TileDisplayMode with chart modes | +2 |
| `src/ui/analytics/DashboardTileRenderer.ts` | Route chart modes to ChartRenderer | +15 |
| `src/ui/analytics/AddTileDialog.ts` | Add chart options to mode dropdown | +5 |
| `src/ui/analytics/DashboardsTab.ts` | Extend mode toggle cycle | +5 |

**AC:**
- [ ] "line-chart" tile display mode renders SVG line chart from query results
- [ ] "bar-chart" tile display mode renders SVG bar chart from query results
- [ ] Charts auto-detect x-axis (first dimension) and y-axis (first measure) from results
- [ ] Charts show axis labels and value labels on data points
- [ ] Empty results show "No data" message
- [ ] Tile mode toggle cycles through all 4 modes (table → stat-card → line-chart → bar-chart)
- [ ] AddTileDialog includes chart mode options
- [ ] `npm test` passes

**Tests:** ~20 (SVG generation, axis detection, edge cases, empty data, single point)

---

### Inc 3: Conditional Formatting

**Goal:** Enable threshold-based color coding for stat-card values and table cells.

**Design:**
- New type: `ConditionalRule { column: string; operator: ">" | "<" | ">=" | "<=" | "="; threshold: number; color: "positive" | "negative" | "warning" | string }`
- Add `conditionalRules?: ConditionalRule[]` to `DashboardTile` type
- `DashboardTileRenderer`: apply rules when rendering stat-card values and table cells
  - For each cell value, evaluate rules in order; first match wins
  - Color application: stat-card → text color, table → subtle background tint
  - Built-in color map: `positive` → `var(--text-success)`, `negative` → `var(--text-error)`, `warning` → `var(--text-warning)`, or raw CSS color string
- Tile configuration: add "Formatting" section in tile settings
  - Add rule: column dropdown, operator dropdown, threshold input, color preset picker
  - Remove rule button per rule
  - Preview indicator showing which columns have rules
- `AnalyticsService.updateTile()` already handles `changes` partial — no service changes needed

| File | Action | ~LOC |
|------|--------|------|
| `src/domain/analytics/types.ts` | Add `ConditionalRule`, extend `DashboardTile` | +10 |
| `src/ui/analytics/DashboardTileRenderer.ts` | Apply conditional rules to stat-card + table | +60 |
| `src/ui/analytics/DashboardsTab.ts` | Formatting rules UI in tile settings | +80 |

**AC:**
- [ ] `ConditionalRule` type exists with column, operator, threshold, color
- [ ] Conditional rules can be added/removed per tile via UI
- [ ] Rules evaluate against cell values; first match applies color
- [ ] Stat-card values show colored text based on matching rules
- [ ] Table cells show subtle background tint based on matching rules
- [ ] Built-in presets: positive (green), negative (red), warning (amber)
- [ ] Custom CSS color strings accepted alongside presets
- [ ] Rules persist in tile configuration
- [ ] `npm test` passes

**Tests:** ~15 (rule evaluation, color mapping, presets, multiple rules priority, no-match fallback)

---

### Inc 4: Sparklines + Chart Polish

**Goal:** Add sparkline mini-charts to stat-card tiles and polish chart rendering.

**Design:**
- Sparkline in stat-card tiles: when a stat-card tile has ≥3 result rows, render a tiny inline SVG line below each measure value
  - Sparkline shows values across dimension groups (e.g., revenue trend across months)
  - Dimensions: ~80px wide × 24px tall, no axes, no labels — pure trend line
  - Color: follows freshness/conditional state or muted gray default
  - Optional: `showSparkline?: boolean` on DashboardTile (default `true`)
- Chart polish:
  - Line chart: add dot markers on data points, dashed gridlines
  - Bar chart: rounded bar tops, value labels above bars
  - Both: responsive font sizing based on data density
  - Axis tick marks: auto-scale (skip labels if too many)

| File | Action | ~LOC |
|------|--------|------|
| `src/ui/analytics/ChartRenderer.ts` | Add sparkline generator + chart polish | +80 |
| `src/ui/analytics/DashboardTileRenderer.ts` | Wire sparklines into stat-card rendering | +30 |
| `src/domain/analytics/types.ts` | Add `showSparkline?: boolean` to DashboardTile | +1 |

**AC:**
- [ ] Stat-card tiles show sparkline below each measure value when ≥3 result rows exist
- [ ] Sparklines are compact (80×24px), no axes or labels
- [ ] Sparklines hidden when <3 result rows
- [ ] `showSparkline` toggle defaults to `true`; can be disabled per tile
- [ ] Line charts show dot markers on data points
- [ ] Bar charts show rounded tops and value labels
- [ ] Axis labels auto-scale for data density
- [ ] `npm test` passes

**Tests:** ~15 (sparkline generation, threshold, SVG output, polish features)

---

### Inc 5: Flow Test + Final Polish

**Goal:** End-to-end flow test, stale fixes, final verification.

**Design:**
- Flow 32 test: Visualization workflow
  - Create query → execute → save → create dashboard → add tile as table → toggle to line-chart → verify SVG output
  - Add conditional rules → verify color application → toggle to stat-card → verify sparkline
  - Edge cases: empty result, single row, bar chart with many groups
- Fix AI-1: Update stale JSDoc comment in events.ts ("16 events" → "19 events")
- Fix stale PRD items: v4 AC checkboxes, PBI stages in Extended Backlog
- Polish: ensure chart SVGs are accessible (aria-labels), conditional colors use CSS variables for theme compat

| File | Action | ~LOC |
|------|--------|------|
| `tests/flows/32-AnalyticsVisualization.test.ts` | **New** — flow integration test | +130 |
| `src/domain/analytics/events.ts` | Fix stale JSDoc comment (AI-1) | +1 |

**AC:**
- [ ] Flow 32 test passes (~20 tests covering visualization workflow)
- [ ] Chart tiles render SVG with correct data mapping
- [ ] Conditional formatting applies correctly in flow context
- [ ] Sparklines render in stat-card tiles
- [ ] Stale JSDoc in events.ts fixed
- [ ] All event subscriptions complete (no orphan state)
- [ ] `npm test` passes

**Tests:** ~20 (flow integration)

---

## Dependency Graph

```
Inc 1 (QueriesTab extraction — TD)
Inc 2 (chart foundation — independent but easier after Inc 1)
  └── Inc 4 (sparklines + chart polish)
Inc 3 (conditional formatting — independent)
Inc 5 (flow test — needs all above)
```

**Execution order:** Inc 1 → Inc 2 → Inc 3 → Inc 4 → Inc 5

Inc 1 and Inc 2 modify different areas but sequential avoids conflicts.
Inc 3 is independent but follows Inc 2 for tile renderer coherence.

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| QueriesTab extraction introduces regressions | High | Zero functional changes — extract only. Existing tests must pass without modification |
| SVG rendering complex in Obsidian environment | Medium | Pure SVG (no canvas, no external lib). Test SVG output as string assertions |
| Chart axis detection wrong for multi-dimension queries | Medium | Simple rule: first dimension = x-axis, first measure = y-axis. Override with explicit config in future |
| Conditional formatting conflicts with freshness colors | Low | Conditional rules take precedence over freshness badges (different DOM elements) |
| Sparkline rendering slow for many tiles | Low | Sparklines are small SVGs (~5 elements each). Render only visible tiles |
| TileDisplayMode union grows complex | Low | 4 modes total — well within manageable scope |

---

## Success Metrics

| Metric | Target |
|--------|--------|
| New tests | ~70 |
| Post-cycle total tests | ~4,473 |
| New source LOC | ~550 (chart renderer + formatting + sparklines) |
| QueriesTab LOC reduction | 1,264 → ~350 (orchestrator) |
| TileDisplayMode options | 2 → 4 (add line-chart, bar-chart) |
| Analytics events | 19 (no new events — features are UI-level) |
| Visual tile types | 2 → 5 (table, stat-card, line-chart, bar-chart, stat-card+sparkline) |
| Action items resolved | 3 (AI-1 JSDoc, AI-2 QueriesTab, TD-ANA-001) |

---

## Backlog Refinement Notes

### Session Date: 2026-02-24

### Inputs Analyzed

1. **Plugin inbox** — 2 new PRDs pulled (Supplier Management Dashboard, Meeting Notes), ~105 total items reviewed
2. **Vault inbox** — 14 analytics-relevant items reviewed (Quality Dashboard, Quality Scoring, etc.)
3. **Deferred items** — 4-cycle persistent deferrals (charts, auto-refresh, drag-and-drop, templates) + 1-cycle deferrals (expression functions, drill-down)
4. **Action items** — AI-1 (stale JSDoc), AI-2 (QueriesTab extraction), OB-1 (QueriesTab size)
5. **Learnings** — L-34 (flow tests consolidate), L-35 (event payload audit), L-36 (safe arithmetic)
6. **Current state** — PRD v5, 36 FRs delivered, 19 events, ~5,079 LOC source, 4,403 tests

### New PRD Analysis

#### Feature - Supplier Management Dashboard (Plugin Inbox)
- **Domain**: Operations / Procurement / Supply Chain
- **Maturity**: L1 → L3
- **Core questions**: Cost by SKU by Supplier per Month, Sales, QTY on Hand, Open POs, Historical trends, Forecasts
- **Requires**: Line charts, bar charts, area charts, conditional coloring, trend panels, drill-down, filtering, KPI definitions, forecasting
- **Assessment**: This is the **strategic direction** for the Analytics Hub. It validates the 4-cycle deferral of charts as a real user need. However, the full scope (6 KPI categories, 15+ metrics, forecasting, drill-down, area charts, heatmaps) spans multiple cycles. Cycle 32 picks the **foundational enablers**: chart rendering + conditional formatting.
- **Decision**: **Partially addressed** — chart foundation (Inc 2), conditional formatting (Inc 3), sparklines (Inc 4) enable the visual layer. Full Supplier Dashboard (templates, trend calculations, drill-down, forecasting) deferred to Cycles 33+.

#### Feature - Meeting Notes (Plugin Inbox)
- **Domain**: Session Workspace
- **Core**: Audio recording, Ollama transcription, structured Markdown summaries
- **Assessment**: Completely separate domain from Analytics Hub. Requires audio recording APIs, local AI integration, session-bound artifacts — none of which overlap with analytics visualization.
- **Decision**: **Out of scope** — reviewed and deferred to Session domain roadmap. Not an Analytics Hub concern.

### Items Analyzed (from Plugin Inbox + Vault Inbox)

| Inbox Item | Decision | Rationale |
|------------|----------|-----------|
| Supplier Management Dashboard PRD | **Partially addressed** (C32: charts, formatting) | Foundation for visual analytics; full scope multi-cycle |
| Meeting Notes PRD | **Deferred** (Session domain) | Not analytics-related; separate domain |
| Quality Dashboard (ISO 25010) | **Deferred** | Large scope; separate PRD needed |
| Quality Scoring of Software Products | **Deferred** | Companion to Quality Dashboard |
| Every analytics-able file has dashboard | **Partially addressed** (existing) | Recent Sources + source picker already cover this |
| How can we measure performance | **Deferred** | Infrastructure metrics, not user-facing analytics |
| DX Execution duration tracking (PBI-008) | **Deferred** | DX domain scope |
| Build report ingestion (PBI-009) | **Deferred** | Ingestion domain scope |
| Easy dashboard from CSV | **Addressed** (C31 Quick Insights) | Quick Insights delivers this |
| Data pipeline documentation | **Deferred** | DX Hub scope |
| Pipeline multi-source merge (RB-7) | **Deferred** | DX pipeline v2 scope |
| Automate dev cycle reports | **Deferred** | Process automation domain |
| Data lineage visualization | **Deferred** | Future analytics enhancement |
| Obsidian Base as analytics input | **Delivered** (C28) | BaseAnalyticsAdapter already exists |

### Deferred Items Disposition

| Item | Cycles Deferred | Cycle 32 Decision | Rationale |
|------|----------------|-------------------|-----------|
| **Charts / Visualizations** | 4 (C28–C31) | **IN SCOPE** | Supplier PRD demands it; 4-cycle deferral justifies priority |
| Auto-refresh / Polling | 4 (C28–C31) | Deferred | Manual refresh works; low user demand |
| Drag-and-drop tile reordering | 4 (C28–C31) | Deferred | Move up/down sufficient |
| Dashboard templates / presets | 4 (C28–C31) | Deferred | Quick Insights partially addresses; templates need more patterns |
| Expression functions (ROUND, ABS, IF) | 1 (C31) | Deferred | Basic arithmetic sufficient; no user demand yet |
| Computed column type inference | 1 (C31) | Deferred | Always numeric works for current use cases |
| ML/AI query recommendations | 1 (C31) | Deferred | Rule-based Quick Insights adequate |
| Cross-dashboard drill-down | 1 (C30) | Deferred | Navigational complexity; defer to Supplier Dashboard cycle |
| **QueriesTab extraction** | 2 (C30–C31) | **IN SCOPE** | Over 1,200 LOC threshold; blocks confident UI additions |

### Prioritization Criteria

1. **4-cycle persistent deferral** → must address now or acknowledge as permanently out of scope (highest)
2. **New PRD demand** → Supplier Management Dashboard requires visualization (high)
3. **Technical debt threshold exceeded** → QueriesTab at 1,264 LOC (high)
4. **Open action items from reviews** → AI-1, AI-2 from Cycle 31 (medium)
5. **Supplier Manager persona enablement** → visual KPI monitoring (medium)

### Strategic Roadmap (Analytics Hub Cycles 32-34)

| Cycle | Theme | Key Deliverables |
|-------|-------|-----------------|
| **32 (this)** | Visualization Foundation | Charts (line + bar), conditional formatting, sparklines, QueriesTab extraction |
| **33 (next)** | Trend Intelligence | Trend calculations (MoM, PCT_CHANGE), expression functions (ROUND, ABS), dashboard drill-down |
| **34 (future)** | Supplier Dashboard | Pre-built supplier template, forecasting (linear trend, rolling avg), area charts, KPI definitions |

---

## Deferred Items

| Item | Rationale | Target |
|------|-----------|--------|
| Chart interactivity (tooltips, zoom) | Static SVG sufficient for v1; interactivity adds complexity | Cycle 34+ |
| Area charts, pie charts, heatmaps | Line + bar cover Supplier PRD v1 needs | Cycle 34 |
| Trend calculations (MoM, rolling avg) | Requires window function logic; separate from chart rendering | Cycle 33 |
| Expression functions (ROUND, ABS, IF) | Basic arithmetic covers current needs | Cycle 33 |
| Dashboard drill-down | Navigational pattern needs design spike | Cycle 33 |
| Chart legends with toggle | Simple labels sufficient in v1 | Future |
| Auto-refresh polling | Manual refresh works | Future |
| Drag-and-drop tile reordering | Move up/down sufficient | Future |
| Dashboard templates | Patterns need to emerge from usage | Future |
| Forecasting / projections | Future phase per Supplier PRD | Cycle 34 |
| Meeting Notes feature | Session domain — not analytics | Session roadmap |

---

## Definition of Done (Cycle)

### 1. All Increments Completed
- [ ] Each increment satisfies its own acceptance criteria
- [ ] No increment left in partial state
- [ ] Deferred items documented with rationale

### 2. Build & Test Quality
- [ ] `npm test` passes — all tests green
- [ ] `npm run check` passes (tsc + eslint clean)
- [ ] No test regressions on existing 4,403 tests
- [ ] Flow 32 integration test passes

### 3. Three Amigos Review
- [ ] Cycle-level review conducted
- [ ] All three perspectives represented
- [ ] TASM scores recorded

### 4. PRD & Backlog Updates
- [ ] Analytics Hub PRD updated with visualization FRs (FR-37–FR-42)
- [ ] PBIs created and tracked (ANA-030 through ANA-034)
- [ ] Event model current (19 events — no new events in this cycle)

### 5. Documentation
- [ ] Component docs updated for new/modified components
- [ ] ChartRenderer documented

### 6. Cycle Plan Completion
- [ ] Frontmatter updated (stage, date_completed, actual values)
- [ ] Deviations documented

### 7. Cycle Retrospective
- [ ] "What Went Well" completed
- [ ] "Deviations from Plan" completed
- [ ] "Learnings" completed

---

## Verification

1. **DoR phase**: All docs created (cycle doc, 5 PBIs, PRD v6) — verify with file existence
2. `npm test` — all tests pass after each increment
3. Manual: Create dashboard → add tile → select "line-chart" mode → verify SVG renders
4. Manual: Add conditional rules → verify stat-card values colored
5. Manual: Stat-card tile with ≥3 rows → sparkline appears below values
6. Manual: Toggle tile mode through all 4 options
7. Flow 32 integration test covers the visualization workflow
