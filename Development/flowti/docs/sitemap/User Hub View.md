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

The Dashboard aggregates stats from all registered hub providers via `HubRegistry.getAll()`, rendering clickable stat cards that deep-link to specific tabs in target hubs. When a documentation session is active, a prominent session card appears with the timer, title, and Pause/Complete actions. Train-of-thought sessions show a `train-front` icon and thought count badge on the active session card. An always-visible inbox section displays up to 5 recent items styled as a mail inbox. Quick-action buttons provide shortcuts to frequently used views (7 actions including Inbox, Sessions, Preferences, Event Catalog, Data Exchange, Activity Log, Watchers).

The Inbox tab surfaces actionable items from domain events via the `InboxService` domain (6 source events including pipeline completed/failed). Items can be marked as read, dismissed, or cleared. **PBI-005 (Cycle 12)** will add a 7th source type (`vaultFolder`) that watches configured vault folders for untyped notes and provides inline triage (type dropdown + description editing) with mark-as-read routing to a target folder.

The Sessions tab provides master-detail browsing of documentation sessions via the `SessionService` domain. The master list shows sessions sorted by status (active first), filterable by title. Train-of-thought sessions display a `train-front` icon and thought count badge ("N thoughts"). The detail panel shows session info, a live countdown timer (for active/paused sessions), artifacts list, and contextual lifecycle action buttons (Start, Pause, Resume, Complete, Archive, Delete). For train sessions, the detail panel includes a train section (thought count, branch count, clickable thought list) and relabels action buttons ("Open Train" instead of "Workspace", "Timeline" instead of "Sidebar"). Timer ticks update the DOM directly via `updateTimerDisplay()` without triggering full re-renders.

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

### Triage vault folder notes (planned — PBI-005)
Notes created in configured watched vault folders without frontmatter appear in the Inbox tab with a "Vault Folder" source badge. Click an item to see its detail panel with an inline type dropdown and description field. Set the type, optionally add a description, then click "Mark as Read" — the note receives template frontmatter and is routed to the configured target folder. The item disappears from the inbox (Inbox Zero principle).

### Create a new documentation session
Click the "New" button in the Sessions tab header (or the "New Session" button in the empty state) to open the `NewSessionModal`. Enter a session title, choose a type (Event Storming, Service Design, Requirements Refinement, Backlog Structuring, Knowledge Cleanup), and select a duration (25/50/15/45/60 min). Click "Create" to emit a `session.create` event, which creates a session in "prepared" status ready to be started.

### Browse and manage documentation sessions
Switch to the Sessions tab to see all documentation sessions. Active sessions appear first with an accent border. Click a session to view its detail panel:
- **Header**: title, status badge, type badge
- **Actions**: contextual buttons directly under header — Prepared: Start/Delete, Active: Pause/Complete, Paused: Resume/Complete, Completed: Rerun/Save as Template/Archive/Delete, Archived: Rerun/Save as Template/Delete
- **Timer** (active/paused): large monospace countdown timer with "Time Remaining" or "Paused" label
- **Focus File** (when set): clickable link to the file being worked on; opens the file in the editor
- **Time Breakdown** (when timeline has entries): stat pills showing Wall Clock, Active time, Paused time, and Pause count
- **Timeline** (when timeline has entries): chronological log of all lifecycle actions (Started, Paused, Resumed, Completed) with icons and timestamps
- **Info**: created date, configured duration, elapsed time, completed date
- **Artifacts**: list of files created/modified during the session (filename + action badge)

### View session time breakdown and timeline
After starting, pausing, and completing a session, the detail panel shows a Time Breakdown section with Wall Clock (total elapsed), Active (working time), Paused (total pause), and Pauses (count). Below it, a Timeline section lists every lifecycle action in chronological order with timestamps, providing a full audit trail of the session.

### Set a focus file for a session
When creating a new session via `NewSessionModal`, optionally set a Focus File by typing a path or clicking the "Browse" button (folder-open icon) to open a vault file picker. The focus file appears as a clickable link in the session detail panel.

### Configure inbox notification sources
Open the Preferences tab to control which events create inbox notifications. Toggle each of the 6 sources individually (Watcher matches, Import completed, Import errors, Export completed, Pipeline completed, Pipeline errors). **PBI-005** adds a 7th toggle for vault folder watching, plus a folder configuration section for managing watched paths, recursive mode, and target folder.

### Edit user profile
Open the Preferences tab to change your display name. Changes are saved automatically via `userService.updateUserName()`.

### Navigate to other hubs quickly
Use the Quick Actions section on the dashboard to jump directly to any tab or external view without going through the command palette.

### Track unread items across hubs
The User Hub's provider (`UserHubProvider`) exposes the current user name and inbox unread count as summary stats visible on other hub dashboards.

## Related Flows

These flow docs describe end-to-end user journeys that pass through this view:

- [[Create and Manage Sessions]] — Sessions tab provides master-detail browsing of session lifecycle (create, start, pause, resume, complete, archive)
- [[Manage Inbox Notifications]] — Inbox tab shows actionable items from subscriptions, imports, exports; dashboard shows 5 most recent
- [[First-Run Onboarding]] — After first-run install completes, the User Hub is the landing page for new users

## Technical Notes

- Registered under view type `flowti-user-hub` with the `home` icon
- Accessible via ribbon icon, command palette (`flowti:open-user-hub`), or `ui.openUserHub` event
- 4 child components: `UserHubDashboard`, `UserHubInbox`, `UserHubSessions`, `UserHubPreferences`
- Train-aware: `trainService` passed to component deps for train session detection, thought counts, and action button relabeling
- 3 tab definitions: Inbox (inbox icon), Sessions (timer icon), Preferences (settings icon)
- Search bar hidden on Preferences tab (no filterable content)
- Dashboard self-filters: the User Hub's own provider is excluded from the hub summary cards
- Stat cards include optional `tabId` for deep-linking via `HubRegistry.openHub(hubId, tabId)`
- InboxService (`src/domain/inbox/InboxService.ts`) provides persistent inbox state via `TypedStorage<InboxState>` with key `"inbox"`
- SessionService (`src/domain/session/SessionService.ts`) provides session state via `TypedStorage<SessionState>` with key `"sessions"`
- 6 source events create inbox items: `subscription.matched`, `dataExchange.import.completed/failed`, `dataExchange.export.completed`, `dataExchange.pipeline.completed/failed`. PBI-005 adds 7th source: `vaultFolder` (watches `file.created`/`file.modified` in configured folders)
- UserHubView subscribes to 2 inbox events, 7 session state events, `session.timer.tick`, `session.timer.completed`, `settings.changed`, and `user.updated`
- Timer optimization: `session.timer.tick` calls `sessions.updateTimerDisplay(remainingMs)` directly — no `scheduleRender()`
- `refreshSessionState()` pulls fresh data from `SessionService.getSessions()` and `.getActiveSession()`, preserving selection if the session still exists
- MAX_INBOX_ITEMS = 500 with oldest-first eviction
- MAX_SESSIONS = 200 with oldest-first eviction
- Session timeline: `SessionTimelineEntry[]` records every lifecycle action (started, paused, resumed, completed) with ISO timestamps
- Time breakdown: `computeTimelineSummary()` returns wall clock, active time, total pause, pause count, and individual `PauseSegment[]`
- Focus file: optional `focusFile` field on Session; vault file picker via `VaultFilePickerModal` (FuzzySuggestModal)
