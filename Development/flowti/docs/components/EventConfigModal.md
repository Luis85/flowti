---
type: Component
domain: Flowti
stage: done
description: "Per-event configuration hub for managing subscriptions and event definitions"
source: "[[Development/flowti/src/ui/EventConfigModal.ts|EventConfigModal.ts]]"
parent: "[[Flowti Plugin]]"
tags:
  - modal
  - component
---

# EventConfigModal

## Description

A multi-page modal that serves as the central configuration hub for a single event type. It is opened from the Event Catalog (via `EventDetailPanel`) when the user clicks an event type name or the configure icon. The modal provides an overview of all watchers (subscriptions) and transforms (event definitions) associated with the event, and allows creating, editing, and deleting them in-place.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `App` | Obsidian API | Modal base class and vault access |
| `IEventBus` | Interface | Emitting and listening for subscription and event definition CRUD events |
| `EventCatalogEntry` | Type | The catalog entry for the event being configured |
| `eventsFolder` | `string` | Path to the events documentation folder for "Open Event Doc" |
| `ConfirmModal` | Modal | Confirmation dialog before deleting a watcher or transform |
| `renderSubscriptionForm` | Helper | Shared subscription form renderer from `catalog/helpers` |
| `renderSubscriptionRow` | Helper | Shared subscription row renderer from `catalog/helpers` |
| `openOrCreateEventDoc` | Helper | Opens or creates the event documentation note |
| `createVaultQueryService` | Factory | Adapter for vault file queries |
| `createWorkspaceService` | Factory | Adapter for opening files in the workspace |

## State

| Property | Type | Purpose |
|----------|------|---------|
| `page` | `"overview" \| "subscription-form" \| "definition-form"` | Current visible page |
| `subscriptions` | `Subscription[]` | Watchers filtered to this event type |
| `definitions` | `EventDefinition[]` | Transforms filtered to this event type |
| `editingSubscriptionId` | `string \| null` | ID of subscription being edited, or null for new |
| `editingDefinitionId` | `string \| null` | ID of definition being edited, or null for new |
| `subFormData` | `SubscriptionFormData` | Form state for watcher create/edit |
| `defFormData` | `DefinitionFormData` | Form state for transform create/edit (domainEventName, filePattern, emissionPolicy, payloadMappings) |
| `unsubscribes` | `(() => void)[]` | Cleanup callbacks for event listeners |

## Renders

### Overview Page (default)
- **Event info card**: category, direction, description, stability badge, domain badge, visibility badge, services badge
- **Open Event Doc button**: opens or creates the markdown documentation note for this event
- **Watchers section**: count badge, "Add watcher" button, list of subscription rows with edit/delete actions
- **Transforms section**: count badge, "Add transform" button, list of definition rows with toggle (enable/disable), edit, and delete actions

### Subscription Form Page
- Shared subscription form (via `renderSubscriptionForm`) with event type locked to the current entry
- Fields: event type (disabled), label, path pattern, extension, name pattern
- Save and Cancel buttons

### Definition Form Page
- **Source event type** (disabled, pre-filled)
- **Output event name**: dot-notation name for the emitted event
- **File pattern**: glob pattern to filter matching files
- **Trigger mode**: dropdown for "Always" or "Once per file" emission policy
- **Data Fields (payload mappings)**: repeater rows with field name, source type (Path/Metadata/Derived), and expression
- Add field, Save/Create, and Cancel buttons

## Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| `subscription.refresh` | Emits | Request current subscription state on open |
| `subscription.loaded` | Listens | Receive full subscription list, filter to this event type |
| `subscription.create` | Emits | Create a new watcher for this event |
| `subscription.created` | Listens | Confirm watcher was created, return to overview |
| `subscription.update` | Emits | Update an existing watcher |
| `subscription.updated` | Listens | Confirm watcher was updated, return to overview |
| `subscription.remove` | Emits | Delete a watcher (after ConfirmModal) |
| `subscription.deleted` | Listens | Confirm watcher was deleted, re-render |
| `eventDefinition.refresh` | Emits | Request current event definition state on open |
| `eventDefinition.loaded` | Listens | Receive full definition list, filter to this event type |
| `eventDefinition.create` | Emits | Create a new transform |
| `eventDefinition.created` | Listens | Confirm transform was created, return to overview |
| `eventDefinition.update` | Emits | Update an existing transform (or toggle enabled state) |
| `eventDefinition.updated` | Listens | Confirm transform was updated, return to overview |
| `eventDefinition.remove` | Emits | Delete a transform (after ConfirmModal) |
| `eventDefinition.deleted` | Listens | Confirm transform was deleted, re-render |

## Related

- Parent: [[EventDetailPanel]] (Event Catalog detail view)
- Siblings: [[SubscriptionManagerModal]], [[CreateEventModal]]
