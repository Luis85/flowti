---
type: ProductBacklogItem
feature: "[[Session Workspaces PRD]]"
stage: done
priority: high
effort: medium
dependencies: []
user_story: "[[I want to capture tasks during sessions]]"
note: "Adds checklist-based execution plan to sessions. Tasks have add/remove/toggle/reorder. Progress indicator (completed/total). Max recommended: 5. Task count feeds cognitive overload detection. Independent of PBI-SW-010 — can be delivered in parallel."
tags:
  - backlog
  - session-v2
---

## User Story — Problem Space

As a session user, I want a checklist of execution tasks within my session so that I can track progress toward my outcome and see how far I've come.

### User Pains

- Goals exist but are free-text — no structured task tracking with progress indicators
- No way to see execution progress at a glance
- No recommended limit on scope to prevent overload
- Goal completion doesn't drive a progress bar

### User Needs

- Checklist of tasks within sessions with progress indicator
- Add, remove, toggle, and reorder tasks
- Recommended maximum of 5 tasks to prevent scope overload
- Progress visible in both Main and Sidebar views
- Sidebar allows toggling but not adding/reordering

## Solution Statement

### Use Cases

**Gherkin:**
```gherkin
Given a running session with 3 tasks (1 completed)
When the user toggles the second task to completed
Then session.task.completed is emitted
And the progress indicator shows "2/3"

Given a session with 6 tasks
When the cognitive overload detection runs
Then a warning is shown (threshold: 5)
```

### Functional Requirements

- [x] `ExecutionTask` type: `{ id, label, completed, completedAt?, order }` *(Cycle 6)*
- [x] `executionTasks: ExecutionTask[]` field on Session interface *(Cycle 6)*
- [ ] Max recommended tasks: 5 (configurable threshold, soft limit)
- [x] Add task: `session.task.add` command → `session.task.added` state event *(Cycle 7 Inc 1)*
- [x] Remove task: `session.task.remove` command → `session.task.removed` state event *(Cycle 7 Inc 1)*
- [x] Toggle task: `session.task.toggle` command → `session.task.completed` state event *(Cycle 7 Inc 1)*
- [x] Reorder tasks: `session.task.reorder` command → `session.task.reordered` state event *(Cycle 7 Inc 1)*
- [x] Progress indicator: `getTaskProgress()` pure helper returns `{ completed, total, percent }` *(Cycle 7 Inc 1)*
- [x] Main mode: full CRUD + up/down arrow reorder *(Cycle 7 Inc 2)*
- [ ] Sidebar mode: toggle only (no add, remove, or reorder)
- [x] Tasks persist with session state *(Cycle 7 Inc 1)*
- [x] Tasks carried through rerun and template flows *(Cycle 7 Inc 1)*
- [x] Backward compat: `executionTasks ??= []` in `load()` *(Cycle 6)*

### Technical Requirements

- [x] `ExecutionTask` type in `src/domain/session/types.ts` *(Cycle 6)*
- [x] `addTask()`, `removeTask()`, `toggleTask()`, `reorderTasks()` public methods in SessionService *(Cycle 7 Inc 1)*
- [x] Thread `executionTasks` through `handleCreate`, `rerunSession`, `createFromTemplate`, `saveTemplateFromSession` *(Cycle 7 Inc 1)*
- [x] 8 catalog entries: 4 command events (`session.task.add/toggle/remove/reorder`) + 4 state events (`session.task.added/completed/removed/reordered`) *(Cycle 7 Inc 1)*
- [x] `getTaskProgress()` pure helper in `helpers.ts` *(Cycle 7 Inc 1)*
- [x] `tasks?: string[]` field added to `SessionTemplate` type *(Cycle 7 Inc 1)*
- [x] State guards: task ops only in `prepared`, `running`, `paused` *(Cycle 7 Inc 1)*

### Constraints

- Task count feeds cognitive overload detection (PBI-SW-016) — threshold must be configurable
- Workshop mode (FR-18) relabels "Tasks" as "Agenda" — design must support this

## Acceptance Criteria

- [x] Adding a task creates an ExecutionTask and emits event *(Inc 1 — 36 tests)*
- [x] Toggling a task sets `completed: true` with timestamp *(Inc 1)*
- [x] Removing a task removes it from the list *(Inc 1)*
- [x] Reordering tasks updates the `order` field *(Inc 1)*
- [x] Progress indicator shows completed/total ratio *(Inc 1 — `getTaskProgress()`)*
- [x] Tasks persist and restore on reload *(Inc 1)*
- [ ] Max 5 recommendation shown (not enforced)
- [x] `npm run build` passes *(2,602 tests, 104 suites)*

### INVEST Checklist

| Criterion | Met? | Notes |
|-----------|------|-------|
| **I**ndependent | Yes | No dependencies on other v2 PBIs |
| **N**egotiable | Yes | Max threshold, drag-drop, and sidebar behavior are negotiable |
| **V**aluable | Yes | High user value — structured task tracking |
| **E**stimable | Yes | ~200 LOC, ~25 tests |
| **S**mall | Yes | 1-2 increments (domain first, then UI) |
| **T**estable | Yes | CRUD operations are pure-function testable |

## Estimated Size

- **Source LOC:** ~200 (types ~30, handlers ~100, helpers ~30, catalog ~40)
- **Tests:** ~25
- **Increments:** 2 (domain + UI)

## Delivery — Cycle 7

### Inc 1: Domain Layer (Cycle 7 Inc 1)

**Files modified:**
| File | Change | LOC |
|------|--------|-----|
| `src/domain/session/helpers.ts` | Added `getTaskProgress()` | +12 |
| `src/domain/session/events.ts` | Added 4 command events | +8 |
| `src/domain/session/types.ts` | Added `tasks?: string[]` to `SessionTemplate` | +2 |
| `src/domain/session/SessionService.ts` | Task CRUD methods, event wiring, template threading | +100 |
| `src/infrastructure/events/catalog.ts` | Registered 4 command events | +4 |
| `tests/domain/session/executionTasks.test.ts` | New test file | +500 |

**Tests:** 36 new (2,576 total, 103 suites)
**Events:** 8 new (4 commands + 4 state), 90 total session events
**SessionService LOC:** ~1,300 → ~1,420 (+120). TD-092 threshold approaching — evaluate extraction after Cycle 7.

**Deviation:** Original event definitions used only state events (`session.task.added` etc.) for both commands and state notifications. Listening to these as commands caused infinite event loops. Fixed by adding separate command events (`session.task.add/toggle/remove/reorder`), following the established `session.goal.add` → `session.goal.added` pattern.

### Inc 2: UI Layer (Cycle 7 Inc 2)

**Files modified:**
| File | Change | LOC |
|------|--------|-----|
| `src/ui/session/SessionExecutionPanel.ts` | New component: task checklist, progress bar, reorder | +170 |
| `src/ui/SessionWorkspaceView.ts` | Import + wire execution panel between goals and notes | +6 |
| `src/ui/session/SessionWorkspaceSubscriptions.ts` | 4 new task event listeners + execution panel accessor | +18 |
| `tests/ui/session/SessionExecutionPanel.test.ts` | New test file | +280 |
| `tests/ui/session/SessionWorkspaceSubscriptions.test.ts` | 5 new task subscription tests + context fix | +60 |

**Tests:** 26 new (2,602 total, 104 suites)
**UI components:** 1 new (`SessionExecutionPanel`)
**Subscriptions:** 4 new task event listeners (28 total in `SessionWorkspaceSubscriptions`)

### Inc 2.5: Session Note Sync + Context-Aware Templates (Cycle 7 Inc 2.5)

**Files modified:**
| File | Change | LOC |
|------|--------|-----|
| `src/domain/session/helpers.ts` | Execution Plan section in `generateSessionSummaryBody()` | +10 |
| `src/domain/session/events.ts` | 2 new events: `session.notes.synced`, `session.notes.syncFailed` | +5 |
| `src/domain/session/types.ts` | `SESSION_NOTES_SYNC_DELAY_MS` constant, template fields | +8 |
| `src/domain/session/SessionService.ts` | Debounced sync (2 methods + 17 wiring points), template threading (6 methods) | +120 |
| `src/infrastructure/events/catalog.ts` | 2 new event registrations | +2 |
| `tests/domain/session/noteSync.test.ts` | New test file: debounce, coalesce, guards, events, cleanup | +210 |
| `tests/domain/session/helpers.test.ts` | Execution Plan section tests (5 new) | +40 |
| `tests/domain/session/SessionService.test.ts` | Context-aware template tests (11 new) | +120 |

**Tests:** 28 new (2,628 total, 105 suites)
**Events:** 2 new system-tagged (`session.notes.synced`, `session.notes.syncFailed`)
**Template fields:** 2 new optional (`contextBindings`, `notes`)

## Related

- PRD: [[Session Workspaces PRD]] (FR-12)
- User Story: [[I want to capture tasks during sessions]], [[I want to sort the goals in my sessions]]
- Feeds: [[PBI-SW-016 Cognitive Overload Detection]] (task count threshold)
- Influenced by: [[PBI-SW-018 Workshop Mode]] (relabels "Tasks" as "Agenda")
