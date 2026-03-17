---
type: ProductBacklogItem
feature: "[[Analytics Hub PRD]]"
stage: done
priority: high
dependencies:
  - "[[PBI-ANA-060 Query-by-Source Service]]"
  - "[[PBI-ANA-061 Dashboard Query Map]]"
  - "[[PBI-ANA-062 CSV Analytics Section]]"
  - "[[PBI-ANA-063 CSV File-Menu Analyze]]"
  - "[[PBI-ANA-064 Source Pre-Selection]]"
tags:
  - analytics
  - flow-test
  - cross-domain
planned_in: "[[Cycle 37 - Cross-Domain Analytics]]"
delivered_in: "[[Cycle 37 - Cross-Domain Analytics]]"
---

# PBI-ANA-065: Cross-Domain Flow Test

## User Story

As a developer, I want an end-to-end integration test covering the cross-domain analytics workflow so that all Cycle 37 features are verified working together — from CSV file context through source pre-selection to dashboard query maps.

## Solution Statement

Create Flow 37 integration test covering the cross-domain analytics workflow: query-by-source lookups, dashboard query maps, CSV analytics sections, file-menu analyze action, and source pre-selection.

**Test file:** `tests/flows/37-CrossDomainAnalytics.test.ts`

**Workflow under test:**
1. Create and save multiple queries referencing different CSV sources
2. Verify `getQueriesBySource()` returns correct queries per CSV path
3. Create dashboard with tiles from multiple queries
4. Verify `getDashboardQueryMap()` returns correct query-tile associations
5. Simulate CSV landing page analytics section rendering
6. Simulate file-menu "Analyze" navigation
7. Verify source pre-selection in Queries tab
8. Verify related queries shown in master list after navigation
9. Verify empty states for CSV files with no queries

**PRD update:** Analytics Hub PRD updated to v12.

## Acceptance Criteria

- [x] Flow 37 passes (26 tests)
- [x] Cross-domain integration between CSV and Analytics covered
- [x] Query-by-source and dashboard query map lookups verified
- [x] Source pre-selection and navigation verified
- [x] Empty states and edge cases covered
- [x] Analytics Hub PRD updated to v12
- [x] `npm test` passes

## Related

- PRD: [[Analytics Hub PRD]] (v12 update)
- Cycle: [[Cycle 37 - Cross-Domain Analytics]] (Inc 6)
- Depends on: [[PBI-ANA-060 Query-by-Source Service]], [[PBI-ANA-061 Dashboard Query Map]], [[PBI-ANA-062 CSV Analytics Section]], [[PBI-ANA-063 CSV File-Menu Analyze]], [[PBI-ANA-064 Source Pre-Selection]]
- Pattern: Follows [[36-DrillDownFiltering.test.ts]], [[33-TrendIntelligence.test.ts]] flow test conventions
