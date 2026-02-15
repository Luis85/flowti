---
type: Component
domain: Flowti
stage: done
description: "Master-detail inbox for actionable items with filtering, read/unread state, and type badges"
source: "[[Development/flowti/src/ui/userHub/UserHubInbox.ts|UserHubInbox.ts]]"
parent: "[[UserHubView]]"
tags:
  - hub
  - component
---

# UserHubInbox

## Description

UserHubInbox renders the Inbox tab of the User Hub using a master-detail split layout. The master panel shows a list of inbox items (filterable by title), and the detail panel shows the selected item's full details including type badge, timestamp, and description.

In the first increment, the inbox starts empty with a placeholder state. Future increments will populate items from subscription notifications, import/export results, and other actionable events.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `UserHubComponentDeps` | interface | Provides `getState()`, `setState()`, `scheduleRender()` |
| `setIcon` | obsidian | Renders icons for item types (alert-circle for actions, info for informational) and empty state |

## State

**Reads via `deps.getState()`:**
- `inboxItems` -- array of `InboxItem` objects to display
- `selectedInboxItem` -- currently selected item for detail view

**Writes via `deps.setState()`:**
- `selectedInboxItem` -- set when an item row is clicked

## Renders

**Master panel:**
- Each item row shows: type icon (alert-circle / info), title text, formatted timestamp (right-aligned)
- Unread items render with `fontWeight: 600`
- Filter applied on `item.title` (case-insensitive substring match)
- Clicking a row sets `selectedInboxItem` and triggers `scheduleRender()`

**Detail panel (item selected):**
- Header with item title
- Meta row: type badge ("Action Required" or "Information") + timestamp
- Description paragraph (omitted when empty)

**Empty states:**
- Master: inbox icon (48px), "No items in your inbox", descriptive subtext
- Detail: inbox icon, "Select an item to view details"

## Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| (none) | -- | Inbox is purely state-driven; items are populated by the parent view |

## Related

- Parent: [[UserHubView]]
- Siblings: [[UserHubDashboard]], [[UserHubActivity]]
