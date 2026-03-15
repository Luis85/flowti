# Agent Worker Architecture

## Overview

Agents in Flowti CLI are no longer throwaway processes. Before this change, every agent interaction followed the same pattern: spawn a CLI process, get one response, tear it down. There was no memory between calls, no way for agents to observe what was happening in the project, and no execution model at all for non-AI agents like NPCs or human avatars.

The Agent Worker Architecture replaces that ephemeral model with persistent, reactive workers. Each agent becomes a long-lived in-memory object that subscribes to world state events, evaluates what it should do through a rule engine, and acts -- either by calling an LLM, responding from its own state, or simply acknowledging a task. The system handles hundreds of idle agents at zero cost because workers are objects in the Node.js event loop, not OS processes.

This is the foundation for autonomous agent behavior. Workers observe, decide, and act on their own, while still responding to direct messages exactly as before.

## What Changed

**Before:**
- Agents were ephemeral CLI processes -- spawn, get response, die
- A monolithic module handled lifecycle, notifications, state, and process spawning
- NPC agents had no execution model
- No reactivity to project changes

**After:**
- Agents are persistent in-memory workers managed by a WorkerManager supervisor
- One interface for all interactions: `workerManager.send(agentName, message, opts)`
- Every agent type (AI, NPC, human avatar) has a clear execution backend
- Workers subscribe to world state events and react through a pipeline
- LLM process spawning is handled by a focused `agent-process-runner` module

## How It Works

Every agent interaction -- whether a user message, a task assignment, or a world state change -- flows through a three-stage pipeline:

**Perception:** The worker subscribes to world state events via filters. When something changes (a task is assigned, an iteration moves, another agent speaks), the WorkerManager checks which workers have matching subscriptions and notifies them.

**Decision:** A matched worker evaluates its rules. The decision engine checks the trigger against a prioritized rule set and determines the action: execute a task, respond, review, acknowledge, or do nothing. Higher priority rules win when multiple match.

**Action:** The chosen action runs against the appropriate backend. AI agents spawn an LLM process via the process runner. NPC agents generate responses from their world state components. The result flows back into world state, where other workers may react to it.

```
Event arrives → Subscription match → Rule evaluation → Action execution → World state update
                                                                              ↓
                                                                    Other workers may react
```

## Worker Lifecycle

Workers move through seven states:

| State | Meaning |
|-------|---------|
| `spawning` | Worker is initializing |
| `idle` | Ready for messages or events |
| `reacting` | Event matched a subscription, evaluating rules |
| `thinking` | Lightweight LLM check: should I act? |
| `working` | Full action in progress (LLM call, static response) |
| `waiting` | Blocked on user input (pending question) |
| `stopped` | Shut down (explicit stop or 3 consecutive failures) |

The typical flow: `idle` -> `reacting` -> `working` -> `idle`. Messages that arrive while a worker is busy queue up and process in FIFO order when the worker returns to idle.

On CLI startup, the WorkerManager reads all agent definitions and spawns workers. Workers with pending tasks or `waiting` status from a previous session resume where they left off. On CLI exit, all workers stop and world state is flushed.

If a worker's LLM process crashes, the failure counter increments. After 3 consecutive failures on the same task, the worker enters `stopped`. On next CLI launch, it respawns fresh as `idle`.

## Agent Types

The architecture supports different agent types through different execution backends, unified behind the same `send()` interface.

**AI Agents** (`agentType: "ai"`): Messages and tasks go through the LLM. The process runner spawns a Claude CLI process, streams events, and returns the response. The worker manages the full lifecycle -- prompt building, streaming, result parsing, state transitions.

Built-in rules for AI agents:

| Trigger | Action | Priority |
|---------|--------|----------|
| `task-assigned` | `execute-task` | 10 |
| `message-received` | `respond` | 10 |
| `question-received` | `respond` | 10 |
| `iteration-changed` | `review` | 5 |
| `agent-mentioned` | `review` | 3 |

**NPC Agents** (non-AI): No LLM calls. Messages get a static response generated from the agent's world state components (identity, status, tasks). Task assignments are acknowledged immediately.

Built-in rules for NPC agents:

| Trigger | Action | Priority |
|---------|--------|----------|
| `message-received` | `respond-from-state` | 10 |
| `task-assigned` | `acknowledge` | 10 |

The caller never needs to know which type of agent it is talking to. `workerManager.send("Bob", "What's your status?")` works identically whether Bob is an AI agent or an NPC.

## World State Integration

Workers live inside the world state system. Each worker registers its agent as an entity with `identity` and `status` components. As workers transition through states, the world state updates in real time.

When any world state change occurs, the WorkerManager fans out the event to all workers (except the originating agent, to prevent self-reaction loops). Each worker checks its subscriptions, evaluates rules, and acts if appropriate.

This creates emergent behavior: an AI agent completes a task, emitting a world state action. Another agent subscribed to that project's changes reacts, reviews the output, and posts feedback. The cycle continues naturally through the event loop.

**Cycle protection** is built in. A worker cannot react to its own actions. The dispatcher skips the originating worker during fan-out. Since LLM calls are async and yield the event loop, deep reaction chains do not cause stack overflows.

## Configuration

Worker behavior inherits from the existing agents configuration in `flowti.config.json`:

| Option | Default | Effect |
|--------|---------|--------|
| `agents.provider` | `"anthropic"` | Default LLM provider for AI agents (`anthropic`, `cursor`, or custom binary) |
| `agents.processTimeoutMs` | `3600000` (1 hour) | Maximum time for a single LLM process before kill |
| Agent-level `ai.provider` | (inherits global) | Per-agent provider override |
| Agent-level `ai.allowedTools` | `[]` | Tools passed to the Claude CLI process |

Workers spawn automatically for all defined agents. No additional configuration is needed to enable the worker system.

## What's Next

**Custom subscriptions.** Agents will be able to declare event subscriptions in their definition files, enabling project-specific reactivity (e.g., "react when the build fails" or "review every PR").

**GOAP goals and behavior trees.** The decision engine's rule-based approach is a starting point. Goal-oriented action planning and behavior trees will enable complex autonomous behavior without hardcoded rules.

**Knowledgebase integration.** Workers will be able to search the vault knowledgebase (`03 - Resources/`) for context when responding to messages or executing tasks.
