---
type: Flow
domain: Flowti
stage: done
description: User-facing preferences in the User Hub — profile identity, inbox source toggles, session customization, and nudge configuration
domains:
  - User
  - Settings
  - Inbox
  - Session
  - Nudge
services:
  - UserService
  - SettingsService
  - NudgeService
events:
  - user.updated
  - settings.updateInboxEnabledSources
  - settings.updateSessionActivityFilter
  - settings.updateCustomSessionTypes
  - settings.updateCustomOutputTemplates
  - nudge.configure
  - nudge.remove
tags:
  - preferences
  - user
  - settings
---

# Configure Your Profile and Preferences

## Overview

The User Hub Preferences tab provides personal configuration organized into four categories: Profile, Inbox, Sessions, and Nudges. Changes save automatically — there is no explicit Save button. This is distinct from the plugin-level Settings tab (Obsidian Settings → Flowti), which handles infrastructure configuration like documentation paths and the event system toggle.

## Trigger

User opens the User Hub, clicks the Preferences tab (icon: `settings`), and selects a category from the master list.

## Steps

### 1. Open Preferences

- **View/Service**: UserHubView → UserHubPreferences
- **User Action**: Opens User Hub, clicks Preferences tab
- **System Response**: Master-detail layout with 4 categories in the master list. Search bar is hidden on this tab. Selecting a category renders its detail panel.
- **Events**: `hub.tab.changed`

### 2. Profile

- **View/Service**: UserHubPreferences (inline)
- **User Action**: Selects "Profile" (user icon) from master list
- **System Response**: Detail panel shows:
  - **Display name**: Editable text field. On change: calls `userService.updateUserName(value)`, which emits `user.updated`. The name updates in the User Hub top bar and welcome banner.
  - **User ID**: Read-only UUID display
  - If no user profile exists: "No user profile configured. Run the setup wizard to create one."
- **Events**: `user.updated`

### 3. Inbox Sources

- **View/Service**: UserHubPreferences (inline)
- **User Action**: Selects "Inbox" (inbox icon) from master list
- **System Response**: Detail panel shows "Inbox Sources" heading with description: "Choose which events create inbox notifications. Disabling a source stops new items; existing items are not affected." Lists 6 toggleable sources:

  | Toggle | Source Event | Description |
  |--------|-------------|-------------|
  | Watcher matches | `subscription.matched` | When a file watcher matches an event |
  | Import completed | `dataExchange.import.completed` | When a CSV import finishes |
  | Import errors | `dataExchange.import.failed` | When a CSV import fails |
  | Export completed | `dataExchange.export.completed` | When a data export finishes |
  | Pipeline completed | `dataExchange.pipeline.completed` | When a pipeline finishes |
  | Pipeline errors | `dataExchange.pipeline.failed` | When a pipeline fails |

  On toggle change: emits `settings.updateInboxEnabledSources` with the updated sources array. InboxService checks this list before creating items from source events.
- **Events**: `settings.updateInboxEnabledSources`

### 4. Sessions

- **View/Service**: UserHubPreferences → UserHubSessionPreferences
- **User Action**: Selects "Sessions" (timer icon) from master list
- **System Response**: Detail panel shows 3 sub-sections:

#### 4a. Activity Log Filter (icon: `filter`)
- Description: "Vault folders excluded from the session activity log globally."
- Lists existing folder exclusions with remove (×) button per entry
- Add row: text input + (+) button to add new folder path
- On add/remove: emits `settings.updateSessionActivityFilter` with updated array

#### 4b. Custom Session Types (icon: `star`)
- Description: "Create custom session types with their own guiding questions, duration, and goals."
- Lists existing custom types with: label, default duration, question count, remove button
- Add form: type key (slug), display label, duration (minutes), guiding questions (textarea, one per line)
- On add/remove: emits `settings.updateCustomSessionTypes` with updated record

#### 4c. Custom Output Templates (icon: `file-output`)
- Description: "Create templates for generating output artifacts from completed sessions."
- Available placeholders: `{{title}}`, `{{date}}`, `{{type}}`, `{{duration}}`, `{{goals}}`, `{{decisions}}`, `{{artifacts}}`, `{{context}}`, `{{notes}}`, `{{overview}}`
- Lists existing templates with: title, section count, remove button
- Add form: template title, description, sections (textarea, one per line as `Heading|{{placeholder}}`)
- On add/remove: emits `settings.updateCustomOutputTemplates` with updated array

- **Events**: `settings.updateSessionActivityFilter`, `settings.updateCustomSessionTypes`, `settings.updateCustomOutputTemplates`

### 5. Nudges

- **View/Service**: UserHubPreferences → UserHubNudgePreferences
- **User Action**: Selects "Nudges" (bell icon) from master list
- **System Response**: See [[Configure Session Nudges]] for the full nudge configuration flow. In summary: lists existing nudge configs with enable/disable toggles and delete buttons, provides an add form for new nudges (title, time, session type, duration).
- **Events**: `nudge.configure`, `nudge.remove`

## Settings vs. Preferences

| Aspect | Plugin Settings | User Hub Preferences |
|--------|----------------|---------------------|
| Location | Obsidian Settings → Flowti | User Hub → Preferences tab |
| Scope | Infrastructure (paths, toggles, debug) | Personal (identity, inbox, sessions, nudges) |
| Accessed via | Obsidian gear icon → plugin list | User Hub tab bar |
| See flow | [[Configure Plugin Settings]] | This document |

## Events Summary

| Category | Event | Trigger |
|----------|-------|---------|
| Profile | `user.updated` | Display name change |
| Inbox | `settings.updateInboxEnabledSources` | Source toggle |
| Sessions | `settings.updateSessionActivityFilter` | Filter add/remove |
| Sessions | `settings.updateCustomSessionTypes` | Type add/remove |
| Sessions | `settings.updateCustomOutputTemplates` | Template add/remove |
| Nudges | `nudge.configure` | Enable/disable or add nudge |
| Nudges | `nudge.remove` | Delete nudge |

## Related Use Cases

- [[Navigate the User Hub]] (Preferences is the third tab)
- [[Configure Plugin Settings]] (companion: infrastructure settings)
- [[Configure Session Nudges]] (detailed nudge flow)
- [[Create and Manage Sessions]] (custom session types and output templates)
- [[Manage Inbox Notifications]] (inbox source toggles)
