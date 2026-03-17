---
type: Component
domain: Flowti
stage: done
description: "Modal for saving a session as a reusable template with pre-filled name, type, and duration"
source: "[[Development/flowti/src/ui/modals.ts|modals.ts]]"
parent: "[[SessionWorkspaceView]]"
tags:
  - session
  - component
  - modal
---

# SaveTemplateModal

## Description

SaveTemplateModal is a simple Obsidian `Modal` for saving the current session as a reusable template. Pre-fills the template name from the session title and shows session type and duration as read-only context. On submit, calls `onSubmit` with the trimmed template name.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `Modal` | obsidian | Base class for the modal |
| `Setting` | obsidian | Renders form controls (text input, buttons) |

## State

**Constructor params:**
- `sessionTitle` — pre-filled template name
- `sessionType` — displayed as read-only context
- `sessionDuration` — displayed as read-only context (minutes)
- `onSubmit` — callback invoked with template name string

## Renders

- "Save as Template" heading
- Type + duration info line
- Text input with "Template Name" label, pre-filled with session title
- Cancel and "Save Template" (CTA) buttons

## Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| (none) | — | Uses `onSubmit` callback |

## Related

- Consumer: [[SessionWorkspaceHelpers]] (`openSaveTemplateModal()`)
- Source: `src/ui/modals.ts` (line 334)
