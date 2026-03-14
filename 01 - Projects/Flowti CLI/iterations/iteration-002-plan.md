---
resources:
  - Product Team||100
agents:
  - Bob|bob.md
type: IterationPlan
name: Agent Environment
number: 2
status: in-review
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









- [ ] Document learnings
- [ ] Capture retrospective notes
- [ ] Review completed scope items
- [x] Flag blockers early
- [x] Track progress daily
- [x] Push the Plan to Git
- [x] Kick-off communication
- [x] Verify all prerequisites are met
- [x] Refine goal and vision
- [x] Identify initial scope items
- [x] Break scope into actionable tasks
- [x] Push the Plan to Git
- [x] Phase 1: Agent field editing — updateAgentField() in agent-store for scalar fields (description, domain)
- [x] Phase 1: Agent array editing — addArrayItem(), removeArrayItem() in agent-store for skills, tools, roles, behaviors
- [x] Phase 1: Tests for all agent field update and array edit functions (11 tests)
- [x] Phase 2: AI config editing — updateAgentJson() in agent-store that reads/writes companion JSON
- [x] Phase 2: System prompt file — readSystemPrompt(), writeSystemPrompt() in agent-store (reads/writes <name>.prompt.md)
- [x] Phase 2: Tests for AI config and system prompt operations (5 tests)
- [x] Phase 3: Agent edit menus — editAgentIdentity, editAgentSkills, editAgentArrayField in agents-menu.ts
- [x] Phase 3: AI config interactive — editAIConfigInteractive() prompts for model, provider, contextWindow, maxTokens
- [x] Phase 3: System prompt interactive — editSystemPromptInteractive() shows current prompt, allows replacement
- [x] Phase 3: Tests for edit menu flows (15 tests)
- [x] Phase 4: Agent detail page — added "agent-detail" to sitemap.json with 8 actions (identity, skills, tools, roles, AI, prompt, remove, back)
- [x] Phase 4: Registered 6 agent edit action handlers + agent-detail view handler in extensibility-handlers
- [x] Phase 4: Updated "ai-tools" page — "View Agent" navigates to agent-detail
- [x] Phase 4: Tests for handler and navigation updates (24 tests)
- [x] Phase 5: Verified tsc, vitest (6089 tests), eslint, esbuild all pass

## Transition History

| Date | From | To | Reason |
|---|---|---|---|
| 2026-03-14 | in-progress | in-review | Advanced to in-review |
| 2026-03-14 | ready | in-progress | Advanced to in-progress |
| 2026-03-14 | planned | ready | Advanced to ready |
| 2026-03-14 | new | planned | Replanned from Iteration Lifecycle Engine to Agent Environment |

## Notes

**2026-03-14** — Replanned iteration. Original "Iteration Lifecycle Engine" scope was already complete from prior work. Redirected to "Agent Environment" — making agents fully editable with AI configuration and a dedicated detail page. This fills the gaps from Iteration 1 (which only delivered create/delete) and sets up the agent management layer needed before orchestration can happen in Iteration 3.
