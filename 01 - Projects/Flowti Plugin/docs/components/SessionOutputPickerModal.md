---
type: Component
domain: Flowti
stage: done
description: "Output template picker modal with card-style layout for built-in and custom templates"
source: "[[Development/flowti/src/ui/session/SessionOutputPickerModal.ts|SessionOutputPickerModal.ts]]"
parent: "[[SessionWorkspaceView]]"
tags:
  - session
  - component
  - modal
---

# SessionOutputPickerModal

## Description

SessionOutputPickerModal presents built-in and custom output templates as selectable cards in a modal dialog. Each card shows the template title, type badge, and description with hover effects. On selection, calls `onSelect` with the chosen template and closes. Used by the Session Workspace to generate output artifacts (meeting invites, action items, review summaries).

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `Modal` | obsidian | Base class for the modal |
| `SessionOutputTemplate` | type | Template with `title`, `description`, `type` |
| `BUILT_IN_OUTPUT_TEMPLATES` | constant | Array of default output templates from helpers |
| `setIcon` | obsidian | Renders type-specific icons (calendar, check-square, clipboard-list, file-text) |

## State

**Constructor params:**
- `customTemplates` — optional additional templates to show after built-in ones
- `onSelect` — callback invoked with selected template

## Renders

- "Generate Output Artifact" header with descriptive subtitle
- Vertical card grid: each card shows icon + title + type badge + description
- Cards have hover highlight effect
- Cancel button at bottom

## Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| (none) | — | Uses `onSelect` callback; parent emits `session.output.generate` |

## Related

- Consumer: [[SessionOutputPanel]] (triggers via `onGenerate` callback)
- Helper: [[SessionWorkspaceHelpers]] (`openOutputPicker()`)
- Domain: `BUILT_IN_OUTPUT_TEMPLATES` in `src/domain/session/helpers.ts`
