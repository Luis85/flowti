---
type: Component
domain: Flowti
stage: done
description: "Context bindings list with type cycling, file/folder picker modal, and binding limit enforcement"
source: "[[Development/flowti/src/ui/session/SessionContextPanel.ts|SessionContextPanel.ts]]"
parent: "[[SessionWorkspaceView]]"
tags:
  - session
  - component
---

# SessionContextPanel

## Description

SessionContextPanel renders the Context section of the Session Workspace. Shows context bindings (files and folders linked to the session) with type badges that cycle on click. An "Add Context" button opens a fuzzy-suggest picker modal (`ContextBindingPickerModal`) for selecting files or folders from the vault. Enforces `MAX_CONTEXT_BINDINGS` limit.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `SessionPanelDeps` | interface | Provides `getSession()`, `eventBus`, `app`, `openFile()`, `revealFolder()` |
| `ContextBindingType` | type | Binding type: `"file"` or `"folder"` |
| `BINDING_TYPES` | constant | Array of valid binding types for cycling |
| `MAX_CONTEXT_BINDINGS` | constant | Maximum number of context bindings allowed |
| `FuzzySuggestModal` | obsidian | Base class for the context binding picker |

## State

**Reads via `deps.getSession()`:**
- `contextBindings` — array of `{ id, path, label, type }` bindings

## Renders

- Header with "Context" label and count badge `(current/max)`
- Binding rows: type badge (clickable, cycles through types) + path link (opens file or reveals folder) + remove button
- "Add Context" button (hidden when at max bindings)
- Empty state: "No context bindings"

## Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| `session.context.bind` | Emitted | Add new context binding from picker |
| `session.context.unbind` | Emitted | Remove a context binding |
| `session.context.changeType` | Emitted | Cycle binding type on badge click |

## API

| Method | Purpose |
|--------|---------|
| `render()` | Initial full render into container |
| `refresh()` | Re-render bindings list |

## Related

- Parent: [[SessionWorkspaceView]]
- Subscription wiring: [[SessionWorkspaceSubscriptions]]
- Internal: `ContextBindingPickerModal` (private fuzzy-suggest modal)
