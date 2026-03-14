---
agents:
  - Bob|bob.md
capacities:
  - Story Points|18|
  - Hours 180|180|h
resources:
  - Test Resource|Test Role|80
  - Another one||80
type: IterationPlan
name: The Agents
number: 1
status: ready
startDate: 2026-03-14
endDate: 2026-03-28
goal: We can add and manage Agent definitions
---

# #1 — The Agents

Core agent CRUD — define, persist, and manage agent entities as markdown files. Agents have a type (human/ai), name, description, skills (simplified GURPS profile), tools, and roles. The CLI provides full lifecycle management through the "Agents and AI Tools" hub. Markdown files are the source of truth; agents serialize cleanly to JSON for downstream consumption.

**Deferred to future iterations:**
- Agents executing Iteration Plans and Lifecycles (orchestration)
- AI-specific skills and tool invocation
- Role definitions with character-sheet requirements
- Agent-to-project attachment with role matching
- Human-to-AI agent supervision chains

## Goal

We can add and manage Agent definitions

## Resources

<!-- Add team members and their allocation. -->


## Capacities

<!-- Define capacity constraints (story points, hours, etc). -->


## Agents

<!-- Attach agent files from the agents folder. -->


## Scope Items




- [ ] Push the Plan to Git
- [ ] Kick-off communication
- [ ] Verify all prerequisites are met
- [x] Refine goal and vision
- [x] Identify initial scope items
- [x] Break scope into actionable tasks
- [x] Assign resources and capacity
- [ ] Define Agent entity model: name, type (human/ai), description, skills, tools, roles
- [ ] Agent markdown schema: frontmatter with all entity fields, body with sections
- [ ] Agent persistence: create, read, update, list, delete via markdown-store pattern
- [ ] Agent save path configurable via flowti.config.json (default: docs/agents)
- [ ] Agent serialization: markdown-to-JSON round-trip (read frontmatter + sections → typed object)
- [ ] CLI hub: manage agents via "Agents and AI Tools" page (list, add, view detail, edit, remove)
- [ ] Simplified skill profile: key-value pairs in agent frontmatter (skill: level)
- [ ] Agent tools: list of tool references in agent frontmatter
- [ ] Agent roles: list of role references in agent frontmatter
- [ ] Tests: full coverage for agent domain, store, display, and menu modules

## Notes

**2026-03-14** — Refined scope: split original 16 items into 10 actionable tasks for this iteration. Deferred orchestration (agents executing plans), role requirements, and AI-specific skills to future iterations. Focus is core agent CRUD with markdown persistence and CLI integration.
## Transition History

| Date | From | To | Reason |
|---|---|---|---|
| 2026-03-14 | planned | ready | Advanced to ready |
| 2026-03-14 | new | planned | Advanced to planned |
