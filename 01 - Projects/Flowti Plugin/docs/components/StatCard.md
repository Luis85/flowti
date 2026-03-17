---
type: Component
domain: Flowti
stage: done
description: "Shared stat card grid renderer with icon, value, and label used by dashboard views"
source: "[[Development/flowti/src/ui/shared/StatCard.ts|StatCard.ts]]"
parent: "[[CatalogDashboard]], [[HubDashboard]]"
tags:
  - shared
  - component
---

# StatCard

## Description

StatCard provides the `renderStatGrid()` function used by both CatalogDashboard and HubDashboard to render metric grids. Each card shows an icon, a value, and a label. Cards with an `onClick` handler are clickable with a pointer cursor.

## Exported Types

| Type | Purpose |
|------|---------|
| `StatCardItem` | `{ icon, value, label, onClick? }` — single stat card definition |

## Exports

| Export | Purpose |
|--------|---------|
| `renderStatGrid(container, cards, columns?)` | Renders a CSS grid of stat cards (default 3 columns) |

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `setIcon` | obsidian | Renders card icons |

## Renders

- CSS grid layout with configurable columns
- Each card: icon (60% opacity) + value (large) + label (small muted)
- Clickable cards get `ft-cursor-pointer` class

## Consumers

- [[CatalogDashboard]] — event catalog stats
- [[HubDashboard]] — data exchange hub stats
- [[UserHubDashboard]] — user hub stats

## Related

- CSS classes: `ft-stat-grid`, `ft-stat-card`, `ft-catalog-stat-value`, `ft-catalog-stat-label`
