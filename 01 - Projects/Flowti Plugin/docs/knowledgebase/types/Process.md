---
type: DocumentType
name: Process
abbreviation: ""
folder: knowledgebase/
icon: workflow
---

# Process

A **Process** document defines a repeatable workflow or methodology used by the project. Process documents are the operational backbone of the development system — they describe how work flows from one stage to the next.

Process documents live in the `knowledgebase/` folder and cover the full lifecycle from idea to delivery.

## Frontmatter Schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `"Process"` | yes | Document type discriminator |
| `domain` | string | yes | Process owner (e.g., `Flowti/Process`) |
| `stage` | enum | yes | `draft` · `active` · `archived` |
| `version` | number | yes | Document version |
| `review_cycle` | string | no | Review cadence (e.g., `quarterly`) |
| `tags` | string[] | no | Categorization tags |

## Process Documents

| Document | Scope |
|----------|-------|
| [[Idea Lifecycle]] | Raw idea → Qualified backlog item (6 steps) |
| [[Development Lifecycle]] | Feedback → Delivery → Post-release (10 phases) |
| [[Increment Lifecycle]] | Single increment delivery (Phases A-E) |
| [[Delivery Planning]] | PRD → Increment plan (chunking strategy) |
| [[Definition of Ready (Cycle)]] | Cycle readiness gate (6 categories) |
| [[Definition of Done (Cycle)]] | Cycle completion gate (8 categories) |
| [[Idea to Solution Workflow]] | End-to-end pipeline (7 stages) |

## Lifecycle

```
draft → active → archived
```

- **draft**: Process documented, under review
- **active**: Process in use, governing current work
- **archived**: Superseded by a newer process version

## Review Cadence

Process documents are reviewed quarterly to ensure they reflect actual practice. Deviations between documented process and real behavior are captured as improvement items in cycle retrospectives.
