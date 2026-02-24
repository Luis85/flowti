---
type: DevelopmentCycle
feature: "[[Analytics Hub PRD]]"
stage: delivered
cycle: 33
date_planned: 2026-02-24
date_completed: 2026-02-24
pbis:
  - "[[PBI-ANA-035 Trend Calculation Engine]]"
  - "[[PBI-ANA-036 Expression Functions]]"
  - "[[PBI-ANA-037 Conditional Formatting Rule Builder UI]]"
  - "[[PBI-ANA-038 Analytics Hub Homepage Polish]]"
  - "[[PBI-ANA-039 Trend Intelligence Flow Test]]"
  - "[[PBI-ANA-040 Analytics UX Sprint]]"
bugs: []
bugs_fixed_precycle: []
tech_debt: []
estimated_increments: 5
actual_increments: 8
estimated_tests: 68
actual_tests: 88
pre_cycle_tests: 4461
pre_cycle_suites: 184
post_cycle_tests: 4549
post_cycle_suites: 188
---

# Cycle 33 — Trend Intelligence

## Cycle Overview

**User Story:**

> As a Supplier Manager receiving daily CSV reports, I want to see month-over-month cost changes, rolling averages, and formatted KPIs on my dashboard, with the ability to configure conditional rules visually, so that I can identify trends and anomalies without manual calculation.

**User Pains:**
- Dashboard shows raw aggregated values but no period-over-period comparison — the Supplier Manager must mentally compute "did cost go up?"
- No MoM %, no rolling averages, no change indicators — trend visibility is zero despite line charts being available since Cycle 32
- Computed columns only support basic arithmetic (`+`, `-`, `*`, `/`) — no rounding for clean KPIs, no conditional logic for classification
- Conditional formatting rules exist in the type system (Cycle 32) but have no UI to configure them — rules can only be set programmatically (DEV-2 from Cycle 32)
- Analytics Hub homepage doesn't surface pinned dashboards — the Supplier Manager must navigate two clicks to reach their daily KPIs
- Saved queries are listed below source files in QueriesTab — frequent users waste time scrolling past sources they rarely change

**User Needs:**
- Trend functions: MoM change, % change, rolling averages on any numeric column
- Expression functions: ROUND for clean numbers, ABS for deltas, IF for conditional classification
- Visual rule builder: configure threshold-based conditional formatting per tile without code
- Homepage: pin dashboards for zero-click access to daily metrics, queries above sources

**Business Trigger:** Cycle 32 delivered the visualization layer (charts, sparklines, conditional formatting engine). The Supplier Manager can now *see* data visually, but cannot yet *interpret* it — trend calculations and formatted KPIs are the missing bridge between raw visualization and actionable intelligence.

---

## Situation Assessment

### Pre-Cycle State (post-Cycle 32)

**Plugin health:**
- 4,461 tests passing, 184 test suites
- Build status: green (`npm test` + `npm run check` clean)
- Cycle 32 completed — Visualization Sprint delivered (SVG charts, conditional formatting engine, sparklines, QueriesTab extraction)
- No pre-cycle bug fixes needed

**Analytics domain status:**
- Domain: ~2,480 LOC (AnalyticsEngine 573, AnalyticsService 592, types 319+, events 139, support modules 257, conditionalFormatting 50)
- UI: ~3,550 LOC (AnalyticsHubView 309, QueriesTab 589, 6 sub-components ~960, DashboardsTab 436, DashboardTileRenderer 254+, ChartRenderer 267, other ~735)
- Tests: ~280 analytics-specific across domain + flow + UI suites
- Events: 19 (no new events expected this cycle)
- PRD: v6, FRI 31/35, 42 FRs all delivered

**Key capability gaps (addressed in this cycle):**
1. No trend/window functions — can see charts but not period-over-period changes (deferred 1 cycle)
2. No expression functions — ROUND, ABS, IF deferred from Cycle 31 (deferred 2 cycles)
3. No conditional formatting UI — type + evaluator delivered in C32 but rule builder UI deferred (DEV-2)
4. Homepage underserves daily workflow — no pinned dashboards, queries buried below sources

**Open action items from previous cycles:**
- DEV-2 (C32): Conditional formatting rule builder UI deferred
- Deferred (C31→C32→C33): Expression functions (ROUND, ABS, IF)
- Deferred (C32→C33): Trend calculations (MoM, PCT_CHANGE, rolling avg)
- Inbox (2026-02-24): "Better navigation on Analytics Hub Homepage"
- Inbox (2026-02-24): "Add up to three dashboards to the analytics hub homepage"
- Inbox (2026-02-24): "Saved queries above Query Sources on the Queries List view"

**Key files (current state):**
- `src/domain/analytics/AnalyticsEngine.ts` (573 LOC) — query execution engine, will add trend functions
- `src/domain/analytics/types.ts` (319+ LOC) — ComputedColumn + ConditionalRule types, will extend
- `src/domain/analytics/conditionalFormatting.ts` (~50 LOC) — evaluateConditionalRules, resolveColor
- `src/ui/analytics/DashboardsTab.ts` (436 LOC) — tile configuration UI, will add rule builder
- `src/ui/analytics/queries/SavedQueryList.ts` (~150 LOC) — query list ordering
- `src/ui/AnalyticsHubView.ts` (309 LOC) — hub homepage, will add dashboard pinning

---

## Backlog Refinement Notes

### Session Date: 2026-02-24

### Inputs Analyzed

1. **Vault inbox** — 343 items reviewed; 6 analytics-relevant items identified (4 from today)
2. **Plugin inbox** — 152 items reviewed; Supplier Management PRD re-analyzed against current capabilities
3. **Cycle 32 deferred items** — Trend calculations, expression functions, formatting UI, drill-down
4. **Cycle 32 deviations** — DEV-2 (formatting UI deferred), DEV-1 (QueriesTab larger than target)
5. **Supplier Management PRD** — Core KPI Questions §6.1–6.5 gap analysis
6. **Analytics Hub PRD v6** — 42 FRs delivered, v7 scope to be defined

### Items Analyzed

| Source | Item | Decision | Rationale |
|--------|------|----------|-----------|
| C32 deferred | Trend calculations (MoM, rolling avg) | **IN SCOPE** (Inc 1) | #1 Supplier Manager need: "How did cost change MoM?" |
| C31→C32 deferred | Expression functions (ROUND, ABS, IF) | **IN SCOPE** (Inc 2) | 2-cycle deferral; enables formatted KPIs and conditional classification |
| C32 DEV-2 | Conditional formatting rule builder UI | **IN SCOPE** (Inc 3) | Completes C32 incomplete work; Supplier Manager needs visual rule config |
| Vault inbox (today) | "Better navigation on Analytics Hub Homepage" | **IN SCOPE** (Inc 4) | Daily workflow friction for Supplier Manager |
| Vault inbox (today) | "Add up to three dashboards to homepage" | **IN SCOPE** (Inc 4) | Zero-click dashboard access for daily KPIs |
| Vault inbox (today) | "Saved queries above sources in Queries list" | **IN SCOPE** (Inc 4) | Frequent-user UX improvement |
| Vault inbox (today) | "Put one Analytics Dashboard on User Hub Homepage" | **Deferred** | Cross-hub widget; separate scope from Analytics Hub internals |
| Vault inbox | "Merge timestamped CSV files before analyzing" | **Deferred** | Data Exchange domain concern, not analytics engine |
| Vault inbox | "Every analytics-able file has dashboard capabilities" | **Deferred** | Right-click → dashboard is a file-menu pattern; future UX convenience |
| C32 deferred | Dashboard drill-down navigation | **Deferred → C34** | Complex navigation pattern; better paired with Supplier Dashboard template |
| C32 deferred | Chart interactivity (tooltips, zoom) | **Deferred** | Static SVG sufficient; not a Supplier Manager blocker |
| C32 deferred | Area charts, pie charts | **Deferred → C34** | Line + bar cover current needs; area for inventory trend in C34 |
| Plugin inbox | Meeting Notes PRD | **Deferred** | Session domain, not analytics |
| Plugin inbox | Pipeline multi-source merge (RB-7) | **Deferred** | DX pipeline scope |

### Prioritization Criteria

1. **Supplier Manager daily workflow** — What does the Supplier Manager need to open the hub, see trends, and make decisions in <30 seconds? (highest)
2. **Multi-cycle deferral** — Expression functions deferred 2 cycles; trend calculations deferred 1 cycle (high)
3. **Cycle 32 incomplete work** — DEV-2 formatting UI is unfinished feature, not a new request (high)
4. **Fresh user feedback** — 4 inbox items from today signal active pain points (medium)
5. **Foundation for Cycle 34** — Trends + expressions are prerequisites for Supplier Dashboard template (medium)

### Strategic Roadmap Update (Analytics Hub Cycles 33-35)

| Cycle | Theme | Key Deliverables |
|-------|-------|-----------------|
| **33 (this)** | Trend Intelligence | Trend calculations, expression functions, formatting rule builder UI, homepage polish |
| **34 (next)** | Supplier Dashboard | Dashboard drill-down, area charts, pre-built supplier template, User Hub dashboard widget |
| **35 (future)** | Predictive Analytics | Forecasting (linear trend, rolling projection), anomaly detection, confidence ranges |

---

## Cycle Goals

1. **Trend Calculation Engine** — MoM change, PCT_CHANGE, ROLLING_AVG as computed column functions (enables Supplier PRD §6.1 "MoM Cost Change %", §6.5 "Rolling averages")
2. **Expression Functions** — ROUND, ABS, IF in computed column formula engine (enables formatted KPIs and conditional classification)
3. **Conditional Formatting Rule Builder** — Visual UI to add/edit/remove conditional rules per tile (completes C32 DEV-2)
4. **Analytics Hub Homepage Polish** — Pin dashboards to homepage, queries above sources, better navigation (optimizes Supplier Manager daily workflow)
5. **Integration Verification** — Flow 33 test covering trend calculation + formatting workflow

---

## Scope

### In Scope
- **Function call parser** for `evaluateExpression()` — current evaluator only handles `{Column} + arithmetic`; must be extended to recognize `FUNCTION(args)` syntax (shared foundation for Inc 1 + Inc 2)
- New **window functions**: `CHANGE()`, `PCT_CHANGE()`, `ROLLING_AVG(n)` — operate on ordered result set, evaluated in a second pass after per-row expressions
- New **scalar functions**: `ROUND(value, decimals)`, `ABS(value)`, `IF(condition, then, else)` — evaluated per-row in first pass
- **Three-tier evaluator**: arithmetic → scalar functions → window functions (pipeline order)
- **IF() returns `string | number`** — broadens computed column contract from always-numeric to mixed type; table cells and stat-cards must handle string values from computed columns
- **Function reference help** in ComputedColumnsSection — tooltip or collapsible info showing available functions with syntax examples
- Conditional formatting **rule builder UI** — new collapsible settings panel below each tile in DashboardsTab (no tile settings area exists today — all controls are inline in header bar)
- Rule builder: column dropdown (including computed columns), operator dropdown, threshold input, color preset picker, remove per rule
- Analytics Hub **homepage dashboard pinning** — `pinnedDashboardIds` on AnalyticsState; coexists with `defaultDashboardId` (pinned shows compact previews above default dashboard or fallback stats)
- QueriesTab master list: saved queries section above source files section; collapsible sources
- Analytics Hub PRD update to v7 with new FRs (FR-43 through FR-51)
- Flow 33 integration test

### Out of Scope
- Dashboard drill-down navigation — deferred to Cycle 34 (requires filter propagation + breadcrumbs)
- Area charts, pie charts — deferred to Cycle 34 (inventory trend visualization)
- Chart interactivity (tooltips, zoom) — static SVG sufficient
- User Hub dashboard widget — cross-hub concern, deferred to Cycle 34
- CSV file merging — Data Exchange domain concern
- Forecasting / projections — deferred to Cycle 35
- Auto-refresh polling — manual refresh works
- Dashboard templates / presets — deferred to Cycle 34
- AND/OR compound conditions in IF — single condition in v1; nested `IF(IF(...))` workaround exists

---

## Increments

### Inc 1: Trend Calculation Engine (PBI-ANA-035)

**Goal:** Build function call parser and add trend window functions for period-over-period analysis.

**Design:**

**Foundation: Function Call Parser**
- The current `evaluateExpression()` in AnalyticsEngine.ts uses `tokenizeArithmetic()` which only recognizes `{Column Label}`, numbers, and `+`, `-`, `*`, `/` operators. It has no concept of function calls.
- Build a function call recognizer that detects `FUNCTION_NAME(args)` patterns in expressions
- Parser must handle: `CHANGE({Cost})`, `PCT_CHANGE({Revenue})`, `ROLLING_AVG({Sales}, 3)`
- Parser must also handle nesting for future use: `ROUND(PCT_CHANGE({Cost}), 1)` (Inc 2 will add scalar functions)
- Function call tokens are extracted before arithmetic tokenization; the result is substituted back as a value

**Window Functions (second-pass evaluation)**
- `CHANGE({column})` → `currentValue - previousValue` (null for first row)
- `PCT_CHANGE({column})` → `((current - previous) / previous) * 100` (null for first row, zero-division → null)
- `ROLLING_AVG({column}, n)` → rolling average of last `n` values including current; partial window for first `n-1` rows
- Window functions operate on **aggregated** result rows in natural ORDER BY order
- Detection: after first-pass (per-row) evaluation, scan computed columns for window function tokens → execute second pass with full result set context
- Null values in result rows are rendered as `"—"` by DashboardTileRenderer (existing null handling)

**Three-tier evaluation pipeline (established in this increment):**
1. Per-row: arithmetic (`+`, `-`, `*`, `/`) — existing
2. Per-row: scalar functions (`ROUND`, `ABS`, `IF`) — Inc 2 will add these
3. Full-set: window functions (`CHANGE`, `PCT_CHANGE`, `ROLLING_AVG`) — this increment

| File | Action | ~LOC |
|------|--------|------|
| `src/domain/analytics/AnalyticsEngine.ts` | Add function call parser + window evaluation pass | +140 |
| `src/domain/analytics/types.ts` | Add `FunctionToken` type, document function signatures | +20 |
| `src/domain/analytics/trendCalculations.ts` | **New** — pure window function implementations (CHANGE, PCT_CHANGE, ROLLING_AVG) | +100 |

**AC:**
- [ ] Function call parser recognizes `FUNCTION_NAME(args)` in expressions
- [ ] `CHANGE({column})` computes absolute difference from previous row
- [ ] `PCT_CHANGE({column})` computes percentage change from previous row
- [ ] `ROLLING_AVG({column}, 3)` computes 3-period rolling average
- [ ] Window functions return null for insufficient data points (first row for CHANGE/PCT_CHANGE)
- [ ] Zero-division in PCT_CHANGE returns null (not Infinity)
- [ ] Window functions work alongside standard arithmetic: `{Revenue} - CHANGE({Cost})`
- [ ] Parser handles nested function calls (prepared for Inc 2 scalar functions)
- [ ] Existing computed column tests pass without modification
- [ ] `npm test` passes

**Tests:** ~22 (4 parser + 6 CHANGE + 6 PCT_CHANGE + 3 ROLLING_AVG + 3 edge cases)

---

### Inc 2: Expression Functions — ROUND, ABS, IF (PBI-ANA-036)

**Goal:** Extend the computed column formula engine with scalar formatting and conditional logic functions.

**Design:**

**Scalar Functions (first-pass, per-row evaluation)**
- Uses the function call parser built in Inc 1 — scalar functions are registered alongside window functions but evaluated in pass 1 (per-row), not pass 2 (full-set)
- New functions:
  - `ROUND({column}, decimals)` → rounds numeric value to specified decimal places; `ROUND({Margin}, 2)` → `23.47`
  - `ABS({column})` → returns absolute value; `ABS({Change})` → always positive
  - `IF({column} > threshold, thenValue, elseValue)` → conditional: `IF({Margin} < 10, "Low", "OK")`
- IF condition supports: `>`, `<`, `>=`, `<=`, `=`, `!=` operators
- IF then/else values: numeric literals, string literals (double-quoted), or column references

**Contract Change: Computed columns become `string | number`**
- Currently `evaluateExpression()` returns `number`. IF() returning `"Low"` or `"OK"` broadens this to `string | number`
- Impact assessment:
  - `applyComputedColumns()` stores result in `ResultRow` (already `Record<string, string | number>`) — **no change needed**
  - Table rendering: cells already handle strings — **no change needed**
  - Stat-card rendering: displays value via string interpolation — **no change needed**
  - Conditional formatting: `evaluateConditionalRules` expects `number` — **skip** string-valued computed columns for rule evaluation (conditional rules only apply to numeric values)
  - Chart rendering: `extractChartData` parses values as numbers — string values are excluded from chart axes (shown in tooltip or legend label)
- Decision: IF returns `string | number`; this is the most useful design for the Supplier Manager persona (e.g., `IF({Margin} < 10, "Low", "OK")`)

**Function Reference Help**
- Add collapsible "Available Functions" info section in ComputedColumnsSection
- Shows: `CHANGE({col})`, `PCT_CHANGE({col})`, `ROLLING_AVG({col}, n)`, `ROUND({col}, n)`, `ABS({col})`, `IF({col} op n, then, else)` with one-line descriptions
- Collapsed by default; toggle via "?" help icon next to "Add Computed Column" button

**Nesting:** inner functions evaluate first — `ROUND(PCT_CHANGE({Cost}), 1)` → PCT_CHANGE computed in pass 2, then ROUND applied. Parser resolves inside-out.

| File | Action | ~LOC |
|------|--------|------|
| `src/domain/analytics/AnalyticsEngine.ts` | Register scalar functions in evaluator pipeline | +60 |
| `src/domain/analytics/expressionFunctions.ts` | **New** — ROUND, ABS, IF implementations | +110 |
| `src/domain/analytics/types.ts` | Update evaluateExpression return type to `string \| number` | +5 |
| `src/ui/analytics/queries/ComputedColumnsSection.ts` | Add function reference help section | +35 |

**AC:**
- [ ] `ROUND({column}, N)` rounds values to N decimal places
- [ ] `ABS({column})` returns absolute value of negative numbers
- [ ] `IF({column} > N, "High", "Low")` returns conditional string values
- [ ] `IF({column} >= N, {otherColumn}, 0)` supports column references in then/else
- [ ] Nested expressions work: `ROUND(PCT_CHANGE({Cost}), 1)` → `2.3`
- [ ] `evaluateExpression` return type is `string | number`
- [ ] String-valued computed columns display correctly in tables and stat-cards
- [ ] Conditional formatting rules skip string-valued columns gracefully
- [ ] Function reference help shows all 6 available functions with syntax
- [ ] Invalid function names produce clear error message (not silent failure)
- [ ] Existing computed column and trend calculation tests pass
- [ ] `npm test` passes

**Tests:** ~18 (5 ROUND + 4 ABS + 6 IF + 3 nesting/contract/edge cases)

---

### Inc 3: Conditional Formatting Rule Builder UI (PBI-ANA-037)

**Goal:** Provide a visual UI for adding, editing, and removing conditional formatting rules per tile.

**Design:**

**Current state:** DashboardsTab renders tiles with an inline header bar containing: title, freshness badge, mode toggle, move buttons, refresh, remove. There is **no tile settings area** — all controls are in the header bar. The conditional formatting type system exists (`ConditionalRule` type, `evaluateConditionalRules()`, `resolveColor()`) from Cycle 32, but there is no UI to configure rules (DEV-2).

**New pattern: Collapsible Tile Settings Panel**
- Add a gear icon (⚙) to the tile header bar → toggles a collapsible settings panel below the tile header, above the tile body
- Settings panel contains the "Formatting Rules" section
- Panel slides open/closed with CSS transition (consistent with existing collapsible patterns in QueriesTab)
- This pattern is extensible for future per-tile settings (axis config, custom labels, etc.)

**Formatting Rules Section:**
- "Add Rule" button → appends new rule row
- Per rule row:
  - Column dropdown — populated from the tile's query result columns **including computed columns** (important: if a computed column like `PCT_CHANGE({Cost})` exists, it must appear in the dropdown so users can color-code trend values)
  - Operator dropdown: `>`, `<`, `>=`, `<=`, `=`, `!=`
  - Threshold number input
  - Color preset picker: 3 buttons (green ✓ = positive, red ✗ = negative, amber ⚠ = warning) + text input for custom CSS color
  - Remove (×) button
- Rules ordered top-to-bottom = evaluation priority (first match wins)
- Changes persist immediately via `analytics.dashboard.tile.updated` event (existing)

**Visual Indicators:**
- Tile header: small colored dot when tile has ≥1 conditional rule configured
- Gear icon gets a subtle highlight when settings panel is open

| File | Action | ~LOC |
|------|--------|------|
| `src/ui/analytics/DashboardsTab.ts` | Add gear icon + collapsible settings panel + formatting rules section | +120 |
| `src/ui/analytics/DashboardTileRenderer.ts` | Add conditional rule indicator dot in tile header | +10 |

**AC:**
- [ ] Tile header shows gear icon that toggles a collapsible settings panel
- [ ] Settings panel contains "Formatting Rules" section with "Add Rule" button
- [ ] Rule row renders: column dropdown (including computed columns), operator dropdown, threshold input, color picker
- [ ] User can add multiple rules per tile
- [ ] User can remove individual rules via × button
- [ ] Color preset buttons set positive/negative/warning; custom input accepts CSS color strings
- [ ] Rules persist in tile configuration (survive hub close/reopen)
- [ ] Configured rules apply immediately on tile render (evaluateConditionalRules wired)
- [ ] Tile header shows colored indicator dot when rules are configured
- [ ] String-valued computed columns excluded from column dropdown (rules only apply to numeric columns)
- [ ] `npm test` passes

**Tests:** ~8 (3 rule builder rendering + 2 persistence + 2 integration with evaluator + 1 computed column dropdown)

---

### Inc 4: Analytics Hub Homepage & Queries UX Polish (PBI-ANA-038)

**Goal:** Optimize the Supplier Manager's daily workflow by pinning dashboards to homepage and improving query list navigation.

**Design:**

**Current state:** The homepage is rendered by `AnalyticsDashboardPage.ts` (312 LOC). When a default dashboard exists, it renders all tiles in a 2-column CSS grid. When no default exists, it shows stats + "Set a default dashboard" prompt. Below the dashboard or fallback, it renders a Favorites section and a Recent Sources section.

**Homepage dashboard pinning (coexists with default):**
- Add `pinnedDashboardIds?: string[]` to `AnalyticsState` (max 3)
- Relationship: `defaultDashboardId` renders the full dashboard with all tiles. `pinnedDashboardIds` renders compact summary cards **above** the default dashboard. Both can coexist.
- Pin UI: pin icon per dashboard row in DashboardsTab. Filled pin = pinned. Click to toggle.
- Homepage rendering (in AnalyticsDashboardPage):
  - **Pinned section** (top): horizontal row of 1-3 compact dashboard cards. Each card shows: dashboard name, tile count, 1-2 stat values from first tile. Click → navigates to that dashboard.
  - **Default dashboard** (middle): full tile grid as today
  - **Favorites + Recent Sources** (bottom): unchanged
- Falls back to current behavior when no pinned dashboards

**Queries above sources:**
- `SavedQueryList.ts` currently renders sources and queries interleaved. Refactor to:
  - **"Saved Queries" section** (top) — existing star icons, CRUD actions, query count header
  - **"Sources" section** (bottom) — collapsible via toggle arrow, defaults to collapsed when ≥1 saved query exists
- This ensures the Supplier Manager sees their saved "Cost Analysis" and "Revenue Trends" queries immediately, without scrolling past CSV file listings

**Navigation polish:**
- "Open in Queries" action on dashboard tile header → navigates to Queries tab with the tile's source query pre-selected via `navigateTo("queries")` + query context

| File | Action | ~LOC |
|------|--------|------|
| `src/ui/analytics/AnalyticsDashboardPage.ts` | Render pinned dashboard cards above default dashboard | +60 |
| `src/domain/analytics/types.ts` | Add `pinnedDashboardIds` to AnalyticsState | +3 |
| `src/domain/analytics/AnalyticsService.ts` | pinDashboard/unpinDashboard methods + persist | +30 |
| `src/ui/analytics/DashboardsTab.ts` | Pin icon action in dashboard list | +20 |
| `src/ui/analytics/queries/SavedQueryList.ts` | Reorder: queries above sources, collapsible sources section | +40 |

**AC:**
- [ ] User can pin up to 3 dashboards to the homepage via pin icon action
- [ ] Pinned dashboards render as compact summary cards above default dashboard on homepage
- [ ] Unpinning removes dashboard card from homepage
- [ ] Pinned and default dashboard coexist (pinned = compact cards, default = full tiles)
- [ ] Pin state persists in AnalyticsState
- [ ] Saved queries section appears above sources section in QueriesTab master list
- [ ] Sources section is collapsible and defaults to collapsed when saved queries exist
- [ ] "Open in Queries" action on tile header navigates to Queries tab
- [ ] `npm test` passes

**Tests:** ~8 (3 pin/unpin service + 2 homepage rendering + 3 query list ordering)

---

### Inc 5: Flow Test + PRD Update (PBI-ANA-039)

**Goal:** End-to-end flow test, PRD update, final verification.

**Design:**
- Flow 33 test: Trend Intelligence workflow
  - Create query → execute → add computed column with PCT_CHANGE → verify trend values
  - Add computed column with ROUND + IF → verify formatted output
  - Create dashboard → add tile → configure conditional rules via existing API → verify color application
  - Pin dashboard → verify homepage rendering
  - Toggle queries list → verify saved queries above sources
  - Edge cases: empty result, single row (null trends), zero-division
- Analytics Hub PRD update to v7:
  - Add FR-43 through FR-50 (trend functions, expression functions, formatting UI, homepage pinning, query ordering)
  - Update Data Model section with new types
  - Update FRI score
- Fix any stale references from C32 (if found)

| File | Action | ~LOC |
|------|--------|------|
| `tests/flows/33-TrendIntelligence.test.ts` | **New** — flow integration test | +130 |
| `docs/features/Analytics Hub/Analytics Hub PRD.md` | Update to v7 with FR-43–FR-50 | ~30 lines |

**AC:**
- [ ] Flow 33 test passes (~12 tests covering trend + formatting + homepage workflow)
- [ ] CHANGE, PCT_CHANGE, ROLLING_AVG produce correct values in flow context
- [ ] ROUND, ABS, IF produce correct values in flow context
- [ ] Conditional rules apply colors in flow context
- [ ] Pinned dashboard renders on homepage in flow context
- [ ] Edge cases handled (null for first row, zero-division)
- [ ] Analytics Hub PRD updated to v7 with all new FRs checked
- [ ] `npm test` passes — all tests green

**Tests:** ~12 (3 trend calculations + 3 expression functions + 2 conditional formatting + 2 homepage + 2 edge cases)

---

### Inc 6: Query Results UX Sprint (PBI-ANA-040)

**Goal:** Rapid iterative UX polish on query results, charts, and the query builder driven by manual testing feedback.

**Changes delivered:**
- **Chart date sorting** — time-bucketed chart data now sorted chronologically instead of alphabetically
- **Source overflow fix** — long source file paths no longer break QueriesTab layout
- **Scroll preservation** — query list scroll position preserved across re-renders
- **Results-first layout** — query results section renders above the query builder panel for immediate feedback
- **Computed column resolution** — computed columns correctly resolved against aggregated result rows
- **Raw column passthrough** — non-aggregated columns pass through to results when no grouping applied
- **Totals row** — aggregate summary row appended to table results
- **Preview toggle** — toggle between table and chart preview in query builder
- **Multi-series charts** — line/bar charts support multiple numeric columns as separate series with color differentiation
- **Computed columns always visible** — computed column values shown in results even when not explicitly selected
- **Active query name** — selected query name displayed in results header
- **Charts full width** — chart SVGs span full container width instead of fixed 600px
- **Value column selector** — dropdown to select which numeric column drives chart visualization in query builder

**Tests:** ~8 incremental fixes verified via existing test suite
**AC:** All changes verified via `npm test` — no regressions

---

### Inc 7: Dashboard Tile Enhancement (PBI-ANA-040)

**Goal:** Extend dashboard tiles with value column selection and redesigned table KPI display.

**Changes delivered:**
- **Value column selector for tiles** — `chartValueColumn?: string` added to `DashboardTile` type; dropdown rendered on chart tiles in both DashboardsTab and AnalyticsDashboardPage
- **Chart value column persistence fix** — `AnalyticsService.updateTile()` was missing explicit `chartValueColumn` property assignment, causing selection to silently revert on re-render
- **Table tile KPI redesign** — replaced metadata stat cards (Result Rows, Groups, Source Rows) with actual aggregate values (column sums) displayed as compact stat card grid above the data table; removed `AnalyticsResultsPanel` dependency from `DashboardTileRenderer`

| File | Change |
|------|--------|
| `src/domain/analytics/types.ts` | Added `chartValueColumn?: string` to `DashboardTile` |
| `src/domain/analytics/AnalyticsService.ts` | Added `chartValueColumn` to explicit property assignment in `updateTile()` |
| `src/ui/analytics/DashboardTileRenderer.ts` | `renderChartWithSelector()`, redesigned `renderTable()`, removed `AnalyticsResultsPanel` import |
| `src/ui/analytics/DashboardsTab.ts` | Wired `onChartValueColumnChange` callback |
| `src/ui/analytics/AnalyticsDashboardPage.ts` | Wired `onChartValueColumnChange` callback for homepage tiles |

**Tests:** ~4 incremental fixes verified via existing test suite
**AC:** All changes verified via `npm test` — no regressions

---

### Inc 8: Analytics Hub Homepage Polish (PBI-ANA-040)

**Goal:** Optimize the Analytics Hub homepage layout for daily workflow efficiency.

**Changes delivered:**
- **Favorites on top** — favorites section moved to first position in render order (above pinned dashboards)
- **Favorites headline removed** — compact card grid without header text or count badge
- **Favorites navigation fix** — clicking a favorite now triggers `scheduleRender()` to open the detail page immediately
- **Spacing polish** — favorites row bottom margin increased to 1.25rem; tile grid gap increased to 1rem in both DashboardsTab and AnalyticsDashboardPage
- **Remove X button** — removed misleading unconditional remove button from tile headers
- **Dashboard description** — default dashboard description rendered below title on homepage
- **Editable dashboard name** — replaced static `<span>` with inline `<input>` for dashboard title editing on homepage
- **Time bucket column ordering** — time dimension column now appears first in AnalyticsEngine result columns when query uses time bucketing
- **Table tile border cleanup** — removed `borderBottom` separator between KPI grid and data table

| File | Change |
|------|--------|
| `src/ui/analytics/AnalyticsDashboardPage.ts` | Favorites on top, no headline, editable name, description, spacing |
| `src/ui/analytics/DashboardTileRenderer.ts` | Removed X button, cleaned KPI/table border |
| `src/ui/analytics/DashboardsTab.ts` | Increased tile grid gap |
| `src/domain/analytics/AnalyticsEngine.ts` | Time bucket column first in result columns |
| `tests/domain/analytics/AnalyticsEngine.test.ts` | Updated column order assertion |

**Tests:** ~4 (1 column order test updated, rest verified via existing suite)
**AC:** All changes verified via `npm test` — no regressions

---

## Dependency Graph

```
Inc 1 (trend calculations — foundation)
  └── Inc 2 (expression functions — extends Inc 1 evaluator)
Inc 3 (formatting UI — independent, uses existing C32 types)
Inc 4 (homepage + queries UX — independent)
Inc 5 (flow test — needs all above)
```

**Execution order:** Inc 1 → Inc 2 → Inc 3 → Inc 4 → Inc 5

Inc 1 and Inc 2 share the expression evaluator — sequential avoids conflicts.
Inc 3 and Inc 4 are independent of each other but follow Inc 2 for coherent testing.
Inc 5 integrates all prior work.

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Function call parser changes evaluator contract | High | evaluateExpression return type broadens to `string \| number`; ResultRow already supports mixed types; conditional formatting skips strings |
| Window function two-pass evaluation adds latency | Medium | Window pass only runs when CHANGE/PCT_CHANGE/ROLLING_AVG tokens detected; no overhead for standard queries |
| IF() expression parser complexity (nested conditions) | Medium | Support single condition only in v1 (no AND/OR); nesting via ROUND(IF(...)) works naturally |
| Collapsible tile settings panel is new UI pattern | Medium | Follow existing collapsible pattern from QueriesTab (QueryBuilderPanel sections); keep minimal — formatting rules only |
| Conditional formatting rule builder increases DashboardsTab LOC | Low | DashboardsTab at 436 LOC; +120 puts it at ~556, under 600 threshold |
| Pinned dashboard previews slow homepage render | Low | Compact summary cards use cached stat values; no tile re-execution on homepage open |
| Expression function naming conflicts with column names | Low | Functions are uppercase-only (ROUND, ABS, IF); column references use `{braces}` syntax — no ambiguity |

---

## Success Metrics

| Metric | Target |
|--------|--------|
| New tests | ~68 |
| Post-cycle total tests | ~4,529 |
| New source LOC | ~620 (function parser + trends + expressions + help text + formatting UI + homepage) |
| Trend functions | 0 → 3 (CHANGE, PCT_CHANGE, ROLLING_AVG) |
| Expression functions | 0 → 3 (ROUND, ABS, IF) |
| Computed column function total | 4 arithmetic ops → 4 + 3 trends + 3 expressions = 10 |
| Analytics events | 19 (no new events — features are engine + UI level) |
| Supplier PRD gaps closed | §6.1 MoM %, §6.5 Rolling averages, §10 Conditional coloring UI |
| Deferred items resolved | 3 (DEV-2 formatting UI, expression functions 2-cycle, trend calculations 1-cycle) |

---

## Deferred Items

| Item | Rationale | Target |
|------|-----------|--------|
| Dashboard drill-down navigation | Complex filter propagation + breadcrumbs; pair with Supplier Dashboard template | Cycle 34 |
| Area charts, pie charts | Line + bar cover current Supplier needs; area needed for inventory trend | Cycle 34 |
| Supplier Dashboard template | Pre-built template needs drill-down + area charts first | Cycle 34 |
| User Hub dashboard widget | Cross-hub concern; requires HubDashboardProvider extension | Cycle 34 |
| CSV file merging | Data Exchange domain concern; pre-processing before analytics | Future |
| Chart interactivity (tooltips, zoom) | Static SVG sufficient for current needs | Future |
| Auto-refresh polling | Manual refresh works | Future |
| Forecasting / projections | Needs trend foundation (delivered this cycle) first | Cycle 35 |
| AND/OR in IF conditions | Single condition sufficient for v1; nested IF workaround exists | Future |
| Drag-and-drop tile reordering | Move up/down sufficient | Future |
| Dashboard templates | Patterns still emerging from usage | Cycle 34 |

---

## Definition of Done (Cycle)

### 1. All Increments Completed
- [x] Each increment satisfies its own acceptance criteria
- [x] No increment left in partial state
- [x] Deferred items documented with rationale

### 2. Build & Test Quality
- [x] `npm test` passes — all 4,549 tests green (188 suites)
- [x] `npm run check` passes (tsc + eslint clean)
- [x] No test regressions on existing 4,461 tests
- [x] Flow 33 integration test passes

### 3. Three Amigos Review
- [x] Cycle-level review conducted
- [x] All three perspectives represented
- [x] TASM scores recorded

### 4. PRD & Backlog Updates
- [x] Analytics Hub PRD updated to v7 with FRs 43-51
- [x] PBIs created and tracked (ANA-035 through ANA-040)
- [x] Event model current (19 events — no new events this cycle)

### 5. Documentation
- [x] New function signatures documented (JSDoc on trendCalculations.ts, expressionFunctions.ts)
- [x] Rule builder interaction documented in DashboardsTab
- [x] ChartRenderer multi-series support documented

### 6. Cycle Plan Completion
- [x] Frontmatter updated (stage: delivered, date_completed, actual values)
- [x] Deviations documented
- [x] Learnings captured

---

## Verification

1. **DoR phase**: All docs created (cycle doc, 5 PBIs, PRD v7 scope) — pending
2. `npm test` — all tests pass after each increment
3. Manual: Create query with `PCT_CHANGE({Cost})` computed column → verify MoM % values
4. Manual: Add `ROUND(PCT_CHANGE({Cost}), 1)` → verify clean decimal output
5. Manual: Open tile settings → Formatting → Add rule → see color apply on tile
6. Manual: Pin dashboard to homepage → close hub → reopen → pinned dashboard visible
7. Manual: Open Queries tab → saved queries appear above sources
8. Flow 33 integration test covers the trend intelligence workflow

---

## Retrospective

### What went well

- **Three-tier evaluator pipeline** delivered cleanly — arithmetic → scalar functions → window functions pipeline design proved correct. No regressions on existing computed columns.
- **Function call parser** handled nesting naturally (`ROUND(PCT_CHANGE({Cost}), 1)`) without special-casing, validating the inside-out evaluation approach.
- **Conditional formatting rule builder** completed the C32 DEV-2 deferral in a single increment — the collapsible tile settings panel pattern is reusable for future per-tile settings.
- **UX Sprint (Inc 6-8)** was highly productive — 16+ manual-testing-driven fixes in rapid succession, each verified immediately. The fast iteration loop of "test → feedback → fix → verify" worked extremely well.
- **Zero new events** — all features were engine-level and UI-level, confirming the event model is stable.

### Deviations

| ID | Description | Impact | Resolution |
|----|-------------|--------|------------|
| DEV-1 | UX Sprint added 3 unplanned increments (Inc 6-8) | Positive — 16+ UX improvements from manual testing. Scope grew from 5 to 8 increments | Tracked as PBI-ANA-040. All changes verified via test suite. |
| DEV-2 | `chartValueColumn` persistence bug | Low — new field missing from explicit property assignment in `updateTile()` | Fixed immediately. Reinforces pattern: **every new `DashboardTile` field must be added to `updateTile()` property list**. |
| DEV-3 | Time bucket column ordering changed | Low — column order in AnalyticsEngine step 9 swapped to put time dimension first | One test assertion updated. Better UX: time dimension logically leads the result set. |

### Learnings

1. **Explicit property assignment pattern** is a maintenance trap — `AnalyticsService.updateTile()` uses manual per-field assignment instead of spread. Every new field requires a corresponding line. Consider refactoring to `Object.assign(tile, changes)` with a whitelist in a future tech debt cycle.
2. **UX Sprint as a delivery pattern** — dedicating 3 increments to rapid manual-testing-driven polish after core delivery produced outsized value. The Supplier Manager workflow improved significantly from these micro-fixes that would never surface in unit tests alone.
3. **DashboardTileRenderer decoupled from AnalyticsResultsPanel** — removing the `AnalyticsResultsPanel` dependency and rendering tables directly gave full control over spacing and layout. The panel was designed for the query builder context, not tile context.
4. **Multi-series chart support** was simpler than expected — the existing `ChartRenderer` SVG pipeline only needed a loop over numeric columns with color differentiation. No architectural changes required.

### Key Numbers

| Metric | Estimated | Actual |
|--------|-----------|--------|
| Increments | 5 | 8 (+3 UX Sprint) |
| New tests | 68 | 88 |
| Post-cycle tests | ~4,529 | 4,549 |
| Post-cycle suites | — | 188 |
| New functions | 6 (3 trend + 3 expression) | 6 |
| Deferred items resolved | 3 (DEV-2, expressions 2-cycle, trends 1-cycle) | 3 |
| New PBIs | 5 | 6 (+PBI-ANA-040 UX Sprint) |
