# Task Dispatcher — Design Spec

**Date:** 2026-03-24
**Status:** Approved
**Scope:** Centralized task scheduling, agent scoring, priority queue, cooldown, observability
**Depends on:** Task & Economy Engine (2026-03-21), LLM Session Management (merged 2026-03-22), Autonomy Bridge (2026-03-22)

## Problem

The Task Engine defines task lifecycle and the LLM Session Management provides persistent sessions, but there is no orchestration layer between them. When multiple task sources (standing orders, BT actions, Director commands, agent self-proposals, delegations) produce work simultaneously, there is no mechanism to decide which agent gets which task, in what order, or what happens when all agents are busy.

The current model gives each agent a 1:1 session when selected. But with the Autonomy Bridge routing real BT actions and the Task Engine assigning work concurrently, the system needs a scheduler that manages the shared constraint: which work happens in what order, routed to the best available agent.

## Goals

1. Centralized push-based task scheduling — tasks are routed immediately on submission
2. Priority-based queuing — urgent > high > normal, FIFO within each lane
3. Agent scoring — capability filter, trust gate, affinity tiebreaker
4. Post-task cooldown — visible rhythm between assignments, budget protection
5. Five task sources integrated through one entry point
6. Observability — queue depth, throughput, per-agent stats, CLI commands, SSE export

## Non-Goals

- Managing LLM sessions directly (WorkerManager owns that)
- Changing the task store CRUD or economy ledger
- Plugin-side visualization (data exported, visuals are a separate spec)
- Token budget enforcement at the dispatcher level (future enhancement)

## Architecture

### Overview

```
Task Sources → TaskDispatcher → WorkerManager → LLM Session
                  ↑ queue          ↑ cooldown
                  ↑ scoring        ↑ session acquire
                  ↑ observability
```

The TaskDispatcher is a domain module. It receives tasks from all sources via `submit()`, manages a priority queue, scores agents when draining, and delegates execution to the WorkerManager. It never touches sessions, I/O, or infrastructure directly.

### Core Types

**File:** `src/domain/tasks/task-dispatcher-types.ts`

```typescript
// Import from domain peers (domain→domain is permitted):
// import type { TrustTier } from "../trust/trust-types.js";
// import type { TaskTrustTier } from "./task-types.js";

interface TaskEntry {
    taskId: string;
    title: string;              // human-readable task title (for prompts and display)
    priority: "urgent" | "high" | "normal";
    requiredCapabilities: string[];
    requiredAgentTier: TrustTier;      // minimum agent trust tier (from trust-types.ts)
    taskTrustTier: TaskTrustTier;      // "auto" | "review" | "manual" (from task-types.ts)
    reward: { xp: number; coin: number }; // copied from TaskDefinition at submit time
    submittedAt: number;
    source: "standing-order" | "bt-action" | "director" | "self-proposed" | "delegated";
    targetAgent?: string;       // for targeted submissions (BT, --assignee)
    retryCount: number;         // starts at 0, incremented on re-submit
    tags: string[];             // for affinity scoring
    type: string;               // task type for affinity scoring
}

/** Minimum fields needed from task history for affinity scoring. */
interface TaskHistoryEntry {
    tags: readonly string[];
    type: string;
    assignee: string;
}

interface DispatcherState {
    queues: { urgent: TaskEntry[]; high: TaskEntry[]; normal: TaskEntry[] };
    cooldowns: Map<string, number>;    // agentName → cooldownExpiresAt (ms)
    assignments: Map<string, string>;  // agentName → taskId (active)
}

interface AgentScore {
    name: string;
    capable: boolean;           // hard filter — has required skills/tools
    trustMet: boolean;          // gate — meets task's trust tier
    affinityScore: number;      // tiebreaker — history of similar tasks
    idle: boolean;              // currently available
    onCooldown: boolean;        // in post-task cooldown
}

interface DispatcherMetrics {
    // Queue state (live)
    queueDepth: { urgent: number; high: number; normal: number };
    activeAssignments: number;
    agentsOnCooldown: number;
    agentsIdle: number;

    // Throughput (rolling window, last 30 min)
    tasksCompleted: number;
    tasksFailed: number;
    avgWaitTimeMs: number;          // time from submit to assign
    avgExecutionTimeMs: number;     // time from assign to complete

    // Per-agent (accumulated)
    // Record (not Map) — must be JSON-serializable for SSE export
    agentStats: Record<string, {
        completed: number;
        failed: number;
        avgExecutionTimeMs: number;
        lastTaskAt: number;
    }>;
}
```

### Dependency Injection

**File:** `src/domain/tasks/task-dispatcher.ts`

```typescript
interface DispatcherDeps {
    clock: IClock;
    loadTrustProfile: (agentName: string) => AgentTrustProfile | null;
    getAgentCapabilities: (agentName: string) => string[];
    getTaskHistory: (agentName: string) => readonly TaskHistoryEntry[];
    getWorkerState: (agentName: string) => WorkerState;
    updateTaskStatus: (taskId: string, status: string) => void;
    awardReward: (agentName: string, reward: { xp: number; coin: number }) => void;
    emit: (event: string, data: unknown) => void;
    writeAgentEvent: (agentName: string, type: string, text: string) => void;
    sendToWorker: (agentName: string, message: string, opts?: { task?: string }) => void;
    cooldownMs: number;     // from config, default 15000 (15s)
    maxRetries: number;     // from config, default 1
}
```

**Dep rationale:**
- `loadTrustProfile` — uses `AgentTrustProfile` from `trust-types.ts` (the actual exported type)
- `getTaskHistory` — returns `TaskHistoryEntry[]` (minimal projection of completed tasks, defined in `task-dispatcher-types.ts`). Implemented at the wiring site by filtering `taskStore.list()` on `status === "completed"` and projecting the needed fields.
- `updateTaskStatus` — wraps `taskStore.updateField(deps, projectPath, id, "status", value)` at the wiring site. The dispatcher never needs `projectPath` or the full store API.
- `awardReward` — wraps `creditReward(ledger, agent, reward)` + `writeLedger(deps, vaultRoot, updatedLedger)` at the wiring site. The dispatcher calls it as a pure side-effect.
- `emit` — injected event emission function. The wiring site provides an implementation backed by Node.js `EventEmitter` or a simple callback registry. The dispatcher uses it for observability events (`task:assigned`, `task:completed`, `task:failed`, `agent:available`). The `agent:available` event triggers `drain()` — the wiring site subscribes to this event and calls `dispatcher.drain()`.
- `writeAgentEvent` — writes a JSONL event to the specific agent's subprocess stdout (the channel the Plugin reads). Wraps the `writeEvent` function from `agent-process-loop.ts`, resolved via the per-agent `lineWriter` in the process loop's closure. The wiring site (infrastructure) maintains a registry of per-agent line writers and routes `writeAgentEvent(agentName, type, text)` to the correct writer. This closes the feedback loop: when `assign()` fires, it calls `deps.writeAgentEvent(agent, "task-started", task.title)`. When `complete()` fires, it calls `deps.writeAgentEvent(agent, "done", "")`. This replaces the per-task `onEvent`/`onResponse` callbacks from the Autonomy Bridge spec.
- `sendToWorker` — wraps `workerManager.send()`. The `message` parameter is the fully-formed task prompt (built by the dispatcher from `task.title` + context). `opts.task` is the human-readable task title, passed through to `buildTaskPrompt` for prompt construction within the worker manager. For BT-originated tasks, `message` is the goal/context text from the BT action and `opts.task` is the task title. Per-task event callbacks (from the Autonomy Bridge spec's `onEvent`/`onResponse`) are replaced by `writeAgentEvent` for lifecycle boundaries — see that dep's rationale above.

Domain purity preserved — no infrastructure imports. All I/O accessed via injected deps.

## Scoring Algorithm

**File:** `src/domain/tasks/task-scorer.ts`

When `drain()` pulls a task from the highest non-empty lane, it scores all agents:

### Step 1 — Hard filter (capability match)

```
agent.capabilities ⊇ task.requiredCapabilities
```

Agents missing any required capability are eliminated. No partial matches.

### Step 2 — Gate (trust tier)

```
agent.trustProfile.tier >= task.requiredAgentTier
```

Trust tier ordering: `supervised < trusted < autonomous`. A `trusted` agent can handle tasks requiring `supervised` or `trusted` agents, but not `autonomous`-only tasks. This uses `AgentTrustProfile.tier` (the agent's earned tier) compared against `TaskEntry.requiredAgentTier` (the minimum agent tier the task demands).

### Step 3 — Availability filter

```
agent.workerState === "idle" AND NOT onCooldown
```

Busy or cooling-down agents are skipped. If no agents pass this filter, the task stays in the queue.

### Step 4 — Affinity tiebreaker

```
affinityScore = countCompletedByTag(agent, task.tags) × 2
             + countCompletedByType(agent, task.type) × 1
```

Simple weighted count of the agent's history with similar tasks. An agent who's tagged 50 inbox notes scores higher for the next tagging task than one who's never done it.

### Selection

Highest `affinityScore` wins. On tie, alphabetical by name (deterministic, testable).

### When no agent qualifies

Task stays at the front of its lane. `drain()` is re-triggered whenever any agent transitions to idle (after cooldown expires).

## Task Sources Integration

Five sources feed tasks into the dispatcher. Each goes through `dispatcher.submit(task)` — same entry point, different origins.

### 1. Director commands (CLI)

```
flowti task:create --title="..." --assignee=auditor --priority=high
    → taskStore.create(task)
    → dispatcher.submit(taskEntry)
```

If `--assignee` is specified, the task skips scoring and goes directly to that agent (if capable + trust met). If the agent is busy, it queues in their personal lane — not the general pool.

### 2. Standing orders (event-triggered)

```
Standing order watches folder → file-created event fires
    → standingOrderIndex.match(event)
    → dispatcher.submit({ source: "standing-order", priority: "normal", ... })
```

Standing orders always enter as `normal` priority unless the order definition specifies otherwise.

### 3. BT actions (Autonomy Bridge)

```
BT tick → goal-started / task-started
    → JSONL → agent-process-loop
    → dispatcher.submit({ source: "bt-action", priority: "normal", targetAgent: agentName, ... })
```

BT-originated tasks target the agent that produced the action — they don't go through general scoring. The dispatcher validates trust and capability, then assigns directly.

### 4. Agent self-proposals

```
Agent LLM response includes task proposal
    → dispatcher.submit({ source: "self-proposed", priority: "normal", ... })
    → task enters "proposed" status, awaits Director approval
    → on approval → re-submitted as "pending" → normal scoring
```

### 5. Delegated tasks (agent-to-agent)

```
Agent A completes subtask, produces delegation request
    → dispatcher.submit({ source: "delegated", priority: "high", ... })
```

Delegated tasks enter as `high` priority — another agent is blocked waiting for the result.

### Routing rule

Targeted routing applies when `targetAgent` is set on the `TaskEntry`, regardless of source. Source 3 (BT actions) always sets `targetAgent` (the agent that produced the action). Source 1 (Director with `--assignee`) sets `targetAgent` when the flag is provided. Source 2 (standing orders) sets `targetAgent` only if the standing order definition includes an `assignee` field. All other submissions (Director without `--assignee`, self-proposed after approval, delegated, standing orders without assignee) go through general scoring.

## Lifecycle

### Submit → Assign → Execute → Complete → Cooldown

```
submit(task)
    │
    ├─ task.taskTrustTier === "manual"?
    │   ├─ yes → reject unless source === "director"
    │   │        ("manual" tasks require explicit Director trigger each time.
    │   │         Non-Director sources submitting "manual" tasks get an error.
    │   │         This prevents agents, standing orders, or BT actions from
    │   │         executing manual-tier work without Director involvement.)
    │   └─ no  → continue
    │
    ├─ targeted? (has targetAgent)
    │   ├─ yes → validate(capability + trust) → assign or queue for that agent
    │   └─ no  → enqueue in priority lane
    │
drain() ← triggered on submit AND on agent-becomes-idle
    │
    ├─ pull highest non-empty lane (urgent > high > normal)
    ├─ scoreAgents(task) → filter → gate → rank
    ├─ winner found?
    │   ├─ no  → task stays at front of lane, wait for next drain trigger
    │   └─ yes → assign(agent, task)
    │
assign(agent, task)
    │
    ├─ assignments.set(agent, taskId)
    ├─ deps.updateTaskStatus(taskId, "assigned")
    ├─ deps.emit("task:assigned", { agent, task })              ← internal observability
    ├─ deps.writeAgentEvent(agent, "task-started", task.title)  ← JSONL to Plugin
    └─ deps.sendToWorker(agent, taskPrompt, { task: task.title })
            │
            ├─ session acquired (existing LLM session mgmt)
            ├─ LLM executes
            └─ onResponse → complete(agent, task, result)

complete(agent, task, result)
    │
    ├─ assignments.delete(agent)
    ├─ task.taskTrustTier === "auto"?
    │   ├─ yes → deps.updateTaskStatus(taskId, "completed")
    │           → deps.awardReward(agent, task.reward) ← immediate reward
    │   └─ no  → deps.updateTaskStatus(taskId, "review") → staged for Director
    │           → reward deferred until Director approves (approval handler calls awardReward)
    │           (Note: only "review" tasks reach this branch. "manual" tasks are
    │            rejected at submit() time — see submit-time gate below.)
    ├─ cooldowns.set(agent, deps.clock.ms() + deps.cooldownMs)
    ├─ deps.emit("task:completed", { agent, task, result })              ← internal observability
    ├─ deps.writeAgentEvent(agent, "done", "")                         ← JSONL to Plugin
    └─ setTimeout(() → {
            cooldowns.delete(agent)
            deps.emit("agent:available", { agent })  ← triggers drain()
        }, deps.cooldownMs)
```

### Failure path

```
workerManager reports failure (LLM error, timeout, process death)
    │
    ├─ assignments.delete(agent)
    ├─ deps.updateTaskStatus(taskId, "failed")
    ├─ task.retryCount < deps.maxRetries (default 1)?
    │   ├─ yes → re-submit with retryCount + 1
    │   └─ no  → deps.emit("task:failed", { agent, task, error })
    │           → deps.writeAgentEvent(agent, "error", error.message ?? "task failed")
    └─ cooldown still applies (prevents tight failure loops)
```

### Cooldown visibility

During cooldown, the agent's blackboard `intent` is set to `"idle"` but the dispatcher treats them as unavailable. In the game world, this is the "wrapping up" moment — the agent stretches, takes a sip, looks around before the next task.

## Observability

### CLI commands

```bash
flowti dispatch:status                    # Queue depth, active assignments, idle agents
flowti dispatch:metrics                   # Throughput, wait times, per-agent stats
flowti dispatch:queue                     # List queued tasks by lane
flowti dispatch:history --agent=auditor   # Recent task completions for an agent
```

### World-state export (SSE to Plugin)

Dispatcher metrics are included in the periodic `world-state-sync` event (from the Autonomy Bridge follow-on spec). The Plugin's DashboardStore receives:

```json
{
    "dispatch": {
        "queueDepth": { "urgent": 0, "high": 2, "normal": 5 },
        "activeAssignments": 3,
        "agentsIdle": 2,
        "recentCompletions": [
            { "agent": "auditor", "task": "Tag inbox notes", "ts": "..." }
        ]
    }
}
```

Plugin-side visualization (dispatch board, queue widget) is out of scope — the data flows, visuals are a separate spec.

### Metrics storage

In-memory only, reset on restart. The transaction log (`economy-log.jsonl`) provides durable history for post-hoc analysis. The dispatcher does not persist its own metrics.

## File Layout

### New files

| File | Purpose |
|------|---------|
| `src/domain/tasks/task-dispatcher.ts` | Core dispatcher: submit, drain, score, assign, complete |
| `src/domain/tasks/task-dispatcher-types.ts` | TaskEntry, AgentScore, DispatcherState, DispatcherMetrics |
| `src/domain/tasks/task-scorer.ts` | Scoring algorithm (isolated for testability) |
| `tests/domain/tasks/task-dispatcher.test.ts` | Dispatcher unit tests |
| `tests/domain/tasks/task-scorer.test.ts` | Scorer unit tests |

### Modified files

| File | Change |
|------|--------|
| `src/infrastructure/worker-manager.ts` | Wire `onTaskComplete` / `onTaskFailed` callbacks to dispatcher. Subscribe to `agent:available` event and call `dispatcher.drain()`. Implement `sendToWorker`, `updateTaskStatus`, `awardReward`, `emit` deps for injection. |
| `src/domain/agents/agent-process-loop.ts` | Route `bt-action` through dispatcher instead of directly to workerManager (see handleBtAction migration below) |
| `src/domain/tasks/standing-order-index.ts` | Wire matched events → `dispatcher.submit()` |
| `src/infrastructure/deps.ts` | Add `dispatcher` to `CliDeps` |
| `src/controller/task.controller.ts` | Add `dispatch:status`, `dispatch:metrics`, `dispatch:queue`, `dispatch:history` commands |

### handleBtAction migration (supersedes Autonomy Bridge Section 4)

The Autonomy Bridge spec defines `handleBtAction` calling `deps.workerManager.send()` directly with per-task `onEvent`/`onResponse` callbacks. After dispatcher integration, BT actions route through the dispatcher instead:

```typescript
// Old (Autonomy Bridge spec):
function handleBtAction(deps: AgentProcessLoopDeps, msg: BtActionInput): void {
    const fullMessage = buildFullMessage(msg);
    deps.workerManager.send(deps.agentName, fullMessage, {
        task: msg.data.goal,
        onEvent(event) { writeEvent(deps, mapStreamEventToType(event), extractText(event)); },
        onResponse(response) { writeEvent(deps, "response", textFromWorkerResponsePayload(response)); },
    });
}

// New (dispatcher-routed):
function handleBtAction(deps: AgentProcessLoopDeps, msg: BtActionInput): void {
    const goalText = msg.data.goal ?? msg.data.task ?? "";
    const context = msg.data.context ?? "";
    deps.dispatcher.submit({
        taskId: generateTaskId(deps.clock),
        title: goalText,
        priority: "normal",
        requiredCapabilities: [],       // BT actions don't declare requirements
        requiredAgentTier: "supervised", // minimum tier — the BT already decided this agent should do it
        taskTrustTier: "auto",          // BT-initiated tasks auto-complete
        reward: { xp: 10, coin: 5 },   // base reward for BT-initiated work
        submittedAt: deps.clock.ms(),
        source: "bt-action",
        targetAgent: deps.agentName,    // always targets the originating agent
        retryCount: 0,
        tags: [],
        type: msg.data.goalType ?? "bt-goal",
    });
}
```

**Per-task event callbacks:** The Autonomy Bridge's per-task `onEvent`/`onResponse` callbacks are replaced by the dispatcher's `writeAgentEvent` dep. The dispatcher calls `deps.writeAgentEvent(agent, "task-started", title)` on assign and `deps.writeAgentEvent(agent, "done", "")` on complete. The wiring site maintains a per-agent line-writer registry and routes events to the correct subprocess stdout. This means BT-originated tasks get the same JSONL feedback path as all other task sources — consistent and observable. Mid-execution streaming events (`thinking`, `using-tool`) still flow directly from the LLM session through the existing worker-manager response pipeline — the dispatcher only handles lifecycle boundaries (start/complete/fail).

### Dependency direction (architecture compliance)

```
task-dispatcher.ts (domain)
    ← receives DispatcherDeps (injected)
    ← never imports infrastructure

worker-manager.ts (infrastructure)
    → calls dispatcher.submit(), dispatcher.drain(), dispatcher.complete()
    → provides DispatcherDeps implementations (emit, sendToWorker, updateTaskStatus, awardReward)
    → owns session lifecycle (unchanged)

agent-process-loop.ts (domain)
    → calls dispatcher.submit() for bt-actions

task.controller.ts (controller)
    → calls dispatcher for status/metrics queries
```

### What stays unchanged

- LLM Session Management — the dispatcher doesn't manage sessions; `sendToWorker` wraps `workerManager.send()` which handles session acquisition
- Task Store — CRUD is unchanged; dispatcher calls `updateTaskStatus` (injected dep wrapping `taskStore.updateField`)
- Economy Ledger — dispatcher calls `awardReward` (injected dep wrapping `creditReward` + `writeLedger`), doesn't own the ledger
- Trust profiles — dispatcher reads them via `loadTrustProfile` dep (returns `AgentTrustProfile`), doesn't manage them

## Test Strategy

### task-scorer.test.ts (scoring in isolation)

- Agent missing required capability → filtered out
- Agent with insufficient trust tier → filtered out
- Agent on cooldown → filtered out
- Agent busy (non-idle worker state) → filtered out
- Two capable agents, one with higher affinity → higher affinity wins
- Two agents with equal affinity → alphabetical tiebreak
- No agents qualify → returns null

### task-dispatcher.test.ts (lifecycle)

- `submit()` enqueues in correct priority lane
- `submit()` with targeted assignee skips queue, assigns directly
- `submit()` targeted to busy agent → queues for that agent
- `drain()` pulls urgent before high before normal
- `drain()` with no qualifying agents → task stays in queue
- `drain()` re-triggers on `agent:available` event
- `complete()` awards reward, starts cooldown, removes assignment
- `complete()` with `taskTrustTier: "auto"` → status "completed", reward immediate
- `complete()` with `taskTrustTier: "review"` → status "review", reward deferred
- `submit()` with `taskTrustTier: "manual"` from non-Director source → rejected
- `complete()` triggers `drain()` after cooldown expires
- Failure with retries remaining → re-submits
- Failure with retries exhausted → stays failed
- Cooldown prevents agent from receiving tasks during window
- Metrics update correctly: queue depth, throughput, per-agent stats

### Integration points (in existing test files)

- `worker-manager.test.ts`: task completion callback fires `dispatcher.complete()`
- `agent-process-loop.test.ts`: `bt-action` routes through dispatcher instead of direct workerManager

### Estimated test count

~25-30 tests across 2 new files + 2 modified files.
