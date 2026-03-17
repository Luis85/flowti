# Agent World Stability & Performance — Design Spec

**Date:** 2026-03-17
**Status:** Draft
**Workspace:** `ws-plan-excalibu-k6e2` (branch `feat/iter-5/excalibur-rpg-phase-b3`)

## Problem

The Agent World dashboard crashes (browser tab killed by Chrome) when multiple agents have their LLM processes running simultaneously. Each `claude` CLI subprocess consumes ~500MB+. Two or more running concurrently exhaust system memory, causing Chrome to kill the renderer process.

Secondary issues:
- No concurrency limit on spawned `claude` processes
- No process cancellation or lifecycle management
- Messages silently dropped when worker doesn't exist at send time
- Browser has zero protection against rapid SSE-triggered re-renders
- Conversation DOM grows unbounded

## Goals

- Support true parallelism (multiple agents thinking simultaneously) within resource limits
- Prevent browser crashes under any realistic usage pattern
- Provide user-visible feedback when agents are queued or waiting
- Maintain existing architecture patterns (DI, domain purity, zero runtime deps)

## Non-Goals

- Worker hibernation / context restore (future enhancement)
- API-direct LLM calls (breaks provider-agnostic design)
- Virtual scrolling for conversations (DOM cap is sufficient)

---

## Design

### 1. Process Pool (`src/domain/agents/process-pool.ts`)

New pure domain module. Sits between `worker-manager.ts` and `agent-process-runner.ts`.

**Responsibilities:**
- Enforce a `maxConcurrent` limit (default 2, configurable via `AgentsConfig.maxConcurrent`)
- Track active `AgentProcess` instances in a `Map<string, AgentProcess>` keyed by agent name
- When a slot is available: spawn immediately via the injected `IAgentProcessRunner`
- When full: enqueue the request, return a deferred `AgentProcess` that resolves when a slot opens
- When a process completes (result resolves or rejects): reclaim the slot, dequeue next
- Expose `killAll()` for server shutdown (also drains and rejects queued entries) and `cancel(agentName)` for targeted cleanup
- Auto-kill processes that exceed `processTimeoutMs` (from existing config, default 3,600s)

**Domain purity:** The pool must not import `setTimeout` directly. It receives a `timer` dependency via injection:
```ts
interface PoolTimer {
  set(callback: () => void, ms: number): unknown;
  clear(handle: unknown): void;
}
```
This follows the same pattern as `IClock` used elsewhere in the codebase.

**Interface:**

```ts
interface AcquireResult {
  readonly process: AgentProcess;
  readonly queued: boolean;  // true if waiting for a slot, false if immediate
}

interface IProcessPool {
  acquire(agent: AgentSummary, prompt: string, tools: readonly string[]): AcquireResult;
  release(agentName: string): void;
  cancel(agentName: string): void;   // cancel a queued or active agent
  killAll(): void;                    // kills active processes AND drains/rejects queue
  getQueueDepth(): number;
  getActiveCount(): number;
}
```

The `queued` boolean in `AcquireResult` tells the caller whether the process was deferred, so `worker-manager` can set the correct state (`"queued"` vs `"thinking"`).

**Key behavior:** If agent A already has an active process and a new message arrives for A, the message queues in `worker-manager` via the existing `messageQueue`. The pool only limits cross-agent concurrency. One process per agent at a time is already enforced by the worker's state machine (`idle` → `thinking` → `working` → `idle`).

**Deferred process proxy contract:** When the pool is full, `acquire()` returns a proxy `AgentProcess`:
- **`onEvent(callback)`:** Stores the callback in a buffer. When a slot opens and the real process starts, all buffered callbacks are forwarded to the real `process.onEvent()`. The returned unsubscribe function removes from the buffer if still queued, or proxies to the real unsubscribe if the process has started.
- **`result`:** A promise that chains: wait for slot → spawn real process → await real `result`. Rejects if `cancel()` or `killAll()` is called while queued.
- **`kill()`:** If still queued, removes from queue and rejects `result`. If active, delegates to real `process.kill()`.

**Slot reclamation:** The pool wraps each `AgentProcess.result` promise to auto-call `release()` on completion. The worker-manager also calls `release()` explicitly as defense-in-depth.

**Stale process reaping:** The pool registers a timeout (via injected `PoolTimer`) per active process using `processTimeoutMs`. If exceeded, the pool calls `process.kill()` and releases the slot.

**Edge cases:**
- **`killAll()` with queued entries:** Kills all active processes AND rejects all queued promises with an `Error("Pool shutdown")`. Workers transition to `"stopped"`.
- **`cancel(agentName)` while queued:** Removes the agent from the queue, rejects the deferred promise. Worker transitions to `"idle"`.
- **`cancel(agentName)` while active:** Calls `process.kill()`, releases the slot.

### 2. Config Change (`src/infrastructure/types-config.ts`)

Add `maxConcurrent` to `AgentsConfig`:

```ts
export interface AgentsConfig {
  dir?: string;
  roster?: string[];
  autonomous?: boolean;
  claudeSync?: boolean;
  skillMap?: Record<string, string[]>;
  thinkingDisplay?: "full" | "indicator" | "hidden";
  processTimeoutMs?: number;
  provider?: string;
  maxConcurrent?: number;  // NEW — max simultaneous LLM processes (default 2)
}
```

### 3. Worker-Manager Changes (`src/infrastructure/worker-manager.ts`)

Minimal integration with the process pool.

**Changes:**
- `createWorkerManager()` gains a `pool: IProcessPool` parameter (injected alongside `processRunner`)
- `processLlmMessage()` replaces `processRunner.spawn(...)` with `pool.acquire(...)`
- Uses `AcquireResult.queued` to decide state: if `queued` is true, set worker to `"queued"` first; if false, skip directly to `"thinking"`
- On process completion, call `pool.release(worker.name)` to free the slot
- When `workerManager.stop(agentName)` is called, also call `pool.cancel(agentName)` to clean up any queued or active pool entry

**New worker state flow:**

```
idle → queued → thinking → working → idle
         │                            ▲
         └──── (slot opens) ──────────┘  (via thinking → working → idle)
```

`"queued"` is only entered when the pool is full. If a slot is immediately available, it skips to `"thinking"`.

**World state emission:** `"queued"` state emitted via `setWorkerState()` → SSE → browser.

### 4. Worker State Type Change (`src/domain/agents/worker-types.ts`)

Add `"queued"` to the existing `WorkerState` union. All existing states are preserved:

```ts
export type WorkerState = "spawning" | "idle" | "queued" | "reacting" | "thinking" | "working" | "waiting" | "stopped";
```

### 5. World State Status Map (`src/infrastructure/world-state-manager.ts`)

Add `"queued"` entry to `STATUS_MAP`:

```ts
"queued": () => ({ state: "waiting", currentAction: "queued" }),
```

### 6. Silent Message Drop Fix (`src/domain/serve/static-server.ts`)

The `/api/agent/send` endpoint currently calls `workerManager.send()` without ensuring the worker exists. Messages for unspawned agents are silently dropped.

Fix: add worker-exists check matching the `/api/agent/wake` pattern:

```ts
let worker = ctx.workerManager.getWorker(name);
if (!worker) worker = ctx.workerManager.spawn(name);
if (!worker) { json(404, { error: "Agent not found" }); return; }
```

### 7. Graceful Shutdown (`src/domain/serve/dashboard-service.ts`)

Call `pool.killAll()` before closing the HTTP server in `stopDashboard()`. This sends `taskkill /T /F` (Windows) or `SIGTERM` (Unix) to all active processes AND rejects all queued entries, preventing orphaned subprocesses. The existing `workerManager.stopAll()` call remains — it handles worker state while `pool.killAll()` handles OS processes.

### 8. RAF-Batched Store Notifications (`agents/src/store/dashboard-store.ts`)

Two changes to this file:

**8a. RAF-coalesced `notify()`:**

Replace the immediate `dispatchEvent()` in `notify()` with a `requestAnimationFrame` coalesce. Multiple `notify()` calls within the same frame collapse into a single `state-changed` event.

```ts
private rafPending = false;

private notify(): void {
  if (this.batchDepth > 0) { this.batchDirty = true; return; }
  if (this.rafPending) return;
  this.rafPending = true;
  requestAnimationFrame(() => {
    this.rafPending = false;
    this.dispatchEvent(new Event("state-changed"));
  });
}
```

The existing `beginBatch()`/`endBatch()` mechanism in the `postframe` hook is unaffected — this is an additional coalescing layer for unbatched paths (SSE handlers, API responses).

**8b. Add `"queued"` to `LlmStatus` type:**

```ts
export interface LlmStatus {
  readonly state: "idle" | "queued" | "thinking" | "error";
  readonly since: number;
}
```

### 9. Conversation DOM Cap (`agents/src/ui/panel-talk.ts`)

Two changes to this file:

**9a. DOM cap:** Render only the 50 most recent turns. The full history stays in the store — only the visible DOM is limited. The thread container already has `overflow-y: auto`, so no layout changes needed.

```ts
private renderThread() {
  const visible = this.conversation.slice(-50);
  // ... render visible turns
}
```

**9b. Queued thinking indicator:** When the agent's LLM status is `"queued"`, the thinking indicator shows "Waiting for available slot..." instead of the rotating thinking phrases. The `renderLlmBadge()` method also gains the `"queued"` state (amber dot, "Queued" label), matching the agent-panel badge.

### 10. Queued State Visual Feedback (Browser)

**`agents/src/ui/agent-panel.ts`:** The LLM badge gains a `"queued"` state — amber dot with "Queued..." label. Reuses existing `llm-thinking` CSS class with different text.

**`agents/src/data/types.ts`:** Add `"queued"` to `AgentActionType`:

```ts
export type AgentActionType =
  | "thinking" | "speaking" | "asking" | "using-tool" | "tool-complete"
  | "requesting-permission" | "permission-granted" | "permission-denied"
  | "task-started" | "task-completed" | "idle" | "error"
  | "queued";
```

**`agents/src/brain/agent-brain.ts`:** Add a `"queued"` transition entry. The `"queued"` event maps to the existing `"waiting"` brain state (no new BrainState needed). In `"waiting"`, the agent stands still with no movement target — exactly the right visual behavior for a queued agent.

**`agents/src/systems/brain-system.ts`:** Recognize `"queued"` as an event type that triggers the `"waiting"` transition via the brain's existing transition table.

---

## File Change Summary

| File | Change |
|------|--------|
| `src/domain/agents/process-pool.ts` | **New** — bounded process pool with deferred proxy |
| `src/infrastructure/types-config.ts` | Add `maxConcurrent` to `AgentsConfig` |
| `src/domain/agents/worker-types.ts` | Add `"queued"` to `WorkerState` union (preserving all existing states) |
| `src/infrastructure/worker-manager.ts` | Integrate pool, add queued state transition, cancel on stop |
| `src/infrastructure/world-state-manager.ts` | Add `"queued"` to `STATUS_MAP` |
| `src/domain/serve/static-server.ts` | Fix silent message drops in `/api/agent/send` |
| `src/domain/serve/dashboard-service.ts` | Call `pool.killAll()` on shutdown |
| `agents/src/store/dashboard-store.ts` | RAF-batched `notify()`, add `"queued"` to `LlmStatus` |
| `agents/src/ui/panel-talk.ts` | Conversation DOM cap (50 turns), queued thinking indicator |
| `agents/src/ui/agent-panel.ts` | Queued badge state |
| `agents/src/data/types.ts` | Add `"queued"` to `AgentActionType` |
| `agents/src/brain/agent-brain.ts` | Add `"queued"` → `"waiting"` transition entry |
| `agents/src/systems/brain-system.ts` | Recognize `"queued"` event |

## Constraints

- Zero runtime dependencies (Node built-ins only on CLI side)
- Domain purity: `process-pool.ts` is a pure domain module — no infrastructure imports, timer injected via `PoolTimer` interface
- All existing tests must continue to pass
- New code requires tests following existing patterns (`tests/` mirror of `src/`)

## Testing Strategy

- **process-pool.ts:** Unit tests for slot acquisition, queuing, deferred proxy (onEvent buffering, unsubscribe lifecycle, result chaining), release, cancel, killAll (active + queued), timeout reaping. Mock `IAgentProcessRunner` and `PoolTimer`.
- **worker-manager.ts:** Update existing tests to inject pool mock. Verify queued state transition when pool is full. Verify `cancel()` called on `stop()`.
- **static-server.ts:** Test that `/api/agent/send` spawns worker when missing.
- **types-config.ts:** Compile-time check — `maxConcurrent` added to `AgentsConfig`.
- **dashboard-store.ts:** Test that rapid `notify()` calls coalesce into single RAF event. Test `LlmStatus` accepts `"queued"`.
- **panel-talk.ts:** Test that conversation renders only last 50 turns. Test queued thinking indicator text.
- **agent-brain.ts:** Test that `"queued"` event produces `"waiting"` brain state.
- **brain-system.ts:** Test that `"queued"` event triggers waiting transition.
- **types.ts:** Compile-time check — `"queued"` is a valid `AgentActionType`.
