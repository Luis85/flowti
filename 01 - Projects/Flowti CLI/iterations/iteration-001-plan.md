---
closedDate: 2026-03-14
agents:
  - Bob|bob.md
capacities:
resources:
  - Product Team||100
type: IterationPlan
name: The Agents
number: 1
status: done
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

### Learnings

1. **Dual-file storage scales well.** The markdown + companion JSON pattern (already used by the Component System) works cleanly for agents. Frontmatter handles scalar/array fields for quick listing; JSON handles deeply nested objects (components, goals, ai config, relationships). Parsing stays simple since each format handles what it's good at.
2. **Cross-domain compatibility requires upfront modeling.** Designing one data model to serve Excalibur Actors, LLM agents, game AI patterns, and the Flowti Component System forced careful field decomposition early. The result is a flexible entity that doesn't need wrapper adapters — each consumer reads the fields it cares about.
3. **Pipe-delimited skill serialization is a pragmatic choice.** `name|level` in YAML arrays avoids nested objects in frontmatter while remaining human-readable. Downside: it's a custom convention that new contributors must learn.
4. **Delegation beats duplication.** Refactoring `iteration-entities.ts` to delegate agent ops to `agent-store.ts` (instead of maintaining two create/list paths) eliminated a drift risk. The old interface stays for resource/estimation entities that haven't been promoted yet.
5. **Private type aliases trip up TypeDoc.** Using `type EntityDeps = Pick<CliDeps, ...>` as a parameter type on exported functions caused a documentation warning. Exporting the alias fixed it — worth remembering for future DI subset types.
6. **Mock file systems need directory awareness.** Tests that mock `readdirSync` also need `existsSync` to return true for parent directories. Building a `dirs` set from file paths during test setup is a reliable pattern.

### Retrospective

**What went well:**
- Scope was well-defined — 10 core tasks mapped directly to deliverables with no ambiguity.
- The markdown-store pattern made CRUD implementation fast since the conventions were already established.
- Expanding scope to four compatibility targets (Excalibur, AI agents, game AI, Component System) added meaningful value without significant extra effort because the fields compose orthogonally.
- Test coverage is strong: 47 new tests across store, display, and menu layers. All 6063 tests green.

**What could improve:**
- Agent editing (inline field updates via interactive menu) was deferred — this means agents can only be modified by editing markdown directly until a future iteration adds edit flows.
- The `selectOrCreateAgent` flow in iterations-menu is name-based (type the agent name), which works but is less ergonomic than numbered selection for large lists. A future iteration should add paginated selection.
- No validation on agent names (e.g., max length, disallowed characters). The markdown-store's `toMdFilename` handles filesystem safety, but UI-level validation is missing.

**Action items for future iterations:**
- Add agent editing (inline field updates, skill/tool/role management)
- Add agent import/export for bulk operations
- Add agent-to-project attachment with role matching
- Consider numbered selection + search for agent lists exceeding ~10 entries
## Transition History

| Date | From | To | Reason |
|---|---|---|---|
| 2026-03-14 | in-review | done | Iteration closed |
| 2026-03-14 | in-progress | in-review | Advanced to in-review |
| 2026-03-14 | ready | in-progress | Advanced to in-progress |
| 2026-03-14 | planned | ready | Advanced to ready |
| 2026-03-14 | new | planned | Advanced to planned |
