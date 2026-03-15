---
type: IterationPlan
name: Agents become autonomous
number: 5
status: planned
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




- [ ] Push the Plan to Git
- [ ] Assign resources and capacity
- [ ] Break scope into actionable tasks
### 0. Autonomous Mode Config (opt-in toggle)
- [ ] Add `autonomous?: boolean` to `AgentsConfig` in `types-config.ts` — defaults to `false`
- [ ] Add config validation for `agents.autonomous` in `config-validators.ts`
- [ ] When `autonomous: false` (default): `agent:run` generates the brief markdown file and stops — user gets the prompt file path to use manually
- [ ] When `autonomous: true`: `agent:run` generates the brief AND spawns the Claude CLI process
- [ ] UI shows mode clearly: "Brief generated at ..." vs "Agent spawned, streaming output..."
- [ ] Tests for both modes in runner and launch flow

### 1. Agent Runner Domain (`domain/agents/agent-runner.ts`)
- [ ] Define `AgentRunSpec` type (command, args, env, workingDir, briefPath)
- [ ] Implement `buildRunSpec(agentConfig, briefContent, projectPath)` — pure function that assembles the Claude CLI invocation from `AgentAIConfig` and brief markdown
- [ ] Implement `parseAgentOutput(raw)` — parse streamed output into structured events (progress, result, error)
- [ ] Tests for run spec generation and output parsing

### 2. Agent Process Infrastructure (`infrastructure/agent-process.ts`)
- [ ] Implement `AgentProcessManager` using `IShell.spawnBackground()` to spawn Claude CLI
- [ ] Write brief to temp file, pass as `--prompt-file` argument to Claude CLI
- [ ] Stream output via `BackgroundProcess.onOutput()` callbacks
- [ ] Implement process lifecycle: start, monitor status, stop/kill
- [ ] Tests with mock shell for process management

### 3. Agent Session Store (`domain/agents/agent-session.ts`)
- [ ] Define `AgentSession` type (id, agentName, iterationNumber, status, startedAt, outputLog, briefRef)
- [ ] Implement `createSession()`, `updateSession()`, `getSession()`, `listSessions()`
- [ ] Session statuses: `spawning → running → completed → failed`
- [ ] Persist sessions as markdown files in iterations/sessions/ directory
- [ ] Tests for session CRUD and status transitions

### 4. Agent Launch Flow (UI + Handlers)
- [ ] Add `agent:run` handler — select agent from roster → generate brief → spawn process
- [ ] Add `agent:run-brief` handler — run a specific existing brief file through Claude CLI
- [ ] Connect to iteration context (pass iteration number, project path)
- [ ] Add "Run Agent" action to agent-detail and iteration-detail sitemap pages
- [ ] Tests for handler registration and flow

### 5. Agent Output Display (`ui/displays/agent-output-display.ts`)
- [ ] Implement live output renderer that consumes `BackgroundProcess.onOutput()` stream
- [ ] Show agent name, status, elapsed time, and scrolling output
- [ ] Add `agent:status` handler to check running agent sessions
- [ ] Add "Agent Status" action to agents-hub sitemap page
- [ ] Tests for output formatting

### Meta (Phase Gate)
- [x] Refine goal and vision
- [x] Identify initial scope items
- [x] Push the Plan to Git

## Transition History

| Date | From | To | Reason |
|---|---|---|---|
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