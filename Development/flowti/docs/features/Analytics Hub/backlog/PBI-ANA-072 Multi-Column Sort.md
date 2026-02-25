---
type: ProductBacklogItem
feature: "[[Analytics Hub PRD]]"
stage: done
priority: high
dependencies:
  - "[[PBI-ANA-070 Schema Browser and Column Picker]]"
tags:
  - analytics
  - sort
  - query-builder
planned_in: "[[Cycle 38 - Query Builder Improvements]]"
delivered_in: "[[Cycle 38 - Query Builder Improvements]]"
---

# PBI-ANA-072: Multi-Column Sort

## User Story

As a Supplier Manager, I want to sort my query results by multiple columns with independent sort directions so that I can create meaningful data orderings like "sort by Category ascending, then by Cost descending."

## Solution Statement

Migrate the query sort model from a single `SortSpec` to `SortSpec[]` and update the engine and UI to support multi-column sorting with independent direction per column.

**Implementation details:**
- **Type migration**: `AnalyticsQuery.sort` and `SavedAnalyticsQuery.sort` change from `SortSpec` to `SortSpec[]`
- **Backward compatibility**: on state load, if `sort` is a single `SortSpec` object (not an array), it is wrapped in an array — no data loss
- **Engine update**: `AnalyticsEngine` applies sort specs in order (first sort is primary, subsequent are tiebreakers)
- **UI update**: sort section shows multiple sort rows, each with column dropdown and direction toggle (asc/desc), with add/remove controls
- **Column picker**: uses `columnPicker` utility from ANA-070

## Acceptance Criteria

- [x] Multi-column sort with independent direction per column
- [x] `SortSpec[]` migration from legacy single `SortSpec` on state load
- [x] Backward compatible — existing saved queries with single sort work without migration issues
- [x] Sort rows can be added and removed in the UI
- [x] Engine applies multi-column sort in correct priority order
- [x] `npm test` passes

## Related

- PRD: [[Analytics Hub PRD]] (v13)
- Cycle: [[Cycle 38 - Query Builder Improvements]] (Inc 3)
- Depends on: [[PBI-ANA-070 Schema Browser and Column Picker]] (columnPicker for sort column dropdown)
- Enables: [[PBI-ANA-076 Enhanced Quick Insights and UX Polish]] (sort count badges)
