---
type: Component
domain: Flowti
stage: done
description: "Master-detail inbox for actionable items with filtering, read/unread state, source badges, and item actions"
source: "[[Development/flowti/src/ui/userHub/UserHubInbox.ts|UserHubInbox.ts]]"
parent: "[[UserHubView]]"
tags:
  - hub
  - component
---

# UserHubInbox

## Description

UserHubInbox renders the Inbox tab of the User Hub using a master-detail split layout. The master panel shows a list of inbox items (filterable by title) with source badges and timestamps, and the detail panel shows the selected item's full details including type badge, source event, description, and action buttons (mark read, dismiss).

Items are populated from domain events via the `InboxService`: subscription watcher matches, import completions/failures, and export completions. Each source can be individually enabled or disabled in the plugin settings.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `UserHubComponentDeps` | interface | Provides `getState()`, `setState()`, `eventBus`, `inboxService`, `scheduleRender()`, `navigateToEvent()` |
| `InboxService` | class | Provides `markRead()`, `dismiss()`, `clearAll()` for item actions |
| `formatSourceEvent` | function | Maps source event types to human-readable labels for badges |
| `setIcon` | obsidian | Renders icons for item types (alert-circle for actions, info for informational) and empty state |

## State

**Reads via `deps.getState()`:**
- `inboxItems` — array of `InboxItem` objects to display
- `selectedInboxItem` — currently selected item for detail view

**Writes via `deps.setState()`:**
- `selectedInboxItem` — set when an item row is clicked

## Renders

**Master panel:**
- Header with item count, unread count, and "Clear all" button
- Each item row shows: type icon (alert-circle / info), title text, source badge (Watcher / Import / Export), formatted timestamp (right-aligned)
- Unread items render with `fontWeight: 600`
- Filter applied on `item.title` (case-insensitive substring match)
- Clicking a row sets `selectedInboxItem`, marks it as read via `inboxService.markRead()`, and triggers `scheduleRender()`

**Detail panel (item selected):**
- Header with item title
- Meta row: type badge ("Action Required" or "Information") + source badge + timestamp
- Source event row: "Triggered by: {sourceEvent}" — clickable link that opens the event in the Event Catalog via `navigateToEvent()`
- Description paragraph (omitted when empty)
- Action buttons: "Mark read" (when unread), "Dismiss"

**Empty states:**
- Master: inbox icon (48px), "No items in your inbox", descriptive subtext
- Detail: inbox icon, "Select an item to view details"

## Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| (none) | — | Inbox is purely state-driven; items are populated by the parent view via InboxService |

## Related

- Parent: [[UserHubView]]
- Sibling: [[UserHubDashboard]]
- Domain: `InboxService` (`src/domain/inbox/InboxService.ts`)
