---
type: UseCase
domain: Flowti
stage: done
description: "Use the Flows tab to create step-by-step flow documents that reference specific events. The catalog resolves each event against the registry and displays related domains and services."
view: "[[Event Catalog View]]"
feature: "[[Event Catalog]]"
testplanRef: ""
tags:
  - use-case
  - catalog
---

# Model a Business Flow

## Summary

A user wants to model a business process as a sequence of events, documenting the flow in a markdown file that the catalog resolves against the event registry to surface related domains, services, and cross-references.

## Preconditions

- The Flowti IBDE plugin is installed and enabled in Obsidian.
- The `docsRootPath` setting is configured and the `Flows/` subfolder path is accessible.
- At least some events are registered in the catalog so that flow event references can be resolved.

## Steps

1. **Open the Flows tab** — The user opens the Event Catalog View and clicks the "Flows" tab. The master panel renders a list of existing flow entries scanned from `{docsRootPath}/Flows/` by `scanFlows()`. Each entry shows its name, description, and the count of referenced events.
2. **Click the "+" button** — The user clicks the "+" action button in the Flows tab header. The plugin calls `FileSystemClient.createFile()` to create a new markdown file at `{docsRootPath}/Flows/{flowName}.md` with `type: FlowDoc` frontmatter containing placeholder fields for `name`, `description`, `events`, `domains`, and `services`.
3. **Edit the flow document** — Obsidian opens the new file. The user sets the `name` field to a descriptive title (e.g., "Invoice Processing Flow"), writes a `description` summarizing the business process, and populates the `events` array with ordered event type strings representing the flow steps: e.g., `["ingestion.job.completed", "billing.invoice.received", "notification.sent"]`.
4. **Add domain and service references** — The user adds `domains` (e.g., `["Ingestion", "Billing"]`) and `services` (e.g., `["IngestionService", "NotificationService"]`) arrays to the frontmatter, linking the flow to its participating domains and services.
5. **Return to the Flows tab** — The user switches back to the Event Catalog View. The `scanFlows()` method re-reads the `Flows/` folder via `metadataCache`, picking up the new file. Because `metadataCache` may not have indexed the frontmatter immediately after file creation, a brief delay (500ms `setTimeout`) ensures the scan captures the updated metadata.
6. **Select the new flow** — The user clicks the flow entry in the master list. The detail panel renders the flow's full information: name, description, the list of events (each resolved against the catalog to show descriptions and payload shapes via `resolvedEvents[]`), and the linked domains and services.
7. **Review cross-references** — The detail panel's "Related Systems" and "Related Actors" sections auto-populate via `findRelatedSystems()` and `findRelatedActors()`, matching entries that share overlapping domains, services, or events with the flow. Empty sections are hidden automatically.

## Outcome

A flow document exists in the vault that models a business process as a sequence of events. The Event Catalog View resolves each event reference, displays domain and service links, and surfaces cross-references to related systems and actors. The flow serves as living documentation of how events compose into business processes.

## Variations

- **Unresolved events**: If the user lists an event type that does not exist in the catalog, the detail panel shows it with an "unresolved" indicator, prompting the user to create the event definition or correct the typo.
- **Delete a flow**: The user clicks the delete action on a flow entry. The plugin calls `deleteFile()` to remove the markdown file. The flow disappears from the master list on the next render cycle.
- **Edit an existing flow**: The user opens the flow's markdown file directly in Obsidian, modifies the events array, and returns to the Flows tab. The `scanFlows()` method picks up the changes on the next render.

## Related

- View: [[Event Catalog View]]
- Feature: [[Event Catalog]]
- Test: N/A
