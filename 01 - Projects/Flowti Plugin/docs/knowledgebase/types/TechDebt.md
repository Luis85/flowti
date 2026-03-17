---
type: DocumentType
name: TechDebt
abbreviation: TD
folder: debt/
icon: alert-triangle
---

# TechDebt

A **Tech Debt** item documents a known shortcut, quality gap, or structural deficiency in the codebase. Tech debt items are tracked explicitly so they can be prioritized, bundled into cycles, and resolved systematically.

Tech debt items live in the `debt/` folder and follow the naming convention `TD-NN Title.md`. The project tracks 91+ items (TD-01 through TD-99).

## Frontmatter Schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `"TechDebt"` | yes | Document type discriminator |
| `severity` | enum | yes | `low` · `medium` · `high` |
| `category` | string | yes | Debt category (e.g., `architecture`, `testing`, `documentation`) |
| `layer` | string | no | Affected layer (e.g., `ui`, `domain`, `infrastructure`) |
| `status` | enum | yes | `open` · `mitigated` · `resolved` |
| `updated` | date | yes | Last update date (YYYY-MM-DD) |
| `effort` | enum | no | `small` · `medium` · `large` |
| `description` | string | yes | Single-sentence summary |
| `tags` | string[] | no | Categorization tags |

## Section Template

1. Original Problem (date + problem statement, optional table of affected files)
2. Current State (date + updated status)
3. Impact (bulleted consequences)
4. Remaining Decomposition Opportunities (optional, numbered next steps)
5. Affected Files (source paths)

## Lifecycle

```
open → mitigated → resolved
```

- **open**: Debt identified, not yet addressed
- **mitigated**: Partially addressed, impact reduced
- **resolved**: Fully addressed, debt eliminated

## Bundling Convention

Tech debt items are bundled into development cycles when they:
- Block a planned PBI (dependency)
- Share code surface with a planned increment (thematic cohesion)
- Pose increasing risk if deferred (compounding debt)

Each cycle's plan specifies bundled TDs with a "why now" rationale. See [[Cycle Planning Template]] §4.
