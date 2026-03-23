# Generic Process Manager

**Date:** 2026-03-22
**Status:** Approved
**Scope:** Flowti CLI (new domain) + Flowti Plugin (simplification)

## Problem

The Flowti Plugin directly spawns and manages OS processes for Storybook operations (`node:child_process`). This causes CORS errors in Obsidian's sandboxed environment because dynamic imports of Node built-ins are blocked. Meanwhile, the CLI already has `storybook:start`, `storybook:stop`, and `storybook:build` commands but uses in-memory process tracking that doesn't survive across CLI invocations.

The CLI also manages LLM agent processes with a separate PID pattern in `.flowti/var/agents/`. These two process management approaches are fragmented with no unified registry.

## Decision

Introduce a generic process registry in the CLI domain layer. Storybook is the first consumer. LLM agent processes migrate to it later. The plugin becomes a thin initiator that calls CLI commands and displays results.

## Architecture

### Process Registry (Domain Layer)

New module: `src/domain/processes/`

#### Data Model

```typescript
interface ProcessEntry {
  type: string;             // "storybook" | "llm" | future types
  name: string;             // project name or agent name
  pid: number;
  port?: number;            // for services that bind a port
  url?: string;             // for web UIs (storybook URL)
  startedAt: string;        // ISO timestamp (via deps.clock.iso())
  meta?: StorybookMeta | LlmMeta;
}

interface StorybookMeta {
  framework: string;        // "html" | "react" | "vue" | "angular"
  configDir: string;        // absolute path to .storybook dir
}

interface LlmMeta {
  provider: string;         // "anthropic" | "cursor"
  sessionId?: string;
}
```

Persisted as JSON files in `.flowti/var/processes/{type}-{name}.json`. Writes use `writeFileSync` to a `.tmp` sibling then `renameSync` to the final path (atomic on most filesystems). This requires adding `renameSync(oldPath, newPath)` to `IFileSystem` in `types.ts`.

#### Functions (`process-registry.ts`)

Pure domain logic. Liveness checks and kill operations delegate to `deps.pidOps` (the `IPidOps` injectable), never to Node built-ins directly.

**Note:** The existing `CliDeps` already has `proc: IProcess` (covers `exit()`, `argv()`, `cwd()`, `env()`). The new interface uses the field name `pidOps` to avoid collision.

```typescript
type ProcessDeps = Pick<CliDeps, "disk" | "paths" | "clock" | "pidOps">;
```

- `registerProcess(deps, entry)` — write entry to disk (atomic via tmp+rename)
- `unregisterProcess(deps, type, name)` — delete entry file
- `getProcess(deps, type, name)` — read entry, call `deps.pidOps.isPidAlive(pid)`, auto-cleanup if stale, return entry or null
- `listProcesses(deps, type?)` — list all or by type, filter out stale PIDs via liveness
- `killProcess(deps, type, name)` — read entry, call `deps.pidOps.killPid(pid)`, unregister

### IPidOps Interface (Infrastructure Layer)

New injectable interface in `src/infrastructure/types.ts`:

```typescript
interface IPidOps {
  isPidAlive(pid: number): boolean;
  isPortListening(port: number): Promise<boolean>;
  killPid(pid: number): boolean;
}
```

Production implementation in `src/infrastructure/proc.ts` (this file may already exist for process utilities — extend or create):
- `isPidAlive` — `process.kill(pid, 0)` in try/catch (POSIX) or `tasklist /FI` (Windows)
- `isPortListening` — `net.createConnection()` probe with short timeout
- `killPid` — platform-aware: `taskkill /F /T /PID` on Windows, `process.kill(pid, "SIGTERM")` on POSIX

Registered in `src/infrastructure/deps.ts` as `pidOps: IPidOps` on `CliDeps`. Added to `ProcessDeps` ISP subset.

### BackgroundProcess Interface Changes

The existing `BackgroundProcess` in `src/infrastructure/types.ts` needs two additions:

```typescript
interface BackgroundProcess {
  // existing members...
  readonly pid: number;     // NEW — expose child PID for registry
}
```

`NodeShell.spawnBackground()` in `src/infrastructure/shell.ts` gets a new option:

```typescript
interface SpawnBackgroundOptions {
  // existing options...
  detached?: boolean;       // NEW — child survives parent exit (+ unref)
}
```

When `detached: true`, the implementation sets `detached: true` on `child_process.spawn()` options. Stdio remains `["ignore", "pipe", "pipe"]` so the CLI can stream output while it runs. After the CLI detects "ready" and registers the PID, it calls `child.unref()` and lets the event loop drain — the child keeps running because it's detached. The `BackgroundProcess.kill()` semantics remain the same (sends SIGTERM/taskkill), but `running` for detached processes reflects actual state via `deps.pidOps.isPidAlive(pid)` rather than relying on the `close` event (which fires when the CLI's pipe references are dropped, not when the child actually exits).

**Important:** `child.unref()` is called *after* the ready-wait completes, not immediately after spawn. This ensures stdio pipes remain active for output streaming during startup. The sequence is: spawn → stream output → detect ready → register PID → unref → CLI exits.

### CLI Commands (Refactored)

#### `storybook:start`

1. Check registry via `getProcess(deps, "storybook", project)` — if alive, return `{ started: false, error: "already running", url }`
2. Also check `deps.pidOps.isPortListening(6006)` as a safety net against unregistered instances
3. Spawn via `shell.spawnBackground()` with `detached: true` so child outlives CLI
4. Stream output lines to stdout (plugin receives via `onOutput` callback)
5. Wait for "ready" pattern (existing 120s timeout)
6. Extract URL from output
7. `registerProcess(deps, { type: "storybook", name: project, pid, port: 6006, url, startedAt: deps.clock.iso() })`
8. Return `{ started: true, url, pid }`
9. CLI process exits — storybook child keeps running

#### `storybook:stop`

1. `getProcess(deps, "storybook", project)` — read PID from registry
2. If not found, attempt port-based cleanup as fallback via `deps.pidOps.isPortListening(6006)` + port kill
3. `killProcess(deps, "storybook", project)` — delegates to `deps.pidOps.killPid(pid)`, then unregisters
4. Return `{ stopped: true }`

#### `storybook:build`

No process persistence needed (one-shot). Routes through `runAsync` as before. Plugin calls via `runFlowtiCli` instead of directly.

#### `process:list` (new)

Lists all registered processes with type, name, pid, url, uptime. Auto-filters stale entries via liveness checks.

#### `storybook-browser.ts` cleanup

The module-level `activeProcess` singleton and `isStorybookRunning()` / `setActiveProcess()` / `stopStorybook()` get replaced by registry calls. These functions either become thin wrappers around registry queries or are removed entirely.

### Plugin Simplification

#### `vault-project-service.ts`

All three methods become thin `runFlowtiCli` wrappers. Structured results (url, pid) are extracted from CLI output using the existing `getHealth` pattern: collect lines via `onOutput`, parse JSON from collected lines after `runFlowtiCli` resolves.

```typescript
async startStorybook(project, onOutput) {
  const lines: string[] = [];
  const result = await runFlowtiCli(vaultBase,
    ["storybook:start", `--project=${project}`, "--format=json"],
    (line) => { lines.push(line); onOutput?.(line); });
  if (!result.ok) return { ok: false, error: result.error };
  try {
    const parsed = JSON.parse(lines.join(""));
    return { ok: true, url: parsed.url, pid: parsed.pid };
  } catch {
    return { ok: true }; // started but couldn't parse details
  }
}

async stopStorybook(project) {
  return runFlowtiCli(vaultBase, ["storybook:stop", `--project=${project}`]);
}

async buildStorybook(project, onOutput) {
  return runFlowtiCli(vaultBase, ["storybook:build", `--project=${project}`], onOutput);
}
```

**Removed from plugin:**
- `import { spawn } from "node:child_process"` — no longer needed
- `runningProcesses` Map — CLI owns process state via registry
- Manual PID tracking, `taskkill`, port cleanup logic in `stopStorybook`
- `shellQuote`, `findStorybookDir` imports (CLI handles internally)

**Retained:** `previewStorybook` HTTP server stays in plugin (in-process server, different pattern).

#### `project-storybook-handler.ts`

The `storybook-start` event handler simplifies from a 90-second poll loop with URL-watching regex to:

1. `startWork("Starting Storybook...")`
2. `await projectService.startStorybook(project, appendLog)` — output streams in real-time via `onOutput`
3. Result comes back with `{ ok, url, error }` when CLI detects "ready" or times out
4. `endWork(result)`, refresh project

**Removed behaviors:**
- URL detection regex on output lines (CLI extracts URL internally)
- 3-second interval `getProject` polling for process death detection (registry handles this)
- 90-second deadline loop (CLI's 120s timeout is authoritative)
- Manual `resolveStorybook` promise resolution pattern

**Preserved behaviors:**
- `startWork()` called before the `await` (spinner shows immediately)
- `appendLog()` pushes reactive Lit updates on each output line (UI never blocks)
- `AbortSignal` check prevents element updates after navigation

### Navigation Edge Case

User starts storybook, navigates away, comes back.

**On entering project detail view:** the existing `getProject` / `listProjects` enriches the storybook status from the process registry (via a `storybook:status` query or by the CLI reading the registry during project resolution) instead of the plugin's in-memory map. The registry's `getProcess` checks PID liveness + port status and returns actual state.

**When AbortSignal fires mid-start:**
- `onOutput` callbacks silently stop updating the element (existing pattern)
- CLI process and storybook child keep running (detached)
- Registry entry gets written when CLI detects "ready", even if nobody's listening on the plugin side
- User returns → status query picks up the running instance

**When storybook crashes while nobody's watching:**
- Registry still has the entry, but `getProcess` calls `deps.pidOps.isPidAlive(pid)`
- PID is dead → auto-cleanup removes stale entry, returns null
- UI shows "not running" — no ghost state

### Concurrent Invocation

If two CLI invocations race on `storybook:start` (e.g., plugin fires start while user runs CLI manually), both could pass the registry check. The port-based liveness check in step 2 acts as a secondary guard — if port 6006 is already bound, the second invocation returns an error. This is a best-effort safeguard, not a lock. Documented as a known limitation.

## File Map

### CLI (new/modified)

| File | Status | Purpose |
|------|--------|---------|
| `src/domain/processes/process-registry.ts` | New | Register, query, kill processes (pure domain, deps-injected) |
| `src/infrastructure/types.ts` | Modified | Add `IPidOps` interface, add `pid` to `BackgroundProcess`, add `renameSync` to `IFileSystem` |
| `src/infrastructure/proc.ts` | New/Modified | `IPidOps` production implementation |
| `src/infrastructure/filesystem.ts` | Modified | Implement `renameSync` on `NodeFileSystem` |
| `src/infrastructure/deps.ts` | Modified | Register `pidOps: IPidOps` on `CliDeps`, export `ProcessDeps` ISP subset |
| `src/infrastructure/shell.ts` | Modified | Add `detached` option to `spawnBackground`, expose `pid` on result |
| `src/controller/process.controller.ts` | New | `process:list` command |
| `src/controller/storybook.controller.ts` | Modified | Wire start/stop to registry, detach child |
| `src/domain/make/component/storybook-service.ts` | Modified | Use registry instead of in-memory singleton |
| `src/domain/make/component/storybook-browser.ts` | Modified | Replace activeProcess with registry calls |
| `src/ui/renderers/process-renderers.ts` | New | Renderer for `process:list` output |

### Plugin (modified)

| File | Status | Purpose |
|------|--------|---------|
| `src/infrastructure/projects/vault-project-service.ts` | Modified | Replace spawn with runFlowtiCli calls, remove runningProcesses Map |
| `src/infrastructure/handlers/project-storybook-handler.ts` | Modified | Remove poll loop, simplify to await |

### Tests

| File | Status | Purpose |
|------|--------|---------|
| `tests/domain/processes/process-registry.test.ts` | New | Registry CRUD, liveness mock, stale cleanup, atomic write |
| `tests/controller/process.controller.test.ts` | New | process:list command handler |
| `tests/controller/storybook.controller.test.ts` | Modified | Verify registry integration, detached spawn |
| `tests/domain/make/component/storybook-service.test.ts` | Modified | Registry mocks instead of activeProcess |
| `tests/domain/make/component/storybook-browser.test.ts` | Modified | Update for registry-based state instead of module singleton |

## Future: LLM Process Migration

The existing agent PID pattern in `.flowti/var/agents/{name}.pid` can migrate to the generic registry as `{ type: "llm", name: agentName, meta: { provider, sessionId } }`. The `process-pool.ts` concurrency limiter stays as a higher-level orchestrator on top of the registry.
