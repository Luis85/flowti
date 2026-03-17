---
type: ProductBacklogItem
feature: "[[Analytics Hub PRD]]"
stage: done
priority: critical
dependencies:
  - "[[PBI-ANA-056 Dashboard Filter UI]]"
tags:
  - analytics
  - filter
  - query
planned_in: "[[Cycle 36 - Dashboard Filtering]]"
delivered_in: "[[Cycle 36 - Dashboard Filtering]]"
---

# PBI-ANA-057: Filter Propagation to Tiles

## User Story

As a Supplier Manager, I want my dashboard filter selections to immediately re-execute all tiles with the active filters so that every chart, table, and stat-card reflects the filtered subset of data.

## Solution Statement

Implement `runSavedQueryWithFilters()` to execute saved queries with additional filter predicates injected at runtime. When the user changes dashboard-level filters, all tiles re-execute their underlying queries with the active filter values applied.

**Implementation details:**
- `runSavedQueryWithFilters(queryId, filters)` method on AnalyticsService/Engine
- Multi-value filter execution: OR logic within a single column (e.g., Supplier = "A" OR "B"), AND logic across different columns (e.g., Supplier = "A" AND Category = "X")
- All tiles on the dashboard re-execute when filters change
- Filter values are injected as additional WHERE-equivalent predicates before aggregation
- Existing query filters are preserved — dashboard filters layer on top

## Acceptance Criteria

- [x] OR logic applied within a single column filter (multiple selected values)
- [x] AND logic applied across different column filters
- [x] All tiles re-execute with active filters when filter selection changes
- [x] Dashboard-level filters layer on top of existing query-level filters
- [x] `npm test` passes

## Related

- PRD: [[Analytics Hub PRD]] (v10)
- Cycle: [[Cycle 36 - Dashboard Filtering]] (Inc 4)
- Depends on: [[PBI-ANA-056 Dashboard Filter UI]] (filter UI provides filter state)
- Enables: [[PBI-ANA-058 Tile Drill-Down]] (drill-down uses same filter propagation)
