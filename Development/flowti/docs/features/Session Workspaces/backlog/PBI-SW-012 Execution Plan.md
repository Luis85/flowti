---
type: ProductBacklogItem
feature: "[[Session Workspaces PRD]]"
stage: planned
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

- [ ] `ExecutionTask` type: `{ id, label, completed, completedAt?, order }`
- [ ] `executionTasks: ExecutionTask[]` field on Session interface
- [ ] Max recommended tasks: 5 (configurable threshold, soft limit)
- [ ] Add task: `session.task.added` event
- [ ] Remove task: `session.task.removed` event
- [ ] Toggle task: `session.task.completed` event
- [ ] Reorder tasks: `session.task.reordered` event
- [ ] Progress indicator: `completedTasks / totalTasks`
- [ ] Main mode: full CRUD + drag-and-drop reorder
- [ ] Sidebar mode: toggle only (no add, remove, or reorder)
- [ ] Tasks persist with session state
- [ ] Tasks carried through rerun and template flows
- [ ] Backward compat: `executionTasks ??= []` in `load()`

### Technical Requirements

- `ExecutionTask` type in `src/domain/session/types.ts`
- `handleTaskAdd()`, `handleTaskRemove()`, `handleTaskToggle()`, `handleTaskReorder()` in SessionService
- Thread `executionTasks` through all creation paths per L-09
- 4 new catalog entries for task events

### Constraints

- Task count feeds cognitive overload detection (PBI-SW-016) — threshold must be configurable
- Workshop mode (FR-18) relabels "Tasks" as "Agenda" — design must support this

## Acceptance Criteria

- [ ] Adding a task creates an ExecutionTask and emits event
- [ ] Toggling a task sets `completed: true` with timestamp
- [ ] Removing a task removes it from the list
- [ ] Reordering tasks updates the `order` field
- [ ] Progress indicator shows completed/total ratio
- [ ] Tasks persist and restore on reload
- [ ] Max 5 recommendation shown (not enforced)
- [ ] `npm run build` passes

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

## Related

- PRD: [[Session Workspaces PRD]] (FR-12)
- User Story: [[I want to capture tasks during sessions]], [[I want to sort the goals in my sessions]]
- Feeds: [[PBI-SW-016 Cognitive Overload Detection]] (task count threshold)
- Influenced by: [[PBI-SW-018 Workshop Mode]] (relabels "Tasks" as "Agenda")
