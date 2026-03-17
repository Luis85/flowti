---
type: Component
domain: Flowti
stage: done
description: "Decisions list with title, description, context fields and add/remove actions"
source: "[[Development/flowti/src/ui/session/SessionDecisionPanel.ts|SessionDecisionPanel.ts]]"
parent: "[[SessionWorkspaceView]]"
tags:
  - session
  - component
---

# SessionDecisionPanel

## Description

SessionDecisionPanel renders the Decisions section of the Session Workspace. Each decision is shown with its title, optional description, and optional context. The panel includes an input for recording new decisions via Enter key. Supports incremental refresh via `refreshList()`.

Decisions are read-only when the session is completed or archived.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `SessionPanelDeps` | interface | Provides `getSession()`, `eventBus` |
| `SessionDecision` | type | Decision with `id`, `title`, `description`, `context` |
| `setIcon` | obsidian | Renders x icon for remove button |

## State

**Reads via `deps.getSession()`:**
- `decisions` — array of `SessionDecision` objects
- `status` — determines editability

## Renders

- Header row with "Decisions" label and count badge
- Decision rows: title (bold) + remove button, optional description and context paragraphs
- Rows separated by bottom border
- "Record a decision..." input at bottom (hidden for completed/archived)

## Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| `session.decision.record` | Emitted | Record new decision (Enter key in input) |
| `session.decision.remove` | Emitted | Remove a decision (x button click) |

## API

| Method | Purpose |
|--------|---------|
| `render()` | Initial full render into container |
| `refreshList()` | Re-render list + update count badge |

## Related

- Parent: [[SessionWorkspaceView]]
- Subscription wiring: [[SessionWorkspaceSubscriptions]]
