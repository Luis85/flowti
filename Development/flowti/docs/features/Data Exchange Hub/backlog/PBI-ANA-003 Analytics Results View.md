---
type: ProductBacklogItem
feature: "[[Data Exchange Hub PRD]]"
stage: done
date_completed: 2026-02-23
delivered_in: "[[Cycle 27 - Analytics Sprint]]"
priority: critical
dependencies:
  - "[[PBI-ANA-001 Analytics Engine Core]]"
  - "[[PBI-ANA-002 Analytics Query Builder UI]]"
tags:
  - data-exchange
  - analytics
  - ui
planned_in: "[[Cycle 27 - Analytics Sprint]]"
user_story: "[[When opening a CSV with Flowti, I want to be able to make an easy dashboard]]"
---

## User Story - Problemspace

As a user, I want to see analytics results in a clear table with summary stats, and optionally export them as CSV or import them as notes.

### User Pains

- No way to view aggregated results within the vault
- No summary statistics after running a query
- No export of aggregated data for downstream delivery
- No way to turn analytics results into vault notes for further linking

### User Needs

- Sortable results table with dimension + measure columns
- Summary stat cards (row count, group count, primary measure total)
- Export results as CSV file
- Import results as vault notes (optional)
- Navigate back to query builder with state preserved

## Solutionstatement

### Functional Requirements

- [x] Results table with columns from dimensions + measures
- [x] Sortable columns (click header to toggle asc/desc)
- [x] Summary stat cards: row count, group count, primary measure total
- [x] "Export as CSV" button generates valid CSV file
- [ ] ~~"Import as Notes" button creates one note per result row~~ — deferred to Cycle 28
- [x] "Back to Query" button preserves query state
- [x] Empty result shows meaningful empty state message

### Architecture

- `src/ui/hub/AnalyticsResultsPanel.ts` — standalone component
- Reuses `renderStatGrid` from `src/ui/shared/StatCard`
- Export via `CsvParser.generate()` or direct string building
- Import via existing ImportService pattern

## Acceptance Criteria

- [x] Results table renders with correct columns and values
- [x] Columns are sortable (click to toggle asc/desc)
- [x] Summary stat cards show row count, group count, source rows, duration
- [x] "Export as CSV" generates valid CSV file (clipboard copy)
- [ ] ~~"Import as Notes" creates notes from result rows~~ — deferred to Cycle 28
- [x] "Back to Query" preserves query state — query builder and results coexist in detail panel
- [x] Empty result shows meaningful empty state
- [x] `npm test` passes

## Test Intent

~15 tests: table rendering (4), sorting (3), stat cards (2), export (2), import as notes (2), empty state (1), navigation (1).

## Related

- PRD: [[Data Exchange Hub PRD]]
- Cycle: [[Cycle 27 - Analytics Sprint]]
- Depends on: [[PBI-ANA-001 Analytics Engine Core]], [[PBI-ANA-002 Analytics Query Builder UI]]
