---
type: Job to be Done
persona: "[[System Designer]]"
domain: Flowti
plugin: "[[Development/flowti/README|README]]"
stage: validated
description: "Design and document event-driven flows that trace how work moves through the system"
related_features: [Event Catalog, Documentation Hub, Canvas Integration]
priority: medium
---

## 1. Job Statement

**When** modeling how work moves through my system,
**I need to** design flows that connect events to domains and services,
**so that** the architecture is documented and traceable.

### Job Context
Event-driven systems require explicit documentation of how events flow between domains and services. Without structured flow design, the system architecture becomes implicit tribal knowledge. Designers need tools that let them define flows with typed steps, connect them to domain events, and visualize the paths work takes through the system. This is critical when onboarding new team members or evaluating the impact of architectural changes.

### Job Category
- **Type:** functional
- **Frequency:** weekly
- **Criticality:** important

## 2. Scope

### In Scope
- Creating flow definitions with typed steps and transitions
- Connecting flow steps to domain events, services, and actors
- Visualizing flows on Obsidian Canvas
- Cross-referencing flows in the Event Catalog Flows tab
- Documenting flow triggers, guards, and outcomes

### Out of Scope
- Runtime flow execution or orchestration
- BPMN-compliant notation (flows are documentation, not executable)
- Automated flow validation against live systems

## 3. Success Criteria

| # | Criterion | Measurable? |
|---|-----------|-------------|
| 1 | Flows appear in the Event Catalog Flows tab with correct metadata | yes |
| 2 | Each flow step references at least one domain event | yes |
| 3 | Flows can be rendered on Obsidian Canvas with node mapping | yes |
| 4 | Flow definitions use consistent frontmatter schema | yes |
| 5 | Cross-references between flows and events are bidirectional | yes |

## 4. Current Alternatives

### Workarounds
- Freeform Mermaid diagrams in markdown (no structured metadata)
- Whiteboard sketches photographed and attached to notes
- Unstructured Canvas boards with no typed nodes or event links

## 5. Form

### Feature Links

| Feature | Relationship | Coverage |
|---------|-------------|----------|
| [[Event Catalog]] | primary | full |
| [[Documentation Hub]] | supporting | full |
| [[Canvas Integration]] | supporting | partial |

### Flow Links

| Flow | Role |
|------|------|
| [[Flow Design Flow]] | primary |
| [[Event Registration Flow]] | supporting |
