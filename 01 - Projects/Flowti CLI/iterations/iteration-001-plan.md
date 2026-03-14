---
capacities:
  - Story Points|18|
  - Hours 180|180|h
resources:
  - Test Resource|Test Role|80
  - Another one||80
type: IterationPlan
name: The Agents
number: 1
status: planned
startDate: 2026-03-14
endDate: 2026-03-28
goal: We can add and manage Agent definitions
---

# #1 — The Agents

We can define Agents from different types, humans and ai. We can give them names, description, tools and a GURPS compatible character-sheet. Projects define their resource needs through roles. Roles can have a character sheet which can be used as a skill profile and requirement for Agents before they can be attached to a Project. I can create an human agent, and attach ai-agents to him. We can define Roles, usable in Projects and Agents. Roles can define things like "User", "Administrator", "UX Designer". Roles can have requirements visualized as a character sheet which is GURPS compatible. Projects can define their requirements also through the other resource types. Agents can also define requirements. A Role can also have requirements in regards of tools. At the end of the day, we want to manage a bunc of human or ai agents, attach them to projects, assign them tasks

## Goal

We can add and manage Agent definitions

## Resources

<!-- Add team members and their allocation. -->


## Capacities

<!-- Define capacity constraints (story points, hours, etc). -->


## Agents

<!-- Attach agent files from the agents folder. -->


## Scope Items
- [x] Refine goal and vision
- [x] Identify initial scope items
- [ ] Break scope into actionable tasks
- [ ] Assign resources and capacity
- [ ] I can add and manage Agents in the "Agents and AI Tools" hub
- [ ] When creating a new Agent it creates an agent definition as markdown file in docs/agents
- [ ] markdown files are the source of truth for the system
- [ ] agents can have tools
- [ ] agents can have roles
- [ ] agents can have character-sheets (simplified GURPS skill-profile)
- [ ] agents have names
- [ ] agents have descriptions
- [ ] agents must be serializable from markdown to json
- [ ] the agents docs save path must be configurable
- [ ] agents can have skills
- [ ] ai-agents can have ai-skills

## Notes

<!-- Track progress and decisions during the iteration. -->
## Transition History

| Date | From | To | Reason |
|---|---|---|---|
| 2026-03-14 | new | planned | Advanced to planned |
