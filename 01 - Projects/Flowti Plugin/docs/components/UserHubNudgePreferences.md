---
type: Component
domain: Flowti
stage: done
description: "Nudge preferences panel with nudge list, enable/disable toggles, and add-nudge form"
source: "[[Development/flowti/src/ui/userHub/UserHubNudgePreferences.ts|UserHubNudgePreferences.ts]]"
parent: "[[UserHubPreferences]]"
tags:
  - hub
  - component
---

# UserHubNudgePreferences

## Description

UserHubNudgePreferences renders the nudge configuration section in the User Hub's Preferences tab. Shows existing nudge configs as rows with enable toggle and delete button, plus an add-nudge form with time picker, session type selector, title, duration, and enabled toggle.

All mutations flow through EventBus commands to NudgeService.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `UserHubComponentDeps` | interface | Provides `nudgeService`, `eventBus`, `app` |
| `NudgeConfig` | type | Nudge configuration: `id`, `title`, `time`, `sessionType`, `durationMinutes`, `enabled` |
| `SESSION_TYPES`, `SESSION_TYPE_LABELS` | constants | Available session types and labels |
| `setIcon` | obsidian | Renders bell icon in header |

## State

**Reads via `deps.nudgeService`:**
- `getConfigs()` — array of configured nudges

## Related

- Parent: [[UserHubPreferences]]
- Sibling: [[UserHubSessionPreferences]]
- Domain: NudgeService (`src/domain/nudge/NudgeService.ts`)
- Notification: [[NudgeNotification]]
