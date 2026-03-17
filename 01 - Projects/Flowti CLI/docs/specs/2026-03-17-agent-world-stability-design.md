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
- Enforce a `maxConcurrent` limit (default 2, configurable via `AgentsConfig`)
- Track active `AgentProcess` instances in a `Map<string, AgentProcess>` keyed by agent name
- When a slot is available: spawn immediately via the injected `IAgentProcessRunner`
- When full: enqueue the request, return a deferred `AgentProcess` that resolves when a slot opens
- When a process completes (result resolves or rejects): reclaim the slot, dequeue next
- Expose `killAll()` for server shutdown and `kill(agentName)` for targeted cleanup
- Auto-kill processes that exceed `processTimeoutMs` (from existing config, default 3,600s)

**Interface:**

```ts
interface IProcessPool {
  acquire(agent: AgentSummary, prompt: string, tools: readonly string[]): AgentProcess;
  release(agentName: string): void;
  killAll(): void;
  getQueueDepth(): number;
  getActiveCount(): number;
}
```

**Key behavior:** If agent A already has an active process and a new message arrives for A, the message queues in `worker-manager` via the existing `messageQueue`. The pool only limits cross-agent concurrency. One process per agent at a time is already enforced by the worker's state machine (`idle` → `thinking` → `working` → `idle`).

**Deferred process pattern:** When the pool is full, `acquire()` returns an `AgentProcess` whose `result` promise doesn't resolve until a slot opens and the real process completes. The `onEvent` callback is buffered and forwarded once the real process starts. This keeps the `AgentProcess` interface unchanged for callers.

**Slot reclamation:** The pool wraps each `AgentProcess.result` promise to auto-call `release()` on completion. The worker-manager also calls `release()` explicitly as defense-in-depth.

**Stale process reaping:** The pool registers a `setTimeout` per active process using `processTimeoutMs`. If exceeded, the pool calls `process.kill()` and releases the slot. Defense-in-depth alongside the process runner's own timeout.

### 2. Worker-Manager Changes (`src/infrastructure/worker-manager.ts`)

Minimal integration with the process pool.

**Changes:**
- `createWorkerManager()` gains a `pool: IProcessPool` parameter (injected alongside `processRunner`)
- `processLlmMessage()` replaces `processRunner.spawn(...)` with `pool.acquire(...)`
- When pool is full (deferred process), worker transitions to `"queued"` state before `"thinking"`
- On process completion, call `pool.release(worker.name)` to free the slot

**New worker state flow:**

```
idle → queued → thinking → working → idle
```

`"queued"` is only entered when the pool is full. If a slot is immediately available, it skips to `"thinking"`.

**World state emission:** `"queued"` state emitted via `setWorkerState()` → SSE → browser.

### 3. Worker State Type Change (`src/domain/agents/worker-types.ts`)

Add `"queued"` to the `WorkerState` union type:

```ts
export type WorkerState = "idle" | "queued" | "thinking" | "working" | "stopped";
```

### 4. World State Status Map (`src/infrastructure/world-state-manager.ts`)

Add `"queued"` entry to `STATUS_MAP`:

```ts
"queued": () => ({ state: "waiting", currentAction: "queued" }),
```

### 5. Silent Message Drop Fix (`src/domain/serve/static-server.ts`)

The `/api/agent/send` endpoint currently calls `workerManager.send()` without ensuring the worker exists. Messages for unspawned agents are silently dropped.

Fix: add worker-exists check matching the `/api/agent/wake` pattern:

```ts
let worker = ctx.workerManager.getWorker(name);
if (!worker) worker = ctx.workerManager.spawn(name);
if (!worker) { json(404, { error: "Agent not found" }); return; }
```

### 6. Graceful Shutdown (`src/domain/serve/dashboard-service.ts`)

Call `pool.killAll()` before closing the HTTP server in `stopDashboard()`. This sends `taskkill /T /F` (Windows) or `SIGTERM` (Unix) to all active processes, preventing orphaned subprocesses. The existing `workerManager.stopAll()` call remains — it handles worker state while `pool.killAll()` handles OS processes.

### 7. RAF-Batched Store Notifications (`agents/src/store/dashboard-store.ts`)

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

### 8. Conversation DOM Cap (`agents/src/ui/panel-talk.ts`)

Cap the rendered conversation to the 50 most recent turns. The full history stays in the store — only the visible DOM is limited. The thread container already has `overflow-y: auto`, so no layout changes needed.

```ts
private renderThread() {
  const visible = this.conversation.slice(-50);
  // ... render visible turns
}
```

### 9. Queued State Visual Feedback (Browser)

**`agents/src/ui/agent-panel.ts`:** The LLM badge gains a `"queued"` state — amber dot with "Queued..." label. Reuses existing `llm-thinking` CSS class with different text.

**`agents/src/ui/panel-talk.ts`:** The thinking indicator shows "Waiting for available slot..." when the agent's LLM status is `queued`.

**`agents/src/systems/brain-system.ts`:** Recognize `"queued"` as an event type that maps to a passive waiting pose (no movement, no wander). The agent stands still while queued.

---

## File Change Summary

| File | Change |
|------|--------|
| `src/domain/agents/process-pool.ts` | **New** — bounded process pool |
| `src/domain/agents/worker-types.ts` | Add `"queued"` to `WorkerState` union |
| `src/infrastructure/worker-manager.ts` | Integrate pool, add queued state transition |
| `src/infrastructure/world-state-manager.ts` | Add `"queued"` to `STATUS_MAP` |
| `src/domain/serve/static-server.ts` | Fix silent message drops in `/api/agent/send` |
| `src/domain/serve/dashboard-service.ts` | Call `pool.killAll()` on shutdown |
| `agents/src/store/dashboard-store.ts` | RAF-batched `notify()` |
| `agents/src/ui/panel-talk.ts` | Conversation DOM cap (50 turns) |
| `agents/src/ui/agent-panel.ts` | Queued badge state |
| `agents/src/systems/brain-system.ts` | Recognize `"queued"` event |

## Constraints

- Zero runtime dependencies (Node built-ins only on CLI side)
- Domain purity: `process-pool.ts` is a pure domain module, no infrastructure imports
- All existing tests must continue to pass
- New code requires tests following existing patterns (`tests/` mirror of `src/`)

## Testing Strategy

- **process-pool.ts:** Unit tests for slot acquisition, queuing, release, killAll, timeout reaping. Mock `IAgentProcessRunner`.
- **worker-manager.ts:** Update existing tests to inject pool mock. Verify queued state transition.
- **static-server.ts:** Test that `/api/agent/send` spawns worker when missing.
- **dashboard-store.ts:** Test that rapid `notify()` calls coalesce into single RAF event.
- **panel-talk.ts:** Test that conversation renders only last 50 turns.
- **brain-system.ts:** Test that `"queued"` event produces waiting pose.
