---
type: DocumentType
name: Learning
abbreviation: L
folder: learnings/
icon: graduation-cap
---

# Learning

A **Learning** captures a reusable pattern, anti-pattern, or insight discovered during implementation. Learnings are the project's institutional memory — they prevent repeating mistakes and codify what works.

Learnings live in the `learnings/` folder and follow the naming convention `L-NN Title.md`. The project has 24 documented learnings (L-01 through L-24).

## Frontmatter Schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `"Learning"` | yes | Document type discriminator |
| `id` | string | yes | Learning identifier (e.g., `L-01`) |
| `source` | wikilink | yes | Link to the cycle or PRD where this was learned |
| `source_pbi` | wikilink | no | Link to the specific PBI |
| `source_increment` | number | no | Increment number where this was learned |
| `domain` | string | yes | Primary domain (e.g., `architecture`, `testing`, `ui`) |
| `tags` | string[] | no | Categorization tags |

## Section Template

1. (Introduction paragraph — the learning itself, no heading)
2. Pattern (numbered steps describing the reusable approach)
3. When to Apply (bulleted conditions for applicability)
4. Related (wikilinks to ADRs, other learnings, or documentation)

## Lifecycle

Learnings have no formal lifecycle stages. They are created once and remain permanent. If a learning is later contradicted, it is updated with a note rather than deleted.

## Creation Triggers

Learnings are captured during:
- **Cycle retrospectives** — "What did we learn?" section
- **Three Amigos reviews** — observations that generalize beyond the current increment
- **Implementation** — patterns that emerge during coding

## Key Learnings by Domain

| Domain | Learnings |
|--------|-----------|
| Architecture | L-01, L-14, L-24 |
| Testing | L-02, L-05, L-13 |
| Data Model | L-04, L-09, L-11 |
| Delivery | L-15, L-16, L-18 |
| Documentation | L-17, L-21, L-22 |
| UI | L-03, L-08, L-23 |
