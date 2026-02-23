---
type: Component
domain: Flowti
stage: done
description: "Event overview page showing info card, subscription list, and definition list within the EventConfigModal"
source: "[[Development/flowti/src/ui/eventConfig/OverviewPage.ts|OverviewPage.ts]]"
parent: "[[EventConfigModal]]"
tags:
  - eventConfig
  - component
---

# OverviewPage

## Description

`renderOverviewPage()` is a free function that renders the overview page (page 0) within the EventConfigModal. It displays an event info card with category, description, and metadata badges, followed by a Watchers (subscriptions) section and a Transforms (definitions) section. Both sections show existing items in a list with edit/delete actions and an "Add" button.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `container` | `HTMLElement` | Parent DOM element to render into |
| `deps` | `EventConfigPageDeps` | Shared dependency bag with entry, subscriptions, definitions, callbacks |
| `deps.entry` | `EventEntry` | Event metadata (category, description, stability, domain, visibility) |
| `deps.subscriptions` | `Subscription[]` | Existing subscriptions for this event |
| `deps.definitions` | `EventDefinition[]` | Existing definitions for this event |
| `deps.eventBus` | `IEventBus` | Emit definition toggle events |
| `deps.onOpenEventDoc()` | callback | Open event documentation file |
| `deps.onNavigateToPage()` | callback | Navigate to subscription or definition form page |
| `deps.onEditSubscription()` | callback | Pre-fill subscription form for editing |
| `deps.onDeleteSubscription()` | callback | Delete a subscription with confirmation |
| `deps.onEditDefinition()` | callback | Pre-fill definition form for editing |
| `deps.onDeleteDefinition()` | callback | Delete a definition with confirmation |

## Renders

- **Event info card**: Category badge, direction indicator, description text, stability/domain/visibility/services badges, "Open Event Doc" button
- **Watchers section**: Count badge, subscription rows with filter summary, edit/delete actions, "Add watcher" button
- **Transforms section**: Count badge, definition rows with enable/disable toggle, output event name, file pattern, edit/delete actions, "Add transform" button

## Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| `eventDefinition.update` | Emits | Toggle definition enabled/disabled state |

## Related

- Parent: [[EventConfigModal]]
- Siblings: [[DefinitionFormPage]]
