---
type: Flow
domain: Flowti
stage: done
description: "End-to-end journey from opening the Event Catalog through browsing events to configuring subscriptions and definitions"
domains:
  - Subscription
  - Event Definition
  - Settings
services:
  - SubscriptionService
  - EventDefinitionService
  - SettingsService
events:
  - subscription.create
  - subscription.created
  - eventDefinition.create
  - eventDefinition.created
  - settings.changed
tags:
  - flow
  - catalog
---

# Browse and Configure Events

## Overview

The Event Catalog is the central hub for discovering, inspecting, and configuring the plugin's event system. Users navigate a categorized list of events across multiple tabs (Domains, Services, Events, Flows, Systems, Actors, Products), drill into individual event details, and then attach subscriptions or event definitions that drive downstream automation. Configuration changes are immediately reflected in the catalog via debounced re-renders.

## Trigger

User opens the Event Catalog view via the `flowti:open-catalog` command or sidebar icon.

## Steps

### 1. Open Event Catalog

- **View/Service**: EventCatalogView (orchestrator)
- **User Action**: User clicks the Flowti icon in the sidebar or runs the "Open Event Catalog" command
- **System Response**: EventCatalogView activates, loads catalog data from CATALOG_DATA, fetches current subscriptions and event definitions from their respective services via refresh events
- **Events**: `subscription.refresh`, `eventDefinition.refresh` → `subscription.loaded`, `eventDefinition.loaded`

### 2. Navigate to Events Tab

- **View/Service**: EventCatalogView (tab bar)
- **User Action**: User clicks the "Events" tab in the catalog header
- **System Response**: Master panel renders categorized event list grouped by EVENT_CATEGORIES. Each entry shows event name, description snippet, and config count badges (e.g., "2 subs, 1 def"). System-tagged events are hidden unless `showSystemEvents` is enabled
- **Events**: (none — UI only)

### 3. Search and Filter Events

- **View/Service**: EventCatalogView (filter bar)
- **User Action**: User types a search query in the filter input or toggles category chips (e.g., "System" toggle)
- **System Response**: Event list filters in real-time to show matching entries. The "System" chip toggles visibility of system-tagged events and persists the preference
- **Events**: `settings.updateShowSystemEvents` (if system toggle changed) → `settings.changed`

### 4. Select Event

- **View/Service**: EventCatalogView (master list)
- **User Action**: User clicks an event name (e.g., `subscription.created`)
- **System Response**: Detail panel renders event overview: full description, payload schema, domain, service, tags, and lists of existing subscriptions and definitions attached to this event type
- **Events**: (none — UI only)

### 5. Open Event Config Modal

- **View/Service**: EventConfigModal
- **User Action**: User clicks the settings icon (settings-2) next to an event name in the detail panel
- **System Response**: EventConfigModal opens with 3 pages: Overview (event info + existing subscription list + existing definition list), Subscription Form, Definition Form. The event type field is pre-filled from the catalog entry
- **Events**: (none — UI only)

### 6. Create Subscription

- **View/Service**: EventConfigModal (Subscription Form page)
- **User Action**: User fills in subscription details: optional path pattern, extension filter, name pattern. Selects enabled state. Clicks "Save"
- **System Response**: Modal emits `subscription.create` with the form data. SubscriptionService validates, persists, and emits `subscription.created`. Modal closes or returns to overview page showing the new subscription
- **Events**: `subscription.create` → `subscription.created`

### 7. Create Event Definition (Alternative Path)

- **View/Service**: EventConfigModal (Definition Form page)
- **User Action**: User fills in definition details: source event type, file pattern, domain event name, payload mappings (field/source/expression repeater), emission policy (once or always). Clicks "Save"
- **System Response**: Modal emits `eventDefinition.create` with the form data. EventDefinitionService validates, persists, and emits `eventDefinition.created`. Modal closes or returns to overview page showing the new definition
- **Events**: `eventDefinition.create` → `eventDefinition.created`

### 8. Catalog Reflects Configuration

- **View/Service**: EventCatalogView
- **User Action**: (automatic — user returns to catalog)
- **System Response**: EventCatalogView receives `subscription.created` or `eventDefinition.created` event, triggers a debounced `scheduleRender()`. The master list updates the config count badge for the affected event type. The detail panel (if still showing the same event) refreshes to include the newly created subscription or definition
- **Events**: `subscription.created` or `eventDefinition.created` (consumed by catalog listener)

## Decision Points

| Decision | Options | Default |
|----------|---------|---------|
| Configuration type | Subscription vs Event Definition | User choice |
| Emission policy | Once (deduplicated) vs Always | Once |
| Subscription filter | Path pattern, extension, name pattern (AND logic) | All optional (match everything) |
| System events visibility | Show / Hide | Hidden (`showSystemEvents: false`) |

## Events Sequence

```
subscription.refresh → subscription.loaded → eventDefinition.refresh → eventDefinition.loaded → [user browses] → subscription.create → subscription.created → [catalog re-render]
```

Or for event definitions:

```
subscription.refresh → subscription.loaded → eventDefinition.refresh → eventDefinition.loaded → [user browses] → eventDefinition.create → eventDefinition.created → [catalog re-render]
```

## Related Use Cases

- [[First-Run Onboarding]] (catalog is empty until events start flowing after install)
- [[Import CSV as Notes]] (import events appear in the catalog and can be subscribed to)
- [[Export Vault Data]] (export events appear in the catalog and can be subscribed to)
