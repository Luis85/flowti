---
type: Job to be Done
persona: "[[The Product Owner (Operational Strategist)]]"
domain: Flowti
plugin: "[[Development/flowti/README|README]]"
stage: draft
description: "Organize problem space documentation with structured domains, actors, and systems"
related_features: [Documentation Hub, Event Catalog, Hubs]
priority: medium
---

## 1. Job Statement

**When** documenting what problems we're solving,
**I need to** structured templates for domains, actors, and systems,
**so that** the problem space is well-defined before solutions are designed.

### Job Context
Before any solution can be designed, the problem space must be clearly articulated. This means identifying the domains involved, the actors who participate, and the systems that currently exist. Without structured templates and consistent schemas, problem space documentation becomes scattered across freeform notes, making it impossible to verify coverage or identify gaps. This job is foundational — every other JTBD depends on a well-documented problem space.

### Job Category
- **Type:** functional
- **Frequency:** monthly
- **Criticality:** important

## 2. Scope

### In Scope
- Creating domain definitions with structured frontmatter
- Documenting actors with roles, responsibilities, and system interactions
- Cataloging existing systems with capabilities and boundaries
- Linking domains, actors, and systems together via cross-references
- Using Documentation Hub file-driven entity templates

### Out of Scope
- Solution architecture documentation (see [[I need to structure my solution documentation]])
- Requirements specification (see [[I need to document Requirements]])
- Event modeling and flow design (see [[I need to design a flow]])

## 3. Success Criteria

| # | Criterion | Measurable? |
|---|-----------|-------------|
| 1 | Every domain has a structured note with consistent frontmatter | yes |
| 2 | Actors are documented with roles and system interaction maps | yes |
| 3 | Systems have boundary definitions and capability inventories | yes |
| 4 | Cross-references between domains, actors, and systems are navigable | yes |
| 5 | Problem space entities appear in Event Catalog tabs | yes |

## 4. Current Alternatives

### Workarounds
- Freeform markdown notes with no consistent schema
- Confluence pages disconnected from the vault
- Whiteboard sessions with no structured capture into the vault

## 5. Form

### Feature Links

| Feature | Relationship | Coverage |
|---------|-------------|----------|
| [[Documentation Hub]] | primary | partial |
| [[Event Catalog]] | supporting | partial |
| [[Hubs]] | supporting | partial |

### Flow Links

| Flow | Role |
|------|------|
| [[Domain Discovery Flow]] | primary |
| [[Actor Mapping Flow]] | supporting |
