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
pending → acknowledged → in-progress → completed | failed
```

Flow:

1. Director clicks a suggested task in the tasks panel.
2. If the task has `input:`, an input modal appears with the prompt text and a text field.
3. Task is assigned to the agent via `store.assignTask()`.
4. Agent's LLM receives the task and acknowledges briefly.
5. Brain system transitions agent to `working` state and pathfinds to workstation.
6. Executor runs the tool command (if mapped), captures output.
7. Tool output (or just the task description for LLM-only tasks) is sent to the agent's LLM.
8. Agent works autonomously, emitting periodic status updates as thought bubbles.
9. Agent completes and reports back: speech bubble + talk tab entry + unread dot on roster avatar.

## Execution Router

The brain decides how to execute based on what the task declaration has:

| Has tool? | Behavior |
|-----------|----------|
| No | Send task as structured prompt to LLM, await response |
| Yes | Run tool command, pipe output to LLM for interpretation |

Every agent has an LLM (`agentType: ai`), so the LLM always gets the last word — even tool-only tasks get their output interpreted by the agent.

## Failure Handling

When a tool fails or the LLM encounters an issue, the agent interprets the failure through their domain lens and reports back in character. The agent owns the outcome and decides whether to retry or escalate. If genuinely stuck, the agent asks the Director for guidance as part of their natural response.

## Brain Integration

When a task is assigned:

1. `brain.assignWork(agentName)` transitions the agent to `working` state.
2. Agent pathfinds to their preferred workstation.
3. Agent sits at workstation for the duration of the task.
4. Talk engine switches to "working" phrases at reduced frequency.
5. On completion: `brain.releaseWork(agentName)` unfreezes the agent, resumes normal behavior.

## Status Updates

While working, the agent provides status through two channels:

1. **LLM thinking events** — intermediate responses from the LLM appear as thought bubbles at the workstation.
2. **Talk engine working phrases** — domain-relevant working phrases ("Running the test suite...", "Checking scope items...") at reduced frequency.

The agent should not be overly chatty — status updates are brief and infrequent.

## Completion Flow

When a task finishes (success or failure):

1. Task status updates to `completed` or `failed`.
2. Agent's LLM sends a summary response.
3. Brain releases the agent from the workstation.
4. Speech bubble shows a short summary over the agent's head.
5. Full result appears in the talk tab conversation.
6. Unread dot appears on the agent's avatar in the roster bar, cleared when the Director opens the talk tab.

## Input Modal

When a task has `input:text:prompt`:

- A modal overlays the tasks panel with the prompt text and a text input field.
- Submit assigns the task with the user's input attached.
- Cancel dismisses without assigning.
- The input value is passed to the LLM as part of the task prompt.

## Components

### 1. Task Descriptor Parser

**Location:** CLI domain — extends existing `parseSuggestedTask()`.

Parses the extended pipe-delimited format into:

```typescript
interface SuggestedTask {
  name: string;
  phases: string[];
  input?: { type: "text"; prompt: string };
  tool?: { command: string };
}
```

### 2. Input Modal

**Location:** Plugin UI — `panel-tasks.ts`.

Replaces the current confirm dialog when a task has `input:`. Shows the prompt text, a text field, and confirm/cancel buttons.

### 3. Task Executor

**Location:** Plugin — `DashboardStore`.

Orchestrates task execution:

- Sends acknowledgment prompt to agent LLM with task context.
- If tool: spawns the CLI command via `cliExecutor`, captures stdout/stderr.
- Pipes tool output (or task description for LLM-only) to the agent's LLM.
- Tracks task state transitions.
- Handles completion: updates status, triggers notification flow.

### 4. Brain Integration

**Location:** Plugin — `brain-system.ts`.

New methods:

- `assignWork(agentName: string)` — transitions to `working`, pathfinds to workstation, stays.
- `releaseWork(agentName: string)` — unfreezes, resumes normal idle behavior.

### 5. Unread Indicator

**Location:** Plugin — roster bar component.

A small dot on the agent's avatar when they have unread task results. Cleared when the Director opens the agent's talk tab.

## Files to Create/Modify

| File | Change |
|------|--------|
| `CLI: src/domain/agents/agent-types.ts` | Extend `SuggestedTask` with `input?` and `tool?` fields |
| `CLI: src/domain/agents/agent-store.ts` | Update `parseSuggestedTask()` for new format |
| `Plugin: src/game/data/types.ts` | Extended task types matching CLI |
| `Plugin: src/game/ui/panel-tasks.ts` | Input modal, richer task cards with progress |
| `Plugin: src/game/store/dashboard-store.ts` | Task executor, completion tracking, unread state |
| `Plugin: src/game/systems/brain-system.ts` | `assignWork()` / `releaseWork()` methods |
| `Plugin: src/game/ui/agent-panel.ts` or roster | Unread dot indicator |

## Non-Goals

- Task queuing (multiple tasks per agent) — future enhancement.
- Task delegation between agents — future enhancement.
- Persistent task history across sessions — tasks are session-scoped for now.
- Custom task creation from the UI — tasks come from agent definitions only.
