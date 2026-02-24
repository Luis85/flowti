---
type: ProductBacklogItem
pbi: PBI-ANA-031
title: Chart Tile Foundation
domain: analytics
feature: "[[Analytics Hub PRD]]"
stage: planned
priority: critical
planned_in: "[[Cycle 32 - Analytics Visualization Sprint]]"
related:
  - "[[PBI-ANA-012 Dashboard Tile Grid UI]]"
  - "[[PBI-ANA-022 Enhanced Stat-Card and Tile Management]]"
  - "[[Feature - Supplier Management]]"
functional_requirements:
  - FR-37
  - FR-38
  - FR-42
tags:
  - analytics
  - visualization
  - charts
---

# PBI-ANA-031: Chart Tile Foundation

## User Story

As a Supplier Manager, I want to see my cost and sales data as line charts and bar charts on my dashboard so that I can visually identify trends and compare categories without reading raw numbers.

## Functional Requirements

- **FR-37**: Dashboard tiles support "line-chart" display mode; SVG line chart renders aggregated values with axis labels and data point markers
- **FR-38**: Dashboard tiles support "bar-chart" display mode; SVG bar chart renders comparison data with value labels above bars
- **FR-42**: Chart tiles auto-detect axes from query dimensions (x-axis) and measures (y-axis)

## Acceptance Criteria

- [ ] "line-chart" tile display mode renders SVG line chart from query results
- [ ] "bar-chart" tile display mode renders SVG bar chart from query results
- [ ] Charts auto-detect x-axis (first dimension) and y-axis (first measure) from results
- [ ] Charts show axis labels and value labels on data points
- [ ] Line chart connects data points with lines and shows dot markers
- [ ] Bar chart shows vertical bars with heights proportional to values
- [ ] Empty results show "No data" message
- [ ] Single data point renders as a dot (line) or single bar (bar)
- [ ] Tile mode toggle cycles through all 4 modes (table → stat-card → line-chart → bar-chart)
- [ ] AddTileDialog includes chart mode options
- [ ] `npm test` passes

## Architecture

- `ChartRenderer` class in `src/ui/analytics/ChartRenderer.ts` (~200 LOC)
- Pure SVG generation — no external library dependencies
- SVG viewBox: responsive width, fixed 16:9 aspect ratio
- `renderLineChart(container, data, options)` and `renderBarChart(container, data, options)`
- Axis auto-detection: `columns[0]` = x-axis labels (dimension), `columns[1]` = y-axis values (measure)
- DashboardTileRenderer routes chart modes to ChartRenderer
- CSS: chart fills tile container, stroke/fill colors from CSS variables for theme compatibility

## Test Intent

~20 tests:
- Line chart SVG output structure (path elements, labels, dots)
- Bar chart SVG output structure (rect elements, labels)
- Axis auto-detection with various query shapes
- Edge cases: empty data, single point, many groups, non-numeric values
- Mode toggle cycle includes chart modes

## Dependencies

- PBI-ANA-030 (QueriesTab extraction) — not a hard dependency, but cleaner to add chart config after extraction

## Estimated LOC

~227 (200 ChartRenderer + 15 tile renderer routing + 5 types + 5 dialog + 2 mode toggle)
