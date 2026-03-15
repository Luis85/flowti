# Bottom Bar + Permissions — Integrated Agent Control Surface

**Date**: 2026-03-15
**Status**: Approved
**Scope**: Persistent two-line bottom bar with action shortcuts, permission handling with tool usage tracking, Ask Bob, Ask Council, Ask Agent, Assign Task, Monitor

## Problem

The CLI has no persistent action surface — agent interactions require navigating to specific pages. Permission requests from agents are invisible (process stalls silently). Tool usage is untracked. There's no way to quickly ask an agent a question or check the environment without leaving the current context.

## Decision

### Bottom Bar

A persistent two-line bar renders at the bottom of every menu, before the input prompt. Line 1 shows notifications (agent questions + permission requests). Line 2 shows action shortcuts.

```
  ⚡ Bobby: What framework?     🔒 Alice needs: Bash
  [!] respond  [b] Ask Bob  [c] Council  [a] Ask Agent  [t] Task  [m] Monitor
```

**Line 1 — Notifications:**
- Left: agent questions (existing `⚡` status bar)
- Right: permission requests (new `🔒` urgent line)
- Empty when no notifications

**Line 2 — Action shortcuts:**
- Always rendered (provides discoverability)
- `!` — respond to oldest agent question (existing)
- `b` — Ask Bob (built-in agent, always available)
- `c` — Ask Council (round-robin prompt to roster agents)
- `a` — Ask Agent (pick from roster, single-turn question)
- `t` — Assign Task (quick task assignment to roster agent)
- `m` — Monitor (inline world state summary)

### Reserved Keys

All bottom bar keys are handled by `runMenu` before page actions, same pattern as `*` (refresh) and `!` (agent question). Each key triggers a callback injected via `MenuOptions`.

### Ask Bob

Reserved key `b`. Bob is Flowti's built-in general-purpose agent — always shipped, always available regardless of project roster.

Flow:
1. User types `b` + Enter
2. Prompt: "Ask Bob:"
3. User types question
4. Build conversation prompt with Bob's system prompt + character
5. `agentShell.talk(bob, prompt)` in foreground — spinner shows while waiting
6. Display response
7. Return to previous menu (refresh)

Bob's agent definition is resolved from the vault agents directory. If Bob doesn't exist (shouldn't happen), show an error.

### Ask Council

Reserved key `c`. Sends a question round-robin to each agent on the current project roster. Each agent sees the previous agents' responses, building a multi-perspective discussion.

Flow:
1. User types `c` + Enter
2. Prompt: "Question for the council:"
3. User types question
4. Resolve current project roster agents
5. For each agent sequentially:
   - Build prompt: original question + all prior responses
   - `agentShell.talk(agent, prompt)` — show spinner with agent name
   - Display response with agent persona
   - Append response to conversation for next agent
6. Display summary: "Council responded (N perspectives)"
7. Return to previous menu (refresh)

If no project is selected or roster is empty, show "No project roster available."

### Ask Agent

Reserved key `a`. Pick any agent and ask a single-turn question.

Flow:
1. User types `a` + Enter
2. Show numbered agent list (from vault agents, not just roster)
3. User picks agent
4. Prompt: "Ask {agent name}:"
5. User types question
6. Same talk flow as Ask Bob
7. Return to previous menu

### Assign Task

Reserved key `t`. Quick-assign from anywhere — delegates to existing `rosterTaskInteractive`.

Flow:
1. User types `t` + Enter
2. If no project selected: "No project selected"
3. Delegates to `rosterTaskInteractive(opts, deps)`
4. Return to previous menu

### Monitor

Reserved key `m`. Shows inline world state summary without navigating.

Flow:
1. User types `m` + Enter
2. Read world state via `deps.worldState.getState()`
3. Render with `renderWorldStateSummary(state, log)`
4. Wait for Enter
5. Return to previous menu (refresh)

## Permission Handling

### Detection

When an agent dispatches via Claude CLI and hits a tool permission wall, the process behavior is:
- Stream contains a `tool-start` event (e.g. `{ kind: "tool-start", name: "Edit", id: "t1" }`)
- No matching `tool-end` event follows
- Process exits (zero or non-zero)

The agent shell's completion handler detects this pattern: process exited AND there's an unmatched `tool-start` in the stream state (active tool with no `tool-end`).

### Notification

When a permission stall is detected, the shell:
1. Emits `requesting-permission` action to world state
2. Pushes a `PendingPermission` to a permission notification queue (similar to `PendingQuestion`)
3. The bottom bar line 1 shows: `🔒 Bobby needs: Edit  [p] Allow once  [P] Always  [d] Deny`

### Permission Response

Reserved key `p` / `P` / `d` for permission prompts (only active when a permission is pending):

- **`p` (Allow once)** — add tool to session-only list, respawn agent with expanded `--allowedTools`
- **`P` (Allow always)** — persist to world state permission table (global), update agent's `--allowedTools`, respawn
- **`d` (Deny)** — emit `permission-denied` action, drop to agent conversation for redirect

### PendingPermission Type

```typescript
interface PendingPermission {
	readonly agentName: string;
	readonly persona?: string;
	readonly tool: string;
	readonly agent: AgentSummary;
	readonly briefPath: string;
	readonly task: string;
	readonly opts?: DispatchOptions;
}
```

Similar to `PendingQuestion` — stores full context for respawn.

## Tool Usage Tracking

### TrackedTool Type

Every tool used by any agent is registered in the world state:

```typescript
interface TrackedTool {
	readonly name: string;
	readonly domain?: string;
	readonly description?: string;
	readonly totalUses: number;
	readonly lastUsedAt: string;
	readonly agents: Record<string, number>;
}
```

### Aggregation

Tool names are aggregated without parameters: `Edit src/main.ts` and `Edit src/foo.ts` both count as "Edit". The tool name comes from the `tool-start` stream event's `name` field, which is already the tool name without params.

### World State Extension

```typescript
interface WorldState {
	readonly version: 1;
	readonly updatedAt: string;
	readonly entities: Record<string, WorldEntity>;
	readonly permissions: PermissionTable;
	readonly tools: Record<string, TrackedTool>;
	readonly activityLog: readonly ActivityEntry[];
}

interface PermissionTable {
	readonly global: readonly PermissionEntry[];
	readonly agents: Record<string, readonly PermissionEntry[]>;
}
```

The `permissions` field changes from `Record<string, PermissionEntry[]>` to the `PermissionTable` structure with global + per-agent.

### Tracking Flow

On every `using-tool` action emitted to the world state manager:
1. Look up or create `TrackedTool` entry by tool name
2. Increment `totalUses`
3. Increment `agents[agentName]` count
4. Update `lastUsedAt`

### Tool Domains

Known tool domains assigned automatically:

| Tool | Domain |
|------|--------|
| Edit, Read, Write, Glob, Grep | filesystem |
| Bash | execution |
| WebFetch, WebSearch | network |
| Agent | orchestration |
| NotebookEdit | notebook |

Unknown tools get domain `"other"`.

### CLI Display

`flowti state` gains a tools section:

```
Tools (5 tracked)
  Edit       [filesystem]  42 uses — allowed globally
  Bash       [execution]   18 uses — Bobby: always, Alice: ask
  Read       [filesystem]  95 uses — allowed globally
  WebFetch   [network]      3 uses — no permissions set
  Agent      [orchestration] 7 uses — allowed globally
```

## Files

### New (2)

| File | Responsibility |
|------|---------------|
| `src/domain/agents/council.ts` | `buildCouncilPrompt()` — round-robin prompt builder |
| `tests/domain/agents/council.test.ts` | Council prompt tests |

### Modified (7)

| File | Change |
|------|--------|
| `src/domain/agents/world-state-types.ts` | Add `TrackedTool`, `PendingPermission`, `PermissionTable`. Update `WorldState` with `tools` field and new `permissions` structure. |
| `src/infrastructure/world-state-manager.ts` | Track tool usage on `using-tool` actions. Permission grant/deny methods. |
| `src/infrastructure/menu.ts` | Handle reserved keys `b`, `c`, `a`, `t`, `m`, `p`, `P`, `d` via callbacks. |
| `src/infrastructure/sitemap-router.ts` | Wire all bottom bar callbacks with deps access. |
| `src/ui/displays/status-bar-display.ts` | Two-line rendering: notifications + permissions + action shortcuts. |
| `src/infrastructure/agent-shell.ts` | Detect permission stalls (unmatched tool-start on process exit). Permission notification queue. |
| `src/ui/displays/state-display.ts` | Add tools section to world state summary. |

### Not Changed

| File | Reason |
|------|--------|
| `agent-state.ts` | No changes — world state is the authority |
| `agent-stream.ts` | Stream parsing unchanged — tool-start/tool-end already parsed |
| `configs/sitemap.json` | No new pages — bottom bar is menu-level |

## Auto-Prompt Phrases

Agent responses may contain phrases that should automatically prompt the user for a specific type of input, rather than entering the notification queue. This creates a more conversational feel — the agent asks "Does this look right?" and the user immediately sees a yes/no prompt.

### Phrase Map

```typescript
interface AutoPromptRule {
	readonly pattern: RegExp;
	readonly promptType: "binary" | "choice" | "text";
	readonly prompt: string;
	readonly options?: readonly string[];
}
```

**Built-in rules:**

| Pattern | Prompt Type | User Sees |
|---------|-------------|-----------|
| `Does this look right?` | binary | `Bobby: Does this look right? [y/n]:` |
| `Should I proceed?` | binary | `Bobby: Should I proceed? [y/n]:` |
| `Do you approve?` | binary | `Bobby: Do you approve? [y/n]:` |
| `Which option?` | text | `Bobby: Which option?:` |
| `Ready to (start\|begin\|continue)?` | binary | `Bobby: Ready to start? [y/n]:` |

### Detection

After parsing an agent response with `status: "question"`, the completion handler checks the message against the phrase map. If a match is found:

1. Instead of pushing to the `PendingQuestion` notification queue, surface an **inline prompt** immediately
2. The prompt type determines the UX:
   - `binary` → `[y/n]:` prompt (maps to "yes"/"no" answer)
   - `choice` → numbered options
   - `text` → free-text input
3. User's response is sent back via `answerAgent()` automatically

This only applies to **dispatched** agents (background). For `talk()` (foreground), questions are already handled inline in the conversation loop.

### Configurability

The phrase map is hardcoded initially. Future: allow users to add custom patterns in `.flowti/config.json`:

```json
{
  "agents": {
    "autoPrompts": [
      { "pattern": "Shall I deploy?", "type": "binary", "prompt": "Deploy now?" }
    ]
  }
}
```

### Files

| File | Change |
|------|--------|
| `src/domain/agents/auto-prompt.ts` | New — `matchAutoPrompt(message)` pure function, built-in rules |
| `src/infrastructure/agent-shell.ts` | Completion handler checks auto-prompt before pushing to notification queue |

## Edge Cases

- **No project selected**: Ask Council and Assign Task show "No project selected". Ask Bob, Ask Agent, and Monitor work regardless.
- **Bob not found**: Should not happen (shipped with CLI). Fallback: "Bob agent not found — run flowti claude:sync."
- **Empty roster for Council**: "No agents on the project roster."
- **Permission stall false positive**: If the process exits normally but had a tool that completed via a different code path, we might incorrectly detect a stall. Mitigation: only flag as permission stall if exit code is non-zero AND there's an unmatched tool-start.
- **Multiple permission requests**: Queue them like questions. `p`/`P`/`d` addresses the oldest.
- **Tool domain unknown**: Assigned "other" domain. User can update via future tool config.
- **Concurrent bottom bar keys**: Only one action runs at a time — the menu loop is sequential.
- **Council with one agent**: Works fine — just one response, no round-robin needed.

## Testing

### status-bar-display.test.ts
- Renders two-line bar with notifications + shortcuts
- Renders permission request on line 1
- Renders empty line 1 when no notifications
- Always renders line 2 shortcuts

### council.test.ts
- Builds prompt with single agent (no prior responses)
- Builds prompt with second agent including first agent's response
- Builds prompt with third agent including both prior responses
- Handles empty roster

### world-state-manager.test.ts (additions)
- `using-tool` action increments TrackedTool counter
- Tool usage aggregates across agents
- Permission grant updates permission table
- Global permission applies to all agents

### agent-shell.test.ts (additions)
- Detects permission stall (unmatched tool-start + non-zero exit)
- Does not flag permission stall on normal completion with tools
- Pushes PendingPermission on stall detection

### menu.test.ts (additions)
- Reserved key `b` triggers Ask Bob callback
- Reserved key `c` triggers Council callback
- Reserved key `m` triggers Monitor callback
- Keys ignored when no callback provided
