---
type: ProductBacklogItem
feature: "[[Analytics Hub PRD]]"
stage: done
priority: critical
dependencies: []
tags:
  - analytics
  - filter
  - dashboard
planned_in: "[[Cycle 36 - Dashboard Filtering]]"
delivered_in: "[[Cycle 36 - Dashboard Filtering]]"
---

# PBI-ANA-056: Dashboard Filter UI

## User Story

As a Supplier Manager, I want multi-select filter dropdowns on my dashboard so that I can narrow down all tiles to specific suppliers, categories, or time periods without editing each query individually.

## Solution Statement

Add a dashboard-level filter bar with multi-select dimension filter dropdowns. Filters are discovered by scanning the dimension columns across all tiles on the active dashboard, using cascading discovery to narrow available filter options based on current selections.

**Implementation details:**
- Filter bar rendered above the tile grid on the dashboard page
- Each dimension column discovered across dashboard tiles gets a dropdown
- Multi-select toggle: clicking a value toggles its inclusion in the filter
- Label shows "N selected" when multiple values are active
- Cascading dimension discovery: selecting values in one filter narrows the available values in subsequent filters based on the filtered data
- Filter state is transient (not persisted) — resets on dashboard switch

## Acceptance Criteria

- [x] Multi-select filter dropdowns rendered in dashboard filter bar
- [x] Toggle selection adds/removes values from active filter
- [x] "N selected" label displayed when multiple values are selected
- [x] Cascading dimension discovery narrows filter options based on active selections
- [x] Filter bar shows only dimension columns present across dashboard tiles
- [x] `npm test` passes

## Related

- PRD: [[Analytics Hub PRD]] (v10)
- Cycle: [[Cycle 36 - Dashboard Filtering]] (Inc 3)
- Enables: [[PBI-ANA-057 Filter Propagation to Tiles]] (filter execution)
- Enables: [[PBI-ANA-058 Tile Drill-Down]] (click-to-filter interaction)
