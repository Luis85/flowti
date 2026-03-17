---
type: DocumentType
name: Idea
abbreviation: ""
folder: "00 - Connectivity/inbox/"
icon: lightbulb
---

# Idea

An **Idea** is a raw or enriched thought captured in the inbox. Ideas are the starting point of the entire [[Idea to Solution Workflow]] — every feature, PBI, and increment traces back to an original idea note.

Idea notes live permanently in the inbox folder. They are **never moved, deleted, or locked** — they remain as permanent anchors for traceability. All subsequent work (sessions, backlog items, PRDs, increments) references the original idea.

## Frontmatter Schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `"idea"` | no | Document type discriminator (empty when first captured) |
| `stage` | enum | no | `(empty)` · `discovery` · `refinement` · `qualified` · `rejected` · `parked` · `promoted` · `planned` · `delivered` · `archived` |
| `origin` | `"inbox"` | no | Source identifier |
| `domain` | string | no | Affected domain |
| `parent` | wikilink | no | Link to parent PRD (when promoted) |
| `description` | string | no | One-sentence summary |
| `tags` | string[] | no | Categorization tags |
| `priority` | enum | no | `0 - low` · `01 - medium` · `2 - high` |
| `rank` | number \| null | no | Granular ordering within priority tier (0-5, null = unranked) |
| `related` | wikilink[] | no | Links to related ideas or artifacts |
| `note` | string | no | Status note or resolution summary |
| `planned_in` | string | no | Cycle or increment where this idea is planned |
| `delivered_in` | string | no | Cycle or increment where this idea was delivered |
| `promoted_to` | wikilink | no | Link to the backlog item created from this idea |

## Lifecycle

See [[Idea Lifecycle]] for the full process.

```
(empty) → discovery → refinement → qualified → promoted
                                  → rejected
                                  → parked
```

- **(empty)**: Pure idea, waiting for ingestion
- **discovery**: Context building within a session
- **refinement**: Typed and structured
- **qualified**: Three Amigos approved, backlog-ready
- **rejected**: Explicitly declined, rationale documented
- **parked**: Valid but not timely, review scheduled later
- **promoted**: Backlog item created, note remains as anchor

## Maturity Model

| Level | Description | Stage |
|-------|-------------|-------|
| L0 | Raw thought | (empty) |
| L1 | Context enriched | discovery |
| L2 | Typed and structured | refinement |
| L3 | Reviewed | qualified |
| L4 | Backlog ready | promoted |

## Governance Rules

1. Inbox is NOT the backlog
2. Nothing enters backlog without typing
3. Nothing enters backlog without Three Amigos review
4. Rejected ideas are kept for traceability
5. All backlog items must reference their origin idea
6. Inbox notes are permanent — never moved or deleted
