---
type: UseCase
domain: Flowti
stage: done
description: "The Systems and Actors tabs let you document external systems and user personas, linking them to the domains and services they interact with. Cross-reference sections show related flows and events automatically."
view: "[[Event Catalog View]]"
feature: "[[Event Catalog]]"
testplanRef: ""
tags:
  - use-case
  - catalog
---

# Map Systems and Actors

## Summary

A user wants to document the external systems and human actors (user personas) that interact with the event-driven architecture, linking each to the domains and services they touch so that cross-references surface related flows and events automatically.

## Preconditions

- The Flowti IBDE plugin is installed and enabled in Obsidian.
- The `docsRootPath` setting is configured and the `Systems/` and `Actors/` subfolder paths are accessible.
- At least some domains and services are documented so that system and actor references can be resolved meaningfully.

## Steps

1. **Open the Systems tab** — The user opens the Event Catalog View and clicks the "Systems" tab. The master panel renders existing system entries scanned from `{docsRootPath}/Systems/` by `scanSystems()`. Each entry shows its name, description, and linked domains.
2. **Create a new system document** — The user clicks the "+" button. The plugin creates a new markdown file at `{docsRootPath}/Systems/{systemName}.md` with `type: SystemDoc` frontmatter containing placeholder fields for `name`, `description`, `domains`, and `services`. Obsidian opens the file for editing.
3. **Fill in the system metadata** — The user sets `name` to the system's identifier (e.g., "ERP Gateway"), writes a `description` of what the system does, and lists the `domains` (e.g., `["Billing", "Inventory"]`) and `services` (e.g., `["ImportService", "ExportService"]`) that the system interacts with. The `events` array is derived automatically from the linked domains and services.
4. **Switch to the Actors tab** — The user clicks the "Actors" tab. The master panel renders existing actor entries scanned from `{docsRootPath}/Actors/` by a similar scan method. Each entry shows its name, description, and referenced events.
5. **Create a new actor document** — The user clicks the "+" button. The plugin creates a new markdown file at `{docsRootPath}/Actors/{actorName}.md` with `type: ActorDoc` frontmatter. The user fills in the frontmatter: `name` (e.g., "Finance Manager"), `description` of the persona's role, explicit `events` they care about (e.g., `["billing.invoice.received", "dataExchange.export.completed"]`), and `domains` and `services` they interact with.
6. **Review system cross-references** — The user returns to the Systems tab and selects the newly created system. The detail panel shows the system's full information plus auto-generated "Related Flows," "Related Actors," and "Related Products" sections populated by `findRelatedFlows()`, `findRelatedActors()`, and `findRelatedProducts()` helpers that match overlapping domains, services, or events.
7. **Review actor cross-references** — The user switches to the Actors tab and selects the new actor. The detail panel renders sections for Overview, Goals & Needs, Key Events (each resolved against the catalog via `resolvedEvents[]`), Domains, Services, and Notes. The "Related Flows," "Related Systems," and "Related Products" sections show entities that share overlapping references.
8. **Navigate across entities** — The user clicks a related flow name in the actor's detail panel. The view switches to the Flows tab with that flow selected, demonstrating the interconnected navigation that the cross-reference system enables.

## Outcome

Both a system document and an actor document exist in the vault, each linked to the domains and services they interact with. The Event Catalog View surfaces bidirectional cross-references: systems and actors appear in flow and domain detail panels, and flows and domains appear in system and actor detail panels. This creates a navigable map of the entire event-driven architecture.

## Variations

- **System without services**: A system document that only lists domains (no explicit services) still derives its events from the domain's event catalog entries and shows meaningful cross-references.
- **Actor with goals**: The actor document's "Goals & Needs" section allows the user to write free-form markdown describing the persona's motivations, which renders alongside the structured event and domain data.
- **Delete a system or actor**: The user clicks the delete action on an entry. The plugin calls `deleteFile()` to remove the markdown file. Related sections in other tabs update on the next render to no longer reference the deleted entity.
- **Empty cross-references**: If a system or actor has no overlapping domains or events with any flow, the related sections are hidden automatically rather than showing empty lists.

## Related

- View: [[Event Catalog View]]
- Feature: [[Event Catalog]]
- Test: N/A
