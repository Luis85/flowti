---
type: Component
domain: Flowti
stage: done
description: "User profile editing and inbox source configuration toggles for the User Hub"
source: "[[Development/flowti/src/ui/userHub/UserHubPreferences.ts|UserHubPreferences.ts]]"
parent: "[[UserHubView]]"
tags:
  - hub
  - component
---

# UserHubPreferences

## Description

UserHubPreferences renders the Preferences tab of the User Hub. The master panel provides two sections: **User Profile** (display name editing) and **Inbox Sources** (per-source toggles for inbox notifications). The detail panel shows a static info text about preferences.

Profile changes are saved immediately via `userService.updateUserName()`. Inbox source toggles emit `settings.updateInboxEnabledSources` events for persistence and update local state via `deps.setState()`.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `UserHubComponentDeps` | interface | Provides `getState()`, `setState()`, `eventBus`, `userService` |
| `INBOX_SOURCE_DEFINITIONS` | constant | Array of 6 source definitions (event, label, desc) from `domain/inbox/types` — will grow to 7 with PBI-005 `vaultFolder` entry |
| `setIcon` | obsidian | Renders settings icon in detail panel |

## State

**Reads via `deps.getState()`:**
- `inboxEnabledSources` — array of enabled source event type strings

**Writes via `deps.setState()`:**
- `inboxEnabledSources` — updated when toggles change

## Renders

**Master panel:**
- **User Profile section**: display name label + text input (change event → `userService.updateUserName()`), User ID display (read-only). Shows "No user profile" message when no user exists.
- **Inbox Sources section**: heading, descriptive text, and 6 checkbox toggles (one per `INBOX_SOURCE_DEFINITIONS` entry). Each toggle shows label and description text. Checking/unchecking emits `settings.updateInboxEnabledSources` with the updated sources array.

**Planned extensions (PBI-005 — Cycle 12):**
- **Vault Folder Configuration section**: add/remove watched folder paths with per-folder recursive toggle and primary/secondary designation. Configure target folder for primary inbox routing.
- **7th inbox source toggle**: `vaultFolder` entry added to `INBOX_SOURCE_DEFINITIONS`, rendered as an additional checkbox in the Inbox Sources section.

**Detail panel:**
- Settings icon + "Preferences" heading + descriptive paragraph about auto-saving

## Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| `settings.updateInboxEnabledSources` | Emits | When an inbox source toggle is changed |

## Related

- Parent: [[UserHubView]]
- Siblings: [[UserHubDashboard]], [[UserHubInbox]], [[UserHubSessions]]
- Domain: `InboxService` (`src/domain/inbox/InboxService.ts`), `INBOX_SOURCE_DEFINITIONS` (`src/domain/inbox/types.ts`)
- Planned: [[PBI-005 Vault Folder Inbox]] (folder configuration + 7th source toggle)
