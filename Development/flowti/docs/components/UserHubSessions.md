---
type: Component
domain: Flowti
stage: done
description: "Master-detail sessions tab with status-sorted list, live timer, artifacts, and contextual lifecycle actions"
source: "[[Development/flowti/src/ui/userHub/UserHubSessions.ts|UserHubSessions.ts]]"
parent: "[[UserHubView]]"
tags:
  - hub
  - component
---

# UserHubSessions

## Description

UserHubSessions renders the Sessions tab of the User Hub using a master-detail split layout. The master panel shows a status-sorted list of documentation sessions (filterable by title) with status icons, type badges, and accent borders on active sessions. The detail panel shows the selected session's full details including a live countdown timer, info section, artifact list, and contextual lifecycle action buttons.

Sessions are managed by the `SessionService` domain. Each session has a lifecycle: Prepared → Active → Paused → Completed → Archived. The timer display uses a direct DOM update optimization — `updateTimerDisplay(remainingMs)` writes directly to the `.ft-session-timer` element without triggering a full re-render, enabling smooth 1-second updates.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `UserHubComponentDeps` | interface | Provides `getState()`, `setState()`, `eventBus`, `scheduleRender()`, `openNewSessionModal()` |
| `formatDuration`, `computeRemainingMs`, `computeElapsedMs` | functions | From `session/helpers` — timer display and info section |
| `SESSION_STATUS_LABELS`, `SESSION_TYPE_LABELS` | maps | Human-readable labels for status and type badges |
| `setIcon` | obsidian | Renders status icons (circle, play, pause, check-circle, archive) and artifact icons |

## State

**Reads via `deps.getState()`:**
- `sessions` — array of `Session` objects to display
- `selectedSession` — currently selected session for detail view

**Writes via `deps.setState()`:**
- `selectedSession` — set when a session row is clicked

## Renders

**Master panel:**
- Header with session count, active count (e.g., "3 sessions (1 active)"), and "New" button (opens `NewSessionModal`)
- Sessions sorted: active → paused → prepared → completed → archived
- Each row: status icon, title, type badge (muted), status text (right-aligned)
- Active sessions: 3px left border in `--interactive-accent`
- Selected session: `ft-catalog-row-active` class + hover background
- Filter applied on `session.title` (case-insensitive substring match)
- Click → `setState({ selectedSession })` + `scheduleRender()`

**Detail panel (session selected):**
- Header: title (h3), status badge, type badge
- Timer section (active/paused only): "Time Remaining" or "Paused" label + large monospace timer display with `.ft-session-timer` class
- Info section: Created date, Duration (min), Elapsed time, Completed date (if applicable)
- Artifacts section (when > 0): list of up to 20 artifacts with file-plus/file-edit icon, filename, action badge; overflow shows "+ N more"
- Actions section: contextual buttons per status:
  - Prepared: Start, Delete
  - Active: Pause, Complete
  - Paused: Resume, Complete
  - Completed: Archive, Delete
  - Archived: Delete

**Empty states:**
- Master: timer icon (48px), "No sessions yet", descriptive subtext, "New Session" button (opens `NewSessionModal`)
- Detail: timer icon, "Select a session to view details"

**`updateTimerDisplay(remainingMs)`:**
- Directly writes to `.ft-session-timer` element's `textContent`
- Called by `UserHubView` on `session.timer.tick` events
- No-op when no timer element exists (e.g., non-active session selected)

## Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| `session.start` | Emits | Start button (prepared sessions) |
| `session.pause` | Emits | Pause button (active sessions) |
| `session.resume` | Emits | Resume button (paused sessions) |
| `session.complete` | Emits | Complete button (active/paused sessions) |
| `session.archive` | Emits | Archive button (completed sessions) |
| `session.delete` | Emits | Delete button (prepared/completed/archived sessions) |

## Related

- Parent: [[UserHubView]]
- Siblings: [[UserHubDashboard]], [[UserHubInbox]], [[UserHubPreferences]]
- Domain: `SessionService` (`src/domain/session/SessionService.ts`)
- Helpers: `src/domain/session/helpers.ts` (formatDuration, computeRemainingMs, computeElapsedMs)
