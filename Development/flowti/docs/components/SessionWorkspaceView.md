---
type: Component
domain: Session
stage: development
description: "Dedicated focused workspace for a single documentation session with timer, goals, notes, links, canvas, artifacts, and activity log"
source: "[[Development/flowti/src/ui/SessionWorkspaceView.ts|SessionWorkspaceView.ts]]"
feature: "[[Session Workspaces PRD]]"
viewType: flowti-session-workspace
tags:
  - view
  - session
  - workspace
---

# SessionWorkspaceView

## Description

SessionWorkspaceView is a dedicated focused leaf for working within a single documentation session. It extends Obsidian's `ItemView` directly (not `BaseHubView`) because it renders a single-session workspace rather than a tabbed hub shell.

The view loads a specific session (by `workspaceSessionId` or falling back to active session) and renders a scrollable single-column layout. All sections update reactively via EventBus subscriptions. The view does not own state — it reads from `SessionService` and dispatches mutations via events.

## Sections (render order)

| Section | Condition | Description |
|---------|-----------|-------------|
| Header | Always | Title, type badge, status badge |
| Actions | Always | Contextual lifecycle buttons (Start, Pause, Resume, Complete, Archive, Delete, Save Template) |
| Timer | Active/Paused | Large monospace countdown with direct DOM update |
| Goals | Always | Checklist with add/toggle/remove + goal count badge |
| Notes | Always | Debounced textarea (500ms) |
| Notes File | When set | Clickable link to session notes file |
| Canvas File | When set / Create button | Clickable link or "Create Session Canvas" button |
| Focus File | When set | Clickable link to focused file |
| Links | Always | User-linked files with remove buttons |
| Artifacts | Always | Files created/modified during session with action badges |
| Activity Log | Planned (PBI-SW-001) | Chronological vault activity with folder filtering |

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `IEventBus` | interface | Event subscriptions + command dispatch |
| `SessionService` | service | Session state access (`getSessionById`, `getActiveSession`, `workspaceSessionId`) |
| `formatDuration`, `computeRemainingMs` | functions | Timer display formatting |
| `generateSessionSummary` | function | Summary generation (used indirectly via events) |
| `SESSION_TYPE_LABELS`, `SESSION_STATUS_LABELS` | maps | Human-readable labels for badges |
| `SaveTemplateModal` | modal | Template creation UI |

## Event Subscriptions (11)

| Event | Handler |
|-------|---------|
| `session.timer.tick` | Update timer display directly (no re-render) |
| `session.timer.completed` | Refresh session state + re-render |
| `session.started` | Refresh session + re-render |
| `session.paused` | Refresh session + re-render |
| `session.resumed` | Refresh session + re-render |
| `session.completed` | Refresh session + re-render |
| `session.goal.added` | Refresh goals section |
| `session.goal.toggled` | Refresh goals section |
| `session.goal.removed` | Refresh goals section |
| `session.link.added` | Refresh links section |
| `session.link.removed` | Refresh links section |

## Planned Additions (PBI-SW-001)

| Addition | Description |
|----------|-------------|
| `activity: SessionActivity[]` rendering | Chronological timeline panel with action badges, timestamps, and clickable file paths |
| Per-session folder filter UI | Text input for adding/removing folder exclusions scoped to this session |
| `session.activity.tracked` subscription | Live update: new activity items appear without full re-render |
| `session.activity.filter.updated` subscription | Re-filter displayed activity when filter changes |

## CSS Classes

| Class | Purpose |
|-------|---------|
| `ft-hide-header` | Applied to `containerEl` — hides Obsidian view header, adds 27px top padding |
| `ft-session-workspace-*` | Prefix for all workspace-specific layout classes |
| `ft-session-timer` | Timer display element (monospace font, centered) |

## Technical Notes

- View type: `flowti-session-workspace`, icon: `timer`
- Session loading order: `workspaceSessionId` (explicit) → `getActiveSession()` (fallback)
- `workspaceSessionId` on SessionService tracks the target session across status changes
- Adjacent leaf tracked for focus file split view
- All event subscriptions cleaned up in `onClose()` via `unsubscribes[]`
- Source file: `src/ui/SessionWorkspaceView.ts` (~753 LOC)
