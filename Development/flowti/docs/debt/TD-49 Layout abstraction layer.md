---
severity: high
category: architecture
layer: ui
status: open
created: 2026-02-15
effort: large
description: "Current views manually construct DOM layouts. Need declarative layout system with ILayout interface and LayoutRegistry for Hub framework."
source: "[[Hubs PRD]]"
feature: "[[Hubs PRD]]"
tags:
  - hubs
  - foundation
---
# TD-49: Layout abstraction layer

## Problem

Each view (EventCatalogView, DataExchangeHubView) manually constructs its DOM structure — creating divs for master/detail panels, tab containers, and content areas via imperative code. This means:

- Every new view duplicates layout construction logic
- Layout changes require modifying each view individually
- No validation that a view's layout matches architectural contracts
- Layouts cannot be swapped or configured declaratively

### Current pattern (EventCatalogView)

```typescript
// Each view manually creates its own layout
const container = contentEl.createDiv({ cls: "ft-catalog-container" });
const sidebar = container.createDiv({ cls: "ft-catalog-sidebar" });
const content = container.createDiv({ cls: "ft-catalog-content" });
const masterEl = content.createDiv({ cls: "ft-catalog-master" });
const detailEl = content.createDiv({ cls: "ft-catalog-detail" });
```

This is repeated in DataExchangeHubView, EventLogView, etc. with similar but slightly different structures.

## Target State

A declarative layout system where:

1. **`ILayout` interface** defines a layout contract: `mount(container)`, `getRegion(name)`, `dispose()`
2. **Layout implementations**: `DashboardGridLayout`, `SplitDockLayout`, `TableLayout`, `SessionFocusLayout`
3. **`LayoutRegistry`** maps layout names to factory functions
4. **Tab definitions** reference layouts by name; the shell mounts the correct layout per tab

### Target pattern

```typescript
const layout = layoutRegistry.create("split_dock");
layout.mount(contentEl);
const masterEl = layout.getRegion("primary");  // guaranteed to exist
const detailEl = layout.getRegion("inspector"); // guaranteed to exist
```

## Scope

### New files

- `src/ui/layouts/types.ts` — `ILayout`, `LayoutFactory`, `RegionMap` interfaces
- `src/ui/layouts/LayoutRegistry.ts` — registry mapping names → factories
- `src/ui/layouts/DashboardGridLayout.ts` — KPI grid + cards + quick actions regions
- `src/ui/layouts/SplitDockLayout.ts` — master/detail (replaces current pattern)
- `src/ui/layouts/TableLayout.ts` — toolbar + facets + table + footer regions
- `src/ui/layouts/SessionFocusLayout.ts` — header + timer + workspace + notes + artifacts
- `src/ui/layouts/index.ts` — barrel export

### Modified files

- None in Phase 1 (layouts are additive). Phase 2 (TD-54, TD-55) will wire existing views to use layouts.

## Dependencies

- None (can be built independently)

## Priority

**Critical** — This is the foundation for all Hub work. TD-50 (Shell), TD-52 (Tab Definitions), TD-54/55 (Migrations) all depend on this.

## Acceptance Criteria

- [ ] `ILayout` interface defined with `mount()`, `getRegion()`, `dispose()`
- [ ] 4 layout implementations created (dashboard_grid, split_dock, table, session_focus)
- [ ] `LayoutRegistry` resolves layout by name
- [ ] Unit tests for each layout: mount creates expected DOM regions, dispose cleans up
- [ ] Layout regions match the contracts defined in [[Hubs]] architecture reference
