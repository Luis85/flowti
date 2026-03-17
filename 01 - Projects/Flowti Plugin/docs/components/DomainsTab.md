---
type: Component
domain: Flowti
stage: done
description: "Master-detail tab for browsing, creating, and managing domain documentation"
source: "[[Development/flowti/src/ui/catalog/DomainsTab.ts|DomainsTab.ts]]"
parent: "[[EventCatalogView]]"
tags:
  - catalog
  - component
---

# DomainsTab

## Description

DomainsTab renders the Domains tab within the Event Catalog view. It uses a master-detail layout: the left panel shows a filterable, sortable list of domains (user domains first, then system domains, then hidden domains), and the right panel shows detailed information for the selected domain including its events, services, categories, and cross-referenced entities. Domains are derived from a hybrid of catalog data and file-scanned documentation.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `CatalogComponentDeps` | interface | Provides `getState()`, `eventBus`, `app`, `navigation`, `workspace`, `vaultQuery`, `getEntityFolder` |
| `EVENT_CATALOG` | constant | Built-in catalog entries for deriving domain-to-event mappings |
| `InputModal` | class | Prompts for name when creating a new domain |
| `ConfirmModal` | class | Confirmation dialog before deleting a domain doc |
| `readFrontmatter`, `fmString`, `fmStringArray`, `normalizeDocFrontmatter` | helpers | Read and normalize frontmatter from domain doc files |
| `getDomainDocPathResolved`, `getArchitectureDocPathResolved` | helpers | Resolve file paths for domain and architecture docs |
| `findRelatedFlows`, `findRelatedSystems`, `findRelatedActors` | helpers | Cross-reference lookups for related entities |
| `SYSTEM_DOMAINS` | constant | Set of domain names classified as system-level |

## State

**Reads from `deps.getState()`:**
- `discoveredEvents` -- merged with EVENT_CATALOG for complete event listing
- `catalogDomains` -- visibility settings per domain
- `showSystemEvents` -- controls display of system-tagged domains
- `filterText` -- filters domain list by name, description, or event types
- `subscriptions`, `definitions` -- used to compute configured event counts
- `excludedTypes` -- determines visible-in-log count
- `flowEntries`, `systemEntries`, `actorEntries` -- for cross-reference sections

**Internal state:**
- `entries: DomainEntry[]` -- scanned domain entries
- `selectedDomain: string | null` -- currently selected domain name
- `showHidden: boolean` -- toggle for hidden domains section

## Renders

**Master list:**
- Header with "Domains" label and "+" create button
- User domains section (visible, non-system)
- System domains section (visible when `showSystemEvents` is on)
- Hidden domains section (collapsible, with count header)
- Each item shows: eye toggle, box icon, name, event count badge, area/system/undocumented badge, configured status dot

**Detail panel:**
- Header with domain name, event count badge, area/system/undocumented badge
- Description card (if present)
- Info grid: Total Events, Configured, Visible in Log, Categories, Services (clickable links)
- Actions: Open/Create Doc, Architecture Doc, Mark as Area / Open Area, Delete (for documented domains)
- Events list: clickable rows navigating to event detail
- Related Flows, Related Systems, Related Actors sections

**Empty state:**
- "Select a domain to view details" with quick stats (domains, events, configured)

## Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| `settings.updateCatalogDomains` | Emits | Persists domain visibility toggles |
| `doc.create` | Emits | Creates DomainDoc, ArchitectureDoc, or AreaDoc files |
| `doc.delete` | Emits | Deletes a domain documentation file |

## Related

- Parent: [[EventCatalogView]]
- Siblings: [[CatalogDashboard]], [[ServicesTab]], [[EventsTab]], [[FlowsTab]], [[SystemsTab]], [[ActorsTab]], [[ProductsTab]]
- Children: none
