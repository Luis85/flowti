---
type: Component
domain: Flowti
stage: done
description: "Welcome greeting, cross-hub summary cards, always-visible inbox section, and quick-action buttons for the User Hub"
source: "[[Development/flowti/src/ui/userHub/UserHubDashboard.ts|UserHubDashboard.ts]]"
parent: "[[UserHubView]]"
tags:
  - hub
  - component
---

# UserHubDashboard

## Description

UserHubDashboard renders the landing page of the User Hub. It displays a personalized welcome greeting, aggregated stat cards from all registered hub providers, an always-visible inbox section styled like a mail inbox, and quick-action buttons for navigating to frequently used views.

The dashboard self-filters: the User Hub's own provider is excluded from the summary cards to avoid circular display. Stat cards include optional `tabId` for deep-linking — clicking a card navigates directly to the target hub's specific tab via `HubRegistry.openHub(hubId, tabId)`.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `IUserService` | interface | Retrieves the current user's name for the welcome greeting |
| `HubRegistry` | class | Provides `getAll()` to iterate registered hub providers for summary cards, and `openHub()` for stat card navigation |
| `IEventBus` | interface | Emits `ui.openX` events for quick-action buttons |
| `InboxService` | class | Provides `getItems()`, `getUnreadCount()`, `clearAll()` for the inbox section |
| `renderStatGrid` | function | Shared helper from `StatCard.ts` that renders a grid of clickable stat cards |
| `formatSourceEvent` | function | Maps source event types to human-readable labels (e.g., "Watcher", "Import") |
| `navigateToTab` | callback | Navigates to the Inbox tab when "View all" link is clicked |
| `onInboxItemClick` | callback | Navigates to Inbox tab with pre-selected item and marks it as read |
| `setIcon` | obsidian | Renders icons (home, inbox, trash-2, alert-circle, info) |

## State

**Stateless** — reads all data from injected dependencies on each `render()` call. No internal state.

## Renders

Layout order: Welcome → Hub Summaries → Quick Actions → Inbox Section.

- **Welcome section** — Home icon + "Welcome, {name}" (or "Welcome to Flowti" when no user is set), separated by a bottom border
- **Hub summaries** — "Your Hubs" heading with a stat grid. Each provider's stats are prefixed with the provider's display name (e.g., "Event Catalog — Events"). Clicking a card calls `hubRegistry.openHub(hubId, stat.tabId)`. Section hidden when no other providers are registered.
- **Inbox section** — Always visible, styled as a mail-inbox container with `ft-inbox-section` class:
  - Container: border, border-radius, overflow hidden
  - Header: background-secondary with inbox icon, "Inbox" title, unread count badge, and "Clear" button (when items exist)
  - Empty state: centered muted text "Your inbox is empty" with subtitle
  - Item rows (max 5): type icon (alert-circle / info), title, source badge (Watcher / Import / Export), timestamp (right-aligned). Unread items: bold text + 3px left accent border in `--interactive-accent`
  - Footer: "View all (N) →" link when items > 5, navigates to Inbox tab
- **Quick actions** — 4 navigation buttons: Event Catalog, Data Exchange, Activity Log, Watchers

## Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| `ui.openEventCatalog` | Emits | Quick action: open Event Catalog |
| `ui.openDataExchangeHub` | Emits | Quick action: open Data Exchange Hub |
| `ui.openEventLog` | Emits | Quick action: open Activity Log sidebar |
| `ui.openSubscriptionManager` | Emits | Quick action: open Watchers modal |

## Related

- Parent: [[UserHubView]]
- Sibling: [[UserHubInbox]]
- Reuses: [[StatCard]] (`renderStatGrid`)
