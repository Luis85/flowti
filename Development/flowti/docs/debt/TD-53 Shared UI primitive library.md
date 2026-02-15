---
severity: low
category: duplication
layer: ui
status: open
created: 2026-02-15
effort: medium
description: "UI primitives (badges, chips, stat cards, action buttons) use inline styles and are duplicated across components. Need shared primitive library."
source: "[[Hubs PRD]]"
feature: "[[Hubs PRD]]"
tags:
  - hubs
  - incremental
---
# TD-53: Shared UI primitive library

## Problem

UI primitives are created inline across many components with duplicated styling:

- **Stat cards**: CatalogDashboard and HubDashboard both create stat grids with identical structure (icon + value + label + hover + click) but separate code
- **Badges**: `ft-badge`, `ft-badge-muted`, `ft-badge-accent` created via `createSpan()` in 20+ locations
- **Action links**: `ft-nav-link` with icon + text created identically in catalog tabs, hub tabs, and detail panels
- **Filter chips**: toggle chips for search/filter used in catalog, hub, and event log
- **Info cards**: bordered cards with label-value pairs used in detail panels across both views

This means:
- Visual inconsistencies creep in (slightly different padding, margins, structure)
- Styling changes require grep-and-replace across many files
- New components reimplement patterns instead of reusing them

### Example of duplication

```typescript
// CatalogDashboard — inline stat card
const card = grid.createDiv();
card.style.border = "1px solid var(--background-modifier-border)";
card.style.borderRadius = "8px";
// ... 15 more lines of inline styling

// HubDashboard — same stat card, duplicated
const card = grid.createDiv();
card.style.border = "1px solid var(--background-modifier-border)";
card.style.borderRadius = "8px";
// ... same 15 lines
```

## Target State

A `src/ui/shared/` module with pure rendering functions:

```typescript
// Stat cards (already planned for extraction)
renderStatGrid(container, cards, columns?)

// Badges
renderBadge(container, text, variant?)

// Action links
renderActionLink(container, icon, text, onClick)

// Filter chips
renderChipBar(container, chips, onToggle)

// Info cards
renderInfoCard(container, items: { label, value }[])
```

Each function creates DOM elements using Obsidian's DOM helpers and CSS classes (no inline styles).

## Scope

### New files

- `src/ui/shared/StatCard.ts` — stat grid renderer
- `src/ui/shared/Badge.ts` — badge renderer
- `src/ui/shared/ActionLink.ts` — action link renderer
- `src/ui/shared/ChipBar.ts` — chip bar renderer
- `src/ui/shared/InfoCard.ts` — info card renderer
- `src/ui/shared/index.ts` — barrel export

### Modified files (incremental)

Replace inline primitive creation in:
- `src/ui/catalog/CatalogDashboard.ts` — stat cards
- `src/ui/hub/HubDashboard.ts` — stat cards
- Various tab files — badges, action links, info cards

### CSS

Move inline styles to proper CSS classes in `styles.css`:
- `.ft-stat-grid`, `.ft-stat-card` (stat cards)
- `.ft-info-card`, `.ft-info-card-row` (info cards)

## Dependencies

- None (can be done incrementally alongside other work)

## Priority

**Medium** — Improves consistency and reduces duplication. Not blocking for hub development but recommended before Phase 2 migration (TD-54, TD-55) to avoid migrating duplicated code.

## Acceptance Criteria

- [ ] `renderStatGrid()` produces identical output to current CatalogDashboard inline code
- [ ] CatalogDashboard uses shared `renderStatGrid()` with no visual change
- [ ] HubDashboard uses shared `renderStatGrid()` with no visual change
- [ ] At least badges and stat cards extracted (other primitives can be incremental)
- [ ] Inline styles moved to CSS classes
