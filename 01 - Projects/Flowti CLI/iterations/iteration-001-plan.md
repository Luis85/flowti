---
agents:
  - Bob|bob.md
capacities:
resources:
  - Product Team||100
type: IterationPlan
name: The Agents
number: 1
status: in-review
startDate: 2026-03-14
endDate: 2026-03-28
goal: We can add and manage Agent definitions
---

# #1 — The Agents

Core agent CRUD — define, persist, and manage agent entities as markdown files. Agents have a type (human/ai), name, description, skills, tools, roles, domain, behaviors, goals, components, AI config, and relationships. The data model is compatible with Excalibur.js Actors (ECS components), AI agents (Claude/Cursor model config), game AI patterns (GOAP goals, behavior trees), and the Flowti Component System (domain, relationships). The CLI provides full lifecycle management through the "Agents and AI Tools" hub. Markdown frontmatter holds scalar/array fields; companion JSON holds complex nested objects (components, goals, ai, relationships).

**Deferred to future iterations:**
- Agents executing Iteration Plans and Lifecycles (orchestration)
- Agent-to-project attachment with role matching
- Human-to-AI agent supervision chains
- Agent editing (inline field updates via interactive menu)
- Agent import/export (bulk JSON operations)

## Goal

We can add and manage Agent definitions

## Resources

<!-- Add team members and their allocation. -->


## Capacities

<!-- Define capacity constraints (story points, hours, etc). -->


## Agents

<!-- Attach agent files from the agents folder. -->


## Scope Items









- [ ] Document learnings
- [ ] Capture retrospective notes
- [x] Review completed scope items
- [x] Flag blockers early
- [x] Track progress daily
- [x] Push the Plan to Git
- [x] Kick-off communication
- [x] Verify all prerequisites are met
- [x] Refine goal and vision
- [x] Identify initial scope items
- [x] Break scope into actionable tasks
- [x] Assign resources and capacity
- [x] Define Agent entity model: name, type (human/ai), description, skills, tools, roles
- [x] Agent markdown schema: frontmatter with all entity fields, body with sections
- [x] Agent persistence: create, read, update, list, delete via markdown-store pattern
- [x] Agent save path configurable via flowti.config.json (default: docs/agents)
- [x] Agent serialization: markdown-to-JSON round-trip (read frontmatter + sections → typed object)
- [x] CLI hub: manage agents via "Agents and AI Tools" page (list, add, view detail, remove)
- [x] Simplified skill profile: key-value pairs in agent frontmatter (skill: level)
- [x] Agent tools: list of tool references in agent frontmatter
- [x] Agent roles: list of role references in agent frontmatter
- [x] Tests: full coverage for agent domain, store, display, and menu modules
- [x] Cross-domain compatibility: Excalibur Actor (components), AI agents (model/prompt config), game AI (goals/behaviors), Component System (domain/relationships)
- [x] Companion JSON definition: complex nested objects alongside markdown (components, goals, ai, relationships)
- [x] Iteration-entities delegates agent creation to new agent store

## Notes

**2026-03-14** — Refined scope: split original 16 items into 10 actionable tasks for this iteration. Deferred orchestration (agents executing plans), role requirements, and AI-specific skills to future iterations. Focus is core agent CRUD with markdown persistence and CLI integration.

**2026-03-14** — All core scope items completed. Agent domain implemented with full CRUD (create, list, find, update field, delete) via markdown-store pattern. Data model expanded beyond original scope to support four compatibility targets: Excalibur.js Actors (ECS component attachment via `AgentComponent[]`), AI agents like Claude/Cursor (`AgentAIConfig` with model, provider, systemPrompt, contextWindow, maxTokens), game design AI patterns (GOAP-style `AgentGoal[]` with priority + condition, named `behaviors[]`), and the Flowti Component System (domain, `AgentRelationship[]` with types: supervises, reports-to, collaborates, delegates-to, uses, depends-on). Storage uses dual-file pattern: scalar/array fields in YAML frontmatter (.md), complex nested objects in companion JSON (.json) — same pattern as the component system. CLI hub updated with 4 agent actions on the "Agents and AI Tools" page. Iteration-entities refactored to delegate to the new agent store. 41 new tests added (6063 total), all passing. Zero lint errors, clean type check, build succeeds.
## Transition History

| Date | From | To | Reason |
|---|---|---|---|
| 2026-03-14 | in-progress | in-review | Advanced to in-review |
| 2026-03-14 | ready | in-progress | Advanced to in-progress |
| 2026-03-14 | planned | ready | Advanced to ready |
| 2026-03-14 | new | planned | Advanced to planned |
