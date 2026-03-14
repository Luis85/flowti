---
type: IterationPlan
name: Agent Orchestration Layer
number: 3
status: in-progress
startDate: 2026-03-14
endDate: 2026-03-28
goal: Agents are bound to lifecycle phases and can generate/capture work briefs for iteration plans
description: Build the orchestration layer that connects agents to iteration lifecycle phases. An agent assigned to a phase gets a generated brief (plan context + system prompt + instructions), works externally, and its output is captured back into the plan. This is the foundation for the full PO → Architect → Developer pipeline.
---

# #3 — Agent Orchestration Layer

Iterations 1-2 delivered agent CRUD and editing. But agents are just data — they can't participate in iteration workflows yet. There's no way to say "this agent handles the planning phase" or to generate a context package for an AI agent to work from. This iteration builds the orchestration layer: agent-phase bindings, brief generation, and output capture.

**Deliverables:**
1. **Agent-Phase Bindings** — declare which agent is responsible at each lifecycle state, stored in project config (`management.iterations.orchestration`)
2. **Brief Generation** — generate a structured context package for the active agent: iteration goal, scope, agent system prompt, expected output format
3. **Plan File Watcher** — watch the iteration plan file on the detail page; auto-refresh when an external agent modifies it
4. **Orchestration UI** — show active agent on iteration detail, "Generate Brief" action, auto-refresh on file change

**Deferred to future iterations:**
- Auto-execution of briefs via AI tool integration (shell-out to Claude CLI, etc.)
- Multi-agent handoff chains (PO → UX → Architect in one flow)
- Agent work history and audit trail
- Agent capacity modeling and workload balancing
- PBI breakdown from scope items (requires backlog domain)

## Goal

Agents are bound to lifecycle phases and can generate/capture work briefs for iteration plans

## Resources

<!-- Add team members and their allocation. -->


## Capacities

<!-- Define capacity constraints (story points, hours, etc). -->


## Agents

<!-- Attach agent files from the agents folder. -->


## Scope Items











- [ ] Flag blockers early
- [ ] Track progress daily
- [x] Push the Plan to Git
- [x] Kick-off communication
- [x] Verify all prerequisites are met
- [x] Push the Plan to Git
- [x] Assign resources and capacity
- [x] Break scope into actionable tasks
- [x] Push the Plan to Git
- [x] Identify initial scope items
- [x] Refine goal and vision
- [ ] Break scope into actionable tasks
- [x] Phase 1: Agent-Phase Binding Model — add `OrchestrationConfig` type with phase-to-agent mappings
- [x] Phase 1: Config schema — add `management.iterations.orchestration` to flowti.config.json schema and validators
- [x] Phase 1: Resolve active agent — `getActiveAgent(bindings, currentState)` returns the agent assigned to the current lifecycle phase
- [x] Phase 1: Tests for binding model, config validation, and active agent resolution
- [x] Phase 2: Brief generation — `generateBrief(agent, iteration, bindings, deps)` produces structured markdown context package
- [x] Phase 2: Brief includes — agent system prompt, iteration goal/description, current scope items, lifecycle state, expected output format
- [x] Phase 2: Brief output — write brief to `iterations/briefs/iteration-NNN-<state>.md` and display in CLI
- [x] Phase 2: Tests for brief generation with various agent/iteration combinations
- [x] Phase 3: Plan file watcher — `PlanWatcher` class using existing `watchFile()` from filesystem.ts with hash-based change detection (same pattern as SitemapWatcher)
- [x] Phase 3: Watcher integration — iteration detail view handler starts watcher on entry, stops on navigation away
- [x] Phase 3: Auto-refresh — when plan file changes on disk, re-read iteration summary and re-render the detail page
- [x] Phase 3: Debounce — guard against rapid successive writes (agent may write multiple times); 500ms debounce window
- [x] Phase 3: Tests for PlanWatcher (start/stop, change detection, hash comparison, debounce)
- [x] Phase 4: Orchestration display — show active agent name and role on iteration detail page
- [x] Phase 4: "Generate Brief" action on iteration detail — calls brief generation for active agent
- [x] Phase 4: Sitemap updates — add orchestration actions to iteration-detail page
- [x] Phase 4: Handler registration — register orchestration action handlers
- [x] Phase 4: Tests for display, handlers, and sitemap integration
- [x] Phase 5: Create example agents — Product Owner and Software Architect with system prompts
- [x] Phase 5: Configure orchestration bindings in Flowti CLI project config
- [x] Phase 5: End-to-end walkthrough — create plan, generate brief, capture output, verify flow
- [x] Phase 5: Verify tsc, vitest, eslint, esbuild all pass

## Transition History

| Date | From | To | Reason |
|---|---|---|---|
| 2026-03-14 | ready | in-progress | Advanced to in-progress |
| 2026-03-14 | planned | ready | Advanced to ready |
| 2026-03-14 | new | planned | Advanced to planned |

## Notes

**Design Decisions:**

**Agent-Phase Binding Format** — Stored in `flowti.config.json` under `management.iterations.orchestration`:
```json
{
  "management": {
    "iterations": {
      "orchestration": {
        "phases": {
          "new": { "agent": "Product Owner", "role": "refiner", "instruction": "Refine the goal and identify initial scope" },
          "planned": { "agent": "Software Architect", "role": "planner", "instruction": "Break scope into actionable technical tasks" },
          "in-progress": { "agent": "Software Developer", "role": "implementer", "instruction": "Implement scope items and track progress" }
        }
      }
    }
  }
}
```

**Brief Format** — A self-contained markdown document that can be fed to any AI tool:
```markdown
# Agent Brief: Product Owner — Iteration #3
## Your Role
You are the Product Owner for this iteration. Your task is to refine the goal and identify initial scope.
## System Prompt
<contents of agent's .prompt.md file>
## Iteration Context
- **Goal**: <iteration goal>
- **State**: new → planned
- **Scope Items**: <current scope>
## Expected Output
Provide your response as:
- New scope items as `- [ ] Item text` (one per line)
- Notes or decisions as freeform text under a `## Notes` heading
```

**Plan File Watcher** — When the user is on the iteration detail page, a `PlanWatcher` monitors the plan `.md` file for changes. This enables the core agent workflow:
1. User clicks "Generate Brief" → brief is written to `iterations/briefs/`
2. External agent (Claude Code, ChatGPT, etc.) reads the brief and writes changes directly to the plan file
3. CLI detects the change, re-reads the iteration summary, and re-renders the detail page automatically
4. User sees updated scope items, notes, and status without manual paste

**Implementation** — Reuses the existing `watchFile()` from `filesystem.ts` (wraps `fs.watch()`). Same hash-based change detection pattern as `SitemapWatcher` to guard against spurious events on Windows. 500ms debounce to handle rapid successive writes. Watcher starts when entering iteration detail, stops when navigating away.

**Watcher architecture** — The iteration detail is a dynamic view (ViewHandler). Currently it renders once and returns. With the watcher, it needs to:
- Start watching the plan file before rendering
- Re-render on file change (clear + redraw)
- Stop watching when the user selects a menu action
- The `runMenu()` input loop handles user input; file change triggers a re-render of the header/content area above the menu prompt

**Why not auto-execute?** — The CLI is zero-dependency and doesn't include HTTP clients. Agent execution happens externally (user pastes brief into Claude Code, ChatGPT, etc.). Auto-execution via `ai-tools` shell commands is a future iteration enhancement.