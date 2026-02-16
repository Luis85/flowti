---
type: Component
domain: Flowti
stage: done
description: "Modal for creating new documentation sessions with title, type, and duration fields"
source: "[[Development/flowti/src/ui/modals.ts|modals.ts]]"
parent: "[[UserHubView]]"
tags:
  - modal
  - component
---

# NewSessionModal

## Description

NewSessionModal is a 3-field creation modal for documentation sessions. It collects a title, session type (from `SESSION_TYPES`), and timer duration, then calls the `onSubmit` callback which emits a `session.create` event via the EventBus. The modal is opened from the Sessions tab's "New" button (in the master list header) and "New Session" button (in the empty state).

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `Modal` | obsidian | Base class for Obsidian modal dialogs |
| `Setting` | obsidian | Form field rendering (text input, dropdowns, buttons) |
| `SESSION_TYPES` | constant | Readonly array of `{ type, label, description }` — populates the type dropdown |

## Renders

- **Title**: "New Session" heading
- **Title field**: Text input with placeholder "e.g. Sprint 12 Event Storming"
- **Type field**: Dropdown populated from `SESSION_TYPES` (5 options: Event Storming, Service Design, Requirements Refinement, Backlog Structuring, Knowledge Cleanup)
- **Duration field**: Dropdown with 5 options: 25 min (Pomodoro), 50 min (Deep Work), 15 min (Quick), 45 min, 60 min. Default: 25 min
- **Buttons**: Cancel (closes modal), Create (validates non-empty title, calls `onSubmit(title, type, duration)`, closes modal)

## Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| `session.create` | Emits (via callback) | Triggered by `onSubmit` callback wired in `UserHubView.buildComponentDeps()` |

## Related

- Opened by: [[UserHubSessions]] ("New" button in header + "New Session" button in empty state)
- Wired in: [[UserHubView]] (`buildComponentDeps().openNewSessionModal`)
- Domain: `SessionService` (`src/domain/session/SessionService.ts`)
- Siblings: [[ConfirmModal]], [[InputModal]], [[CreateEventModal]]
