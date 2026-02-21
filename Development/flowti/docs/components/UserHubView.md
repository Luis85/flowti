---
type: Component
domain: Flowti
stage: done
description: "Personal cockpit view orchestrating dashboard, inbox, sessions, and preferences components"
source: "[[Development/flowti/src/ui/UserHubView.ts|UserHubView.ts]]"
parent: "[[Flowti Plugin]]"
tags:
  - view
  - component
---

# UserHubView

## Description

UserHubView is the orchestrator for the User Hub, the personal cockpit of the Flowti plugin. It extends `BaseHubView<UserHubTab>` and provides a dashboard landing page plus 3 tabs: Inbox, Sessions, and Preferences. The view owns the `UserHubState`, builds component dependencies, creates child components on open, and dispatches render calls to each component.

Registered under view type `flowti-user-hub` with the `home` icon. Accessible via ribbon icon, command palette (`flowti:open-user-hub`), or `ui.openUserHub` event.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `BaseHubView<UserHubTab>` | class | Provides shared hub layout: dashboard mode, tab bar, search, master/detail split |
| `IUserService` | interface | Retrieves the current user for the welcome greeting and top bar display |
| `HubRegistry` | class | Passed to dashboard for cross-hub summary aggregation |
| `InboxService` | class | Provides inbox state, mark-read, dismiss, clear-all |
| `SessionService` | class | Provides session state, active session, lifecycle operations |
| `IEventBus` | interface | Passed to child components for event emission; subscribes to 12+ events for re-render |
| `UserHubDashboard` | class | Renders the dashboard landing page |
| `UserHubInbox` | class | Renders the inbox master/detail tab |
| `UserHubSessions` | class | Renders the sessions master/detail tab |
| `UserHubPreferences` | class | Renders the preferences master panel |
| `NewSessionModal` | class | Modal for creating new sessions (title, type, duration) — opened via `openNewSessionModal()` in deps |
| `SESSION_TYPES` | constant | Session type definitions passed to modal |

## State

**Owns `UserHubState`:**
- `inboxItems: InboxItem[]` — actionable items from domain events and vault folder watching (newest first)
- `selectedInboxItem: InboxItem | null` — currently selected inbox item for detail view
- `inboxEnabledSources: string[]` — enabled inbox source event types
- `sessions: Session[]` — all documentation sessions
- `activeSession: Session | null` — currently active session (at most one)
- `selectedSession: Session | null` — currently selected session for detail view

State is exposed to child components via `UserHubComponentDeps.getState()` / `setState()`.

## Renders

- **Top bar**: User name with user icon (when user is set)
- **Dashboard mode**: Delegates to `UserHubDashboard.render()` — welcome greeting, active session card, quick actions, hub summaries, inbox section
- **Inbox tab**: Delegates to `UserHubInbox.renderMaster()` + `renderDetail()`
- **Sessions tab**: Delegates to `UserHubSessions.renderMaster()` + `renderDetail()`
- **Preferences tab**: Delegates to `UserHubPreferences.renderMaster()` + `renderDetail()`
- **Tab definitions**: Inbox (inbox icon), Sessions (timer icon), Preferences (settings icon)
- **Search bar hidden on Preferences** (no filterable content)

## Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| `inbox.itemAdded` | Listens | Re-renders when new inbox item arrives |
| `inbox.itemsChanged` | Listens | Re-renders and refreshes selection when items change |
| `session.created` | Listens | Refreshes session state + re-render |
| `session.started` | Listens | Refreshes session state + re-render |
| `session.paused` | Listens | Refreshes session state + re-render |
| `session.resumed` | Listens | Refreshes session state + re-render |
| `session.completed` | Listens | Refreshes session state + re-render |
| `session.archived` | Listens | Refreshes session state + re-render |
| `session.deleted` | Listens | Refreshes session state + re-render |
| `session.timer.tick` | Listens | Direct DOM update via `sessions.updateTimerDisplay()` (no re-render) |
| `session.timer.completed` | Listens | Refreshes session state + full re-render |
| `settings.changed` | Listens | Updates `inboxEnabledSources` in state |
| `file.created` | Listens (planned PBI-005) | InboxService creates inbox item for untyped note in watched folder |
| `file.modified` | Listens (planned PBI-005) | InboxService checks if note type changed in watched folder |
| `inbox.vaultFolder.noteDetected` | Produced (planned PBI-005) | Emitted when untyped note found in watched folder |
| `inbox.vaultFolder.noteTriaged` | Produced (planned PBI-005) | Emitted when note marked as read with type |
| `user.updated` | Listens | Re-renders top bar user name |
| `session.create` | Emits | Via `NewSessionModal.onSubmit()` → `openNewSessionModal()` dep callback |

## Related

- Children: [[UserHubDashboard]], [[UserHubInbox]], [[UserHubSessions]], [[UserHubPreferences]]
- Provider: [[UserHubProvider]] (exposes hub summary for other dashboards)
- Sibling views: [[EventCatalogView]], [[DataExchangeHubView]], [[EventLogView]]
- Planned: [[PBI-005 Vault Folder Inbox]] (7th inbox source type with vault folder watching)
