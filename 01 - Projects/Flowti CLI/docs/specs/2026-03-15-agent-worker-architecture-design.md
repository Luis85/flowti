# Agent Worker Architecture — Reactive Autonomous Workers

**Date**: 2026-03-15
**Status**: Approved
**Scope**: Replace ephemeral agent processes with persistent reactive workers managed by a supervisor, with unified send interface and perception-decision-action pipeline

## Problem

Agents are currently ephemeral CLI processes — spawn, get one response, die. There's no persistence, no reactivity, no way for agents to observe the world and act autonomously. The agent shell manages lifecycle, notifications, state, and process spawning all in one place. Talk and dispatch are separate code paths despite being the same operation. Non-LLM agents (NPCs, human avatars) have no execution model at all.

## Decision

### Core Architecture

Agents are **persistent in-memory workers** managed by a WorkerManager supervisor. Each worker has its own lifecycle, component state, and event subscriptions. Workers react to world state changes through a perception → decision → action pipeline.

There is **one way** to interact with an agent: `send(message)`. The agent's capabilities determine what happens internally.

```
User / CLI / Other Agent / World State Event
        ↓
  WorkerManager.send(agentName, message, opts)
        ↓
  AgentWorker receives message
        ↓
  Perception → Decision → Action
        ↓
  Execution backend (LLM / decision tree / static)
        ↓
  Response → world state update → notifications
```

### Agent Worker

```typescript
interface AgentWorker {
	readonly name: string;
	readonly agent: AgentSummary;
	readonly state: WorkerState;
	readonly components: Record<string, unknown>;
	readonly subscriptions: readonly EventFilter[];

	send(message: string, opts?: SendOptions): void;
	stop(): void;
}

type WorkerState = "spawning" | "idle" | "reacting" | "thinking" | "working" | "waiting" | "stopped";

interface SendOptions {
	readonly foreground?: boolean;
	readonly task?: string;
	readonly briefPath?: string;
	readonly onEvent?: (event: AgentStreamEvent) => void;
	readonly onResponse?: (response: AgentResponse) => void;
}
```

**Not OS processes.** Workers are objects in the CLI's Node.js event loop. Only LLM calls spawn real child processes (via Claude CLI). This means:
- Hundreds of agents cost nothing when idle
- No IPC, no sockets, no ports
- World state IS the shared memory
- The CLI is the single event loop (like a game engine)

### Worker Lifecycle

```
spawn → idle
idle → world state event matches subscription → reacting
reacting → rule check: should I act? → idle (no) or thinking (yes)
thinking → lightweight LLM: what should I do? → working (action) or idle (no action)
working → full LLM call / decision tree / static response → idle / waiting
waiting → user answers → working
stopped → CLI exit or explicit stop or 3 consecutive failures
```

On next CLI launch, workers respawn from world state. Workers with pending tasks or `"waiting"` status resume where they left off.

### Perception — Event Subscriptions

Each worker subscribes to world state events via filters:

```typescript
interface EventFilter {
	readonly entityType?: WorldEntityType;
	readonly entityId?: string;
	readonly componentChanged?: string;
	readonly actionType?: AgentActionType;
}
```

**Built-in subscriptions** (auto-registered for all agents):
- `{ entityId: self.name, componentChanged: "tasks" }` — react when a task is assigned
- `{ entityId: self.name, actionType: "asking" }` — react when user sends a message

**Custom subscriptions** from agent components:
- `{ entityType: "project", componentChanged: "iteration" }` — react to iteration changes
- `{ entityId: "Bob", actionType: "speaking" }` — react when Bob says something

### Decision — Rule Engine

When an event matches a subscription, the decision engine evaluates rules:

```typescript
interface DecisionRule {
	readonly trigger: string;
	readonly condition?: string;
	readonly action: string;
	readonly priority: number;
}
```

**Built-in rules for LLM agents:**

| Trigger | Condition | Action | Priority |
|---------|-----------|--------|----------|
| `task-assigned` | — | `execute-task` | 10 |
| `message-received` | — | `respond` | 10 |
| `question-received` | — | `respond` | 10 |
| `iteration-changed` | agent on roster | `review` | 5 |
| `agent-mentioned` | — | `review` | 3 |

**Built-in rules for NPC agents (no LLM):**

| Trigger | Action | Priority |
|---------|--------|----------|
| `message-received` | `respond-from-state` | 10 |
| `task-assigned` | `acknowledge` | 10 |

**Custom rules** from agent goals/behaviors (future):
- GOAP goals define conditions and priorities
- Behavior trees define complex branching logic

### Action — Execution Backends

The action stage executes the decision:

```typescript
type ActionHandler = (worker: AgentWorker, context: ActionContext) => Promise<void>;

interface ActionContext {
	readonly trigger: string;
	readonly message?: string;
	readonly task?: string;
	readonly event?: WorldStateEvent;
	readonly foreground: boolean;
}
```

**Execution backends:**

| Action | Backend | What happens |
|--------|---------|-------------|
| `execute-task` | LLM | Spawn Claude CLI with brief, full conversation |
| `respond` | LLM | Spawn Claude CLI with message + conversation history |
| `review` | LLM (lightweight) | Short prompt: "Given this change, should you act?" YES/NO |
| `respond-from-state` | Static | Read components, format status response |
| `acknowledge` | Static | Emit "task acknowledged" action, update state |

**LLM backend** uses the agent shell (demoted to pure process spawner):

```typescript
interface IAgentProcessRunner {
	spawn(agent: AgentSummary, prompt: string): AgentProcess;
}

interface AgentProcess {
	onEvent(callback: (event: AgentStreamEvent) => void): () => void;
	readonly result: Promise<{ text: string; thinking: string; exitCode: number }>;
	kill(): void;
}
```

The shell no longer manages lifecycle, notifications, state, or auto-dequeue. Workers own all of that.

### Worker Manager (Supervisor)

```typescript
interface IWorkerManager {
	spawnAll(): void;
	spawn(agentName: string): AgentWorker;
	stop(agentName: string): void;
	stopAll(): void;
	getWorker(agentName: string): AgentWorker | null;
	listWorkers(): AgentWorker[];
	send(agentName: string, message: string, opts?: SendOptions): void;
	dispatchWorldEvent(event: WorldStateEvent): void;
}
```

**Startup flow:**
1. CLI starts, creates world state manager
2. `workerManager.spawnAll()` — reads agent definitions, creates workers
3. Each worker loads its entity from world state, registers subscriptions
4. Workers with pending tasks or `"waiting"` status resume
5. World state manager hooks into `workerManager.dispatchWorldEvent()` on every change

**Event fan-out:**
When world state changes, the manager iterates all workers and checks subscription filters. Matching workers enter the pipeline. The fan-out is synchronous (in the event loop); only LLM calls are async.

**Respawn:**
If a worker's LLM process crashes, the worker transitions to `idle`. After 3 consecutive failures for the same task, the worker enters `stopped` and emits an error action. On next CLI launch, stopped workers respawn as idle.

### Unified Send Interface

All agent interactions go through `workerManager.send()`:

```
// User types a message to Bob
workerManager.send("Bob", "Fix the login bug", { foreground: true });

// Assign a task from roster menu
workerManager.send("Bob", "Implement the widget", { task: "Implement the widget", briefPath: "/path/to/brief.md" });

// Ask Bob from bottom bar
workerManager.send("Bob", "What's the best approach for caching?", { foreground: true });

// Council round-robin
for (const agent of roster) {
  workerManager.send(agent.name, councilPrompt, { foreground: true });
}

// Answer a pending question
workerManager.send("Bob", "Use React", { foreground: false });
```

`foreground: true` means the user is watching — stream output to terminal with spinner. `foreground: false` means background — notifications for questions.

The worker receives the message and routes through its pipeline. The caller doesn't know or care whether the agent uses an LLM, a decision tree, or a static response.

## Design Choices

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Worker implementation | In-memory objects, not OS processes | Zero cost when idle, no IPC, world state is shared memory |
| Communication | Through world state | ECS-native, observable, no message routing complexity |
| Agent interface | Unified `send(message)` | One path for all interactions, agent decides how to respond |
| Execution | Tiered perception → decision → action | Cheap checks first, expensive LLM only when needed |
| Agent shell role | Demoted to process spawner | Workers own lifecycle, shell is just the LLM backend |
| Respawn | From persisted world state on CLI launch | Workers resume where they left off, no lost state |

## Internal Architecture

### World State Event Flow

```
world state changes (action emitted or entity updated)
  ↓
world state manager calls workerManager.dispatchWorldEvent()
  ↓
worker manager iterates all idle workers
  ↓
for each worker: check subscriptions against event
  ↓
matching workers enter pipeline:
  perception (event filter match) → already done
  decision (rule engine) → should I act?
  action (execution backend) → LLM / decision tree / static
  ↓
action emits results back to world state
  ↓
cycle continues (other workers may react)
```

**Cycle protection:** A worker cannot react to its own actions. The dispatcher skips the originating worker when fanning out events from an action.

### Message Flow (User → Agent)

```
workerManager.send("Bob", message, { foreground: true })
  ↓
worker.send(message, opts)
  ↓
worker state: idle → reacting
  ↓
decision: message-received → respond
  ↓
worker state: reacting → working
  ↓
LLM backend: build prompt with conversation history
  spawn Claude CLI process
  stream events → terminal (foreground) + world state
  ↓
process exits → parse response
  ↓
if response.status === "question":
  worker state: working → waiting
  push notification (existing pattern)
else:
  worker state: working → idle
  ↓
world state updated with action
  ↓
other workers may react
```

### Task Execution Flow

```
workerManager.send("Bob", task, { task, briefPath })
  ↓
worker.send(task, opts)
  ↓
decision: task-assigned → execute-task
  ↓
worker state: idle → working
  ↓
LLM backend: spawn Claude CLI with brief
  stream events → world state (background)
  ↓
process exits → parse response
  ↓
if "question" → waiting + notification
if "message"/"ready" → complete task, check queue → next task or idle
if "error" → increment failure counter, check queue
```

## Files

### New (5)

| File | Responsibility |
|------|---------------|
| `src/domain/agents/worker-types.ts` | `AgentWorker`, `WorkerState`, `EventFilter`, `DecisionRule`, `SendOptions`, `ActionContext` types |
| `src/infrastructure/worker-manager.ts` | `IWorkerManager` implementation — spawn, stop, event fan-out, respawn, send routing |
| `src/domain/agents/decision-engine.ts` | `evaluateDecision()` pure function — rule matching, built-in rules |
| `src/domain/agents/action-handlers.ts` | Action execution — `executeTask`, `respond`, `review`, `respondFromState`, `acknowledge` |
| `src/infrastructure/agent-process-runner.ts` | `IAgentProcessRunner` — pure LLM process spawner (extracted from agent-shell) |

### Modified (7)

| File | Change |
|------|--------|
| `src/infrastructure/types.ts` | Add `IWorkerManager`, `IAgentProcessRunner` interfaces |
| `src/infrastructure/deps.ts` | Add `workerManager` to `CliDeps`. Replace `agentShell` with `processRunner` + `workerManager`. |
| `src/infrastructure/world-state-manager.ts` | Add event dispatch hook → `workerManager.dispatchWorldEvent()` on state changes |
| `src/main.ts` | Bootstrap worker manager, `spawnAll()` on start, `stopAll()` on exit |
| `src/ui/menus/agents-interact-menu.ts` | Simplify — `workerManager.send(name, message, { foreground: true })` |
| `src/ui/menus/roster-task-menu.ts` | Simplify — `workerManager.send(name, task, { task, briefPath })` |
| `src/ui/handlers/extensibility-handlers.ts` | All agent actions through `workerManager.send()` |

### Eventually Removed

| File | Reason |
|------|--------|
| `src/infrastructure/agent-shell.ts` | Replaced by `agent-process-runner.ts` (process spawning) + `worker-manager.ts` (lifecycle) |
| `src/infrastructure/agent-inbox.ts` | Inbox writing moves into action handlers |

### Not Changed

| File | Reason |
|------|--------|
| `agent-stream.ts` | Stream parsing unchanged — used by process runner |
| `agent-conversation.ts` | Prompt builders unchanged — used by action handlers |
| `world-state-types.ts` | Entity/action types unchanged — workers consume them |
| `configs/sitemap.json` | No new pages |

## Relationship to Other Specs

**Bottom bar + permissions spec:** Remains valid. Bottom bar actions call `workerManager.send()`. Permission detection moves to the worker's action stage (LLM backend detects stalled tool-use). Auto-prompt matching happens in the worker when processing LLM responses.

**World state model spec:** Foundation. Workers read/write world state via the state manager. Worker states are world state entity components. Actions from workers flow through the state manager.

**Long-lived agent processes spec:** Superseded. The respawn-with-history model is absorbed into the worker action stage. `PendingQuestion` notification becomes a worker in `"waiting"` state.

## Edge Cases

- **Worker reacts to its own action:** Prevented — dispatcher skips originating worker.
- **Cascade of reactions:** Worker A acts → Worker B reacts → Worker C reacts. Each step goes through the pipeline. No stack overflow because LLM calls are async (yielding the event loop).
- **Multiple messages to same worker:** If worker is `working`, new messages queue. Worker processes them after current action completes (FIFO).
- **Agent definition changed while worker running:** Worker reloads definition on next idle transition.
- **CLI exits during LLM call:** Process killed, world state flushed. On next launch, worker resumes from persisted state.
- **No LLM configured, no decision rules:** Worker responds with "I don't know how to handle that" static message.
- **Human avatar agent:** Worker state tracks the human's activity. Messages are forwarded as inbox notes. The human responds via CLI, response routed through worker.

## Testing

### worker-manager.test.ts
- `spawnAll` creates workers for all agent definitions
- `send` routes message to correct worker
- `dispatchWorldEvent` fans out to matching workers only
- Worker with no matching subscription does not react
- Worker respawn on crash (3 failures → stopped)
- `stopAll` stops all workers and kills LLM processes

### decision-engine.test.ts
- `task-assigned` trigger matches `execute-task` rule
- `message-received` trigger matches `respond` rule
- No matching rule returns null (no action)
- Higher priority rule wins when multiple match
- NPC rules (no LLM) return `respond-from-state`

### action-handlers.test.ts
- `execute-task` spawns LLM process with brief
- `respond` spawns LLM process with conversation prompt
- `respond-from-state` returns component data without LLM
- `acknowledge` emits task-acknowledged action

### agent-process-runner.test.ts
- Spawns Claude CLI with correct args
- Streams events via onEvent
- Result resolves with text + thinking + exit code
- kill() terminates process
