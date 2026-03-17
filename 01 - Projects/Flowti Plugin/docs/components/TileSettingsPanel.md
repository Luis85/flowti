---
type: Component
domain: Flowti
stage: done
description: "Per-tile settings panel for conditional formatting rules, display options, and chart configuration"
source: "[[Development/flowti/src/ui/analytics/TileSettingsPanel.ts|TileSettingsPanel.ts]]"
parent: "[[DashboardTileRenderer]]"
tags:
  - analytics
  - dashboard
  - settings
  - component
---

# TileSettingsPanel

## Description

TileSettingsPanel renders a collapsible settings panel within each dashboard tile for configuring conditional formatting rules, display options, and chart-specific settings. Extracted from DashboardTileRenderer in Cycle 36 (PBI-ANA-054) to reduce renderer complexity. Supports rule builder UI with column/operator/threshold/color configuration, built-in color presets (positive/negative/warning), sparkline toggle, chart value column selector, and auto-height toggle.

## Features

| Feature | Description |
|---------|-------------|
| Conditional formatting | Rule builder: column + operator + threshold → color |
| Color presets | positive (green), negative (red), warning (amber) |
| Sparkline toggle | Enable/disable mini-charts in stat-card tiles |
| Chart value column | Override which column the chart uses for y-axis |
| Auto-height | Toggle automatic tile height based on content |

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `container` | `HTMLElement` | Settings panel container |
| `tile` | `DashboardTile` | Current tile configuration |
| `result` | `AnalyticsResult` | Query result for column discovery |
| `onUpdate` | callback | Persists settings changes |

## Related

- Parent: [[DashboardTileRenderer]]
- Extracted from: DashboardTileRenderer in [[Cycle 36 - Dashboard Drill-Down and Filtering]] (PBI-ANA-054)
- Rule builder UI: [[Cycle 33 - Trend Intelligence]] (PBI-ANA-037)
