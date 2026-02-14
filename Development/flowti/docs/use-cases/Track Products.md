---
type: UseCase
domain: Flowti
stage: done
description: "The Products tab provides a registry of product documents linked to domains, services, and events. Use the dashboard for a quick overview of product counts and quick-create actions."
view: "[[Event Catalog View]]"
feature: "[[Event Catalog]]"
testplanRef: ""
tags:
  - use-case
  - catalog
---

# Track Products

## Summary

A user wants to maintain a registry of product documents that link to the domains, services, and events each product depends on, using the dashboard for a quick overview and the detail panel for full cross-referenced exploration.

## Preconditions

- The Flowti IBDE plugin is installed and enabled in Obsidian.
- The `docsRootPath` setting is configured and the `Products/` subfolder path is accessible.
- At least some domains, services, and events are documented in the catalog so that product references can be resolved.

## Steps

1. **Open the Products tab** — The user opens the Event Catalog View and clicks the "Products" tab. The master panel renders existing product entries scanned from `{docsRootPath}/Products/`. The dashboard area at the top shows a stats grid with the total product count alongside quick-action buttons.
2. **Review the dashboard** — The dashboard's Products card displays the count of documented products. A "New Product" quick action button is available for rapid creation without scrolling through the list.
3. **Create a new product document** — The user clicks the "+" button in the tab header (or the "New Product" quick action). The plugin calls `FileSystemClient.createFile()` to generate a new markdown file at `{docsRootPath}/Products/{productName}.md` with `type: ProductDoc` frontmatter containing placeholder fields for `name`, `description`, `events`, `domains`, and `services`.
4. **Edit the product metadata** — Obsidian opens the new file. The user fills in the frontmatter: sets `name` to the product's display name (e.g., "Invoice Management Suite"), writes a `description`, lists `domains` (e.g., `["Billing", "Data Exchange"]`), `services` (e.g., `["ImportService", "ExportService"]`), and `events` that the product consumes or produces (e.g., `["billing.invoice.received", "dataExchange.export.completed"]`).
5. **Return to the Products tab** — The user switches back to the Event Catalog View. The scan method re-reads the `Products/` folder via `metadataCache`, picking up the new file. The product appears in the master list with its name and description. The dashboard product count increments.
6. **Select the new product** — The user clicks the product entry in the master list. The detail panel renders the full product information: name, description, listed events (each resolved against the catalog via `resolvedEvents[]` showing descriptions and payload shapes), and linked domains and services.
7. **Explore cross-references** — The detail panel's "Related Flows," "Related Systems," and "Related Actors" sections auto-populate via `findRelatedFlows()`, `findRelatedSystems()`, and `findRelatedActors()`. These helpers match entries sharing overlapping events, domains, or services with the product. The user can click any related entity to navigate to its tab and detail view.

## Outcome

A product document exists in the vault linked to its domains, services, and events. The Products tab dashboard reflects the updated count, and the detail panel provides full cross-referenced navigation to related flows, systems, and actors. The product registry serves as a high-level view of what business capabilities each product encompasses within the event-driven architecture.

## Variations

- **Multiple products sharing a domain**: Two products reference the same domain (e.g., "Billing"). Both appear in the domain's detail panel under "Related Products" via the `findRelatedProducts()` helper.
- **Product without events**: A product document that lists only domains and services (no explicit events) still shows cross-references based on domain and service overlap with flows and systems.
- **Delete a product**: The user clicks the delete action on a product entry. The plugin calls `deleteFile()` to remove the markdown file. The dashboard count decrements and related sections in other tabs no longer reference the deleted product.
- **Quick-create from dashboard**: The user uses the "New Product" quick action from the dashboard rather than the tab header "+" button. The behavior is identical but provides a more discoverable entry point for first-time users.

## Related

- View: [[Event Catalog View]]
- Feature: [[Event Catalog]]
- Test: N/A
