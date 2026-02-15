---
type: DecisionNote
adr: ADR-019
title: Obsidian-Native Styling with ft- Prefix
status: Accepted
date: 2026-01-15
domain: ui
category: Design Pattern
drivers:
  - Theme Compatibility
  - Collision Avoidance
  - Consistency
tags:
  - decision
  - frontend
  - styling
---

# ADR-019: Obsidian-Native Styling with ft- Prefix

## Status

**Accepted** — applied across all views and components.

## Context

Obsidian uses CSS variables for theming and supports community themes. Plugins must render correctly in both light and dark mode without conflicting with Obsidian's built-in classes or other plugins' classes.

### Alternatives Considered

1. **CSS Modules** — scoped but requires build-time processing, not standard for Obsidian plugins
2. **CSS-in-JS** — dynamic but adds runtime overhead, fights Obsidian's imperative DOM
3. **BEM naming** — verbose, doesn't leverage Obsidian's CSS variables
4. **Obsidian variables with `ft-` prefix (chosen)** — native theming, no collisions

## Decision

All custom CSS classes use the `ft-` prefix (e.g., `ft-btn`, `ft-card`, `ft-badge`). All colors, spacing, and typography reference Obsidian's CSS variables.

### Class Categories

| Category | Examples |
|----------|---------|
| Layout | `ft-view-root`, `ft-view-dashboard`, `ft-view-split` |
| Flexbox | `ft-flex`, `ft-flex-1`, `ft-flex-shrink-0`, `ft-gap-*` |
| Spacing | `ft-p-*`, `ft-m-*` |
| Typography | `ft-text-sm`, `ft-text-muted`, `ft-heading-*` |
| Appearance | `ft-icon-muted`, `ft-icon-faint`, `ft-cursor-pointer` |
| Components | `ft-btn`, `ft-card`, `ft-badge`, `ft-chip` |

### Theme Integration

```css
.ft-card {
  background: var(--background-secondary);
  border: 1px solid var(--background-modifier-border);
  color: var(--text-normal);
}
```

### View Header Override

Catalog and Hub views hide Obsidian's default view header:
```css
.workspace-leaf-content[data-type="flowti-*"] .view-header { display: none; }
```

## Consequences

### Positive

- **Theme-safe**: Automatic light/dark mode support via CSS variables
- **No collisions**: `ft-` prefix is unique to Flowti — no clash with Obsidian or other plugins
- **Consistent design**: Component Showcase view serves as a living style guide

### Negative

- **No scoping**: `ft-` prefix is convention-based, not enforced — a typo could miss the prefix
- **~170 remaining inline styles**: Lower-frequency patterns still use inline styles (identified as tech debt TD-4, partially resolved)

## Related

- [[Frontend Architecture]] — Styling section
- [[ADR-006 Orchestrator-Component UI Pattern]]
