---
type: DocumentType
name: TechnicalReview
abbreviation: TR
folder: reviews/
icon: shield-check
---

# TechnicalReview

A **Technical Review** is a pre-implementation gate review conducted by the Technical Architect. It validates that the PRD is architecturally sound, implementation-ready, and aligns with existing patterns before development begins.

Technical Reviews live in the `reviews/` folder and follow the naming convention `Technical Review YYYY-MM-DD.md`.

## Frontmatter Schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `"TechnicalReview"` | yes | Document type discriminator |
| `feature` | wikilink | yes | Link to reviewed PRD |
| `reviewer` | string | yes | Reviewer role |
| `review_date` | date | yes | Review date (YYYY-MM-DD) |
| `stage` | enum | yes | `pre-implementation` · `mid-implementation` · `post-implementation` |
| `result` | enum | yes | `pass` · `conditional_pass` · `fail` |
| `follow_up_required` | boolean | yes | Whether follow-up actions are needed |
| `tags` | string[] | no | Categorization tags |

## Section Template

1. Review Metadata
2. Strategic & Scope Validation
3. Architecture Assessment
4. Event Design Review
5. Data Model Review
6. Implementation Feasibility
7. Risk Assessment
8. Recommendations
9. Verdict
