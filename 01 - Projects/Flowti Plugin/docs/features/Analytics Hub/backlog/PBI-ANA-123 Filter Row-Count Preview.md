---
type: ProductBacklogItem
feature: "[[Analytics Hub PRD]]"
stage: done
priority: high
dependencies:
  - "[[PBI-ANA-121 Render Performance]]"
tags:
  - analytics
  - filter
  - dashboard
planned_in: "[[Cycle 43 - Analytics Hub Performance & Navigation]]"
delivered_in: "[[Cycle 43 - Analytics Hub Performance & Navigation]]"
---

# PBI-ANA-123: Filter Row-Count Preview

## User Story
Show approximate row count badge in DashboardFilterBar before executing filtered queries so users know the impact of their filter selections (FR-96).

## Solution Statement
DashboardFilterBar displays "~N rows" badge next to active filters, computed from pre-aggregation row count estimation. Updates reactively as filters change.

## Acceptance Criteria
- [x] "~N rows" badge in DashboardFilterBar
- [x] Badge updates as filters change
- [x] Estimation based on pre-aggregation row counts
- [x] `npm test` passes

## Related
- PRD: [[Analytics Hub PRD]] (FR-96)
- Cycle: [[Cycle 43 - Analytics Hub Performance & Navigation]] (Inc 4)
