---
type: Component
domain: Flowti
stage: done
description: "Renders collapsible category groups and event items in the Events tab master tree"
source: "[[Development/flowti/src/ui/catalog/EventsCategoryRenderer.ts|EventsCategoryRenderer.ts]]"
parent: "[[EventCatalogView]]"
tags:
  - catalog
  - component
---

# EventsCategoryRenderer

## Description

EventsCategoryRenderer is a set of functions that render collapsible category groups and individual event items in the Events tab master tree. It handles the visual distinction between user categories (with "add event" buttons) and system categories (with doc and visibility toggles), renders status dots for configured/followed/hidden events, and manages category collapse/expand state. The empty "Uncategorized" category doubles as a "Create new Event" call-to-action.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `CatalogComponentDeps` | interface | Provides `app`, `eventBus`, `workspace`, `getEntityFolder` |
| `CatalogState` | type | Access to `collapsedCategories`, `excludedTypes`, `subscriptions`, `definitions`, `notifiedTypes` |
| `CategoryEntry` | type | Category metadata (name, description, filePath) for tooltips and doc actions |
| `EventCatalogEntry` | type | Event entries to render within each category |
| `InputModal` | class | Prompts for event name when adding to a named user category |
| `CreateEventModal` | class | Prompts for event name and category when adding to Uncategorized |
| `getCategoryDocPathResolved`, `generateCategoryDocContent` | helpers | Create or open category documentation files |
| `isConfigured` | helper | Checks if an event has watchers or transforms configured |

## State

**Reads from `CategoryRenderContext`:**
- `state.collapsedCategories` -- determines which categories are collapsed
- `state.excludedTypes` -- marks events as hidden from Activity Log
- `state.subscriptions`, `state.definitions` -- used for configured status dots and count badges
- `state.notifiedTypes` -- marks events as followed
- `selectedEventType` -- highlights the currently selected event item
- `categoryEntries` -- provides description tooltips and file path for doc buttons

**Writes:**
- Mutates `state.collapsedCategories` set on expand/collapse click

## Renders

**`renderMasterCategory()`:**
- Collapsible category header with chevron (or "+" icon for empty Uncategorized)
- Count badge showing total, visible, and configured counts (e.g., "12 . 10 vis . 3 conf")
- User category actions: "+" button to create event (InputModal for named categories, CreateEventModal for Uncategorized)
- System category actions: category doc button (file-text icon) and category visibility toggle (eye icon with partial state)
- Event item list (hidden when collapsed)

**`renderMasterEventItem()`:**
- Event type name
- Tag badges (e.g., "system")
- Status dots: hidden (gray), configured (blue), followed (green)
- Click handler to select event

## Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| `settings.updateCollapsedCategories` | Emits | Persists category collapse/expand state |
| `discovery.create` | Emits | Creates a new custom event (via user category "+" or Uncategorized CTA) |
| `eventFilter.toggleCategory` | Emits | Toggles Activity Log visibility for all events in a system category |
| `doc.create` | Emits | Creates a CategoryDoc file for a system category |

## Related

- Parent: [[EventsTab]]
- Siblings: [[EventsSettingsPanel]], [[EventDetailPanel]]
- Children: none
