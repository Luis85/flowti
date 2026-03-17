---
type: Increment
feature: "[[Hubs PRD]]"
pbi: "[[PBI-002 Documentation Sessions]]"
phase: 4
increment: 7
stage: done
date: 2026-02-16
tasm_score: 0
tasm_review: "Pending Three Amigos review"
tests_added: 36
tests_total: 2053
test_suites: 83
loc_added: 476
---

# Phase 4, Increment 7: SessionWorkspaceView

## Context

Sessions run in the background with only a timer display in the User Hub. Users need a dedicated focused workspace that brings timer, goals, notes, focus file, and artifacts into one view.

User story: [[I want to prepare a working session, so that I can focus on one task at a time]]

## Scope

New standalone `SessionWorkspaceView` extending `ItemView` directly (not BaseHubView). Layout: header (title + status + actions) → timer → goals checklist → notes textarea → focus file link → artifacts. Registered in `main.ts` (alongside UserHubView), command `flowti:open-session-workspace`. 463 LOC view + 13 LOC main.ts = 476 LOC. 36 tests.

## Changes

### New Files

- `src/ui/SessionWorkspaceView.ts` — Full workspace view (463 LOC): header, timer, goals, notes, focus file, artifacts, event subscriptions, empty state
- `tests/ui/SessionWorkspaceView.test.ts` — 36 tests (631 LOC): rendering, interactions, event subscriptions, cleanup

### Modified Files

- `src/main.ts` — Import + registerView + addCommand for SessionWorkspaceView (+13 LOC)

## Layout

```
+--------------------------------------------------+
| [Title]                    [Type] [Status]        |
| [Pause] [Complete]                                |
+--------------------------------------------------+
|              ##  25:00  ##                         |
|              Time Remaining                        |
+--------------------------------------------------+
| Goals  (2/5)                                      |
| [ ] Review types.ts                           [x] |
| [v] Update events.ts                          [x] |
| [ ] Write tests                               [x] |
| [+ Add goal...]                                   |
+--------------------------------------------------+
| Notes                                             |
| +----------------------------------------------+ |
| | [textarea - debounced save]                   | |
| |                                               | |
| +----------------------------------------------+ |
+--------------------------------------------------+
| Focus: src/domain/session/types.ts    [Open ->]   |
+--------------------------------------------------+
| Artifacts (3)                                     |
|  * types.ts (modified)                            |
|  * events.ts (modified)                           |
|  * helpers.ts (created)                           |
+--------------------------------------------------+
```

## Key Behaviors

- **Timer**: incremental DOM update via `session.timer.tick` (no re-render)
- **Goals**: checkbox toggle emits `session.goal.toggle`, inline add emits `session.goal.add`, x emits `session.goal.remove`
- **Notes**: `<textarea>` with 500ms debounced save via `session.notes.update`
- **Focus file**: clickable link via `app.workspace.openLinkText()` in adjacent leaf
- **Artifacts**: live list updated on `session.artifact.added`
- **Actions**: contextual buttons (Pause/Resume/Complete) per session status
- **Empty state**: "No active session" with link to open User Hub Sessions tab

## Event Subscriptions

- `session.timer.tick` — incremental timer update
- `session.timer.completed` — show completion state
- `session.started/paused/resumed/completed` — re-render (status change)
- `session.goal.added/toggled/removed` — re-render goals section
- `session.notes.updated` — update textarea if not focused
- `session.artifact.added` — append to artifact list

## Tests (36 added)

**SessionWorkspaceView.test.ts** (+36 tests):
- View metadata (4): correct view type, session title display text, default display text, timer icon
- Empty state (1): renders when no active session
- Header rendering (6): title + type badge + status badge, Pause/Complete for active, Resume/Complete for paused, Start for prepared, Pause emits event, Complete emits event
- Timer (3): formatted countdown, tick updates without re-render, ignores tick for different session
- Goals (9): checklist with checkboxes, goal count, toggle emits event, add emits event on Enter, clears input after submission, remove emits event, goal.added appends, goal.toggled updates, goal.removed removes
- Notes (3): renders textarea, debounced save emits event, notes.updated updates textarea when not focused
- Focus file (3): renders link, no section when null, click calls openLinkText
- Artifacts (3): renders list with badges, empty message, artifact.added appends
- Cleanup (2): unsubscribes on close, clears debounce timer on close
- Session lifecycle (2): re-renders on completed, deleted shows empty state

## Acceptance Criteria

- [x] SessionWorkspaceView renders with timer, goals, notes, focus file, artifacts
- [x] Timer updates incrementally without full re-render
- [x] Goal checklist: add, toggle, remove all functional
- [x] Notes textarea auto-saves with debounce
- [x] Focus file opens in adjacent leaf on click
- [x] Artifacts list updates live
- [x] Empty state shows when no active session
- [x] All events cleaned up on view close
- [x] `npm run build` passes — 2,053 tests across 83 suites

> **Successor**: [[Phase 4 Inc 8 - Session Workspace Enrichment]] extended the workspace from 463 → 737 LOC with session links, notes file persistence, canvas creation, duration editing, save template for all statuses, and "Open Workspace" button.

## Verification

1. `npm run build` passes
2. Open workspace view via command palette
3. Start a session — workspace shows timer counting down
4. Add a goal, check it off, remove another
5. Type notes — saved after 500ms
6. Click focus file — opens in adjacent leaf
7. Create a file — appears in artifacts
8. Pause/Resume/Complete all work from workspace
