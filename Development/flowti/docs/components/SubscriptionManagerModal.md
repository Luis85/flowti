---
type: Component
domain: Flowti
stage: done
description: "Global modal for managing all event watchers (subscriptions) across all event types"
source: "[[Development/flowti/src/ui/SubscriptionManagerModal.ts|SubscriptionManagerModal.ts]]"
parent: "[[Flowti Plugin]]"
tags:
  - modal
  - component
---

# SubscriptionManagerModal

## Description

A two-page modal for managing all event watchers (subscriptions) across the entire plugin, regardless of event type. It is opened from the Event Catalog view's toolbar or via the `flowti:manage-subscriptions` command in the command registry. Unlike EventConfigModal which is scoped to a single event, this modal shows every watcher and allows creating watchers for any event type.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `App` | Obsidian API | Modal base class |
| `IEventBus` | Interface | Emitting and listening for subscription CRUD events |
| `renderSubscriptionForm` | Helper | Shared subscription form renderer from `catalog/helpers` |
| `renderSubscriptionRow` | Helper | Shared subscription row renderer from `catalog/helpers` |

## State

| Property | Type | Purpose |
|----------|------|---------|
| `page` | `"list" \| "form"` | Current visible page |
| `subscriptions` | `Subscription[]` | All watchers (unfiltered) |
| `editingId` | `string \| null` | ID of subscription being edited, or null for new |
| `formData` | `SubscriptionFormData` | Form state for watcher create/edit (eventType, label, pathPattern, extension, namePattern) |
| `unsubscribes` | `(() => void)[]` | Cleanup callbacks for event listeners |

## Renders

### List Page (default)
- **"Add watcher" button**: navigates to the form page with empty fields
- **Watcher rows**: each row shows the subscription with event type visible, plus edit and delete actions
- **Empty state**: "No watchers yet." message when no subscriptions exist

### Form Page
- Shared subscription form (via `renderSubscriptionForm`) with event type editable (not locked)
- Fields: event type (free text), label, path pattern, extension, name pattern
- Save and Cancel buttons

## Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| `subscription.refresh` | Emits | Request current subscription state on open |
| `subscription.loaded` | Listens | Receive full subscription list |
| `subscription.create` | Emits | Create a new watcher |
| `subscription.created` | Listens | Confirm watcher was created, return to list |
| `subscription.update` | Emits | Update an existing watcher |
| `subscription.updated` | Listens | Confirm watcher was updated, return to list |
| `subscription.remove` | Emits | Delete a watcher |
| `subscription.deleted` | Listens | Confirm watcher was deleted, re-render list |

## Related

- Parent: [[EventCatalogView]], [[Command Registry]]
- Siblings: [[EventConfigModal]]
