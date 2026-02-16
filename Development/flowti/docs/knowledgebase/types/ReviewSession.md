---
type: DocumentType
name: ReviewSession
abbreviation: Review
folder: reviews/
icon: users
---

# ReviewSession

A **Review Session** (Three Amigos) is a structured quality gate review involving three perspectives: Product Owner, Technical Architect, and QA Engineer. Reviews score the increment across 7 dimensions and produce actionable findings.

Reviews live in the `reviews/` folder and follow the naming convention `Three Amigos Review - Topic YYYY-MM-DD.md`.

## Frontmatter Schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `"ReviewSession"` | yes | Document type discriminator |
| `session_type` | `"ThreeAmigos"` | yes | Review format |
| `frequency` | string | no | Review cadence (e.g. `sprint_end`) |
| `owner` | string | yes | Lead reviewer role |
| `participants` | object | yes | `{ product, engineering, ux_or_qa }` |
| `date` | date | yes | Review date (YYYY-MM-DD) |
| `related_hubs` | string[] | no | Hubs reviewed |
| `related_features` | wikilink[] | no | Links to reviewed PRDs |
| `scores_product_value` | number (1-5) | yes | Product value score |
| `scores_architectural_integrity` | number (1-5) | yes | Architecture score |
| `scores_event_discipline` | number (1-5) | yes | Event discipline score |
| `scores_data_model_integrity` | number (1-5) | yes | Data model score |
| `scores_ux_quality` | number (1-5) | yes | UX quality score |
| `scores_performance_scalability` | number (1-5) | yes | Performance score |
| `scores_documentation_discipline` | number (1-5) | yes | Documentation score |
| `scores_max_score` | number | yes | Maximum possible score (35) |
| `scores_health_level` | enum | yes | `excellent` · `strong` · `adequate` · `at_risk` · `critical` |
| `drift_detected` | boolean | yes | Whether scope/architectural drift was found |
| `refactor_required` | boolean | yes | Whether refactoring is needed |
| `immediate_action_required` | boolean | yes | Whether blocking issues exist |
| `summary` | string | yes | One-paragraph summary of findings |

## Section Template

1. Purpose
2. Product Owner Perspective
3. Technical Architect Perspective
4. QA Engineer Perspective
5. Cross-Cutting Findings
6. Score Card (table with 7 dimensions)
7. Action Items
8. Verdict

## Scoring

| Score | Health Level |
|-------|-------------|
| 30-35 | Excellent |
| 25-29 | Strong |
| 20-24 | Adequate |
| 15-19 | At Risk |
| < 15 | Critical |
