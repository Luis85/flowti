---
type: ProductBacklogItem
feature: "[[Analytics Hub PRD]]"
stage: planned
priority: critical
dependencies: []
tags:
  - analytics
  - favorites
planned_in: "[[Cycle 29 - Analytics Supplier Manager]]"
user_story: "[[Supplier Manager]]"
---

## User Story - Problemspace

As an analytics user, I want to favorite dashboards and queries and set a default dashboard so that my important items are always easy to find and my daily dashboard loads automatically.

### User Pains

- All dashboards and queries are equally weighted in lists — no way to prioritize
- No concept of a "default" dashboard that loads on hub open
- Reaching the right dashboard takes multiple clicks through the list

### User Needs

- `isFavorite` flag on dashboards and queries for prioritization
- Default dashboard designation for automatic overview rendering
- Toggle/set operations with persistence and event emission

## Solutionstatement

### Functional Requirements

- [ ] FR-15: `isFavorite?: boolean` field on `Dashboard` interface
- [ ] FR-16: `isFavorite?: boolean` field on `SavedAnalyticsQuery` interface
- [ ] FR-17: `defaultDashboardId?: string | null` field on `AnalyticsState`
- [ ] `toggleQueryFavorite(id)` method on AnalyticsService — toggles and persists
- [ ] `toggleDashboardFavorite(id)` method on AnalyticsService — toggles and persists
- [ ] `setDefaultDashboard(id | null)` method on AnalyticsService — sets and persists
- [ ] `getDefaultDashboard()` method on AnalyticsService — returns Dashboard or undefined
- [ ] 3 new events: `analytics.query.favorited`, `analytics.dashboard.favorited`, `analytics.dashboard.defaultChanged`
- [ ] Events registered in `src/infrastructure/events/catalog.ts`

### Architecture

- `src/domain/analytics/types.ts` — add `isFavorite?` to Dashboard + SavedAnalyticsQuery, `defaultDashboardId?` to AnalyticsState (+5 LOC)
- `src/domain/analytics/events.ts` — add 3 events (+20 LOC)
- `src/domain/analytics/AnalyticsService.ts` — 4 new methods (+50 LOC)
- `src/infrastructure/events/catalog.ts` — register 3 events (+5 LOC)

## Acceptance Criteria

- [ ] `isFavorite` field exists on Dashboard and SavedAnalyticsQuery types
- [ ] `defaultDashboardId` field exists on AnalyticsState
- [ ] `toggleQueryFavorite(id)` toggles isFavorite and persists to storage
- [ ] `toggleDashboardFavorite(id)` toggles isFavorite and persists to storage
- [ ] `setDefaultDashboard(id)` sets defaultDashboardId and persists
- [ ] `setDefaultDashboard(null)` clears default
- [ ] `getDefaultDashboard()` returns the dashboard or undefined
- [ ] 3 events emit with correct payloads
- [ ] Events appear in Event Catalog under "Analytics" category
- [ ] Existing tests pass — no regressions
- [ ] `npm test` passes

## Test Intent

~15 tests: toggleQueryFavorite (3), toggleDashboardFavorite (3), setDefaultDashboard (3), getDefaultDashboard (2), event emission (3), persistence round-trip (1).

## Related

- PRD: [[Analytics Hub PRD]] (FR-15, FR-16, FR-17)
- Cycle: [[Cycle 29 - Analytics Supplier Manager]]
- Persona: [[Supplier Manager]]
