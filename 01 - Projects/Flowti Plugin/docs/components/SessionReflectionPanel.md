---
type: Component
domain: Flowti
stage: done
description: "Categorized reflection entries (observation, blocker, idea, decision) with add form and remove actions"
source: "[[Development/flowti/src/ui/session/SessionReflectionPanel.ts|SessionReflectionPanel.ts]]"
parent: "[[SessionWorkspaceView]]"
tags:
  - session
  - component
---

# SessionReflectionPanel

## Description

SessionReflectionPanel renders the Reflections section of the Session Workspace. Entries are grouped by category (Observations, Blockers, Ideas, Decisions), each with its own icon. The panel includes a category dropdown + text input form for adding new reflections via Enter key. Supports incremental refresh via `refreshList()`.

Reflections are read-only when the session is completed or archived.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `SessionPanelDeps` | interface | Provides `getSession()`, `eventBus` |
| `ReflectionEntry` | type | Entry with `id`, `type`, `content` |
| `setIcon` | obsidian | Renders category icons (eye, alert-circle, lightbulb, scale) and x for remove |

## State

**Reads via `deps.getSession()`:**
- `reflections` — array of `ReflectionEntry` objects
- `status` — determines editability

## Renders

- Header row with "Reflections" label and count badge
- Categories rendered in order: Observations (eye), Blockers (alert-circle), Ideas (lightbulb), Decisions (scale)
- Each category header shows icon + label + count; empty categories are hidden
- Entry rows: indented text + remove button (x)
- Add form: category dropdown + text input (hidden for completed/archived)

## Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| `session.reflection.add` | Emitted | Add new reflection with type and content |
| `session.reflection.remove` | Emitted | Remove a reflection entry |

## API

| Method | Purpose |
|--------|---------|
| `render()` | Initial full render into container |
| `refreshList()` | Re-render list + update count badge |

## Related

- Parent: [[SessionWorkspaceView]]
- Siblings: [[SessionGoalsPanel]], [[SessionExecutionPanel]], [[SessionActivityPanel]]
- Subscription wiring: [[SessionWorkspaceSubscriptions]]
