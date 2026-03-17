---
type: ProductBacklogItem
feature: "[[Analytics Hub PRD]]"
stage: done
priority: critical
dependencies: []
tags:
  - analytics
  - extraction
  - tech-debt
planned_in: "[[Cycle 36 - Dashboard Filtering]]"
delivered_in: "[[Cycle 36 - Dashboard Filtering]]"
---

# PBI-ANA-054: TileRenderer Extraction

## User Story

As a developer, I want the TileSettingsPanel extracted from DashboardTileRenderer so that the renderer focuses solely on tile rendering while settings configuration lives in its own focused component, keeping both under manageable LOC thresholds.

## Solution Statement

DashboardTileRenderer has grown to 794 LOC across Cycles 32-35, combining tile rendering logic with conditional formatting settings UI, display mode configuration, and tile metadata editing. This violates the single-responsibility principle and makes both rendering and settings harder to evolve independently.

Extract `TileSettingsPanel.ts` as a new sub-component under `src/ui/analytics/`:
- **TileSettingsPanel** owns: conditional formatting rule builder UI, display mode picker, tile title/description editing, chart value column selector, auto-height toggle, row limit input, sparkline toggle
- **DashboardTileRenderer** retains: tile container rendering, table/stat-card/chart dispatch, conditional rule evaluation and color application, sparkline SVG generation

The extraction follows the established `constructor(el, deps)` + `render()` pattern used by other analytics sub-components (SourcePanel, QueryBuilderPanel, etc.).

## Acceptance Criteria

- [x] TileSettingsPanel.ts extracted as standalone component
- [x] DashboardTileRenderer reduced from 794 to under 600 LOC
- [x] Conditional formatting rule builder UI lives in extracted panel
- [x] All existing tile rendering behavior preserved — zero functional changes
- [x] All existing tests pass without modification
- [x] `npm test` passes

## Related

- PRD: [[Analytics Hub PRD]] (v10)
- Cycle: [[Cycle 36 - Dashboard Filtering]] (Inc 1)
- Enables: [[PBI-ANA-055 Pie Chart Visualization]] (cleaner renderer for new chart type)
- Pattern: Follows [[PBI-ANA-030 QueriesTab Extraction]] extraction approach
