---
type: Component
domain: Flowti
stage: done
description: "Inline dialog for adding tiles to a dashboard — saved query picker + display mode toggle"
source: "[[Development/flowti/src/ui/analytics/AddTileDialog.ts|AddTileDialog.ts]]"
parent: "[[DashboardsTab]]"
tags:
  - analytics
  - dashboard
  - component
---

# AddTileDialog

## Description

AddTileDialog is an inline dialog rendered within the DashboardsTab detail panel. It allows users to add a tile to the selected dashboard by picking a saved query from a dropdown and selecting a display mode (table or stat-card). Includes Add and Cancel buttons.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `container` | `HTMLElement` | Dialog container element |
| `queries` | `SavedAnalyticsQuery[]` | Available saved queries for dropdown |
| `onAdd` | callback | `(queryId, displayMode, title?) => void` |
| `onCancel` | callback | `() => void` |

## Renders

- **Query dropdown**: lists all saved queries by name
- **Display mode toggle**: "Table" / "Stat Card" buttons
- **Title input**: optional custom tile title
- **Action buttons**: Add (primary) + Cancel

## Related

- Parent: [[DashboardsTab]]
