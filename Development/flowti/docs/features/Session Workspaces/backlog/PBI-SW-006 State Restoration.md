---
type: ProductBacklogItem
feature: "[[Session Workspaces PRD]]"
stage: planned
priority: low
dependencies: []
note: "Saves and restores workspace state on pause/resume. Independent — can be implemented anytime."
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

- [ ] `WorkspaceState` type: `{ openFiles: string[], activeFile: string | null, scrollPositions: Record<string, number> }`
- [ ] `session.state.save` / `session.state.saved` event pair
- [ ] `session.state.restore` / `session.state.restored` event pair
- [ ] State saved automatically on `session.paused` and `session.completed`
- [ ] State restored automatically on `session.resumed`
- [ ] Missing files skipped gracefully (logged but not blocking)
- [ ] State persisted with session via TypedStorage

### Events

| Event | Category | Tags |
|-------|----------|------|
| `session.state.save` | Session | `["system"]` |
| `session.state.saved` | Session | `["system"]` |
| `session.state.restore` | Session | `["system"]` |
| `session.state.restored` | Session | `["system"]` |

### Acceptance Criteria

- [ ] Pausing a session saves workspace state
- [ ] Resuming a session restores open files
- [ ] Missing files skipped without error
- [ ] State persisted across plugin restarts
- [ ] Build passes: tests + tsc + eslint + esbuild
