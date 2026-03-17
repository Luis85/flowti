---
type: DocumentType
name: DecisionNote
abbreviation: ADR
folder: decisions/
icon: scale
---

# DecisionNote

A **Decision Note** (Architecture Decision Record / ADR) captures a significant architectural or design decision. ADRs document the context, alternatives considered, the chosen approach, and its consequences — both positive and negative.

ADRs live in the `decisions/` folder and follow the naming convention `ADR-NNN Title.md`. The project maintains 30+ ADRs (ADR-001 through ADR-030).

## Frontmatter Schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `"DecisionNote"` | yes | Document type discriminator |
| `adr` | string | yes | ADR identifier (e.g., `ADR-001`) |
| `title` | string | yes | Decision title |
| `status` | enum | yes | `Proposed` · `Accepted` · `Superseded` · `Deprecated` |
| `date` | date | yes | Decision date (YYYY-MM-DD) |
| `domain` | string | yes | Affected domain (e.g., `infrastructure`, `session`) |
| `category` | string | no | Decision category (e.g., `Architecture`, `Testing`, `UI`) |
| `drivers` | string[] | no | Quality attributes driving the decision (e.g., `Decoupling`, `Testability`) |
| `superseded_by` | string | no | ADR that replaces this one |
| `tags` | string[] | no | Categorization tags |

## Section Template

1. Status (current status + narrative note)
2. Context (problem statement + alternatives considered)
3. Decision (chosen approach with rules/conventions)
4. Consequences (Positive / Negative / Risks)
5. Related (wikilinks to architecture docs, other ADRs)

## Lifecycle

```
Proposed → Accepted → Superseded
                    → Deprecated
```

- **Proposed**: Decision documented, under review
- **Accepted**: Decision approved and in effect
- **Superseded**: Replaced by a newer ADR (see [[L-19 Superseding ADRs is a healthy sign]])
- **Deprecated**: No longer applicable

## Conventions

- ADRs are numbered sequentially and never renumbered
- Superseded ADRs reference their replacement via `superseded_by`
- Each ADR must document at least 2 alternatives considered
- Consequences must include both positive and negative impacts
