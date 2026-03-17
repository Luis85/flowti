---
type: ProductBacklogItem
feature: "[[Analytics Hub PRD]]"
stage: done
priority: critical
dependencies:
  - "[[PBI-ANA-070 Schema Browser and Column Picker]]"
tags:
  - analytics
  - filter
  - query-builder
planned_in: "[[Cycle 38 - Query Builder Improvements]]"
delivered_in: "[[Cycle 38 - Query Builder Improvements]]"
---

# PBI-ANA-071: Visual Filter Builder

## User Story

As a Supplier Manager, I want a visual filter builder with type-aware operators and value suggestions so that I can build query filters intuitively without knowing the exact syntax or available values.

## Solution Statement

Replace the raw filter input with a structured `FilterBuilderPanel` that provides type-aware operator selection and value suggestions.

**FilterBuilderPanel (`FilterBuilderPanel.ts`, ~140 LOC):**
- Each filter row shows: column dropdown, operator dropdown, value input
- Operator dropdown is type-aware:
  - String columns: equals, not equals, contains, starts with, ends with
  - Number columns: equals, not equals, greater than, less than, greater than or equal, less than or equal
  - Date columns: equals, before, after, between
- Value input for string columns includes a `<datalist>` populated with distinct values from the source data, providing auto-complete suggestions
- Add/remove filter rows with "+" and "x" buttons
- Uses `columnPicker` utility from ANA-070 for the column dropdown

## Acceptance Criteria

- [x] Filter builder shows type-appropriate operators per column type
- [x] String columns have value datalist for auto-complete suggestions
- [x] Number columns show numeric comparison operators
- [x] Date columns show temporal operators
- [x] Filter rows can be added and removed
- [x] `npm test` passes

## Related

- PRD: [[Analytics Hub PRD]] (v13)
- Cycle: [[Cycle 38 - Query Builder Improvements]] (Inc 2)
- Depends on: [[PBI-ANA-070 Schema Browser and Column Picker]] (columnPicker utility)
- Enables: [[PBI-ANA-075 QueriesTab Source and Actions Extraction]] (cleaner filter UI for extraction)
