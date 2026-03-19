# Serverless CLI Architecture — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the HTTP server with direct CLI subprocess execution + file-based state sync. Agents run as persistent background processes, communicate via stdin/stdout JSONL, and persist events to append-only log files.

**Architecture:** Two phases. Phase A builds the CLI agent commands (`agent:start`, `agent:task`, `agent:list`, `agent:wake`, `agent:permission`) and the persistent agent session domain module. Phase B rewires the plugin: creates `CliExecutor` + `FileWatcher`, deletes ~1,500 lines of server infrastructure, and connects the game + sidepanel to the new CLI-based backend.

**Tech Stack:** TypeScript, Node.js child_process, fs.watch, JSONL streaming, ExcaliburJS (game unchanged)

**Spec:** `01 - Projects/Flowti CLI/docs/specs/2026-03-19-serverless-cli-architecture-design.md`

---

## Phase A: CLI Agent Commands

### Task 1: Create agent-session.ts — persistent agent process domain module

**Files:**
- Create: `01 - Projects/Flowti CLI/src/domain/agents/agent-session.ts`
- Create: `01 - Projects/Flowti CLI/tests/domain/agents/agent-session.test.ts`

This module handles the persistent stdin/stdout JSONL loop for a single agent. It reads JSON messages from stdin, routes them to the WorkerManager, and writes events as JSONL to both stdout and an event log file.

- [ ] **Step 1: Write agent-session.ts**

The module exports a single function:

```typescript
export interface AgentSessionDeps {
  readonly workerManager: IWorkerManager;
  readonly worldState: IWorldStateManager;
  readonly disk: IFileSystem;
  readonly paths: IPaths;
  readonly clock: IClock;
  readonly vaultRoot: string;
  readonly agentName: string;
}

export interface AgentSessionHandle {
  readonly agentName: string;
  start(): void;     // begin reading stdin
  dispose(): void;   // cleanup
}

export function createAgentSession(deps: AgentSessionDeps): AgentSessionHandle;
```

**How it works:**
- On `start()`: writes PID file to `.flowti/var/agents/<agent>.pid`, ensures event log dir exists
- Reads stdin line-by-line. Each line is JSON: `{"type":"message","text":"...","context":"..."}`
- On receiving a message:
  - Appends `{"ts":...,"type":"message-in","text":"..."}` to the event log
  - Calls `deps.workerManager.send(agentName, fullMessage, { onEvent, onResponse })`
  - `onEvent` callback: writes JSONL to stdout + appends to event log for each event (`thinking`, `using-tool`, `tool-complete`)
  - `onResponse` callback: writes `{"ts":...,"type":"response","text":"..."}` to stdout + event log
- Handles stdin types: `message`, `stop-generation`, `grant-permission`, `kill`
- On `dispose()`: removes PID file, closes readline

**Event log path:** `.flowti/var/agents/<slugified-agent-name>-events.jsonl`
**PID file path:** `.flowti/var/agents/<slugified-agent-name>.pid`

Use the `slugify` function from `agent-conversation-store.ts` for consistent naming.

- [ ] **Step 2: Write tests**

Test with mock WorkerManager and mock filesystem:
- `start()` creates PID file
- Receiving a message-type input calls `workerManager.send()`
- Worker events are written to event log as JSONL
- Response events are written to stdout
- `stop-generation` input type triggers worker stop
- `grant-permission` input type triggers permission resolution
- `dispose()` removes PID file
- Event log rotation: on start, if log exceeds 1000 lines, rotate to `.prev.jsonl`

- [ ] **Step 3: Run tests**

```bash
cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/agents/agent-session.test.ts --config configs/vitest.config.ts -v
```

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/domain/agents/agent-session.ts" "01 - Projects/Flowti CLI/tests/domain/agents/agent-session.test.ts"
git commit -m "feat(agents): add agent-session — persistent stdin/stdout JSONL agent process"
```

---

### Task 2: Create agent.controller.ts — CLI commands

**Files:**
- Create: `01 - Projects/Flowti CLI/src/controller/agent.controller.ts`
- Modify: `01 - Projects/Flowti CLI/src/main.ts` (register commands)
- Create: `01 - Projects/Flowti CLI/tests/controller/agent.controller.test.ts`

- [ ] **Step 1: Write agent.controller.ts**

```typescript
import { adaptDescriptor } from "../infrastructure/command-engine.js";
import type { CommandHandler } from "../infrastructure/types.js";
import type { LogFn } from "../infrastructure/command-engine.js";
import { createAgentSession } from "../domain/agents/agent-session.js";
import { agentStore } from "../domain/agents/agent-store.js";

// ── Data models ──────────────────────────────────────────────────────

export interface AgentListModel {
  readonly agents: readonly { name: string; domain?: string; status: string }[];
}

export interface AgentTaskModel {
  readonly ok: boolean;
  readonly taskId: string;
}

export interface AgentWakeModel {
  readonly ok: boolean;
  readonly state: string;
}

export interface AgentPermissionModel {
  readonly ok: boolean;
}

// ── Renderers ────────────────────────────────────────────────────────

function renderList(model: AgentListModel, log: LogFn): void {
  for (const a of model.agents) {
    log(`  ${a.name} (${a.domain ?? "general"}) — ${a.status}`);
  }
}

function renderTask(model: AgentTaskModel, log: LogFn): void {
  log(model.ok ? `  Task assigned: ${model.taskId}` : "  Task assignment failed");
}

function renderWake(model: AgentWakeModel, log: LogFn): void {
  log(model.ok ? `  Agent ready: ${model.state}` : "  Wake failed");
}

function renderPermission(model: AgentPermissionModel, log: LogFn): void {
  log(model.ok ? "  Permission granted" : "  Permission failed");
}

// ── Commands ─────────────────────────────────────────────────────────

export const commands: Record<string, CommandHandler> = {
  // agent:start is a special-case — persistent stdin/stdout session
  // It is registered separately in main.ts as a raw handler
  // (bypasses adaptDescriptor because it's a persistent stream, not request/response)

  "agent:list": adaptDescriptor({
    handler: (ctx) => {
      const agents = agentStore.list(ctx.deps, ctx.deps.paths.join(
        ctx.deps.paths.resolve("."), ".flowti", "agents"
      ));
      const worldState = ctx.deps.worldState.getState();
      return {
        agents: agents.map((a) => ({
          name: a.name,
          domain: a.domain,
          status: worldState.entities[a.name]
            ? String((worldState.entities[a.name].components.status as { state?: string })?.state ?? "idle")
            : "unassigned",
        })),
      };
    },
    renderer: renderList,
  }),

  "agent:task": adaptDescriptor({
    flags: {
      agent: { type: "string", required: true, hint: "--agent=<name>" },
      task: { type: "string", required: true, hint: "--task=<description>" },
    },
    handler: (ctx) => {
      const name = ctx.flags.agent as string;
      const task = ctx.flags.task as string;
      const taskId = `task-${Date.now()}`;

      // Import and use agent state
      const { readAgentState, addTask, writeAgentState } = require("../domain/agents/agent-state.js");
      const varDir = ctx.deps.paths.join(ctx.deps.paths.resolve("."), ".flowti", "var");
      const state = readAgentState(ctx.deps, varDir, name);
      const newState = addTask(state, { name: task, status: "pending", assignedAt: ctx.deps.clock.iso() });
      writeAgentState(ctx.deps, varDir, name, newState);

      ctx.deps.worldState.emitAction({
        id: taskId,
        agentName: name,
        timestamp: ctx.deps.clock.iso(),
        type: "task-started",
        data: { task },
      });

      return { ok: true, taskId };
    },
    renderer: renderTask,
  }),

  "agent:wake": adaptDescriptor({
    flags: {
      agent: { type: "string", required: true, hint: "--agent=<name>" },
    },
    handler: (ctx) => {
      const name = ctx.flags.agent as string;
      const worker = ctx.deps.workerManager.getWorker(name)
        ?? ctx.deps.workerManager.spawn(name);
      return { ok: !!worker, state: worker?.state ?? "unknown" };
    },
    renderer: renderWake,
  }),

  "agent:permission": adaptDescriptor({
    flags: {
      agent: { type: "string", required: true, hint: "--agent=<name>" },
      tool: { type: "string", required: true, hint: "--tool=<tool-name>" },
      decision: { type: "string", required: true, hint: "--decision=allow|deny" },
    },
    handler: (ctx) => {
      const name = ctx.flags.agent as string;
      const tool = ctx.flags.tool as string;
      const decision = ctx.flags.decision as string;
      const actionType = decision === "allow" ? "permission-granted" : "permission-denied";
      ctx.deps.worldState.emitAction({
        id: `perm-${Date.now()}`,
        agentName: name,
        timestamp: ctx.deps.clock.iso(),
        type: actionType,
        data: { tool },
      });
      return { ok: true };
    },
    renderer: renderPermission,
  }),
};
```

- [ ] **Step 2: Register agent:start as special-case in main.ts**

In `src/main.ts`, add the `agent:start` handler before the normal command dispatch. This is the persistent session that bypasses `adaptDescriptor`:

```typescript
// In handleCliArgs() or the command dispatch section:
if (command === "agent:start") {
  const agentName = flags.agent as string;
  if (!agentName) { console.error("--agent is required"); process.exit(1); }
  const session = createAgentSession({
    workerManager: deps.workerManager,
    worldState: deps.worldState,
    disk: deps.disk,
    paths: deps.paths,
    clock: deps.clock,
    vaultRoot: VAULT_ROOT,
    agentName,
  });
  session.start();
  // Process stays alive — stdin/stdout loop runs until killed
  return true;
}
```

Register the other commands normally:
```typescript
registry.registerDomain({
  domain: "agent",
  commands: agentCmds,
  projectFree: ["agent:list", "agent:task", "agent:wake", "agent:permission"],
});
```

- [ ] **Step 3: Write controller tests**

Test `agent:list`, `agent:task`, `agent:wake`, `agent:permission` via `createProjectContext()`. Mock deps with WorkerManager and WorldState stubs.

- [ ] **Step 4: Run tests**

```bash
cd "01 - Projects/Flowti CLI" && npx vitest run tests/controller/agent.controller.test.ts --config configs/vitest.config.ts -v
```

- [ ] **Step 5: Verify CLI help shows new commands**

```bash
cd "C:/Projects/flowti" && node .flowti/bin/main.mjs agent:list --format=json
```

Expected: JSON array of agents (or empty array if no agents defined).

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/controller/agent.controller.ts" "01 - Projects/Flowti CLI/src/main.ts" "01 - Projects/Flowti CLI/tests/controller/agent.controller.test.ts"
git commit -m "feat(agents): add CLI agent commands — list, task, wake, permission, start"
```

---

## Phase B: Plugin Rewire

### Task 3: Create file-watcher.ts

**Files:**
- Create: `01 - Projects/Flowti Plugin/src/infrastructure/agents/file-watcher.ts`
- Create: `01 - Projects/Flowti Plugin/tests/infrastructure/agents/file-watcher.test.ts`

- [ ] **Step 1: Write file-watcher.ts**

Two utilities: `watchJsonFile<T>()` and `tailJsonlFile()`.

```typescript
import { watch, readFileSync, statSync, existsSync, type FSWatcher } from "node:fs";
import { createHash } from "node:crypto";

export interface FileWatcher {
  close(): void;
}

export function watchJsonFile<T>(
  path: string,
  onChange: (data: T) => void,
  debounceMs = 300,
): FileWatcher {
  let lastHash = "";
  let timer: ReturnType<typeof setTimeout> | null = null;

  function check(): void {
    try {
      const content = readFileSync(path, "utf-8");
      const hash = createHash("sha256").update(content).digest("hex");
      if (hash === lastHash) return;
      lastHash = hash;
      onChange(JSON.parse(content) as T);
    } catch { /* file missing or invalid — ignore */ }
  }

  const watcher = watch(path, () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(check, debounceMs);
  });

  // Initial read
  check();

  return {
    close(): void {
      watcher.close();
      if (timer) clearTimeout(timer);
    },
  };
}

export function tailJsonlFile(
  path: string,
  onLine: (event: unknown) => void,
): FileWatcher {
  let offset = 0;
  let buffer = "";
  let pollTimer: ReturnType<typeof setInterval> | null = null;

  function readNewLines(): void {
    try {
      if (!existsSync(path)) return;
      const size = statSync(path).size;
      if (size <= offset) return;
      const fd = require("node:fs").openSync(path, "r");
      const buf = Buffer.alloc(size - offset);
      require("node:fs").readSync(fd, buf, 0, buf.length, offset);
      require("node:fs").closeSync(fd);
      offset = size;

      buffer += buf.toString("utf-8");
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? ""; // keep incomplete last line
      for (const line of lines) {
        if (!line.trim()) continue;
        try { onLine(JSON.parse(line)); } catch { /* malformed line */ }
      }
    } catch { /* file error — ignore */ }
  }

  let watcher: FSWatcher | null = null;
  try {
    watcher = watch(path, () => readNewLines());
  } catch { /* file may not exist yet */ }

  // Windows polling fallback
  if (process.platform === "win32") {
    pollTimer = setInterval(readNewLines, 500);
  }

  // Initial read
  readNewLines();

  return {
    close(): void {
      watcher?.close();
      if (pollTimer) clearInterval(pollTimer);
    },
  };
}
```

- [ ] **Step 2: Write tests**

Mock `fs.watch`, `readFileSync`, `statSync`. Test:
- `watchJsonFile`: fires callback on content change, ignores duplicate (same hash), debounces
- `tailJsonlFile`: reads new lines from offset, buffers partial lines, handles missing file
- `close()` cleans up watcher and timers

- [ ] **Step 3: Run tests and commit**

```bash
cd "01 - Projects/Flowti Plugin" && npx vitest run tests/infrastructure/agents/file-watcher.test.ts -v
git add "01 - Projects/Flowti Plugin/src/infrastructure/agents/file-watcher.ts" "01 - Projects/Flowti Plugin/tests/infrastructure/agents/file-watcher.test.ts"
git commit -m "feat(agents): add file-watcher — watchJsonFile + tailJsonlFile utilities"
```

---

### Task 4: Create cli-executor.ts

**Files:**
- Create: `01 - Projects/Flowti Plugin/src/infrastructure/agents/cli-executor.ts`
- Create: `01 - Projects/Flowti Plugin/tests/infrastructure/agents/cli-executor.test.ts`

- [ ] **Step 1: Write cli-executor.ts**

Implements the `CliExecutor` interface from the spec. Key behaviors:
- `startAgent(name)`: checks PID file, validates process alive, kills stale, spawns `node .flowti/bin/main.mjs agent:start --agent=<name>` with `stdio: ["pipe", "pipe", "pipe"]`
- Returns `AgentProcess` with `send()`, `onEvent()`, `replayFrom()`, `stopGeneration()`, `grantPermission()`, `kill()`
- `assignTask/listAgents/wakeAgent/grantPermission`: spawn one-shot CLI process, read JSON from stdout
- `killAll()`: iterate PID files in `.flowti/var/agents/`, kill each with tree kill
- PID validation: `tasklist /FI "PID eq ..."` on Windows, `kill -0` on Unix

**AgentProcess implementation:**
- `send(message, context)`: writes `{"type":"message","text":"...","context":"..."}` to stdin
- `onEvent(cb)`: reads stdout line-by-line, parses JSONL, calls callback per event
- `replayFrom(offset)`: reads event log from byte offset, returns parsed events
- `stopGeneration()`: writes `{"type":"stop-generation"}` to stdin
- `grantPermission(tool, decision)`: writes `{"type":"grant-permission","tool":"...","decision":"..."}` to stdin
- `kill()`: kills process, removes PID file

- [ ] **Step 2: Write tests**

Mock `child_process.spawn`. Test:
- `startAgent` spawns CLI with correct args
- `send()` writes JSON to stdin
- stdout JSONL events parsed and delivered to `onEvent` callbacks
- `killAll()` reads PID files and kills processes
- `assignTask` spawns one-shot process and parses JSON response
- PID validation handles stale PIDs

- [ ] **Step 3: Run tests and commit**

```bash
cd "01 - Projects/Flowti Plugin" && npx vitest run tests/infrastructure/agents/cli-executor.test.ts -v
git add "01 - Projects/Flowti Plugin/src/infrastructure/agents/cli-executor.ts" "01 - Projects/Flowti Plugin/tests/infrastructure/agents/cli-executor.test.ts"
git commit -m "feat(agents): add CliExecutor — spawn/manage CLI agent processes"
```

---

### Task 5: Create cli-data-provider.ts

**Files:**
- Create: `01 - Projects/Flowti Plugin/src/game/config/cli-data-provider.ts`

- [ ] **Step 1: Write cli-data-provider.ts**

A `DataProvider` implementation backed by `CliExecutor` + file watching. Replaces `plugin-provider.ts`.

```typescript
import type { DataProvider } from "./data-provider.js";
import type { DashboardAgent, WorldState, WorldEntity, AgentAction, ConnectionStatus } from "../data/types.js";
import type { CliExecutor } from "../../infrastructure/agents/cli-executor.js";
import { watchJsonFile, type FileWatcher } from "../../infrastructure/agents/file-watcher.js";

const WORLD_STATE_PATH = ".flowti/var/world-state.json";
const AGENT_ROSTER_PATH = ".flowti/agents/data/agent-dashboard.json";

export function createCliDataProvider(
  cliExecutor: CliExecutor,
  vaultBasePath: string,
): DataProvider {
  // ... reads agents from vault file, watches world-state.json
  // onAction: subscribes to CliExecutor's event stream
  // No HTTP, no SSE
}
```

Key differences from `plugin-provider.ts`:
- `getDashboardAgents()`: reads `agent-dashboard.json` from disk (same as before)
- `getWorldState()`: reads `world-state.json` from disk (same as before)
- `onAction()`: subscribes to CliExecutor's agent event streams
- `start()`: sets up `watchJsonFile` on world-state.json, emits connection status based on CLI binary availability
- `stop()`: closes file watchers

- [ ] **Step 2: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/config/cli-data-provider.ts"
git commit -m "feat(agents): add CliDataProvider — DataProvider backed by CLI + file watching"
```

---

### Task 6: Rewire agent-setup.ts and DashboardStore

**Files:**
- Modify: `01 - Projects/Flowti Plugin/src/bootstrap/agent-setup.ts`
- Modify: `01 - Projects/Flowti Plugin/src/game/store/dashboard-store.ts`
- Modify: `01 - Projects/Flowti Plugin/src/game/engine.ts`
- Modify: `01 - Projects/Flowti Plugin/src/ui/agents/agent-world-view.ts`

- [ ] **Step 1: Update agent-setup.ts**

Replace `HttpAgentService` + `SseClient` + server launcher with `CliExecutor`:

- Remove imports: `HttpAgentService`, `SseClient`, `server-launcher.*`
- Create: `const cliExecutor = new CliExecutor(vaultBasePath);`
- Update `AgentSetupResult`: replace `agentService`, `sseClient` with `cliExecutor`
- Update `viewDeps` for sidepanel: pass `cliExecutor` instead of `agentService`
- Update `worldDeps` for agent world: pass `cliExecutor`
- Remove `connectWhenReady` (no server to connect to)
- Remove SSE disconnect handler

- [ ] **Step 2: Update DashboardStore**

Replace `api.sendMessage()` with `CliExecutor.startAgent().send()`:

- Remove `import * as api from "../data/api-client.js"`
- Accept `cliExecutor: CliExecutor` in constructor (instead of `baseUrl`)
- `sendMessage()`: get or create `AgentProcess`, call `process.send(message, context)`, subscribe to events
- `assignTask()`: call `cliExecutor.assignTask()`
- Remove all HTTP-related code

- [ ] **Step 3: Update agent-world-view.ts**

Replace `createPluginProvider()` with `createCliDataProvider()`:

```typescript
import { createCliDataProvider } from "../../game/config/cli-data-provider.js";
// ...
const provider = createCliDataProvider(this.deps.cliExecutor, vaultBasePath);
```

- [ ] **Step 4: Update engine.ts DashboardStore construction**

Pass `cliExecutor` instead of `serverBaseUrl`:

```typescript
const store = new DashboardStore(deps.cliExecutor, deps.worldContext);
```

- [ ] **Step 5: Build and verify**

```bash
cd "01 - Projects/Flowti Plugin" && npm run build
```

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/bootstrap/agent-setup.ts" "01 - Projects/Flowti Plugin/src/game/store/dashboard-store.ts" "01 - Projects/Flowti Plugin/src/game/engine.ts" "01 - Projects/Flowti Plugin/src/ui/agents/agent-world-view.ts"
git commit -m "feat(agents): rewire setup + store + view to use CliExecutor"
```

---

### Task 7: Rewire agent-handlers.ts (sidepanel)

**Files:**
- Modify: `01 - Projects/Flowti Plugin/src/infrastructure/handlers/agent-handlers.ts`
- Modify: `01 - Projects/Flowti Plugin/src/ui/agents/agent-sidepanel-view.ts`

- [ ] **Step 1: Update agent-handlers.ts**

Replace `agentService.sendMessage()` with `cliExecutor.startAgent().send()`:

- Replace `IAgentService` with `CliExecutor` in `AgentHandlerDeps`
- The `agent-send` handler: get `AgentProcess`, write message to stdin, subscribe to events for UI updates
- Remove legacy `contextProvider` diff-based enrichment (WorldContext handles this)

- [ ] **Step 2: Update agent-sidepanel-view.ts deps**

Replace `agentService` with `cliExecutor` in `AgentSidepanelDeps`.

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/infrastructure/handlers/agent-handlers.ts" "01 - Projects/Flowti Plugin/src/ui/agents/agent-sidepanel-view.ts"
git commit -m "feat(agents): rewire sidepanel to use CliExecutor"
```

---

### Task 8: Delete server infrastructure

**Files to delete:**
- `01 - Projects/Flowti Plugin/src/infrastructure/agents/server-launcher.ts`
- `01 - Projects/Flowti Plugin/src/infrastructure/agents/http-agent-service.ts`
- `01 - Projects/Flowti Plugin/src/infrastructure/agents/sse-client.ts`
- `01 - Projects/Flowti Plugin/src/infrastructure/agents/stub-agent-service.ts`
- `01 - Projects/Flowti Plugin/src/infrastructure/server/http-server-service.ts`
- `01 - Projects/Flowti Plugin/src/bootstrap/server-setup.ts`
- `01 - Projects/Flowti Plugin/src/ui/server/server-panel-view.ts`
- `01 - Projects/Flowti Plugin/src/ui/server/types.ts`
- `01 - Projects/Flowti Plugin/src/infrastructure/handlers/server-handlers.ts`
- `01 - Projects/Flowti Plugin/src/components/server/` (entire directory)
- `01 - Projects/Flowti Plugin/src/domain/server/types.ts`
- `01 - Projects/Flowti Plugin/src/game/config/plugin-provider.ts`
- `01 - Projects/Flowti Plugin/src/game/data/api-client.ts`

**Files to modify:**
- `01 - Projects/Flowti Plugin/src/main.ts` — remove server setup, server ribbon icon, server unload cleanup

- [ ] **Step 1: Delete all server files**

```bash
rm -f "01 - Projects/Flowti Plugin/src/infrastructure/agents/server-launcher.ts"
rm -f "01 - Projects/Flowti Plugin/src/infrastructure/agents/http-agent-service.ts"
rm -f "01 - Projects/Flowti Plugin/src/infrastructure/agents/sse-client.ts"
rm -f "01 - Projects/Flowti Plugin/src/infrastructure/agents/stub-agent-service.ts"
rm -f "01 - Projects/Flowti Plugin/src/infrastructure/server/http-server-service.ts"
rm -f "01 - Projects/Flowti Plugin/src/bootstrap/server-setup.ts"
rm -f "01 - Projects/Flowti Plugin/src/ui/server/server-panel-view.ts"
rm -f "01 - Projects/Flowti Plugin/src/ui/server/types.ts"
rm -f "01 - Projects/Flowti Plugin/src/infrastructure/handlers/server-handlers.ts"
rm -rf "01 - Projects/Flowti Plugin/src/components/server/"
rm -f "01 - Projects/Flowti Plugin/src/domain/server/types.ts"
rm -f "01 - Projects/Flowti Plugin/src/game/config/plugin-provider.ts"
rm -f "01 - Projects/Flowti Plugin/src/game/data/api-client.ts"
```

- [ ] **Step 2: Clean up main.ts**

Remove:
- `import { setupServerDomain, type ServerSetupResult } from "./bootstrap/server-setup"`
- `import { VIEW_TYPE_SERVER_PANEL } from "./ui/server/types"`
- `import { getServerStatus, killServer, clearServerRegistry } from "./infrastructure/agents/server-launcher.js"`
- `private serverSetup?: ServerSetupResult`
- The server domain setup block (ribbon icon, `setupServerDomain()` call)
- The server kill in `onunload()`
- `VIEW_TYPE_SERVER_PANEL` from the view detach list

- [ ] **Step 3: Remove stale test files**

```bash
rm -f "01 - Projects/Flowti Plugin/tests/infrastructure/agents/sse-client.test.ts"
rm -f "01 - Projects/Flowti Plugin/tests/infrastructure/agents/server-launcher.test.ts"
rm -rf "01 - Projects/Flowti Plugin/tests/components/server/"
```

- [ ] **Step 4: Grep for remaining references**

```bash
grep -r "server-launcher\|http-agent-service\|sse-client\|stub-agent-service\|server-setup\|server-panel\|ServerPanel\|HttpServerService\|HttpAgentService\|SseClient\|VIEW_TYPE_SERVER_PANEL\|api-client\|plugin-provider" "01 - Projects/Flowti Plugin/src/" --include="*.ts" | grep -v node_modules
```

Fix any remaining references.

- [ ] **Step 5: Build**

```bash
cd "01 - Projects/Flowti Plugin" && npm run build
```

- [ ] **Step 6: Commit**

```bash
git add -A "01 - Projects/Flowti Plugin/"
git commit -m "chore(agents): delete server infrastructure — ~1,500 lines removed"
```

---

### Task 9: Update WorldContext to use file watcher

**Files:**
- Modify: `01 - Projects/Flowti Plugin/src/domain/agents/world-context.ts`

- [ ] **Step 1: Add file watcher for world-state.json**

WorldContext currently gets agent roster from `DashboardStore`. With file watching, it reads directly from vault:

- Import `watchJsonFile` from `file-watcher.ts`
- In constructor: set up `watchJsonFile` on `.flowti/var/world-state.json`
- On change: update `agentRoster` and `recentActivity` from the world state entities/activity log
- Remove dependency on DashboardStore for roster data

- [ ] **Step 2: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/domain/agents/world-context.ts"
git commit -m "feat(agents): WorldContext watches world-state.json via file watcher"
```

---

### Task 10: Final verification

- [ ] **Step 1: Build both projects**

```bash
cd "01 - Projects/Flowti CLI" && node configs/esbuild.config.mjs
cd "01 - Projects/Flowti Plugin" && npm run build
```

- [ ] **Step 2: Run plugin tests**

```bash
cd "01 - Projects/Flowti Plugin" && npx vitest run 2>&1 | tail -10
```

- [ ] **Step 3: Run CLI tests**

```bash
cd "01 - Projects/Flowti CLI" && npx vitest run --config configs/vitest.config.ts 2>&1 | tail -10
```

- [ ] **Step 4: Type check**

```bash
cd "01 - Projects/Flowti Plugin" && npx tsc --noEmit --skipLibCheck 2>&1 | head -20
```

- [ ] **Step 5: Test end-to-end**

```bash
cd "C:/Projects/flowti" && node .flowti/bin/main.mjs agent:list --format=json
```

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat(agents): Serverless CLI architecture complete — verified"
```
