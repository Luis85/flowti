# Iteration 5 — Unified CLI-Plugin Architecture Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Flowti CLI the orchestrator and the Flowti Plugin the visual UI on top, connected via HTTP+SSE, with a persistent LLM companion sidepanel.

**Architecture:** CLI bundles into Plugin at build time. Plugin spawns CLI server (`flowti serve`) on load, connects via SSE. New Plugin hub view with 4 tabs (CLI Hub, Raw Terminal, Agents Hub, Projects Hub). Skill execution through bidirectional streaming with session integration. RPG talk engine refactored into domain-driven templates.

**Tech Stack:** Node.js, TypeScript, Obsidian API, HTTP+SSE, Ink (CLI TUI), Lit (Plugin components), ExcaliburJS (RPG world)

**Spec:** `01 - Projects/Flowti CLI/docs/specs/2026-03-17-iteration-5-unified-architecture-design.md`

---

## Chunk 1: Bug Fixes (C0 + C1)

### Task 1: Fix Plugin View Crash (C0 — BLOCKER)

**Context:** All Plugin views crash with `TypeError: Cannot read properties of undefined (reading 'type')` at `getViewType()`. The `SitemapHubView` and `SitemapLeafView` constructors store `this.viewDef = viewDef` and `getViewType()` returns `this.viewDef.type`. The crash means `viewDef` is undefined when the constructor runs.

**Files:**
- Debug: `01 - Projects/Flowti Plugin/src/infrastructure/sitemap/sitemap-bootstrap.ts:40-59`
- Debug: `01 - Projects/Flowti Plugin/src/ui/views/sitemap-hub-view.ts:19-34`
- Debug: `01 - Projects/Flowti Plugin/src/ui/views/sitemap-leaf-view.ts:23-35`
- Debug: `01 - Projects/Flowti Plugin/src/main.ts:229,377`
- Config: `01 - Projects/Flowti Plugin/configs/sitemap.json`

- [ ] **Step 1: Enable source maps and reproduce the crash**

Run from `01 - Projects/Flowti Plugin`:
```bash
npm run build:dev
```
Open Obsidian, open developer console (Ctrl+Shift+I), navigate to a Flowti view, capture the full stack trace with source-mapped line numbers.

- [ ] **Step 2: Trace the registration path**

In `sitemap-bootstrap.ts:40-59`, add temporary debug logging:
```typescript
private registerViews(): void {
  for (const [key, viewDef] of Object.entries(this.sitemap.views)) {
    console.log(`[SitemapBootstrap] Registering view: ${key}`, { type: viewDef?.type, kind: viewDef?.kind });
    // ... rest of registration
  }
}
```

Check: are all views getting valid `viewDef` objects with `type` fields?

- [ ] **Step 3: Check the sitemap import**

In `main.ts`, verify the import at the top:
```typescript
import pluginSitemap from "../plugin-sitemap.json";
```

Log it: `console.log("[Main] pluginSitemap.views:", Object.keys(pluginSitemap.views));`

If the import is empty or malformed, the issue is the build step not copying `configs/sitemap.json` to `plugin-sitemap.json`.

- [ ] **Step 4: Check constructor call ordering**

In `sitemap-hub-view.ts:19-28`, the constructor calls `super(leaf, eventBus)` BEFORE setting `this.viewDef = viewDef`. If the `super()` call triggers `getViewType()` internally (Obsidian's `ItemView` constructor may call it), then `this.viewDef` is still undefined.

Check: does `super(leaf, eventBus)` in `BaseHubView` or Obsidian's `ItemView` call `getViewType()` during construction?

If yes, the fix is to pass the type to the super call and store it separately:
```typescript
// sitemap-hub-view.ts
constructor(leaf: WorkspaceLeaf, eventBus: IEventBus, viewDef: ViewDef, handlerRegistry: PluginHandlerRegistry) {
  super(leaf, eventBus, viewDef.type);  // pass type to super
  this.viewDef = viewDef;
  this.handlerRegistry = handlerRegistry;
}
```

And in `BaseHubView`:
```typescript
constructor(leaf: WorkspaceLeaf, eventBus: IEventBus, private readonly viewType: string) {
  super(leaf);
  // ...
}
getViewType(): string { return this.viewType; }
```

- [ ] **Step 5: Apply the fix to SitemapLeafView as well**

Same pattern — store the type string before `super()` can access it:
```typescript
// sitemap-leaf-view.ts
private readonly viewType: string;
constructor(leaf: WorkspaceLeaf, eventBus: IEventBus, viewDef: ViewDef, handlerRegistry: PluginHandlerRegistry) {
  // Store type before super() which may call getViewType()
  // Note: can't assign before super in TS, so use a workaround
  super(leaf);
  this.viewType = viewDef.type;
  this.viewDef = viewDef;
  this.eventBus = eventBus;
  this.handlerRegistry = handlerRegistry;
}
getViewType(): string { return this.viewType; }
```

**Alternative if `super()` doesn't call `getViewType()`:** The issue may be in the factory function. Check `sitemap-bootstrap.ts:47-48`:
```typescript
this.safeRegister(viewDef.type, (leaf) =>
  new SitemapHubView(leaf, this.deps.eventBus, viewDef, this.deps.handlerRegistry) as never,
);
```

The closure captures `viewDef` — verify it's not being reassigned or garbage collected before the factory is called.

- [ ] **Step 6: Remove debug logging, rebuild, verify all views open**

Run:
```bash
cd "01 - Projects/Flowti Plugin" && npm run build:dev
```

Test: open each hub view (Event Catalog, User Hub, Train Hub, Analytics Hub, Test Management Hub, Data Exchange Hub) and each leaf view. No errors in console.

- [ ] **Step 7: Run Plugin tests**

```bash
cd "01 - Projects/Flowti Plugin" && npm test
```

Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/"
git commit -m "fix(plugin): resolve view crash — getViewType() called before viewDef assigned"
```

---

### Task 2: Fix TUI Ink Migration Regression (C1)

**Context:** The Ink TUI has 95/148 sitemap actions implemented (64%). Critical gaps: agent launch, storybook commands, iteration management, and CRUD form pages are stubbed. The TUI is sitemap-driven — adding actions requires: (1) action exists in sitemap.json, (2) handler registered in TUI registry.

**Files:**
- Modify: `01 - Projects/Flowti CLI/src/tui/navigation/section-map.ts`
- Modify: handler registration files in `01 - Projects/Flowti CLI/src/tui/`
- Reference: `01 - Projects/Flowti CLI/configs/sitemap.json` (all 148 actions)

**Priority:** Focus on the actions that were explicitly called out as missing — agent launch, storybook, project management. Don't build all 53 missing handlers — just the ones needed for parity with common workflows.

- [ ] **Step 1: Identify the critical missing handlers**

The user reported: agents can't be started, storybook can't be launched, project features missing.

Critical handlers to wire:
- `agent:run` — launch agent via runner domain
- `agent:run-brief` — launch agent with brief
- `agents:autonomous-enabled` — toggle autonomous mode
- `comp:sb-install` — install storybook
- `comp:sb-start` — start storybook dev
- `comp:sb-stop` — stop storybook
- `comp:sb-build` — build storybook

- [ ] **Step 2: Wire agent launch handlers**

Find the existing stubbed handlers for agent:run and agent:run-brief in the TUI handler registry. Replace stubs with actual calls to the controller commands:

```typescript
// In the appropriate TUI handler file
registry.registerEffect("agent:run", async (ctx) => {
  const { commands } = await import("../../controller/agents.controller.js");
  await commands["agent:run"](ctx.flags, ctx.rawArgs, "agent:run", ctx.project);
  return { kind: "ok", message: "Agent launched" };
});
```

- [ ] **Step 3: Wire storybook handlers**

Replace stubbed "not available" storybook handlers with actual calls:

```typescript
registry.registerEffect("comp:sb-install", async (ctx) => {
  const { commands } = await import("../../controller/storybook.controller.js");
  await commands["storybook:install"](ctx.flags, ctx.rawArgs, "storybook:install", ctx.project);
  return { kind: "ok", message: "Storybook installed" };
});
// Repeat for sb-start, sb-stop, sb-build
```

- [ ] **Step 4: Verify wired handlers work in TUI**

```bash
cd "01 - Projects/Flowti CLI" && node configs/esbuild.config.mjs
cd ../.. && .\flowti.cmd
```

Navigate to Agents section → verify agent launch action is available and works.
Navigate to Project → Components → verify storybook actions are available.

- [ ] **Step 5: Run CLI tests**

```bash
cd "01 - Projects/Flowti CLI" && npx vitest run --config configs/vitest.config.ts
```

Expected: 7470+ passing, no new failures.

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/tui/"
git commit -m "fix(tui): wire agent launch, storybook, and project handlers in Ink TUI"
```

---

## Chunk 2: CLI Bundling & Server Lifecycle (C2)

### Task 3: Fix Port Resolution in Static Server

**Context:** `static-server.ts:startServer()` hardcodes the port in the returned URL. When `port=0` is passed, the OS assigns a random port but the server returns `http://localhost:0`. Must call `server.address()` after listen.

**Files:**
- Modify: `01 - Projects/Flowti CLI/src/domain/serve/static-server.ts:288-314`
- Test: `01 - Projects/Flowti CLI/tests/domain/serve/static-server.test.ts`

- [ ] **Step 1: Write failing test for port=0 resolution**

```typescript
// tests/domain/serve/static-server.test.ts
it("resolves actual port when port=0 is requested", async () => {
  const handle = await startServer({ port: 0, dir: testDir }, mockDeps);
  const actualPort = parseInt(new URL(handle.url).port, 10);
  expect(actualPort).toBeGreaterThan(0);
  expect(actualPort).not.toBe(0);
  handle.close();
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/serve/static-server.test.ts -t "resolves actual port" --config configs/vitest.config.ts
```

Expected: FAIL — URL contains port 0.

- [ ] **Step 3: Fix startServer() to use server.address()**

In `static-server.ts`, modify the listen callback:

```typescript
export function startServer(
  options: ServerOptions,
  deps: Pick<CliDeps, "disk" | "paths" | "log">,
  context?: ServerContext,
): Promise<ServerHandle> {
  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      // ... existing handler
    });

    server.listen(options.port, () => {
      const addr = server.address();
      const actualPort = typeof addr === "object" && addr ? addr.port : options.port;
      const url = `http://localhost:${actualPort}`;
      resolve({
        url,
        port: actualPort,
        close: () => server.close(),
      });
    });

    server.on("error", reject);
  });
}
```

- [ ] **Step 4: Update ServerHandle type to include port**

```typescript
export interface ServerHandle {
  url: string;
  port: number;
  close: () => void;
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/serve/static-server.test.ts --config configs/vitest.config.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/domain/serve/static-server.ts" "01 - Projects/Flowti CLI/tests/domain/serve/static-server.test.ts"
git commit -m "fix(serve): resolve actual port via server.address() when port=0"
```

---

### Task 4: Add --json Flag to Serve Command

**Context:** Plugin needs structured JSON output from the serve command to discover the port. Add a `--json` flag that emits `{"port": N, "protocol": 1}` to stdout instead of human-readable text.

**Files:**
- Modify: `01 - Projects/Flowti CLI/src/controller/serve.controller.ts:56-87`
- Modify: `01 - Projects/Flowti CLI/src/domain/serve/static-server.ts` (ServeStartModel)
- Test: `01 - Projects/Flowti CLI/tests/controller/serve.controller.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
it("returns port and protocol in JSON format when --json flag is set", async () => {
  const ctx = createProjectContext({
    command: "serve",
    flags: { port: "0", json: "true" },
  });
  const result = await descriptor.handler(ctx);
  expect(result).toHaveProperty("port");
  expect(result).toHaveProperty("protocol");
  expect(result.protocol).toBe(1);
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd "01 - Projects/Flowti CLI" && npx vitest run tests/controller/serve.controller.test.ts -t "json format" --config configs/vitest.config.ts
```

- [ ] **Step 3: Add json flag and protocol to serve command**

In `serve.controller.ts`, add the `json` flag to the descriptor and include `protocol` in the model:

```typescript
"serve": adaptDescriptor({
  flags: {
    port: { type: "number", default: 3000, hint: "--port=<number>" },
    dir: { type: "string", default: ".flowti/agents", hint: "--dir=<path>" },
    json: { type: "boolean", default: false, hint: "--json" },
  },
  handler: async (ctx) => {
    // ... existing handler
    return { ...state, protocol: 1 };
  },
  renderer: renderServeStart,
}),
```

- [ ] **Step 4: Run test to verify it passes**

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/controller/serve.controller.ts" "01 - Projects/Flowti CLI/tests/controller/serve.controller.test.ts"
git commit -m "feat(serve): add --json flag with protocol version for Plugin handshake"
```

---

### Task 5: Add /api/version Endpoint

**Files:**
- Modify: `01 - Projects/Flowti CLI/src/domain/serve/static-server.ts` (handleApiRoute)
- Test: `01 - Projects/Flowti CLI/tests/domain/serve/static-server.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
it("GET /api/version returns protocol and CLI version", async () => {
  const handle = await startServer({ port: 0, dir: testDir }, mockDeps);
  const res = await fetch(`${handle.url}/api/version`);
  const data = await res.json();
  expect(data.protocol).toBe(1);
  expect(data.cli).toBeDefined();
  handle.close();
});
```

- [ ] **Step 2: Run test, verify failure**

- [ ] **Step 3: Add endpoint to handleApiRoute()**

In `static-server.ts`, inside `handleApiRoute()`:

```typescript
if (req.method === "GET" && urlPath === "/api/version") {
  return json(res, 200, { protocol: 1, cli: "0.1.0", features: ["command", "skill", "agent"] });
}
```

- [ ] **Step 4: Run test, verify pass**

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/domain/serve/static-server.ts" "01 - Projects/Flowti CLI/tests/domain/serve/static-server.test.ts"
git commit -m "feat(serve): add GET /api/version endpoint with protocol version"
```

---

### Task 6: Add /api/command Generic Executor

**Context:** This endpoint exposes the CLI command registry over HTTP. It accepts a command + args, routes through the dispatch pipeline, and returns the typed data model as JSON.

**Files:**
- Create: `01 - Projects/Flowti CLI/src/domain/serve/command-executor.ts`
- Modify: `01 - Projects/Flowti CLI/src/domain/serve/static-server.ts`
- Test: `01 - Projects/Flowti CLI/tests/domain/serve/command-executor.test.ts`

- [ ] **Step 1: Write failing test for command executor**

```typescript
// tests/domain/serve/command-executor.test.ts
import { executeCommand } from "../../../src/domain/serve/command-executor.js";

describe("executeCommand", () => {
  it("executes a registered command and returns JSON result", async () => {
    const result = await executeCommand("help", {}, mockDeps);
    expect(result.exitCode).toBe(0);
    expect(result.data).toBeDefined();
  });

  it("returns error for unknown command", async () => {
    const result = await executeCommand("nonexistent", {}, mockDeps);
    expect(result.exitCode).toBe(1);
    expect(result.error).toContain("Unknown command");
  });
});
```

- [ ] **Step 2: Run test, verify failure**

- [ ] **Step 3: Implement command executor**

```typescript
// src/domain/serve/command-executor.ts
import { resolveCommand } from "../../infrastructure/dispatch.js";
import { getCommandRegistry } from "../../infrastructure/command-registry.js";
import type { CliDeps } from "../../infrastructure/deps.js";

export interface CommandResult {
  exitCode: number;
  data?: unknown;
  output?: string;
  error?: string;
}

export async function executeCommand(
  command: string,
  args: Record<string, string | boolean>,
  deps: CliDeps,
  project?: ProjectContext,
): Promise<CommandResult> {
  const registry = getCommandRegistry();
  const dispatch = resolveCommand(command, { ...args, format: "json" }, [], registry.handlers, registry.projectFreeSet, registry.wildcardHandler, project);

  if (dispatch.action === "unknown") {
    return { exitCode: 1, error: `Unknown command: ${command}` };
  }

  if (dispatch.action === "no-project") {
    return { exitCode: 1, error: `Command "${command}" requires a project` };
  }

  if (dispatch.action === "run") {
    // Capture output by intercepting log
    const output: string[] = [];
    const captureDeps = { ...deps, log: (...msg: unknown[]) => output.push(msg.join(" ")) };
    try {
      await dispatch.handler({ ...args, format: "json" }, [], command, dispatch.project);
      return { exitCode: 0, data: output.length ? output.join("\n") : undefined };
    } catch (err) {
      return { exitCode: 1, error: String(err) };
    }
  }

  return { exitCode: 1, error: "Unhandled dispatch action" };
}
```

- [ ] **Step 4: Wire into static-server.ts**

In `handleApiRoute()`:

```typescript
if (req.method === "POST" && urlPath === "/api/command") {
  const body = await parseJsonBody(req);
  if (!body?.command) return json(res, 400, { error: "Missing command field" });
  const result = await executeCommand(body.command, body.args ?? {}, context!.deps);
  return json(res, result.exitCode === 0 ? 200 : 400, result);
}
```

- [ ] **Step 5: Run tests, verify pass**

```bash
cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/serve/ --config configs/vitest.config.ts
```

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/domain/serve/command-executor.ts" "01 - Projects/Flowti CLI/src/domain/serve/static-server.ts" "01 - Projects/Flowti CLI/tests/domain/serve/"
git commit -m "feat(serve): add POST /api/command generic command executor"
```

---

### Task 7: Add /api/shutdown Endpoint

**Files:**
- Modify: `01 - Projects/Flowti CLI/src/domain/serve/static-server.ts`
- Test: `01 - Projects/Flowti CLI/tests/domain/serve/static-server.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
it("POST /api/shutdown closes the server", async () => {
  const handle = await startServer({ port: 0, dir: testDir }, mockDeps);
  const res = await fetch(`${handle.url}/api/shutdown`, { method: "POST" });
  expect(res.status).toBe(200);
  // Server should be closed after shutdown
  await expect(fetch(`${handle.url}/api/version`)).rejects.toThrow();
});
```

- [ ] **Step 2: Implement shutdown endpoint**

```typescript
if (req.method === "POST" && urlPath === "/api/shutdown") {
  json(res, 200, { status: "shutting-down" });
  // Graceful shutdown: close SSE connections, then close server
  if (context?.sseClients) {
    for (const client of context.sseClients) {
      client.end();
    }
  }
  setTimeout(() => server.close(), 100);
  return;
}
```

Note: `server` needs to be accessible in the handler. Pass it via `ServerContext` or closure.

- [ ] **Step 3: Run test, verify pass**

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/domain/serve/static-server.ts" "01 - Projects/Flowti CLI/tests/domain/serve/"
git commit -m "feat(serve): add POST /api/shutdown for graceful server termination"
```

---

### Task 8: Plugin CLI Process Manager

**Context:** New Plugin infrastructure service that spawns the bundled CLI server as a child process, reads the port from stdout, and manages the lifecycle.

**Files:**
- Create: `01 - Projects/Flowti Plugin/src/infrastructure/cli/CliProcessManager.ts`
- Test: `01 - Projects/Flowti Plugin/tests/infrastructure/cli/CliProcessManager.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
describe("CliProcessManager", () => {
  it("spawns CLI server and resolves port from stdout", async () => {
    const manager = new CliProcessManager({ cliBinaryPath: "node", cliArgs: [mockServerScript] });
    const port = await manager.start();
    expect(port).toBeGreaterThan(0);
    await manager.stop();
  });

  it("auto-restarts on process exit", async () => {
    const manager = new CliProcessManager({ cliBinaryPath: "node", cliArgs: [mockServerScript], autoRestart: true });
    await manager.start();
    // Kill the process
    manager.kill();
    // Wait for restart
    await new Promise(resolve => setTimeout(resolve, 1000));
    expect(manager.isRunning()).toBe(true);
    await manager.stop();
  });
});
```

- [ ] **Step 2: Implement CliProcessManager**

```typescript
// src/infrastructure/cli/CliProcessManager.ts
import { spawn, ChildProcess } from "child_process";

export interface CliProcessManagerOptions {
  cliBinaryPath: string;
  cliArgs: string[];
  autoRestart?: boolean;
  secret?: string;
}

export class CliProcessManager {
  private process: ChildProcess | null = null;
  private port: number | null = null;
  private opts: CliProcessManagerOptions;

  constructor(opts: CliProcessManagerOptions) {
    this.opts = opts;
  }

  async start(): Promise<number> {
    return new Promise((resolve, reject) => {
      this.process = spawn(this.opts.cliBinaryPath, this.opts.cliArgs, {
        stdio: ["pipe", "pipe", "pipe"],
      });

      let stdout = "";
      this.process.stdout!.on("data", (chunk: Buffer) => {
        stdout += chunk.toString();
        try {
          const parsed = JSON.parse(stdout);
          if (parsed.port) {
            this.port = parsed.port;
            resolve(parsed.port);
          }
        } catch { /* not complete JSON yet */ }
      });

      this.process.on("error", reject);
      this.process.on("exit", () => {
        if (this.opts.autoRestart && this.port) {
          this.start().catch(() => {});
        }
      });

      setTimeout(() => reject(new Error("CLI server did not start within 10s")), 10000);
    });
  }

  isRunning(): boolean { return this.process !== null && !this.process.killed; }

  kill(): void { this.process?.kill(); }

  async stop(): Promise<void> {
    if (this.port) {
      try {
        await fetch(`http://localhost:${this.port}/api/shutdown`, { method: "POST" });
      } catch { /* server already down */ }
    }
    setTimeout(() => this.process?.kill("SIGKILL"), 5000);
    this.process = null;
    this.port = null;
  }

  getPort(): number | null { return this.port; }
}
```

- [ ] **Step 3: Run test, verify pass**

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/infrastructure/cli/CliProcessManager.ts" "01 - Projects/Flowti Plugin/tests/infrastructure/cli/"
git commit -m "feat(plugin): add CliProcessManager for spawning bundled CLI server"
```

---

### Task 9: Plugin SSE Client

**Files:**
- Create: `01 - Projects/Flowti Plugin/src/infrastructure/cli/SseClient.ts`
- Test: `01 - Projects/Flowti Plugin/tests/infrastructure/cli/SseClient.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
describe("SseClient", () => {
  it("parses SSE event stream and emits typed events", (done) => {
    const client = new SseClient(`http://localhost:${testPort}/events`);
    client.on("agent-action", (data) => {
      expect(data).toHaveProperty("type");
      client.close();
      done();
    });
    client.connect();
  });
});
```

- [ ] **Step 2: Implement SseClient using Node http module**

```typescript
// src/infrastructure/cli/SseClient.ts
import http from "http";

type SseHandler = (data: unknown) => void;

export class SseClient {
  private url: string;
  private handlers = new Map<string, SseHandler[]>();
  private req: http.ClientRequest | null = null;

  constructor(url: string) { this.url = url; }

  on(event: string, handler: SseHandler): void {
    const list = this.handlers.get(event) ?? [];
    list.push(handler);
    this.handlers.set(event, list);
  }

  connect(): void {
    const parsed = new URL(this.url);
    this.req = http.get({
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname,
      headers: { Accept: "text/event-stream" },
    }, (res) => {
      let buffer = "";
      res.on("data", (chunk: Buffer) => {
        buffer += chunk.toString();
        const messages = buffer.split("\n\n");
        buffer = messages.pop() ?? "";
        for (const msg of messages) {
          const { event, data } = this.parseMessage(msg);
          if (event && data) {
            const handlers = this.handlers.get(event) ?? [];
            for (const h of handlers) h(data);
          }
        }
      });
    });
  }

  close(): void { this.req?.destroy(); this.req = null; }

  private parseMessage(raw: string): { event?: string; data?: unknown } {
    let event: string | undefined;
    const dataLines: string[] = [];
    for (const line of raw.split("\n")) {
      if (line.startsWith("event: ")) event = line.slice(7).trim();
      if (line.startsWith("data: ")) dataLines.push(line.slice(6));
    }
    const dataStr = dataLines.join("\n");
    try { return { event, data: JSON.parse(dataStr) }; } catch { return { event, data: dataStr }; }
  }
}
```

- [ ] **Step 3: Run test, verify pass**

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/infrastructure/cli/SseClient.ts" "01 - Projects/Flowti Plugin/tests/infrastructure/cli/"
git commit -m "feat(plugin): add SseClient for consuming CLI SSE event streams"
```

---

### Task 10: Plugin Build — Bundle CLI

**Files:**
- Modify: `01 - Projects/Flowti Plugin/esbuild.config.mjs`
- Modify: `01 - Projects/Flowti Plugin/package.json` (build scripts)

- [ ] **Step 1: Add post-build step to esbuild config**

In `esbuild.config.mjs`, after the main build completes, add:

```javascript
import { copyFileSync, writeFileSync, existsSync } from "fs";
import { execSync } from "child_process";

// After esbuild completes:
const cliBundleSrc = "../../.flowti/bin/main.mjs";
const cliBundleDest = "../../.obsidian/plugins/flowti-ibde/cli/main.mjs";

if (existsSync(cliBundleSrc)) {
  mkdirSync(path.dirname(cliBundleDest), { recursive: true });
  copyFileSync(cliBundleSrc, cliBundleDest);
  const gitHash = execSync("git rev-parse --short HEAD").toString().trim();
  writeFileSync(path.join(path.dirname(cliBundleDest), "cli-version.json"), JSON.stringify({
    timestamp: new Date().toISOString(),
    gitHash,
    protocol: 1,
  }));
}
```

- [ ] **Step 2: Update package.json build script**

```json
{
  "scripts": {
    "build:cli": "cd \"../Flowti CLI\" && node configs/esbuild.config.mjs",
    "build": "npm run build:cli && node esbuild.config.mjs"
  }
}
```

- [ ] **Step 3: Test full build chain**

```bash
cd "01 - Projects/Flowti Plugin" && npm run build
```

Verify: `.obsidian/plugins/flowti-ibde/cli/main.mjs` exists and `cli-version.json` has correct data.

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti Plugin/esbuild.config.mjs" "01 - Projects/Flowti Plugin/package.json"
git commit -m "feat(plugin): bundle CLI into plugin build output with version manifest"
```

---

### Task 11: Wire CliProcessManager into Plugin Lifecycle

**Files:**
- Modify: `01 - Projects/Flowti Plugin/src/main.ts` (phase 3 initialization)

- [ ] **Step 1: Import and initialize CliProcessManager in main.ts**

In the phase 3 registration block:

```typescript
import { CliProcessManager } from "./infrastructure/cli/CliProcessManager.js";
import { SseClient } from "./infrastructure/cli/SseClient.js";

// In onload(), phase 3:
const cliPath = this.app.vault.adapter.getBasePath() + "/.obsidian/plugins/flowti-ibde/cli/main.mjs";
this.cliManager = new CliProcessManager({
  cliBinaryPath: "node",
  cliArgs: [cliPath, "serve", "--port=0", "--json"],
  autoRestart: true,
});

try {
  const port = await this.cliManager.start();
  this.sseClient = new SseClient(`http://localhost:${port}/events`);
  this.sseClient.connect();
  this.cliPort = port;
} catch (err) {
  console.error("[Flowti] Failed to start CLI server:", err);
}
```

- [ ] **Step 2: Add cleanup in onunload()**

```typescript
onunload() {
  this.sseClient?.close();
  this.cliManager?.stop();
  // ... existing cleanup
}
```

- [ ] **Step 3: Build and test in Obsidian**

```bash
cd "01 - Projects/Flowti Plugin" && npm run build
```

Open Obsidian, check console for `[Flowti]` startup messages, verify server port is logged.

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/main.ts"
git commit -m "feat(plugin): spawn CLI server on plugin load, connect SSE on startup"
```

---

## Chunk 3: CLI View Hub (C3)

### Task 12: Register CLI Hub View in Sitemap

**Files:**
- Modify: `01 - Projects/Flowti Plugin/configs/sitemap.json`
- Modify: `01 - Projects/Flowti Plugin/src/domain/hub/types.ts` (add VIEW_TYPE constant)

- [ ] **Step 1: Add VIEW_TYPE constant**

```typescript
// In types.ts
export const VIEW_TYPE_CLI_HUB = "flowti-cli-hub";
```

- [ ] **Step 2: Add hub view to sitemap.json**

```json
"cli-hub": {
  "kind": "hub",
  "label": "Flowti CLI",
  "icon": "terminal",
  "type": "flowti-cli-hub",
  "tabs": [
    { "id": "overview", "label": "CLI Hub", "icon": "home", "handler": "cli:overview" },
    { "id": "terminal", "label": "Terminal", "icon": "terminal-square", "handler": "cli:terminal" },
    { "id": "agents", "label": "Agents", "icon": "users", "handler": "cli:agents" },
    { "id": "projects", "label": "Projects", "icon": "folder-open", "handler": "cli:projects" }
  ]
}
```

- [ ] **Step 3: Add ribbon action to sitemap**

```json
"ribbon": [
  { "action": "view:flowti-cli-hub", "icon": "terminal", "label": "Open Flowti CLI" }
]
```

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti Plugin/configs/sitemap.json" "01 - Projects/Flowti Plugin/src/domain/hub/types.ts"
git commit -m "feat(plugin): register CLI Hub view with 4 tabs in sitemap"
```

---

### Task 13: Implement CLI Hub Tab Handlers

**Files:**
- Create: `01 - Projects/Flowti Plugin/src/infrastructure/handlers/cli-hub-handlers.ts`
- Modify: `01 - Projects/Flowti Plugin/src/infrastructure/handlers/` (registration)

- [ ] **Step 1: Create cli-hub-handlers.ts with overview tab**

```typescript
// src/infrastructure/handlers/cli-hub-handlers.ts
import type { TabHandler, TabContext } from "../plugin-handler-registry.js";

export function registerCliHubHandlers(registry: PluginHandlerRegistry, getCliPort: () => number | null): void {

  registry.tabs.set("cli:overview", (container: HTMLElement, ctx: TabContext) => {
    container.empty();
    const port = getCliPort();
    if (!port) {
      container.createEl("p", { text: "CLI server not running." });
      return;
    }

    const grid = container.createDiv({ cls: "flowti-stat-grid" });

    // Fetch server status
    fetch(`http://localhost:${port}/api/version`)
      .then(res => res.json())
      .then(data => {
        grid.createDiv({ cls: "flowti-stat-card", text: `Protocol: v${data.protocol}` });
        grid.createDiv({ cls: "flowti-stat-card", text: `CLI: ${data.cli}` });
      });

    // Quick actions
    const actions = container.createDiv({ cls: "flowti-actions" });
    for (const [label, command] of [["Health Check", "health"], ["Run Tests", "test"], ["Build", "build"], ["Reports", "reports"]]) {
      const btn = actions.createEl("button", { text: label, cls: "flowti-btn" });
      btn.addEventListener("click", async () => {
        const res = await fetch(`http://localhost:${port}/api/command`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ command, args: { format: "json" } }),
        });
        const result = await res.json();
        // Display result in output area
        const output = container.querySelector(".flowti-output") as HTMLElement ?? container.createDiv({ cls: "flowti-output" });
        output.setText(JSON.stringify(result.data, null, 2));
      });
    }
  });
}
```

- [ ] **Step 2: Add raw terminal tab handler**

```typescript
registry.tabs.set("cli:terminal", (container: HTMLElement, ctx: TabContext) => {
  container.empty();
  const port = getCliPort();
  if (!port) { container.createEl("p", { text: "CLI server not running." }); return; }

  const output = container.createDiv({ cls: "flowti-terminal-output" });
  const inputRow = container.createDiv({ cls: "flowti-terminal-input" });
  const input = inputRow.createEl("input", { type: "text", placeholder: "flowti <command>", cls: "flowti-terminal-cmd" });

  const history: string[] = [];
  let historyIdx = -1;

  input.addEventListener("keydown", async (e) => {
    if (e.key === "Enter" && input.value.trim()) {
      const cmd = input.value.trim();
      history.unshift(cmd);
      historyIdx = -1;

      output.createDiv({ cls: "flowti-terminal-line flowti-cmd", text: `> ${cmd}` });

      const parts = cmd.split(/\s+/);
      const command = parts[0];
      const args: Record<string, string> = {};
      for (const p of parts.slice(1)) {
        if (p.startsWith("--")) {
          const [k, v] = p.slice(2).split("=");
          args[k] = v ?? "true";
        }
      }

      try {
        const res = await fetch(`http://localhost:${port}/api/command`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ command, args }),
        });
        const result = await res.json();
        output.createDiv({ cls: "flowti-terminal-line", text: result.output ?? JSON.stringify(result.data, null, 2) });
      } catch (err) {
        output.createDiv({ cls: "flowti-terminal-line flowti-error", text: String(err) });
      }

      input.value = "";
      output.scrollTop = output.scrollHeight;
    }
    if (e.key === "ArrowUp" && history.length) {
      historyIdx = Math.min(historyIdx + 1, history.length - 1);
      input.value = history[historyIdx];
    }
    if (e.key === "ArrowDown") {
      historyIdx = Math.max(historyIdx - 1, -1);
      input.value = historyIdx >= 0 ? history[historyIdx] : "";
    }
  });
});
```

- [ ] **Step 3: Add agents and projects tab handlers**

Follow the same pattern — fetch data from `/api/world-state` and `/api/command` respectively. Agents tab shows roster with SSE-updated state, Projects tab shows managed projects with action buttons.

- [ ] **Step 4: Register handlers in main.ts or handler registration file**

```typescript
import { registerCliHubHandlers } from "./handlers/cli-hub-handlers.js";
registerCliHubHandlers(handlerRegistry, () => this.cliPort);
```

- [ ] **Step 5: Build and test in Obsidian**

```bash
cd "01 - Projects/Flowti Plugin" && npm run build
```

Open Obsidian → click CLI ribbon icon → verify all 4 tabs render.

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/infrastructure/handlers/cli-hub-handlers.ts"
git commit -m "feat(plugin): implement CLI Hub tab handlers (overview, terminal, agents, projects)"
```

---

## Chunk 4: Skill Execution System (C4)

### Task 14: CLI Skill Session Domain

**Files:**
- Create: `01 - Projects/Flowti CLI/src/domain/skill-session/skill-session-types.ts`
- Create: `01 - Projects/Flowti CLI/src/domain/skill-session/skill-session-store.ts`
- Test: `01 - Projects/Flowti CLI/tests/domain/skill-session/skill-session-store.test.ts`

- [ ] **Step 1: Define skill session types**

```typescript
// src/domain/skill-session/skill-session-types.ts
export type SkillSessionState = "initializing" | "active" | "paused" | "waiting-for-input" | "completing" | "completed" | "errored";

export interface SkillSession {
  id: string;
  skill: string;
  agent: string;
  state: SkillSessionState;
  transcript: TranscriptEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface TranscriptEntry {
  role: "assistant" | "user" | "system";
  type: "text" | "thinking" | "code" | "question" | "error";
  content: string;
  timestamp: string;
}
```

- [ ] **Step 2: Write failing test for session store**

```typescript
it("creates a session and transitions state", () => {
  const store = createSkillSessionStore();
  const session = store.create({ skill: "brainstorming", agent: "Product Owner" });
  expect(session.state).toBe("initializing");

  store.transition(session.id, "active");
  expect(store.get(session.id)!.state).toBe("active");
});
```

- [ ] **Step 3: Implement skill session store**

- [ ] **Step 4: Run test, verify pass**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(skill-session): add session types and in-memory store"
```

---

### Task 15: Skill Execution Endpoints

**Files:**
- Create: `01 - Projects/Flowti CLI/src/domain/serve/skill-handler.ts`
- Modify: `01 - Projects/Flowti CLI/src/domain/serve/static-server.ts` (wire endpoints)
- Test: `01 - Projects/Flowti CLI/tests/domain/serve/skill-handler.test.ts`

- [ ] **Step 1: Write failing test for /api/skill/start**

```typescript
it("POST /api/skill/start creates a session and returns session ID", async () => {
  const res = await fetch(`${serverUrl}/api/skill/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ skill: "brainstorming", sessionId: "test-1" }),
  });
  const data = await res.json();
  expect(data.sessionId).toBe("test-1");
  expect(data.state).toBe("active");
});
```

- [ ] **Step 2: Implement skill handler**

```typescript
// src/domain/serve/skill-handler.ts
export function handleSkillStart(body: { skill: string; sessionId: string }, context: ServerContext): SkillStartResult {
  const session = context.skillSessionStore.create({
    id: body.sessionId,
    skill: body.skill,
    agent: "default",
  });
  // Start LLM execution in background — streams via SSE
  startSkillExecution(session, context);
  return { sessionId: session.id, state: session.state };
}
```

- [ ] **Step 3: Wire endpoints into static-server.ts**

Add routes for `/api/skill/start`, `/api/skill/respond`, `/api/skill/context`, `/api/skill/switch-agent`.

- [ ] **Step 4: Run tests, verify pass**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(serve): add skill session endpoints (start, respond, context, switch-agent)"
```

---

### Task 16: Plugin LLM Companion Sidepanel

**Files:**
- Create: `01 - Projects/Flowti Plugin/src/ui/views/companion-sidepanel.ts`
- Modify: `01 - Projects/Flowti Plugin/configs/sitemap.json` (register view)

- [ ] **Step 1: Add sidepanel view to sitemap**

```json
"companion": {
  "kind": "leaf",
  "label": "Flowti Companion",
  "icon": "bot",
  "type": "flowti-companion",
  "handler": "companion:main"
}
```

- [ ] **Step 2: Implement companion sidepanel view**

The sidepanel extends `SitemapLeafView` and renders:
- Agent switcher dropdown at top
- Skill launcher button
- Mode switcher (document / conversational)
- Scrollable conversation area (markdown-rendered LLM output + user input blocks)
- Input bar at bottom

```typescript
// src/ui/views/companion-sidepanel.ts
export class CompanionSidepanel extends ItemView {
  private conversation: HTMLElement;
  private inputBar: HTMLElement;
  private activeSessionId: string | null = null;

  getViewType(): string { return "flowti-companion"; }
  getDisplayText(): string { return "Flowti Companion"; }

  async onOpen(): Promise<void> {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("flowti-companion");

    // Agent switcher
    const header = contentEl.createDiv({ cls: "flowti-companion-header" });
    this.renderAgentSwitcher(header);
    this.renderSkillLauncher(header);
    this.renderModeSwitcher(header);

    // Conversation area
    this.conversation = contentEl.createDiv({ cls: "flowti-companion-conversation" });

    // Input bar
    this.inputBar = contentEl.createDiv({ cls: "flowti-companion-input" });
    const input = this.inputBar.createEl("textarea", { placeholder: "Type a message...", cls: "flowti-companion-textarea" });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage(input.value);
        input.value = "";
      }
    });

    // Subscribe to SSE skill events
    this.subscribeToSkillEvents();
  }

  private subscribeToSkillEvents(): void {
    // Listen for skill-output, skill-question events from SseClient
    // Render them in the conversation area
  }

  private async sendMessage(text: string): Promise<void> {
    if (!this.activeSessionId) return;
    // Render user message
    this.renderMessage("user", text);
    // Send to CLI
    const port = (this.app as any).plugins.plugins["flowti-ibde"]?.cliPort;
    await fetch(`http://localhost:${port}/api/skill/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: this.activeSessionId, response: text }),
    });
  }

  private renderMessage(role: "user" | "assistant", content: string): void {
    const msg = this.conversation.createDiv({ cls: `flowti-msg flowti-msg-${role}` });
    // Render as markdown for assistant, plain text for user
    if (role === "assistant") {
      MarkdownRenderer.renderMarkdown(content, msg, "", this);
    } else {
      msg.createDiv({ cls: "flowti-msg-user-text", text: content });
    }
    this.conversation.scrollTop = this.conversation.scrollHeight;
  }
}
```

- [ ] **Step 3: Register sidepanel view and add ribbon action**

- [ ] **Step 4: Build and test in Obsidian**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(plugin): add LLM Companion sidepanel with agent switcher and skill launcher"
```

---

### Task 17: Context Awareness — Incremental Diffs

**Files:**
- Create: `01 - Projects/Flowti Plugin/src/infrastructure/cli/ContextDiffEngine.ts`
- Test: `01 - Projects/Flowti Plugin/tests/infrastructure/cli/ContextDiffEngine.test.ts`

- [ ] **Step 1: Write failing test for canvas diff**

```typescript
describe("ContextDiffEngine", () => {
  it("computes canvas diff between two states", () => {
    const engine = new ContextDiffEngine();
    const prev = { nodes: [{ id: "1", text: "A" }], edges: [] };
    const next = { nodes: [{ id: "1", text: "B" }, { id: "2", text: "C" }], edges: [] };
    const diff = engine.diffCanvas(prev, next);
    expect(diff.added).toHaveLength(1);
    expect(diff.modified).toHaveLength(1);
    expect(diff.removed).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Implement ContextDiffEngine**

```typescript
export class ContextDiffEngine {
  private prevState: unknown = null;

  diffCanvas(prev: CanvasState, next: CanvasState): CanvasDiff {
    const prevNodes = new Map(prev.nodes.map(n => [n.id, n]));
    const nextNodes = new Map(next.nodes.map(n => [n.id, n]));

    const added = next.nodes.filter(n => !prevNodes.has(n.id));
    const removed = prev.nodes.filter(n => !nextNodes.has(n.id));
    const modified = next.nodes.filter(n => {
      const p = prevNodes.get(n.id);
      return p && JSON.stringify(p) !== JSON.stringify(n);
    });

    return { added, removed, modified };
  }

  computeHash(state: unknown): string {
    return JSON.stringify(state).length.toString(36); // Simple hash; upgrade to proper hash if needed
  }
}
```

- [ ] **Step 3: Wire into companion sidepanel — watch active file**

Register `vault.on('modify')` listener, debounced, compute diff, send to `/api/skill/context`.

- [ ] **Step 4: Run tests, verify pass**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(plugin): add ContextDiffEngine for incremental canvas/document diffs"
```

---

## Chunk 5: Storybook (C5) + Test Consolidation (A) + RPG Talk Engine (B+)

### Task 18: Storybook Scaffold Command

**Files:**
- Create: `01 - Projects/Flowti CLI/src/domain/make/storybook-scaffold.ts`
- Create: `01 - Projects/Flowti CLI/src/domain/make/templates/storybook/` (framework templates)
- Modify: `01 - Projects/Flowti CLI/src/controller/storybook.controller.ts`
- Test: `01 - Projects/Flowti CLI/tests/domain/make/storybook-scaffold.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
describe("scaffoldStorybookFromSitemap", () => {
  it("generates storybook config and story files from sitemap", () => {
    const sitemap = { pages: { "home": { label: "Home", kind: "page" }, "about": { label: "About", kind: "page" } } };
    const result = scaffoldStorybookFromSitemap(sitemap, "react", mockDeps);
    expect(result.files).toContainEqual(expect.objectContaining({ path: ".storybook/main.ts" }));
    expect(result.files).toContainEqual(expect.objectContaining({ path: "src/stories/Home.stories.tsx" }));
    expect(result.files).toContainEqual(expect.objectContaining({ path: "src/stories/About.stories.tsx" }));
  });
});
```

- [ ] **Step 2: Implement scaffoldStorybookFromSitemap**

Domain function that reads a sitemap, selects framework template, generates file list.

- [ ] **Step 3: Create framework template files**

One file per framework in `src/domain/make/templates/storybook/`:
- `react.ts`, `vue.ts`, `angular.ts`, `lit.ts`, `cli-app.ts`

Each exports: `storybookConfig`, `storyTemplate`, `componentStubTemplate`, `packageDeps`.

- [ ] **Step 4: Register storybook:scaffold command**

- [ ] **Step 5: Run tests, verify pass**

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(storybook): add sitemap-driven scaffold command with 5 framework templates"
```

---

### Task 19: Plugin Right-Click Context Menu for Storybook

**Files:**
- Modify: `01 - Projects/Flowti Plugin/src/main.ts` (register file menu)

- [ ] **Step 1: Register file-menu event**

```typescript
this.registerEvent(
  this.app.workspace.on("file-menu", (menu, file) => {
    if (file.extension === "json") {
      // Read first 500 chars to check for sitemap structure
      this.app.vault.read(file).then(content => {
        try {
          const parsed = JSON.parse(content);
          if (parsed.pages || parsed.views) {
            menu.addItem((item) => {
              item.setTitle("Generate Component Library")
                .setIcon("component")
                .onClick(() => this.openFrameworkPicker(file.path));
            });
          }
        } catch { /* not valid JSON */ }
      });
    }
  })
);
```

- [ ] **Step 2: Implement framework picker modal**

Simple modal with 5 buttons: CLI App, HTML (Lit), Vue, Angular, React. On select, sends `POST /api/command` with `storybook:scaffold`.

- [ ] **Step 3: Test in Obsidian**

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(plugin): right-click sitemap JSON to generate component library"
```

---

### Task 20: Phase A — Test Consolidation

**Files:**
- Review: `01 - Projects/Flowti CLI/tests/domain/agents/` (runner, session store, process infra tests)

- [ ] **Step 1: Identify outstanding test gaps**

```bash
cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/agents/ --config configs/vitest.config.ts --reporter=verbose 2>&1 | grep -E "(FAIL|skip|todo)"
```

- [ ] **Step 2: Fix failing or incomplete tests**

Address each gap found. Focus on agent runner (`buildRunSpec`, `buildClaudeArgs`, `parseAgentOutput`), session store (create, update, append, list), and process infrastructure (`launchAgent`, `checkClaudeInstalled`).

- [ ] **Step 3: Run full test suite**

```bash
cd "01 - Projects/Flowti CLI" && npx vitest run --config configs/vitest.config.ts
```

Expected: all tests pass (fix the 1 currently failing test too if possible).

- [ ] **Step 4: Commit**

```bash
git commit -m "test(agents): consolidate Phase A test suites — runner, session, process"
```

---

### Task 21: Refactor Talk Engine into Domain-Driven Templates

**Context:** Existing `TalkEngine` at `agents/src/systems/talk-engine.ts` is monolithic. Refactor into domain-organized template files while preserving charisma-based weighting, silence-on-response, and staggered startup.

**Files:**
- Modify: `01 - Projects/Flowti CLI/agents/src/systems/talk-engine.ts` → refactor into `talk/` dir
- Create: `01 - Projects/Flowti CLI/agents/src/systems/talk/talk-engine.ts`
- Create: `01 - Projects/Flowti CLI/agents/src/systems/talk/talk-types.ts`
- Create: `01 - Projects/Flowti CLI/agents/src/systems/talk/templates/core.ts`
- Create: `01 - Projects/Flowti CLI/agents/src/systems/talk/templates/engineering.ts`
- Create: `01 - Projects/Flowti CLI/agents/src/systems/talk/templates/design.ts`
- Create: `01 - Projects/Flowti CLI/agents/src/systems/talk/templates/product.ts`
- Create: `01 - Projects/Flowti CLI/agents/src/systems/talk/templates/social.ts`
- Create: `01 - Projects/Flowti CLI/agents/src/systems/talk/templates/index.ts`
- Test: `01 - Projects/Flowti CLI/agents/tests/systems/talk/talk-engine.test.ts`

- [ ] **Step 1: Define template types**

```typescript
// talk/talk-types.ts
export interface TemplateSet {
  domain: string;
  categories: Record<string, WeightedTemplate[]>;
}

export interface WeightedTemplate {
  template: string;
  weight: number;
  category: "thinking" | "social" | "personality" | "filler";
}

export interface TemplateVars {
  task?: string;
  mood_adj?: string;
  role?: string;
  domain?: string;
  domain_opinion?: string;
  domain_fact?: string;
  idle_action?: string;
  persona_quirk?: string;
  nearby_agent?: string;
}
```

- [ ] **Step 2: Extract existing topics into domain template files**

Read the existing `talk-engine.ts` to understand current topic structure. Extract engineering-related topics into `engineering.ts`, design into `design.ts`, etc.

```typescript
// talk/templates/engineering.ts
import type { TemplateSet } from "../talk-types.js";

export const engineeringTemplates: TemplateSet = {
  domain: "engineering",
  categories: {
    thinking: [
      { template: "Let me consider the edge cases for {task}...", weight: 1, category: "thinking" },
      { template: "I wonder if there's a simpler approach to {task}", weight: 1, category: "thinking" },
      { template: "The architecture here is {mood_adj}...", weight: 0.8, category: "thinking" },
    ],
    personality: [
      { template: "{idle_action}... reviewing the test coverage", weight: 1, category: "personality" },
      { template: "You know what's {mood_adj} about {domain}? {domain_fact}", weight: 0.7, category: "personality" },
    ],
  },
};
```

- [ ] **Step 3: Create template registry**

```typescript
// talk/templates/index.ts
import { coreTemplates } from "./core.js";
import { engineeringTemplates } from "./engineering.js";
import { designTemplates } from "./design.js";
import { productTemplates } from "./product.js";
import { socialTemplates } from "./social.js";
import type { TemplateSet } from "../talk-types.js";

export const allTemplateSets: TemplateSet[] = [
  coreTemplates,
  engineeringTemplates,
  designTemplates,
  productTemplates,
  socialTemplates,
];
```

- [ ] **Step 4: Refactor talk-engine.ts to use template resolver**

Move to `talk/talk-engine.ts`. Replace inline topics with template resolution:

```typescript
import { allTemplateSets } from "./templates/index.js";
import type { TemplateVars, WeightedTemplate } from "./talk-types.js";

export function resolveTemplate(agentDomain: string, vars: TemplateVars, category?: string): string {
  // 1. Collect templates: agent domain first, then social, then core
  const domainSet = allTemplateSets.find(s => s.domain === agentDomain);
  const socialSet = allTemplateSets.find(s => s.domain === "social");
  const coreSet = allTemplateSets.find(s => s.domain === "core");

  const candidates: WeightedTemplate[] = [];
  for (const set of [domainSet, socialSet, coreSet].filter(Boolean)) {
    for (const [cat, templates] of Object.entries(set!.categories)) {
      if (!category || cat === category) candidates.push(...templates);
    }
  }

  // 2. Weighted random selection
  const totalWeight = candidates.reduce((sum, t) => sum + t.weight, 0);
  let r = Math.random() * totalWeight;
  for (const t of candidates) {
    r -= t.weight;
    if (r <= 0) return interpolate(t.template, vars);
  }

  return interpolate(candidates[0]?.template ?? "...", vars);
}

function interpolate(template: string, vars: TemplateVars): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key as keyof TemplateVars] ?? "...");
}
```

- [ ] **Step 5: Write tests for template resolution**

```typescript
describe("resolveTemplate", () => {
  it("returns an engineering template for engineering domain", () => {
    const result = resolveTemplate("engineering", { task: "refactoring", mood_adj: "interesting" }, "thinking");
    expect(result).toContain("refactoring");
    expect(result).not.toContain("{task}");
  });

  it("falls back to core templates for unknown domain", () => {
    const result = resolveTemplate("unknown-domain", {}, "filler");
    expect(result).toBeTruthy();
    expect(result).not.toContain("{");
  });
});
```

- [ ] **Step 6: Update imports in brain system**

Update `brain-system.ts` or wherever the old `TalkEngine` was imported to use the new `talk/talk-engine.ts` path.

- [ ] **Step 7: Run tests**

```bash
cd "01 - Projects/Flowti CLI" && npx vitest run agents/tests/ --config configs/vitest.config.ts
```

- [ ] **Step 8: Delete old monolithic talk-engine.ts**

Replace with a re-export from the new location for backwards compatibility if needed.

- [ ] **Step 9: Commit**

```bash
git add "01 - Projects/Flowti CLI/agents/src/systems/talk/"
git commit -m "refactor(talk-engine): domain-driven template architecture with 5 template sets"
```

---

### Task 22: Wait-State Integration in Brain System

**Files:**
- Modify: `01 - Projects/Flowti CLI/agents/src/systems/brain-system.ts` (or wherever agent states are managed)

- [ ] **Step 1: Add waiting state hook**

When agent transitions to `waiting` state, start the talk timer:

```typescript
// In the brain system's state transition handler
if (newState === "waiting") {
  const talkInterval = 3000 + Math.random() * 5000; // 3-8s
  agent.talkTimer = setInterval(() => {
    const vars = buildTemplateVars(agent);
    const line = resolveTemplate(agent.domain, vars);
    agent.bubble.show("speech", line);
  }, talkInterval);
}

// When leaving waiting state (response arrived)
if (oldState === "waiting") {
  clearInterval(agent.talkTimer);
  // Let current bubble finish gracefully (don't force-dismiss)
}
```

- [ ] **Step 2: Build template vars from agent data**

```typescript
function buildTemplateVars(agent: AgentActor): TemplateVars {
  return {
    task: agent.currentTask?.description?.slice(0, 50),
    mood_adj: moodToAdjective(agent.mood),
    role: agent.role,
    domain: agent.domain,
    idle_action: resolveIdleAction(agent.persona),
    nearby_agent: findNearestAgent(agent)?.name,
  };
}
```

- [ ] **Step 3: Test in RPG world**

Build and run `flowti serve`, assign a task to an agent, verify small talk bubbles appear during wait.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(rpg): integrate talk engine with brain system waiting state"
```

---

## Execution Notes

**Critical path:** Task 1 (C0) → Task 2 (C1) → Tasks 3-11 (C2) → Tasks 12-13 (C3) → Tasks 14-17 (C4)

**Parallelizable after C2:**
- C3 (Tasks 12-13) and C4 (Tasks 14-17) can run in parallel
- C5 (Tasks 18-19) can run in parallel with C3/C4
- A (Task 20) can run anytime
- B+ (Tasks 21-22) can run anytime after C2

**Test commands reference:**
```bash
# CLI tests
cd "01 - Projects/Flowti CLI" && npx vitest run --config configs/vitest.config.ts

# Plugin tests
cd "01 - Projects/Flowti Plugin" && npm test

# CLI build
cd "01 - Projects/Flowti CLI" && node configs/esbuild.config.mjs

# Plugin build
cd "01 - Projects/Flowti Plugin" && npm run build

# Run CLI interactively
.\flowti.cmd
```
