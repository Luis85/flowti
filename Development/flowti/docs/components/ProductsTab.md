---
type: Component
domain: Flowti
stage: done
description: "Master-detail tab for browsing, creating, and managing product documentation"
source: "[[Development/flowti/src/ui/catalog/ProductsTab.ts|ProductsTab.ts]]"
parent: "[[EventCatalogView]]"
tags:
  - catalog
  - component
---

# ProductsTab

## Description

ProductsTab renders the Products tab within the Event Catalog view. It follows the same master-detail pattern as FlowsTab and ActorsTab: the left panel shows a list of products scanned from documentation files, and the right panel shows details for the selected product including its events (resolved against the catalog), linked domains and services, and cross-referenced Flows, Systems, and Actors. Products are file-driven, each corresponding to a `.md` file with `type: ProductDoc` frontmatter in the Products documentation folder.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `CatalogComponentDeps` | interface | Provides `getState()`, `eventBus`, `app`, `navigation`, `workspace`, `getEntityFolder` |
| `scanEntityFolder` | function | Generic entity scanner that reads ProductDoc files from the products folder |
| `InputModal` | class | Prompts for name when creating a new product |
| `ConfirmModal` | class | Confirmation dialog before deleting a product |
| `getProductDocPathResolved` | helper | Resolves the file path for a product doc |
| `findRelatedFlows`, `findRelatedSystems`, `findRelatedActors` | helpers | Cross-reference lookups for all related entity types |

## State

**Reads from `deps.getState()`:**
- `filterText` -- filters product list by name, description, events, domains, or services
- `flowEntries`, `systemEntries`, `actorEntries` -- for cross-reference sections

**Internal state:**
- `entries: ProductEntry[]` -- scanned product entries with resolved events
- `selectedProduct: string | null` -- currently selected product name

## Renders

**Master list:**
- Header with "Products" label and "+" create button
- Each item shows: package icon, product name, resolved event count badge
- Text filter applied across name, description, events, domains, services

**Detail panel:**
- Header with product name, event/domain/service count badges
- Description card (if present)
- Info grid: Domains (clickable links), Services (clickable links)
- Actions: Open Doc, Delete (with confirmation)
- Events list: each event row shows type and category (or "unresolved" if not in catalog), clickable to navigate to event detail
- Related Flows, Related Systems, Related Actors sections

**Empty state:**
- "Select a product to view details" with quick stats (products, events, domains)

## Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| `doc.create` | Emits | Creates a new ProductDoc file |
| `doc.delete` | Emits | Deletes a product documentation file |

## Related

- Parent: [[EventCatalogView]]
- Siblings: [[CatalogDashboard]], [[DomainsTab]], [[ServicesTab]], [[EventsTab]], [[FlowsTab]], [[SystemsTab]], [[ActorsTab]]
- Children: none
