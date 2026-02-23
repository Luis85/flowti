---
type: ProductBacklogItem
feature: "[[Analytics Hub PRD]]"
stage: planned
priority: high
dependencies:
  - "[[PBI-ANA-015 Favorite Types Foundation]]"
  - "[[PBI-ANA-016 Dashboard First Overview]]"
  - "[[PBI-ANA-017 Favorites UI]]"
  - "[[PBI-ANA-018 Dashboard UX Polish]]"
tags:
  - analytics
  - flow-test
  - integration
planned_in: "[[Cycle 29 - Analytics Supplier Manager]]"
user_story: "[[Supplier Manager]]"
---

## User Story - Problemspace

As a developer, I want an end-to-end integration test covering the Supplier Manager daily workflow so that I have confidence the favorites, default dashboard, and dashboard-first overview work together correctly.

### User Pains

- No integration test for the favorites + default dashboard pipeline
- Individual unit tests may pass while the composed workflow breaks
- Event subscription completeness is difficult to verify without a flow test

### User Needs

- Flow 29 integration test covering the full Supplier Manager daily workflow
- AnalyticsDashboardPage polish (dashboard name in overview, empty favorites message)
- All analytics event subscriptions verified for completeness

## Solutionstatement

### Functional Requirements

- [ ] Flow 29 test: create dashboard → name it → add tiles → set as default → verify overview renders tiles → toggle favorites → verify sort order → refresh tile → verify re-execution
- [ ] AnalyticsDashboardPage: show dashboard name in overview header when rendering default
- [ ] AnalyticsHubView: subscribe to `analytics.dashboard.defaultChanged` event
- [ ] Final polish: empty favorites message, complete event subscription audit

### Architecture

- `tests/flows/29-AnalyticsSupplierManager.test.ts` — **New**: integration flow test (~100 LOC, ~15 tests)
- `src/ui/analytics/AnalyticsDashboardPage.ts` — Polish: dashboard title in overview, empty favorites text (+15 LOC)
- `src/ui/AnalyticsHubView.ts` — Subscribe to defaultChanged event (+5 LOC)

## Acceptance Criteria

- [ ] Flow 29 test exists with ~15 tests covering the Supplier Manager daily workflow
- [ ] Test covers: dashboard CRUD, favorites toggle, default set, overview rendering, tile refresh
- [ ] Overview page shows dashboard name when rendering default tiles
- [ ] Empty favorites section shows helpful message (not blank)
- [ ] All analytics event subscriptions verified (no orphan state)
- [ ] Existing tests pass — no regressions
- [ ] `npm test` passes

## Test Intent

~15 tests: dashboard creation with name (1), tile addition (2), set default (2), overview with default tiles (2), favorites toggle + sort (3), tile refresh (2), cleanup + edge cases (3).

## Related

- PRD: [[Analytics Hub PRD]]
- Cycle: [[Cycle 29 - Analytics Supplier Manager]]
- Depends on: [[PBI-ANA-015 Favorite Types Foundation]], [[PBI-ANA-016 Dashboard First Overview]], [[PBI-ANA-017 Favorites UI]], [[PBI-ANA-018 Dashboard UX Polish]]
- Persona: [[Supplier Manager]]
- Pattern: [[28-AnalyticsHub.test.ts]] (Flow 28 integration test pattern)
