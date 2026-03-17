---
type: Component
domain: Flowti
stage: done
description: "Master-detail tab for browsing, creating, and managing event flow documentation"
source: "[[Development/flowti/src/ui/catalog/FlowsTab.ts|FlowsTab.ts]]"
parent: "[[EventCatalogView]]"
tags:
  - catalog
  - component
---

# FlowsTab

## Description

FlowsTab renders the Flows tab within the Event Catalog view. It uses a master-detail layout where the left panel shows a list of flows scanned from documentation files, and the right panel shows the selected flow's details including its events (resolved against the catalog), linked domains and services, and cross-referenced Systems and Actors. Flows are purely file-driven -- each flow corresponds to a `.md` file with `type: FlowDoc` frontmatter in the Flows documentation folder.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `CatalogComponentDeps` | interface | Provides `getState()`, `eventBus`, `app`, `navigation`, `workspace`, `getEntityFolder` |
| `scanEntityFolder` | function | Generic entity scanner that reads FlowDoc files from the flows folder |
| `InputModal` | class | Prompts for name when creating a new flow |
| `ConfirmModal` | class | Confirmation dialog before deleting a flow |
| `getFlowDocPathResolved` | helper | Resolves the file path for a flow doc |
| `findRelatedSystems`, `findRelatedActors` | helpers | Cross-reference lookups (not findRelatedFlows since this IS the Flows tab) |

## State

**Reads from `deps.getState()`:**
- `filterText` -- filters flow list by name, description, events, domains, or services
- `flowEntries` -- not used directly (this tab scans its own entries)
- `systemEntries`, `actorEntries` -- for cross-reference sections

**Internal state:**
- `entries: FlowEntry[]` -- scanned flow entries with resolved events
- `selectedFlow: string | null` -- currently selected flow name

## Renders

**Master list:**
- Header with "Flows" label and "+" create button
- Each item shows: git-branch icon, flow name, resolved event count badge
- Text filter applied across name, description, events, domains, services

**Detail panel:**
- Header with flow name, event/domain/service count badges
- Description card (if present)
- Info grid: Domains (clickable links), Services (clickable links)
- Actions: Open Doc, Delete (with confirmation)
- Events list: each event row shows type and category (or "unresolved" if not in catalog), clickable to navigate to event detail
- Related Systems, Related Actors sections

**Empty state:**
- "Select a flow to view details" with quick stats (flows, events, domains)

## Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| `doc.create` | Emits | Creates a new FlowDoc file |
| `doc.delete` | Emits | Deletes a flow documentation file |

## Related

- Parent: [[EventCatalogView]]
- Siblings: [[CatalogDashboard]], [[DomainsTab]], [[ServicesTab]], [[EventsTab]], [[SystemsTab]], [[ActorsTab]], [[ProductsTab]]
- Children: none
