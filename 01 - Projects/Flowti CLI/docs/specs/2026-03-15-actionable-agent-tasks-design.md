# Actionable Agent Tasks — Open, Done, Remove

**Date**: 2026-03-15
**Status**: Approved
**Scope**: Make tasks on the agent detail page selectable with Open/Done/Remove actions

## Problem

Tasks in the agent state file are display-only on the agent detail page. The user can see pending tasks but can't run them, close them, or remove them. Orphaned tasks accumulate with no way to manage them.

## Decision

Tasks become selectable menu items on the agent detail page, grouped separately from the main actions. Selecting a task shows a sub-menu with three actions.

### Agent Detail Page Layout

Tasks appear as a separate group with `t`-prefixed keys:

```
Bob [ai]
Description: Friendly general-purpose assistant...
State: idle

t1) Assist with tasks [pending]
t2) Review PR #42 [in-progress]

1) Talk
2) Assign Task

3) Assign to Project
4) Edit Agent
b) Back
```

### Task Sub-Menu

Selecting a task (e.g. `t1`) shows:

```
Task: Assist with tasks [pending]

1) Open — dispatch agent with this task
2) Done — mark as completed
3) Remove — delete from task list
b) Back
```

### Actions

**Open**: Resolves the brief — finds the existing iteration brief for this agent and phase. If none exists, builds a fresh prompt from the task name + system prompt + character. Dispatches via `agentShell.dispatch()`. Returns to agent detail page.

**Done**: Calls `completeFirstTask(state, taskName)` and writes state. Task stays in history with `[done]` status. Returns to agent detail page.

**Remove**: Filters the task out of `state.tasks` entirely. Gone from display. Returns to agent detail page.

## Implementation

Tasks are registered as a **data source** on the `agent-detail` page — same pattern as the existing `agents:list` data source. The data source reads the agent's state and yields `MenuEntry` items with keys `t1`, `t2`, etc. Each entry's action navigates to a task action handler.

### Data Source: `agents:tasks`

Registered in `extensibility-handlers.ts`. Reads agent state from `data-{agent}.json` and returns `MenuEntry[]`:

```
agents:tasks(ctx)
  → agentName from ctx.params
  → read agent state from varDir
  → for each task (not done unless you want to show history):
      → yield { key: "t{i}", label: "{name} [{status}]", action: navigate to task-action with params }
```

Only shows `pending` and `in-progress` tasks by default. Done tasks are historical and don't need actions.

### Action Handler: `agents:task-action`

When a task is selected, a handler shows the 3-action sub-menu. The handler receives the agent name and task name via params.

```
agents:task-action(ctx)
  → show task name + status
  → runMenu with 3 items: Open, Done, Remove
  → Open: resolve brief or build prompt, dispatch
  → Done: completeFirstTask, write state
  → Remove: filter task from state.tasks, write state
```

### Brief Resolution for "Open"

```
resolveBriefOrPrompt(agent, task, deps)
  → find current iteration for agent's project
  → look for brief in iterations/briefs/ matching agent name + phase
  → if found: return brief file path
  → else: build prompt from task name + system prompt + character
  → write to temp file, return path
```

### New Domain Function: `removeTask`

Pure function in `agent-state.ts`:

```typescript
export function removeTask(state: AgentState, taskName: string): AgentState {
    const tasks = state.tasks.filter((t) => t.name !== taskName || t.status === "done");
    // If removing the only non-done matching task:
    const firstMatch = state.tasks.findIndex((t) => t.name === taskName && t.status !== "done");
    if (firstMatch === -1) return state;
    const updated = [...state.tasks];
    updated.splice(firstMatch, 1);
    return { ...state, tasks: updated };
}
```

This removes only the first non-done task matching the name — same first-match pattern as `completeFirstTask`.

## Files

### Modified (4)

| File | Change |
|------|--------|
| `src/domain/agents/agent-state.ts` | Add `removeTask(state, taskName)` pure function |
| `src/ui/handlers/extensibility-handlers.ts` | Register `agents:tasks` data source, add `agents:task-action` handler with Open/Done/Remove sub-menu |
| `src/ui/displays/agents-display.ts` | Remove inline task rendering from `renderAgentState` (tasks now rendered via data source menu items) |
| `configs/sitemap.json` | Add `agents:tasks` data source to `agent-detail` page |

### Not Changed

| File | Reason |
|------|--------|
| `agent-shell.ts` | Dispatch called from handler, no shell changes |
| `types.ts` | No new types needed |
| `roster-task-menu.ts` | Task assignment unchanged |

## Edge Cases

- **No tasks**: Data source returns empty array — no task group shown
- **All tasks done**: Only done tasks remain — they're hidden from the menu (display-only in state)
- **Task name collision**: Open/Done/Remove act on the first matching non-done task (same as `completeFirstTask` pattern)
- **Open without iteration**: If no current iteration exists, the handler builds a fresh prompt from task name + system prompt
- **Agent already busy**: Open still dispatches — the existing dispatch logic stops the prior process for the same agent

## Testing

### agent-state.test.ts

- `removeTask` removes first non-done match
- `removeTask` leaves done tasks with same name
- `removeTask` returns state unchanged when no match

### extensibility-handlers.test.ts

- `agents:tasks` data source returns entries for pending/in-progress tasks
- `agents:tasks` data source skips done tasks
- `agents:task-action` handler: Done marks task complete
- `agents:task-action` handler: Remove deletes task from state
