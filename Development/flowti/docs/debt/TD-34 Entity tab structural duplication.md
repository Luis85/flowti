---
severity: low
category: duplication
layer: ui
status: open
created: 2026-02-14
effort: medium
description: FlowsTab, ActorsTab, ProductsTab, SystemsTab share identical lifecycle, scan, CRUD, and rendering patterns (~800 LOC duplicated). Could be consolidated into a shared base class.
source: "[[Technical Review 2026-02-14]]"
---
# TD-34: Entity tab structural duplication

## Problem

Four catalog entity tabs share identical structure:

| Method | FlowsTab | ActorsTab | ProductsTab | SystemsTab |
|--------|----------|-----------|-------------|------------|
| `constructor(masterEl, detailEl, deps)` | identical | identical | identical | identical |
| `render()` → `scan()` → `renderMaster()` | identical | identical | identical | identical |
| `renderMaster()` (filter, header, list) | identical | identical | identical | identical |
| `createDoc(name)` | identical | identical | identical | identical |
| `deleteDoc(filePath)` | identical | identical | identical | identical |
| `renderDetailEmpty()` | identical | identical | identical | identical |

Only `renderDetail()` differs (entity-specific content sections).

### Related duplication

- **Entry types** (`FlowEntry`, `ActorEntry`, `ProductEntry`) have identical shapes: `{ name, description, events[], domains[], services[], filePath, resolvedEvents[] }`
- **`findRelated*` functions** in `helpers.ts` (lines 285-319): 4 structurally identical functions filtering by overlapping events/domains/services
- **`createDoc`/`deleteDoc`** methods follow the same pattern: resolve path → check existence → emit `doc.create`/`doc.delete`

### Approximate duplication

~800 LOC across 4 files that differ only in labels, icons, and detail rendering.

## Suggested Remediation

1. Create `BaseEntityEntry` interface (shared shape)
2. Create `BaseEntityTab<T extends BaseEntityEntry>` abstract class with shared lifecycle
3. Create generic `findRelated<T extends BaseEntityEntry>()` function replacing 4 copies
4. Subclasses only implement `renderDetailContent(entry: T)` and provide entity-type configuration

## Affected Files

- `src/ui/catalog/FlowsTab.ts` (~312 LOC)
- `src/ui/catalog/ActorsTab.ts` (~312 LOC)
- `src/ui/catalog/ProductsTab.ts` (~318 LOC)
- `src/ui/catalog/SystemsTab.ts` (~316 LOC)
- `src/ui/catalog/helpers.ts` (findRelated* functions)
- `src/ui/catalog/types.ts` (FlowEntry, ActorEntry, ProductEntry)
