---
type: Component
domain: Flowti
stage: done
description: "SVG chart rendering engine supporting line, bar, area, and pie chart display modes for dashboard tiles"
source: "[[Development/flowti/src/ui/analytics/ChartRenderer.ts|ChartRenderer.ts]]"
parent: "[[DashboardTileRenderer]]"
tags:
  - analytics
  - chart
  - visualization
  - component
---

# ChartRenderer

## Description

ChartRenderer renders SVG charts within dashboard tiles. Supports 4 chart types: line-chart (connected points with fill), bar-chart (vertical bars), area-chart (filled area under line), and pie-chart (segmented circle with legend). Auto-detects x-axis (first dimension) and y-axis (first measure or configured chartValueColumn). Includes axis labels, gridlines, tooltips, and responsive sizing.

## Chart Types

| Type | Rendering | Special Features |
|------|-----------|-----------------|
| `line-chart` | Connected SVG path with circle markers | Area fill below line, point hover |
| `bar-chart` | Vertical SVG rect elements | Bar width auto-calculated, hover highlight |
| `area-chart` | Filled SVG path (line-chart with solid fill) | Gradient fill option |
| `pie-chart` | SVG circle segments with legend | "Other" grouping for <3% and >12 segments |

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `container` | `HTMLElement` | Chart container element |
| `result` | `AnalyticsResult` | Query result with rows and columns |
| `displayMode` | `TileDisplayMode` | Chart type selector |
| `chartValueColumn` | `string?` | Override y-axis column (default: first measure) |

## Related

- Parent: [[DashboardTileRenderer]]
- Introduced: [[Cycle 32 - Analytics Visualization Sprint]] (PBI-ANA-031)
- Pie chart: [[Cycle 36 - Dashboard Drill-Down and Filtering]] (PBI-ANA-055)
