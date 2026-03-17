---
type: Job to be Done
persona: "[[Knowledge Worker]]"
domain: Flowti
plugin: "[[Development/flowti/README|README]]"
stage: draft
description: "Track entities, progress, and state changes across the vault"
related_features: [Session Workspaces, Event Catalog, Hubs]
priority: low
---

## 1. Job Statement

**When** managing work across my vault,
**I need to** track the state and progress of entities (sessions, tasks, features, products),
**so that** nothing falls through the cracks.

### Job Context
Knowledge workers manage dozens of entities in various states — sessions in progress, tasks awaiting review, features partially implemented, products in different lifecycle stages. Without a unified tracking mechanism, state changes are invisible, stale items accumulate, and the vault becomes a graveyard of forgotten commitments. This is felt most acutely during weekly reviews, session planning, and when returning to work after time away, when the user needs to quickly understand what needs attention.

### Job Category
- **Type:** functional
- **Frequency:** daily
- **Criticality:** important

## 2. Scope

### In Scope
- Viewing the current state of any tracked entity (session, task, feature, product)
- Filtering and sorting entities by status, owner, and last-updated date
- Receiving notifications when entity states change (via Inbox)
- Querying entity progress via dashboards and Hubs
- Activity intelligence surfacing what needs attention

### Out of Scope
- Defining entity schemas and types (see [[I need to manage something]])
- Project-level progress rollup and reporting (see [[I need to manage a project]])
- Automated state transitions (future capability)

## 3. Success Criteria

| # | Criterion | Measurable? |
|---|-----------|-------------|
| 1 | All tracked entities have a visible status in their frontmatter | yes |
| 2 | Entities can be filtered by status, type, and last-updated date | yes |
| 3 | Stale entities (no update in configurable period) are surfaced for review | yes |
| 4 | Session Workspaces show execution task progress in real time | yes |
| 5 | Hub dashboards provide at-a-glance tracking across entity types | yes |

## 4. Current Alternatives

### Workarounds
- Manual review of individual notes to check status
- Dataview queries written ad-hoc for each tracking need
- External task managers (Todoist, Trello) disconnected from vault context

## 5. Form

### Feature Links

| Feature | Relationship | Coverage |
|---------|-------------|----------|
| [[Session Workspaces]] | primary | partial |
| [[Event Catalog]] | supporting | partial |
| [[Hubs]] | supporting | partial |

### Flow Links

| Flow | Role |
|------|------|
| [[Entity Tracking Flow]] | primary |
| [[Activity Review Flow]] | supporting |
