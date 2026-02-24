---
type: ProductBacklogItem
pbi: PBI-ANA-033
title: Chart Polish and Sparklines
domain: analytics
feature: "[[Analytics Hub PRD]]"
stage: delivered
priority: high
planned_in: "[[Cycle 32 - Analytics Visualization Sprint]]"
related:
  - "[[PBI-ANA-031 Chart Tile Foundation]]"
  - "[[PBI-ANA-022 Enhanced Stat-Card and Tile Management]]"
  - "[[Feature - Supplier Management]]"
functional_requirements:
  - FR-41
tags:
  - analytics
  - visualization
  - sparklines
---

# PBI-ANA-033: Chart Polish and Sparklines

## User Story

As a Supplier Manager, I want to see compact trend indicators alongside my KPI numbers in stat-card tiles so that I can instantly identify upward or downward trends without switching to a full chart view.

## Functional Requirements

- **FR-41**: Stat-card tiles can show sparkline mini-charts visualizing trend across result rows; sparklines render when ≥3 data points exist and can be toggled per tile

## Acceptance Criteria

- [ ] Stat-card tiles show sparkline below each measure value when ≥3 result rows
- [ ] Sparklines are compact (~80×24px), no axes or labels — pure trend line
- [ ] Sparklines hidden when <3 result rows (not enough data for meaningful trend)
- [ ] `showSparkline?: boolean` on DashboardTile defaults to `true`
- [ ] User can toggle sparkline visibility per tile via settings
- [ ] Line charts show dot markers on data points
- [ ] Bar charts show rounded tops and value labels above bars
- [ ] Chart axis labels auto-scale: skip labels when too dense for readable display
- [ ] Charts use CSS variables for colors (theme compatible)
- [ ] `npm test` passes

## Architecture

- `ChartRenderer.renderSparkline(container, values: number[])` — generates compact SVG polyline
- Sparkline SVG: viewBox `"0 0 80 24"`, stroke-only (no fill), 1.5px line width
- DashboardTileRenderer: after each stat-card measure value, append sparkline if `showSparkline !== false` and result rows ≥ 3
- Values extracted from result rows for the current measure column
- Chart polish: dot markers via `<circle>` elements, rounded bar corners via `rx` attribute, font-size auto-scale based on label count

## Test Intent

~15 tests:
- Sparkline SVG generation: correct path, correct dimensions
- Sparkline threshold: hidden at <3 rows, shown at ≥3
- Toggle: showSparkline false disables rendering
- Chart dot markers present in line chart output
- Bar chart rounded corners and value labels
- Axis label auto-scaling with 5, 10, 20+ labels

## Dependencies

- PBI-ANA-031 (Chart Foundation)

## Estimated LOC

~111 (80 ChartRenderer additions + 30 tile renderer wiring + 1 types)
