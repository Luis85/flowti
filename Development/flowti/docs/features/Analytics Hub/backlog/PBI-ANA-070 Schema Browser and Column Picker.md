---
type: ProductBacklogItem
feature: "[[Analytics Hub PRD]]"
stage: done
priority: critical
dependencies: []
tags:
  - analytics
  - schema
  - query-builder
planned_in: "[[Cycle 38 - Query Builder Improvements]]"
delivered_in: "[[Cycle 38 - Query Builder Improvements]]"
---

# PBI-ANA-070: Schema Browser and Column Picker

## User Story

As a Supplier Manager, I want to browse the columns available in my data sources and quickly insert them into my query, so that I can build queries faster without memorizing column names or switching between tabs.

## Solution Statement

Add a collapsible schema panel to the query builder and extract a reusable column picker utility used across all column-selection dropdowns.

**Schema Panel (`SchemaPanel.ts`, ~140 LOC):**
- Collapsible panel showing all columns from the active query sources
- Columns grouped by type (string, number, date) with type icons
- Source badges when multiple sources are joined — shows which source each column belongs to
- Click-to-insert: clicking a column name inserts the `{Column Name}` reference at the cursor position in the active expression/dimension/measure input

**Column Picker (`columnPicker.ts`, ~105 LOC):**
- Reusable utility function for rendering column selection dropdowns
- Used by dimension picker, measure picker, filter column selector, and sort column selector
- Consistent column display with type indicators across all query builder sections
- Replaces duplicated dropdown rendering logic in QueryBuilderPanel

## Acceptance Criteria

- [x] Schema panel shows columns grouped by type with source badges
- [x] Column picker utility used in dimension/measure/filter/sort dropdowns
- [x] Click-to-insert inserts column reference into active input
- [x] Columns display type indicators consistently across all dropdowns
- [x] `npm test` passes

## Related

- PRD: [[Analytics Hub PRD]] (v13)
- Cycle: [[Cycle 38 - Query Builder Improvements]] (Inc 1)
- Enables: [[PBI-ANA-071 Visual Filter Builder]], [[PBI-ANA-076 Enhanced Quick Insights and UX Polish]]
