---
type: ProductBacklogItem
feature: "[[Analytics Hub PRD]]"
stage: done
priority: high
dependencies:
  - "[[PBI-ANA-060 Query-by-Source Service]]"
tags:
  - analytics
  - csv
  - cross-domain
planned_in: "[[Cycle 37 - Cross-Domain Analytics]]"
delivered_in: "[[Cycle 37 - Cross-Domain Analytics]]"
---

# PBI-ANA-062: CSV Analytics Section

## User Story

As a Supplier Manager, I want to see analytics coverage directly on my CSV file's landing page so that I can discover existing queries, create new ones, and navigate to the Analytics Hub without leaving my data context.

## Solution Statement

Add an analytics section to the CsvLanding detail view that shows queries referencing the current CSV file. When queries exist, they are listed with names and quick navigation links. When no queries exist, an empty state with a "Create Query" action is shown.

**Implementation details:**
- Analytics section rendered in the CSV detail panel using `getQueriesBySource()` from ANA-060
- Query list shows saved query names with click-to-navigate to the Analytics Hub
- Auto-summary: count of queries and dashboards referencing this CSV
- Empty state: "No analytics queries reference this file" with a "Create Query" button that navigates to the Analytics Hub with the source pre-selected
- Navigation uses the existing `navigateToEntity` pattern

## Acceptance Criteria

- [x] CSV detail shows analytics section with queries referencing the file
- [x] Empty state shows "Create Query" action when no queries exist
- [x] Query names are clickable and navigate to the Analytics Hub
- [x] Auto-summary displays query and dashboard counts
- [x] `npm test` passes

## Related

- PRD: [[Analytics Hub PRD]] (v12)
- Cycle: [[Cycle 37 - Cross-Domain Analytics]] (Inc 3)
- Depends on: [[PBI-ANA-060 Query-by-Source Service]] (getQueriesBySource)
- Related: [[PBI-ANA-064 Source Pre-Selection]] (navigation target)
