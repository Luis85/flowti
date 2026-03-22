# Autonomy Bridge — Design Spec

**Date:** 2026-03-22
**Status:** Approved
**Scope:** BT→CLI bridge, brain-initiated LLM sessions, real task execution, JSONL protocol extension
**Depends on:** LLM Session Management (merged 2026-03-22)

## Problem

The BT system (Plugin) and the CLI worker system operate independently. BT produces actions (`goal-started`, `seek-food`, `thinking`) that go to a Plugin-local stub — the CLI worker never sees them. Agents can't do real work: task execution is simulated (visual timer + "Done!"), and agents can only use LLM sessions when user-selected.

The two stacks share a data format (`agent-dashboard.json`) but not runtime events. The missing bridge between BT decisions and CLI execution is the core gap preventing a productive agent world.

## Goals

1. BT actions for AI agents flow to the CLI worker via the existing JSONL subprocess protocol
2. Brain decides if a task is LLM-worthy and picks the execution mode (talk, generate, autonomous)
3. LLM sessions are acquired on agent selection (warm before user types) and on-demand when brain needs one
4. Real task output: files written to vault, conversation persisted, artifacts produced
5. CLI execution events flow back to the brain for visual state (thinking, working, idle)

## Non-Goals

- Changing the BT tree structure or adding new BT nodes
- Plugin UI redesign (panels, views)
- Data export or type alignment (see Follow-on: Data & State Alignment)
- Plugin hardening or interactive waiting UX (see Follow-on: UX Polish & Views)

## Architecture

### Current State

```
Plugin (BT)                          CLI (Worker)
───────────                          ────────────
BT tick → actions                    agent:start JSONL loop
    ↓                                    ↓
Plugin-local stub                    workerManager.send()
(actions go nowhere)                 (only from user messages)
    ↓                                    ↓
BrainSystem (visual only)            LLM session (only on user select)
```

### Target State

```
Plugin (BT)                          CLI (Worker)
───────────                          ────────────
BT tick → actions ──────────────────→ agent-process-loop
    ↓              JSONL stdin           ↓
DashboardStore ←─────────────────── workerManager
    ↓              JSONL stdout          ↓
BrainSystem                          LLM session
(visual + real state)                (on select OR on brain request)
```

### Bridge Flow

```
BT tick produces collectedActions for Agent Bob
    ↓
DashboardStore.forwardBtAction(agentName, action)
    ↓
proc.send({ type: "bt-action", action: "goal-started", data: { goal, goalType, context } })
    ↓  (JSONL stdin to agent:start subprocess)
agent-process-loop.dispatch()
    ↓
handleBtAction(deps, msg)
    ↓
workerManager evaluates execution mode based on:
    - goal type (implement, review, summarize, plan, monitor, report)
    - agent trustTier (supervised → talk, trusted → generate, autonomous → full tools)
    ↓
Execution produces events (thinking, using-tool, response, done)
    ↓  (JSONL stdout back to Plugin)
DashboardStore.handleCliEvent()
    ↓
BrainSystem.applyEvent() → visual state transitions
```

## Detailed Changes

### 1. JSONL Protocol Extension

**File:** `01 - Projects/Flowti CLI/src/domain/agents/agent-process-loop.ts`

New stdin message types:

```typescript
interface AgentSelectedInput {
    readonly type: "agent-selected";
}

interface AgentDeselectedInput {
    readonly type: "agent-deselected";
}

interface BtActionInput {
    readonly type: "bt-action";
    readonly action: string;
    readonly data: {
        readonly goal?: string;
        readonly goalType?: string;
        readonly context?: string;
        readonly task?: string;
    };
}
```

Add to `StdinMessage` union type. Add to `dispatch` switch:

- `"agent-selected"` → call `primeWorker` (acquire session + send startup prompt)
- `"agent-deselected"` → call `workerManager.stop(agentName)` (starts decay timer)
- `"bt-action"` → call `handleBtAction` (evaluate and execute)

No new stdout message types — existing `thinking`, `using-tool`, `response`, `done`, `error` events cover all feedback.

### 2. Agent Selection → LLM Priming

**File:** `01 - Projects/Flowti CLI/src/infrastructure/worker-manager.ts`

Current: `spawnWorker()` calls `primeWorker()` for all AI agents on spawn.

Change: `spawnWorker()` creates the worker but does NOT prime. Two separate triggers for priming:

1. **`agent-selected` JSONL message** → `primeWorker(worker)` acquires session + primes
2. **`bt-action` arrives for worker without session** → `processLlmMessage` re-acquisition path acquires + primes before executing

The `primeWorker` function is unchanged — it still calls `acquireSession`, builds the startup prompt, and sends it. The only change is WHEN it's called.

**Breaking test changes:** The existing tests "spawn primes AI agent with startup prompt via session" and "reuses session for subsequent messages" assume priming happens on `spawnAll()`. These tests must be updated:
- "spawn does NOT prime AI agent" — verify `session.send` is NOT called after `spawnAll()`
- "agent-selected triggers priming" — new test, verify priming happens on the JSONL message
- "reuses session" — must send `agent-selected` first before testing message reuse

**Plugin side:**

**File:** `01 - Projects/Flowti Plugin/src/game/store/dashboard-store.ts`

When user selects an agent (opens agent panel / clicks agent in world):
- Call `proc.send({ type: "agent-selected" })` via existing JSONL stdin
- The CLI subprocess primes the LLM session immediately

When user deselects (closes panel / selects different agent):
- Call `proc.send({ type: "agent-deselected" })` to previous agent
- CLI starts decay timer on old agent, primes new agent

### 3. BT Action Forwarding

**File:** `01 - Projects/Flowti Plugin/src/game/store/dashboard-store.ts`

New method: `forwardBtAction(agentName: string, action: string, data: Record<string, unknown>)`:

1. Check if agent has a running CLI process (`getOrStartProcess`)
2. Send `{ type: "bt-action", action, data }` via JSONL stdin
3. Only forward actions that need CLI worker involvement:
   - `goal-started` — brain decided to work on a goal
   - `task-started` — explicit task assigned
   - Forward ONLY for `agentType === "ai"` agents

NPC and human agents continue to be fully BT-driven with no CLI involvement.

**File:** `01 - Projects/Flowti Plugin/src/game/engine-simulation.ts`

The BT action forwarding happens at the engine level, NOT inside `bt-system.ts` (which has no store reference). In `engine-simulation.ts`, after the existing `sys.bt.update()` call (line ~476), the engine already has access to both `sys.bt` (for collected actions) and `ctx.store`:

```typescript
const btActions = sys.bt.update(state.deltaMs, ctx.btBridge.worldState, ctx.btBridge.clock);
// NEW: forward CLI-relevant actions for AI agents
for (const action of btActions) {
    if (action.agentType === "ai" && ["goal-started", "task-started"].includes(action.type)) {
        ctx.store.forwardBtAction(action.agentName, action.type, action.data);
    }
}
```

This avoids modifying `bt-system.ts` (which should remain pure) and keeps the wiring at the composition layer where both systems are accessible.

### 4. CLI-Side BT Action Handler

**File:** `01 - Projects/Flowti CLI/src/domain/agents/agent-process-loop.ts`

New `handleBtAction(deps, msg)`:

```typescript
function handleBtAction(deps: AgentProcessLoopDeps, msg: BtActionInput): void {
    const { action, data } = msg;

    if (action === "goal-started" || action === "task-started") {
        const goalText = data.goal ?? data.task ?? "";
        const context = data.context ?? "";
        const fullMessage = context ? `${context}\n\n${goalText}` : goalText;

        deps.workerManager.send(deps.agentName, fullMessage, {
            task: goalText,
            onEvent(event) {
                const type = mapStreamEventToType(event);
                const text = extractText(event);
                writeEvent(deps, type, text);
            },
            onResponse(response) {
                writeEvent(deps, "response", textFromWorkerResponsePayload(response));
            },
        });
    }
}
```

This reuses the existing `workerManager.send()` path with the `task` option, which triggers `buildTaskPrompt` (no conversation history needed for task execution). The worker's `processLlmMessage` handles session acquisition, priming, and execution mode selection.

### 5. Execution Mode Selection

**File:** `01 - Projects/Flowti CLI/src/infrastructure/worker-manager.ts`

When `processLlmMessage` receives a message with `opts.task`, the execution mode is determined by the agent's trust tier:

| Trust Tier | Mode | What Happens |
|-----------|------|-------------|
| `supervised` | Talk | `session.send(taskPrompt)` → text response only, no tool use |
| `trusted` | Generate | `session.send(taskPrompt)` with tools `["Read", "Write"]` |
| `autonomous` | Autonomous | `agentShell.dispatch()` → full workspace with all allowed tools |

**Trust tier resolution:** The `TrustTier` type (`"supervised" | "trusted" | "autonomous"`) lives in `src/domain/trust/trust-types.ts`, persisted in `.flowti/var/trust/<agent-slug>.json`, and loaded via `loadTrustProfile()` from `trust-manager.ts`. The worker manager does NOT currently load trust profiles — a new dependency is needed.

**New dep in `WorkerManagerDeps`:** Add `loadTrustProfile` as an injected function (or add `trust-manager` to the deps). In `processLlmMessage`, when `opts.task` is set, call `loadTrustProfile(deps, varDir, worker.name)` to get the trust tier.

**For the `autonomous` path:** The existing `AgentShell` infrastructure (workspace provisioning, state splitting, collection) is reused. However, `IAgentShell` is not currently in `AgentProcessLoopDeps` or `IWorkerManager`. It must be injected into the worker manager (or the process loop deps) to enable the autonomous dispatch path.

**For `supervised` and `trusted` paths:** The existing `session.send()` or `processRunner.spawn()` paths are used. The difference is the tool whitelist — `supervised` gets no tools, `trusted` gets `["Read", "Write"]`. The permission engine (`resolveAgentPermissions`) resolves the whitelist from grants, but the trust-tier-based mode selection is new logic:

```typescript
const trustTier = loadTrustProfile(deps, varDir, worker.name)?.tier ?? "supervised";
if (opts.task && trustTier === "autonomous" && agentShell) {
    // Full workspace dispatch
    return agentShell.dispatch({ agent: worker.name, task: message, ... });
}
// Otherwise: session.send() or one-shot with resolved tools
```

**Note:** `agentShell` may not be available in all contexts (e.g., when running without workspace infrastructure). Fall back to `trusted` mode (session.send with Read/Write tools) if `agentShell` is not injected.

### 6. Event Feedback Loop (CLI → Plugin → Brain)

**NOT currently wired.** The existing pipeline gets events from CLI to the store, but the store does not forward them to the brain system. This requires new wiring.

**What exists:**
1. CLI worker emits events via JSONL stdout (`thinking`, `using-tool`, `response`, `done`)
2. `agent-process-loop.ts` writes events via `writeEvent` / `lineWriter.write`
3. Plugin's `cli-executor.ts` receives JSONL lines on stdout
4. `dashboard-store.ts` `handleCliEvent` routes them to store state updates (thinking indicator, event log)

**What's missing:** `handleCliEvent` does NOT call `brain.applyEvent()`. The store has no reference to `BrainSystem`. The `cli-data-provider.ts` has `actionCallbacks` but never fires them.

**New wiring needed:**

**File:** `01 - Projects/Flowti Plugin/src/game/store/dashboard-store.ts`

Add a `CustomEvent` dispatch from `handleCliEvent` for brain-relevant event types:

```typescript
// Inside handleCliEvent, after existing routing:
if (["thinking", "using-tool", "idle", "error", "done", "speaking", "queued"].includes(event.type)) {
    this.dispatchEvent(new CustomEvent("cli-brain-event", {
        detail: { agent: event.agent, action: event.type }
    }));
}
```

**File:** `01 - Projects/Flowti Plugin/src/game/engine-simulation.ts`

In the engine setup, subscribe to the store's `cli-brain-event` and forward to brain:

```typescript
store.addEventListener("cli-brain-event", (e: CustomEvent) => {
    const { agent, action } = e.detail;
    sys.brain.applyEvent(agent, action);
});
```

This keeps the store decoupled from `BrainSystem` (events, not direct calls) and uses the existing `applyEvent` + `TRANSITIONS` map which already handles `thinking → working`, `using-tool → working`, `error → idle`, `done → idle`.

**Also needed:** When CLI finishes a task (emits `done`), the Plugin should emit a `goal-completed` action so the BT knows the work cycle is finished. This can be done in the engine's `cli-brain-event` handler: if event type is `done` and the agent was in a `working` state, emit `goal-completed` to the BT context.

## Error Handling

- **LLM session not available (maxConcurrent reached):** bt-action is queued in the worker's message queue. **Note:** the existing `drainQueue` passes `undefined` for `opts`, which loses `onEvent`/`onResponse` callbacks. For bt-actions, the `handleBtAction` handler should use a fire-and-forget pattern: callbacks write to the JSONL stdout event log, which persists regardless of queueing. The queued message's events will appear in the event log (via `writeEvent` in the main response path) even without per-message callbacks. If richer feedback is needed for queued tasks, the message queue should be extended to store `opts` alongside the message — but this is out of scope for the bridge MVP.
- **Task execution fails (LLM error):** Worker emits `error` event via JSONL. Plugin's `handleCliEvent` routes to `brain.applyEvent(name, "error")` → brain transitions to `idle`. Failure count incremented.
- **Agent process dies during task:** Plugin detects via `child.on('close')`. Next `getOrStartProcess` restarts the process. In-flight task is lost — no retry (by design, to avoid infinite loops).
- **BT action for non-AI agent:** `forwardBtAction` filters on `agentType === "ai"`. NPC/human actions stay Plugin-local.

## Test Strategy

### Unit tests

- `agent-process-loop.test.ts`: new message types dispatch correctly (`agent-selected`, `agent-deselected`, `bt-action`)
- `worker-manager.test.ts`: lazy priming (no prime on spawn, prime on `agent-selected`), bt-action triggers task execution, execution mode selection based on trust tier
- `dashboard-store.test.ts` (Plugin): `forwardBtAction` sends correct JSONL, only forwards for AI agents
- `bt-system.test.ts` (Plugin): BT tick forwards CLI-relevant actions to store

### Integration points

- Full loop: BT fires `goal-started` → JSONL → CLI worker → LLM → JSONL → brain state transition
- Selection flow: user selects agent → primed → types message → response (zero latency)
- Deselection flow: user deselects → decay starts → re-select within window → instant resume

---

## Follow-on: Data & State Alignment

**Pick up after Autonomy Bridge is implemented.**

### Scope

- B1: Complete data export (`agent-export.ts`)
- B2: World state reconciliation (`onStateDiff`)
- Type alignment CLI ↔ Plugin

### B1 — Complete Data Export

**File:** `01 - Projects/Flowti CLI/src/domain/agents/agent-export.ts`

The `buildDashboardAgent` function (line ~229) currently exports identity, skills, relationships, and suggested tasks. Missing fields:

**Economy fields** — read from the economy domain (agent's persistent economy state):
- `level: number` — derived from XP via `LEVEL_TABLE`
- `coin: number` — current coin balance
- `xp: number` — current XP total
- `tokens: number` — current token balance
- `trustTier: "supervised" | "trusted" | "autonomous"` — from agent state or trust domain

**Context fields** — derived from active iteration:
- `project: string` — project name the agent is assigned to
- `iteration: number` — active iteration number
- `phase: string` — current phase within iteration

**Behavioral fields** — pass-through from AgentSummary:
- `behaviors: string[]` — already in AgentSummary, just not included in export
- `goals: { name: string; text: string; priority: number }[]` — fix shape (currently only `text` + `priority`, missing `name` as primary key)
- `capabilities: string[]` — derived from agent's allowed tools + skills

**Implementation:** Read economy data from `.flowti/var/economy/<agent-slug>.json` (if exists). Read trust tier from agent state. Pass through behaviors and fix goals shape. Add project/iteration/phase from the active iteration context already loaded by `exportAgentDashboardData`.

**Estimated:** 3-4 tasks (economy read, context fields, behavioral fields, goal shape fix).

### B2 — World State Reconciliation

**Problem:** After initial `agent-dashboard.json` load, the Plugin's world state drifts from CLI reality. Agent status, economy, task assignments change on the CLI side but the Plugin doesn't know.

**Approach: Periodic JSONL world-state push.**

Add a new stdout event type to the agent process loop:

```typescript
{ type: "world-state-sync", ts: number, agents: DashboardAgent[] }
```

The CLI emits this on a configurable interval (e.g., every 30 seconds) or on significant state changes (task completed, trust promoted, level up). The Plugin's `handleCliEvent` receives it and patches the store:

```
CLI emits world-state-sync → Plugin handleCliEvent
    → compare incoming agents with store state
    → for each agent: update changed fields (status, economy, tasks)
    → emit state-changed for UI refresh
```

**Alternative: One-shot polling.** Plugin calls `flowti agent:list --format=json` on an interval and diffs the result. Simpler but adds process spawn overhead.

**Recommended:** JSONL push from the already-running subprocess. No new process spawns, minimal latency.

**Estimated:** 3-4 tasks (CLI-side sync emission, Plugin-side diff handler, store patching, tests).

### Type Alignment

**CLI `world-state-types.ts`** — add missing action types:
- `seek-food`, `seek-drink`, `seek-preferred-food`, `seek-preferred-drink`

**CLI trust types** — export `TrustTier` type for Plugin import (currently duplicated).

**Plugin `data/types.ts`** — align `DashboardAgent` goals shape with CLI export.

**Estimated:** 1-2 tasks (type additions, import fixes).

### Total estimated: 7-10 tasks.

---

## Follow-on: UX Polish & Views

**Pick up after Autonomy Bridge is implemented. Partially parallel with Data & State Alignment.**

### Scope

- C0: Plugin hardening
- B6: Interactive waiting (small talk while LLM works)
- C3: Flowti CLI View in Plugin

### C0 — Plugin Hardening

**View lifecycle error boundaries:**
- Wrap view initialization in try/catch with graceful fallback UI (error message + retry button)
- Handle `getViewType()` edge cases across all 23+ view classes

**Process lifecycle resilience:**
- Detect agent process crash proactively via `child.on('close')` → show reconnect indicator in agent panel
- stderr capture — attach reader to CLI subprocess stderr, log warnings to console, surface errors in UI
- Orphan cleanup — ensure `killAll()` runs on plugin unload, add `beforeunload` listener as safety net

**State management:**
- Rate-limit `state-changed` events — verify RAF-deferred batching covers all paths
- Add health check heartbeat to CLI subprocess (periodic ping/pong via JSONL)

**Estimated:** 4-5 tasks.

### B6 — Interactive Waiting

**Problem:** When the LLM is processing, the agent stands at the workstation silently. No visual feedback beyond the panel's "thinking" indicator.

**Solution:** Extend the talk engine to fire during LLM wait states.

**When brain state is `thinking` or `working`:**
1. Talk engine generates personality-driven ambient quotes every 3-5 seconds
2. Bubble system shows thought bubbles above the agent: "Hmm, let me think about this...", "Almost there...", "This is interesting..."
3. Phrases are personality-weighted — high-INT agents show analytical phrases, high-CHA agents show reassuring phrases
4. When LLM response arrives (`done` event), final bubble shows brief acknowledgment before full response appears in chat panel

**Implementation:**
- `talk-engine.ts` already has quote generation infrastructure and personality weighting
- Add a `generateWaitingQuote(agent, brainState)` function
- `brain-system.ts` calls it on state entry for `thinking`/`working` states, with a repeating interval
- Bubble system already handles thought bubbles with queue and auto-dismiss

**Estimated:** 2-3 tasks (waiting quote generator, brain-system integration, bubble timing).

### C3 — Flowti CLI View in Plugin

**New Obsidian ItemView** providing unified CLI access from the Plugin.

**View structure:**
```
┌─────────────────────────────────────┐
│ [Agents] [Projects] [Terminal]      │  ← tab bar
├─────────────────────────────────────┤
│                                     │
│  Tab content area                   │
│                                     │
└─────────────────────────────────────┘
```

**Agents Hub tab:**
- Agent roster with live status indicators (idle/thinking/working/on-break)
- Click agent → select (triggers `agent-selected` JSONL, opens talk panel)
- Economy summary per agent (level, XP, coins)
- Quick actions: assign task, wake agent

**Projects Hub tab:**
- Project cards showing name, health score, test status
- One-click: build, test, health check (via one-shot CLI commands)
- Recent reports list with links

**CLI Terminal tab:**
- Raw terminal emulation — text input at bottom, scrollable output above
- Sends commands to CLI subprocess, renders output (strip ANSI or render as HTML colors)
- Command history (up/down arrow)

**Registration:**
- New view type `flowti-cli-view` registered in `main.ts`
- Ribbon icon to open the view
- Uses existing `CliExecutor` for one-shot commands and subprocess communication

**Estimated:** 5-6 tasks (view registration + tab bar, agents hub, projects hub, terminal, ribbon icon).

### Total estimated: 11-14 tasks.
