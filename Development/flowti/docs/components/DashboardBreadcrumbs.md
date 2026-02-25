---
type: Component
domain: Flowti
stage: done
description: "Navigation breadcrumb bar showing drill-down context with a 4-level navigation stack"
source: "[[Development/flowti/src/ui/analytics/DashboardBreadcrumbs.ts|DashboardBreadcrumbs.ts]]"
parent: "[[DashboardsTab]]"
tags:
  - analytics
  - navigation
  - dashboard
  - component
---

# DashboardBreadcrumbs

## Description

DashboardBreadcrumbs renders a breadcrumb bar below the dashboard title showing the current drill-down navigation path. Supports a 4-level deep navigation stack. Each breadcrumb item is clickable to navigate back to that level. Per-value breadcrumb chips include individual × clear buttons. Visual feedback (accent color) indicates active drill-down values.

## Features

| Feature | Description |
|---------|-------------|
| 4-level nav stack | Tracks drill-down depth up to 4 levels |
| Clickable items | Navigate back to any previous level |
| Per-value chips | Individual × clear buttons per filter value |
| Accent color | Visual indicator for active drill-down values |

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `container` | `HTMLElement` | Breadcrumb bar container |
| `navStack` | `DrillDownLevel[]` | Current navigation state |
| `onNavigate` | callback | Navigate to selected level |

## Related

- Parent: [[DashboardsTab]]
- Introduced: [[Cycle 43 - Analytics Hub Performance & Navigation]] (PBI-ANA-122, FR-95)
- Pairs with: [[DashboardFilterBar]] (drill-down values become filter state)
