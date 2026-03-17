---
type: DocumentType
name: UseCase
abbreviation: UC
folder: backlog/
icon: check-circle
---

# UseCase

A **Use Case** describes a specific user interaction with the system in terms of preconditions, actions, and expected outcomes. Use cases complement User Stories by adding structured scenario descriptions with Gherkin-style specifications.

Use cases appear in `features/*/backlog/` alongside User Stories and PBIs. They are also referenced in the [[Testplan and Teststrategy]] as UC-01 through UC-105.

## Frontmatter Schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `"UseCase"` | yes | Document type discriminator |
| `feature` | wikilink | yes | Link to parent PRD |
| `uc_id` | string | no | Use case identifier (e.g., `UC-56`) |
| `stage` | enum | no | `draft` · `ready` · `done` |
| `domain` | string | no | Affected domain |
| `tags` | string[] | no | Categorization tags |

## Section Template

1. Scope (System, Level, Primary Actor, Supporting Actors, Stakeholders)
2. Brief Description
3. Preconditions
4. Postconditions (Success Guarantee / Minimal Guarantee)
5. Main Success Scenario (numbered steps)
6. Alternative Flows (numbered, referencing main scenario steps)
7. Special Requirements
8. Frequency of Occurrence
9. Business Rules

## Relationship to Other Types

| Type | Relationship |
|------|-------------|
| [[UserStory]] | User Stories capture the "why" (user voice); Use Cases capture the "how" (interaction steps) |
| [[ProductBacklogItem]] | PBIs may reference Use Cases for detailed scenario specifications |
| [[Flow]] | Flows document cross-domain journeys; Use Cases focus on single-actor interactions |
| [[Testplan and Teststrategy]] | Each UC maps to test scenarios (UC-01 through UC-105) |

## Test Mapping

Use cases are the primary link between requirements and tests. The TestPlan indexes all use cases by UC number, mapping each to specific test files and pass/skip status.
