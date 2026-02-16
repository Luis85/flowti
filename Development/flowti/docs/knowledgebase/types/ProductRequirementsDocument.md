---
type: DocumentType
name: ProductRequirementsDocument
abbreviation: PRD
folder: feature root
icon: file-text
---

# ProductRequirementsDocument

A **Product Requirements Document** (PRD) is the single source of truth for a feature. It captures the problem, scope, functional requirements, data model, event impact, UI layout impact, non-functional requirements, risks, acceptance criteria, definition of done, implementation phases, and stage history.

Each feature folder has exactly one PRD.

## Frontmatter Schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `"ProductRequirementsDocument"` | yes | Document type discriminator |
| `domain` | string | yes | Owning domain (e.g. "Flowti") |
| `plugin` | wikilink | yes | Link to plugin README |
| `stage` | enum | yes | `idea` · `draft` · `approved` · `in-progress` · `done` · `archived` |
| `related_hubs` | string[] | no | Hubs this feature touches |
| `related_events` | string[] | no | Events produced or consumed |
| `maturity` | string | no | Maturity level (e.g. "L3") |
| `maturity_score_*` | number (1-5) | no | Per-dimension maturity scores |
| `business_value` | number (1-5) | no | Business value rating |
| `implementation_cost` | number (1-5) | no | Implementation cost rating |
| `maintenance_cost` | number (1-5) | no | Maintenance cost rating |
| `discovery_cost` | number (1-5) | no | Discovery effort rating |
| `design_cost` | number (1-5) | no | Design effort rating |
| `test_cost` | number (1-5) | no | Testing effort rating |
| `priority` | number (1-5) | no | Priority rating |
| `fri_score` | number | no | Feature Readiness Index (computed) |

## Section Template

1. Problem Statement
2. Outcome (Success Definition)
3. Scope (In Scope / Out of Scope)
4. UX Entry Points
5. Functional Requirements
6. Data Model Impact
7. Event Impact (Produced / Consumed / Transformed)
8. UI Layout Impact
9. Adapter Impact
10. Non-Functional Requirements
11. Risks
12. Acceptance Criteria
13. Definition of Done
14. Technical Debt Prerequisites
15. Product Backlog Items
16. Implementation Phases
17. Stage History
18. Related

## Lifecycle

```
idea → draft → approved → in-progress → done → archived
```

- **idea**: Problem identified, no PRD content yet
- **draft**: PRD drafted, under review
- **approved**: Design Gate + Readiness Gate passed
- **in-progress**: Implementation underway (phases tracked in Stage History)
- **done**: All acceptance criteria met, build green
- **archived**: Feature complete, PRD retained for reference
