---
type: Job to be Done
persona: "[[Delivery Manager (Systems Orchestrator)]]"
domain: Flowti
plugin: "[[Development/flowti/README|README]]"
stage: draft
description: "Track Risks, Assumptions, Issues, and Dependencies across projects and products"
related_features: [Documentation Hub, Hubs]
priority: low
---

## 1. Job Statement

**When** managing project risks and dependencies,
**I need to** maintain a structured RAID log (Risks, Assumptions, Issues, Dependencies),
**so that** project health is visible and risks are mitigated proactively.

### Job Context
Projects accumulate risks, assumptions, issues, and dependencies that must be tracked systematically. Without a structured RAID log inside the vault, these items are scattered across meeting notes, chat messages, and mental models. When a risk materializes or a dependency is unresolved, the team lacks the context to respond quickly. This is most critical during project kickoffs, milestone reviews, and escalation discussions where RAID visibility directly impacts decision quality.

### Job Category
- **Type:** functional
- **Frequency:** weekly
- **Criticality:** important

## 2. Scope

### In Scope
- Creating and categorizing RAID items (Risks, Assumptions, Issues, Dependencies)
- Status tracking for each RAID item (open, mitigated, resolved, accepted)
- Linking RAID items to projects, products, and sessions
- Ownership assignment and review cadence
- RAID dashboard for project health overview

### Out of Scope
- Project execution and task tracking (see [[I need to manage a project]])
- Product backlog management (see [[I need to manage a product backlog]])
- Automated risk detection or scoring

## 3. Success Criteria

| # | Criterion | Measurable? |
|---|-----------|-------------|
| 1 | RAID items have consistent frontmatter with type, status, owner, and linked project | yes |
| 2 | Each RAID category (R, A, I, D) is filterable and queryable | yes |
| 3 | Open RAID items are visible in project dashboards | yes |
| 4 | RAID items link to relevant sessions, decisions, and documentation | yes |
| 5 | Stale RAID items (no update in 2+ weeks) are flagged for review | yes |

## 4. Current Alternatives

### Workarounds
- Spreadsheet-based RAID logs disconnected from vault context
- Scattered notes within meeting minutes with no structured tracking
- Mental models and tribal knowledge with no documented trail

## 5. Form

### Feature Links

| Feature | Relationship | Coverage |
|---------|-------------|----------|
| [[Documentation Hub]] | supporting | partial |
| [[Hubs]] | supporting | partial |

### Flow Links

| Flow | Role |
|------|------|
| [[RAID Review Flow]] | primary |
| [[Project Health Check Flow]] | supporting |
