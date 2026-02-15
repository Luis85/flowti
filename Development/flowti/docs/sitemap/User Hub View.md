---
stage: development
domain: Flowti
plugin: "[[Development/flowti/README|README]]"
tags:
  - core
  - view
  - homepage
description: Personal cockpit aggregating cross-hub summaries, always-visible inbox with persistent actionable items, and configurable notification sources
type: View
viewType: flowti-user-hub
extends: BaseHubView
source: "[[Development/flowti/src/ui/UserHubView.ts|UserHubView.ts]]"
feature: "[[Hubs]]"
---

# User Hub View

## Description

The User Hub is the personal cockpit for the Flowti plugin. It extends `BaseHubView<"inbox">` and provides a unified workspace with 2 sections: **Dashboard** (cross-hub summary cards + always-visible inbox) and **Inbox** tab (full master-detail inbox view).

The Dashboard aggregates stats from all registered hub providers via `HubRegistry.getAll()`, rendering clickable stat cards that deep-link to specific tabs in target hubs (e.g., clicking "Events: 42" opens the Event Catalog on the Events tab). Below the stat cards, an always-visible inbox section displays up to 5 recent items styled as a mail inbox — unread items show a bold font and left accent border. Quick-action buttons provide shortcuts to frequently used views.

The Inbox tab surfaces real actionable items from domain events via the `InboxService` domain. Items are created automatically when subscription watchers match, imports complete or fail, and exports complete. Each item has a type (Action Required or Information), is persisted across sessions via `TypedStorage`, and can be marked as read, dismissed, or cleared. The `UserHubProvider` exposes the unread count in cross-hub summary cards.

Users can configure which event sources generate inbox items via Settings → Inbox. Each of the 4 sources (Watcher matches, Import completed, Import errors, Export completed) can be individually toggled on or off. Disabled sources stop creating new items; existing items are unaffected.

The Activity tab was removed — the standalone `EventLogView` sidebar already provides full activity logging, accessible via the "Activity Log" quick action on the dashboard or the command palette.

## Use Cases

### Get a cross-hub overview
Open the User Hub to see summary stat cards from all registered hubs (Event Catalog, Data Exchange Hub) in one place. Each card shows a key metric and clicks through directly to the relevant tab, bypassing the hub's dashboard.

### Triage inbox items from the dashboard
The always-visible inbox section on the dashboard shows up to 5 recent items. Unread items appear bold with an accent border. Click any item to navigate to the full Inbox tab. Use the "Clear" button in the header to remove all items, or "View all (N) →" to see the complete list.

### Manage inbox items in detail
Switch to the Inbox tab to see all actionable items from watchers, imports, and exports. Unread items appear bold. Click an item to view its detail panel showing the type badge (Action Required / Information), source badge, description, source event type, and timestamp. Use "Mark read", "Dismiss", or "Clear all" to manage your inbox.

### Configure inbox notification sources
Open Settings → Inbox to control which events create inbox notifications. Toggle each source individually:
- **Watcher matches** (`subscription.matched`)
- **Import completed** (`dataExchange.import.completed`)
- **Import errors** (`dataExchange.import.failed`)
- **Export completed** (`dataExchange.export.completed`)

Disabling a source stops new items from that source; existing items are not affected.

### Navigate to other hubs quickly
Use the Quick Actions section on the dashboard to jump directly to the Event Catalog, Data Exchange Hub, Activity Log, or Watchers modal without going through the command palette.

### Track unread items across hubs
The User Hub's provider (`UserHubProvider`) exposes the current user name and inbox unread count as summary stats. Other hub dashboards display this as a User Hub card, giving at-a-glance awareness of pending items.

### Identify yourself
The top bar shows the current user's name (from UserService), and the dashboard greets the user by name. When no user is set, a generic "Welcome to Flowti" greeting is shown.

## Technical Notes

- Registered under view type `flowti-user-hub` with the `home` icon
- Accessible via ribbon icon, command palette (`flowti:open-user-hub`), or `ui.openUserHub` event
- Dashboard self-filters: the User Hub's own provider is excluded from the hub summary cards
- Stat cards include optional `tabId` for deep-linking via `HubRegistry.openHub(hubId, tabId)`
- InboxService (`src/domain/inbox/InboxService.ts`) provides persistent inbox state via `TypedStorage<InboxState>` with key `"inbox"`
- 4 source events create inbox items: `subscription.matched`, `dataExchange.import.completed`, `dataExchange.import.failed`, `dataExchange.export.completed`
- Each source is gated by `InboxService.enabledSources` — controlled via `settings.updateInboxEnabledSources` event and persisted in `inboxEnabledSources` setting
- 4 inbox events: `inbox.loaded`, `inbox.itemAdded`, `inbox.itemsChanged`, `inbox.refresh`
- Pure mapper functions in `src/domain/inbox/mappers.ts` transform source payloads into `InboxItem` objects
- MAX_INBOX_ITEMS = 500 with oldest-first eviction
- Dashboard inbox section shows max 5 items with "View all" link
- UserHubView subscribes to `inbox.itemAdded` and `inbox.itemsChanged` for re-render scheduling
