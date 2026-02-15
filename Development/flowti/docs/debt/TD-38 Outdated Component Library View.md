---
status: open
severity: low
effort: small
layer: cross-cutting
category: documentation
updated: 2026-02-16
description: The Component Library has grown, the original Component View does not quite fit anymore, we need a solution to automatically document and showcase our views and components.
---
# TD-38: Outdated Component Library View

## Problem

The `ComponentShowcaseView` was created early in development as a living style guide. Since then, the component inventory has grown significantly:
- **Catalog**: 13 components under `src/ui/catalog/`
- **Hub**: 18 components under `src/ui/hub/`
- **CSV**: 7 components under `src/ui/csv/`
- **Export**: 6 components under `src/ui/export/`
- **Pipeline**: 5 components under `src/ui/hub/pipelines/`

The showcase view does not reflect the current component inventory and rendering patterns.

## Assessment (2026-02-16)

Low priority. The `ComponentShowcaseView` was cleaned up during Phase 2 (TD-25: German text removed, inline styles cleaned). However, it still only demonstrates a handful of basic components (buttons, inputs, toggles) and does not showcase the actual `CatalogComponentDeps`-based rendering pattern used by all catalog/hub components.

Options:
1. **Update manually** — Add showcases for each component family (catalog tabs, hub tabs, modals). Medium effort, becomes stale quickly.
2. **Auto-generate** — Use TypeDoc or a custom scanner to enumerate exports from `src/ui/` and generate showcase entries. Higher upfront cost, stays current automatically.
3. **Remove** — If the view serves no active purpose, remove it entirely and rely on tests + documentation.

## Affected Files

- `src/ui/ComponentShowcaseView.ts`
