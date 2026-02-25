---
type: ProductBacklogItem
feature: "[[Analytics Hub PRD]]"
stage: done
priority: high
dependencies:
  - "[[PBI-ANA-060 Query-by-Source Service]]"
tags:
  - analytics
  - navigation
  - queries
planned_in: "[[Cycle 37 - Cross-Domain Analytics]]"
delivered_in: "[[Cycle 37 - Cross-Domain Analytics]]"
---

# PBI-ANA-064: Source Pre-Selection

## User Story

As a Supplier Manager, I want the Analytics Hub to automatically select the CSV source when I navigate from a CSV file context, so that I can start building queries immediately without manual source selection.

## Solution Statement

Override `onNavigateToEntity` in AnalyticsHubView to handle navigation from CSV file contexts. When a CSV path is passed as the navigation entity, the Queries tab opens with that source auto-added to the source picker. Additionally, the master list shows related saved queries for the navigated source.

**Implementation details:**
- `onNavigateToEntity(entityPath)` override in AnalyticsHubView
- Switches to Queries tab and passes the entity path to QueriesTab as a pre-selected source
- QueriesTab auto-adds the source to the source picker if not already present
- Master list filters/highlights saved queries that reference the pre-selected source using `getQueriesBySource()`
- Works with navigation from file-menu (ANA-063), CSV landing page (ANA-062), and any other `navigateToEntity` caller

## Acceptance Criteria

- [x] Navigation from CSV auto-adds the source to the Queries tab source picker
- [x] Related saved queries shown in the master list for the navigated source
- [x] Works with file-menu and CSV landing page navigation
- [x] `npm test` passes

## Related

- PRD: [[Analytics Hub PRD]] (v12)
- Cycle: [[Cycle 37 - Cross-Domain Analytics]] (Inc 5)
- Depends on: [[PBI-ANA-060 Query-by-Source Service]] (getQueriesBySource for related queries)
- Integrates with: [[PBI-ANA-062 CSV Analytics Section]], [[PBI-ANA-063 CSV File-Menu Analyze]]
