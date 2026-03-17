---
type: ProductBacklogItem
feature: "[[Analytics Hub PRD]]"
stage: planned
priority: critical
dependencies:
  - "[[PBI-ANA-141 DashboardTileRenderer Extraction]]"
planned_in: "[[Cycle 44 - Analytics Hub Filtering & Decomposition]]"
tags:
  - analytics
  - filter
  - dashboard
  - market-research
---

# PBI-ANA-132: Cross-Tile Filtering

## User Story — Problemspace
**As a** dashboard viewer, **I want** to click a bar in a chart tile and have sibling tiles filter to that value, **so that** I can explore data interactively across all tiles in one click.

**Context:** Cross-tile filtering (click bar → filter sibling tiles) is the "aha moment" that distinguishes dashboards from Excel. Currently, drill-down is per-tile only. This is the #2 gap from market research.

## Solution Statement
When a user clicks a chart segment or table row in any tile, emit a dashboard-level filter event. All sibling tiles that share the clicked dimension apply the filter and re-render. Visual indicator shows which tile is the "filter source." Clear button resets cross-tile filters.

### Architecture
| File | Action | ~LOC |
|------|--------|------|
| `src/ui/analytics/DashboardsTab.ts` | Cross-tile filter coordination | +60 |
| `src/ui/analytics/DashboardTileRenderer.ts` | Click-to-filter on chart/table | +40 |
| `src/ui/analytics/DashboardFilterBar.ts` | Cross-tile filter indicator + clear | +20 |

## Acceptance Criteria
- [ ] Click chart bar/segment filters sibling tiles by clicked dimension value
- [ ] Click table row filters sibling tiles by row dimension values
- [ ] Visual indicator on filter-source tile
- [ ] Clear button resets cross-tile filters
- [ ] Works with existing dashboard-level filters (additive)
- [ ] `npm test` passes

## Related
- PRD: [[Analytics Hub PRD]] (P2 roadmap)
- Market research: The "aha moment" that distinguishes dashboards from Excel
