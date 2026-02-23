---
type: ProductBacklogItem
feature: "[[Analytics Hub PRD]]"
stage: planned
priority: critical
dependencies: []
tags:
  - analytics
  - hub
planned_in: "[[Cycle 28 - Analytics Hub]]"
user_story: "[[When opening a CSV with Flowti, I want to be able to make an easy dashboard]]"
---

## User Story - Problemspace

As a data analyst, I want a dedicated Analytics Hub so that I don't have to navigate through 8 unrelated DX Hub tabs to reach my queries and dashboards.

### User Pains

- Analytics buried as the last tab in a 9-tab Data Exchange Hub
- No dedicated entry point for analytics workflows
- Analytics state coupled to DataExchangeState, making it fragile

### User Needs

- Dedicated hub view with BaseHubView shell (top bar, tab bar, split layout)
- Query builder migrated to its own tab with all existing functionality
- Independent persistence for analytics data
- Backward-compatible migration of saved queries

## Solutionstatement

### Functional Requirements

- [ ] AnalyticsHubView extends BaseHubView with VIEW_TYPE `"flowti-analytics-hub"`
- [ ] Hub has 2 tabs: Dashboards, Queries
- [ ] Hub dashboard page shows overview stats (query count, dashboard count, last run)
- [ ] Queries tab reproduces all current AnalyticsTab functionality
- [ ] AnalyticsState with own TypedStorage key `"analytics"`
- [ ] State migration from `"dataExchange"` to `"analytics"` on first load
- [ ] Analytics tab removed from DataExchangeHubView
- [ ] AnalyticsTab (806 LOC) decomposed into QueriesTab + QueryBuilderForm

### Architecture

- `src/ui/AnalyticsHubView.ts` — BaseHubView subclass (~250 LOC)
- `src/ui/analytics/types.ts` — Hub state + deps interfaces (~60 LOC)
- `src/ui/analytics/QueriesTab.ts` — Migrated query builder (~450 LOC)
- `src/ui/analytics/AnalyticsDashboardPage.ts` — Hub overview stats (~80 LOC)
- `src/domain/hub/types.ts` — VIEW_TYPE_ANALYTICS_HUB constant
- `src/domain/analytics/types.ts` — AnalyticsState type
- `src/domain/analytics/AnalyticsService.ts` — Storage migration logic
- `src/infrastructure/services/registry.ts` — Storage key change
- `src/ui/DataExchangeHubView.ts` — Remove analytics tab
- `src/main.ts` — Wire new hub view

## Acceptance Criteria

- [ ] Analytics Hub opens with 2 tabs (Dashboards, Queries)
- [ ] Queries tab has full query builder functionality (source picker, joins, dimensions, measures, time bucket, results)
- [ ] Hub dashboard shows overview stats
- [ ] DX Hub no longer has analytics tab (8 tabs)
- [ ] Saved queries migrate automatically on first load
- [ ] Existing 163 analytics tests pass
- [ ] `npm test` passes

## Test Intent

~50 tests: hub view instantiation (5), tab navigation (5), query migration from old key (10), backward compat (5), queries tab rendering (15), DX hub cleanup verification (5), hub overview stats (5).

## Related

- PRD: [[Analytics Hub PRD]]
- Cycle: [[Cycle 28 - Analytics Hub]]
- Source: [[PBI-ANA-002 Analytics Query Builder UI]] (current implementation to migrate)
