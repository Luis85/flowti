---
type: ProductBacklogItem
feature: "[[Analytics Hub PRD]]"
stage: planned
priority: high
dependencies:
  - "[[PBI-ANA-020 Query Power Features]]"
tags:
  - analytics
  - dashboard
  - hub
planned_in: "[[Cycle 30 - Analytics UX Mastery]]"
user_story: "[[Supplier Manager]]"
---

## User Story - Problemspace

As a Supplier Manager maintaining dashboards, I want to rename dashboards, edit descriptions, refresh all tiles at once, quickly create queries and dashboards from the top bar, and export a dashboard summary — so that daily maintenance is fast and I can share status with colleagues.

### User Pains

- Dashboard name and description cannot be changed after creation — stuck with the initial name forever
- No "Refresh All" button — must click refresh on each tile individually when data changes
- No top bar shortcuts — creating a new query or dashboard requires navigating to the correct tab first
- No way to share dashboard summary — must manually copy tile names and query names

### User Needs

- Dashboard rename + description editing (inline in detail header)
- "Refresh All" button to clear all tile caches and re-render
- Top bar quick actions: "New Query" and "New Dashboard" buttons
- Export dashboard summary as markdown (copy to clipboard)

## Solutionstatement

### Functional Requirements

- [ ] FR-28: Dashboard name and description are editable inline in the dashboard detail header; changes persist
- [ ] "Refresh All" button clears TileResultCache and re-renders all tiles
- [ ] Top bar actions: "New Query" navigates to Queries tab and triggers create; "New Dashboard" navigates to Dashboards tab and triggers create
- [ ] "Export Summary" action generates markdown with dashboard name, tile names + query names, copies to clipboard
- [ ] Subscribe to `analytics.dashboard.tile.reordered` event for re-render

### Architecture

- `src/ui/analytics/DashboardsTab.ts` — Dashboard rename/description edit, Refresh All button, export markdown (+80 LOC)
- `src/ui/AnalyticsHubView.ts` — Top bar actions (New Query, New Dashboard), tile.reordered subscription (+30 LOC)

## Acceptance Criteria

- [ ] Dashboard name is editable inline in detail header (persisted on blur/enter)
- [ ] Dashboard description is editable below the title (persisted)
- [ ] "Refresh All" button clears all tile caches and re-renders all tiles
- [ ] Top bar has "New Query" and "New Dashboard" shortcut buttons
- [ ] "New Query" navigates to Queries tab and triggers query creation
- [ ] "New Dashboard" navigates to Dashboards tab and triggers dashboard creation
- [ ] "Export Summary" copies markdown summary to clipboard
- [ ] Hub re-renders when tiles are reordered
- [ ] Existing tests pass — no regressions
- [ ] `npm test` passes

## Test Intent

~10 tests: dashboard rename (2), dashboard description update (1), Refresh All clears cache (2), export markdown format (2), top bar action navigation (2), tile.reordered subscription (1).

## Related

- PRD: [[Analytics Hub PRD]] (FR-28)
- Cycle: [[Cycle 30 - Analytics UX Mastery]]
- Persona: [[Supplier Manager]]
- Depends on: [[PBI-ANA-020 Query Power Features]]
