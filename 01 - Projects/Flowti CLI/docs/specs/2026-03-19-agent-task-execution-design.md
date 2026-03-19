---
type: DesignSpec
title: Agent Task Execution System
date: 2026-03-19
status: approved
---

# Agent Task Execution System — Design Spec

## Problem

Agents have suggested tasks visible in the tasks panel, but clicking "assign" only tracks the task visually. No actual execution happens. The Director has no way to delegate real work to agents.

## Solution

A hybrid task execution system where agents receive tasks, route them through their brain (tool, LLM, or both), work autonomously at their workstation, and report back when done.

## Task Definition Format

Extends the existing pipe-delimited `suggestedTasks` in agent markdown frontmatter:

```yaml
suggestedTasks:
  - Refine iteration goal|new|input:text:What is the iteration goal?
  - Run test suite|any|tool:flowti test --format=json
  - Backlog refinement|new,planned
  - Review acceptance criteria|in-review|input:text:Which scope item?
  - Generate reports|any|tool:flowti reports --format=json
  - Code review|ready|input:text:Which file or PR?|tool:flowti review
```

Format: `name|phases|input:type:prompt|tool:command`

- All segments after phases are optional and order-independent.
- A task with no `input:` or `tool:` is pure LLM.
- A task with `tool:` only runs the command and has the LLM interpret results.
- A task with `input:` prompts the Director for input before assignment.
- A task with both gets user input, runs the tool, and has the LLM interpret.

## Task Lifecycle

```
pending → in-progress → completed | failed
```

State transitions:

- **pending**: Task assigned, agent LLM receives acknowledgment prompt. Brain transitions agent to `working` state and begins pathfinding to workstation.
- **in-progress**: Agent is at workstation executing. Triggered when the agent reaches the workstation and execution begins (tool spawn or LLM prompt sent).
- **completed**: Agent's LLM sent a final response. Brain releases agent. Notification flow fires.
- **failed**: Tool errored or LLM reported failure. Same notification flow as completed, but with failure context.

Flow:

1. Director clicks a suggested task in the tasks panel.
2. If the task has `input:`, an input modal appears (in-panel overlay, same pattern as existing confirm dialog) with the prompt text and a text field.
3. Task is assigned via `store.executeTask(agentName, task)` with the full `SuggestedTask` object and optional user input string.
4. Store adds task to `assignedTasks` as `pending`, calls `brain.assignWork(agentName)`.
5. Agent's LLM receives the task prompt and acknowledges briefly.
6. Brain pathfinds agent to workstation. On arrival, store transitions task to `in-progress`.
7. If tool: store spawns the command via Node `child_process.execFile()` (not via `cliExecutor.assignTask`), captures stdout/stderr.
8. Tool output (or just the task description for LLM-only tasks) is sent to the agent's LLM via the existing `proc.send()`.
9. Agent works autonomously. Thinking events from the LLM trigger the existing bubble system via `handleCliEvent`.
10. Agent's final response marks the task `completed` (or `failed`). Store calls `brain.releaseWork(agentName)`.
11. Notification: speech bubble + talk tab entry + unread dot on roster avatar.

## Task Data Flow

The structured task object flows entirely within the Plugin — the CLI's `agent:task` command is not used for execution.

```
panel-tasks.ts: user clicks task
  → has input? show input modal, collect value
  → store.executeTask(agentName, suggestedTask, userInput?)
      → assignedTasks.push({ ...task, status: "pending" })
      → brain.assignWork(agentName)
      → build task prompt (task.name + userInput + tool instruction)
      → proc.send(taskPrompt)
      → if task.tool: execFile(task.tool.command) → capture output → proc.send(toolOutput)
      → listen for "response" event → mark completed, releaseWork, notify
```

The `SuggestedTask` type with `input?` and `tool?` is parsed from frontmatter in the CLI domain (extending `parseSuggestedTask()`). The Plugin mirrors this type in its own `types.ts`. The Plugin's `loadAgentCards()` (vault adapter) also parses this format for the sidepanel.

## Execution Router

The store decides how to execute based on what the task declaration has:

| Has tool? | Behavior |
|-----------|----------|
| No | Send task as structured prompt to LLM, await response |
| Yes | Run tool command via `child_process.execFile()`, pipe output to LLM for interpretation |

Every agent has an LLM (`agentType: ai`), so the LLM always gets the last word — even tool-only tasks get their output interpreted by the agent.

Tool commands run from the vault root directory. The command string is split on whitespace for `execFile` args. Stdout and stderr are captured and sent to the agent's LLM as a structured message: `[Tool output for "${taskName}"]\n\n${stdout}\n\n${stderr ? "[stderr]\n" + stderr : ""}`.

## Failure Handling

When a tool fails (non-zero exit) or the LLM encounters an issue, the agent interprets the failure through their domain lens and reports back in character. The agent owns the outcome. If genuinely stuck, the agent asks the Director for guidance as part of their natural response. Task status is set to `failed`.

## Brain Integration

BrainSystem states (actual): `idle | wandering | walking-to | working | talking | waiting | on-break`.

New methods:

- `assignWork(agentName: string)` — Sets a `taskLocked` flag on the brain entry, transitions to `walking-to` targeting the agent's preferred workstation, then to `working`. While `taskLocked` is true, the existing `updateWorking()` timer is suppressed — the agent stays at the workstation indefinitely until `releaseWork` is called.
- `releaseWork(agentName: string)` — Clears `taskLocked`, transitions to `idle`. The agent resumes normal wandering behavior on the next brain update cycle.

The `taskLocked` flag is a boolean on the `BrainEntry` internal type. When true:
- `updateWorking()` skips the `focusDuration` timer check.
- `updateIdle()` is not reached (agent stays in `working`).
- The agent does not respond to social system proximity triggers.

## Status Updates

While working, the agent provides status through two channels:

1. **LLM thinking events** — The existing `handleCliEvent` receives `"thinking"` events and updates `llmStatus`. The bubble system's `showBubble()` is called from the engine's action pipeline to display these as thought bubbles over the agent at the workstation.
2. **Talk engine working phrases** — The talk engine's `activate()` method (already used for LLM waiting) switches to rapid working phrases. On task assignment, `talkEngine.activate(agentName)` is called. On completion, `talkEngine.silence(agentName)` is called.

The agent should not be overly chatty — the talk engine's 3-7s rapid interval combined with the global stagger provides natural pacing.

## Completion Flow

When a task finishes (success or failure):

1. Task status updates to `completed` or `failed` in `assignedTasks`.
2. Agent's LLM sends a summary response (appears in talk tab via existing `handleCliEvent` → `pushAgentResponse`).
3. `brain.releaseWork(agentName)` clears `taskLocked`, agent transitions to `idle`.
4. `talkEngine.silence(agentName)` stops working chatter.
5. `bubbleSystem.showBubble()` displays a short summary over the agent's head.
6. `store.unreadAgents.add(agentName)` sets the unread flag.

## Unread Indicator

New state in DashboardStore:

```typescript
unreadAgents: Set<string> = new Set();
```

- **Set**: When task completes/fails, `unreadAgents.add(agentName)`.
- **Clear**: When the Director selects the agent AND switches to the talk tab: `store.selectTab("talk")` side-effect clears `unreadAgents.delete(store.selectedAgent)`.
- **Render**: The roster bar's `renderCard()` checks `store.unreadAgents.has(agent.name)` and shows a small colored dot on the avatar.

## Input Modal

When a task has `input:text:prompt`:

- An overlay appears inside the panel-tasks shadow DOM (same `position: absolute; inset: 0` pattern as the existing confirm dialog).
- Shows the prompt text, a text input field, and confirm/cancel buttons.
- Submit calls `store.executeTask(agentName, task, inputValue)`.
- Cancel dismisses without assigning.
- The input value is included in the task prompt sent to the LLM.

## Task Prompt Format

The prompt sent to the agent's LLM for a task:

```
[Task Assignment]
Task: ${task.name}
${userInput ? `Director's input: ${userInput}` : ""}

Execute this task. When done, report your results concisely.
${task.tool ? `A tool has been dispatched: "${task.tool.command}". Its output will follow. Interpret the results and summarize for the Director.` : "Work through this using your expertise. Report when complete."}
```

If a tool is mapped, the tool output is sent as a follow-up message after the initial acknowledgment.

## Components

### 1. Task Descriptor Parser

**Location:** CLI domain — extends existing `parseSuggestedTask()` (currently file-scoped, needs export for testing).

Parses the extended pipe-delimited format. Segments after `phases` are scanned for `input:` and `tool:` prefixes.

```typescript
interface SuggestedTask {
  name: string;
  phases: string[];
  input?: { type: "text"; prompt: string };
  tool?: { command: string };
}
```

**Plugin mirror:** The Plugin's `loadAgentCards()` in `agent-handlers.ts` also parses `suggestedTasks` from frontmatter. A shared `parseSuggestedTask()` utility is added to the Plugin's domain types, duplicating the CLI's parsing logic (the Plugin does not import from the CLI source).

### 2. Input Modal

**Location:** Plugin UI — `panel-tasks.ts`.

In-panel overlay (same pattern as existing confirm dialog). Replaces the confirm dialog when a task has `input:`.

### 3. Task Executor

**Location:** Plugin — `DashboardStore`.

New method `executeTask(agentName, task, userInput?)`:

- Adds to `assignedTasks` with status `pending`.
- Calls `brain.assignWork(agentName)`.
- Builds and sends task prompt to agent LLM via `proc.send()`.
- If tool: spawns command via `child_process.execFile()` from vault root.
- Listens for LLM "response" event to mark completion.
- Handles the full notification flow.

The existing `assignTask(agentName, task: string)` method remains for backward compatibility but `executeTask` is the primary entry point for task execution.

### 4. Brain Integration

**Location:** Plugin — `brain-system.ts`.

New methods and `taskLocked` flag on `BrainEntry`:

- `assignWork(agentName)` — Sets `taskLocked = true`, pathfinds to workstation, enters `working`.
- `releaseWork(agentName)` — Clears `taskLocked`, transitions to `idle`.
- `updateWorking()` — Existing method gains an early return: `if (entry.taskLocked) return;` before the `focusDuration` timer check.

### 5. Unread Indicator

**Location:** Plugin — DashboardStore (`unreadAgents: Set<string>`) + roster bar component (dot render).

## Files to Create/Modify

| File | Change |
|------|--------|
| `CLI: src/domain/agents/agent-types.ts` | Extend `SuggestedTask` with `input?` and `tool?` fields |
| `CLI: src/domain/agents/agent-store.ts` | Update + export `parseSuggestedTask()` for new format |
| `Plugin: src/game/data/types.ts` | Extended task types with `input?`, `tool?`, add `acknowledged`/`failed` status |
| `Plugin: src/game/ui/panel-tasks.ts` | Input modal, richer task cards with progress |
| `Plugin: src/game/store/dashboard-store.ts` | `executeTask()`, `unreadAgents`, completion tracking |
| `Plugin: src/game/systems/brain-system.ts` | `taskLocked` flag, `assignWork()` / `releaseWork()` |
| `Plugin: src/game/ui/agent-panel.ts` | Pass `unreadAgents` to roster, clear on talk tab select |
| `Plugin: src/game/ui/roster-bar.ts` (or equivalent) | Unread dot on avatar |
| `Plugin: src/infrastructure/handlers/agent-handlers.ts` | Parse `suggestedTasks` extended format in `loadAgentCards()` |

## Non-Goals

- Task queuing (multiple tasks per agent) — future enhancement.
- Task delegation between agents — future enhancement.
- Persistent task history across sessions — tasks are session-scoped for now.
- Custom task creation from the UI — tasks come from agent definitions only.
