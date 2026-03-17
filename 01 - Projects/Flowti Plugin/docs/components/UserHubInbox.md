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

Items are populated from domain events via the `InboxService`: subscription watcher matches, import completions/failures, export completions, and pipeline completions/failures (6 source events). Each source can be individually enabled or disabled in the plugin settings.

**Planned (PBI-005 — Cycle 12):** A 7th source type (`vaultFolder`) will watch configured vault folders for notes with empty or missing `type` frontmatter. Vault folder items will support inline triage — type dropdown and description field in the detail panel — and a "Mark as Read" action that applies template frontmatter and routes the note to a configured target folder.

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

**Planned detail panel extensions (PBI-005):**
- **Vault folder items only:** Type dropdown (populated from known doc types) and description text input for inline triage
- "Mark as Read" on vault folder items: applies note template frontmatter, moves to target folder (primary) or applies in-place (secondary)

**Empty states:**
- Master: inbox icon (48px), "No items in your inbox", descriptive subtext
- Detail: inbox icon, "Select an item to view details"

## Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| (none) | — | Inbox is purely state-driven; items are populated by the parent view via InboxService |

## Related

- Parent: [[UserHubView]]
- Siblings: [[UserHubDashboard]], [[UserHubSessions]], [[UserHubPreferences]]
- Domain: `InboxService` (`src/domain/inbox/InboxService.ts`)
- Planned: [[PBI-005 Vault Folder Inbox]] (7th source type with inline triage)
