---
type: ProductBacklogItem
feature: "[[Analytics Hub PRD]]"
stage: planned
priority: critical
dependencies:
  - "[[PBI-ANA-010 Analytics Hub Shell]]"
tags:
  - analytics
  - dashboard
planned_in: "[[Cycle 28 - Analytics Hub]]"
user_story: "[[When opening a CSV with Flowti, I want to be able to make an easy dashboard]]"
---

## User Story - Problemspace

As a data analyst, I want to create named dashboards and manage tiles so that I can compose multiple query results into a single view.

### User Pains

- No way to see multiple query results side by side
- Each query execution is isolated — no composition layer
- No persistent dashboard configuration

### User Needs

- Dashboard create, update, delete operations
- Tile add, remove, update operations within a dashboard
- Persistence across plugin reloads
- Events for all CRUD operations

## Solutionstatement

### Functional Requirements

- [ ] Dashboard type with id, name, description, tiles[], timestamps
- [ ] DashboardTile type with id, queryId, title, displayMode, position (row, col, width, height)
- [ ] TileDisplayMode: `"table" | "stat-card"`
- [ ] AnalyticsService.createDashboard(name, description?) → Dashboard
- [ ] AnalyticsService.updateDashboard(id, changes) → Dashboard
- [ ] AnalyticsService.deleteDashboard(id) → void
- [ ] AnalyticsService.addTile(dashboardId, queryId, displayMode) → DashboardTile
- [ ] AnalyticsService.removeTile(dashboardId, tileId) → void
- [ ] AnalyticsService.updateTile(dashboardId, tileId, changes) → DashboardTile
- [ ] AnalyticsService.listDashboards() → Dashboard[]
- [ ] 7 dashboard events emitted on CRUD operations
- [ ] Events registered in infrastructure/events/catalog.ts

### Architecture

- `src/domain/analytics/types.ts` — Dashboard, DashboardTile, TileDisplayMode types (+35 LOC)
- `src/domain/analytics/events.ts` — 7 dashboard events + analytics.loaded (+40 LOC)
- `src/domain/analytics/AnalyticsService.ts` — Dashboard CRUD methods (+120 LOC)
- `src/infrastructure/events/catalog.ts` — Register 8 new events (+10 LOC)

## Acceptance Criteria

- [ ] Dashboard create, list, get, update, delete operations work
- [ ] Tile add, remove, update operations work within a dashboard
- [ ] All operations emit correct events
- [ ] Events appear in Event Catalog under "Analytics" category
- [ ] State round-trips through TypedStorage
- [ ] `npm test` passes

## Test Intent

~40 tests: dashboard CRUD (12), tile CRUD (12), event emission (8), persistence round-trip (4), edge cases (4).

## Related

- PRD: [[Analytics Hub PRD]]
- Cycle: [[Cycle 28 - Analytics Hub]]
- Depends on: [[PBI-ANA-010 Analytics Hub Shell]]
