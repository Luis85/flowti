---
type: Component
domain: Flowti
stage: done
description: "Read-only guiding questions list resolved from session type configuration"
source: "[[Development/flowti/src/ui/session/SessionGuidingQuestions.ts|SessionGuidingQuestions.ts]]"
parent: "[[SessionWorkspaceView]]"
tags:
  - session
  - component
---

# SessionGuidingQuestions

## Description

SessionGuidingQuestions renders a list of guiding questions configured for the current session type. Questions are resolved via `resolveTypeConfig()` which merges built-in and custom type configurations. The section is hidden when no guiding questions are defined for the session type. Read-only — no user interaction.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `SessionPanelDeps` | interface | Provides `getSession()` |
| `SessionTypeConfig` | type | Type configuration with `guidingQuestions` array |
| `resolveTypeConfig` | function | Resolves type config from built-in + custom configs |
| `setIcon` | obsidian | Renders help-circle icon in header |

## State

**Reads via `deps.getSession()`:**
- `type` — session type string used to resolve guiding questions

**Constructor params:**
- `customConfigs` — optional custom session type configurations

## Renders

- Header with help-circle icon + "Guiding Questions" label
- Bulleted list of questions in muted text (13px)
- Hidden entirely when no guiding questions defined

## Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| (none) | — | Read-only display component |

## API

| Method | Purpose |
|--------|---------|
| `render()` | Full render into container |

## Related

- Parent: [[SessionWorkspaceView]]
- Helper: `resolveTypeConfig()` in `src/domain/session/helpers.ts`
