---
type: ProductBacklogItem
feature: "[[Analytics Hub PRD]]"
stage: done
priority: critical
dependencies: []
tags:
  - analytics
  - service
  - cross-domain
planned_in: "[[Cycle 37 - Cross-Domain Analytics]]"
delivered_in: "[[Cycle 37 - Cross-Domain Analytics]]"
---

# PBI-ANA-060: Query-by-Source Service

## User Story

As a Supplier Manager, I want to see which analytics queries reference a specific CSV file so that I can understand the analytical coverage of my data sources and navigate between data management and analytics seamlessly.

## Solution Statement

Add two new service methods to AnalyticsService that enable cross-domain lookups between CSV sources and analytics artifacts:

- **`getQueriesBySource(csvPath: string)`**: returns all saved queries whose source references the given CSV file path. Enables the CSV landing page and file-menu to show related analytics.
- **`getDashboardQueryMap(dashboardId: string)`**: returns the unique saved queries used by a dashboard's tiles, along with tile counts per query. Enables the dashboard detail view to show which queries feed its tiles.

Both methods are pure lookups over the existing `savedAnalyticsQueries` and `dashboards` state — no new storage or events required.

## Acceptance Criteria

- [x] `getQueriesBySource(csvPath)` returns all saved queries matching the CSV path
- [x] `getDashboardQueryMap(dashboardId)` returns unique queries per dashboard with tile counts
- [x] Both methods handle empty/missing state gracefully (return empty arrays/maps)
- [x] `npm test` passes

## Related

- PRD: [[Analytics Hub PRD]] (v12)
- Cycle: [[Cycle 37 - Cross-Domain Analytics]] (Inc 1)
- Enables: [[PBI-ANA-061 Dashboard Query Map]], [[PBI-ANA-062 CSV Analytics Section]], [[PBI-ANA-063 CSV File-Menu Analyze]], [[PBI-ANA-064 Source Pre-Selection]]
