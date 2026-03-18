# Server Management Sidepanel — Design Spec

**Date:** 2026-03-18
**Status:** Draft
**Project:** Flowti Plugin + Flowti CLI

## Problem

Server lifecycle management is scattered across the agent panel (start/stop) and requires terminal access for configuration. There's no visibility into server health, active connections, agent activity, or running storybook processes. Developers need a dedicated monitoring and management surface.

## Goals

1. **Dedicated server sidepanel** — third ribbon icon alongside Agents and Projects
2. **Server lifecycle** — start, stop, restart with status indicator
3. **Live activity feed** — real-time SSE event log, compact by default, expandable
4. **Stats dashboard** — connections, agent count, storybook instances, uptime
5. **Configuration** — port, log level, auto-connect toggle, batch apply with restart

## Architecture

### Sidepanel with 4 collapsible sections

Follows the same ItemView + Lit component pattern as Agent and Project panels. Reuses the existing SSE connection for the activity feed. New CLI endpoints provide stats and config management.

### Data Flow

```
SSE stream → activity feed (real-time, reuses agent SSE)
GET /api/server/stats → stats section (5s poll)
GET /api/server/config → config form (on open)
POST /api/server/config → update config + restart
POST /api/server/restart → graceful restart
```

## Section 1: Server Status

Always visible at the top.

- Green/red dot + "Running" / "Stopped" label
- PID, port, uptime (formatted as "2h 15m")
- Action buttons: Start / Stop / Restart / Visit the World
- Start only shown when stopped, Stop/Restart when running

## Section 2: Live Activity Feed

Real-time log of SSE events from the CLI server.

**Compact mode (default):**
- One line per event: `[14:32:05] Atlas → thinking`
- Timestamp + agent name + action type + preview text
- Auto-scrolls to bottom

**Expanded mode (click to toggle per entry):**
- Agent avatar + full message content
- Tool call details
- Thinking content

- Pause/resume button to freeze auto-scroll while reading
- Max 200 entries in memory (oldest pruned)
- Clear button to reset feed

## Section 3: Stats

Cards with key metrics, auto-refreshed every 5 seconds.

- **SSE connections** — active client count
- **Agents** — total count from world state
- **Storybook** — running instances (from PID files)
- **Uptime** — server uptime formatted

## Section 4: Configuration

Form for server settings with batch apply.

- **Port** — text input (default 3000)
- **Log level** — dropdown: debug / info / warn / error
- **Auto-connect on startup** — toggle
- **Apply & Restart** button — only enabled when form is dirty
- Config persisted to `.flowti/config.json` or `.flowti/var/server-config.json`

## CLI Server Endpoints

### `GET /api/server/stats`

```typescript
{
  uptime: number;        // seconds since server start
  connections: number;   // active SSE clients
  agentCount: number;    // entities of type "agent"
  storybookProcesses: Array<{ project: string; pid: number; url: string }>;
}
```

### `GET /api/server/config`

```typescript
{
  port: number;
  logLevel: string;
  autoConnect: boolean;
}
```

### `POST /api/server/config`

Body: `{ port?: number, logLevel?: string, autoConnect?: boolean }`
Persists config and triggers graceful restart.
Returns: `{ ok: true }`

### `POST /api/server/restart`

Graceful restart — closes connections, re-reads config, restarts.
Returns: `{ ok: true }`

## Plugin Component Tree

| File | Purpose |
|------|---------|
| `src/components/server/flowti-server-panel.ts` | Root — 4 collapsible sections |
| `src/components/server/flowti-server-status.ts` | Status dot + lifecycle buttons |
| `src/components/server/flowti-activity-feed.ts` | Compact log + expandable entries |
| `src/components/server/flowti-server-stats.ts` | Stats cards with auto-refresh |
| `src/components/server/flowti-server-config.ts` | Config form + Apply & Restart |
| `src/infrastructure/handlers/server-handlers.ts` | Bridges components to CLI HTTP |
| `src/infrastructure/server/http-server-service.ts` | HTTP client for server endpoints |
| `src/domain/server/types.ts` | ServerStats, ServerConfig types |
| `src/ui/server/server-panel-view.ts` | ItemView shell |
| `src/ui/server/types.ts` | View type constant |
| `src/bootstrap/server-setup.ts` | Registers view + command + ribbon |

## Custom Events

| Event | Detail | Source |
|-------|--------|--------|
| `server-start` | `{}` | status section |
| `server-stop` | `{}` | status section |
| `server-restart` | `{}` | status section |
| `server-visit` | `{}` | status section |
| `config-apply` | `{ port, logLevel, autoConnect }` | config section |
| `feed-pause` | `{}` | activity feed |
| `feed-resume` | `{}` | activity feed |
| `feed-clear` | `{}` | activity feed |
