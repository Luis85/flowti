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
| Brain | `brainSystem.getState(name).state` | State badge with color: `idle` (blue), `wandering` (gray), `working` (green), `walking-to` (amber), `on-break` (purple), `talking` (cyan), `waiting` (amber) |
| Process | `agentProcesses.get(name)?.running` | Green dot + "alive" / Red dot + "dead" |
| LLM | `store.llmStatus.get(name).state` | `idle` / `thinking` (pulsing) / `queued` / `error` (red) |
| Scene | `store.currentScene` | Hub / Office / Village / Station |
| Task Locked | Brain entry's `taskLocked` flag | Lock icon when true, hidden when false |
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

Populated from `handleCliEvent` — every event type pushes an entry. Capped at 50 entries per agent (oldest dropped). The event log captures ALL events, not just responses.

Event summary derivation:
- `response`: First 80 chars of response text
- `thinking`: "Thinking..."
- `using-tool`: Tool name
- `tool-complete`: Tool name + "done"
- `error`: Error text (first 80 chars)
- `task-started`: Task name
- `task-completed`: Task name + "completed"
- `permission-request`: Tool name + "permission requested"

## Nearby Agents

A compact section at the bottom showing agents within proximity radius (300px). Data comes from `world-positions.json` already tracked by WorldContext.

Each entry shows:
- Agent name (persona if available)
- Distance in px
- Current brain state

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
        brainState: { state: true },
        processAlive: { state: true },
    };
}
```

Subscribes to `store.addEventListener("state-changed")` for reactive updates. Reads brain state, LLM status, event log, and positions from the store.

### Rendering Structure

```
┌─────────────────────────────┐
│ STATUS GRID                 │
│ Brain:    [working]         │
│ Process:  ● alive           │
│ LLM:     thinking...        │
│ Scene:   Office             │
│ Position: 340, 220  🔒      │
├─────────────────────────────┤
│ EVENT STREAM                │
│ 3s   [response] Hey boss...│
│ 12s  [thinking] ...         │
│ 45s  [tool]    flowti test  │
│ 2m   [response] Done wi... │
│ ...                         │
├─────────────────────────────┤
│ NEARBY                      │
│ Archie (engineering) 120px  │
│ Tess (engineering) 210px    │
└─────────────────────────────┘
```

## Data Changes

### DashboardStore

1. **New field:** `agentEventLog: Map<string, { timestamp: number; type: string; summary: string }[]>`
2. **Populate:** In `handleCliEvent`, after processing each event type, push an entry to the log.
3. **Cap:** Limit to 50 entries per agent. Drop oldest when exceeded.

### Brain State Exposure

The store already tracks `agentStates: Map<string, BrainState>`. The `taskLocked` flag is on the `AgentBrainEntry` (internal to BrainSystem). Two options:

- **Option A:** Add `getTaskLocked(name): boolean` to BrainSystem's public API.
- **Option B:** Add `taskLockedAgents: Set<string>` to DashboardStore, updated when `task-assigned` / `task-completed` events fire.

**Chosen:** Option B — the store already tracks task state, and `task-assigned` / `task-completed` events already fire. Simpler than exposing brain internals.

### Process Status

The store has `agentProcesses: Map<string, AgentProcess>` (private). The monitor needs to know if the process is alive. Options:

- **Option A:** Make a public `isProcessAlive(name): boolean` method on DashboardStore.
- **Option B:** Track `processAlive: Map<string, boolean>` updated when processes start/die.

**Chosen:** Option A — simple getter, no extra state to maintain.

## Tab Wiring

In `agent-panel.ts`:

1. Replace `"history"` tab label with `"monitor"` in `TAB_LABELS`.
2. Replace `<ft-game-panel-history>` with `<ft-game-panel-monitor>` in `renderTab()`.
3. Import `panel-monitor.js` instead of `panel-history.js`.

## Files

| File | Change |
|------|--------|
| Create: `Plugin: src/game/ui/panel-monitor.ts` | New Lit component with status grid, event stream, nearby agents |
| Delete: `Plugin: src/game/ui/panel-history.ts` | Replaced by monitor |
| Modify: `Plugin: src/game/ui/agent-panel.ts` | Swap history → monitor in tab labels and render |
| Modify: `Plugin: src/game/store/dashboard-store.ts` | Add `agentEventLog`, populate from `handleCliEvent`, add `isProcessAlive()`, add `taskLockedAgents` |
| Modify: `Plugin: src/game/engine.ts` | Update task-assigned/completed to track `taskLockedAgents` |

## Non-Goals

- Log persistence across sessions — event log is in-memory only.
- Filtering/search in the event stream — future enhancement.
- Export/copy of monitor data — future enhancement.
- Custom refresh rate — updates reactively via store events.
