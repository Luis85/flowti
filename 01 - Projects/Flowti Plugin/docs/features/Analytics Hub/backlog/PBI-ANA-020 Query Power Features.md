---
type: ProductBacklogItem
feature: "[[Analytics Hub PRD]]"
stage: delivered
delivered_in: "[[Cycle 30 - Analytics UX Mastery]]"
priority: critical
dependencies: []
tags:
  - analytics
  - query
  - filters
planned_in: "[[Cycle 30 - Analytics UX Mastery]]"
user_story: "[[Supplier Manager]]"
---

## User Story - Problemspace

As a Supplier Manager who has built queries, I want to filter results (e.g. "show only Electronics"), sort by any column, and limit row count — so that I can focus on exactly the data I need without scrolling through everything.

### User Pains

- Every query returns all rows — cannot filter to a single category or supplier
- No sort capability — finding "top 10" items requires mental scanning of unsorted results
- Large result sets are overwhelming — no way to cap output to a manageable number of rows

### User Needs

- WHERE-clause filtering: column + operator + value (=, !=, >, <, >=, <=, contains, startsWith)
- ORDER BY sorting: select column + direction (asc/desc)
- LIMIT: optional max row count
- Filters, sort, and limit persisted with saved queries

## Solutionstatement

### Functional Requirements

- [ ] FR-21: `FilterSpec` type with column, operator (8 operators), value
- [ ] FR-22: `SortSpec` type with column, direction (asc/desc)
- [ ] FR-23: `AnalyticsQuery` and `SavedAnalyticsQuery` extended with optional `filters`, `sort`, `limit` fields
- [ ] AnalyticsEngine pipeline: `applyFilters()` stage after joins (before grouping)
- [ ] AnalyticsEngine pipeline: `applySort()` + `applyLimit()` stages after aggregation
- [ ] QueriesTab: Filters section with add/remove filter rows (column + operator + value)
- [ ] QueriesTab: Sort dropdown (column + direction) and Limit number input
- [ ] Saved queries persist filters, sort, limit across save/load cycles

### Architecture

- `src/domain/analytics/types.ts` — Add `FilterSpec`, `FilterOperator`, `SortSpec`; extend `AnalyticsQuery` + `SavedAnalyticsQuery` (+30 LOC)
- `src/domain/analytics/AnalyticsEngine.ts` — Add `applyFilters()`, `applySort()`, `applyLimit()` pipeline stages (+80 LOC)
- `src/ui/analytics/QueriesTab.ts` — Filters section, sort/limit UI, save/load integration (+120 LOC)

## Acceptance Criteria

- [ ] Filters section in query builder: add/remove filter rows (column, operator, value)
- [ ] At least 8 operators: =, !=, >, <, >=, <=, contains, startsWith
- [ ] Sort dropdown: select column + direction (asc/desc)
- [ ] Limit input: optional max row count
- [ ] Engine applies filters before grouping (rows filtered out before aggregation)
- [ ] Engine sorts result rows after aggregation
- [ ] Engine limits output row count after sort
- [ ] Saved queries persist filters, sort, limit across save/load cycles
- [ ] Existing tests pass — no regressions
- [ ] `npm test` passes

## Test Intent

~20 tests: applyFilters with each operator type (8), filter on string vs number columns (2), applySort asc/desc (2), applyLimit (2), combined filter+sort+limit pipeline (2), empty filters no-op (1), save/load round-trip with filters (2), edge case limit=0 (1).

## Related

- PRD: [[Analytics Hub PRD]] (FR-21, FR-22, FR-23)
- Cycle: [[Cycle 30 - Analytics UX Mastery]]
- Persona: [[Supplier Manager]]
