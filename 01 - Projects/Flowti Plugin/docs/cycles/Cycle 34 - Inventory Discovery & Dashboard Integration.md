---
type: DevelopmentCycle
feature: "[[Analytics Hub PRD]]"
stage: delivered
cycle: 34
date_planned: 2026-02-24
date_completed: 2026-02-24
pbis:
  - "[[PBI-ANA-041 Tech Debt Resolution]]"
  - "[[PBI-ANA-042 Inventory Test Data Foundation]]"
  - "[[PBI-ANA-043 Area Chart Visualization]]"
  - "[[PBI-ANA-044 Dashboard Discovery]]"
  - "[[PBI-ANA-045 Dashboard Template Pattern]]"
  - "[[PBI-ANA-046 User Hub Dashboard Widget]]"
  - "[[PBI-ANA-047 Inventory Discovery Flow Test]]"
bugs: []
bugs_fixed_precycle: []
tech_debt:
  - "[[AI-1 evalIf regex fallback]]"
  - "[[AI-3 updateTile property assignment]]"
estimated_increments: 7
actual_increments: 7+UX
estimated_tests: 54
actual_tests: 27
pre_cycle_tests: 4549
pre_cycle_suites: 188
post_cycle_tests: 4576
post_cycle_suites: 189
---

# Cycle 34 — Inventory Discovery & Dashboard Integration

## Cycle Overview

**User Story:**

> As a Supplier Manager venturing into the Inventory Management domain, I want to explore my inventory data alongside supplier data through purpose-built dashboards, understand what KPIs matter for each domain, and see those insights surface across Flowti's hubs — so that I can evolve from raw data viewing to informed procurement and inventory decisions.

**User Pains:**
- No inventory data exists in the test data set — the Supplier Management PRD (sections 6.3, 6.4) requires Inventory Snapshots and Purchase Orders but only Suppliers, Items, and Sales CSVs exist today
- The user does not yet know what numbers and data are needed — "I currently don't know what numbers and data I need and what would be the one dashboard for inventory management and what would be the one dashboard for supplier management"
- Inventory visualization needs area charts (Supplier Management PRD section 11) but only table, stat-card, line-chart, and bar-chart display modes are supported
- The Analytics Hub requires manual query-by-query dashboard configuration — no templates, no guided creation, no domain-specific starting points
- Dashboards live exclusively within the Analytics Hub — no cross-hub surfacing (User Hub widget, file-level dashboard)
- Two tech debt items from Cycle 33 review remain unresolved: AI-1 (evalIf regex fallback returns 0 instead of else value) and AI-3 (updateTile explicit property assignment is a maintenance trap)

**User Needs:**
- Complete test data enabling full Supplier Management PRD exploration (Inventory Stock Levels + Purchase Orders)
- Concrete dashboard specifications: THE Supplier Management Dashboard and THE Inventory Health Dashboard — answering "what numbers do I actually need?"
- Area chart visualization for inventory stock level trends over time
- Reduced friction: save proven dashboards as templates for reuse
- Cross-hub visibility: see analytics KPIs on User Hub homepage without navigating to Analytics Hub
- Tech debt resolution before adding new features

**Business Trigger:** Cycle 33 delivered the trend intelligence layer (FRI 35/35, 51 FRs). The Analytics Hub is feature-complete for data analysis. The user has shifted from "build the engine" to "use the engine to discover what I actually need" — this is a **discovery cycle** where understanding the problem space is as important as writing code. The Supplier Management PRD sections 6.3 (QTY on Hand) and 6.4 (Open Purchase Orders) cannot be explored without inventory data.

---

## Situation Assessment

### Pre-Cycle State (post-Cycle 33)

**Plugin health:**
- 4,549 tests passing, 188 test suites
- Build status: green (`npm test` + `npm run check` clean)
- Cycle 33 completed — Trend Intelligence delivered (function parser, 6 computed functions, formatting rule builder, homepage polish)
- No pre-cycle bug fixes blocking (AI-1 and AI-3 are improvements, not blockers)

**Analytics domain status:**
- Domain: ~3,200 LOC (AnalyticsEngine 853, AnalyticsService 635, types 363, events 139, expressionFunctions 97, trendCalculations 83, conditionalFormatting 50, quickInsights 80, dateUtils 98, localeUtils 136, freshnessUtils 81, BaseAnalyticsAdapter 90)
- UI: ~4,300 LOC (AnalyticsHubView 308, QueriesTab 589+, DashboardsTab 472, DashboardTileRenderer 566, ChartRenderer 491, AnalyticsDashboardPage 395, query sub-components ~960, AddTileDialog ~100, TileResultCache ~60)
- Tests: ~300 analytics-specific across domain + flow + UI suites
- Events: 19 (stable for 3 consecutive cycles — C31, C32, C33)
- PRD: v7, FRI 35/35, 51 FRs all delivered

**Test data status:**
- `03 - Resources/Test Data/Analytics/Suppliers.csv` — 5 suppliers (SUP-A through SUP-E, with regions)
- `03 - Resources/Test Data/Analytics/Items.csv` — 12 items (ITM-001 through ITM-012, 3 categories: Electronics, Furniture, Office Supplies)
- `03 - Resources/Test Data/Analytics/Sales.csv` — 46 transactions (Jan–May 2025, quantity + unit_cost + total_cost)
- **Missing**: Inventory Stock Levels, Purchase Orders — cannot explore Supplier Management PRD sections 6.3, 6.4

**Item-Supplier relationships (derived from Sales.csv):**

| Item | Primary Supplier(s) | Avg Monthly Volume | Category |
|------|---------------------|-------------------|----------|
| ITM-001 Wireless Mouse | SUP-A, SUP-C | ~140 units | Electronics |
| ITM-002 Mechanical Keyboard | SUP-A, SUP-C | ~50 units | Electronics |
| ITM-003 USB-C Hub | SUP-C, SUP-E | ~97 units | Electronics |
| ITM-004 Monitor Stand | SUP-D | ~35 units | Furniture |
| ITM-005 Desk Lamp | SUP-D | ~45 units | Furniture |
| ITM-006 Notebook A5 | SUP-B | ~525 units | Office Supplies |
| ITM-007 Ballpoint Pen | SUP-B | ~200 units | Office Supplies |
| ITM-008 Whiteboard Markers | SUP-B | ~310 units | Office Supplies |
| ITM-009 Standing Desk Mat | SUP-D | ~30 units | Furniture |
| ITM-010 Webcam HD | SUP-A, SUP-E | ~68 units | Electronics |
| ITM-011 Cable Management Kit | SUP-E | ~210 units | Electronics |
| ITM-012 Filing Cabinet | SUP-D | ~18 units | Furniture |

**Key capability gaps (addressed in this cycle):**
1. No inventory test data — cannot explore stock levels, reorder points, coverage analysis
2. No area chart — Supplier Management PRD section 11 specifies "Inventory → Area Chart"
3. No dashboard templates — every dashboard requires manual query + tile configuration from scratch
4. No cross-hub dashboard surfacing — User Hub shows metadata counts, not live business KPIs
5. evalIf() returns 0 instead of else value on malformed conditions (AI-1)
6. updateTile() explicit property assignment is a maintenance trap (AI-3)

**Open action items from Cycle 33 review:**
- AI-1: Fix `evalIf()` to return else value on regex mismatch instead of `0` (Medium, ~2h)
- AI-2: Consider extracting expression evaluator from AnalyticsEngine when engine exceeds 900 LOC (Low — monitor, engine at 853 LOC)
- AI-3: Refactor `updateTile()` explicit property assignment to whitelist-based `Object.assign` (Medium, ~1d)
- AI-4: Add component-level UI tests for DashboardTileRenderer if it exceeds 700 LOC (Low — monitor, at 566 LOC)

**Key files (current state):**
- `src/domain/analytics/expressionFunctions.ts` (97 LOC) — evalIf line ~46: `if (!condMatch) return 0;` should return `resolveValue(elseVal, row)`
- `src/domain/analytics/AnalyticsService.ts` (635 LOC) — updateTile at line ~553: explicit per-field assignment needs whitelist refactoring
- `src/domain/analytics/types.ts` (363 LOC) — TileDisplayMode union needs `"area-chart"` addition
- `src/ui/analytics/ChartRenderer.ts` (491 LOC) — needs area chart rendering method
- `src/domain/hub/AnalyticsHubProvider.ts` (~43 LOC) — summary stats only, no dashboard tile surfacing
- `src/ui/userHub/UserHubDashboard.ts` (~477 LOC) — renderHubSummaries shows metadata counts only

---

## Backlog Refinement Notes

### Session Date: 2026-02-24

### Inputs Analyzed

1. **Cycle 33 Three Amigos Review** — AI-1 through AI-4, OBS-1 through OBS-4 (PASS, FRI 35/35, TASM 34.3/35)
2. **Cycle 33 deferred items** — 11 items (drill-down, area charts, supplier template, User Hub widget, CSV merging, chart interactivity, forecasting, etc.)
3. **Supplier Management PRD** (Feature - Supplier Management.md) — 6 core questions (sections 6.1-6.6), KPI definitions, data architecture, visualization requirements
4. **User explicit statement** — "I currently don't know what numbers and data I need"
5. **Vault inbox** — "We need to reorder the User Hub Dashboard", "Every analytics-able file has dashboard capabilities", "Put one Analytics Dashboard on User Hub Homepage"
6. **Tech debt inventory** — 38 open items (3 Medium, 35 Low); AI-1 and AI-3 highest priority for analytics work
7. **Existing test data analysis** — Item-supplier relationships, monthly volumes, category distribution derived from Sales.csv

### Items Analyzed

| Source | Item | Decision | Rationale |
|--------|------|----------|-----------|
| C33 AI-1 | Fix evalIf() regex fallback | **IN SCOPE** (Inc 1) | Correctness fix, 1 line change + tests |
| C33 AI-3 | Refactor updateTile() to whitelist | **IN SCOPE** (Inc 1) | Prevents future persistence bugs; maintenance trap demonstrated in C33 DEV-2 |
| User request | Inventory Stock Levels CSV | **IN SCOPE** (Inc 2) | Prerequisite for all inventory analysis; Supplier Management PRD section 6.3 |
| User request | Purchase Orders CSV | **IN SCOPE** (Inc 2) | Completes PRD section 6.4; enables open PO analysis |
| C33 deferred | Area charts | **IN SCOPE** (Inc 3) | Required for inventory trend visualization (PRD section 11) |
| User request | Define Supplier Management Dashboard | **IN SCOPE** (Inc 4) | Core discovery output: "THE one dashboard for supplier management" |
| User request | Define Inventory Health Dashboard | **IN SCOPE** (Inc 4) | Core discovery output: "THE one dashboard for inventory management" |
| User request | Dashboard templates | **IN SCOPE** (Inc 5) | Captures discovery as reusable patterns; reduces future dashboard creation friction |
| Vault inbox | User Hub dashboard widget | **IN SCOPE** (Inc 6) | Cross-hub integration: analytics KPIs visible without opening Analytics Hub |
| — | Flow 34 integration test | **IN SCOPE** (Inc 7) | End-to-end verification of all deliverables |
| C33 deferred | Dashboard drill-down navigation | **Deferred to C35** | Complex filter propagation; area charts + templates higher priority this cycle |
| C33 deferred | Forecasting / projections | **Deferred to C35** | Needs complete data foundation (delivered this cycle) first |
| Vault inbox | File Dashboard capabilities | **Deferred** | Right-click CSV → dashboard is a separate UX pattern; future cycle |
| C33 AI-2 | Extract expression evaluator | **Deferred** | Engine at 853 LOC, under 900 threshold — monitor |
| C33 AI-4 | Component UI tests | **Deferred** | DashboardTileRenderer at 566 LOC, under 700 threshold — monitor |
| C33 deferred | Chart interactivity | **Deferred** | Static SVG sufficient for discovery |
| C33 deferred | CSV file merging | **Deferred** | DX domain concern, not analytics engine |

### Prioritization Criteria

1. **Discovery enablement** — What data, visualizations, and patterns does the user need to discover their ideal dashboards? (highest)
2. **Supplier Management PRD alignment** — Which gaps in sections 6.1-6.6 can we close with existing engine capabilities? (high)
3. **Tech debt resolution** — AI-1 and AI-3 are small scope but prevent future bugs and improve correctness (medium)
4. **Cross-hub integration learning** — User Hub widget explores the "dashboards everywhere" pattern (medium)
5. **Reusability** — Dashboard templates capture discovery learnings for future vaults and users (medium)

### Strategic Roadmap Update (Analytics Hub Cycles 34-36)

| Cycle | Theme | Key Deliverables |
|-------|-------|-----------------|
| **34 (this)** | Inventory Discovery & Dashboard Integration | Test data, area charts, dashboard specifications, templates, User Hub widget |
| **35 (next)** | Supplier Dashboard Drill-Down | Dashboard drill-down navigation, filter propagation, breadcrumbs, pie charts |
| **36 (future)** | Predictive Analytics | Forecasting (linear trend, rolling projection), anomaly detection, confidence ranges |

---

## Cycle Goals

1. **Complete Test Data Foundation** — Inventory Stock Levels CSV (monthly snapshots, 12 items × 5 months with intentional stock patterns) and Purchase Orders CSV (~48 orders with status mix); closes Supplier Management PRD sections 6.3, 6.4
2. **Tech Debt Resolution** — Fix evalIf() regex fallback (AI-1) and refactor updateTile() to whitelist pattern (AI-3)
3. **Area Chart Visualization** — Fifth TileDisplayMode enabling inventory trend visualization; filled area below line with semi-transparent fill
4. **Dashboard Discovery** — Define and build THE Supplier Management Dashboard (cost, revenue, margin, supplier comparison) and THE Inventory Health Dashboard (stock levels, coverage, stockout risk, open POs)
5. **Dashboard Template Pattern** — Save discovered dashboards as reusable templates; create new dashboards from templates with source mapping
6. **Cross-Hub Integration** — Surface analytics dashboard KPIs on User Hub homepage; explore "dashboards beyond the Analytics Hub" pattern
7. **Integration Verification** — Flow 34 test covering inventory data + area chart + dashboard template + User Hub widget

---

## Scope

### In Scope
- **Inventory Stock Levels CSV** (`Inventory.csv`) — `snapshot_date, item_id, supplier_id, qty_on_hand, reorder_point, safety_stock, avg_daily_sales, unit_cost` for 12 items × 5 months (~60 rows with realistic patterns)
- **Purchase Orders CSV** (`PurchaseOrders.csv`) — `po_id, po_date, item_id, supplier_id, qty_ordered, unit_cost, total_cost, expected_delivery_date, status` (~48 orders, status mix: received/open/partial)
- **evalIf() regex fix** — `expressionFunctions.ts`: change `return 0` to `return resolveValue(elseVal, row)` when condition regex doesn't match
- **updateTile() refactoring** — `AnalyticsService.ts`: replace explicit per-field assignment with `TILE_MUTABLE_KEYS` whitelist array + loop
- **Area chart display mode** — `"area-chart"` added to TileDisplayMode; `renderAreaChart()` in ChartRenderer.ts (filled area below line path, opacity 0.15, multi-series support)
- **Supplier Management Dashboard specification** — 6 tiles: Total Cost (stat-card), Total Revenue (stat-card), Gross Margin % (stat-card with conditional formatting), Cost by Supplier per Month (line-chart), Revenue by Supplier per Month (bar-chart), Supplier Comparison (table)
- **Inventory Health Dashboard specification** — 6 tiles: Total Inventory Value (stat-card), Items Below Reorder Point (stat-card), Avg Days of Coverage (stat-card), Stock Levels Over Time (area-chart), Stockout Risk Table (table with conditional formatting), Open PO by Supplier (bar-chart)
- **Dashboard template types** — `DashboardTemplate`, `SavedQueryTemplate`, `DashboardTileTemplate` in types.ts
- **Dashboard template CRUD** — `saveDashboardAsTemplate()`, `createDashboardFromTemplate()`, `listTemplates()`, `deleteTemplate()` on AnalyticsService
- **Template UI** — "Save as Template" button in DashboardsTab; "Create from Template" option with source mapping
- **Template events (2)** — `analytics.template.saved`, `analytics.template.used`
- **User Hub dashboard widget** — `DashboardStatItem` type; `AnalyticsHubProvider` extracts default dashboard stat values (top 3, 5-minute cache); `UserHubDashboard` renders KPI row
- **Dashboard specification docs** — `docs/dashboards/Supplier Management Dashboard.md`, `docs/dashboards/Inventory Health Dashboard.md`
- **Flow 34 integration test** — ~16 tests covering inventory queries, area chart, template cycle, User Hub widget, edge cases
- **Analytics Hub PRD update to v8** with new FRs (FR-52 through FR-60)

### Out of Scope
- Dashboard drill-down navigation — deferred to Cycle 35 (requires filter propagation + breadcrumbs)
- Forecasting / projections — deferred to Cycle 35 (needs complete data foundation first)
- Chart interactivity (tooltips, zoom) — static SVG sufficient for discovery phase
- Expression evaluator extraction — AnalyticsEngine at 853 LOC, under 900 monitor threshold
- DashboardTileRenderer component tests — at 566 LOC, under 700 monitor threshold
- CSV file merging — Data Exchange domain concern
- Auto-refresh polling — manual refresh sufficient
- Inventory Hub as separate view — discovery hypothesis: Analytics Hub dashboards are sufficient (validate during manual testing)
- File-level dashboard (right-click CSV → dashboard) — separate UX pattern for future cycle
- Pie charts — area + line + bar cover current inventory and supplier needs
- Dashboard template marketplace / sharing — templates are vault-local for now
- .base source support in templates — CSV sources only in v1

---

## Increments

### Inc 1: Tech Debt Resolution (PBI-ANA-041)

**Goal:** Resolve Cycle 33 review action items AI-1 and AI-3 before new feature work.

**Design:**

**AI-1: evalIf() regex fallback fix**

In `src/domain/analytics/expressionFunctions.ts`, when the condition regex (`/^(.+?)\s*(>=|<=|!=|>|<|=)\s*(.+)$/`) fails to match a malformed condition string, the function currently returns `0`. The correct behavior is to return the **else value**, since a non-evaluable condition is logically "false."

Current code (~line 46):
```typescript
if (!condMatch) return 0;
```

Fix:
```typescript
if (!condMatch) return resolveValue(elseVal, row);
```

The `resolveValue` function is already in scope and correctly handles string literals, column references, and numeric literals.

**AI-3: updateTile() whitelist refactoring**

Current code in `AnalyticsService.ts` (~lines 560-568) uses explicit per-field assignment — this pattern caused the `chartValueColumn` persistence bug (C33 DEV-2) and will cause the same bug for any future `DashboardTile` field additions.

Refactored approach:
```typescript
const TILE_MUTABLE_KEYS: Array<keyof Omit<DashboardTile, "id">> = [
    "queryId", "title", "displayMode", "row", "col", "width", "height",
    "conditionalRules", "showSparkline", "chartValueColumn",
];

for (const key of TILE_MUTABLE_KEYS) {
    if (changes[key] !== undefined) {
        (tile as Record<string, unknown>)[key] = changes[key];
    }
}
```

Adding a new `DashboardTile` field now requires only adding it to the array, not a new `if` block.

| File | Action | ~LOC |
|------|--------|------|
| `src/domain/analytics/expressionFunctions.ts` | Line ~46: return resolveValue(elseVal, row) | ~1 |
| `src/domain/analytics/AnalyticsService.ts` | Replace explicit assignment with whitelist loop | ~10 |
| `tests/domain/analytics/expressionFunctions.test.ts` | Add test: malformed condition returns else value | +3 |
| `tests/domain/analytics/AnalyticsService.test.ts` | Add test: updateTile preserves all whitelisted fields | +5 |

**AC:**
- [ ] evalIf() returns else value (not 0) when condition regex does not match
- [ ] evalIf() returns else value for empty condition string
- [ ] updateTile() uses TILE_MUTABLE_KEYS whitelist instead of explicit per-field assignment
- [ ] All whitelisted fields persist correctly through updateTile cycle
- [ ] Adding `"area-chart"` to displayMode in Inc 3 requires no updateTile changes (validates whitelist)
- [ ] All 4,549 existing tests pass with no regressions
- [ ] `npm test` passes

**Tests:** ~8 (3 evalIf edge cases + 5 updateTile whitelist verification)

---

### Inc 2: Inventory Test Data Foundation (PBI-ANA-042)

**Goal:** Create Inventory Stock Levels and Purchase Orders CSVs with realistic data matching existing items and suppliers.

**Design:**

This is a **data creation increment**. The deliverables are CSV files placed in `03 - Resources/Test Data/Analytics/`.

**Inventory.csv** — Monthly stock snapshots

Schema: `snapshot_date,item_id,supplier_id,qty_on_hand,reorder_point,safety_stock,avg_daily_sales,unit_cost`

Design principles:
- Monthly snapshots at month-end: 01/31/2025, 02/28/2025, 03/31/2025, 04/30/2025, 05/31/2025
- Each item linked to its primary supplier (derived from Sales.csv purchasing patterns)
- ~60 rows (12 items × 5 months)
- Intentional stock patterns that create interesting dashboard stories:

| Item | Pattern | Story |
|------|---------|-------|
| ITM-001 Wireless Mouse | **Declining** 450→180 | Approaching reorder point (200) — "Should we order more?" |
| ITM-002 Mechanical Keyboard | **Stable** 120–150 | Healthy coverage, no action needed |
| ITM-003 USB-C Hub | **Seasonal dip** drops in March, recovers | Demand spike depletes then PO refills |
| ITM-004 Monitor Stand | **Stable low** 55–70 | Low volume, adequate coverage |
| ITM-005 Desk Lamp | **Slow decline** 85→55 | Gradual draw-down, approaching reorder (40) |
| ITM-006 Notebook A5 | **Overstocked** 2,000+ | High sales (17.5/day) but massive stockpile (120+ days coverage) |
| ITM-007 Ballpoint Pen | **Healthy** 400–500 | Good turnover, well-managed |
| ITM-008 Whiteboard Markers | **Growing** 300→500 | Receiving more than selling, building inventory |
| ITM-009 Standing Desk Mat | **Stable low** 45–55 | Low volume furniture, minimal risk |
| ITM-010 Webcam HD | **Critical dip** drops to 40 in March (below reorder 100), then recovers | PO fulfillment rescues stockout |
| ITM-011 Cable Management Kit | **Healthy** 300–400 | Good coverage, steady demand |
| ITM-012 Filing Cabinet | **Minimal** 25–35 | Very low volume, long coverage |

Category-appropriate thresholds:
- Electronics: reorder_point 80–200, safety_stock 40–100
- Furniture: reorder_point 20–40, safety_stock 10–20
- Office Supplies: reorder_point 300–500, safety_stock 150–250

avg_daily_sales derived from Sales.csv monthly volumes / 30.

**PurchaseOrders.csv** — Procurement records

Schema: `po_id,po_date,item_id,supplier_id,qty_ordered,unit_cost,total_cost,expected_delivery_date,status`

Design principles:
- ~48 purchase orders across Jan–May 2025
- Status distribution: received (~29), open (~12), partial (~7)
- Lead times: Electronics 2–4 weeks, Furniture 3–6 weeks, Office Supplies 1–2 weeks
- PO quantities correlate with reorder patterns from Inventory.csv
- Open POs exist for items approaching reorder point (ITM-001 especially)
- Some POs for ITM-010 timed to rescue the March stockout

**Computed KPIs these CSVs enable (validates against Supplier Management PRD):**

| PRD Section | KPI | Data Sources | Computed Column Expression |
|-------------|-----|-------------|---------------------------|
| 6.3 | QTY on Hand by SKU per Month | Inventory × Items | Direct: qty_on_hand, time bucket month |
| 6.3 | Days of Coverage | Inventory | `ROUND({qty_on_hand} / {avg_daily_sales}, 0)` |
| 6.3 | Inventory Value | Inventory | `{qty_on_hand} * {unit_cost}` |
| 6.3 | Items Below Reorder Point | Inventory | `IF({qty_on_hand} < {reorder_point}, "Below", "OK")` |
| 6.4 | Open PO QTY by Item | PurchaseOrders (filtered open) | SUM(qty_ordered) group by item_id |
| 6.4 | Open PO Value | PurchaseOrders (filtered open) | SUM(total_cost) |
| 6.4 | Supplier Commitment Exposure | PurchaseOrders (not received) | SUM(total_cost) group by supplier_id |

| File | Action | ~Rows |
|------|--------|-------|
| `03 - Resources/Test Data/Analytics/Inventory.csv` | **New** — monthly inventory snapshots | ~60 |
| `03 - Resources/Test Data/Analytics/PurchaseOrders.csv` | **New** — purchase order records | ~48 |

**AC:**
- [ ] Inventory.csv contains monthly snapshots for all 12 items across 5 months (Jan–May 2025)
- [ ] Item-supplier relationships consistent with Sales.csv
- [ ] At least 2 items show declining stock approaching reorder point (ITM-001, ITM-005)
- [ ] At least 1 item shows overstock pattern (ITM-006)
- [ ] At least 1 item shows critical dip and recovery (ITM-010)
- [ ] avg_daily_sales values consistent with Sales.csv volumes (±20%)
- [ ] PurchaseOrders.csv contains ~48 orders with status mix (received/open/partial)
- [ ] Open POs exist for items approaching reorder point
- [ ] Both CSVs load correctly in Analytics Hub (verify via manual import)
- [ ] Column types auto-detected correctly (dates, numbers, strings)

**Tests:** 0 (data files, not code)

---

### Inc 3: Area Chart Visualization (PBI-ANA-043)

**Goal:** Add area chart as the 5th TileDisplayMode for inventory trend visualization.

**Design:**

An area chart is a line chart with the area below the line filled with a semi-transparent color. The SVG implementation reuses the existing `ChartRenderer` infrastructure (axes, scaling, data extraction, multi-series detection).

**Type change:**
- Add `"area-chart"` to `TileDisplayMode` union in `types.ts`

**ChartRenderer additions:**
- `renderAreaChart(container, result, valueColumn?)` — public static method
- Reuses `extractChartData()`, `extractMultiSeriesData()`, `buildSvg()`, `drawYAxis()`, `drawXAxis()`
- Area fill: SVG `<path>` from first data point, line through all points, down to baseline, back to start
- Fill color: `var(--interactive-accent)` at `opacity: 0.15`
- Line overlay: same as line chart (`stroke-width: 2`, full opacity) for clear data point visibility
- Multi-series: overlapping areas with `SERIES_COLORS` at reduced opacity (0.12 each), line overlay per series
- Legend: same pattern as line/bar chart multi-series legend

**DashboardTileRenderer wiring:**
- Add `"area-chart"` case alongside line-chart/bar-chart in render dispatch (delegates to `renderChartWithSelector`)
- Add to `DISPLAY_MODE_CYCLE` array for mode toggle
- Mode label: "Area Chart"

| File | Action | ~LOC |
|------|--------|------|
| `src/domain/analytics/types.ts` | Add `"area-chart"` to TileDisplayMode | +1 |
| `src/ui/analytics/ChartRenderer.ts` | Add `renderAreaChart()` + multi-series area support | +80 |
| `src/ui/analytics/DashboardTileRenderer.ts` | Add area-chart to mode cycle + render dispatch | +5 |

**AC:**
- [ ] TileDisplayMode includes "area-chart" as 5th option
- [ ] Area chart renders filled area below line with semi-transparent fill
- [ ] Multi-series area chart supports multiple dimension groups with distinct colors
- [ ] Value column selector works with area charts (same as line/bar)
- [ ] Mode dropdown shows "Area Chart" option in tile display mode cycle
- [ ] Area chart sorts labels chronologically for date buckets (same as line chart)
- [ ] updateTile whitelist (Inc 1) automatically supports new displayMode value (no additional changes needed)
- [ ] Existing chart tests pass without modification
- [ ] `npm test` passes

**Tests:** ~8 (3 area chart rendering + 2 multi-series area + 2 data extraction + 1 mode cycle)

---

### Inc 4: Dashboard Discovery — Supplier Management & Inventory Health (PBI-ANA-044)

**Goal:** Define, document, and build THE two dashboards that answer the Supplier Manager's core questions.

**Design:**

This is the **discovery core** of the cycle. The output is both documentation (dashboard specifications) and working dashboards built through the Analytics Hub UI.

**THE Supplier Management Dashboard**

Purpose: Answer "How is procurement performing across my suppliers?"

| Tile | Title | Sources | Query Pattern | Display | Conditional Rules |
|------|-------|---------|--------------|---------|-------------------|
| 1 | Total Procurement Cost | Sales | SUM(total_cost), no grouping | stat-card | — |
| 2 | Total Revenue | Sales × Items | Computed: `{quantity} * {unit_price}`, SUM | stat-card | — |
| 3 | Gross Margin % | Sales × Items | Computed: `ROUND(({Total Revenue} - {Total Cost}) / {Total Revenue} * 100, 1)` | stat-card | < 20 = negative, >= 30 = positive |
| 4 | Cost by Supplier per Month | Sales × Suppliers | Time bucket month, group by supplier_name, SUM(total_cost) | line-chart | — |
| 5 | Revenue by Supplier per Month | Sales × Suppliers × Items | Time bucket month, group by supplier_name, SUM(revenue) | bar-chart | — |
| 6 | Supplier Comparison | Sales × Suppliers | Group by supplier_name, SUM(total_cost), AVG(unit_cost), COUNT(sale_date) | table | AVG(unit_cost) > 50 = warning |

Saved queries needed: 5 (cost total, revenue total with margin computed, cost by supplier monthly, revenue by supplier monthly, supplier comparison table)

**THE Inventory Health Dashboard**

Purpose: Answer "What is the state of my inventory and where are the risks?"

| Tile | Title | Sources | Query Pattern | Display | Conditional Rules |
|------|-------|---------|--------------|---------|-------------------|
| 1 | Total Inventory Value | Inventory (latest month) | Computed: `{qty_on_hand} * {unit_cost}`, SUM | stat-card | — |
| 2 | Items Below Reorder | Inventory (latest month) | Computed: `IF({qty_on_hand} < {reorder_point}, 1, 0)`, SUM | stat-card | > 0 = negative |
| 3 | Avg Days of Coverage | Inventory (latest month) | Computed: `ROUND({qty_on_hand} / {avg_daily_sales}, 0)`, AVG | stat-card | < 14 = negative, < 30 = warning, >= 30 = positive |
| 4 | Stock Levels Over Time | Inventory × Items | Time bucket month, group by category, SUM(qty_on_hand) | **area-chart** | — |
| 5 | Stockout Risk Table | Inventory (latest month) × Items | Computed days_of_coverage, filtered < 30, sorted asc | table | days < 14 = negative, < 21 = warning |
| 6 | Open PO by Supplier | PurchaseOrders (filtered status=open) × Suppliers | Group by supplier_name, SUM(total_cost), SUM(qty_ordered) | bar-chart | — |

Saved queries needed: 6 (inventory value, below reorder count, avg coverage, stock over time, stockout risk, open POs)

**Implementation approach:**
- Document both dashboards in specification files with the tables above
- Build the 11 queries and 2 dashboards through the Analytics Hub UI during manual testing
- Validate that every tile renders correctly and the data tells the expected story
- Iterate on tile configuration until the dashboards answer the user's questions intuitively

**Discovery questions to answer during this increment:**
- Does the existing query engine handle "latest month only" filtering? (filter: snapshot_date = "05/31/2025")
- Can we join Inventory × Items × Suppliers in a single query for enriched views?
- Does the multi-series area chart look right for stock levels by category?
- Are the conditional formatting thresholds useful (14/30 days)?

| File | Action | ~LOC |
|------|--------|------|
| `docs/dashboards/Supplier Management Dashboard.md` | **New** — dashboard specification | ~80 |
| `docs/dashboards/Inventory Health Dashboard.md` | **New** — dashboard specification | ~80 |

**AC:**
- [ ] Supplier Management Dashboard specification documented with 6 tiles
- [ ] Inventory Health Dashboard specification documented with 6 tiles
- [ ] Both dashboards buildable through existing Analytics Hub UI
- [ ] All 5 CSVs (Suppliers, Items, Sales, Inventory, PurchaseOrders) used across the 2 dashboards
- [ ] Area chart tile renders stock levels over time correctly
- [ ] Conditional formatting rules apply to margin %, days of coverage, stockout risk
- [ ] Dashboard specifications capture the exact query configurations for template creation (Inc 5)
- [ ] Discovery questions answered and documented
- [ ] `npm test` passes (no code changes — documentation + manual testing)

**Tests:** 0 (manual testing + documentation increment)

---

### Inc 5: Dashboard Template Pattern (PBI-ANA-045)

**Goal:** Enable saving a dashboard as a reusable template and creating new dashboards from templates.

**Design:**

A dashboard template captures the query configurations and tile layout of a dashboard, with source paths as replaceable placeholders. This allows the Supplier Management Dashboard and Inventory Health Dashboard built in Inc 4 to be saved as templates and recreated in other vaults or with different data.

**New types in `types.ts`:**

```typescript
export interface SavedQueryTemplate {
    alias: string;
    sourceDescription: string;
    originalSourcePath: string;
    sourceType: "csv" | "base";
    locale?: LocaleId;
    queryConfig: Omit<SavedAnalyticsQuery, "id" | "createdAt" | "lastRun" | "lastRowCount" | "sources" | "isFavorite">;
}

export interface DashboardTileTemplate {
    queryIndex: number;
    title: string;
    displayMode: TileDisplayMode;
    width: number;
    height: number;
    conditionalRules?: ConditionalRule[];
    chartValueColumn?: string;
}

export interface DashboardTemplate {
    id: string;
    name: string;
    description: string;
    domain: string;
    queries: SavedQueryTemplate[];
    tiles: DashboardTileTemplate[];
    createdAt: number;
}
```

**AnalyticsState extension:**
```typescript
templates?: DashboardTemplate[];
```

**AnalyticsService additions (~80 LOC):**
- `saveDashboardAsTemplate(dashboardId, name, description, domain)` — serializes dashboard's queries + tiles into a template with source paths as descriptive placeholders
- `createDashboardFromTemplate(templateId, sourceMapping: Record<string, string>)` — instantiates template: creates saved queries with mapped source paths, creates dashboard with tiles pointing to new query IDs
- `listTemplates()` — returns persisted templates array
- `deleteTemplate(templateId)` — removes a template from state

**UI additions (~80 LOC):**
- "Save as Template" button in DashboardsTab detail header (next to existing Export button)
- Template save dialog: name, description, domain tag inputs
- "Create from Template" option in dashboard creation flow
- Source mapping step: for each unique source in the template, user selects actual CSV file from vault

**New events (2):**
- `analytics.template.saved` — `{ templateId, templateName, domain }`
- `analytics.template.used` — `{ templateId, dashboardId, dashboardName }`

| File | Action | ~LOC |
|------|--------|------|
| `src/domain/analytics/types.ts` | Add DashboardTemplate, SavedQueryTemplate, DashboardTileTemplate + state extension | +40 |
| `src/domain/analytics/events.ts` | Add 2 template events | +12 |
| `src/domain/analytics/AnalyticsService.ts` | saveDashboardAsTemplate, createDashboardFromTemplate, listTemplates, deleteTemplate | +80 |
| `src/ui/analytics/DashboardsTab.ts` | "Save as Template" button + template save dialog | +40 |
| `src/ui/analytics/AddTileDialog.ts` or new `TemplatePickerDialog.ts` | "Create from Template" option + source mapping | +40 |

**AC:**
- [ ] User can save any dashboard as a template with name, description, and domain tag
- [ ] Template captures all query configurations (dimensions, measures, filters, computed columns, sort, limit) and tile layout (display mode, width, conditional rules)
- [ ] User can create a new dashboard from a template by selecting source file for each query source
- [ ] Source mapping shows original source description + file picker for each unique source
- [ ] Created dashboard has fresh query IDs (not shared with the template's source dashboard)
- [ ] Templates persist in AnalyticsState across hub close/reopen
- [ ] Deleting a template does not affect dashboards created from it
- [ ] `analytics.template.saved` and `analytics.template.used` events emitted correctly
- [ ] `npm test` passes

**Tests:** ~14 (4 save template + 4 create from template + 2 source mapping + 2 delete + 2 event emission)

---

### Inc 6: User Hub Dashboard Widget (PBI-ANA-046)

**Goal:** Surface analytics dashboard KPIs on the User Hub homepage for cross-hub visibility.

**Design:**

The User Hub already shows cross-hub summaries via `HubRegistry.getSummary()`. The current `AnalyticsHubProvider.getSummary()` returns metadata counts ("3 Saved Queries", "2 Dashboards"). This gives the Supplier Manager no insight into actual business metrics without opening the Analytics Hub.

**Enhancement:** When a default or pinned analytics dashboard exists, surface its top stat-card tile values directly on the User Hub homepage.

**New type in `hub/types.ts`:**
```typescript
export interface DashboardStatItem {
    label: string;
    value: string;
    icon?: string;
    color?: string;
}
```

Extend `HubSummary`:
```typescript
dashboardStats?: DashboardStatItem[];
```

**AnalyticsHubProvider enhancement (~50 LOC):**
- When a default dashboard exists, extract the first 3 stat-card tiles
- Run their queries via `analyticsService.runSavedQuery()` and cache results (5-minute TTL)
- Map results to `DashboardStatItem[]` with label (tile title), value (formatted stat), optional color (from conditional formatting)
- Fallback: empty `dashboardStats` if no default dashboard or no stat-card tiles

**UserHubDashboard enhancement (~35 LOC):**
- In `renderHubSummaries()`, after the existing stat grid per hub, check for `dashboardStats`
- If populated, render a compact KPI card row (same visual style as pinned dashboard cards on Analytics Hub homepage)
- Click the KPI row → navigate to Analytics Hub dashboards tab

**Architectural decision:** This is a **lightweight summary**, NOT a full dashboard embedding. The User Hub shows 3 KPI values, not a full tile grid. Full analysis happens in the Analytics Hub. This approach:
- Keeps the User Hub fast (no heavy rendering or query execution on every refresh)
- Reuses existing `HubSummary` pattern (no new abstraction needed)
- Is extensible to other hubs (e.g., Train Hub could surface active train count)

| File | Action | ~LOC |
|------|--------|------|
| `src/domain/hub/types.ts` | Add DashboardStatItem type + dashboardStats to HubSummary | +12 |
| `src/domain/hub/AnalyticsHubProvider.ts` | Extract and cache default dashboard stat values | +50 |
| `src/ui/userHub/UserHubDashboard.ts` | Render dashboardStats KPI row in hub summaries section | +35 |

**AC:**
- [ ] When a default analytics dashboard with stat-card tiles exists, User Hub shows top 3 KPI values
- [ ] KPI values include label, formatted value, and optional conditional formatting color
- [ ] KPI values update when User Hub re-renders (5-minute internal cache prevents excessive query execution)
- [ ] When no default dashboard exists, no KPI row is shown (graceful fallback)
- [ ] Clicking the KPI row navigates to the Analytics Hub
- [ ] Other hub providers' summaries are not affected
- [ ] Existing User Hub tests pass without modification
- [ ] `npm test` passes

**Tests:** ~8 (3 provider with dashboard + 2 provider without dashboard + 3 UI rendering)

---

### Inc 7: Flow Test + PRD Update (PBI-ANA-047)

**Goal:** End-to-end flow test and PRD update.

**Design:**

**Flow 34 test:** Inventory Discovery & Dashboard Integration workflow.

Test structure:
1. **Inventory data loading** — parse Inventory.csv and PurchaseOrders.csv fixtures; verify column detection
2. **Inventory queries** — stock levels by item, days of coverage computation, items below reorder point count
3. **Area chart data extraction** — `extractChartData()` returns correct values for area display mode, chronological sorting
4. **Dashboard creation** — create dashboard with 6 inventory tiles; verify tile result execution
5. **Template cycle** — save dashboard as template; verify template structure captures query configs + tile layout; create new dashboard from template with source mapping; verify fresh query IDs
6. **User Hub widget** — provider extracts stat-card values from default dashboard; verify KPI items
7. **Tech debt fixes** — evalIf with malformed condition returns else value; updateTile whitelist persists all fields
8. **Edge cases** — empty inventory data, zero avg_daily_sales (division by zero in coverage), missing supplier join, single-month snapshot

**PRD update:**
- Analytics Hub PRD v8
- Add FR-52 (area chart display mode), FR-53 (save dashboard as template), FR-54 (create dashboard from template), FR-55 (User Hub dashboard widget), FR-56 through FR-60 (inventory-specific query patterns and KPIs)
- Update Data Model section with DashboardTemplate types
- Update FRI score

| File | Action | ~LOC |
|------|--------|------|
| `tests/flows/34-InventoryDiscovery.test.ts` | **New** — flow integration test | +180 |
| `docs/features/Analytics Hub/Analytics Hub PRD.md` | Update to v8 with FR-52 through FR-60 | ~40 lines |

**AC:**
- [ ] Flow 34 test passes (~16 tests covering full workflow)
- [ ] Inventory queries produce correct aggregations
- [ ] Area chart data extraction verified for time series
- [ ] Dashboard template save/create cycle verified end-to-end
- [ ] User Hub widget renders KPIs from default dashboard
- [ ] evalIf regex fix verified in flow context
- [ ] updateTile whitelist verified in flow context
- [ ] Edge cases handled (zero division, empty data, missing joins)
- [ ] Analytics Hub PRD updated to v8 with all new FRs
- [ ] `npm test` passes — all tests green

**Tests:** ~16 (3 inventory queries + 2 area chart + 3 dashboard creation + 3 template cycle + 2 User Hub widget + 3 edge cases)

---

## Dependency Graph

```
Inc 1 (tech debt — foundation)
  │
  ├── Inc 3 (area chart — needs clean updateTile from Inc 1)
  │     │
Inc 2 (test data — parallel, no code deps)
  │     │
  └─────┤
        v
Inc 4 (dashboard discovery — needs Inc 2 data + Inc 3 area chart)
        │
        ├── Inc 5 (templates — needs Inc 4 dashboards to save)
        │
        └── Inc 6 (User Hub widget — needs Inc 4 dashboards for KPIs)
              │
              v
        Inc 7 (flow test — needs all above)
```

**Execution order:** Inc 1 → Inc 2 → Inc 3 → Inc 4 → Inc 5 → Inc 6 → Inc 7

Inc 1 and Inc 2 are technically independent but Inc 1 should go first to ensure a clean foundation before adding features. Inc 5 and Inc 6 are independent of each other but both need Inc 4's dashboards. Inc 7 integrates all prior work.

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Discovery scope creep — user finds more dashboard ideas during manual testing | Medium | Cap at 2 dashboard specifications (Supplier + Inventory). Document additional ideas in vault inbox for future cycles. |
| Area chart SVG complexity (overlapping fills, readability with many series) | Low | Reduce fill opacity to 0.12–0.15; use distinct colors from SERIES_COLORS array. Line overlay ensures data points remain readable. MAX_SERIES = 8 limits visual overload. |
| Dashboard template source mapping UX friction | Medium | CSV sources only in v1 (no .base). Show original source path as hint. Simple file picker from vault CSV list. |
| User Hub widget performance (query re-execution on every hub open) | Medium | Internal 5-minute cache in AnalyticsHubProvider. Only top 3 stat-card tiles. Query execution is <100ms for <1000 row CSV sources. |
| Test data design may not produce interesting dashboard patterns | Low | Data designed with intentional patterns: declining stock (ITM-001), overstock (ITM-006), critical dip (ITM-010). Validate computed KPIs in Inc 4. |
| AnalyticsService LOC growth from template methods | Low | +80 LOC puts AnalyticsService at ~715 LOC. Monitor at 800. Template logic is CRUD-only (no complex computation). |
| "Latest month only" filtering may be awkward in current query engine | Low | Use filter: `snapshot_date = "05/31/2025"` or use time bucket month + filter on resulting bucket. Test in Inc 4 manual testing. |

---

## Success Metrics

| Metric | Target |
|--------|--------|
| New tests | ~54 (8 tech debt + 0 data + 8 area chart + 0 discovery + 14 templates + 8 widget + 16 flow) |
| Post-cycle total tests | ~4,603 |
| New source LOC | ~400 (tech debt refactor + area chart + template types/service/UI + User Hub widget) |
| New test data rows | ~108 (60 inventory + 48 purchase orders) |
| TileDisplayMode options | 4 → 5 (+area-chart) |
| Dashboard templates | 0 → 2 (Supplier Management + Inventory Health) |
| Analytics events | 19 → 21 (+2 template events) |
| Supplier Management PRD gaps closed | §6.3 (inventory stock levels), §6.4 (purchase orders), §11 (area chart) |
| Tech debt items resolved | 2 (AI-1 evalIf, AI-3 updateTile) |
| Discovery outputs | 2 dashboard specifications + 2 templates + cross-hub integration pattern |

---

## Deferred Items

| Item | Rationale | Target |
|------|-----------|--------|
| Dashboard drill-down navigation | Complex filter propagation + breadcrumbs; needs stable dashboard patterns first | Cycle 35 |
| Forecasting / projections | Needs complete data foundation (delivered this cycle) first | Cycle 35 |
| Pie charts | Area + line + bar cover current inventory and supplier needs | Cycle 35+ |
| Chart interactivity (tooltips, zoom) | Static SVG sufficient for discovery | Future |
| Expression evaluator extraction | AnalyticsEngine at 853 LOC, under 900 monitor threshold | Monitor (AI-2) |
| DashboardTileRenderer component tests | At 566 LOC, under 700 monitor threshold | Monitor (AI-4) |
| CSV file merging | Data Exchange domain concern | Future |
| Auto-refresh polling | Manual refresh sufficient | Future |
| Dashboard template marketplace / sharing | Templates are vault-local for now | Future |
| .base source support in templates | CSV sources only in v1 for simplicity | Future |
| Inventory Hub as separate view | Discovery hypothesis: Analytics Hub dashboards sufficient | Validate in C34, revisit if disproven |
| File-level dashboard (right-click CSV) | Separate UX pattern | Future |
| Drag-and-drop tile reordering | Move up/down sufficient | Future |

---

## Definition of Done (Cycle)

### 1. All Increments Completed
- [x] Each increment satisfies its own acceptance criteria
- [x] No increment left in partial state
- [x] Deferred items documented with rationale

### 2. Build & Test Quality
- [x] `npm test` passes — 4,576 tests green (189 suites)
- [x] `npm run check` passes (tsc + eslint clean)
- [x] No test regressions on existing 4,549 tests (5 removed: pinning feature stripped)
- [x] Flow 34 integration test passes (21 tests)

### 3. Three Amigos Review
- [ ] Cycle-level review conducted
- [ ] All three perspectives represented
- [ ] TASM scores recorded

### 4. PRD & Backlog Updates
- [x] Analytics Hub PRD updated to v8 with FRs 52-60
- [x] PBIs created and tracked (ANA-041 through ANA-047)
- [x] Event model current (21 events — +2 template events)

### 5. Discovery Documentation
- [x] Supplier Management Dashboard specification published
- [x] Inventory Health Dashboard specification published
- [x] Dashboard templates saved and functional
- [x] User Hub cross-hub integration pattern validated

### 6. Cycle Plan Completion
- [x] Frontmatter updated (stage: delivered, date_completed, actual values)
- [x] Deviations documented
- [x] Learnings captured

---

## Verification

1. **DoR phase**: All docs created (cycle doc, 7 PBIs, PRD v8 scope)
2. `npm test` — all tests pass after each increment
3. Manual: Import Inventory.csv + PurchaseOrders.csv → verify column detection and data loads
4. Manual: Build Supplier Management Dashboard from specification → verify 6 tiles render with correct data
5. Manual: Build Inventory Health Dashboard from specification → verify area chart renders stock levels, conditional formatting colors risk items
6. Manual: Save Inventory Health Dashboard as template → create new dashboard from template → verify queries recreated with source mapping
7. Manual: Set dashboard as default → open User Hub → verify KPI row shows stat-card values
8. Manual: evalIf with malformed condition → verify else value returned (not 0)
9. Flow 34 integration test covers the full inventory discovery workflow

---

## Success Metrics — Actuals

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| New tests | ~54 | 27 (21 flow + 6 domain) | Below estimate — 5 pin tests removed, UX work was test-free UI changes |
| Post-cycle total tests | ~4,603 | 4,576 (189 suites) | Slightly below — 5 pin tests removed offset gains |
| New source LOC | ~400 | ~600+ (area chart, templates, widget, UX sprint) | Exceeded — UX sprint added query auto-load, CSV download, tile settings |
| New test data rows | ~108 | ~108 (Inventory + PurchaseOrders) | Met |
| TileDisplayMode options | 5 | 5 (table, stat-card, line-chart, bar-chart, area-chart) | Met |
| Dashboard templates | 2 | 2 (Supplier Management + Inventory Health) | Met |
| Analytics events | 21 | 21 (+2 template events) | Met |
| Tech debt resolved | 2 (AI-1, AI-3) | 2 (AI-1 evalIf, AI-3 updateTile whitelist) | Met |
| Discovery outputs | 2 specs + 2 templates + cross-hub | All delivered | Met |

---

## Deviations from Plan

### Additional UX Sprint (unplanned)

Beyond the 7 planned increments, a significant UX sprint was conducted during manual testing, addressing usability issues discovered while building and interacting with dashboards:

1. **Tile layout fixes** — padding-top on non-table tiles, KPI cards flush with table edges, grid overflow fix (`minWidth: 0`), auto-height for full-width tiles (`autoHeight` field + grid row sizing)
2. **Dashboard homepage rework** — favorite dashboards load on homepage (not jump to editor), home icon in top nav, favorite dashboards as nav links, title truncation fix with Default badge
3. **Query builder improvements** — favorite query click from homepage now loads + auto-executes the query (`lastLoadedQueryId` + `pendingExecute` pattern), Save to CSV as file download (not clipboard), source list last item border removed
4. **Dashboard pinning removed** — stripped `pinnedDashboardIds` from state, removed 4 service methods, removed pin toggle UI, removed 5 pin tests (replaced by favorite-based homepage navigation)
5. **Import resilience** — `writeQueryFile` fall-back to `updateFile` on "file exists" error, proper async/await with Notice feedback on import

### Test Count Deviation

Estimated 54 new tests, actual net gain 27. The shortfall is due to:
- 5 pin-related tests removed (feature stripped)
- UX sprint changes were UI-only (no new tests needed)
- Flow 34 delivered 21 tests (vs. 16 estimated) — more thorough

---

## Retrospective

### What Went Well

- **Discovery-first approach worked** — building dashboards from real data exposed UX friction that wouldn't have surfaced from code alone. The unplanned UX sprint was high-value: homepage navigation, auto-execute, and CSV download directly addressed real user workflows.
- **Tech debt first paid off** — resolving AI-1 (evalIf) and AI-3 (updateTile whitelist) before features meant `autoHeight` and `rowLimit` fields just worked when added to `TILE_MUTABLE_KEYS`. Zero persistence bugs.
- **Template pattern is clean** — `saveDashboardAsTemplate` + `createDashboardFromTemplate` with source mapping is a solid CRUD pattern. No over-engineering.
- **Area chart reuse** — leveraged existing ChartRenderer infrastructure (axes, scaling, multi-series). Only ~80 LOC for a full new visualization type.
- **Feature removal was correct** — pinning was replaced by a simpler, more intuitive favorite-based homepage navigation. Removing code is as valuable as writing it.

### What Could Be Improved

- **Test estimate accuracy** — estimated 54 tests, delivered 27 net. UX sprints are hard to estimate upfront but should be factored in. Consider a "UX buffer" in test estimates.
- **Clipboard export was premature** — initially implemented CSV export to clipboard, then immediately replaced with file download. Should have asked the user's intent first.
- **Auto-height required multiple iterations** — collapse fix, overlap fix, excess whitespace fix. CSS grid auto-sizing is subtle; consider capturing the final pattern as a reference.

### Learnings

1. **`gridAutoRows: "auto"` + per-host `minHeight`** is the correct CSS grid pattern for mixed fixed/auto-height rows. `minmax(Xpx, auto)` enforces minimum even on auto tiles.
2. **`min-width: 0` on grid items** is essential when grid children contain text that would otherwise expand the track beyond `1fr`.
3. **Auto-load + auto-execute pattern**: track `lastLoadedQueryId` to detect when state-based navigation sets a new query ID, then `pendingExecute` flag triggers execution after all async sources finish loading.
4. **File download in Obsidian (Electron)**: `Blob` + `URL.createObjectURL` + `<a download>` triggers the native save dialog, allowing saves outside the vault.
5. **Feature removal requires test cleanup**: when stripping a feature (pinning), trace all references across source, tests, and types — `Grep` across `src/` AND `tests/` before declaring done.

### Improvement Backlog

| ID | Item | Priority | Category |
|----|------|----------|----------|
| IMP-34-1 | Add UX buffer to test estimates for discovery cycles | Low | Process |
| IMP-34-2 | Document CSS grid auto-height pattern in frontend architecture doc | Low | Documentation |
| IMP-34-3 | Consider query auto-execute as opt-in setting (some queries may be expensive) | Medium | Feature |
