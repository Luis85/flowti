# Agent Shell — Provider-Agnostic Execution Layer

**Date**: 2026-03-15
**Status**: Approved
**Scope**: Consolidate agent CLI execution behind a single `IAgentShell` infrastructure singleton, supporting Claude and Cursor (future)

## Problem

Agent CLI invocations are scattered across 4 files (`agents-interact-menu.ts`, `roster-task-menu.ts`, `agents-run-menu.ts`, `agent-process.ts`). Each builds CLI args, spawns processes, parses stream-json, manages state, writes inbox notes, and handles background completion independently. This means:

1. Adding a new provider (Cursor) requires changes in 4+ files
2. Lifecycle logic (busy/idle state, inbox notes, background completion) is duplicated
3. Menus are bloated with infrastructure concerns — 100+ lines of process management mixed with UX code
4. No way to reconnect to a running agent from the detail page

## Decision

Introduce `IAgentShell` as an infrastructure singleton in `CliDeps`. Two methods (`talk`, `dispatch`) cover all use cases. The shell owns the full lifecycle: provider resolution, process spawning, stream parsing, state management, inbox notes, and active dispatch tracking.

### Design Choices

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Interface shape | Two methods: `talk` + `dispatch` | Covers all use cases. Clarification is `talk` with a different prompt. |
| Provider resolution | Global default + per-agent override | Flexible without over-engineering. `AgentsConfig.provider` + `AgentAIConfig.provider` |
| Lifecycle ownership | Shell owns everything | Menus become thin (2-3 lines). No duplicated state/inbox logic. |
| Pattern | Infrastructure singleton via `CliDeps` | Consistent with `IShell`, `IFileSystem`. |
| Active dispatch registry | `Map<string, DispatchHandle>` in shell | Enables agent detail page to reconnect to live output |
| Event observability | `onEvent` callback on both `TalkSession` and `DispatchHandle` | Callers subscribe for UX rendering — spinner, thinking, live output |

## Interface

### `IAgentShell`

```typescript
interface IAgentShell {
  /** Synchronous conversation turn — returns when agent responds or user detaches */
  talk(agent: AgentSummary, prompt: string, opts?: TalkOptions): TalkSession;
  /** Background execution — agent works on brief, leaves inbox note when done */
  dispatch(agent: AgentSummary, briefPath: string, task: string, opts?: DispatchOptions): DispatchHandle;
  /** Get active dispatch for an agent (for live monitoring from detail page) */
  getActiveDispatch(agentName: string): DispatchHandle | null;
}
```

### `TalkSession`

```typescript
interface TalkSession {
  /** Subscribe to live stream events (thinking, text, tool use) */
  onEvent(callback: (event: AgentStreamEvent) => void): () => void;
  /** Resolves when agent responds. Null if detached or error. */
  result: Promise<TalkResult | null>;
  /** Detach — agent continues in background, promotes to dispatch, leaves inbox note */
  detach(): void;
}

interface TalkResult {
  response: AgentResponse;
  thinking: string;
  detached: boolean;
}

interface TalkOptions {
  /** Override thinking display mode for this call */
  thinkingDisplay?: "full" | "indicator" | "hidden";
  /** Character identity for prompt building */
  character?: AgentCharacter;
  /** Idle timeout in ms — auto-detaches if agent goes silent. Default 120_000. */
  idleTimeoutMs?: number;
}
```

### `DispatchHandle`

```typescript
interface DispatchHandle {
  /** Subscribe to live stream events */
  onEvent(callback: (event: AgentStreamEvent) => void): () => void;
  /** Session ID for tracking */
  sessionId: string;
  /** Agent name */
  agentName: string;
  /** Task description */
  task: string;
  /** Whether the process is still running */
  readonly running: boolean;
  /** Stop the agent process */
  stop(): void;
}

interface DispatchOptions {
  /** Iteration directory for session persistence */
  iterDir?: string;
  /** Iteration number for session metadata */
  iterationNumber?: number;
}
```

## Provider Resolution

`ProviderConfig` is defined in `src/infrastructure/types.ts` alongside `IAgentShell`. `resolveProvider` is an **exported pure function** in `agent-shell.ts` — independently testable without mocking the shell.

```typescript
// types.ts
interface ProviderConfig {
  binary: string;
  streamArgs: string[];
  textArgs: string[];
}

// agent-shell.ts (exported, pure)
export function resolveProvider(globalDefault?: string, agentProvider?: string): ProviderConfig {
  const provider = agentProvider ?? globalDefault ?? "anthropic";
  switch (provider) {
    case "anthropic": return {
      binary: "claude",
      streamArgs: ["-p", "--output-format", "stream-json", "--verbose"],
      textArgs: ["--print"],
    };
    case "cursor": return {
      binary: "cursor",
      streamArgs: ["--print", "--json"],
      textArgs: ["--print"],
    };
    default: return {
      binary: provider,
      streamArgs: ["-p"],
      textArgs: ["--print"],
    };
  }
}
```

Global default: `AgentsConfig.provider` (new field in vault config).
Per-agent override: `AgentAIConfig.provider` (existing field).

Adding a provider = adding one `case` branch. The `default` fallback treats the provider string as the binary name.

Note: Several domain files (`agent-state.ts`, `agent-store.ts`, `brief-store.ts`, `agent-session.ts`) already have `import type` from infrastructure for `CliDeps` subsets. This is pre-existing tech debt (compile-time only, erased at runtime). Not addressed in this spec.

## Internal Architecture

### Bootstrap / Factory

The shell is created during `CliDeps` initialization. It needs the other deps (disk, paths, clock, shell) plus config:

```typescript
// In deps.ts — createDefaultDeps() or equivalent
const baseDeps = { disk, paths, clock, shell, input, log, warn };
const agentShell = createAgentShell(baseDeps, cliConfig.agents, VAULT_ROOT);
return { ...baseDeps, agentShell };
```

`createAgentShell` is a factory function exported from `agent-shell.ts`. It returns an `IAgentShell` instance that closes over the base deps and config. No circular dependency — it receives deps as parameters, not the full `CliDeps`.

### `talk()` flow

```
talk(agent, prompt, opts)
  → resolveProvider(globalDefault, agent.ai?.provider)
  → write prompt to temp file
  → spawn: `${binary} ${streamArgs.join(" ")} < ${tempFile}`
  → create TalkSession with event emitter
  → onOutput: parseStreamLine → emit to subscribers + collect text/thinking
  → rolling idle timeout (opts.idleTimeoutMs ?? 120_000) — resets on each output event
  → race: waitForExit vs detach signal vs idle timeout
  → if completed: parse response via parseAgentResponse, return TalkResult, cleanup temp
  → if completed with empty text: return null
  → if non-zero exit: return null (partial text discarded)
  → if detached/idle: promote to dispatch, set state busy
  → cleanup temp file in finally block (on-crash cleanup: temp dir pattern not in scope)
```

### `dispatch()` flow

```
dispatch(agent, briefPath, task, opts)
  → resolveProvider(globalDefault, agent.ai?.provider)
  → spawn: `${binary} ${streamArgs.join(" ")} < ${briefPath}`
  → SYNCHRONOUSLY register in activeDispatches[agent.name] (before any async handlers)
  → set agent state → "busy"
  → if opts.iterDir: createSession() from agent-session.ts
  → create DispatchHandle with event emitter
  → onOutput: parseStreamLine → emit to subscribers + collect
  → on exit: write inbox note, if session: appendStructuredOutput + updateSessionStatus, set state → "idle", remove from registry
  → return handle
```

### `getActiveDispatch()` flow

```
getActiveDispatch(agentName)
  → return activeDispatches.get(agentName) ?? null
```

Late subscribers see new events only (no replay). This is sufficient for the detail page — you see what the agent is doing now, not what it did before you looked.

### Talk-to-dispatch promotion

When `detach()` is called on a `TalkSession`:
1. The dispatch handle is registered **synchronously** in `activeDispatches` before any async exit handlers can fire — prevents race between registration and process exit
2. The process keeps running (not killed)
3. Agent state → `"busy"`
4. Background exit handler (attached after registration): inbox note + state → `"idle"` + remove from registry
5. `TalkResult` resolves with `{ detached: true, response: { message: "", status: "message" }, thinking: "" }`
6. Temp file cleanup deferred to background exit handler

### State management

The shell directly calls `readAgentState` / `writeAgentState` from `agent-state.ts`:
- `dispatch()` start → `status: "busy"`
- `dispatch()` exit → `status: "idle"`
- `talk()` detach → `status: "busy"` (via promotion)
- `recordInteraction` preserves `"busy"` (already implemented)

### Inbox notes

On background completion (dispatch exit or detached talk exit), the shell:
1. Accumulates text from stream events
2. Parses response via `parseAgentResponse`
3. Writes markdown to `00 - Connectivity/inbox/` with frontmatter (`type: agent-note`, `from`, `persona`, `date`, `task`, `status`)

### Process timeout

Uses `processTimeoutMs` from `AgentsConfig` (default 3,600,000ms / 1 hour). Applied to `waitForExit`.

## Menu Simplification

### `agents-interact-menu.ts` — before (100+ lines of process code)

```typescript
// Build args, spawn, create spinner, race waitForExit vs detach,
// handle muting, background completion, inbox, state...
```

### `agents-interact-menu.ts` — after (~10 lines)

```typescript
const session = deps.agentShell.talk(agent, content, { character, thinkingDisplay });
const spinner = createSpinner(who, deps.log, "Enter to step away");
session.onEvent((event) => {
  if (event.kind === "thinking") renderThinkingPreview(event, who, deps);
  if (event.kind !== "thinking") spinner.stop();
});
// Detach on Enter
deps.input.ask("").then(() => { spinner.stop(); session.detach(); });
const result = await session.result;
spinner.stop();
```

### `roster-task-menu.ts` — after

```typescript
// Clarification chat
const session = deps.agentShell.talk(agent, clarificationPrompt);
const result = await session.result;
// Launch background work
deps.agentShell.dispatch(agent, briefPath, task);
deps.log(`  ${who} is working on the task.`);
```

### `agents-run-menu.ts` — after

```typescript
const handle = deps.agentShell.dispatch(agent, briefPath, task, { iterDir, iterationNumber });
handle.onEvent((event) => renderStreamEvent(event, deps.log, thinkingDisplay));
```

### Agent detail page — live monitoring

```typescript
const handle = deps.agentShell.getActiveDispatch(agent.name);
if (handle) {
  deps.log(`  ${who} is working on: ${handle.task}`);
  handle.onEvent((event) => renderStreamEvent(event, deps.log, "indicator"));
}
```

## Config Changes

### `AgentsConfig` (vault-level)

```typescript
interface AgentsConfig {
  // ...existing fields...
  provider?: string;  // NEW — global default provider ("anthropic", "cursor", etc.)
}
```

### `AgentAIConfig` (per-agent)

Already has `provider?: string` — used as override.

## Files

### Created (1)
| File | Purpose |
|------|---------|
| `src/infrastructure/agent-shell.ts` | `IAgentShell` implementation — full lifecycle |

### Modified (8)
| File | Change |
|------|--------|
| `src/infrastructure/types.ts` | Add `IAgentShell`, `TalkSession`, `TalkResult`, `DispatchHandle`, `ProviderConfig`, `TalkOptions`, `DispatchOptions` |
| `src/infrastructure/types-config.ts` | Add `provider?: string` to `AgentsConfig` |
| `src/infrastructure/deps.ts` | Add `agentShell: IAgentShell` to `CliDeps`. Add `AgentMenuDeps = Pick<CliDeps, "disk" | "paths" | "clock" | "input" | "log" | "agentShell">` (replaces `ShellMenuDeps` in agent menus — they no longer need `shell` directly). Update `createDefaultDeps` to construct shell via factory. |
| `src/main.ts` | Pass `cliConfig.agents` and `VAULT_ROOT` to `createAgentShell` during deps bootstrap |
| `src/ui/menus/agents-interact-menu.ts` | Replace process/spinner/detach/inbox with `deps.agentShell.talk()`. Use `AgentMenuDeps`. Task assignment, suggested tasks, brief generation remain. |
| `src/ui/menus/agents-run-menu.ts` | Replace `spawnAndStream` with `deps.agentShell.dispatch()`. Use `AgentMenuDeps`. |
| `src/ui/menus/roster-task-menu.ts` | Replace clarify/launch with `shell.talk()` + `shell.dispatch()`. Use `AgentMenuDeps`. Task selection, brief generation, enqueue-if-busy logic remain. |
| `src/ui/handlers/extensibility-handlers.ts` | Agent detail: add live output via `getActiveDispatch()` |

### Deleted (2)
| File | Reason |
|------|--------|
| `src/infrastructure/agent-process.ts` | Absorbed into agent-shell |
| `src/domain/agents/agent-runner.ts` | Absorbed into agent-shell |

### Not changed
- `agent-stream.ts` — pure domain parser, imported by shell
- `agent-conversation.ts` — prompt builders, used by menus
- `agent-conversation-store.ts` — conversation persistence, used by menus
- `agent-session.ts` — session persistence, called by shell internally
- `agent-state.ts` — state management, called by shell internally
- `brief-store.ts` — brief generation, used by menus
- `sitemap.json` — no new pages

### Not in scope
- Cursor CLI implementation — `case "cursor"` added but flags TBD
- Agent-to-agent delegation — separate feature
- Event replay on reconnect — late subscribers get new events only
- Agent queue system — enqueue logic stays in roster-task-menu

## Testing

### `agent-shell.test.ts` (new)

**Provider resolution (pure function, isolated tests):**
- Defaults to anthropic when no config
- Uses agent override over global default
- Unknown provider uses provider string as binary name
- Anthropic produces claude binary with stream-json args
- Cursor produces cursor binary

**talk():**
- Spawns correct binary with stream-json args
- Emits stream events via onEvent
- Result contains response + thinking
- Returns null on empty response (no text events)
- Returns null on non-zero exit code
- Idle timeout auto-detaches after silence (configurable via opts)
- Idle timer resets on each output event
- Detach promotes to dispatch, sets state busy
- Detach writes inbox note on background completion
- Cleanup: temp file deleted in finally (both success and error)

**dispatch():**
- Registers in activeDispatches synchronously before async handlers
- Sets state busy on start
- Sets state idle on exit
- Writes inbox note on exit
- Creates session when iterDir provided
- Appends structured output to session on exit
- Removes from activeDispatches on exit
- handle.running reflects process state

**getActiveDispatch():**
- Returns handle for running agent
- Returns null for idle agent
- Returns null during cleanup (after removal from registry)

**Edge cases:**
- `talk()` with process crash (non-zero exit)
- `detach()` called after process already exited
- Multiple concurrent dispatches for different agents
- `stop()` called on already-stopped dispatch
- `onEvent` subscriber throws — does not crash shell (errors caught per-subscriber)

### Updated test files
- `agents-interact-menu.test.ts` — mock `deps.agentShell.talk()` instead of `spawnBackground`
- `agents-run-menu.test.ts` — mock `deps.agentShell.dispatch()` instead of process spawning
- `roster-task-menu.test.ts` — mock `deps.agentShell.talk()` + `dispatch()`

### Deleted test files
- `agent-process.test.ts` — absorbed into agent-shell tests
- `agent-runner.test.ts` — absorbed into agent-shell tests
