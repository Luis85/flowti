---
type: ProductBacklogItem
feature: "[[Data Exchange Hub PRD]]"
stage: planned
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

- [ ] Results table with columns from dimensions + measures
- [ ] Sortable columns (click header to toggle asc/desc)
- [ ] Summary stat cards: row count, group count, primary measure total
- [ ] "Export as CSV" button generates valid CSV file
- [ ] "Import as Notes" button creates one note per result row
- [ ] "Back to Query" button preserves query state
- [ ] Empty result shows meaningful empty state message

### Architecture

- `src/ui/hub/AnalyticsResultsPanel.ts` — standalone component
- Reuses `renderStatGrid` from `src/ui/shared/StatCard`
- Export via `CsvParser.generate()` or direct string building
- Import via existing ImportService pattern

## Acceptance Criteria

- [ ] Results table renders with correct columns and values
- [ ] Columns are sortable (click to toggle asc/desc)
- [ ] Summary stat cards show row count, group count, primary measure total
- [ ] "Export as CSV" generates valid CSV file
- [ ] "Import as Notes" creates notes from result rows
- [ ] "Back to Query" preserves query state
- [ ] Empty result shows meaningful empty state
- [ ] `npm test` passes

## Test Intent

~15 tests: table rendering (4), sorting (3), stat cards (2), export (2), import as notes (2), empty state (1), navigation (1).

## Related

- PRD: [[Data Exchange Hub PRD]]
- Cycle: [[Cycle 27 - Analytics Sprint]]
- Depends on: [[PBI-ANA-001 Analytics Engine Core]], [[PBI-ANA-002 Analytics Query Builder UI]]
