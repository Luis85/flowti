---
type: Job to be Done
persona: "[[The Product Owner (Operational Strategist)]]"
domain: Flowti
plugin: "[[Development/flowti/README|README]]"
stage: draft
description: "Organize and prioritize researched jobs to be done for product strategy"
related_features: [Documentation Hub, Event Catalog]
priority: medium
---

## 1. Job Statement

**When** I've researched user needs,
**I need to** structure them as Jobs to Be Done with prioritization and feature traceability,
**so that** product strategy is grounded in real user demand.

### Job Context
After conducting user research — interviews, surveys, analytics review — product owners accumulate raw insights about what users need. Without a structured way to capture these as formal JTBDs with clear job statements, scope, success criteria, and feature links, the insights remain unactionable. The gap between research and strategy grows, and prioritization decisions become opinion-driven rather than evidence-based. This is critical during product discovery phases and when justifying roadmap decisions to stakeholders.

### Job Category
- **Type:** functional
- **Frequency:** monthly
- **Criticality:** important

## 2. Scope

### In Scope
- Creating JTBD notes from research findings with structured templates
- Prioritizing JTBDs based on frequency, criticality, and user evidence
- Linking JTBDs to features, domains, and product strategy
- Tracking JTBD coverage (which jobs are served, which are gaps)
- Managing JTBD lifecycle stages (researched, validated, served, retired)

### Out of Scope
- Conducting user research (upstream of this job)
- Feature implementation planning (see [[I need to manage a product backlog]])
- Automated JTBD extraction from research data

## 3. Success Criteria

| # | Criterion | Measurable? |
|---|-----------|-------------|
| 1 | Each JTBD has a complete job statement (When/I need to/So that) | yes |
| 2 | JTBDs have prioritization metadata (frequency, criticality, type) | yes |
| 3 | Feature links show which capabilities serve which jobs | yes |
| 4 | Coverage gaps (unserved or partially served JTBDs) are identifiable | yes |
| 5 | JTBDs are browsable and queryable via Documentation Hub | yes |

## 4. Current Alternatives

### Workarounds
- Unstructured notes from user interviews with no formal JTBD framework
- Spreadsheets mapping needs to features with no vault integration
- Mental models of user needs with no documented, shareable artifact

## 5. Form

### Feature Links

| Feature | Relationship | Coverage |
|---------|-------------|----------|
| [[Documentation Hub]] | supporting | partial |
| [[Event Catalog]] | supporting | partial |

### Flow Links

| Flow | Role |
|------|------|
| [[JTBD Research Flow]] | primary |
| [[Product Strategy Flow]] | supporting |
