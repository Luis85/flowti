---
type: ProductBacklogItem
feature: "[[Analytics Hub PRD]]"
stage: planned
priority: high
dependencies: []
tags:
  - analytics
  - tech-debt
  - extraction
  - dashboard
  - tiles
planned_in: "[[Cycle 44 - Analytics Hub Filtering & Decomposition]]"
---

# PBI-ANA-141: DashboardTileRenderer Extraction

## User Story

As a developer adding new tile features (like cross-tile filtering), I want tile rendering decomposed into focused sub-renderers per display mode so that table, stat-card, and chart rendering concerns are isolated and independently modifiable.

## Solution Statement

Decompose the 827 LOC DashboardTileRenderer into 3 focused sub-renderers (TableTileRenderer, StatCardTileRenderer, ChartTileRenderer) and a TileRendererFactory for dispatch. DashboardTileRenderer becomes a thin frame orchestrator (~327 LOC) that handles tile header, mode toggle, settings, and delegates body rendering to the factory.

## Acceptance Criteria

- [ ] TableTileRenderer owns table rendering + conditional formatting (~180 LOC)
- [ ] StatCardTileRenderer owns stat-card + sparkline (~120 LOC)
- [ ] ChartTileRenderer owns chart config + delegates to ChartRenderer (~80 LOC)
- [ ] TileRendererFactory dispatches by TileDisplayMode
- [ ] DashboardTileRenderer reduced from ~827 to ~327 LOC (frame orchestrator)
- [ ] All 6 display modes render identically to pre-extraction behavior
- [ ] `npm test` passes

## Related

- Enables: [[PBI-ANA-132 Cross-Tile Filtering]] (tile renderers emit click events)
- Pattern: Same extraction pattern as [[PBI-ANA-120 Source Manager Extraction]]
- Deferred from: [[Cycle 43 - Analytics Hub Performance & Navigation]]
