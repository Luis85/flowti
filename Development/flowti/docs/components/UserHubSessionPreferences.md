---
type: Component
domain: Flowti
stage: done
description: "Session preferences panel with activity filter, custom session types, and custom output templates"
source: "[[Development/flowti/src/ui/userHub/UserHubSessionPreferences.ts|UserHubSessionPreferences.ts]]"
parent: "[[UserHubPreferences]]"
tags:
  - hub
  - component
---

# UserHubSessionPreferences

## Description

UserHubSessionPreferences renders three sub-sections in the User Hub's Preferences tab:

1. **Activity Log Filter** — global folder exclusion list for session activity tracking (prefix match)
2. **Custom Session Types** — CRUD for user-defined session types with guiding questions
3. **Custom Output Templates** — CRUD for output artifact templates

All mutations flow through EventBus commands to SettingsService.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `UserHubComponentDeps` | interface | Provides `getSettings()`, `eventBus`, `app` |
| `FlowtiSettings` | type | Settings object with session-related config |
| `setIcon` | obsidian | Renders filter and section icons |

## State

**Reads via `deps.getSettings()`:**
- `sessionActivityFilterGlobal` — global folder exclusion list
- `customSessionTypes` — user-defined session type configs
- `customOutputTemplates` — user-defined output templates

## Related

- Parent: [[UserHubPreferences]]
- Sibling: [[UserHubNudgePreferences]]
- Grandparent: [[UserHubView]]
