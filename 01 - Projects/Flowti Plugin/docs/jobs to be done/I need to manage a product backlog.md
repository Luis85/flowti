---
type: Job to be Done
persona: "[[The Product Owner (Operational Strategist)]]"
domain: Flowti
plugin: "[[Development/flowti/README|README]]"
stage: draft
description: "Maintain a structured, prioritized product backlog with traceability to user value"
related_features: [Session Workspaces, Hubs, Event Catalog]
priority: high
---

## 1. Job Statement

**When** planning product increments,
**I need to** manage a structured backlog of PBIs with priorities and dependencies,
**so that** development effort is focused on the highest-value work.

### Job Context
Product owners need a living backlog that reflects current priorities, dependencies between items, and traceability back to user needs. Without a structured backlog inside the vault, prioritization decisions are disconnected from the architectural knowledge, event definitions, and domain documentation that inform them. This job is critical at the start of every cycle when deciding what to build next.

### Job Category
- **Type:** functional
- **Frequency:** weekly
- **Criticality:** blocking

## 2. Scope

### In Scope
- Creating and maintaining Product Backlog Items (PBIs) as vault notes
- Prioritization with ranking and MoSCoW labels
- Dependency tracking between PBIs
- Linking PBIs to user stories, requirements, and domain events
- Backlog grooming and refinement workflows

### Out of Scope
- Sprint planning and sprint backlog management (see session workspaces JTBD)
- Automated estimation or story point calculation
- External backlog tool sync (see [[I need to sync my Vault with Azure DevOps Boards]])

## 3. Success Criteria

| # | Criterion | Measurable? |
|---|-----------|-------------|
| 1 | PBIs have consistent frontmatter with priority, status, and dependencies | yes |
| 2 | Backlog can be sorted and filtered by priority and status | yes |
| 3 | Each PBI links to at least one requirement or user story | yes |
| 4 | Dependency graph is visible and navigable | yes |
| 5 | Backlog state is queryable via Dataview or Hubs | yes |

## 4. Current Alternatives

### Workarounds
- Obsidian Bases with manual table management (no structured schema)
- Azure DevOps Boards (disconnected from vault knowledge and documentation)
- Markdown checklists with no structured metadata or filtering

## 5. Form

### Feature Links

| Feature | Relationship | Coverage |
|---------|-------------|----------|
| [[Hubs]] | supporting | partial |
| [[Session Workspaces]] | supporting | partial |
| [[Event Catalog]] | supporting | partial |

### Flow Links

| Flow | Role |
|------|------|
| [[Backlog Refinement Flow]] | primary |
| [[Cycle Planning Flow]] | supporting |
