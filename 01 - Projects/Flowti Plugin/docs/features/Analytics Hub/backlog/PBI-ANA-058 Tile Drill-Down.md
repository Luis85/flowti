---
type: ProductBacklogItem
feature: "[[Analytics Hub PRD]]"
stage: done
priority: high
dependencies:
  - "[[PBI-ANA-057 Filter Propagation to Tiles]]"
tags:
  - analytics
  - drill-down
  - dashboard
planned_in: "[[Cycle 36 - Dashboard Filtering]]"
delivered_in: "[[Cycle 36 - Dashboard Filtering]]"
---

# PBI-ANA-058: Tile Drill-Down

## User Story

As a Supplier Manager, I want to click on a value in a table cell or stat-card label to instantly filter the entire dashboard to that value, so that I can drill down into specific suppliers, categories, or time periods with a single click.

## Solution Statement

Add click-to-toggle filter interaction on string values within tiles. Clicking a dimension value in a table cell or stat-card label toggles that value as an active dashboard filter. Breadcrumb chips with clear buttons provide visibility into active drill-down filters.

**Implementation details:**
- Click handler on string-typed table cells and stat-card dimension labels
- Clicking a value toggles it in the corresponding dashboard filter (add if absent, remove if present)
- Breadcrumb chips rendered in the filter bar showing active drill-down values with a "x" clear button per chip
- Accent color visual feedback on the clicked element to indicate active filter state
- Drill-down filters integrate with dashboard-level multi-select filters — both contribute to the combined filter state
- Clearing a breadcrumb chip removes that value from the filter and triggers tile re-execution

## Acceptance Criteria

- [x] Clicking a table cell string value toggles a filter for that column/value
- [x] Clicking a stat-card dimension label toggles a filter for that value
- [x] Breadcrumb chips displayed with "x" clear button for each active drill-down filter
- [x] Accent color feedback shown on elements with active filter
- [x] Drill-down filters work in combination with dashboard-level multi-select filters
- [x] `npm test` passes

## Related

- PRD: [[Analytics Hub PRD]] (v10)
- Cycle: [[Cycle 36 - Dashboard Filtering]] (Inc 5)
- Depends on: [[PBI-ANA-057 Filter Propagation to Tiles]] (uses same filter propagation mechanism)
- Depends on: [[PBI-ANA-056 Dashboard Filter UI]] (breadcrumbs rendered in filter bar)
