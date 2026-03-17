---
type: DocumentType
name: Increment
abbreviation: Inc
folder: increments/
icon: git-commit
---

# Increment

An **Increment** is a single shippable delivery step within a PBI or phase. Each increment is independently verifiable and adds value on top of the previous one.

Increments live in the `increments/` folder and follow the naming convention `Phase N Inc M - Title.md` (or `Phase N - Title.md` for single-increment phases).

## Frontmatter Schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `"Increment"` | yes | Document type discriminator |
| `feature` | wikilink | yes | Link to parent PRD |
| `pbi` | wikilink | no | Link to parent PBI (if applicable) |
| `phase` | number | yes | Phase number |
| `increment` | number | yes | Increment number within the phase |
| `stage` | enum | yes | `planned` · `in-progress` · `done` |
| `date` | date | no | Completion date (YYYY-MM-DD) |
| `tasm_score` | number | no | Three Amigos Score (0-35) |
| `tasm_review` | wikilink | no | Link to associated review session |
| `tests_added` | number | no | Number of tests added in this increment |
| `tests_total` | number | no | Total test count after this increment |
| `test_suites` | number | no | Total test suite count after this increment |
| `loc_added` | number | no | Lines of code added |

## Section Template

1. Context (why this increment exists)
2. Scope (what it delivers, 1-3 sentences)
3. Changes (New Files / Modified Files)
4. Data Model (new types or fields, if applicable)
5. Events (new events, if applicable)
6. Tests
7. Acceptance Criteria (checkboxes)
8. Verification (build passes, manual checks)
9. Notes / Decisions

## Lifecycle

```
planned → in-progress → done
```

- **planned**: Scope defined, not yet started
- **in-progress**: Implementation underway
- **done**: All acceptance criteria met, build green, review completed
