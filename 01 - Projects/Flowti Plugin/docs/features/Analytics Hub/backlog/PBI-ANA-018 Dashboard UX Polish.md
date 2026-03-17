---
type: ProductBacklogItem
feature: "[[Analytics Hub PRD]]"
stage: delivered
priority: high
dependencies:
  - "[[PBI-ANA-015 Favorite Types Foundation]]"
tags:
  - analytics
  - dashboard
  - ux
planned_in: "[[Cycle 29 - Analytics Supplier Manager]]"
user_story: "[[Supplier Manager]]"
---

## User Story - Problemspace

As a Supplier Manager, I want to refresh individual dashboard tiles and give dashboards meaningful names so that I can keep data current and organize my dashboards effectively.

### User Pains

- No way to refresh a single tile — must switch tabs or reopen hub
- Dashboards auto-named "Dashboard 1" — no naming prompt
- No visual indicator for which dashboard is the default
- Cannot set a dashboard as default from the detail view

### User Needs

- Per-tile refresh button that re-executes the tile's query
- Dashboard name prompt modal on creation
- "Default" badge on the default dashboard in master list
- "Set as Default" action in dashboard detail header

## Solutionstatement

### Functional Requirements

- [ ] FR-19: Each tile has a refresh icon that re-executes its query
- [ ] FR-20: Creating a dashboard prompts for a name via modal dialog
- [ ] "Default" badge shown on default dashboard in master list
- [ ] "Set as Default" action button in dashboard detail header
- [ ] Empty name validation prevents creation without a name

### Architecture

- `src/ui/analytics/DashboardTileRenderer.ts` — Add refresh icon button in header, `onRefresh?` callback (+15 LOC)
- `src/ui/analytics/DashboardsTab.ts` — onRefresh handler (clears single cache entry), name prompt integration, default badge + action (+70 LOC)
- `src/ui/analytics/DashboardNameModal.ts` — **New**: Obsidian Modal subclass with text input + Create/Cancel (+45 LOC)

## Acceptance Criteria

- [ ] Each tile has a refresh icon in the tile header
- [ ] Clicking refresh re-executes the query (shows loading then updated results)
- [ ] Creating a dashboard opens a name prompt modal
- [ ] Empty name input is prevented (Create button disabled or validation message)
- [ ] "Default" badge visible on default dashboard row in master list
- [ ] "Set as Default" button in dashboard detail header
- [ ] Clicking "Set as Default" persists the default and re-renders
- [ ] `npm test` passes

## Test Intent

~10 tests: refresh callback wiring (2), refresh cache clearing (2), name modal creation (2), empty name validation (1), default badge rendering (1), set as default action (2).

## Related

- PRD: [[Analytics Hub PRD]] (FR-19, FR-20)
- Cycle: [[Cycle 29 - Analytics Supplier Manager]]
- Depends on: [[PBI-ANA-015 Favorite Types Foundation]]
- Persona: [[Supplier Manager]]
