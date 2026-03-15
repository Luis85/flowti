# Long-Lived Agent Processes — Notification-Driven Interaction

**Date**: 2026-03-15
**Status**: Approved
**Scope**: Replace fire-and-forget dispatch with long-lived agent processes that can ask questions, notify the user, and receive answers

## Problem

Agents dispatched in the background are fire-and-forget — they run one prompt and exit. If the agent needs human input (permissions, clarification, decisions), it's stuck. The user has no way to interact with a running agent. The talk and dispatch flows are artificially separate despite being the same operation.

## Decision

### Process Model

Each dispatched agent is a **logical session** backed by one or more Claude CLI processes. The first prompt is the brief or conversation message. When the agent responds:

- `status: "message"` or `"ready"` → task complete, check queue for next task
- `status: "question"` → agent needs input, enters `"waiting"` state, pushes notification
- `status: "error"` → task failed, check queue

When the user answers a question, the shell **respawns** a new Claude CLI process with the full conversation history (prior turns + user answer) prepended to the prompt. This provides continuity without keeping a process alive between turns.

Conversation history is already persisted via `agent-conversation-store.ts`. The dispatch pipeline reuses this for history accumulation.

**State transitions:**
```
idle → dispatch(brief) → busy
busy → response "message"/"ready" → check queue → next task or idle
busy → response "question" → waiting (notification pushed)
waiting → user answers → respawn with history → busy
busy → response "error" → check queue → next task or idle
busy → process crash → idle (health monitor recovers)
```

### Status Bar + Reserved Key

A persistent status bar renders at the bottom of every menu, before the input prompt. It shows the most recent agent notification.

```
  ⚡ Bobby: What framework should I use?  [! to respond]
```

- **Reserved key `!`**: Handled by `runMenu` before page actions (same pattern as `*` for refresh). User types `!` and presses Enter. Pauses current menu, displays agent question + input prompt, sends answer to agent, previous menu re-renders.
- **Multiple agents**: `!` addresses the oldest pending question. Status bar shows count: `⚡ 2 agents waiting — Bobby: What framework?  [! to respond]`
- **No pending questions**: Status bar not rendered. `!` key ignored.

### Talk vs Dispatch

Both `talk()` and `dispatch()` send a prompt to an agent and stream the response. They share the same parsing and response-handling logic but differ in UX:

- **`talk()`** is foreground — user watches output with spinner, response displays inline. Questions are answered inline in the conversation loop (no notification needed). `talk()` does NOT change — it keeps its current implementation.
- **`dispatch()`** is background — agent works autonomously. Questions become notifications answered via `!` key. The dispatch completion handler gains response-status awareness.

The shell gains two new methods:
- `pendingQuestions(): PendingQuestion[]` — returns all agents in `"waiting"` state, read from persistent state
- `answerAgent(agentName: string, answer: string): void` — loads context from state, rebuilds prompt with history + answer, writes to temp file, re-dispatches

### PendingQuestion Type

```typescript
export interface PendingQuestion {
	readonly agentName: string;
	readonly persona?: string;
	readonly question: string;
	readonly agent: AgentSummary;
	readonly briefPath: string;
	readonly task: string;
	readonly opts?: DispatchOptions;
}
```

This includes all context needed for respawn. The notification queue is `Map<string, PendingQuestion>` — keyed by agent name. Maps preserve insertion order in JS, so oldest-first iteration is guaranteed.

## Design Choices

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Process lifetime | Respawn per turn with history | Claude CLI `-p` exits after one response; respawning with history provides continuity |
| Notification delivery | Status bar + `!` reserved key | Non-intrusive, user answers when ready, consistent with `*` refresh pattern |
| Multiple agents | Oldest-first queue, count badge | Simple, fair, no complex UI |
| Answer flow | Single reply, return to menu | Quick in-and-out; agent continues autonomously after answer |
| Notification persistence | Persisted in agent state file | CLI restart recovers pending questions from `data-*.json` |
| `!` integration | Callback via `MenuOptions.onAgentQuestion` | Avoids coupling `menu.ts` to `IAgentShell` |
| Status bar renderer | `src/ui/displays/status-bar-display.ts` | Keeps ANSI rendering in UI layer |

## Internal Architecture

### Dispatch Completion Handler

The existing dispatch completion handler in `agent-shell.ts` gains response-status awareness:

```
on process exit:
  → parse response via parseAgentResponse
  → persist turn in conversation store (agent turn)
  → if status "question":
      → set agent state "waiting", write pendingQuestion to state file
      → push to in-memory notification queue
      → write inbox note (backup)
      → do NOT call completeFirstTask — task is still in progress
  → if status "message"/"ready":
      → mark task done via completeFirstTask
      → check queue → auto-dequeue next or set idle
  → if status "error":
      → mark task done, increment failure counter
      → check queue → auto-dequeue or idle
```

### Answer Flow

```
user types ! in any menu
  → runMenu calls options.onAgentQuestion() callback
  → callback calls shell.pendingQuestions() to get oldest
  → display: "Bobby asks: What framework?"
  → prompt: "Your answer:" via deps.input.ask()
  → callback calls shell.answerAgent(agentName, answer)
  → return "refresh" to re-render menu
```

### answerAgent Implementation

```
answerAgent(agentName, answer):
  → pop PendingQuestion from notification queue
  → load conversation from conversation store
  → append user answer as new turn, save conversation
  → build prompt via buildConversationPrompt(
      agent.name, systemPrompt, history, answer, character
    )
    where systemPrompt is read via readSystemPrompt(deps, vaultRoot, agent.name)
    and character is built from the stored AgentSummary
  → write prompt to temp file
  → call self.dispatch(pendingQ.agent, tempPath, pendingQ.task, pendingQ.opts)
```

The `PendingQuestion` stores the full `AgentSummary` so `answerAgent` has access to `ai` config, character traits, persona, and provider. The system prompt is read fresh from disk (it's a small file read).

### Status Bar Rendering

New file `src/ui/displays/status-bar-display.ts`:

```
renderStatusBar(questions: PendingQuestion[], log): void
  → if empty: return
  → oldest = questions[0]
  → who = oldest.persona ?? oldest.agentName
  → preview = oldest.question.slice(0, 60)
  → if questions.length > 1:
      log("  ⚡ {count} agents waiting — {who}: {preview}  [! to respond]")
  → else:
      log("  ⚡ {who}: {preview}  [! to respond]")
```

### `!` Key Integration in menu.ts

`runMenu` currently uses `input.ask("Choice")` and matches against menu items. The `*` key for refresh is handled as `if (choice === "*") return "refresh"`. The `!` key follows the same pattern but needs to call an async callback:

```typescript
// In runMenu, after the * check:
if (choice === "!" && options.onAgentQuestion) {
    const result = await options.onAgentQuestion();
    if (result) return result;
    continue; // re-render menu
}
```

`MenuOptions` gains: `onAgentQuestion?: () => Promise<MenuResult | undefined>`.

The callback is wired in `sitemap-router.ts` where `runMenu` is called with full access to `deps`:

```typescript
const menuResult = await runMenu(title, items, {
    onAgentQuestion: async () => {
        const questions = deps.agentShell.pendingQuestions();
        if (questions.length === 0) return undefined;
        // ... display question, prompt for answer, call answerAgent
        return "refresh";
    },
});
```

### Notification Persistence

The `PendingQuestion` data is persisted in the agent's `data-{name}.json` state file:

```typescript
export interface AgentState {
    // ... existing fields
    readonly pendingQuestion?: {
        readonly question: string;
        readonly briefPath: string;
        readonly task: string;
        readonly iterDir?: string;
        readonly iterationNumber?: number;
    };
}
```

On CLI startup, `pendingQuestions()` reads from both:
1. The in-memory notification queue (for questions received during this session)
2. All `data-*.json` files with `status: "waiting"` (for questions from previous sessions)

The `AgentSummary` is NOT persisted in state — it's resolved from the agent definition file at answer time via `findAgent()`. This avoids storing large objects in state files.

### State Transition Guards

`recordInteraction` preserves `"waiting"` status (same as it preserves `"busy"`):

```typescript
export function recordInteraction(state: AgentState, type: AgentInteractionType, timestamp: string): AgentState {
    return { ...state, lastInteraction: timestamp, lastInteractionType: type,
        status: (state.status === "busy" || state.status === "waiting") ? state.status : "active" };
}
```

`completeFirstTask` and `completeTask` do NOT override `"waiting"` to `"idle"`:

```typescript
const allDone = tasks.every((t) => t.status === "done");
return { ...state, tasks, status: allDone && state.status !== "waiting" ? "idle" : state.status };
```

`reconcileStaleAgents` skips `"waiting"` agents — they are intentionally paused:

```typescript
if (raw.status === "waiting") continue; // not stale, waiting for user input
```

## Agent State

Update the status type:

```typescript
export interface AgentState {
    readonly name: string;
    readonly status: "idle" | "active" | "busy" | "waiting";
    readonly lastInteraction?: string;
    readonly lastInteractionType?: AgentInteractionType;
    readonly tasks: readonly AgentTask[];
    readonly briefs: readonly AgentBriefRef[];
    readonly pendingQuestion?: {
        readonly question: string;
        readonly briefPath: string;
        readonly task: string;
        readonly iterDir?: string;
        readonly iterationNumber?: number;
    };
}
```

- `"busy"` = process running, working autonomously
- `"waiting"` = process exited, question pending, needs human input
- `"active"` = recently interacted (non-dispatched)
- `"idle"` = nothing happening

The start view banner shows both `"busy"` and `"waiting"` agents. `"waiting"` agents show the pending question.

## Files

### New (1)

| File | Responsibility |
|------|---------------|
| `src/ui/displays/status-bar-display.ts` | `renderStatusBar(questions, log)` — ANSI rendering of notification bar |

### Modified (7)

| File | Change |
|------|--------|
| `src/infrastructure/agent-shell.ts` | In-memory notification queue, `pendingQuestions()` (reads queue + state files), `answerAgent()` (rebuilds prompt, re-dispatches). Dispatch completion handler checks response status — "question" pushes notification, does NOT complete task. |
| `src/infrastructure/types.ts` | Add `PendingQuestion` interface. Add `pendingQuestions()` and `answerAgent()` to `IAgentShell`. Add `onAgentQuestion` to `MenuOptions`. |
| `src/infrastructure/menu.ts` | Handle `!` key via `options.onAgentQuestion` callback (same pattern as `*` refresh). Render status bar before input prompt via callback. |
| `src/infrastructure/sitemap-router.ts` | Wire `onAgentQuestion` callback when calling `runMenu`, with access to `deps`. |
| `src/domain/agents/agent-state.ts` | Add `"waiting"` to status type. Add `pendingQuestion` field to `AgentState`. Update `recordInteraction`, `completeFirstTask`, `completeTask` to preserve `"waiting"`. |
| `src/ui/handlers/register-handlers.ts` | Show `"waiting"` agents in start view banner with their pending question. |
| `src/infrastructure/agent-inbox.ts` | Write inbox note with question status when agent enters waiting. |

### Not Changed

| File | Reason |
|------|--------|
| `agent-conversation-store.ts` | Already persists conversation history — reused as-is |
| `agent-stream.ts` | Stream parsing unchanged |
| `agent-conversation.ts` | Prompt builders unchanged — `buildConversationPrompt` already supports history + character |
| `agents-interact-menu.ts` | `talk()` keeps its current implementation — questions are handled inline in the conversation loop |
| `roster-task-menu.ts` | Dispatch call unchanged — questions from dispatched agents go through notification |
| `configs/sitemap.json` | No new pages needed |

## Edge Cases

- **Agent asks question while user is answering another agent**: Answer queues. The next `!` press shows the next question.
- **User ignores question indefinitely**: Agent stays in `"waiting"` state. Inbox note serves as persistent reminder. Health monitor does NOT recover `"waiting"` agents.
- **Process crashes during work**: Health monitor recovers to idle (existing behavior). No question is pushed.
- **Same agent dispatched while waiting**: `dispatch()` checks if agent is in notification queue — clears the pending question and replaces with new dispatch.
- **Brief has no questions**: Agent completes normally — task marked done, auto-dequeue continues.
- **Empty answer**: User presses Enter without typing — sent as empty string, agent interprets.
- **CLI restart while agent is waiting**: `pendingQuestion` is persisted in `data-*.json`. On restart, `pendingQuestions()` reads state files and recovers the questions. `AgentSummary` is resolved from agent definition file via `findAgent()`.
- **Concurrent CLI sessions answering same agent**: `answerAgent` validates agent is still in `"waiting"` state before respawning. Second answer finds agent already `"busy"` and is ignored.
- **Conversation history size**: `getActiveHistory` has a `maxTurns` parameter (default 20). Respawn prompts use the same limit — agent sees the most recent 20 turns.
- **Agent asks multi-part question**: Treated as a single question. User gives one answer. Agent can ask follow-up questions in subsequent turns.

## Testing

### agent-shell.test.ts

- Dispatch with "question" response pushes to notification queue and does NOT complete task
- Dispatch with "message" response does not push notification, completes task
- `pendingQuestions()` returns waiting agents in insertion order
- `pendingQuestions()` reads from state files on cold start (no in-memory queue)
- `answerAgent()` pops from queue, rebuilds prompt with history, re-dispatches
- `answerAgent()` sets state from "waiting" to "busy", clears pendingQuestion from state
- `answerAgent()` is no-op when agent not in "waiting" state
- Multiple concurrent dispatches with independent notification queues
- Dispatch for agent already in "waiting" clears old notification

### menu.test.ts

- Status bar renders when pending questions exist (via beforeMenu callback)
- Status bar not rendered when no pending questions
- `!` key calls `onAgentQuestion` callback and returns result
- `!` key continues menu loop when no callback or callback returns undefined

### agent-state.test.ts

- `"waiting"` is a valid status value
- `recordInteraction` preserves `"waiting"` status
- `completeFirstTask` does not override `"waiting"` to `"idle"`
- `readAgentState` reads `pendingQuestion` field
- `writeAgentState` persists `pendingQuestion` field

### status-bar-display.test.ts

- Renders single agent question
- Renders count badge for multiple agents
- Does not render when no questions
- Truncates long question text

### reconcileStaleAgents

- Skips `"waiting"` agents (does not recover them to idle)
