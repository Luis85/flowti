---
type: Component
domain: Flowti
stage: done
description: "Renders a single dashboard tile — table mode via AnalyticsResultsPanel, stat-card mode with numeric summaries"
source: "[[Development/flowti/src/ui/analytics/DashboardTileRenderer.ts|DashboardTileRenderer.ts]]"
parent: "[[DashboardsTab]]"
tags:
  - analytics
  - dashboard
  - component
---

# DashboardTileRenderer

## Description

DashboardTileRenderer renders a single dashboard tile within the tile grid. Each tile has a header (title + remove button) and a body that displays query results. Table mode delegates to AnalyticsResultsPanel; stat-card mode shows numeric values from the first result row in a responsive grid. Error boundaries catch unexpected rendering failures.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `container` | `HTMLElement` | Tile container element |
| `TileRenderContext` | interface | Tile config, query, result, error, onRemove callback |
| `AnalyticsResultsPanel` | class | Table mode rendering |

## Display Modes

| Mode | Rendering |
|------|-----------|
| `table` | AnalyticsResultsPanel with sortable table |
| `stat-card` | Responsive grid of numeric values from first row |

## Error States

| State | Display |
|-------|---------|
| Error string present | Alert icon + error message |
| Query not found | "Query not found — it may have been deleted" |
| No result yet | "Loading..." spinner |
| Render exception | "Render failed: [message]" (error boundary) |

## Related

- Parent: [[DashboardsTab]]
- Sibling: [[AnalyticsResultsPanel]]
