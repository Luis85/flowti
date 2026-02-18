---
type: ProductBacklogItem
feature: "[[Session Workspaces PRD]]"
stage: done
priority: low
dependencies: []
delivered_in: "[[Cycle 3 - Session Output Artifacts and State Restoration]]"
delivered_date: 2026-02-18
note: "Delivered in Cycle 3 Inc 1. Workspace state (open files, active file) auto-saved on pause/complete, auto-restored on resume. 4 system events, backward compat guard. Partially resolves TD-45."
---

## User Story — Problem Space

As a session user, I want my workspace restored exactly as I left it when I resume a paused session so that I lose no context and can continue immediately.

### User Pains

- Resuming a session re-opens the workspace but not the files that were open
- Scroll position and active tab state are lost on pause
- Users must manually reopen focus file, context files, and navigate back to where they were
- This makes pause/resume less useful than it could be

### User Needs

- Workspace state (open files in adjacent leaf, scroll position) saved on pause/complete
- State restored when session is resumed
- Graceful handling when files have been moved/deleted since pause

## Solution Statement

### Functional Requirements

- [x] `WorkspaceState` type: `{ openFiles: string[], activeFile: string | null, scrollPositions: Record<string, number> }`
- [x] `session.state.save` / `session.state.saved` event pair
- [x] `session.state.restore` / `session.state.restored` event pair
- [x] State saved automatically on `session.paused` and `session.completed`
- [x] State restored automatically on `session.resumed`
- [x] Missing files skipped gracefully (logged but not blocking)
- [x] State persisted with session via TypedStorage
- [x] Backward compat: `session.workspaceState ??= null` in `load()` (L-11)

### Implementation Approach (from learnings)

- **L-14**: Use Obsidian's `ItemView.getState()`/`setState()` directly — already proven in SessionWorkspaceView's sidebar session switching (Inc 10). No BaseHubView integration needed.
- **L-11 Backward compat**: `WorkspaceState` is nullable — sessions without it load cleanly.
- **L-12 Feedback-driven priority**: No real-world user demand for state restoration yet. Keep priority low. Revisit after users report friction with pause/resume workflows.
- **TD-45 overlap**: TD-45 tracks "UI view state not persisted" as tech debt. This PBI is the solution — close TD-45 when this PBI is delivered.

### Size Estimate

- ~60 LOC source (save/restore logic in SessionService + SessionWorkspaceView)
- ~15 tests (save on pause, restore on resume, missing files, backward compat)

### Events

| Event | Category | Tags |
|-------|----------|------|
| `session.state.save` | Session | `["system"]` |
| `session.state.saved` | Session | `["system"]` |
| `session.state.restore` | Session | `["system"]` |
| `session.state.restored` | Session | `["system"]` |

### Acceptance Criteria

- [x] Pausing a session saves workspace state
- [x] Resuming a session restores open files
- [x] Missing files skipped without error
- [x] State persisted across plugin restarts
- [x] Legacy sessions without workspaceState load cleanly
- [x] Build passes: tests + tsc + eslint + esbuild
