---
type: DocumentType
name: UserStory
abbreviation: US
folder: backlog/
icon: user
---

# UserStory

A **User Story** captures a user need from a specific persona's perspective. User stories can stand alone as backlog items or be linked to a PBI as the underlying motivation for a work package.

User stories live in the `backlog/` folder and follow the naming convention `I want to <goal>.md` or `As <persona>, I want to <goal>.md`.

## Frontmatter Schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `"UserStory"` | yes | Document type discriminator |
| `feature` | wikilink | yes | Link to parent PRD |
| `stage` | enum | yes | `draft` · `refined` · `ready` · `done` |
| `priority` | enum | no | `critical` · `high` · `medium` · `low` |
| `persona` | string | yes | Target user persona |
| `relates_to` | wikilink | no | Link to related PBI |
| `tags` | string[] | no | Categorization tags |

## Section Template

1. User Story ("As a..., I want..., so that...")
2. User Pains
3. User Needs
4. Solution Statement (Use Cases + Gherkin scenarios)
5. Acceptance Criteria (checkboxes)

## Naming Convention

User stories are written from the user's voice:
- `I want to prepare a working session, so that I can focus on one task at a time.md`
- `As Project Manager, I want to structure my Project in one place.md`

## Lifecycle

```
draft → refined → ready → done
```

- **draft**: Initial story captured, needs refinement
- **refined**: Pains, needs, and solution detailed; acceptance criteria defined
- **ready**: Ready to be picked up by a PBI/increment
- **done**: Delivered and verified
