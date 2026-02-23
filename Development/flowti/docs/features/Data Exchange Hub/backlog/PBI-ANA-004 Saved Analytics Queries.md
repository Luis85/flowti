---
type: ProductBacklogItem
feature: "[[Data Exchange Hub PRD]]"
stage: done
date_completed: 2026-02-23
delivered_in: "[[Cycle 27 - Analytics Sprint]]"
priority: high
dependencies:
  - "[[PBI-ANA-001 Analytics Engine Core]]"
  - "[[PBI-ANA-002 Analytics Query Builder UI]]"
tags:
  - data-exchange
  - analytics
planned_in: "[[Cycle 27 - Analytics Sprint]]"
user_story: "[[When opening a CSV with Flowti, I want to be able to make an easy dashboard]]"
---

## User Story - Problemspace

As a user, I want to save analytics queries so I can rerun them when CSVs are updated — without reconfiguring sources, joins, locales, and measures every time.

### User Pains

- Reconfiguring a query from scratch after every CSV update is tedious
- No persistence of query configurations across plugin reloads
- No way to share query definitions as reusable artifacts

### User Needs

- Save query with a name (sources, locale, type hints, joins, dimensions, measures, time bucket)
- List saved queries with name, last run date, source count
- Load saved query into builder and rerun
- Delete saved queries

## Solutionstatement

### Functional Requirements

- [x] Save analytics query to `DataExchangeState.savedAnalyticsQueries`
- [x] Saved query includes all config: sources, locales, type hints, joins, dimensions, measures, time bucket
- [x] List saved queries in Analytics tab master panel
- [x] Click saved query loads it into builder
- [x] Delete saved query with confirmation
- [x] Queries persist across plugin reloads
- [x] Integration flow test: full pipeline (3 CSVs → join → group → aggregate → verify)

### Architecture

- `AnalyticsService.saveQuery()`, `listQueries()`, `getQuery()`, `deleteQuery()`
- Persistence in `DataExchangeState` via existing TypedStorage pattern
- Events: `analytics.query.saved`, `analytics.query.deleted`

## Acceptance Criteria

- [x] Save a query with name
- [x] Saved queries appear in master list
- [x] Click saved query loads it into builder
- [x] Delete removes query with confirmation
- [x] Queries survive plugin reload
- [x] Full pipeline flow test passes: 3 CSVs → join → group → aggregate → result
- [x] Save → reload → rerun flow test passes
- [x] Event sequence: started → completed fires correctly
- [x] `npm test` passes

## Test Intent

~25 tests: CRUD persistence (10), flow tests (15 — full pipeline, time bucketing, save/reload/rerun, event sequence).

## Related

- PRD: [[Data Exchange Hub PRD]]
- Cycle: [[Cycle 27 - Analytics Sprint]]
- Depends on: [[PBI-ANA-001 Analytics Engine Core]], [[PBI-ANA-002 Analytics Query Builder UI]]
