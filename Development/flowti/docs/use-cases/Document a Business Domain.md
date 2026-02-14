---
type: UseCase
domain: Flowti
stage: done
description: "Switch to the Domains tab and click '+' to create a new domain document. Fill in the frontmatter with services, categories, and events. The catalog automatically resolves cross-references and shows related entries."
view: "[[Event Catalog View]]"
feature: "[[Event Catalog]]"
testplanRef: "UC-57"
tags:
  - use-case
  - catalog
---

# Document a Business Domain

## Summary

A user wants to formally document a business domain by creating a domain document file in the vault. The catalog's hybrid scan approach merges file-based domain entries with catalog-derived entries, enabling cross-referenced navigation across services, categories, and events.

## Preconditions

- The Flowti IBDE plugin is installed and enabled in Obsidian.
- The `docsRootPath` setting is configured (default: `03 - Resources/Documentation/Reference`), and the `Domains/` subfolder exists or will be created automatically.
- The user has at least a conceptual understanding of the domain they want to document (name, related services, events).

## Steps

1. **Open the Domains tab** — The user opens the Event Catalog View and clicks the "Domains" tab. The master panel renders a list of domain entries. Entries derived solely from the event catalog appear with an "undocumented" badge, indicating they have no backing markdown file.
2. **Click the "+" button** — The user clicks the "+" action button in the Domains tab header. The plugin calls `FileSystemClient.createFile()` to generate a new markdown file at `{docsRootPath}/Domains/{domainName}.md` with a `type: DomainDoc` frontmatter template including placeholder fields for `name`, `description`, `services`, `categories`, and `events`.
3. **Edit the frontmatter** — Obsidian opens the newly created file. The user fills in the YAML frontmatter: sets `name` to the domain's display name, writes a `description`, and lists `services` and `categories` as YAML arrays referencing known service and category names. The user also adds an `events` array with event type strings (e.g., `subscription.created`, `ingestion.job.completed`).
4. **Return to the Domains tab** — The user switches back to the Event Catalog View. The `scanDomains()` method re-scans the `Domains/` folder via `metadataCache`, picking up the new file. The domain now appears in the master list with its name and description, replacing any previous "undocumented" placeholder.
5. **Select the new domain** — The user clicks on the domain entry. The detail panel shows the full domain information: description, listed services (as clickable links to the Services tab), categories, and resolved events. The `configuredCount` and `visibleCount` are computed from the events array cross-referenced against the catalog.
6. **Verify cross-references** — The user scrolls to the "Related Flows," "Related Systems," and "Related Actors" sections in the detail panel. These sections are auto-populated by `findRelatedFlows()`, `findRelatedSystems()`, and `findRelatedActors()` helpers that match overlapping events, domains, or services arrays. Empty sections are hidden.
7. **Auto-normalize frontmatter** — If the user used non-standard field names (e.g., `domain` instead of `name`), the `normalizeDocFrontmatter()` function detects and updates the file to the standard DomainDoc schema on the next scan, using the `fmString()` fallback chain.

## Outcome

A new domain document exists in the vault at the configured documentation path. The Event Catalog View displays the domain with full cross-references to its services, categories, events, and related entities. Other tabs (Flows, Systems, Actors) will pick up the domain in their "Related" sections automatically.

## Variations

- **Mark as Area**: After creating the domain doc, the user clicks "Mark as Area" in the detail panel's actions section. This creates an `02 - Areas/{domainName}/{domainName}.md` file with `type: AreaDoc` frontmatter, promoting the domain to a PARA area.
- **Delete a domain doc**: The user clicks the delete action on a domain entry. The plugin calls `deleteFile()` to remove the markdown file. The domain may revert to an "undocumented" catalog-derived entry if events still reference it.
- **Undocumented domain**: The user notices a domain badge labeled "undocumented" and clicks "Create Doc" to generate the file pre-populated with events already associated with that domain in the catalog.

## Related

- View: [[Event Catalog View]]
- Feature: [[Event Catalog]]
- Test: UC-57 in [[Testplan]]
