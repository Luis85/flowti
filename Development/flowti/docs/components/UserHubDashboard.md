---
type: Component
domain: Flowti
stage: done
description: "Welcome greeting, cross-hub summary stat cards, and quick-action buttons for the User Hub"
source: "[[Development/flowti/src/ui/userHub/UserHubDashboard.ts|UserHubDashboard.ts]]"
parent: "[[UserHubView]]"
tags:
  - hub
  - component
---

# UserHubDashboard

## Description

UserHubDashboard renders the landing page of the User Hub. It displays a personalized welcome greeting, aggregated stat cards from all registered hub providers, and quick-action buttons for navigating to frequently used views. The dashboard self-filters: the User Hub's own provider is excluded from the summary cards to avoid circular display.

Stat cards include optional `tabId` for deep-linking — clicking a card navigates directly to the target hub's specific tab (e.g., "Event Catalog -- Events" opens the Events tab) via `HubRegistry.openHub(hubId, tabId)`.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `IUserService` | interface | Retrieves the current user's name for the welcome greeting |
| `HubRegistry` | class | Provides `getAll()` to iterate registered hub providers for summary cards, and `openHub()` for stat card navigation |
| `IEventBus` | interface | Emits `ui.openX` events for quick-action buttons |
| `renderStatGrid` | function | Shared helper from `StatCard.ts` that renders a grid of clickable stat cards |
| `setIcon` | obsidian | Renders the home icon in the welcome section |

## State

**Stateless** — reads all data from injected dependencies on each `render()` call. No internal state.

## Renders

- **Welcome section** -- Home icon + "Welcome, {name}" (or "Welcome to Flowti" when no user is set), separated by a bottom border
- **Hub summaries** -- "Your Hubs" heading with a stat grid. Each provider's stats are prefixed with the provider's display name (e.g., "Event Catalog -- Events"). Clicking a card calls `hubRegistry.openHub(hubId, stat.tabId)`. Section hidden when no other providers are registered.
- **Quick actions** -- 4 navigation buttons: Event Catalog (`ui.openEventCatalog`), Data Exchange (`ui.openDataExchangeHub`), Activity Log (`ui.openEventLog`), Watchers (`ui.openSubscriptionManager`)

## Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| `ui.openEventCatalog` | Emits | Quick action: open Event Catalog |
| `ui.openDataExchangeHub` | Emits | Quick action: open Data Exchange Hub |
| `ui.openEventLog` | Emits | Quick action: open Activity Log |
| `ui.openSubscriptionManager` | Emits | Quick action: open Watchers modal |

## Related

- Parent: [[UserHubView]]
- Siblings: [[UserHubInbox]], [[UserHubActivity]]
- Reuses: [[StatCard]] (`renderStatGrid`)
