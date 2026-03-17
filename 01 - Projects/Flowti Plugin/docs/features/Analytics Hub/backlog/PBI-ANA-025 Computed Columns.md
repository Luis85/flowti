---
type: ProductBacklogItem
pbi: PBI-ANA-025
title: Computed Columns
domain: analytics
feature: "[[Analytics Hub PRD]]"
stage: delivered
delivered_in: "[[Cycle 31 - Analytics Business Intelligence]]"
priority: critical
planned_in: "[[Cycle 31 - Analytics Business Intelligence]]"
related:
  - "[[PBI-ANA-020 Query Power Features]]"
  - "[[Supplier Manager]]"
functional_requirements:
  - FR-29
  - FR-30
tags:
  - analytics
  - engine
  - business-intelligence
---

# PBI-ANA-025: Computed Columns

## User Story

As a Supplier Manager, I want to define arithmetic expressions on my query result columns (e.g., `{Total Revenue} - {Total Cost}` → "Profit") so that I can see derived business metrics like profit and margin directly in my dashboard without exporting to a spreadsheet.

## Functional Requirements

- **FR-29**: User can add computed columns to a query with a name and arithmetic expression referencing result column labels
- **FR-30**: Analytics engine evaluates computed column expressions after aggregation and includes computed values in result rows

## Acceptance Criteria

- [ ] `ComputedColumn` type: `{ name: string; expression: string }` added to domain types
- [ ] `computedColumns?: ComputedColumn[]` added to `AnalyticsQuery` and `SavedAnalyticsQuery`
- [ ] Engine evaluates expressions after aggregation step (between group+aggregate and sort)
- [ ] Expression format: `{Column Label}` references, operators `+`, `-`, `*`, `/`
- [ ] Safe evaluation: no `eval()` — tokenizer+calculator approach
- [ ] Division by zero returns 0 (no crash)
- [ ] Computed columns appear in result table and stat-card tiles
- [ ] Computed columns persist in saved queries (save and update paths)
- [ ] UI: "Add Computed Column" section in query builder with name + expression inputs
- [ ] UI: helper text shows available column labels
- [ ] UI: remove button per computed column
- [ ] `npm test` passes

## Architecture

- `ComputedColumn` type in `src/domain/analytics/types.ts`
- Engine step `applyComputedColumns()` in `AnalyticsEngine.ts`
- Expression evaluator: regex parse `{...}` references → replace with numeric values → tokenize arithmetic → calculate
- UI section in `QueriesTab.ts` below measures
- Service threads `computedColumns` through save/update

## Test Intent

~15 tests:
- Expression parsing (single column, multi-column, nested arithmetic)
- Arithmetic evaluation (+, -, *, /)
- Division by zero → 0
- Invalid column reference → 0
- Empty expression → skip
- Persistence in saved query
- Integration with stat-card and table rendering

## Dependencies

- None (builds on existing engine pipeline)

## Estimated LOC

~155 (80 engine + 60 UI + 15 types/service)
