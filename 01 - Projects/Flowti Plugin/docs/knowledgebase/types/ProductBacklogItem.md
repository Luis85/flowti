---
type: DocumentType
name: ProductBacklogItem
abbreviation: PBI
folder: backlog/
icon: list-checks
---

# ProductBacklogItem

A **Product Backlog Item** (PBI) is a deliverable work package within a feature. Each PBI is linked to the parent PRD and broken down into increments.

PBIs live in the `backlog/` folder and follow the naming convention `PBI-NNN Title.md`.

## Frontmatter Schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `"ProductBacklogItem"` | yes | Document type discriminator |
| `feature` | wikilink | yes | Link to parent PRD |
| `stage` | enum | yes | `draft` · `refined` · `ready` · `in-progress` · `done` |
| `priority` | enum | yes | `critical` · `high` · `medium` · `low` |
| `phase` | number | no | Implementation phase number |
| `dependencies` | wikilink[] | no | Links to prerequisite TDs or PBIs |
| `user_story` | wikilink | no | Link to the related UserStory note |
| `note` | string | no | Brief status note |

## Section Template

1. User Story - Problemspace (As a..., I want..., so that...)
2. User Pains
3. User Needs
4. Solutionstatement (Use Case + Gherkin)
5. Functional Requirements (checkboxes)
6. Technical Requirements
7. Constraints
8. Acceptance Criteria (checkboxes)

## Lifecycle

```
draft → refined → ready → in-progress → done
```

- **draft**: Problem and solution outlined
- **refined**: Requirements detailed, acceptance criteria defined
- **ready**: Dependencies resolved, ready for implementation
- **in-progress**: Increments being delivered
- **done**: All acceptance criteria met
