---
type: DevelopmentCycle
feature: "[[Analytics Hub PRD]]"
stage: delivered
cycle: 40
date_planned: 2026-02-25
date_completed: 2026-02-25
pbis:
  - "[[PBI-ANA-080 Measurements Domain Model]]"
  - "[[PBI-ANA-081 Measurements Tab UI]]"
  - "[[PBI-ANA-082 Measurement-Tile Integration]]"
  - "[[PBI-ANA-083 Query Builder Consolidation]]"
  - "[[PBI-ANA-084 Computed Columns Section Rework]]"
  - "[[PBI-ANA-085 Source Type Settings]]"
bugs: []
bugs_fixed_precycle: []
tech_debt:
  - "[[TD-ANA-004 SchemaPanel Consolidation]]"
estimated_increments: 6
actual_increments: 6
estimated_tests: 40
actual_tests: 35
pre_cycle_tests: 4751
pre_cycle_suites: 196
post_cycle_tests: 4786
post_cycle_suites: 199
---

# Cycle 40 — Measurements & Query Builder Refinement

## Cycle Overview

**User Story:**

> As a data analyst who has built queries and dashboards, I want to define reusable measurements — named, typed metrics extracted from query results — so that I can standardize KPIs across dashboards, track a single "Total Revenue" or "Supplier Count" metric from one source of truth, and quickly add them to tiles without reconfiguring queries.

**User Pains:**

- **No reusable metrics** — every tile directly references a query; to show the same KPI on two dashboards, the user must configure each tile independently
- **No single-value extraction** — queries produce multi-column results but there's no way to say "I only care about the revenue column" for a stat-card
- **Schema panel is a separate component** — creates navigation friction; column types and schema should live inside the query builder panel
- **Computed columns section limited** — expression editing lacks polish, function reference not visible
- **No CSV-folder source type** — users with multiple CSVs in a folder must add each file individually

**Business Trigger:** Cycles 28–39 built the Analytics Hub from query engine through to dashboards, charts, and drill-down filtering. The missing layer is the "measurement" abstraction — the bridge between raw query output and business-meaningful KPIs. Without measurements, every tile is a one-off configuration.

---

## Situation Assessment

### Pre-Cycle State (post-Cycle 39)

**Plugin health:**
- 4,751 tests passing, 196 test suites
- Build status: green
- PRD: v14, 94 FRs all delivered
- No blocking bugs

**Analytics domain status:**
- AnalyticsHubView: 2 tabs (Dashboards, Queries)
- No measurement concept in domain model
- SchemaPanel exists as separate 142-LOC component
- ComputedColumnsSection at ~165 LOC with basic expression editing
- Source types: csv, base (no csv-folder)

---

## Increments

### Inc 1: Measurements Domain Model (PBI-ANA-080)

**Goal:** Add the Measurement entity to the analytics domain — types, handler CRUD, service integration, events.

| File | Action | ~LOC |
|------|--------|------|
| `src/domain/analytics/types.ts` | Add `Measurement`, `MeasurementType`, extend `AnalyticsState` | +41 |
| `src/domain/analytics/handlers/measurementHandlers.ts` | **New** — create, update, delete, toggleFavorite | +114 |
| `src/domain/analytics/handlers/index.ts` | Re-export | +1 |
| `src/domain/analytics/AnalyticsService.ts` | Measurement CRUD delegation | +98 |
| `src/domain/analytics/events.ts` | 9 measurement events | +30 |
| `src/infrastructure/events/catalog.ts` | Register new events | +5 |
| `src/main.ts` | Wire measurement service | +13 |

**Key design decisions:**
- `Measurement { id, name, queryId, type: "single"|"series", measureColumn?, displayFormat? }`
- `type: "single"` = extract one column from query result; `type: "series"` = full result for trends
- `measureColumn` stores the aggregation label (e.g., `"SUM(total_cost)"`) from the query's measures
- Events: `measurement.created`, `measurement.updated`, `measurement.deleted`, `measurement.favorited`, `measurement.loaded`

**Tests:** +15 (measurementHandlers CRUD + AnalyticsService integration)

---

### Inc 2: Measurements Tab UI (PBI-ANA-081)

**Goal:** Add MeasurementsTab as the 3rd tab in AnalyticsHubView — master-detail layout with create/edit/delete.

| File | Action | ~LOC |
|------|--------|------|
| `src/ui/analytics/MeasurementsTab.ts` | **New** — full tab implementation | +606 |
| `src/ui/AnalyticsHubView.ts` | 3rd tab registration | +57 |
| `src/ui/analytics/types.ts` | Tab deps update | +14 |

**Features:**
- Master list with name, type badge, query name, favorite toggle
- Detail panel: name edit, description, query selector, type toggle (single/series), measureColumn dropdown
- measureColumn dropdown populated from query's measures with labels
- Favorite toggle, delete with confirmation

---

### Inc 3: Measurement-Tile Integration (PBI-ANA-082)

**Goal:** Allow dashboard tiles to reference measurements instead of direct queries. The measurement's `queryId` drives the tile's data, and `filterResultForMeasurement()` narrows the result.

| File | Action | ~LOC |
|------|--------|------|
| `src/ui/analytics/DashboardsTab.ts` | Measurement lookup + `filterResultForMeasurement()` | +80 |
| `src/ui/analytics/AnalyticsDashboardPage.ts` | Same pattern for homepage | +44 |
| `src/ui/analytics/DashboardTileRenderer.ts` | Measurement display format | +16 |
| `src/ui/analytics/TileSettingsPanel.ts` | Measurement format controls | +26 |
| `src/ui/analytics/AddTileDialog.ts` | Measurement picker in add-tile flow | +291 |
| `src/ui/analytics/DashboardQueryMap.ts` | Measurement-aware query mapping | +56 |

**Key design:**
- `DashboardTile.measurementId?: string` — optional; when set, tile uses measurement's `queryId`
- `filterResultForMeasurement(result, measurement, query)` — pure utility that filters columns
- AddTileDialog offers both query-based and measurement-based tile creation

**Tests:** +15 (DashboardCrud, AnalyticsService)

---

### Inc 4: Query Builder Consolidation (PBI-ANA-083 / TD-ANA-004)

**Goal:** Merge SchemaPanel into QueryBuilderPanel — eliminate separate component, integrate column type display directly into the builder.

| File | Action | ~LOC |
|------|--------|------|
| `src/ui/analytics/queries/QueryBuilderPanel.ts` | Major rework — schema integrated | +543/−200 |
| `src/ui/analytics/queries/SchemaPanel.ts` | **Deleted** | −142 |
| `src/ui/analytics/QueriesTab.ts` | Remove SchemaPanel usage | +79 |
| `src/ui/analytics/queries/SourcePanel.ts` | Adjusted interfaces | +20 |
| `src/ui/analytics/queries/types.ts` | Updated deps | +5 |

---

### Inc 5: Computed Columns Section Rework (PBI-ANA-084)

**Goal:** Improve the computed columns editing experience with function reference, better layout, and expression help.

| File | Action | ~LOC |
|------|--------|------|
| `src/ui/analytics/queries/ComputedColumnsSection.ts` | Major rework | +279 |
| `src/ui/analytics/queries/ActionsBar.ts` | Adjusted integration | +60 |
| `src/ui/analytics/queries/FilterBuilderPanel.ts` | Minor adjustments | +11 |

---

### Inc 6: Source Type Settings (PBI-ANA-085)

**Goal:** Add csv-folder source type support and per-source locale configuration in settings.

| File | Action | ~LOC |
|------|--------|------|
| `src/domain/settings/FlowtiSettingTab.ts` | Source type setting | +21 |
| `src/domain/settings/SettingsService.ts` | New setting accessors | +5 |
| `src/domain/settings/settings.ts` | Setting definition | +1 |
| `src/domain/settings/events.ts` | Setting changed event | +2 |

---

## Success Metrics

| Metric | Target | Actual |
|--------|--------|--------|
| New tests | ~40 | 35 |
| Post-cycle total tests | ~4,790 | 4,786 |
| Post-cycle suites | 199 | 199 |
| New source LOC (net) | ~1,700 | ~1,870 |
| AnalyticsHubView tabs | 2 → 3 | 3 (Dashboards, Queries, Measurements) |
| MeasurementsTab | New (606 LOC) | Delivered |
| measurementHandlers | New (114 LOC) | Delivered |
| SchemaPanel | Merged into QueryBuilderPanel | Deleted (−142 LOC) |
| PRD version | v14 | v14 (no FR change) |

## Definition of Ready (Pre-Cycle)

- [x] Cycle 39 delivered — all bugs addressed, 4,751 tests green
- [x] PRD v14 stable — 94 FRs all delivered
- [x] Measurement concept validated through user testing ("I want a single number, not the whole query")
- [x] SchemaPanel consolidation identified as tech debt (142 LOC separate component adds navigation friction)
- [x] No blocking dependencies from other domains

## Definition of Done

- [x] All 4,786 tests passing (199 suites)
- [x] No lint errors, no type errors
- [x] Measurements domain model complete (types, handlers, service, events)
- [x] MeasurementsTab operational (3rd tab in Analytics Hub)
- [x] Measurement-tile integration working (single + series types)
- [x] QueryBuilderPanel consolidated (SchemaPanel merged)
- [x] Computed columns section reworked
- [x] Source type settings added
- [x] Cycle document created

## Retrospective

### What Went Well

1. **Measurement abstraction landed cleanly** — the handler extraction pattern from Cycle 38 (dashboardHandlers) made measurement CRUD straightforward to implement
2. **filterResultForMeasurement** as a pure utility function kept the rendering pipeline clean — no changes needed in DashboardTileRenderer itself
3. **SchemaPanel consolidation** eliminated a navigation step — users now see column types directly in the query builder

### What Could Improve

1. **filterResultForMeasurement for single-type** only filters columns, not rows — a "single" measurement from a grouped/bucketed query still shows all rows instead of one aggregated value (to be fixed in Cycle 41)
2. **AddTileDialog rework** was larger than expected (+291 LOC) — the measurement picker flow added significant UI complexity
3. **ComputedColumnsSection rework** was coupled to QueryBuilderPanel changes — should have been planned as dependent increments

### Observations

- **OBS-1**: The measurement abstraction bridges queries and dashboards — users can now define "Total Revenue" once and reuse it across tiles
- **OBS-2**: csv-folder source type opens the door for batch analytics but needs a folder scanner utility (future cycle)
- **OBS-3**: The QueryBuilderPanel is now the largest analytics UI file after the rework — monitor LOC

### Action Items

| ID | Action | Priority | Target |
|----|--------|----------|--------|
| AI-1 | filterResultForMeasurement: single-type should aggregate into one row | High | Cycle 41 |
| AI-2 | Cascade delete: query deletion leaves orphan measurements | High | Cycle 41 |
| AI-3 | TileResultCache has no TTL or size limit | Medium | Cycle 41 |
| AI-4 | No string expression functions (UPPER, LOWER, CONCAT, COALESCE) | Medium | Cycle 41 |
