---
type: Job to be Done
persona: "[[Software Architecture]]"
domain: Flowti
plugin: "[[Development/flowti/README|README]]"
stage: draft
description: "Document multi-level design from system architecture down to software implementation"
related_features: [Documentation Hub, Event Catalog, Canvas Integration]
priority: medium
---

## 1. Job Statement

**When** designing at multiple abstraction levels,
**I need to** use structured templates for system design, service design, product design, and software design,
**so that** architecture decisions are documented, reviewed, and traceable.

### Job Context
Architecture work spans multiple abstraction levels: system design defines how systems interact, service design defines service boundaries and contracts, product design defines user-facing capabilities, and software design defines implementation patterns. Without structured documentation at each level, design rationale is lost, decisions are revisited unnecessarily, and new team members cannot understand why the architecture is shaped the way it is. This is most critical during design reviews, when onboarding architects, and when evolving the system requires understanding the original constraints and trade-offs.

### Job Category
- **Type:** functional
- **Frequency:** weekly
- **Criticality:** blocking

## 2. Scope

### In Scope
- System design documentation (system boundaries, interactions, deployment topology)
- Service design documentation (service contracts, APIs, event schemas, SLAs)
- Product design documentation (user journeys, capability mapping, UX flows)
- Software design documentation (patterns, data models, implementation decisions)
- Cross-level traceability (system → service → product → software)
- Visual modeling through canvas-based architecture diagrams

### Out of Scope
- Code-level documentation and inline comments (IDE concern)
- Test design and quality assurance (see [[I need to create and manage a Testsuite for my domain]])
- Operational runbooks and incident response documentation

## 3. Success Criteria

| # | Criterion | Measurable? |
|---|-----------|-------------|
| 1 | Each design level has a structured template with consistent sections | yes |
| 2 | Design documents are browsable via Documentation Hub (Domains/Services/Systems tabs) | yes |
| 3 | All entity types are documented and cross-referenced in Event Catalog | yes |
| 4 | Design decisions include rationale, alternatives considered, and trade-offs | yes |
| 5 | Canvas diagrams are linked to their corresponding design documents | yes |
| 6 | Cross-level traceability is navigable (system → service → software) | yes |

## 4. Current Alternatives

### Workarounds
- Architecture Decision Records (ADRs) as unstructured markdown with no cross-referencing
- Diagram tools (Miro, Lucidchart) disconnected from vault documentation
- Design documents in Confluence or Google Docs with no entity linkage

## 5. Form

### Feature Links

| Feature | Relationship | Coverage |
|---------|-------------|----------|
| [[Documentation Hub]] | primary | partial |
| [[Event Catalog]] | primary | full |
| [[Canvas Integration]] | supporting | partial |

### Flow Links

| Flow | Role |
|------|------|
| [[Architecture Design Flow]] | primary |
| [[Design Review Flow]] | supporting |
| [[Canvas Modeling Flow]] | supporting |
