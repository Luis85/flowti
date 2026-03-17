---
type: Job to be Done
persona: "[[Strategic Systems Builder]]"
domain: Flowti
plugin: "[[Development/flowti/README|README]]"
stage: validated
description: "Trace from delivered solutions back through features, use cases, and requirements to the original problem"
related_features: [Event Catalog, Documentation Hub]
priority: high
---

## 1. Job Statement

**When** reviewing delivered work,
**I need to** trace solutions back through the chain (solution → feature → use case → requirement → problem),
**so that** I can verify we solved the right problem and demonstrate value.

### Job Context
Traceability is the backbone of accountable delivery. When stakeholders ask "why did we build this?" or "does this solve the original problem?", the team needs a clear chain from the delivered solution back to the originating problem. Without this chain, delivered work cannot be validated against intent, and value demonstration becomes anecdotal rather than evidence-based. This is critical during cycle retrospectives, stakeholder reviews, and audit scenarios.

### Job Category
- **Type:** functional
- **Frequency:** weekly
- **Criticality:** blocking

## 2. Scope

### In Scope
- Navigating traceability chains from solutions to problems
- Cross-referencing between all entity types (events, flows, services, domains, actors, products)
- Verifying coverage — identifying requirements without implementing features
- Gap analysis — finding solutions without traced requirements
- Using Event Catalog cross-reference capabilities for traceability queries

### Out of Scope
- Automated traceability validation (lint-style checks)
- External compliance or audit reporting formats
- Traceability to code-level implementations (source code linking)

## 3. Success Criteria

| # | Criterion | Measurable? |
|---|-----------|-------------|
| 1 | Every solution entity links to at least one requirement | yes |
| 2 | Every requirement links to at least one problem/use case | yes |
| 3 | Traceability chain is navigable via vault links in 3 clicks or fewer | yes |
| 4 | Gap analysis identifies untraced entities (orphan solutions or requirements) | yes |
| 5 | Event Catalog cross-references show bidirectional relationships | yes |

## 4. Current Alternatives

### Workarounds
- Manual spreadsheet mapping of solutions to requirements
- Searching vault with text queries to find related notes
- Relying on team memory for traceability during reviews

## 5. Form

### Feature Links

| Feature | Relationship | Coverage |
|---------|-------------|----------|
| [[Event Catalog]] | primary | full |
| [[Documentation Hub]] | primary | full |

### Flow Links

| Flow | Role |
|------|------|
| [[Traceability Review Flow]] | primary |
| [[Cycle Retrospective Flow]] | supporting |
