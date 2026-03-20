---
type: DesignSpec
title: Agent Monitor Tab
date: 2026-03-20
status: approved
---

# Agent Monitor Tab — Design Spec

## Problem

The agent panel has no visibility into agent internals. When an agent is stuck, slow, or behaving unexpectedly, the Director has no way to see brain state, process health, LLM status, or recent events. The existing "history" tab only shows activity log entries and overlaps with what a monitor would provide.

## Solution

Replace the "history" tab with a "monitor" tab that shows real-time agent internals. Serves as both an ambient observer view (what is this agent doing right now?) and a diagnostic tool (why is this agent stuck?).

## At-a-Glance Status Grid

A compact status grid at the top of the tab, always visible. Each field is a single row with label and value. Values update reactively via `store.addEventListener("state-changed")`.

| Field | Source | Display |
|-------|--------|---------|
| Brain | `store.agentStates.get(name)` | State badge with color: `idle` (blue), `wandering` (gray), `working` (green), `walking-to` (amber), `on-break` (purple), `talking` (cyan), `waiting` (amber) |
| Process | `store.isProcessAlive(name)` | Green dot + "alive" / Red dot + "dead" |
| LLM | `store.llmStatus.get(name).state` | `idle` / `thinking` (pulsing) / `queued` / `error` (red) |
| Scene | `store.currentScene` | Title-cased: capitalize first letter of the `Setting` value (e.g. `"office"` → `"Office"`) |
| Task Locked | `store.taskLockedAgents.has(name)` | Lock icon when true, hidden when false |
| Position | `store.agentPositions.get(name)` | `x, y` coordinates (rounded integers) |

## Event Stream

Below the status grid, a scrollable list of the last 20 events for this agent. Newest first.

Each entry shows:
- **Timestamp** — relative format: "3s ago", "1m ago", "12m ago"
- **Type badge** — colored by category:
  - `response` (green)
  - `thinking` (amber)
  - `using-tool` / `tool-complete` (purple)
  - `error` (red)
  - `task-started` / `task-completed` (blue)
  - `permission-request` (amber)
- **Summary text** — truncated to 80 characters

### Data Source

A new `agentEventLog` field on `DashboardStore`:

```typescript
agentEventLog: Map<string, { timestamp: number; type: string; summary: string }[]> = new Map();
```

Populated from **two paths** (since some event types are handled outside `handleCliEvent`):

1. **`handleCliEvent`** — for `response`, `thinking`, `error`, and `permission-request` events. After processing each case, push a log entry.
2. **Store methods** — `executeTask()` pushes `task-started` entries. `handleCliEvent`'s response case (when it marks a task completed) pushes `task-completed`. `handleCliEvent`'s `using-tool` and `tool-complete` cases push entries directly (these are currently no-op break statements that need log-push calls added).

A private helper method handles the push:

```typescript
private pushEventLog(agentName: string, type: string, summary: string): void {
    const log = this.agentEventLog.get(agentName) ?? [];
    log.push({ timestamp: Date.now(), type, summary });
    if (log.length > 50) log.shift();
    this.agentEventLog.set(agentName, log);
}
```

Event summary derivation:
- `response`: First 80 chars of response text
- `thinking`: "Thinking..."
- `using-tool`: Tool name from event data
- `tool-complete`: Tool name + "done"
- `error`: Error text (first 80 chars)
- `task-started`: Task name (from `executeTask`)
- `task-completed`: Task name + "completed"
- `permission-request`: Tool name + "permission requested"

## Nearby Agents

A compact section at the bottom showing agents within proximity. Data comes from `store.agentPositions` (page-coordinate `Map<string, Point>` updated per-frame from the ExcaliburJS canvas).

Distance is computed as Euclidean distance between page-coordinate positions. Threshold: 300px in page coordinates. Only agents in the same scene are considered (all visible agents share the same coordinate space).

Each entry shows:
- Agent name (persona if available, from `store.agents`)
- Distance in px (rounded)
- Current brain state (from `store.agentStates`)

If no agents are nearby, shows "No agents nearby" in muted text.

## Component

### panel-monitor.ts

New Lit component replacing `panel-history.ts`. Follows the existing panel pattern:

```typescript
class PanelMonitor extends FlowtiElement {
    static properties = {
        ...FlowtiElement.properties,
        store: { attribute: false },
        agentName: { type: String },
    };
}
```

Subscribes to `store.addEventListener("state-changed")` for reactive updates. All data is read from the store in the render method — no local state needed beyond what Lit provides.

### Rendering Structure

```
+-----------------------------+
| STATUS GRID                 |
| Brain:    [working]         |
| Process:  * alive           |
| LLM:     thinking...        |
| Scene:   Office             |
| Position: 340, 220  lock    |
+-----------------------------+
| EVENT STREAM                |
| 3s   [response] Hey boss...|
| 12s  [thinking] ...         |
| 45s  [tool]    flowti test  |
| 2m   [response] Done wi... |
| ...                         |
+-----------------------------+
| NEARBY                      |
| Archie (engineering) 120px  |
| Tess (engineering) 210px    |
+-----------------------------+
```

## Data Changes

### DashboardStore

1. **New field:** `agentEventLog: Map<string, { timestamp: number; type: string; summary: string }[]>`
2. **New field:** `taskLockedAgents: Set<string> = new Set()`
3. **New method:** `isProcessAlive(name: string): boolean` — returns `this.agentProcesses.get(name)?.running ?? false`
4. **New method:** `pushEventLog(agentName, type, summary)` — private helper, caps at 50 entries
5. **Populate event log:** Add `pushEventLog` calls in `handleCliEvent` for all event types (including `using-tool` and `tool-complete` which are currently no-op breaks), and in `executeTask()` for `task-started`.

### TabName Update

In `dashboard-store.ts`, update the `TabName` type:

```typescript
export type TabName = "info" | "talk" | "tasks" | "permissions" | "monitor";
```

Remove `"history"`, add `"monitor"`.

### Process Status

New public method on DashboardStore:

```typescript
isProcessAlive(agentName: string): boolean {
    return this.agentProcesses.get(agentName)?.running ?? false;
}
```

### Task Locked Tracking

`taskLockedAgents: Set<string>` on DashboardStore, updated in `engine.ts`'s existing `task-assigned` and `task-completed` event listeners (where `brainSystem.assignWork()` / `releaseWork()` are already called):

```typescript
// In task-assigned listener:
store.taskLockedAgents.add(agentName);

// In task-completed listener:
store.taskLockedAgents.delete(agentName);
```

## Tab Wiring

In `agent-panel.ts`:

1. Replace `"history"` with `"monitor"` in `TAB_LABELS` array.
2. Replace the `case "history":` render branch with `case "monitor":` → `<ft-game-panel-monitor>`.
3. Replace `import "./panel-history.js"` with `import "./panel-monitor.js"`.
4. Update CSS selectors: replace `ft-game-panel-history` with `ft-game-panel-monitor` in both the flex layout selector block and the scroll/padding selector block.

## Files

| File | Change |
|------|--------|
| Create: `Plugin: src/game/ui/panel-monitor.ts` | New Lit component with status grid, event stream, nearby agents |
| Create: `Plugin: tests/game/ui/panel-monitor.test.ts` | Tests for rendering, data display, edge cases |
| Delete: `Plugin: src/game/ui/panel-history.ts` | Replaced by monitor |
| Delete: `Plugin: tests/game/ui/panel-history.test.ts` | Replaced by monitor test (if exists) |
| Modify: `Plugin: src/game/ui/agent-panel.ts` | Swap history → monitor in tab labels, render, imports, and CSS selectors |
| Modify: `Plugin: src/game/store/dashboard-store.ts` | Update `TabName`, add `agentEventLog`, `taskLockedAgents`, `isProcessAlive()`, `pushEventLog()`, populate log in `handleCliEvent` + `executeTask` |
| Modify: `Plugin: src/game/engine.ts` | Update task-assigned/completed listeners to track `taskLockedAgents` on store |

## Non-Goals

- Log persistence across sessions — event log is in-memory only.
- Filtering/search in the event stream — future enhancement.
- Export/copy of monitor data — future enhancement.
- Custom refresh rate — updates reactively via store events.
