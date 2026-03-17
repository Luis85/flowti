---
type: ProductBacklogItem
feature: "[[Analytics Hub PRD]]"
stage: done
priority: high
dependencies:
  - "[[PBI-ANA-070 Schema Browser and Column Picker]]"
  - "[[PBI-ANA-072 Multi-Column Sort]]"
tags:
  - analytics
  - quick-insights
  - ux
planned_in: "[[Cycle 38 - Query Builder Improvements]]"
delivered_in: "[[Cycle 38 - Query Builder Improvements]]"
---

# PBI-ANA-076: Enhanced Quick Insights and UX Polish

## User Story

As a Supplier Manager, I want smarter quick insight suggestions and quality-of-life UX improvements so that I can build queries faster with contextual shortcuts and visual cues.

## Solution Statement

Add three new quick insight rules (expanding from 3 to 6 total), integrate schema click-to-insert, and add several UX polish items.

**New Quick Insight Rules (`quickInsights.ts`, +2 rules):**
- **Top 5**: when a numeric column and a string dimension are available, suggest "Top 5 {dimension} by {measure}" — adds sort descending + limit 5
- **Distribution**: when two text/string columns are available, suggest a count-based distribution query grouping by both dimensions

**UX Polish:**
- **Schema click-to-insert**: clicking a column name in the schema panel inserts `{Column Name}` at cursor position in the active expression input (wired from ANA-070)
- **Filter/sort count badges**: filter and sort section headers show count badges (e.g., "Filters (2)", "Sort (3)") when active
- **Ctrl+Enter shortcut**: keyboard shortcut to execute query from anywhere in the query builder

**Total insight rules (6):** Total, Count, Over Time, Average, Top 5, Distribution.

## Acceptance Criteria

- [x] 6 total insight rules including Top 5 and Distribution
- [x] Top 5 insight adds sort descending + limit 5
- [x] Distribution insight groups by two text columns with count
- [x] Schema click-to-insert works for expression inputs
- [x] Filter and sort count badges displayed in section headers
- [x] Ctrl+Enter shortcut executes query
- [x] `npm test` passes

## Related

- PRD: [[Analytics Hub PRD]] (v13)
- Cycle: [[Cycle 38 - Query Builder Improvements]] (Inc 7)
- Depends on: [[PBI-ANA-070 Schema Browser and Column Picker]] (click-to-insert wiring)
- Depends on: [[PBI-ANA-072 Multi-Column Sort]] (sort count badges)
- Extends: [[PBI-ANA-026 Quick Insights]] (adds 3 new rules)
