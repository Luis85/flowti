---
type: ProductBacklogItem
feature: "[[Analytics Hub PRD]]"
stage: delivered
priority: high
dependencies:
  - "[[PBI-ANA-015 Favorite Types Foundation]]"
  - "[[PBI-ANA-016 Dashboard First Overview]]"
tags:
  - analytics
  - favorites
  - ui
planned_in: "[[Cycle 29 - Analytics Supplier Manager]]"
user_story: "[[Supplier Manager]]"
---

## User Story - Problemspace

As an analytics user, I want star icons on dashboards and queries so that I can quickly favorite important items and always find them at the top of lists.

### User Pains

- All dashboards and queries are listed equally — no visual priority
- Cannot quickly identify important items in long lists
- No way to toggle favorite status from the list view

### User Needs

- Star icon on each dashboard and query row in master lists
- Click to toggle favorite state (persisted)
- Favorited items sorted to top of their respective lists
- Hub re-renders when favorites change

## Solutionstatement

### Functional Requirements

- [ ] FR-15 (UI): Star icon visible on each dashboard row in master list
- [ ] FR-16 (UI): Star icon visible on each saved query row in master list
- [ ] Clicking star toggles `isFavorite` via AnalyticsService (persisted)
- [ ] Favorited items sorted to top of their lists
- [ ] AnalyticsHubView subscribes to favorite events for re-render

### Architecture

- `src/ui/analytics/DashboardsTab.ts` — Star icon in `renderDashboardRow()`, sort favorites first (+40 LOC)
- `src/ui/analytics/QueriesTab.ts` — Star icon in saved query list section, sort favorites first (+40 LOC)
- `src/ui/AnalyticsHubView.ts` — Subscribe to `analytics.query.favorited` + `analytics.dashboard.favorited` events (+15 LOC)

## Acceptance Criteria

- [ ] Star icon visible on each dashboard row in master list
- [ ] Star icon visible on each saved query row in master list
- [ ] Clicking star toggles favorite state (filled vs muted visual)
- [ ] Favorited items sort to top of their respective lists
- [ ] Non-favorite items retain their original order below favorites
- [ ] Hub re-renders when favorites change via event subscription
- [ ] `npm test` passes

## Test Intent

~10 tests: star icon rendering (2), favorite toggle click (2), sort order with favorites (3), event subscription re-render (2), mixed favorites/non-favorites order (1).

## Related

- PRD: [[Analytics Hub PRD]] (FR-15, FR-16)
- Cycle: [[Cycle 29 - Analytics Supplier Manager]]
- Depends on: [[PBI-ANA-015 Favorite Types Foundation]], [[PBI-ANA-016 Dashboard First Overview]]
- Persona: [[Supplier Manager]]
