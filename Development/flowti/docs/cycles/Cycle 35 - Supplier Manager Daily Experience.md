---
type: DevelopmentCycle
feature: "[[Analytics Hub PRD]]"
stage: planned
cycle: 35
date_planned: 2026-02-24
date_completed:
pbis:
  - "[[PBI-ANA-048 CSV Utilities Extraction]]"
  - "[[PBI-ANA-049 Tile Management Remove and Reconfigure]]"
  - "[[PBI-ANA-050 Add to Dashboard from Query Results]]"
  - "[[PBI-ANA-051 Dashboard Tile Actions]]"
  - "[[PBI-ANA-052 Query and Dashboard Polish]]"
  - "[[PBI-ANA-053 Supplier Manager Daily Flow Test]]"
bugs: []
bugs_fixed_precycle: []
tech_debt:
  - "[[TD-126 CSV utilities scattered across domains]]"
estimated_increments: 6
estimated_tests: 45
pre_cycle_tests: 4576
pre_cycle_suites: 189
---

# Cycle 35 — Supplier Manager Daily Experience

## Cycle Overview

**User Story:**

> As a Supplier Manager who has built dashboards for procurement and inventory analysis, I want to effortlessly consume my KPIs each morning and quickly create new dashboards when fresh data arrives — so that analytics becomes a natural part of my daily workflow rather than a tool I have to wrestle with.

**User Pains:**

- **Tiles are permanent** — no way to remove a tile from a dashboard (the `onRemove` callback exists but no UI button triggers it). Mistakes during dashboard creation are irreversible without deleting the entire dashboard.
- **Tiles are rigid** — after creating a tile, you cannot change its query, width, or sparkline setting. The settings gear only shows conditional formatting rules.
- **Query-to-dashboard gap** — after building and executing a query, the user must navigate to the Dashboards tab, open a dashboard, click "Add Tile", and select the query. This multi-step flow disrupts the creative momentum of data exploration.
- **No tile-level export** — the user can export query results from the Queries tab, but cannot export a single tile's data from the dashboard view. Daily reporting requires navigating back to the query.
- **No tile-level investigation** — when a stat card shows an anomalous value, there is no way to quickly see the underlying data or navigate to the source query.
- **CSV utilities scattered** — `escapeCsvField`, `generateCsv/resultToCsv`, and `downloadCsv` logic is duplicated across 6 locations (TD-126). Every new CSV consumer must rewrite or copy-paste.
- **Query purpose is undocumented** — saved queries have names but no description field. After building 10+ queries, the Supplier Manager cannot remember which question each query answers without executing it.

**User Needs:**

- Remove tiles from dashboards and reconfigure them (change query, width, sparkline) after creation
- Add a query result to a dashboard directly from the Queries tab with minimal friction
- Export individual tile data and navigate from a tile to its source query for deeper investigation
- Consolidated CSV utilities as a first-class infrastructure concern
- Query descriptions to document intent ("What question does this query answer?")

**Business Trigger:** Cycle 34 delivered dashboard discovery — the Supplier Management Dashboard and Inventory Health Dashboard now exist as templates and running dashboards. The Analytics Hub has all the analytical capabilities (60 FRs delivered). The shift is from "build the engine" to **"use the engine daily"**. The Supplier Manager's morning routine (open dashboard → scan KPIs → investigate anomalies → export for meetings → create new views) has specific friction points that this cycle resolves.

---

## Situation Assessment

### Pre-Cycle State (post-Cycle 34)

**Plugin health:**
- 4,576 tests passing, 189 test suites
- Build status: green (`npm test` + `npm run check` clean)
- Cycle 34 completed — Inventory Discovery & Dashboard Integration delivered (area charts, templates, User Hub widget, UX sprint)
- No blocking bugs; 2 new TD items opened (TD-126, TD-127)

**Analytics domain status:**
- Domain: ~3,600 LOC (AnalyticsEngine 853, AnalyticsService ~720, types ~400, events 139, expressionFunctions 97, trendCalculations 83, conditionalFormatting 50, quickInsights 80, dateUtils 98, localeUtils 136, freshnessUtils 81, BaseAnalyticsAdapter 90)
- UI: ~5,000 LOC (AnalyticsHubView 308, QueriesTab ~650, DashboardsTab ~480, DashboardTileRenderer ~600, ChartRenderer ~570, AnalyticsDashboardPage ~420, query sub-components ~960, AddTileDialog ~100, TileResultCache ~60)
- Tests: ~320 analytics-specific across domain + flow + UI suites
- Events: 21 (stable after template events added in C34)
- PRD: v8, FRI 35/35, 60 FRs all delivered
- Templates: 2 (Supplier Management, Inventory Health)
- Test data: 5 CSVs (Suppliers, Items, Sales, Inventory, PurchaseOrders)

**Supplier Management PRD coverage:**

| PRD Section | Status | Addressed In |
|-------------|--------|-------------|
| §6.1 Cost by SKU/Supplier/Month | ✓ Delivered | Supplier Management Dashboard (C34) |
| §6.2 Sales by SKU/Supplier/Month | ✓ Delivered | Supplier Management Dashboard (C34) |
| §6.3 QTY on Hand by SKU/Month | ✓ Delivered | Inventory Health Dashboard (C34) |
| §6.4 Open Purchase Orders | ✓ Delivered | Inventory Health Dashboard (C34) |
| §6.5 Historical Development | ✓ Partial | Trend functions (C33), rolling averages |
| §6.6 Future Development | ✗ Not started | Forecasting — deferred |
| §9.1 Filtering & Controls | ✓ Partial | Query-level filters (C30); no dashboard-level filtering |
| §9.2 Dashboard Components | ✓ Partial | Overview ✓, Trends ✓, Comparison ✓; Drilldown ✗ |
| §9.3 Forecasting | ✗ Not started | Deferred to future cycle |
| §10 UX: CSV Export | ✓ Delivered | File download from query builder (C34 UX sprint) |
| §10 UX: Conditional Coloring | ✓ Delivered | Rule builder UI (C33) |
| §10 UX: Drill-down via click | ✗ Not started | Lightweight version in this cycle (view source query from tile) |
| §11 Visualization Types | ✓ Delivered | Line ✓, Area ✓, Bar ✓, Table ✓ |

**Key friction points (addressed in this cycle):**
1. No tile remove button — `onRemove` wired but no UI triggers it
2. No tile reconfiguration — settings panel only has conditional formatting
3. No "Add to Dashboard" from query results — creation flow requires tab switching
4. No tile-level data export — dashboard view is read-only
5. No tile → query navigation — anomaly investigation requires manual query lookup
6. CSV utilities duplicated across 6 locations (TD-126)
7. No query description field — intent lost after initial creation

**Open action items from Cycle 34 review:**
- AI-2: Monitor AnalyticsEngine at 900 LOC threshold (currently 853 LOC) — Low
- AI-4: Monitor DashboardTileRenderer at 700 LOC threshold (currently ~600 LOC) — Low → **will approach threshold this cycle** (~720 LOC after Inc 2)
- IMP-34-1: UX buffer in test estimates — applied to this cycle's estimates
- IMP-34-3: Query auto-execute as opt-in setting — consider as polish item

**Tech debt inputs:**
- TD-126: CSV utilities scattered across domains (open, medium) — **IN SCOPE** (Inc 1)
- TD-127: Performance observability for growing state (open, medium) — deferred (infrastructure, not daily UX)

**Key files (current state):**
- `src/ui/analytics/DashboardTileRenderer.ts` (~600 LOC) — tile header actions: reorder, display mode dropdown, refresh, settings gear. No trash icon. Settings panel only has conditional formatting rule builder.
- `src/ui/analytics/DashboardsTab.ts` (~480 LOC) — `TileRenderContext` has `onRemove` callback but no UI button invokes it. No `queries` list in context.
- `src/ui/analytics/QueriesTab.ts` (~650 LOC) — results area has "Save As New" and "Save to CSV" buttons. No "Add to Dashboard" option.
- `src/ui/analytics/queries/SourcePanel.ts` (137 LOC) — source rows with alias, locale, row count.
- `src/ui/hub/AnalyticsResultsPanel.ts` — has `generateCsv()` + `escapeCsvField()` (duplicated from QueriesTab).
- `src/domain/analytics/types.ts` (~400 LOC) — `SavedAnalyticsQuery` has no `description` field.

---

## Backlog Refinement Notes

### Session Date: 2026-02-24

### Inputs Analyzed

1. **Cycle 34 retrospective** — Discovery-first approach worked; UX sprint was high-value; feature removal (pinning) was correct decision
2. **Cycle 34 deferred items** — Dashboard drill-down, forecasting, pie charts, chart interactivity, file-level dashboards, drag-and-drop
3. **Supplier Management PRD** — §9.1 filtering, §9.2 drilldown, §10 UX requirements still have gaps
4. **TD-126** (CSV utilities scattered) — directly impacts daily workflow (export from tiles, query results)
5. **TD-127** (Performance observability) — infrastructure concern, not daily UX
6. **Vault inbox** — "Improve CSV integration with Analytics Hub", "Analytics hub vault insights", "Every analytics-able file has dashboard capabilities", "Quality Dashboard for Software Products", "DX Hub Dashboard needs love"
7. **Plugin inbox** — "When opening a CSV with Flowti, I want to be able to make an easy dashboard", "Feature - Supplier Management" (PRD source)
8. **Existing plan** — Dashboard Tile Management — Remove & Reconfigure (`reactive-cuddling-clover.md`) — ready to implement
9. **Cycle 34 improvement backlog** — IMP-34-1 (UX test buffer), IMP-34-3 (auto-execute opt-in)

### Items Analyzed

| Source | Item | Decision | Rationale |
|--------|------|----------|-----------|
| TD-126 | CSV utilities extraction | **IN SCOPE** (Inc 1) | Foundation for tile CSV export; eliminates duplication across 6 locations |
| Plan file | Tile Management — Remove & Reconfigure | **IN SCOPE** (Inc 2) | Biggest daily friction: can't fix mistakes, can't adjust tiles |
| User journey analysis | Add to Dashboard from query results | **IN SCOPE** (Inc 3) | Bridges creation gap: query → dashboard without tab switching |
| User journey analysis | Tile CSV export + View source query | **IN SCOPE** (Inc 4) | Daily consumption: export for meetings, investigate anomalies |
| Supplier Management PRD §10 | Query description field | **IN SCOPE** (Inc 5) | Documents query intent; aids long-term maintenance of 10+ queries |
| — | Flow 35 integration test | **IN SCOPE** (Inc 6) | End-to-end verification of supplier manager daily experience |
| C34 deferred | Dashboard drill-down navigation | **Deferred to C36** | Requires dashboard-level filter propagation + breadcrumb UI; too complex for this cycle's focus |
| C34 deferred | Forecasting / projections | **Deferred to C36** | Needs stable daily consumption patterns first |
| C34 deferred | Pie charts | **Deferred** | Area + line + bar cover current supplier and inventory needs |
| C34 deferred | Chart interactivity (tooltips, zoom) | **Deferred** | Static SVG sufficient for daily consumption |
| C34 deferred | File-level dashboard (right-click CSV) | **Deferred** | Separate UX pattern; not part of daily routine |
| C34 deferred | Drag-and-drop tile reordering | **Deferred** | Move up/down + width toggle sufficient |
| Vault inbox | "Every analytics-able file has dashboard capabilities" | **Deferred** | Out of scope for daily experience focus |
| Vault inbox | "Quality Dashboard for Software Products" | **Deferred** | Meta domain, not supplier management |
| Vault inbox | "DX Hub Dashboard needs love" | **Deferred** | DX Hub, not Analytics Hub |
| Vault inbox | "How can analytics hub help providing vault insights" | **Deferred** | Vault insights is a separate scope from daily supplier workflow |
| Vault inbox | "Improve CSV integration with Analytics Hub" | **Partially addressed** | Inc 1 (CSV extraction) + Inc 4 (tile export) improve CSV as first-class citizen |
| Plugin inbox | "Easy dashboard from CSV" | **Partially addressed** | Inc 3 (Add to Dashboard) reduces friction; full "right-click CSV" remains deferred |
| TD-127 | Performance observability | **Deferred** | Infrastructure concern; doesn't serve daily supplier experience directly |
| C34 AI-2 | Extract expression evaluator | **Deferred** | Engine at 853 LOC, under 900 threshold — monitor |
| C34 AI-4 | DashboardTileRenderer component tests | **Monitor** | Will approach 700 LOC threshold this cycle; add tests if exceeded |
| IMP-34-3 | Auto-execute as opt-in setting | **Consider** | Note in Inc 5 as potential polish |

### Prioritization Criteria

1. **Daily consumption friction** — What blocks the Supplier Manager's morning dashboard routine? (highest)
2. **Creation flow efficiency** — What friction exists between "I have a query" and "it's on my dashboard"? (high)
3. **Infrastructure debt** — What scattered code creates maintenance risk for CSV-heavy workflows? (medium)
4. **Documentation & discoverability** — What helps the user maintain 10+ queries over time? (medium)

### Strategic Roadmap Update (Analytics Hub Cycles 35-37)

| Cycle | Theme | Key Deliverables |
|-------|-------|-----------------|
| **35 (this)** | Supplier Manager Daily Experience | Tile management, Add to Dashboard, tile export/drill, CSV extraction, query descriptions |
| **36 (next)** | Dashboard Drill-Down & Filtering | Dashboard-level filters, click-through drill-down, breadcrumbs, pie charts |
| **37 (future)** | Predictive Analytics | Forecasting (linear trend, rolling projection), anomaly detection, confidence ranges |

---

## Cycle Goals

1. **Tile Management** — Users can remove tiles and reconfigure them (change query, width, sparkline) through an expanded settings panel
2. **Query-to-Dashboard Bridge** — "Add to Dashboard" button in query results creates a tile on any dashboard with auto-suggested display mode
3. **Tile Actions** — Each tile offers CSV export (file download) and "View Query" navigation for anomaly investigation
4. **CSV Infrastructure** — Consolidated CSV utilities (`escapeCsvField`, `rowsToCsv`, `downloadCsvFile`) as shared module, replacing 6 scattered implementations (TD-126)
5. **Query Documentation** — Description field on saved queries captures intent ("What question does this query answer?")
6. **Integration Verification** — Flow 35 test covering full supplier manager daily experience (consume dashboard → investigate → export → create new view)

---

## Scope

### In Scope
- **TD-126 Phase 1-3** — Extract `escapeCsvField`, `rowsToCsv`, `downloadCsvFile` into `src/utils/csv.ts`; replace all call sites in QueriesTab, AnalyticsResultsPanel, session handlers
- **Tile remove button** — Trash icon in tile header actions, invoking the existing `onRemove` callback
- **Tile settings expansion** — Query selector dropdown, width toggle (1 col / 2 col), sparkline toggle (stat-card only); conditional formatting rules remain
- **3 new tile callbacks** — `onQueryChange`, `onWidthChange`, `onSparklineToggle` wired via existing `updateTile()` pattern
- **Add to Dashboard** — Button in QueriesTab results area (active when query is saved); dashboard picker with existing dashboards + "New Dashboard"; auto-suggested display mode
- **Tile CSV export** — Download icon in tile header; generates CSV from cached tile result via shared `downloadCsvFile`
- **View source query** — Icon in tile header; navigates to Queries tab with tile's query loaded + auto-executed
- **Query description field** — `description?: string` on `SavedAnalyticsQuery`; editable in save dialog and query detail view; shown in saved query list
- **Flow 35 integration test** — ~20 tests covering tile management, query-to-dashboard, tile actions, CSV utilities
- **Analytics Hub PRD update to v9** with new FRs (FR-61 through FR-67)

### Out of Scope
- Dashboard drill-down navigation — deferred to Cycle 36 (requires filter propagation + breadcrumbs)
- Dashboard-level filtering (supplier dropdown, date range) — deferred to Cycle 36
- Forecasting / projections — deferred to Cycle 37
- Pie charts — deferred
- Chart interactivity (tooltips, zoom) — static SVG sufficient
- File-level dashboard (right-click CSV → dashboard) — separate UX pattern
- Drag-and-drop tile reordering — move up/down + width toggle sufficient
- TD-127 Performance observability — infrastructure, not daily UX
- Expression evaluator extraction — AnalyticsEngine at 853 LOC, under 900 monitor threshold
- Auto-execute opt-in setting — consider as future polish
- .base source support in templates — CSV sources only
- Vault insights (analytics over vault notes) — different scope
- Quality Dashboard for Software Products — meta domain

---

## Increments

### Inc 1: TD-126 CSV Utilities Extraction (PBI-ANA-048)

**Goal:** Consolidate scattered CSV utilities into a shared module, eliminating duplication across 6 locations.

**Design:**

CSV parsing, generation, escaping, and file download logic is duplicated across multiple domains and UI layers. As CSV becomes a first-class data format in Flowti, this scatter creates maintenance risk and inconsistency.

**New shared module: `src/utils/csv.ts`**

```typescript
export function escapeCsvField(value: unknown): string;
export function rowsToCsv(columns: string[], rows: Record<string, unknown>[]): string;
export function downloadCsvFile(csv: string, filename: string): void;
```

- `escapeCsvField` — handles quoting, comma escaping, newline escaping. Single source of truth for CSV field safety.
- `rowsToCsv` — generates CSV string from column headers + row data. Uses `escapeCsvField` internally.
- `downloadCsvFile` — `Blob` + `URL.createObjectURL` + `<a download>` pattern for filesystem saves. Sanitizes filename.

**Call site replacement:**

| Current Location | Function | Action |
|-----------------|----------|--------|
| `src/ui/analytics/QueriesTab.ts` | `resultToCsv()`, `downloadCsv()` | Replace with imports from `csv.ts` |
| `src/ui/hub/AnalyticsResultsPanel.ts` | `generateCsv()`, `escapeCsvField()` | Replace with imports from `csv.ts` |
| `src/domain/dataExchange/CsvImportService.ts` | CSV parsing, delimiter detection | No change (parsing stays domain-specific; Phase 4 future) |
| `src/domain/analytics/AnalyticsService.ts` | `loadCsv()` | No change (parsing stays domain-specific; Phase 4 future) |

Phase 1-3 only: extract generation + escape + download. Phase 4 (parsing consolidation) deferred — `CsvImportService` and `AnalyticsService.loadCsv()` have different APIs and concerns.

| File | Action | ~LOC |
|------|--------|------|
| `src/utils/csv.ts` | **New** — shared CSV utilities | +40 |
| `src/ui/analytics/QueriesTab.ts` | Replace local implementations with imports | −30 |
| `src/ui/hub/AnalyticsResultsPanel.ts` | Replace local implementations with imports | −25 |

**AC:**
- [ ] `escapeCsvField` correctly handles commas, quotes, newlines, null/undefined
- [ ] `rowsToCsv` generates valid CSV string from column + row data
- [ ] `downloadCsvFile` triggers file download with sanitized filename
- [ ] All existing CSV call sites in QueriesTab and AnalyticsResultsPanel import from `csv.ts`
- [ ] No duplicate `escapeCsvField` or `generateCsv` implementations remain in replaced files
- [ ] All existing tests pass without modification
- [ ] `npm test` passes
- [ ] TD-126 updated to stage: resolved (Phase 1-3)

**Tests:** ~8 (3 escapeCsvField edge cases + 3 rowsToCsv + 2 downloadCsvFile)

---

### Inc 2: Tile Management — Remove & Reconfigure (PBI-ANA-049)

**Goal:** Enable users to remove tiles and reconfigure them (change query, width, sparkline) through an expanded settings panel.

**Design:**

This increment implements the plan from `reactive-cuddling-clover.md`. The tile header currently has: reorder (↑ ↓), display mode dropdown, refresh, settings gear. After this increment:

```
[↑] [↓] [mode ▼] [refresh] [gear] [trash]
```

**1. Add Remove Button to Tile Header (`DashboardTileRenderer.ts`)**

- Icon: `"trash-2"`, same 14×14px sizing as other action buttons
- Style: `ft-text-muted` (same as other actions), turns `var(--text-error)` on hover
- Click handler: `ctx.onRemove(ctx.tile.id)` — callback already exists and is wired

**2. Expand Settings Panel (`DashboardTileRenderer.ts`)**

When the gear icon is clicked and `settingsOpen` is true, render a full settings panel with sections:

**a) Query Selector** — change which saved query this tile uses
- Label: "Query"
- `<select>` dropdown listing all saved queries from context
- Current selection: `ctx.tile.queryId`
- On change: `ctx.onQueryChange(ctx.tile.id, newQueryId)` + clear tile cache

**b) Width Toggle** — switch tile between 1-column and 2-column span
- Label: "Width"
- Two buttons: "1 col" / "2 col" with active state styling
- Current: `ctx.tile.width` (1 or 2)
- On change: `ctx.onWidthChange(ctx.tile.id, newWidth)`

**c) Sparkline Toggle** — show/hide sparklines on stat-card tiles
- Only visible when `displayMode === "stat-card"`
- Checkbox: "Show sparklines"
- Current: `ctx.tile.showSparkline`
- On change: `ctx.onSparklineToggle(ctx.tile.id, show)`

**d) Conditional Formatting** — existing rule builder (unchanged)

**3. Wire New Callbacks in DashboardsTab.ts**

In the tile render context, add 3 new callbacks using the existing `updateTile` pattern:
- `onQueryChange`: calls `updateTile(dashboardId, tileId, { queryId: newQueryId })` + clears tile result cache + schedules re-render
- `onWidthChange`: calls `updateTile(dashboardId, tileId, { width: newWidth })` + schedules re-render
- `onSparklineToggle`: calls `updateTile(dashboardId, tileId, { showSparkline: show })` + schedules re-render

**4. Pass Query List to TileRenderContext**

Add `queries?: SavedAnalyticsQuery[]` to `TileRenderContext` so the settings panel can render the query dropdown without needing new deps.

| File | Action | ~LOC |
|------|--------|------|
| `src/ui/analytics/DashboardTileRenderer.ts` | Add remove button, expand settings panel, add 4 new optional fields to TileRenderContext | +120 |
| `src/ui/analytics/DashboardsTab.ts` | Wire 3 new callbacks, pass queries list | +25 |
| `src/ui/analytics/AnalyticsDashboardPage.ts` | Pass queries list to tile render context for homepage tiles | +5 |

**AC:**
- [ ] Trash icon visible in tile header after settings gear
- [ ] Clicking trash removes tile from dashboard (uses existing `onRemove`)
- [ ] Settings panel shows query selector with all saved queries
- [ ] Changing query updates tile data and clears cache
- [ ] Width toggle switches between 1-col and 2-col span
- [ ] Width change reflects in CSS grid layout immediately
- [ ] Sparkline toggle only visible for stat-card display mode
- [ ] Sparkline toggle persists via `updateTile` (uses existing TILE_MUTABLE_KEYS whitelist)
- [ ] Conditional formatting section remains unchanged
- [ ] Homepage tiles also get trash icon and expanded settings
- [ ] All existing tests pass without modification
- [ ] `npm test` passes

**Tests:** ~10 (2 remove button + 3 query change + 2 width toggle + 2 sparkline toggle + 1 settings panel render)

---

### Inc 3: Add to Dashboard from Query Results (PBI-ANA-050)

**Goal:** Enable users to add a query's results to any dashboard directly from the Queries tab, bridging the query → dashboard gap.

**Design:**

After a user builds, executes, and saves a query, an "Add to Dashboard" button appears in the results action area (alongside "Save As New" and "Save to CSV").

**Button placement in QueriesTab results area:**
```
[Save] [Save As New] [Save to CSV] [Add to Dashboard ▼]
```

**Interaction flow:**
1. User executes and saves a query → "Add to Dashboard" button becomes active
2. Click → dropdown menu with:
   - List of existing dashboards (name, tile count badge)
   - "Create New Dashboard" option at bottom (triggers existing dashboard creation flow)
3. User clicks a dashboard → tile is created with:
   - `queryId`: the active saved query ID
   - `displayMode`: auto-suggested based on result shape (see below)
   - `title`: query name
   - `width`: 1 (default)
   - `height`: 1 (default)
4. Success Notice: "Added [query name] to [dashboard name]"

**Auto-suggest display mode:**

| Result Shape | Suggested Mode | Rationale |
|-------------|---------------|-----------|
| ≤ 5 result rows, ≤ 3 columns | `stat-card` | Summary KPI view |
| Has time bucket dimension | `line-chart` | Time series trend |
| > 5 rows, no time bucket, 1 dimension | `bar-chart` | Category comparison |
| All other cases | `table` | Default fallback |

The suggestion is applied automatically (no picker needed). The user can change the mode later via the tile settings (Inc 2) or the existing display mode dropdown.

**Pre-condition:** The query must be saved (i.e., a `selectedQueryId` exists in state). If the query is unsaved, the button is disabled with a tooltip: "Save query first to add to a dashboard."

**Implementation:**
- `renderActions()` in QueriesTab: add "Add to Dashboard" button with dropdown
- `suggestDisplayMode(result)`: pure function analyzing result shape → TileDisplayMode
- Dashboard dropdown: reads `deps.getDashboards()` (or `deps.getAnalyticsService().listDashboards()`)
- Tile creation: calls `deps.getAnalyticsService().addTile(dashboardId, { ... })`

| File | Action | ~LOC |
|------|--------|------|
| `src/ui/analytics/QueriesTab.ts` | Add "Add to Dashboard" button + dropdown + auto-suggest | +70 |
| `src/ui/analytics/queries/types.ts` | Add `getDashboards` and `addTile` to QueriesSubDeps if needed | +5 |
| `src/utils/analytics.ts` or inline | `suggestDisplayMode()` pure function | +15 |

**AC:**
- [ ] "Add to Dashboard" button visible in query results actions when query is saved
- [ ] Button disabled with tooltip when query is unsaved
- [ ] Dropdown lists all existing dashboards with tile count
- [ ] "Create New Dashboard" option available in dropdown
- [ ] Clicking a dashboard creates a tile with correct queryId, auto-suggested displayMode, and query name as title
- [ ] Success Notice shown after tile creation
- [ ] Auto-suggest returns stat-card for small result sets, line-chart for time series, bar-chart for categorized data, table as fallback
- [ ] Created tile renders correctly on the target dashboard
- [ ] `npm test` passes

**Tests:** ~8 (4 suggestDisplayMode cases + 2 add tile flow + 1 unsaved query guard + 1 create new dashboard path)

---

### Inc 4: Dashboard Tile Actions — CSV Export & View Query (PBI-ANA-051)

**Goal:** Enable tile-level CSV export and navigation to the source query for anomaly investigation.

**Design:**

Two new action icons in each tile's header, after the existing actions:

```
[↑] [↓] [mode ▼] [refresh] [download] [external-link] [gear] [trash]
```

**1. Tile CSV Export (download icon)**

- Icon: `"download"`, 14×14px, `ft-text-muted`
- Click handler: generates CSV from the tile's cached query result using `rowsToCsv` (from Inc 1's `csv.ts`), then calls `downloadCsvFile` with tile title as filename
- Only active when the tile has a cached result (otherwise disabled)
- Sanitizes tile title for filename: replaces `[<>:"/\\|?*]` with `_`

**2. View Source Query (external-link icon)**

- Icon: `"external-link"`, 14×14px, `ft-text-muted`
- Click handler: `ctx.onViewQuery(ctx.tile.queryId)` — new callback
- Navigation flow:
  1. DashboardsTab receives `onViewQuery(queryId)`
  2. Sets state: `{ selectedQueryId: queryId }`
  3. Navigates to Queries tab via `this.navigateTo("queries")`
  4. QueriesTab detects new `selectedQueryId` via existing `lastLoadedQueryId` pattern
  5. Auto-loads and auto-executes the query (existing C34 behavior)
- The Supplier Manager can now click a concerning KPI → see full underlying data → add filters → export

**TileRenderContext extension:**
```typescript
onViewQuery?: (queryId: string) => void;
onExportCsv?: (tileId: string) => void;
```

| File | Action | ~LOC |
|------|--------|------|
| `src/ui/analytics/DashboardTileRenderer.ts` | Add download + external-link icons, wire handlers | +40 |
| `src/ui/analytics/DashboardsTab.ts` | Wire `onViewQuery` + `onExportCsv` callbacks, import csv utils | +30 |
| `src/ui/analytics/AnalyticsDashboardPage.ts` | Wire same callbacks for homepage tiles | +10 |

**AC:**
- [ ] Download icon visible in tile header (after refresh, before gear)
- [ ] Clicking download exports tile result as CSV file with tile title as filename
- [ ] Download disabled (greyed out) when tile has no cached result
- [ ] External-link icon visible in tile header
- [ ] Clicking external-link navigates to Queries tab with tile's query loaded and executed
- [ ] Query auto-load + auto-execute pattern (from C34) works correctly via the navigation
- [ ] Both icons work on homepage dashboard tiles (not just Dashboards tab)
- [ ] CSV export uses shared `rowsToCsv` and `downloadCsvFile` from `src/utils/csv.ts`
- [ ] `npm test` passes

**Tests:** ~6 (2 CSV export generation + 1 disabled state + 2 view query navigation + 1 filename sanitization)

---

### Inc 5: Query & Dashboard Polish (PBI-ANA-052)

**Goal:** Add query description field and small daily-use polish items.

**Design:**

**1. Query Description Field**

Add `description?: string` to `SavedAnalyticsQuery` in `types.ts`. The description answers: *"What question does this query answer?"*

UI integration:
- **Save dialog**: text input below query name — placeholder: "What question does this query answer?"
- **Query detail view**: description shown below query name in the detail panel header (muted text)
- **Saved query list**: description shown as subtitle below query name in master list
- **Tile settings**: query description visible next to query selector dropdown (helps choose the right query)

Persistence: saved alongside existing query fields via `saveQuery()`. Backward-compatible — existing queries have `undefined` description.

**2. Tile Row Count Badge**

In tile headers, show a small row count badge when the tile has cached results: "47 rows" in muted text. Helps the Supplier Manager quickly assess data volume without opening the query.

**3. Dashboard Last-Refreshed Indicator**

In the dashboard detail header (alongside dashboard name), show "Last refreshed: X min ago" based on the most recent tile execution timestamp. Uses `freshnessUtils.ts` for consistent time formatting.

| File | Action | ~LOC |
|------|--------|------|
| `src/domain/analytics/types.ts` | Add `description?: string` to SavedAnalyticsQuery | +1 |
| `src/domain/analytics/AnalyticsService.ts` | Pass description through save/update | +5 |
| `src/ui/analytics/QueriesTab.ts` | Description in save dialog + detail header + query list subtitle | +30 |
| `src/ui/analytics/DashboardTileRenderer.ts` | Row count badge in tile header | +10 |
| `src/ui/analytics/DashboardsTab.ts` | Last-refreshed indicator in dashboard header | +15 |

**AC:**
- [ ] `SavedAnalyticsQuery` has optional `description` field
- [ ] Save dialog shows description input below query name
- [ ] Description visible in query detail view header (muted)
- [ ] Description shown as subtitle in saved query master list
- [ ] Description visible in tile settings query selector area
- [ ] Existing queries without description display normally (backward-compatible)
- [ ] Tile header shows row count badge when cached result exists
- [ ] Dashboard header shows "Last refreshed: X min ago"
- [ ] `npm test` passes

**Tests:** ~5 (2 description persistence + 1 backward compat + 1 row count badge + 1 freshness indicator)

---

### Inc 6: Flow Test + PRD Update (PBI-ANA-053)

**Goal:** End-to-end flow test covering the full supplier manager daily experience and PRD update.

**Design:**

**Flow 35 test:** Supplier Manager Daily Experience workflow.

Test structure mirrors two user journeys:

**Journey A: Daily Consumption**
1. **Dashboard consumption** — load a dashboard with tiles, verify rendering
2. **Tile CSV export** — generate CSV from tile result, verify content matches query result
3. **View source query** — navigate from tile to query via `onViewQuery`, verify query loads
4. **Tile management** — remove a tile, verify dashboard updates; change tile query via settings, verify new data renders

**Journey B: Dashboard Creation**
5. **Query-to-dashboard** — save a query, click "Add to Dashboard" with auto-suggested display mode, verify tile created on target dashboard
6. **Display mode suggestion** — verify suggestDisplayMode logic for stat-card, line-chart, bar-chart, table cases
7. **Tile reconfiguration** — change width to 2-col, toggle sparkline, change query via settings panel
8. **Query description** — save query with description, verify description persists and displays

**Infrastructure**
9. **CSV utilities** — verify `escapeCsvField` handles edge cases (commas, quotes, newlines, null)
10. **CSV generation** — verify `rowsToCsv` produces valid CSV from column + row data

**Edge cases**
11. Add to Dashboard with unsaved query (should be blocked)
12. Export CSV from tile with no cached result (should be disabled)
13. View Query for deleted query (graceful fallback)
14. Remove last tile from dashboard (dashboard remains with empty state)

**PRD update:**
- Analytics Hub PRD v9
- Add FR-61 (tile remove button), FR-62 (tile settings expansion), FR-63 (Add to Dashboard from query results), FR-64 (tile CSV export), FR-65 (View source query from tile), FR-66 (query description field), FR-67 (CSV utilities consolidation)
- Update Data Model section with `description` field
- Update FRI score

| File | Action | ~LOC |
|------|--------|------|
| `tests/flows/35-SupplierManagerDaily.test.ts` | **New** — flow integration test | +200 |
| `docs/features/Analytics Hub/Analytics Hub PRD.md` | Update to v9 with FR-61 through FR-67 | ~30 lines |

**AC:**
- [ ] Flow 35 test passes (~20 tests covering both journeys)
- [ ] Daily consumption journey verified end-to-end (tiles → export → investigate → manage)
- [ ] Dashboard creation journey verified end-to-end (query → add to dashboard → configure)
- [ ] CSV utilities edge cases verified
- [ ] Edge cases handled (unsaved query guard, empty tile export, deleted query)
- [ ] Analytics Hub PRD updated to v9 with all new FRs
- [ ] `npm test` passes — all tests green

**Tests:** ~20 (6 consumption + 5 creation + 3 reconfiguration + 3 CSV utils + 3 edge cases)

---

## Dependency Graph

```
Inc 1 (CSV extraction — foundation)
  │
  ├── Inc 4 (tile export — uses csv.ts)
  │
Inc 2 (tile management — independent)
  │
  ├── Inc 3 (Add to Dashboard — uses updated tile settings concept)
  │
Inc 5 (query polish — independent)
  │
  └────all────┐
              v
         Inc 6 (flow test — needs all above)
```

**Execution order:** Inc 1 → Inc 2 → Inc 3 → Inc 4 → Inc 5 → Inc 6

Inc 1 should go first as it extracts the CSV infrastructure needed by Inc 4. Inc 2 before Inc 3 because tile management establishes the settings panel pattern that Inc 3's auto-suggest builds on. Inc 4 and Inc 5 are independent of each other but both benefit from Inc 1 and Inc 2 being complete. Inc 6 integrates all prior work.

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| DashboardTileRenderer exceeds 700 LOC threshold (AI-4) | Medium | Inc 2 adds ~120 LOC, pushing to ~720 LOC. If exceeded, note extraction candidates in retrospective. Settings panel sections are natural extraction boundaries. |
| "Add to Dashboard" dropdown UX with many dashboards (>10) | Low | Show first 8 dashboards + "More..." or scrollable container. Most users have 2-5 dashboards. |
| Auto-suggest display mode may not match user intent | Low | Suggestion is automatically applied but immediately changeable via mode dropdown or tile settings (Inc 2). No confirmation step needed. |
| CSV export for large tile results (>10k rows) may lag | Low | CSV generation is synchronous but fast for <10k rows. Consider async generation with loading indicator if profiling shows >200ms. |
| Query description field migration for existing queries | Low | Field is optional (`description?: string`). Existing queries render normally without it. No migration needed. |
| Tile "View Query" navigation may lose dashboard scroll position | Low | Standard tab navigation; user clicks browser/Obsidian back to return. Consider preserving dashboard state in future cycle. |
| DashboardsTab growing from callback wiring | Low | +25 LOC from new callbacks. DashboardsTab at ~505 LOC after, well under any threshold. |

---

## Success Metrics

| Metric | Target |
|--------|--------|
| New tests | ~45 (8 CSV + 10 tile mgmt + 8 Add to Dashboard + 6 tile actions + 5 polish + 8 UX buffer) |
| Post-cycle total tests | ~4,621 |
| New source LOC | ~350 (40 CSV utils + 150 tile mgmt + 90 Add to Dashboard + 80 tile actions + 60 polish − 55 dedup removal) |
| TD-126 resolution | Phase 1-3 resolved (generation + escape + download) |
| Tile actions | 4 existing → 8 (+ download, external-link, trash, expanded settings) |
| Analytics events | 21 (no new events — all actions use existing tile.updated / tile.removed) |
| SavedAnalyticsQuery fields | + `description` |
| PRD version | v8 → v9 |
| New FRs | FR-61 through FR-67 (7 new) |
| Supplier Management PRD gaps | §10 drill-down (lightweight via View Query), §10 CSV export (per-tile) |

---

## Deferred Items

| Item | Rationale | Target |
|------|-----------|--------|
| Dashboard drill-down navigation | Requires dashboard-level filter propagation + breadcrumb UI + column mapping across tiles | Cycle 36 |
| Dashboard-level filtering (supplier, date range) | Complex: each tile has independent queries; filter propagation needs cross-query column mapping | Cycle 36 |
| Forecasting / projections | Needs stable daily consumption patterns and complete data foundation first | Cycle 37 |
| Pie charts | Area + line + bar cover current supplier and inventory needs | Future |
| Chart interactivity (tooltips, zoom) | Static SVG sufficient for daily consumption | Future |
| File-level dashboard (right-click CSV) | Separate UX pattern; not part of daily routine | Future |
| Drag-and-drop tile reordering | Move up/down + width toggle sufficient | Future |
| TD-127 Performance observability | Infrastructure concern; not daily UX | Future |
| TD-126 Phase 4 (CSV parsing consolidation) | CsvImportService and AnalyticsService.loadCsv() have different APIs; consolidation needs design work | Future |
| Expression evaluator extraction | AnalyticsEngine at 853 LOC, under 900 monitor threshold | Monitor (AI-2) |
| DashboardTileRenderer component tests | Approaching 700 LOC threshold this cycle; extract if exceeded | Monitor (AI-4) |
| Auto-execute opt-in setting | Query auto-execute on load could be expensive for large datasets | Future (IMP-34-3) |
| Vault insights via analytics | Analytics over vault notes (not CSVs) is a different scope | Future |
| Quality Dashboard for Software Products | ISO 25010 governance; meta domain, not supplier management | Future |

---

## Definition of Done (Cycle)

### 1. All Increments Completed
- [ ] Each increment satisfies its own acceptance criteria
- [ ] No increment left in partial state
- [ ] Deferred items documented with rationale

### 2. Build & Test Quality
- [ ] `npm test` passes — all tests green
- [ ] `npm run check` passes (tsc + eslint clean)
- [ ] No test regressions on existing 4,576 tests
- [ ] Flow 35 integration test passes

### 3. Three Amigos Review
- [ ] Cycle-level review conducted
- [ ] All three perspectives represented
- [ ] TASM scores recorded

### 4. PRD & Backlog Updates
- [ ] Analytics Hub PRD updated to v9 with FRs 61-67
- [ ] PBIs created and tracked (ANA-048 through ANA-053)
- [ ] TD-126 Phase 1-3 marked resolved

### 5. Supplier Manager Validation
- [ ] Daily consumption journey verified manually (dashboard → investigate → export)
- [ ] Dashboard creation journey verified manually (query → Add to Dashboard → configure)
- [ ] Tile management verified manually (remove, change query, change width, toggle sparkline)

### 6. Cycle Plan Completion
- [ ] Frontmatter updated (stage: delivered, date_completed, actual values)
- [ ] Deviations documented
- [ ] Learnings captured

---

## Verification

1. **DoR phase**: All docs created (cycle doc, 6 PBIs, PRD v9 scope)
2. `npm test` — all tests pass after each increment
3. Manual: Open Analytics Hub → verify tile trash icon removes a tile
4. Manual: Open tile settings → change query, width, sparkline → verify changes persist
5. Manual: Execute a saved query → click "Add to Dashboard" → select dashboard → verify tile appears
6. Manual: Click download icon on a tile → verify CSV file downloads with correct data
7. Manual: Click external-link icon on a tile → verify Queries tab opens with correct query loaded and executed
8. Manual: Save a query with description → verify description appears in query list and detail view
9. Manual: Full morning routine — open dashboard → scan KPIs → notice anomaly → click tile → investigate → export → done
10. Flow 35 integration test covers the full supplier manager daily experience workflow
