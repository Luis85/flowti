---
type: Component
domain: Flowti
stage: done
description: "Welcome greeting, active session card, cross-hub summary cards, always-visible inbox section, and quick-action buttons for the User Hub"
source: "[[Development/flowti/src/ui/userHub/UserHubDashboard.ts|UserHubDashboard.ts]]"
parent: "[[UserHubView]]"
tags:
  - hub
  - component
---

# UserHubDashboard

## Description

UserHubDashboard renders the landing page of the User Hub. It displays a personalized welcome greeting, an active session card (when a session is running), quick-action buttons, aggregated stat cards from all registered hub providers, and an always-visible inbox section styled like a mail inbox.

The dashboard self-filters: the User Hub's own provider is excluded from the summary cards. Stat cards include optional `tabId` for deep-linking — clicking a card navigates directly to the target hub's specific tab via `HubRegistry.openHub(hubId, tabId)`.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `IUserService` | interface | Retrieves the current user's name for the welcome greeting |
| `HubRegistry` | class | Provides `getAll()` for summary cards, `openHub()` for stat card navigation |
| `IEventBus` | interface | Emits `ui.openX` events for quick actions; emits `session.pause`/`session.complete` for active session card |
| `InboxService` | class | Provides `getItems()`, `getUnreadCount()`, `clearAll()` for the inbox section |
| `SessionService` | class | Provides `getActiveSession()` for the active session card |
| `renderStatGrid` | function | Shared helper from `StatCard.ts` that renders a grid of clickable stat cards |
| `formatSourceEvent` | function | Maps source event types to human-readable labels |
| `computeRemainingMs`, `formatDuration` | functions | From `session/helpers` — compute and display session timer |
| `navigateToTab` | callback | Navigates to Inbox/Sessions tab from dashboard |
| `onInboxItemClick` | callback | Navigates to Inbox tab with pre-selected item |

## State

**Stateless** — reads all data from injected dependencies on each `render()` call. No internal state.

## Renders

Layout order: Welcome → Active Session → Quick Actions → Hub Summaries → Inbox Section.

- **Welcome section** — Home icon + "Welcome, {name}" (or "Welcome to Flowti" when no user is set)
- **Active session card** — Only shown when `sessionService.getActiveSession()` returns non-null. Accent-bordered card with timer icon, session title, type badge, remaining time (monospace), Pause and Complete action buttons
- **Quick actions** — 7 navigation buttons: Inbox, Sessions, Preferences, Event Catalog, Data Exchange, Activity Log, Watchers
- **Hub summaries** — "Your Hubs" heading with a stat grid. Each provider's stats prefixed with display name. Clicking a card deep-links to the target hub's tab
- **Inbox section** — Always visible, styled as a mail-inbox container with header (unread count badge, Clear button), up to 5 item rows (type icon, title, source badge, timestamp), and "View all (N) →" footer link. **PBI-005** will add vault folder items to this section with "Vault Folder" source badges — untyped notes from watched folders will appear alongside event-driven items

## Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| `session.pause` | Emits | Active session card: Pause button |
| `session.complete` | Emits | Active session card: Complete button |
| `ui.openEventCatalog` | Emits | Quick action: open Event Catalog |
| `ui.openDataExchangeHub` | Emits | Quick action: open Data Exchange Hub |
| `ui.openEventLog` | Emits | Quick action: open Activity Log sidebar |
| `ui.openSubscriptionManager` | Emits | Quick action: open Watchers modal |

## Related

- Parent: [[UserHubView]]
- Siblings: [[UserHubInbox]], [[UserHubSessions]], [[UserHubPreferences]]
- Reuses: [[StatCard]] (`renderStatGrid`)
- Planned: [[PBI-005 Vault Folder Inbox]] (vault folder items in dashboard inbox section)
