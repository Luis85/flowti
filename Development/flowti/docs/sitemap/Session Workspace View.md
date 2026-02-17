---
stage: development
domain: Session
plugin: "[[Development/flowti/README|README]]"
tags:
  - view
  - session
  - workspace
description: Dedicated focused workspace for a single documentation session with timer, goals, notes, links, artifacts, and activity log
type: View
viewType: flowti-session-workspace
extends: ItemView
source: "[[Development/flowti/src/ui/SessionWorkspaceView.ts|SessionWorkspaceView.ts]]"
feature: "[[Session Workspaces PRD]]"
---

# Session Workspace View

## Description

The Session Workspace is a dedicated focused leaf for a single documentation session. Unlike Hub views that extend `BaseHubView` with a tabbed shell, this view extends `ItemView` directly because it renders a single-session workspace rather than a multi-tab hub.

The workspace loads a specific session (by `workspaceSessionId` or falling back to the active session) and renders a scrollable single-column layout with contextual sections that appear based on session status. All mutations go through the EventBus — the view is purely reactive.

### Layout

```
+--------------------------------------------------+
| [Title]  [Type Badge]  [Status Badge]            |
| [Start] [Pause] [Complete] [Save Template] ...   |
+--------------------------------------------------+
|              ##  25:00  ##                        |
|              Time Remaining                       |
+--------------------------------------------------+
| Goals  (2/5)                                     |
| [ ] Review types.ts                              |
| [v] Update events.ts                             |
| [+ Add goal...]                                  |
+--------------------------------------------------+
| Notes                                            |
| [textarea - debounced save (500ms)]              |
+--------------------------------------------------+
| Notes File: [[Session Notes 2026-02-17.md]]      |
| Canvas: [[Session Canvas.canvas]]  [Create]      |
+--------------------------------------------------+
| Focus File: src/domain/session/types.ts          |
+--------------------------------------------------+
| Links (3)                                        |
| - events.ts  [x]                                 |
| - README.md  [x]                                 |
+--------------------------------------------------+
| Artifacts (5)                                    |
| created  events.ts           14:32               |
| modified types.ts            14:28               |
+--------------------------------------------------+
| Activity Log (12)  [Filter: src/domain/]         |
| 14:32 created  src/domain/events.ts              |
| 14:28 modified src/domain/types.ts               |
| 14:25 deleted  src/domain/old.ts                 |
| 14:20 renamed  foo.ts → bar.ts                   |
+--------------------------------------------------+
```

## Use Cases

### Work in a focused session workspace
Open the workspace for any session (prepared, active, paused, completed, archived) to see its full context in one place. The workspace opens via the "Open Workspace" button in the User Hub sessions tab, or automatically on session start.

### Monitor session timer
When a session is active, the workspace displays a large monospace countdown timer with "Time Remaining" label. Timer ticks update the DOM directly without full re-render. When paused, the timer shows "Paused" with the remaining time frozen.

### Manage session goals
Add, toggle, and remove goals from the goals checklist. The goal count badge updates in real-time. Goals can be added during prepared or active sessions.

### Take session notes
Type notes in the debounced textarea (500ms save delay). Notes are persisted on the session object and included in the session summary on completion.

### Attach files to a session
Right-click any file in the vault and select "Add to Session" to link it. Links appear in the workspace with remove buttons. The right-click menu only appears when a session is current.

### View session artifacts
Files created or modified during the session appear in the artifacts section with action badges (created/modified) and timestamps. Click an artifact to open the file.

### Track session activity (PBI-SW-001)
**Planned**: A chronological activity log showing all vault file events (created, modified, deleted, renamed) during the session. Filtered by global + per-session folder exclusions. Capped at 1000 entries with oldest-first eviction.

### Filter activity by folder (PBI-SW-001)
**Planned**: Configure per-session folder filters in the workspace to scope the activity log to the session's working area. Combined with global filters from plugin settings.

### Create a session canvas
Click "Create Session Canvas" to generate a `.canvas` file linked to the session. The canvas embed is auto-appended to the notes file.

### Save session as template
Click "Save as Template" (available for all session statuses) to create a reusable template with the session's type, duration, and goals.

### Edit duration before starting
For prepared sessions, the duration field is an editable number input. Change the duration before clicking Start.

## Technical Notes

- Registered under view type `flowti-session-workspace` with the `timer` icon
- Extends `ItemView` directly (not BaseHubView) — single-session focus, no tabs
- Uses `ft-hide-header` class for Obsidian view header hiding + CSS padding compensation
- Session loading: `workspaceSessionId` (explicit target) → `getActiveSession()` (fallback)
- `workspaceSessionId` on SessionService enables workspace to track a specific session across status changes
- Timer: `session.timer.tick` updates monospace display directly, no full re-render
- Notes: debounced at 500ms via `session.notes.update` event
- 11 event subscriptions for live updates (timer, goals, links, notes, artifacts, lifecycle changes)
- All subscriptions cleaned up in `onClose()` via `unsubscribes` array
- Adjacent leaf tracking for focus file split view
- Source: `src/ui/SessionWorkspaceView.ts` (~753 LOC)
