---
type: IterationPlan
name: Agents become autonomous
number: 5
status: in-progress
startDate: 2026-03-14
endDate: 2026-03-28
goal: Agents are LLM backed
description: "An agent can have his own ai-agent as node process running. I can assign a task to an agent, and a thin wrapper gets created around claude cli and lets me prompt claude code with the generated markdown file to execute. The thin wrapper gets data in and streams data out"
---

# #5 — Agents become autonomous

An agent can have his own ai-agent as node process running. I can assign a task to an agent, and a thin wrapper gets created around claude cli and lets me prompt claude code with the generated markdown file to execute. The thin wrapper gets data in and streams data out

## Goal

Agents are LLM backed — each agent can be spawned as a background Node process that wraps the Claude CLI, receives a generated brief as input, and streams structured output back to the CLI. The Flowti CLI becomes an orchestration layer that assigns tasks to AI agents and monitors their execution.

## Resources

<!-- Add team members and their allocation. -->


## Capacities

<!-- Define capacity constraints (story points, hours, etc). -->


## Agents

<!-- Attach agent files from the agents folder. -->


## Scope Items










- [ ] Run all Reports once finished and review results
- [ ] Flag blockers early
- [ ] Track progress daily
- [x] Push the Plan to Git
- [x] Kick-off communication
- [x] Verify all prerequisites are met
- [x] Push the Plan to Git
- [x] Assign resources and capacity
- [x] Break scope into actionable tasks
### 0. Autonomous Mode Config (opt-in toggle)

**Modify** `src/infrastructure/types-config.ts`:
- [x] Add `autonomous?: boolean` to `AgentsConfig` — defaults to `false`

**Modify** `src/domain/project/config-validators.ts`:
- [x] Add validation: `agents.autonomous` must be boolean when present
- [x] Use existing `expectType(obj, "autonomous", "boolean", ...)` pattern

**Test** `tests/domain/project/config-validators.test.ts`:
- [x] Test valid config with `autonomous: true`
- [x] Test invalid config with `autonomous: "yes"` produces warning

### 1. Agent Runner Domain (pure — no I/O)

**Create** `src/domain/agents/agent-runner.ts`:
- [x] Define `AgentRunSpec` — `{ command: string; args: readonly string[]; env: Record<string,string>; workingDir: string; briefPath: string }`
- [x] Define `AgentOutputEvent` — discriminated union: `progress | result | error | raw`
- [x] Implement `buildRunSpec(ai: AgentAIConfig, briefPath: string, projectPath: string): AgentRunSpec` — assembles `claude --print --prompt-file <path>` with model/max-tokens from `AgentAIConfig`
- [x] Implement `buildClaudeArgs(ai: AgentAIConfig, briefPath: string): string[]` — pure arg builder
- [x] Implement `parseAgentOutput(line: string): AgentOutputEvent` — classify raw output lines into structured events

**Test** `tests/domain/agents/agent-runner.test.ts`:
- [x] `buildRunSpec` produces correct command and args from AgentAIConfig
- [x] `buildRunSpec` defaults to `"claude"` when no command configured
- [x] `buildRunSpec` includes `--model` when `ai.model` is set
- [x] `buildRunSpec` includes `--max-tokens` when `ai.maxTokens` is set
- [x] `parseAgentOutput` classifies progress, result, error, and raw lines

### 2. Agent Process Infrastructure (I/O layer)

**Create** `src/infrastructure/agent-process.ts`:
- [x] Define `AgentProcessDeps = Pick<CliDeps, "disk" | "shell" | "paths" | "clock" | "log">`
- [x] Define `AgentProcessHandle` — `{ sessionId: string; process: BackgroundProcess; startedAt: string; subscribe(cb): ()=>void; stop(): void }`
- [x] Implement `writeBriefToFile(deps, iterDir, content, agentName): string` — write brief markdown to `iterations/briefs/` and return path
- [x] Implement `launchAgent(deps, spec: AgentRunSpec): AgentProcessHandle` — call `deps.shell.spawnBackground()`, wire `onOutput()` through `parseAgentOutput()`, return handle
- [x] Implement `checkClaudeInstalled(deps): boolean` — `deps.shell.check("claude --version")` with graceful fallback

**Test** `tests/infrastructure/agent-process.test.ts`:
- [x] `launchAgent` calls `shell.spawnBackground` with correct command from spec
- [x] `subscribe` receives parsed `AgentOutputEvent` events
- [x] `stop` calls `process.kill()`
- [x] `checkClaudeInstalled` returns false when shell.check fails
- [x] `writeBriefToFile` writes content and returns path

### 3. Agent Session Store (pure domain — markdown persistence)

**Create** `src/domain/agents/agent-session.ts`:
- [x] Define `SessionStatus = "spawning" | "running" | "completed" | "failed"`
- [x] Define `AgentSession` — `{ id, agentName, iterationNumber, status, startedAt, completedAt?, briefRef, outputLines }`
- [x] Define `SessionStoreDeps = Pick<CliDeps, "disk" | "paths" | "clock">`
- [x] Implement `createSession(deps, iterDir, agentName, iterNum, briefRef): AgentSession` — generate ID, write frontmatter markdown to `iterations/sessions/`
- [x] Implement `updateSessionStatus(deps, iterDir, sessionId, status): boolean` — update frontmatter status field
- [x] Implement `appendOutput(deps, iterDir, sessionId, lines: string[]): boolean` — append to `## Output` section
- [x] Implement `getSession(deps, iterDir, sessionId): AgentSession | null` — read and parse session markdown
- [x] Implement `listSessions(deps, iterDir, iterNum?): AgentSession[]` — list all sessions, optionally filtered by iteration

**Test** `tests/domain/agents/agent-session.test.ts`:
- [x] `createSession` writes markdown with frontmatter and returns session object
- [x] `updateSessionStatus` transitions status in frontmatter
- [x] `appendOutput` appends lines under `## Output` section
- [x] `getSession` parses frontmatter and output lines from markdown
- [x] `listSessions` filters by iteration number prefix
- [x] `listSessions` returns empty array when sessions dir missing

### 4. Agent Launch Flow (UI + Handlers)

**Create** `src/ui/menus/agents-run-menu.ts`:
- [x] Implement `runAgentInteractive(agent, iteration, autonomous, deps): Promise<void>` — orchestrates: generate brief → save → if autonomous: launch process + show output; else: show brief path
- [x] Implement `runBriefInteractive(briefPath, autonomous, deps): Promise<void>` — reads existing brief → if autonomous: build spec + launch; else: show path
- [x] Implement `selectBriefInteractive(iterDir, iterNum, deps): Promise<string | null>` — list briefs, user picks one

**Modify** `src/ui/handlers/extensibility-handlers.ts`:
- [x] Register `agent:run` handler — resolve agent from `ctx.params.agentName`, load autonomous config, call `runAgentInteractive()`
- [x] Register `agent:run-brief` handler — call `selectBriefInteractive()` → `runBriefInteractive()`
- [x] Add condition `agents:autonomous-enabled` — reads `FlowtiCliConfig.agents.autonomous`

**Modify** `configs/sitemap.json`:
- [x] Add "Run Agent" action to `agent-detail` page: `{ name: "onRun", label: "Run Agent", type: "handler", target: "agent:run", group: "execution" }`
- [x] Add "Run Brief" action to `iteration-detail` page: `{ name: "onRunBrief", label: "Run Brief", type: "handler", target: "agent:run-brief", group: "execution" }`

**Test** `tests/ui/menus/agents-run-menu.test.ts`:
- [x] `runAgentInteractive` in prompt-only mode saves brief and logs path
- [x] `runAgentInteractive` in autonomous mode launches process
- [x] `runBriefInteractive` reads existing brief and builds spec
- [x] `selectBriefInteractive` lists briefs for iteration

**Test** `tests/ui/handlers/extensibility-handlers.test.ts` (update):
- [x] `agent:run` handler calls runAgentInteractive
- [x] `agent:run-brief` handler calls runBriefInteractive

### 5. Agent Output Display (presentation only)

**Create** `src/ui/displays/agent-run-display.ts`:
- [x] Implement `renderBriefGenerated(briefPath, agentName, log): void` — "Brief generated at ..." with path
- [x] Implement `renderAgentSpawned(session, log): void` — "Agent spawned: ..." with name, model, session ID
- [x] Implement `renderAgentOutput(event: AgentOutputEvent, log): void` — format progress/result/error/raw with ANSI colors
- [x] Implement `renderAgentComplete(session, log): void` — completion summary with duration and output line count
- [x] Implement `renderSessionList(sessions, log): void` — table with agent name, status, started, duration

**Modify** `src/ui/handlers/extensibility-handlers.ts`:
- [x] Register `agent:status` handler — list sessions, render with `renderSessionList()`

**Modify** `configs/sitemap.json`:
- [x] Add "Agent Status" action to `ai-tools` page: `{ name: "onStatus", label: "Agent Status", type: "handler", target: "agent:status", group: "execution" }`

**Test** `tests/ui/displays/agent-run-display.test.ts`:
- [x] `renderBriefGenerated` includes file path
- [x] `renderAgentSpawned` includes agent name and session ID
- [x] `renderAgentOutput` formats each event kind differently
- [x] `renderSessionList` shows all sessions with status

### Meta (Phase Gate)
- [x] Refine goal and vision
- [x] Identify initial scope items
- [x] Push the Plan to Git

## Transition History

| Date | From | To | Reason |
|---|---|---|---|
| 2026-03-15 | ready | in-progress | Advanced to in-progress |
| 2026-03-15 | planned | ready | Advanced to ready |
| 2026-03-15 | new | planned | Advanced to planned |

## Notes

### Product Owner Refinement (2026-03-15)

**Refined vision**: The core idea is a thin orchestration layer. Flowti CLI already generates rich briefs (markdown prompts with role context, system prompts, scope, and DoD). The missing piece is spawning a Claude CLI process, feeding it the brief, and streaming results back. This iteration builds that bridge.

**Architecture decisions**:
- **Opt-in autonomous mode**: `agents.autonomous` in vault-level `FlowtiCliConfig` defaults to `false`. When off, the CLI generates the brief markdown and gives you the file path — you run it through Claude CLI yourself. When on, the CLI spawns the process automatically. This keeps the brief generation valuable on its own (prompt engineering tool) while making execution an opt-in upgrade. The toggle lives at vault level (`FlowtiCliConfig.agents`) because it's a CLI capability, not a per-project setting.
- **Domain purity preserved**: `agent-runner.ts` is pure — it builds a run spec (command + args) from config, no I/O. The infrastructure layer (`agent-process.ts`) handles actual process spawning via the existing `IShell` abstraction.
- **Reuse existing infrastructure**: `IShell.spawnBackground()` and `BackgroundProcess` already support output streaming with `onOutput()` callbacks and `waitForOutput()` pattern matching. No new process primitives needed.
- **Sessions as markdown**: Agent sessions persist as markdown files (consistent with iterations, briefs, and other CLI entities). This keeps everything inspectable in the vault.
- **Brief as prompt**: The existing brief generator produces complete, role-aware prompts. We pass these directly to Claude CLI via `--prompt-file` — no additional prompt engineering layer needed.

**Dependency order**: Runner domain (1) → Process infrastructure (2) → Session store (3) → Launch flow (4) → Output display (5). Items 1-3 are independent and can be parallelized. Items 4-5 depend on all three.

**Risks**:
- Claude CLI may not be installed or may require authentication — need graceful error handling and clear messaging
- Output streaming format from Claude CLI may vary — parser needs to be resilient
- Long-running agent processes need timeout handling to prevent zombie processes
- Brief size may exceed Claude CLI's input limits for very large iterations

**Existing assets leveraged**:
- `AgentAIConfig` (model, provider, systemPrompt, contextWindow, maxTokens) already in agent definitions
- `agents:talk` handler pattern for interactive agent conversation
- `dashboard-service.ts` pattern for managing background server processes
- Brief generator with "When You Are Done" self-update instructions

### Software Architect — Implementation Plan (2026-03-15)

**Execution order** (strict dependency chain):

```
Phase A (parallel — no dependencies):
  0. Config toggle           → types-config.ts, config-validators.ts
  1. Runner domain (pure)    → agent-runner.ts (new)
  3. Session store (pure)    → agent-session.ts (new)

Phase B (depends on A):
  2. Process infrastructure  → agent-process.ts (new) — uses IShell + runner types

Phase C (depends on A + B):
  4. Launch flow             → agents-run-menu.ts (new), extensibility-handlers.ts, sitemap.json
  5. Output display          → agent-run-display.ts (new), sitemap.json
```

**File inventory** (4 new, 4 modified):

| Action | File | Layer |
|--------|------|-------|
| MODIFY | `src/infrastructure/types-config.ts` | Infrastructure |
| MODIFY | `src/domain/project/config-validators.ts` | Domain |
| CREATE | `src/domain/agents/agent-runner.ts` | Domain (pure) |
| CREATE | `src/domain/agents/agent-session.ts` | Domain (pure) |
| CREATE | `src/infrastructure/agent-process.ts` | Infrastructure |
| CREATE | `src/ui/menus/agents-run-menu.ts` | UI |
| CREATE | `src/ui/displays/agent-run-display.ts` | UI |
| MODIFY | `src/ui/handlers/extensibility-handlers.ts` | UI |
| MODIFY | `configs/sitemap.json` | Config |

**Test inventory** (4 new, 2 modified):

| Action | File |
|--------|------|
| CREATE | `tests/domain/agents/agent-runner.test.ts` |
| CREATE | `tests/domain/agents/agent-session.test.ts` |
| CREATE | `tests/infrastructure/agent-process.test.ts` |
| CREATE | `tests/ui/menus/agents-run-menu.test.ts` |
| CREATE | `tests/ui/displays/agent-run-display.test.ts` |
| MODIFY | `tests/ui/handlers/extensibility-handlers.test.ts` |
| MODIFY | `tests/domain/project/config-validators.test.ts` |

**Architecture decisions**:

1. **Two-mode design**: The `autonomous` flag is a clean gate. Brief generation (deliverables 0-1, 3) always executes. Process spawning (deliverable 2) only activates when `autonomous: true`. This means the prompt engineering workflow is always available — even without Claude CLI installed.

2. **Claude CLI as the runtime**: We wrap `claude` (the Claude Code CLI) not the Anthropic API directly. This gives us: local file access, tool use, agentic loops, and streaming — all without building our own agent runtime. The `--print` flag runs non-interactively, `--prompt-file` accepts our brief markdown.

3. **Session = audit trail**: Each agent run creates a session markdown file. This gives full traceability: who ran, when, what brief, what output. Sessions live alongside briefs in the iterations directory tree.

4. **AgentProcessHandle wraps BackgroundProcess**: The infrastructure layer translates raw `BackgroundProcess.onOutput()` lines through `parseAgentOutput()` into typed events. Consumers never touch raw process output.

5. **No new infrastructure abstractions**: `IShell.spawnBackground()` and `BackgroundProcess` are sufficient. No new process manager interface needed — `agent-process.ts` is a utility module, not a new singleton.

6. **Sitemap-driven as always**: New actions registered in sitemap.json, handlers in extensibility-handlers.ts. The `agent:run` action on the agent-detail page, `agent:run-brief` on iteration-detail, `agent:status` on agents-hub.