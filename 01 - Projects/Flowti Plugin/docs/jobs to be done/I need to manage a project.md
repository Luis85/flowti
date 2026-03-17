---
type: Job to be Done
persona: "[[Delivery Manager (Systems Orchestrator)]]"
domain: Flowti
plugin: "[[Development/flowti/README|README]]"
stage: draft
description: "Plan and track project execution with sessions, tasks, and progress visibility"
related_features: [Session Workspaces, Signal Integration, Hubs]
priority: medium
---

## 1. Job Statement

**When** running a project,
**I need to** plan sessions, track execution tasks, and monitor progress,
**so that** delivery is transparent and risks are surfaced early.

### Job Context
Delivery managers juggle multiple workstreams, sessions, and execution tasks across a project's lifecycle. Without structured project tracking inside the vault, progress is invisible, risks hide until they become blockers, and session outcomes are disconnected from overall project health. This becomes critical during cycle planning, standup reviews, and stakeholder reporting when delivery status must be communicated clearly and backed by data.

### Job Category
- **Type:** functional
- **Frequency:** daily
- **Criticality:** blocking

## 2. Scope

### In Scope
- Project definition with goals, timeline, and stakeholders
- Session planning and linking sessions to project milestones
- Execution task tracking with status and ownership
- Progress monitoring and health indicators
- Risk surfacing through session reflections and task blockers

### Out of Scope
- Product strategy and lifecycle management (see [[I need to manage a product]])
- Backlog prioritization and refinement (see [[I need to manage a product backlog]])
- RAID log management (see [[I need to manage a RAID Log]])

## 3. Success Criteria

| # | Criterion | Measurable? |
|---|-----------|-------------|
| 1 | Project notes have consistent frontmatter with status, timeline, and ownership | yes |
| 2 | Sessions are linked to the project and their outcomes roll up to project progress | yes |
| 3 | Execution tasks have clear status, owner, and blockers visible in dashboards | yes |
| 4 | Azure DevOps work items sync into project context via Signal Integration | yes |
| 5 | Project health is queryable via Hubs or Dataview | yes |

## 4. Current Alternatives

### Workarounds
- Azure DevOps Boards for task tracking with no vault integration
- Manual status notes updated ad-hoc with no structured rollup
- Spreadsheet-based project trackers disconnected from execution context

## 5. Form

### Feature Links

| Feature | Relationship | Coverage |
|---------|-------------|----------|
| [[Session Workspaces]] | primary | partial |
| [[Signal Integration]] | supporting | partial |
| [[Hubs]] | supporting | partial |

### Flow Links

| Flow | Role |
|------|------|
| [[Project Execution Flow]] | primary |
| [[Session Lifecycle Flow]] | supporting |
