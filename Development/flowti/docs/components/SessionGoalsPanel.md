---
type: Component
domain: Flowti
stage: done
description: "Editable goals list with checkbox toggles, reordering, add/remove, and completion count badge"
source: "[[Development/flowti/src/ui/session/SessionGoalsPanel.ts|SessionGoalsPanel.ts]]"
parent: "[[SessionWorkspaceView]]"
tags:
  - session
  - component
---

# SessionGoalsPanel

## Description

SessionGoalsPanel renders the Goals section of the Session Workspace. Each goal is shown as a checkbox row with reorder (up/down) and remove buttons. An input field at the bottom allows adding new goals via Enter key. The panel supports incremental refresh via `refreshGoals()` without full re-render.

Goals are read-only when the session is completed or archived.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `SessionPanelDeps` | interface | Provides `getSession()`, `eventBus`, `app`, `openFile()` |
| `SessionGoal` | type | Goal entity with `id`, `text`, `completed` |
| `setIcon` | obsidian | Renders chevron-up, chevron-down, and x icons for goal actions |

## State

**Reads via `deps.getSession()`:**
- `goals` — array of `SessionGoal` objects
- `status` — determines editability (completed/archived = read-only)

## Renders

- Header row with "Goals" label and completion count badge `(done/total)`
- Goal rows: checkbox + text + reorder buttons + remove button
- Completed goals show line-through text with reduced opacity
- "Add goal..." input at bottom (hidden for completed/archived sessions)

## Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| `session.goal.add` | Emitted | Add a new goal (Enter key in input) |
| `session.goal.toggle` | Emitted | Toggle goal completion (checkbox change) |
| `session.goal.remove` | Emitted | Remove a goal (x button click) |
| `session.goal.reorder` | Emitted | Reorder goals (chevron button click) |

## API

| Method | Purpose |
|--------|---------|
| `render()` | Initial full render into container |
| `refreshGoals()` | Incremental re-render of goals list + count badge |

## Related

- Parent: [[SessionWorkspaceView]]
- Siblings: [[SessionExecutionPanel]], [[SessionReflectionPanel]], [[SessionActivityPanel]]
- Subscription wiring: [[SessionWorkspaceSubscriptions]]
