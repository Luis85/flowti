---
type: DocumentType
name: JobToBeDone
abbreviation: JTBD
folder: ""
icon: target
---

# JobToBeDone

A **Job to Be Done** (JTBD) captures what a user needs to accomplish independent of any specific solution. JTBDs are the stable demand that features supply — they persist even as features change.

JTBDs are linked to personas and features. They follow the naming convention based on the job statement.

## Frontmatter Schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `"Job to be Done"` | yes | Document type discriminator |
| `persona` | wikilink | yes | Link to the persona who has this job |
| `domain` | string | yes | Primary domain that serves this job |
| `stage` | enum | yes | `idea` · `draft` · `validated` · `done` |
| `plugin` | wikilink | no | Link to plugin README |
| `description` | string | no | One-line summary of the job |
| `related_features` | wikilink[] | no | Features that address this job |
| `related_flows` | wikilink[] | no | Flows that fulfill this job |
| `priority` | enum | no | `critical` · `high` · `medium` · `low` |
| `tags` | string[] | no | Categorization tags |

## Section Template

1. Job Statement (Core Job: When/I need to/So that + Job Context + Job Category)
2. Scope (In Scope / Out of Scope)
3. Success Criteria (solution-independent outcome measures)
4. Current Alternatives (Existing Solutions + Workarounds + Switching Costs)
5. Form (Feature Links + Flow Links + Event Links)
6. Prioritization (Importance vs Satisfaction + Opportunity Score)
7. Open Questions
8. Review Log

## Lifecycle

```
idea → draft → validated → done
```

- **idea**: Job observed, not yet documented
- **draft**: Job statement and scope defined
- **validated**: Success criteria confirmed, linked to features/flows
- **done**: Job fully addressed by delivered features

## Minimum Viable JTBD

Sections 1-3 (Job Statement, Scope, Success Criteria) are the minimum viable JTBD. Section 5 (Form) connects it to the rest of the living documentation.

## Prioritization Formula

**Opportunity Score** (Ulwick): `Importance + max(Importance - Satisfaction, 0)`

Jobs with high importance and low satisfaction have the highest opportunity for value creation.
