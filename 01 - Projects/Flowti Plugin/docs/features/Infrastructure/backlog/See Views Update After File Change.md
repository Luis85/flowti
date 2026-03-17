---
type: UseCase
domain: Flowti
stage: done
description: When the user creates, renames, or deletes a vault file, all open Flowti views update automatically without manual refresh.
view: "[[Event Catalog View]]"
feature: "[[Infrastructure PRD]]"
testplanRef: UC-99
tags:
  - use-case
  - infrastructure
  - reactivity
---

# See Views Update After File Change

## Summary

A user makes changes to vault files — creating a new domain doc, renaming a flow, or deleting a system file. All open Flowti views (Event Catalog tabs, Data Exchange Hub, Health Dashboard) automatically reflect the change without requiring the user to close and reopen the view.

## Preconditions

- The Flowti IBDE plugin is installed and enabled in Obsidian.
- The Event Catalog or Data Exchange Hub view is open.
- The user has documentation folders configured under `docsRootPath`.

## Steps

1. **Create a new file** — The user creates a new markdown file in the Domains folder (e.g., `Payment Processing.md` with `type: DomainDoc` frontmatter).
2. **EventBridge detects the change** — Obsidian's vault `create` event fires. EventBridge translates it into a `file.created` event on the bus.
3. **Views receive the event** — The Event Catalog's event listener receives `file.created` and schedules a re-render (debounced via `scheduleRender()`).
4. **Catalog updates** — After the debounce window (and a short delay for metadataCache to index the frontmatter), the Domains tab re-scans and shows the new "Payment Processing" entry.
5. **Rename the file** — The user renames the file to `Payment Gateway.md`. EventBridge emits `file.renamed` with old and new paths. The Domains tab updates to show "Payment Gateway".
6. **Delete the file** — The user deletes the file. EventBridge emits `file.deleted`. The Domains tab removes the entry.

## Outcome

The user's Flowti views always reflect the current state of the vault. No manual refresh, no stale data, no need to close and reopen views.

## Variations

- **Bulk file operations**: Creating or deleting multiple files in quick succession. The debounced re-render batches updates into a single render cycle.
- **File modified (frontmatter change)**: Editing a file's frontmatter (e.g., adding services to a domain doc) triggers `file.modified` and the detail panel updates on next view activation.
- **Cross-view impact**: Deleting a domain doc also affects the Health tab (coverage score changes) and any cross-reference sections that linked to that domain.

## Related

- Feature: [[Infrastructure PRD]]
- PBI: [[PBI-002 Reactive Vault Awareness]]
