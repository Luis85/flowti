---
type: Component
domain: Flowti
stage: done
description: "Generic entity folder scanner extracting frontmatter data for Flows, Actors, Products, and Systems tabs"
source: "[[Development/flowti/src/ui/catalog/entityScanner.ts|entityScanner.ts]]"
parent: "[[BaseEntityTab]]"
tags:
  - catalog
  - component
  - infrastructure
---

# entityScanner

## Description

entityScanner provides the generic `scanEntityFolder()` function shared by FlowsTab, ActorsTab, ProductsTab, and SystemsTab. It extracts the duplicated scan logic: folder resolution via `resolveEntityPath()`, frontmatter reading, field extraction (`name`, `description`, `events`, `domains`, `services`), alphabetical sort, and non-conforming file collection. Non-conforming files are collected but NOT written to during scan (TD-32).

## Exported Types

| Type | Purpose |
|------|---------|
| `RawScanEntry` | Raw data from frontmatter: `{ name, description, events, domains, services, filePath, fm }` |
| `ScanContext` | Context for `mapEntry`: `{ entryMap, allEntries }` from event catalog |
| `EntityScanConfig<T>` | Config: `entityType`, `nameFields`, `docType`, `normalizeNameKey`, `mapEntry`, etc. |

## Exports

| Export | Purpose |
|--------|---------|
| `scanEntityFolder(deps, config)` | Scans folder, reads frontmatter, maps entries, returns `{ entries, nonConforming }` |

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `CatalogComponentDeps` | interface | Provides `app` for vault access and `docsRootPath` for path resolution |
| `EVENT_CATALOG` | constant | Event catalog entries for building context |
| `readFrontmatter`, `fmString`, `fmStringArray` | helpers | Frontmatter parsing utilities |
| `discoveredToCatalogEntries` | helper | Converts discovered events to catalog entries |
| `resolveEntityPath` | function | Resolves entity folder path from settings |

## Related

- Consumer: [[BaseEntityTab]]
- Helpers: `src/ui/catalog/helpers/frontmatter.ts`
- Path resolution: `src/domain/docs/pathResolver.ts`
