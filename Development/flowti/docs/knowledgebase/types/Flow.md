---
type: DocumentType
name: Flow
abbreviation: ""
folder: flows/
icon: git-branch
---

# Flow

A **Flow** documents a complete user journey through the system — from trigger to outcome. Flows trace the path through views, services, events, and decisions, making cross-domain interactions visible and testable.

Flows live in the `flows/` folder. Each flow maps to a flow integration test in `tests/flows/`. The project documents 15 flows.

## Frontmatter Schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `"Flow"` | yes | Document type discriminator |
| `domain` | string | yes | Primary domain (e.g., `Flowti`) |
| `stage` | enum | yes | `planned` · `in-progress` · `done` |
| `description` | string | yes | One-sentence summary of the flow |
| `domains` | string[] | no | All domains touched by this flow |
| `services` | string[] | no | All services exercised |
| `events` | string[] | no | All events emitted or consumed |
| `tags` | string[] | no | Categorization tags |

## Section Template

1. Overview (paragraph describing the full scope)
2. Trigger (what initiates the flow)
3. Steps (numbered, each with: View/Service, User Action, System Response, Events)
4. Decision Points (table: Decision / Options / Default)
5. Events Sequence (ASCII flow diagram)
6. Related Decisions (wikilinks to ADRs)
7. Known Debt (TD wikilinks)
8. Learnings (L-NN wikilinks)
9. Related Use Cases (optional, wikilinks to other flows)

## Lifecycle

```
planned → in-progress → done
```

- **planned**: Flow designed, not yet tested
- **in-progress**: Flow partially implemented or tested
- **done**: Flow fully implemented with passing integration tests

## Test Mapping

Each flow maps to a test suite in `tests/flows/`:

| Flow | Test File |
|------|-----------|
| First-Run Onboarding | `01-FirstRunOnboarding.test.ts` |
| Browse and Configure Events | `02-BrowseAndConfigureEvents.test.ts` |
| Import CSV as Notes | `03-ImportCsvAsNotes.test.ts` |
| ... | ... |

See [[Testplan and Teststrategy]] §Flow Integration Tests for the complete mapping.

## Convention

Every major event domain needs a flow doc (see [[L-22 Every major event domain needs a flow doc]]). Flows document what the code does; tests verify it.
