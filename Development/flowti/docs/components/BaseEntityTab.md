---
type: Component
domain: Flowti
stage: done
description: "Abstract base class for entity tabs (Flows, Actors, Products, Systems) with scan lifecycle, master-detail, and CRUD"
source: "[[Development/flowti/src/ui/catalog/BaseEntityTab.ts|BaseEntityTab.ts]]"
parent: "[[EventCatalogView]]"
tags:
  - catalog
  - component
  - infrastructure
---

# BaseEntityTab

## Description

BaseEntityTab is an abstract base class that captures the structural duplication across entity tabs (TD-34). It provides: constructor setup, entity scan lifecycle via `scanEntityFolder()`, master list rendering with filter support, detail panel layout, CRUD operations (create doc, delete doc), empty state rendering, and non-conforming file normalization.

Tab-specific behavior is injected via the `EntityTabConfig<T>` object, making it trivial to add new entity tabs.

## Exported Types

| Type | Purpose |
|------|---------|
| `BaseEntityEntry` | Base shape: `{ name, description, domains, services, filePath }` |
| `RelatedSectionConfig` | Cross-reference section: `{ title, stateKey, findFn, navigate }` |
| `EntityTabConfig<T>` | Full tab config: label, singular, icon, docType, scanConfig, mapEntry, relatedSections |

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `CatalogComponentDeps` | interface | Catalog-level deps with `getState()`, `setState()`, `eventBus`, `app` |
| `scanEntityFolder` | function | Scans entity folder and returns entries + non-conforming files |
| `EntityScanConfig` | interface | Configuration for folder scanning |
| `InputModal`, `ConfirmModal` | class | Used for create/delete operations |

## Pattern

Each concrete tab (FlowsTab, ActorsTab, etc.) creates an `EntityTabConfig` and passes it to `BaseEntityTab`. The base class handles:

1. **Scan**: Calls `scanEntityFolder()` on render to get fresh entries from vault
2. **Master list**: Renders filtered, sorted list of entities with icon + name
3. **Detail panel**: Shows entity details with stats, description, events, related sections
4. **CRUD**: "+" button creates doc via `FileSystemClient`, "Delete" removes via `deleteFile()`
5. **Normalization**: Auto-normalizes non-conforming frontmatter

## Subclasses

- [[FlowsTab]], [[ActorsTab]], [[ProductsTab]], [[SystemsTab]]

## Related

- Scanner: [[entityScanner]]
- Parent: [[EventCatalogView]]
- TD: TD-34 (structural duplication across entity tabs)
