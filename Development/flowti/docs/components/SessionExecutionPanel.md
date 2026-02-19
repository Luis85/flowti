---
type: Component
domain: Flowti
stage: done
description: "Execution plan with task checkboxes, progress bar, reordering, and completion tracking"
source: "[[Development/flowti/src/ui/session/SessionExecutionPanel.ts|SessionExecutionPanel.ts]]"
parent: "[[SessionWorkspaceView]]"
tags:
  - session
  - component
---

# SessionExecutionPanel

## Description

SessionExecutionPanel renders the Execution Plan section of the Session Workspace. Tasks are displayed as checkbox rows sorted by `order`, with a visual progress bar showing completion percentage. The panel uses `getTaskProgress()` from session helpers for progress calculation. Supports incremental refresh via `refreshTasks()`.

Tasks are read-only when the session is completed or archived.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `SessionPanelDeps` | interface | Provides `getSession()`, `eventBus` |
| `ExecutionTask` | type | Task entity with `id`, `label`, `completed`, `order` |
| `getTaskProgress` | function | Pure helper returning `{ completed, total, percent }` |
| `setIcon` | obsidian | Renders chevron-up, chevron-down, and x icons |

## State

**Reads via `deps.getSession()`:**
- `executionTasks` — array of `ExecutionTask` objects
- `status` — determines editability

## Renders

- Header row with "Execution Plan" label and count badge `(done/total)`
- Progress bar: track + fill element with percentage label (hidden when no tasks)
- Task rows: checkbox + label + reorder buttons + remove button (sorted by `order`)
- Completed tasks show line-through text with reduced opacity
- "Add task..." input at bottom (hidden for completed/archived)

## Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| `session.task.add` | Emitted | Add a new task (Enter key) |
| `session.task.toggle` | Emitted | Toggle task completion (checkbox) |
| `session.task.remove` | Emitted | Remove a task (x button) |
| `session.task.reorder` | Emitted | Reorder tasks (chevron buttons) |

## API

| Method | Purpose |
|--------|---------|
| `render()` | Initial full render into container |
| `refreshTasks()` | Incremental re-render of task list + progress bar + count |

## Related

- Parent: [[SessionWorkspaceView]]
- Siblings: [[SessionGoalsPanel]], [[SessionReflectionPanel]], [[SessionActivityPanel]]
- Helper: `getTaskProgress()` in `src/domain/session/helpers.ts`
- Subscription wiring: [[SessionWorkspaceSubscriptions]]
