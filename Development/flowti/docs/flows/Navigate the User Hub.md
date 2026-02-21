---
type: Flow
domain: Flowti
stage: done
description: Orientation guide for the User Hub — the personal cockpit view with dashboard, sessions, inbox, and preferences tabs
domains:
  - User
  - Hub
  - Inbox
  - Session
  - Nudge
services:
  - UserService
  - InboxService
  - SessionService
  - NudgeService
  - HubRegistry
events:
  - ui.openUserHub
  - hub.opened
  - hub.closed
  - hub.tab.changed
tags:
  - user-hub
  - navigation
---

# Navigate the User Hub

## Overview

The User Hub is the personal cockpit for Flowti — accessible from the sidebar ribbon icon (home) or the command palette. It provides a dashboard with cross-hub summaries, session management, inbox notifications, and preference configuration. The view extends BaseHubView with three tabs: Sessions, Inbox, and Preferences, plus an implicit Dashboard landing page.

## Trigger

User clicks the "Open User Hub" ribbon icon (home) or invokes the "Open User Hub" command from the palette.

## Steps

### 1. Open the User Hub

- **View/Service**: main.ts → UiCommandService → UserHubView
- **User Action**: Clicks the home ribbon icon or invokes `flowti:open-user-hub` from command palette
- **System Response**: Both emit `ui.openUserHub`. UiCommandService reveals or creates the User Hub leaf. BaseHubView emits `hub.opened`. The Dashboard renders as the landing page.
- **Events**: `ui.openUserHub` → `hub.opened`

### 2. Dashboard

- **View/Service**: UserHubDashboard
- **User Action**: (none — automatic landing page)
- **System Response**: The dashboard renders 6 sections:
  1. **Welcome banner**: "Welcome, {user.name}" (or "Welcome to Flowti" if no user profile)
  2. **Next nudge**: If enabled nudges exist with a future time, shows next nudge title, time badge, and session type
  3. **Active session card**: If a session is running or paused, shows title, type badge, elapsed timer (live-updating via `session.timer.tick`), goals progress, and Pause/Resume + Complete action buttons. Clicking the card opens Session Workspace.
  4. **Quick Actions**: 8 buttons — New Session, Sessions, Inbox, Preferences, Event Catalog, Data Exchange, Activity Log, Watchers
  5. **Your Hubs**: Stat cards from every registered hub provider (EventCatalogProvider, DataExchangeProvider) via `HubRegistry.getAll()`. Clicking a stat navigates to that hub's tab.
  6. **Inbox preview**: Up to 5 recent inbox items inline, with unread count badge and "View all" link
- **Events**: Subscribes to `session.*` events, `inbox.itemAdded`, `inbox.itemsChanged`, `user.updated`

### 3. Sessions Tab

- **View/Service**: UserHubSessions
- **User Action**: Clicks "Sessions" tab (icon: `timer`) or Quick Action button
- **System Response**: Master list shows all sessions grouped by status (running → active → paused → prepared → reviewing → completed → archived). Completed and archived groups start collapsed. Each row shows title, date/time, and type badge. Selecting a session opens the detail panel with: header, status/type badges, action buttons (context-sensitive by status), timer, info grid (created, duration, elapsed, focus file), links, artifacts, and timeline. Templates list shown if no session selected.
- **Events**: `hub.tab.changed`

### 4. Inbox Tab

- **View/Service**: UserHubInbox
- **User Action**: Clicks "Inbox" tab (icon: `inbox`) or Quick Action button
- **System Response**: Master list with search filter, item count header with unread count, and clear-all button. Items show type icon (`alert-circle` for action, `info` for info), title, source event badge, and timestamp. Detail panel shows: title, meta badges, "Triggered by" clickable event link (navigates to Event Catalog), description, Mark Read and Dismiss buttons.
- **Events**: `hub.tab.changed`

### 5. Preferences Tab

- **View/Service**: UserHubPreferences
- **User Action**: Clicks "Preferences" tab (icon: `settings`) or Quick Action button
- **System Response**: Master-detail layout with 4 categories:
  - **Profile** (user icon): Display name edit, User ID
  - **Inbox** (inbox icon): Per-source notification toggles (6 sources)
  - **Sessions** (timer icon): Activity log filter, custom session types, custom output templates
  - **Nudges** (bell icon): Time-based session start reminders
  Search bar is hidden on this tab.
- **Events**: `hub.tab.changed`

## Hub Layout

```
┌─────────────────────────────────────────────────────────┐
│ [home]  User Hub                            [user name] │  ← top bar
├─────────────────────────────────────────────────────────┤
│  Sessions  │  Inbox (3)  │  Preferences                 │  ← tab bar
├─────────────┬───────────────────────────────────────────┤
│             │                                           │
│  Master     │  Detail / Dashboard                       │  ← split layout
│  List       │                                           │
│             │                                           │
└─────────────┴───────────────────────────────────────────┘
```

## Cross-Hub Navigation

The User Hub participates in the HubRegistry system. Other hubs (Event Catalog, Data Exchange) show User Hub stats in their dashboards. Clicking these stats navigates to the User Hub via `HubRegistry.openHub("user-hub", tabId)` which emits `hub.navigate`.

## Events Summary

| Event | When |
|-------|------|
| `ui.openUserHub` | Ribbon click or command |
| `hub.opened` / `hub.closed` | View lifecycle |
| `hub.tab.changed` | Tab navigation |
| `hub.navigate` | Cross-hub navigation |
| `session.*` (13 events) | Refresh session state |
| `session.timer.tick` | Live timer update (direct DOM) |
| `inbox.itemAdded` / `inbox.itemsChanged` | Inbox state sync |
| `settings.changed` | Settings sync |
| `user.updated` | User name change |

## Related Use Cases

- [[Create and Manage Sessions]] (Sessions tab)
- [[Manage Inbox Notifications]] (Inbox tab)
- [[Configure Your Profile and Preferences]] (Preferences tab)
- [[Configure Session Nudges]] (Preferences → Nudges)
- [[Browse and Configure Events]] (Quick Action → Event Catalog)
- [[Manage Event Watchers]] (Quick Action → Watchers)
