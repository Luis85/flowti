---
type: TechDebt
severity: low
category: duplication
layer: ui
status: resolved
created: 2026-02-14
resolved: 2026-02-14
effort: medium
description: FlowsTab, ActorsTab, ProductsTab, SystemsTab share identical lifecycle, scan, CRUD, and rendering patterns (~800 LOC duplicated). Consolidated into BaseEntityTab base class.
source: "[[Technical Review 2026-02-14]]"
---
# TD-34: Entity tab structural duplication

**Status: Resolved** — `BaseEntityTab<T>` base class with `EntityTabConfig<T>` configuration object extracts all shared lifecycle, scan, CRUD, and rendering logic. Net reduction: ~438 LOC.

## Resolution

Created `src/ui/catalog/BaseEntityTab.ts` (~370 LOC) with:

- **`BaseEntityEntry`** interface: shared shape `{ name, description, domains[], services[], filePath }`
- **`EntityTabConfig<T>`** configuration object: label, singular, icon, entityType, docType, pathResolver, scanConfig, mapEntry, getItemCount, filterIncludesEvents, renderEventsSection, relatedSections, buildCriteria, getQuickStats
- **`BaseEntityTab<T>`** class: constructor, scan(), render(), renderMaster(), renderDetail(), createDoc(), deleteDoc()

All 4 tabs refactored to thin subclasses with config objects:

| File | Before | After | Reduction |
|------|--------|-------|-----------|
| `FlowsTab.ts` | 314 LOC | 113 LOC | -201 LOC |
| `ActorsTab.ts` | 314 LOC | 112 LOC | -202 LOC |
| `ProductsTab.ts` | 320 LOC | 117 LOC | -203 LOC |
| `SystemsTab.ts` | 318 LOC | 116 LOC | -202 LOC |
| `BaseEntityTab.ts` (new) | — | 370 LOC | +370 LOC |
| **Total** | **1266 LOC** | **828 LOC** | **-438 LOC** |

### Design decisions

- **Composition via config**, not inheritance overrides — all tab-specific behavior injected via `EntityTabConfig<T>`
- **SystemsTab special handling**: `filterIncludesEvents: false`, custom `renderDirectEventsSection()` for `EventCatalogEntry[]` (vs string-based resolution in other tabs), `buildCriteria` omits events
- **Backward-compatible accessors** preserved on thin subclasses (e.g., `getSelectedFlow()`, `setSelectedSystem()`) for orchestrator compatibility

## Previously Affected Files

- `src/ui/catalog/BaseEntityTab.ts` (new)
- `src/ui/catalog/FlowsTab.ts` (refactored)
- `src/ui/catalog/ActorsTab.ts` (refactored)
- `src/ui/catalog/ProductsTab.ts` (refactored)
- `src/ui/catalog/SystemsTab.ts` (refactored)
