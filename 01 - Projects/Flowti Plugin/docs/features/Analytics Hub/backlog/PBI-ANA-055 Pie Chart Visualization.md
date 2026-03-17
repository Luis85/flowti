---
type: ProductBacklogItem
feature: "[[Analytics Hub PRD]]"
stage: done
priority: high
dependencies:
  - "[[PBI-ANA-054 TileRenderer Extraction]]"
tags:
  - analytics
  - chart
  - visualization
planned_in: "[[Cycle 36 - Dashboard Filtering]]"
delivered_in: "[[Cycle 36 - Dashboard Filtering]]"
---

# PBI-ANA-055: Pie Chart Visualization

## User Story

As a Supplier Manager, I want to visualize category distributions as pie charts so that I can instantly see the proportional breakdown of costs, volumes, or counts across dimensions without reading tabular data.

## Solution Statement

Add `pie-chart` as the 6th `TileDisplayMode` alongside table, stat-card, line-chart, bar-chart, and area-chart. The pie chart renders as inline SVG with proportional segments, a color-coded legend, and automatic grouping of small slices.

**Implementation details:**
- SVG pie chart using trigonometric segment calculation (no external library)
- Legend with color swatches and labels displayed alongside or below the chart
- "Other" grouping: segments representing less than 3% of the total are combined into a single "Other" slice; additionally, if there are more than 12 segments, the smallest are grouped into "Other"
- Tile mode cycle updated to include `pie-chart` in the toggle sequence
- ChartRenderer extended with `renderPieChart()` method

## Acceptance Criteria

- [x] Pie chart renders SVG segments with proportional sizing
- [x] Legend shown with color swatches and labels
- [x] "Other" grouping applied for segments under 3% of total
- [x] "Other" grouping applied when segment count exceeds 12
- [x] Tile display mode cycle includes pie-chart
- [x] Pie chart works with all existing query result shapes
- [x] `npm test` passes

## Related

- PRD: [[Analytics Hub PRD]] (v10)
- Cycle: [[Cycle 36 - Dashboard Filtering]] (Inc 2)
- Depends on: [[PBI-ANA-054 TileRenderer Extraction]] (cleaner renderer)
- Extends: [[PBI-ANA-031 Chart Tile Foundation]] (adds 6th chart type)
