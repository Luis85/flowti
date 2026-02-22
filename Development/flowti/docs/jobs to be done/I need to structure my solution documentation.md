---
type: Job to be Done
persona: "[[Software Architecture]]"
domain: Flowti
plugin: "[[Development/flowti/README|README]]"
stage: draft
description: "Organize solution documentation with services, events, flows, and products"
related_features: [Documentation Hub, Event Catalog]
priority: medium
---

## 1. Job Statement

**When** documenting how solutions are built,
**I need to** structured templates for services, events, flows, and products,
**so that** the solution architecture is traceable and maintainable.

### Job Context
Solution documentation captures the "how" — the services that implement domain capabilities, the events that connect them, the flows that orchestrate work, and the products that deliver value. Without structured templates, solution documentation drifts from the problem space it addresses, making it impossible to verify that solutions actually solve the right problems. This job is critical during design reviews and architecture decision records.

### Job Category
- **Type:** functional
- **Frequency:** weekly
- **Criticality:** important

## 2. Scope

### In Scope
- Creating service definitions with APIs, events produced/consumed, and domain assignments
- Documenting events with schemas, producers, consumers, and domain context
- Defining flows that connect services through event-driven choreography
- Cataloging products with feature inventories and service dependencies
- Maintaining bidirectional links between solution and problem space entities

### Out of Scope
- Problem space documentation (see [[I need to structure my problem space documentation]])
- Runtime monitoring or operational dashboards
- Code generation from documentation

## 3. Success Criteria

| # | Criterion | Measurable? |
|---|-----------|-------------|
| 1 | Services have structured notes with event contracts and domain links | yes |
| 2 | Events are documented with producers, consumers, and schemas | yes |
| 3 | Flows connect services through typed event sequences | yes |
| 4 | Products link to their constituent features and services | yes |
| 5 | Solution entities appear in Event Catalog services/events/flows tabs | yes |

## 4. Current Alternatives

### Workarounds
- Unstructured architecture decision records with no cross-references
- Diagrams in external tools (Lucidchart, Draw.io) disconnected from vault
- Spreadsheet-based service catalogs with no event traceability

## 5. Form

### Feature Links

| Feature | Relationship | Coverage |
|---------|-------------|----------|
| [[Documentation Hub]] | primary | partial |
| [[Event Catalog]] | primary | full |

### Flow Links

| Flow | Role |
|------|------|
| [[Service Design Flow]] | primary |
| [[Event Registration Flow]] | supporting |
