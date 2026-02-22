---
type: Job to be Done
persona: "[[System Designer]]"
domain: Flowti
plugin: "[[Development/flowti/README|README]]"
stage: draft
description: "Design domain models, event contracts, and system architecture using structured tools"
related_features: [Event Catalog, Canvas Integration, Documentation Hub, Session Workspaces]
priority: medium
---

## 1. Job Statement

**When** starting a new domain or system design,
**I need to** structured design tools that guide me from concept to documented architecture,
**so that** designs are consistent, traceable, and reviewable.

### Job Context
Design work is where ideas become architecture. When a designer starts a new domain model, event contract, or system boundary definition, they need structured guidance — not a blank page. Without design tools that enforce consistency and enable traceability, each designer produces artifacts in their own format, making cross-team review and long-term maintenance difficult. This job is triggered whenever a new capability, domain, or system boundary is being defined.

### Job Category
- **Type:** functional
- **Frequency:** ad-hoc
- **Criticality:** important

## 2. Scope

### In Scope
- Designing domain models with bounded contexts and entity relationships
- Defining event contracts with producers, consumers, and schemas
- Modeling system architecture with service boundaries and dependencies
- Using Canvas for visual design exploration and node-to-note mapping
- Conducting design sessions within Session Workspaces for structured execution
- Registering design outputs in the Event Catalog

### Out of Scope
- Code scaffolding or generation from designs
- UML diagram generation (Canvas is the visual tool)
- Design approval workflows (see requirements JTBD)

## 3. Success Criteria

| # | Criterion | Measurable? |
|---|-----------|-------------|
| 1 | Design outputs are registered as typed entities in the Event Catalog | yes |
| 2 | Domain models have structured notes with consistent frontmatter | yes |
| 3 | Event contracts define producers, consumers, and payload schemas | yes |
| 4 | Canvas visualizations map to vault notes via Canvas Integration | yes |
| 5 | Design sessions are tracked in Session Workspaces with intent and reflection | yes |

## 4. Current Alternatives

### Workarounds
- Freeform notes with no structured templates or schemas
- External design tools (Miro, Lucidchart) with no vault integration
- Ad-hoc Canvas boards with no typed nodes or note linkage

## 5. Form

### Feature Links

| Feature | Relationship | Coverage |
|---------|-------------|----------|
| [[Event Catalog]] | primary | full |
| [[Canvas Integration]] | supporting | partial |
| [[Session Workspaces]] | supporting | full |
| [[Documentation Hub]] | supporting | full |

### Flow Links

| Flow | Role |
|------|------|
| [[Domain Design Flow]] | primary |
| [[Event Contract Design Flow]] | supporting |
