---
type: ProductBacklogItem
feature: "[[Analytics Hub PRD]]"
stage: done
priority: high
dependencies:
  - "[[PBI-ANA-054 TileRenderer Extraction]]"
  - "[[PBI-ANA-055 Pie Chart Visualization]]"
  - "[[PBI-ANA-056 Dashboard Filter UI]]"
  - "[[PBI-ANA-057 Filter Propagation to Tiles]]"
  - "[[PBI-ANA-058 Tile Drill-Down]]"
tags:
  - analytics
  - flow-test
planned_in: "[[Cycle 36 - Dashboard Filtering]]"
delivered_in: "[[Cycle 36 - Dashboard Filtering]]"
---

# PBI-ANA-059: Drill-Down Flow Test

## User Story

As a developer, I want an end-to-end integration test covering the drill-down, dashboard filtering, and multi-select flow so that all Cycle 36 features are verified working together correctly.

## Solution Statement

Create Flow 36 integration test covering the complete dashboard filtering workflow: pie chart rendering, multi-select filter dropdowns, filter propagation to tiles, and click-to-toggle drill-down with breadcrumb management.

**Test file:** `tests/flows/36-DrillDownFiltering.test.ts`

**Workflow under test:**
1. Create query with multi-dimensional CSV source
2. Execute query and save to dashboard
3. Add tiles in multiple display modes including pie-chart
4. Verify pie chart SVG rendering with "Other" grouping
5. Apply multi-select dashboard filter — verify tile re-execution with OR/AND logic
6. Click table cell value — verify drill-down filter toggles
7. Verify breadcrumb chips appear with clear buttons
8. Clear drill-down via breadcrumb — verify tiles reset
9. Combine dashboard-level and drill-down filters — verify combined filter state

## Acceptance Criteria

- [x] Flow 36 test passes (31 tests)
- [x] Drill-down click-to-filter covered in flow context
- [x] Multi-select dashboard filter covered in flow context
- [x] Pie chart rendering verified in flow context
- [x] Filter propagation (OR within column, AND across columns) verified
- [x] Breadcrumb chip management verified
- [x] `npm test` passes

## Related

- PRD: [[Analytics Hub PRD]] (v10)
- Cycle: [[Cycle 36 - Dashboard Filtering]] (Inc 6)
- Depends on: [[PBI-ANA-054 TileRenderer Extraction]], [[PBI-ANA-055 Pie Chart Visualization]], [[PBI-ANA-056 Dashboard Filter UI]], [[PBI-ANA-057 Filter Propagation to Tiles]], [[PBI-ANA-058 Tile Drill-Down]]
- Pattern: Follows [[33-TrendIntelligence.test.ts]], [[32-AnalyticsVisualization.test.ts]] flow test conventions
