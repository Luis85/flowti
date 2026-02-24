---
type: ProductBacklogItem
feature: "[[Analytics Hub PRD]]"
stage: delivered
delivered_in: "[[Cycle 30 - Analytics UX Mastery]]"
priority: high
dependencies:
  - "[[PBI-ANA-021 Source Preview and Query Usability]]"
tags:
  - analytics
  - dashboard
  - tiles
planned_in: "[[Cycle 30 - Analytics UX Mastery]]"
user_story: "[[Supplier Manager]]"
---

## User Story - Problemspace

As a Supplier Manager with dashboards, I want stat-card tiles that show all dimension groups (not just the first row), reorder tiles, rename tile titles, and toggle display modes — so that I can tune my dashboard layout without recreating tiles.

### User Pains

- Stat-card tiles show only the first row — monthly stat dashboard shows only January, hiding all other months
- Tiles are immutable after creation — cannot reorder, rename, or change display mode
- Dashboard layout is locked at creation time — any adjustment requires deleting and re-adding tiles

### User Needs

- Multi-row stat-card display: all dimension groups rendered as individual stat cards
- Tile reorder (move up/down) for layout tuning
- Tile title inline editing
- Display mode toggle (table ↔ stat-card) without recreating the tile

## Solutionstatement

### Functional Requirements

- [ ] FR-27: Stat-card tiles render all result rows as dimension-grouped cards (not just first row)
- [ ] Tile reorder: move-up / move-down buttons in tile header
- [ ] `reorderTile(dashboardId, tileId, direction)` service method
- [ ] Tile title editable inline (persisted on blur/enter)
- [ ] Display mode toggle button switches table ↔ stat-card via `updateTile()`
- [ ] `analytics.dashboard.tile.reordered` event emitted on reorder

### Architecture

- `src/ui/analytics/DashboardTileRenderer.ts` — Multi-row stat-card rendering, title edit, mode toggle, reorder buttons (+80 LOC)
- `src/domain/analytics/AnalyticsService.ts` — Add `reorderTile()` method (+25 LOC)
- `src/domain/analytics/events.ts` — Add tile.reordered event (+5 LOC)
- `src/infrastructure/events/catalog.ts` — Register 1 event (+2 LOC)
- `src/ui/analytics/DashboardsTab.ts` — Wire reorder/rename/toggle callbacks in TileRenderContext (+30 LOC)

## Acceptance Criteria

- [ ] Stat-card tiles show all result rows as grouped cards (dimension label + numeric values)
- [ ] Multi-row stat-card capped at 20 groups with "and N more..." overflow
- [ ] Each tile has move-up / move-down buttons for reordering
- [ ] Tile title is editable inline (persisted on blur/enter)
- [ ] Display mode toggle button switches table ↔ stat-card
- [ ] Reorder persists tile positions in dashboard
- [ ] `analytics.dashboard.tile.reordered` event emitted on reorder
- [ ] Existing tests pass — no regressions
- [ ] `npm test` passes

## Test Intent

~10 tests: reorderTile up/down (2), reorder boundary (first/last tile, 2), multi-row stat-card row count (2), stat-card overflow cap at 20 (1), display mode toggle (1), tile title update (1), event emission (1).

## Related

- PRD: [[Analytics Hub PRD]] (FR-27)
- Cycle: [[Cycle 30 - Analytics UX Mastery]]
- Persona: [[Supplier Manager]]
- Depends on: [[PBI-ANA-021 Source Preview and Query Usability]]
