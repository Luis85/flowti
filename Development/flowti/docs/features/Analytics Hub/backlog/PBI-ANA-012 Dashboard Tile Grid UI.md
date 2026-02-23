---
type: ProductBacklogItem
feature: "[[Analytics Hub PRD]]"
stage: planned
priority: critical
dependencies:
  - "[[PBI-ANA-011 Dashboard Domain]]"
tags:
  - analytics
  - dashboard
  - ui
planned_in: "[[Cycle 28 - Analytics Hub]]"
user_story: "[[When opening a CSV with Flowti, I want to be able to make an easy dashboard]]"
---

## User Story - Problemspace

As a data analyst, I want to see my dashboards as a grid of tiles where each tile shows query results, so that I can view multiple business metrics at a glance.

### User Pains

- No visual composition of multiple query results
- No dashboard management UI
- No way to choose how results are displayed (table vs summary)

### User Needs

- Dashboard list in master panel with tile counts
- CSS Grid tile layout in detail panel
- Each tile renders query results (table or stat-card mode)
- Add/remove tiles with query picker and display mode selection
- Create/delete dashboards from master list

## Solutionstatement

### Functional Requirements

- [ ] DashboardsTab component with master/detail split
- [ ] Master panel: dashboard list with name, tile count, "New Dashboard" button
- [ ] Detail panel: CSS Grid layout rendering tiles for selected dashboard
- [ ] DashboardTileRenderer: renders single tile as table (AnalyticsResultsPanel) or stat-card summary
- [ ] AddTileDialog: inline dialog to pick saved query + display mode
- [ ] Remove tile button on each tile
- [ ] Delete dashboard button with confirmation
- [ ] Empty state guidance when no dashboards or no tiles

### Architecture

- `src/ui/analytics/DashboardsTab.ts` — master/detail split (~200 LOC)
- `src/ui/analytics/DashboardTileRenderer.ts` — single tile renderer (~120 LOC)
- `src/ui/analytics/AddTileDialog.ts` — inline query + mode picker (~80 LOC)
- `src/ui/AnalyticsHubView.ts` — wire DashboardsTab into onTabRender

## Acceptance Criteria

- [ ] User can create, select, and delete dashboards from master list
- [ ] Selected dashboard shows tile grid in detail panel
- [ ] Tiles render query results in correct display mode (table or stat-card)
- [ ] Tile "add" dialog lets user pick a saved query and display mode
- [ ] Tile removal works
- [ ] Empty state shown when no dashboards or no tiles
- [ ] `npm test` passes

## Test Intent

~30 tests: dashboard list rendering (6), tile grid layout (6), tile rendering table mode (4), tile rendering stat-card mode (4), add tile dialog (4), remove tile (3), empty states (3).

## Related

- PRD: [[Analytics Hub PRD]]
- Cycle: [[Cycle 28 - Analytics Hub]]
- Depends on: [[PBI-ANA-011 Dashboard Domain]]
