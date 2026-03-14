---
closedDate: 2026-03-14
resources:
  - Product Team||100
agents:
  - Bob|bob.md
type: IterationPlan
name: Agent Environment
number: 2
status: done
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









- [x] Document learnings
- [x] Capture retrospective notes
- [x] Review completed scope items
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
| 2026-03-14 | in-review | done | Iteration closed |
| 2026-03-14 | in-progress | in-review | Advanced to in-review |
| 2026-03-14 | ready | in-progress | Advanced to in-progress |
| 2026-03-14 | planned | ready | Advanced to ready |
| 2026-03-14 | new | planned | Replanned from Iteration Lifecycle Engine to Agent Environment |

## Notes

**2026-03-14** — Replanned iteration. Original "Iteration Lifecycle Engine" scope was already complete from prior work. Redirected to "Agent Environment" — making agents fully editable with AI configuration and a dedicated detail page. This fills the gaps from Iteration 1 (which only delivered create/delete) and sets up the agent management layer needed before orchestration can happen in Iteration 3.

## Learnings

1. **Companion JSON pattern works well for complex nested data** — Storing AI config (model, provider, contextWindow, maxTokens) in a `.json` file alongside the `.md` frontmatter avoids YAML nesting complexity. The `updateAgentJson()` read-merge-write approach is clean and extensible for future fields (goals, relationships, components).

2. **Array manipulation in YAML frontmatter needs careful regex** — Adding/removing items from YAML arrays (`skills`, `tools`, `roles`, `behaviors`) via regex requires handling edge cases: single-item arrays becoming empty, missing fields needing creation, and case-insensitive matching for user input. The `escapeRegex()` helper was essential.

3. **Complexity limit of 10 forces good decomposition** — `editAgentSkills` and `editAgentArrayField` both hit complexity 11 initially. Extracting `addSkillFlow`, `removeSkillFlow`, `addArrayFieldItem`, `removeArrayFieldItem` as focused helpers improved readability and kept each function under the threshold without feeling forced.

4. **Dynamic imports in handler registry keep the bundle lean** — Agent handlers use `await import("../menus/agents-menu.js")` instead of top-level imports. This means the agent menu code only loads when an agent action is actually invoked, not on every CLI startup.

5. **Sitemap hidden conditions enable mutually exclusive actions** — "Plan next Iteration" (`hidden: "iteration:running"`) and "Current Iteration" (`hidden: "iteration:not-running"`) share the same key `"w"` without conflict because they're never both visible. This pattern is reusable for any state-dependent action pairs.

6. **Skill serialization format (`name|level`) bridges YAML and structured data** — Skills need both a name and optional level, but live in a YAML array. The `name|level` pipe-delimited format for `addArrayItem`/`removeArrayItem` keeps the store API simple while supporting structured skill objects in the domain model.

## Retrospective

### What went well
- **Fast replanning** — Discovered the original Lifecycle Engine scope was already built, pivoted to Agent Environment within minutes without wasting effort
- **End-to-end delivery in one session** — All 4 phases (store → AI config → menus → sitemap) shipped with 81 new tests, full verification passing
- **Pattern reuse** — The markdown-store pattern from iteration-store and the companion JSON pattern from agent-store transferred directly; no new infrastructure needed
- **Test coverage** — Every new function has tests covering happy path, edge cases, and error handling (29 store tests, 28 menu tests, 24 handler tests)

### What could improve
- **Scope discovery earlier** — The lifecycle engine was already complete but we didn't check until planning. A quick `git log` or test run at plan time would have caught this sooner
- **Iteration plan structure** — The plan had "Push the Plan to Git" as both a planning and ready-phase item; could use clearer phase labels in scope items
- **Complexity budgeting** — Two functions hit the limit and needed extraction; estimating complexity during planning would avoid mid-implementation refactors

### Action items for next iteration
- Check existing implementation before planning scope (run tests, review git log)
- Budget complexity per function during task breakdown
- Consider adding `editAgentBehaviors` as a dedicated menu (currently uses generic `editAgentArrayField`)
- Plan the orchestration layer: agent-to-lifecycle-state bindings, handoff protocol, execution bridge
