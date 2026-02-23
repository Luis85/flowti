---
type: ProductBacklogItem
feature: "[[Analytics Hub PRD]]"
stage: delivered
priority: critical
dependencies:
  - "[[PBI-ANA-015 Favorite Types Foundation]]"
tags:
  - analytics
  - dashboard
  - overview
planned_in: "[[Cycle 29 - Analytics Supplier Manager]]"
user_story: "[[Supplier Manager]]"
---

## User Story - Problemspace

As a Supplier Manager, I want the Analytics Hub overview to show my default dashboard's tiles directly so that I see my key metrics immediately on open without navigating through tabs.

### User Pains

- Hub opens to a bare stats page (2 numbers and 2 buttons) — useless for daily checks
- 4-7 clicks required to reach actual dashboard metrics
- No distinction between "setup mode" (query building) and "daily check mode" (viewing metrics)

### User Needs

- Default dashboard tiles rendered directly on the hub overview page
- Fallback to stats + prompt when no default is configured
- Favorites quick-nav section for secondary dashboards and queries
- Shared TileResultCache for async query execution on overview

## Solutionstatement

### Functional Requirements

- [ ] FR-18: Hub overview page renders default dashboard tiles on open (zero-click to metrics)
- [ ] Fallback: stats page + "Set a default dashboard" prompt when no default set
- [ ] Favorites section showing favorited items as clickable navigation cards
- [ ] TileResultCache extracted from DashboardsTab for reuse

### Architecture

- `src/ui/analytics/TileResultCache.ts` — **New**: extracted async cache class with `tryRun()`, `get()`, `clear()`, `clearOne()` (+45 LOC)
- `src/ui/analytics/AnalyticsDashboardPage.ts` — Rewrite: default dashboard tiles + favorites section (+180 LOC, was 65)
- `src/ui/analytics/DashboardsTab.ts` — Refactor: use TileResultCache, remove inline Map (~0 net)
- `src/ui/AnalyticsHubView.ts` — Wire TileResultCache, clear on dashboard changes (+15 LOC)

## Acceptance Criteria

- [ ] Hub overview renders default dashboard tiles directly when defaultDashboardId is set
- [ ] Tiles load asynchronously (loading → results) on overview page
- [ ] Fallback: stats + "Set a default dashboard" prompt when no default
- [ ] Favorites section shows favorited dashboards and queries as clickable cards
- [ ] DashboardsTab continues working with extracted TileResultCache
- [ ] TileResultCache is a standalone class (no inline Map in DashboardsTab)
- [ ] `npm test` passes

## Test Intent

~10 tests: TileResultCache unit tests (tryRun, get, clear, clearOne — 5), overview rendering with default (2), overview fallback without default (1), favorites section rendering (2).

## Related

- PRD: [[Analytics Hub PRD]] (FR-18)
- Cycle: [[Cycle 29 - Analytics Supplier Manager]]
- Depends on: [[PBI-ANA-015 Favorite Types Foundation]]
- Persona: [[Supplier Manager]]
