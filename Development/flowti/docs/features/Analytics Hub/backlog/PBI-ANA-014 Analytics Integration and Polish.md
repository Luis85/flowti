---
type: ProductBacklogItem
feature: "[[Analytics Hub PRD]]"
stage: planned
priority: high
dependencies:
  - "[[PBI-ANA-010 Analytics Hub Shell]]"
  - "[[PBI-ANA-011 Dashboard Domain]]"
  - "[[PBI-ANA-012 Dashboard Tile Grid UI]]"
  - "[[PBI-ANA-013 Base File Analytics Source]]"
tags:
  - analytics
  - integration
planned_in: "[[Cycle 28 - Analytics Hub]]"
user_story: "[[When opening a CSV with Flowti, I want to be able to make an easy dashboard]]"
---

## User Story - Problemspace

As a user, I want the Analytics Hub to be discoverable from the User Hub and command palette, and I want confidence that the full pipeline works end-to-end.

### User Pains

- New hub must be discoverable without knowing the command name
- No integration tests covering the full dashboard → tile → query → results pipeline
- Existing flow tests reference old DX Hub location

### User Needs

- Analytics Hub card in User Hub with query + dashboard counts
- Command palette entry for quick access
- End-to-end flow tests covering the full pipeline
- Existing flow tests adapted for new hub location

## Solutionstatement

### Functional Requirements

- [ ] AnalyticsHubProvider implements HubDashboardProvider for User Hub cross-hub card
- [ ] Provider shows query count and dashboard count
- [ ] `flowti:open-analytics-hub` command registered in command palette
- [ ] End-to-end flow test: create query → save → create dashboard → add tile → see results
- [ ] Existing 25-AnalyticsPipeline.test.ts updated for new hub location
- [ ] Empty states and search filtering polished across both tabs
- [ ] Error boundaries for tile rendering failures

### Architecture

- `src/domain/hub/AnalyticsHubProvider.ts` — HubDashboardProvider implementation (~45 LOC)
- `src/main.ts` — register provider + command (+15 LOC)
- `src/infrastructure/commands/registry.ts` — analytics hub command (+10 LOC)
- `tests/flows/28-AnalyticsHub.test.ts` — integration flow test (~80 LOC)
- Polish: empty states, search filtering, error boundaries in QueriesTab + DashboardsTab (+50 LOC)

## Acceptance Criteria

- [ ] Analytics Hub card appears in User Hub with query + dashboard counts
- [ ] Clicking card navigates to Analytics Hub
- [ ] `flowti:open-analytics-hub` command opens Analytics Hub from command palette
- [ ] End-to-end flow test passes: query → dashboard → tile → results
- [ ] Existing 25-AnalyticsPipeline.test.ts passes with new hub location
- [ ] Empty states render correctly in both tabs
- [ ] `npm test` passes

## Test Intent

~20 tests: provider rendering (4), command execution (2), flow test pipeline (8), empty states (3), error boundaries (3).

## Related

- PRD: [[Analytics Hub PRD]]
- Cycle: [[Cycle 28 - Analytics Hub]]
- Depends on: [[PBI-ANA-010 Analytics Hub Shell]], [[PBI-ANA-011 Dashboard Domain]], [[PBI-ANA-012 Dashboard Tile Grid UI]], [[PBI-ANA-013 Base File Analytics Source]]
