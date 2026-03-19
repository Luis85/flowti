# Serverless CLI Architecture — Design Spec

**Date:** 2026-03-19
**Status:** Draft
**Scope:** Replace the HTTP server with direct CLI execution + file-based state sync. Agents run as persistent background processes, communicate via stdin/stdout JSONL, and persist events to append-only log files.

## Problem

The plugin communicates with agents through an HTTP server (`flowti serve`) that must be running for any agent interaction. This creates:

- **Startup friction** — users must start the server before talking to agents
- **Connection fragility** — SSE disconnects, health check spam, stale registry files
- **Unnecessary complexity** — HTTP client, SSE client, server launcher, server panel, health polling — all to bridge two processes on the same machine
- **Resource waste** — a long-running Node.js server process idle most of the time

## Solution

Eliminate the HTTP server. The CLI binary is the execution engine, vault files are the shared state, and `fs.watch()` is the notification layer.

**Before:**
```
Plugin → HTTP → Server (long-running) → WorkerManager → LLM
                  ↕ SSE
Plugin ← HTTP response / SSE events
```

**After:**
```
Plugin → spawn CLI process (stdin/stdout JSONL) → LLM
Plugin ← fs.watch(.flowti/var/) for state changes
```

## Architecture

### CLI Agent Commands

Four new commands, registered in a new `agent.controller.ts`:

#### `agent:start --agent="Bob"` (persistent worker)

Starts a long-running agent process. Writes PID to `.flowti/var/agents/bob.pid`. Accepts messages on stdin as JSON lines. Writes all events to both stdout and `.flowti/var/agents/bob-events.jsonl`.

```bash
flowti agent:start --agent="Bob"
```

The process stays alive until explicitly killed or the plugin unloads. It maintains the WorkerManager's in-memory agent state, conversation history, and LLM context.

#### `agent:send` (stdin message for a running agent)

Not a separate command — the plugin writes to the running agent process's stdin:

```jsonl
{"type":"message","text":"hello","context":"[World Context — Snapshot]\n..."}
```

The process streams events to stdout and appends to the event log:

```jsonl
{"ts":1711065601,"type":"thinking","text":"Processing your request..."}
{"ts":1711065605,"type":"using-tool","tool":"read_file","id":"t1"}
{"ts":1711065606,"type":"tool-complete","id":"t1"}
{"ts":1711065610,"type":"response","text":"The engine.ts file handles..."}
```

This handler bypasses `adaptDescriptor` — it directly reads stdin and writes JSONL to stdout. The `WorkerManager.send()` already emits these event types; the handler serializes them.

#### `agent:task --agent="Bob" --task="Run alignment"` (one-shot)

Normal controller pattern via `adaptDescriptor`. Spawns as a fresh process, returns JSON, exits.

```bash
flowti agent:task --agent="Bob" --task="Run alignment check" --format=json
# → { "ok": true, "taskId": "task-1711065600" }
```

Internally starts the agent process if not running, assigns the task, writes state to `world-state.json`.

#### `agent:list --format=json` (one-shot)

Lists all agents with current status from vault files.

```bash
flowti agent:list --format=json
# → [{ "name": "Bob", "domain": "engineering", "status": "idle" }, ...]
```

#### `agent:wake --agent="Bob"` (one-shot)

Pre-warms an agent worker. Spawns the persistent process if not running.

```bash
flowti agent:wake --agent="Bob"
# → { "ok": true, "state": "idle" }
```

### Agent Process Lifecycle

Each agent has:
- A long-running CLI process: `flowti agent:start --agent="Bob"`
- An append-only event log: `.flowti/var/agents/bob-events.jsonl`
- A PID file: `.flowti/var/agents/bob.pid`

| Action | What happens |
|--------|-------------|
| User sends message | Plugin writes JSON to process stdin |
| Agent thinks/responds | CLI appends events to `.jsonl` log + writes to stdout |
| User closes panel | Plugin detaches from stdout. Process keeps running. |
| User reopens panel | Plugin reads log from last position, `fs.watch()` for new lines |
| Agent finishes task | CLI writes final event to log, updates `world-state.json` |
| Plugin unload | Kill all agent processes via PID files |
| Plugin reloads | Check PID files, reattach to running agents |

### Event Log Format

File: `.flowti/var/agents/<agent-name>-events.jsonl`

```jsonl
{"ts":1711065600,"type":"message-in","text":"hello","context":"[World Context...]"}
{"ts":1711065601,"type":"thinking","text":"Processing your request..."}
{"ts":1711065605,"type":"using-tool","tool":"read_file","id":"t1"}
{"ts":1711065606,"type":"tool-complete","id":"t1"}
{"ts":1711065610,"type":"response","text":"The engine.ts file handles..."}
```

Event types:
- `message-in` — user message received (logged for replay)
- `thinking` — agent is processing
- `using-tool` — agent is using a tool
- `tool-complete` — tool execution finished
- `response` — agent's final response
- `task-started` — task assigned
- `task-completed` — task finished
- `error` — agent error

Log rotation: keep last 1000 lines per agent. Old entries are conversation history already persisted in the CLI's conversation store at `.flowti/var/conversations/`.

### Plugin CLI Executor

**Location:** `src/infrastructure/agents/cli-executor.ts`

Replaces `HttpAgentService`, `server-launcher.ts`, `api-client.ts`.

```typescript
interface CliExecutor {
  // Start a persistent agent process (or attach to existing)
  startAgent(agentName: string): AgentProcess;

  // One-shot commands
  assignTask(agentName: string, task: string): Promise<{ ok: boolean }>;
  listAgents(): Promise<AgentSummary[]>;
  wakeAgent(agentName: string): Promise<{ ok: boolean }>;

  // Cleanup
  killAll(): void;
  dispose(): void;
}

interface AgentProcess {
  readonly agentName: string;
  readonly running: boolean;

  // Send message via stdin
  send(message: string, context?: string): void;

  // Event stream (from stdout + event log tailing)
  onEvent(cb: (event: CliEvent) => void): () => void;

  // Replay events from log file (for reattach after panel reopen)
  replayFrom(offset: number): CliEvent[];

  // Kill the process
  kill(): void;
}

interface CliEvent {
  ts: number;
  type: "thinking" | "using-tool" | "tool-complete" | "response" | "task-started" | "task-completed" | "error";
  agent: string;
  text?: string;
  tool?: string;
  id?: string;
  status?: string;
}
```

**Resolves CLI binary:** checks `.flowti/bin/main.mjs` exists, finds Node.js on PATH.

**Process management:**
- Tracks running agents in a `Map<string, ChildProcess>`
- On `startAgent`: checks PID file, reattach if process alive, spawn if not
- On `killAll`: iterate PID files, kill each (tree kill on Windows)
- On `dispose`: kill all + clear watchers

### Plugin File Watcher

**Location:** `src/infrastructure/agents/file-watcher.ts`

Two utilities using Node.js `fs.watch()`:

```typescript
// Watch a JSON file for changes — debounced, hash-compared
function watchJsonFile<T>(path: string, onChange: (data: T) => void, debounceMs?: number): FileWatcher;

// Tail a JSONL file — track byte offset, read only new lines
function tailJsonlFile(path: string, onLine: (event: unknown) => void): FileWatcher;

interface FileWatcher {
  close(): void;
}
```

**`watchJsonFile`:**
- Uses `fs.watch()` with debounce (300ms default)
- SHA-256 hash comparison to avoid spurious events (Windows `fs.watch` fires multiple times)
- Parses JSON and calls typed callback
- Used for: `world-state.json`

**`tailJsonlFile`:**
- Uses `fs.watch()` on the file
- Tracks byte offset via `fs.statSync().size`
- On change: reads from last offset to current size
- Buffers partial lines (no newline yet)
- Calls callback per complete line
- Used for: `agents/<name>-events.jsonl`

Both follow the CLI's proven `SitemapWatcher` pattern.

### Integration Points

**WorldContext** — currently reads agent roster from `DashboardStore.agents` (loaded by PluginProvider from vault file). With this change:
- `WorldContext` watches `world-state.json` directly via `watchJsonFile()`
- No PluginProvider needed — WorldContext is the source of truth
- Agent roster derived from world state entities

**DashboardStore.sendMessage()** — currently calls `api.sendMessage()` (HTTP). With this change:
- Gets an `AgentProcess` from `CliExecutor`
- Calls `process.send(message, worldContext.serialize())`
- Subscribes to `process.onEvent()` for streaming responses
- Talk engine activated during thinking events
- Response event → `pushAgentResponse()` + hide lightbulb

**Agent World game** — unchanged. Consumes `DashboardStore` as before. The store's data source changes from HTTP to CLI, but the store API is the same.

**Agent sidepanel** — `agent-handlers.ts` uses `CliExecutor` instead of `agentService.sendMessage()`.

### What Gets Deleted

| Component | Reason |
|-----------|--------|
| `src/infrastructure/agents/server-launcher.ts` | No server to launch |
| `src/infrastructure/agents/http-agent-service.ts` | Replaced by CliExecutor |
| `src/infrastructure/agents/sse-client.ts` | Replaced by file watching |
| `src/infrastructure/server/http-server-service.ts` | No server HTTP API |
| `src/bootstrap/server-setup.ts` | No server domain |
| `src/ui/server/server-panel-view.ts` | No server panel view |
| `src/ui/server/types.ts` (VIEW_TYPE_SERVER_PANEL) | No server panel |
| `src/infrastructure/handlers/server-handlers.ts` | No server handlers |
| `src/components/server/*` (all 5 components) | No server panel UI |
| `src/domain/server/types.ts` | No server types |
| `src/game/config/plugin-provider.ts` | Replaced by CliExecutor + file watcher |
| `src/game/data/api-client.ts` | No HTTP API calls |
| Server ribbon icon + setup in `main.ts` | No server |

**Total deleted:** ~1,500+ lines of HTTP/SSE/server infrastructure.

### What Gets Created

| Component | Responsibility |
|-----------|---------------|
| `src/infrastructure/agents/cli-executor.ts` (~200 lines) | Spawn/manage CLI processes, stdin/stdout JSONL |
| `src/infrastructure/agents/file-watcher.ts` (~100 lines) | `watchJsonFile()` + `tailJsonlFile()` utilities |
| CLI `src/controller/agent.controller.ts` (~150 lines) | `agent:start`, `agent:task`, `agent:list`, `agent:wake` commands |
| CLI `src/domain/agents/agent-session.ts` (~200 lines) | Persistent agent process: stdin reader, event log writer, JSONL serializer |

### What Gets Modified

| Component | Change |
|-----------|--------|
| `src/bootstrap/agent-setup.ts` | Create CliExecutor instead of HttpAgentService + SseClient + server launcher |
| `src/game/store/dashboard-store.ts` | Use CliExecutor instead of api-client |
| `src/infrastructure/handlers/agent-handlers.ts` | Use CliExecutor instead of agentService.sendMessage |
| `src/domain/agents/world-context.ts` | Watch world-state.json via file watcher instead of store subscription |
| `src/main.ts` | Remove server setup, ribbon, unload. Add CliExecutor cleanup |

## Testing

| Area | Approach |
|------|----------|
| `CliExecutor` | Mock `child_process.spawn`, test JSONL parsing, timeout handling, PID file management, reattach logic |
| `FileWatcher` | Mock `fs.watch`/`fs.readFileSync`, test debounce, hash comparison, tail byte offset, partial line buffering |
| CLI `agent:start` | Mock WorkerManager, test stdin parsing, event log writing, JSONL stdout serialization |
| CLI `agent:task/list/wake` | Standard controller tests via `createProjectContext()` |
| Integration | Verify full loop: spawn → message → event log → file watch → UI update |

**Coverage target:** 80% statements, 80% lines.
