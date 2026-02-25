---
type: ProductBacklogItem
feature: "[[Analytics Hub PRD]]"
stage: done
priority: high
dependencies:
  - "[[PBI-ANA-120 Source Manager Extraction]]"
  - "[[PBI-ANA-121 Render Performance]]"
  - "[[PBI-ANA-122 Dashboard Breadcrumb Navigation]]"
  - "[[PBI-ANA-123 Filter Row-Count Preview]]"
  - "[[PBI-ANA-124 TileRenderContext Simplification]]"
  - "[[PBI-ANA-125 CSS & Style Consolidation]]"
tags:
  - analytics
  - flow-test
  - integration
planned_in: "[[Cycle 43 - Analytics Hub Performance & Navigation]]"
delivered_in: "[[Cycle 43 - Analytics Hub Performance & Navigation]]"
---

# PBI-ANA-126: Analytics Flow Integration Tests

## User Story
Create 3 flow integration test suites covering the analytics query pipeline, dashboard lifecycle, and source manager — completing test coverage for Cycle 43 deliverables.

## Solution Statement
Three test files:
- Flow 17: Analytics Query Pipeline (8 tests) — query execution, save/reload, filters, events, caching
- Flow 18: Dashboard Lifecycle (10 tests) — dashboard CRUD, tiles, filters, favorites, defaults, presets, events
- Flow 19: Source Manager (17 tests) — source CRUD, async loading, alias dedup, type hints, headers, saved sources, errors, locale

## Acceptance Criteria
- [x] Flow 17 passes (8 tests)
- [x] Flow 18 passes (10 tests)
- [x] Flow 19 passes (17 tests)
- [x] 85 new tests total across all 3 flows
- [x] 4,941 tests passing (206 suites)
- [x] `npm test` passes

## Related
- PRD: [[Analytics Hub PRD]] (v16)
- Cycle: [[Cycle 43 - Analytics Hub Performance & Navigation]] (Inc 7)
- Test files: [[17-AnalyticsQueryPipeline.test.ts]], [[18-DashboardLifecycle.test.ts]], [[19-SourceManagerFlow.test.ts]]
