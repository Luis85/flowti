---
agents:
  - Bob|bob.md
type: IterationPlan
name: Agent Environment
number: 2
status: planned
startDate: 2026-03-14
endDate: 2026-03-28
goal: Agents are fully editable with AI configuration and a dedicated detail page
description: Build the agent management environment — inline editing for all fields, AI config editing (model, provider, systemPrompt), agent detail page in the sitemap, and system prompt file generation.
---

# #2 — Agent Environment

Iteration 1 delivered core agent CRUD (create, list, view, delete) with a cross-domain compatible data model. But agents can only be created or deleted — there's no way to edit an existing agent's fields, configure its AI settings interactively, or navigate to a dedicated agent detail page. This iteration builds the full agent management environment.

**Deliverables:**
1. **Agent editing** — inline field updates for all scalar/array fields (name, type, description, domain, skills, tools, roles, behaviors) via interactive menu
2. **AI config editing** — interactive flow for setting model, provider, systemPrompt, contextWindow, maxTokens on AI agents; writes companion JSON
3. **Agent detail page** — dedicated sitemap page (`agent-detail`) with view, edit, and AI config actions
4. **System prompt file** — AI agents can have a `.prompt.md` file alongside their markdown; viewable and editable from the CLI

**Deferred to future iterations:**
- Agents executing Iteration Plans and Lifecycles (orchestration)
- Agent-to-project attachment with role matching
- Human-to-AI agent supervision chains
- Agent import/export (bulk JSON operations)
- Relationship editing (add/remove relationships interactively)
- Goal and component editing (add/remove via interactive menu)

## Goal

Agents are fully editable with AI configuration and a dedicated detail page

## Resources

<!-- Add team members and their allocation. -->


## Capacities

<!-- Define capacity constraints (story points, hours, etc). -->


## Agents

<!-- Attach agent files from the agents folder. -->


## Scope Items

- [x] Refine goal and vision
- [x] Identify initial scope items
- [x] Break scope into actionable tasks
- [ ] Push the Plan to Git
- [ ] Phase 1: Agent field editing — updateAgent() in agent-store for scalar fields (name, description, domain, agentType)
- [ ] Phase 1: Agent array editing — addSkill, removeSkill, addTool, removeTool, addRole, removeRole, addBehavior, removeBehavior in agent-store
- [ ] Phase 1: Tests for all agent field update and array edit functions
- [ ] Phase 2: AI config editing — updateAIConfig() in agent-store that reads/writes companion JSON
- [ ] Phase 2: System prompt file — readSystemPrompt(), writeSystemPrompt() in agent-store (reads/writes <name>.prompt.md)
- [ ] Phase 2: Tests for AI config and system prompt operations
- [ ] Phase 3: Agent edit menu — editAgentInteractive() with submenu for each field group (identity, skills, tools, roles, AI config)
- [ ] Phase 3: AI config interactive — editAIConfigInteractive() prompts for model, provider, systemPrompt, contextWindow, maxTokens
- [ ] Phase 3: System prompt interactive — editSystemPromptInteractive() shows current prompt, allows replacement
- [ ] Phase 3: Tests for edit menu flows
- [ ] Phase 4: Agent detail page — add "agent-detail" to sitemap.json with view, edit, AI config, system prompt, delete actions
- [ ] Phase 4: Register agent detail view handler in extensibility-handlers
- [ ] Phase 4: Update "ai-tools" page — navigate to agent-detail instead of flat view
- [ ] Phase 4: Tests for handler and navigation updates
- [ ] Phase 5: Verify tsc, vitest, eslint, esbuild all pass
- [ ] Document learnings
- [ ] Capture retrospective notes

## Transition History

| Date | From | To | Reason |
|---|---|---|---|
| 2026-03-14 | new | planned | Replanned from Iteration Lifecycle Engine to Agent Environment |

## Notes

**2026-03-14** — Replanned iteration. Original "Iteration Lifecycle Engine" scope was already complete from prior work. Redirected to "Agent Environment" — making agents fully editable with AI configuration and a dedicated detail page. This fills the gaps from Iteration 1 (which only delivered create/delete) and sets up the agent management layer needed before orchestration can happen in Iteration 3.
