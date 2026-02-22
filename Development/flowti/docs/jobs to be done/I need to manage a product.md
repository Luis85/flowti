---
type: Job to be Done
persona: "[[The Product Owner (Operational Strategist)]]"
domain: Flowti
plugin: "[[Development/flowti/README|README]]"
stage: draft
description: "Manage a product through its lifecycle from idea to delivery with structured documentation"
related_features: [Hubs, Documentation Hub, Event Catalog]
priority: medium
---

## 1. Job Statement

**When** owning a product,
**I need to** manage its lifecycle from idea through delivery,
**so that** the product evolves intentionally with documented decisions at each stage.

### Job Context
Product owners need a structured way to define a product, track its evolution through lifecycle stages (idea, discovery, delivery, growth, retirement), and ensure that decisions at each stage are captured alongside the documentation that informed them. Without this, product intent drifts, decisions are forgotten, and the link between strategy and execution erodes. This is critical when a product enters a new lifecycle phase or when onboarding new team members who need to understand why the product is shaped the way it is.

### Job Category
- **Type:** functional
- **Frequency:** weekly
- **Criticality:** important

## 2. Scope

### In Scope
- Product definition and metadata management
- PRD (Product Requirements Document) creation and maintenance
- Feature tracking and roadmap alignment
- Release planning and versioning
- Lifecycle stage transitions with documented rationale

### Out of Scope
- Project management and sprint execution (see [[I need to manage a project]])
- Backlog management and PBI prioritization (see [[I need to manage a product backlog]])
- External tool synchronization (see [[I need to sync my Vault with Azure DevOps Boards]])

## 3. Success Criteria

| # | Criterion | Measurable? |
|---|-----------|-------------|
| 1 | Product notes have consistent frontmatter with lifecycle stage, owner, and description | yes |
| 2 | Each product links to its features, requirements, and domain events | yes |
| 3 | Lifecycle stage transitions are documented with rationale | yes |
| 4 | Product documentation is browsable via the Documentation Hub | yes |
| 5 | Product entities are cross-referenced in the Event Catalog | yes |

## 4. Current Alternatives

### Workarounds
- Scattered markdown notes with no structured product schema
- External tools (Notion, Confluence) disconnected from vault knowledge
- Manual linking between product notes and feature documentation

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
| [[Product Lifecycle Flow]] | primary |
| [[Feature Definition Flow]] | supporting |
