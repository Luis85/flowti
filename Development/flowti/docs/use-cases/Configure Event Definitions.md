---
type: UseCase
domain: Flowti
stage: done
description: "Click the settings icon on any event to open the Event Config Modal. Navigate to the definition form to map source events + file patterns to domain event names with payload extraction."
view: "[[Event Catalog View]]"
feature: "[[Event Catalog]]"
testplanRef: "UC-59"
tags:
  - use-case
  - catalog
---

# Configure Event Definitions

## Summary

A user wants to create an event definition that maps a source event type and file pattern to a domain-specific event name, extracting structured payload fields from file metadata, path segments, or derived expressions. This transforms raw ingestion events into meaningful business events.

## Preconditions

- The Flowti IBDE plugin is installed and enabled in Obsidian.
- The Event Catalog View is open with events visible in the Events tab.
- The EventDefinitionService is initialized and has loaded persisted definitions from the `eventDefinition` storage key.
- The ingestion pipeline is active so that `ingestion.job.completed` events are being emitted for processed files.

## Steps

1. **Identify the source event** — The user navigates to the Events tab and locates the source event they want to transform (e.g., `ingestion.job.completed`). This is the raw event that the definition will listen to and re-emit as a domain event.
2. **Open the Event Config Modal** — The user clicks the settings icon (settings-2) next to the event type name. The `EventConfigModal` opens on the Overview page, showing any existing subscriptions and definitions for this event. The definitions list shows the count badge (e.g., "0 defs").
3. **Navigate to the Definition Form** — The user clicks "Add Definition" or switches to the Definition Form page. The form renders with the `sourceEventType` pre-filled from the selected event.
4. **Configure the file pattern** — The user enters a `filePattern` glob (e.g., `**/Invoices/*.md`) that restricts which files trigger this definition. Only `ingestion.job.completed` events whose file path matches this pattern will produce the domain event. The glob matching uses the `matchGlob()` utility which converts patterns to regex, with `**/` matching root-level files as well.
5. **Set the domain event name** — The user types a `domainEventName` (e.g., `billing.invoice.received`) in the target event field. This is the custom event type that will be emitted via `emitCustom()` on the EventBus when a matching file is processed.
6. **Define payload mappings** — The user adds one or more `PayloadMapping` entries using the repeater UI. Each mapping specifies a `field` name for the output payload, a `source` type (`path`, `metadata`, or `derived`), and an `expression` describing how to extract the value. For example: field `invoiceId` with source `metadata` and expression `invoice-id` extracts the `invoice-id` frontmatter property; field `folder` with source `path` and expression `parent` extracts the parent folder name.
7. **Set the emission policy** — The user selects an `EmissionPolicy`: `"always"` to emit the domain event every time a matching file is processed, or `"once"` to deduplicate using the `emittedKeys` set so that each unique file only triggers the domain event once.
8. **Save the definition** — The user clicks Save. The modal emits an `eventDefinition.create` event via the EventBus. The EventDefinitionService persists the new definition to the `eventDefinition` storage key and emits `eventDefinition.created`. The Overview page refreshes to show the new definition in the list, and the catalog badge updates to "1 def".

## Outcome

An event definition is persisted and active. When the ingestion pipeline processes a file matching the configured source event and file pattern, the EventDefinitionService extracts payload fields according to the mappings and emits the specified domain event via `emitCustom()`. The catalog reflects the definition count, and downstream subscribers can react to the new domain event.

## Variations

- **Edit an existing definition**: The user opens the Event Config Modal, clicks an existing definition in the Overview list, and modifies its file pattern or payload mappings. An `eventDefinition.update` event is emitted with the updated configuration.
- **Remove a definition**: The user clicks the delete action on a definition entry. An `eventDefinition.remove` event is emitted, and the service deletes it from storage and emits `eventDefinition.deleted`.
- **Once policy deduplication**: With `"once"` emission policy, the user processes the same file twice. The second time, the EventDefinitionService finds the file's key in `emittedKeys` and skips re-emission, preventing duplicate domain events.
- **Derived payload source**: The user configures a payload mapping with source `derived` and an expression that computes a value from multiple file properties, enabling richer domain event payloads.

## Related

- View: [[Event Catalog View]]
- Feature: [[Event Catalog]]
- Test: UC-59 in [[Testplan]]
