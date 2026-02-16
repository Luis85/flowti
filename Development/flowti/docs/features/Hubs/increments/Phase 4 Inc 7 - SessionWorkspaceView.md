---
type: Increment
feature: "[[Hubs PRD]]"
pbi: "[[PBI-002 Documentation Sessions]]"
phase: 4
increment: 7
stage: planned
date:
tasm_score: 0
tasm_review: ""
tests_added: 0
tests_total: 0
test_suites: 0
loc_added: 513
---

# Phase 4, Increment 7: SessionWorkspaceView

## Context

Sessions run in the background with only a timer display in the User Hub. Users need a dedicated focused workspace that brings timer, goals, notes, focus file, and artifacts into one view.

User story: [[I want to prepare a working session, so that I can focus on one task at a time]]

## Scope

New standalone `SessionWorkspaceView` extending `ItemView` directly (not BaseHubView). Layout: header (title + status + actions) to timer to goals checklist to notes textarea to focus file link to artifacts. Registered in `registry.ts`, command `flowti:open-session-workspace`. ~513 LOC, ~15 tests.

## Changes

### New Files

- `src/ui/SessionWorkspaceView.ts` — Full workspace view (~350 LOC)
- `tests/ui/SessionWorkspaceView.test.ts` — Rendering + interaction tests (~150 LOC)

### Modified Files

- `src/infrastructure/views/registry.ts` — Add view definition (+8 LOC)
- `src/main.ts` — Register command (+5 LOC)

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

## Tests

- Renders empty state when no active session
- Renders header with title, type badge, status badge
- Renders timer with formatted countdown
- Timer tick updates display without full re-render
- Renders goals checklist with checkboxes
- Goal checkbox toggle emits session.goal.toggle
- Add goal input emits session.goal.add
- Remove goal button emits session.goal.remove
- Renders notes textarea with current notes
- Notes textarea change emits session.notes.update (debounced)
- Focus file link renders when focusFile is set
- Focus file click calls openLinkText
- Artifacts list renders file names with action badges
- Pause/Resume/Complete buttons emit correct events per status
- Cleanup: unsubscribes from all events on close

## Acceptance Criteria

- [ ] SessionWorkspaceView renders with timer, goals, notes, focus file, artifacts
- [ ] Timer updates incrementally without full re-render
- [ ] Goal checklist: add, toggle, remove all functional
- [ ] Notes textarea auto-saves with debounce
- [ ] Focus file opens in adjacent leaf on click
- [ ] Artifacts list updates live
- [ ] Empty state shows when no active session
- [ ] All events cleaned up on view close
- [ ] `npm run build` passes

## Verification

1. `npm run build` passes
2. Open workspace view via command palette
3. Start a session — workspace shows timer counting down
4. Add a goal, check it off, remove another
5. Type notes — saved after 500ms
6. Click focus file — opens in adjacent leaf
7. Create a file — appears in artifacts
8. Pause/Resume/Complete all work from workspace
