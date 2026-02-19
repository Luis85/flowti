---
type: Component
domain: Flowti
stage: done
description: "Debounced textarea for session notes with external update support"
source: "[[Development/flowti/src/ui/session/SessionNotesPanel.ts|SessionNotesPanel.ts]]"
parent: "[[SessionWorkspaceView]]"
tags:
  - session
  - component
---

# SessionNotesPanel

## Description

SessionNotesPanel renders a textarea for free-form session notes. Input is debounced at 500ms before emitting the update event. External updates (from reverse note sync or other sources) are applied via `updateNotes()` only when the textarea is not focused, preventing overwriting active user input. Includes cleanup via `destroy()` for debounce timer.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `SessionPanelDeps` | interface | Provides `getSession()`, `eventBus` |

## State

**Reads via `deps.getSession()`:**
- `notes` — current session notes text

**Internal:**
- `debounceTimer` — tracks pending debounced update

## Renders

- "Notes" header label
- Resizable textarea (100px min-height) with placeholder "Session notes..."

## Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| `session.notes.update` | Emitted | Debounced (500ms) notes text update |

## API

| Method | Purpose |
|--------|---------|
| `render()` | Initial full render into container |
| `updateNotes(notes)` | External update — sets value only if textarea not focused |
| `destroy()` | Cleanup debounce timer |

## Related

- Parent: [[SessionWorkspaceView]]
- Subscription wiring: [[SessionWorkspaceSubscriptions]]
- Reverse sync: `session.notes.reverseSynced` updates notes via this panel
