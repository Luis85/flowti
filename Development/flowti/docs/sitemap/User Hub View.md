---
stage: development
domain: Flowti
plugin: "[[Development/flowti/README|README]]"
tags:
  - core
  - view
  - homepage
description: Personal cockpit aggregating cross-hub summaries, inbox, documentation sessions, and configurable preferences
type: View
viewType: flowti-user-hub
extends: BaseHubView
source: "[[Development/flowti/src/ui/UserHubView.ts|UserHubView.ts]]"
feature: "[[Hubs]]"
---

# User Hub View

## Description

The User Hub is the personal cockpit for the Flowti plugin. It extends `BaseHubView<UserHubTab>` and provides a unified workspace with a **Dashboard** landing page and 3 tabs: **Inbox**, **Sessions**, and **Preferences**.

The Dashboard aggregates stats from all registered hub providers via `HubRegistry.getAll()`, rendering clickable stat cards that deep-link to specific tabs in target hubs. When a documentation session is active, a prominent session card appears with the timer, title, and Pause/Complete actions. An always-visible inbox section displays up to 5 recent items styled as a mail inbox. Quick-action buttons provide shortcuts to frequently used views (7 actions including Inbox, Sessions, Preferences, Event Catalog, Data Exchange, Activity Log, Watchers).

The Inbox tab surfaces actionable items from domain events via the `InboxService` domain (6 source events including pipeline completed/failed). Items can be marked as read, dismissed, or cleared.

The Sessions tab provides master-detail browsing of documentation sessions via the `SessionService` domain. The master list shows sessions sorted by status (active first), filterable by title. The detail panel shows session info, a live countdown timer (for active/paused sessions), artifacts list, and contextual lifecycle action buttons (Start, Pause, Resume, Complete, Archive, Delete). Timer ticks update the DOM directly via `updateTimerDisplay()` without triggering full re-renders.

The Preferences tab provides user profile editing (display name) and inbox source configuration (6 per-source toggles).

## Use Cases

### Get a cross-hub overview
Open the User Hub to see summary stat cards from all registered hubs (Event Catalog, Data Exchange Hub) in one place. Each card shows a key metric and clicks through directly to the relevant tab, bypassing the hub's dashboard.

### Monitor active documentation session
When a documentation session is active, the dashboard displays a prominent session card with the session title, type badge, remaining time (monospace font), and Pause/Complete action buttons. This card only appears when `sessionService.getActiveSession()` returns non-null.

### Triage inbox items from the dashboard
The always-visible inbox section on the dashboard shows up to 5 recent items. Unread items appear bold with an accent border. Click any item to navigate to the full Inbox tab.

### Manage inbox items in detail
Switch to the Inbox tab to see all actionable items from watchers, imports, exports, and pipelines. Click an item to view its detail panel with type badge, source badge, description, source event link, and action buttons (Mark read, Dismiss).

### Create a new documentation session
Click the "New" button in the Sessions tab header (or the "New Session" button in the empty state) to open the `NewSessionModal`. Enter a session title, choose a type (Event Storming, Service Design, Requirements Refinement, Backlog Structuring, Knowledge Cleanup), and select a duration (25/50/15/45/60 min). Click "Create" to emit a `session.create` event, which creates a session in "prepared" status ready to be started.

### Browse and manage documentation sessions
Switch to the Sessions tab to see all documentation sessions. Active sessions appear first with an accent border. Click a session to view its detail panel:
- **Header**: title, status badge, type badge
- **Timer** (active/paused): large monospace countdown timer with "Time Remaining" or "Paused" label
- **Info**: created date, configured duration, elapsed time, completed date
- **Artifacts**: list of files created/modified during the session (filename + action badge)
- **Actions**: contextual buttons per status — Prepared: Start/Delete, Active: Pause/Complete, Paused: Resume/Complete, Completed: Archive/Delete, Archived: Delete

### Configure inbox notification sources
Open the Preferences tab to control which events create inbox notifications. Toggle each of the 6 sources individually (Watcher matches, Import completed, Import errors, Export completed, Pipeline completed, Pipeline errors).

### Edit user profile
Open the Preferences tab to change your display name. Changes are saved automatically via `userService.updateUserName()`.

### Navigate to other hubs quickly
Use the Quick Actions section on the dashboard to jump directly to any tab or external view without going through the command palette.

### Track unread items across hubs
The User Hub's provider (`UserHubProvider`) exposes the current user name and inbox unread count as summary stats visible on other hub dashboards.

## Technical Notes

- Registered under view type `flowti-user-hub` with the `home` icon
- Accessible via ribbon icon, command palette (`flowti:open-user-hub`), or `ui.openUserHub` event
- 4 child components: `UserHubDashboard`, `UserHubInbox`, `UserHubSessions`, `UserHubPreferences`
- 3 tab definitions: Inbox (inbox icon), Sessions (timer icon), Preferences (settings icon)
- Search bar hidden on Preferences tab (no filterable content)
- Dashboard self-filters: the User Hub's own provider is excluded from the hub summary cards
- Stat cards include optional `tabId` for deep-linking via `HubRegistry.openHub(hubId, tabId)`
- InboxService (`src/domain/inbox/InboxService.ts`) provides persistent inbox state via `TypedStorage<InboxState>` with key `"inbox"`
- SessionService (`src/domain/session/SessionService.ts`) provides session state via `TypedStorage<SessionState>` with key `"sessions"`
- 6 source events create inbox items: `subscription.matched`, `dataExchange.import.completed/failed`, `dataExchange.export.completed`, `dataExchange.pipeline.completed/failed`
- UserHubView subscribes to 2 inbox events, 7 session state events, `session.timer.tick`, `session.timer.completed`, `settings.changed`, and `user.updated`
- Timer optimization: `session.timer.tick` calls `sessions.updateTimerDisplay(remainingMs)` directly — no `scheduleRender()`
- `refreshSessionState()` pulls fresh data from `SessionService.getSessions()` and `.getActiveSession()`, preserving selection if the session still exists
- MAX_INBOX_ITEMS = 500 with oldest-first eviction
- MAX_SESSIONS = 200 with oldest-first eviction
