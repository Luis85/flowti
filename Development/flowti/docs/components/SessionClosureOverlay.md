---
type: Component
domain: Flowti
stage: done
description: "Full-view closure ritual overlay with configurable questions, validation, and submit/skip actions"
source: "[[Development/flowti/src/ui/session/SessionClosureOverlay.ts|SessionClosureOverlay.ts]]"
parent: "[[SessionWorkspaceView]]"
tags:
  - session
  - component
---

# SessionClosureOverlay

## Description

SessionClosureOverlay renders a full-view overlay when a session enters the "reviewing" state (FR-14). It presents configurable closure questions from a `ClosureTemplate` and collects responses. Supports three question types: text (textarea), select (dropdown), and rating (1-5 buttons). Required fields are validated on submit with visual error indicators.

Unlike other session panels, this component does not use `SessionPanelDeps` — it takes the session, template, and callbacks directly in the constructor.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `ClosureTemplate` | type | Template with array of `ClosureQuestion` objects |
| `ClosureQuestion` | type | Question definition: `id`, `question`, `type`, `required`, `options` |
| `ClosureResponse` | type | Submitted response: `outcomeAchieved`, `whatWorked`, `whatDidnt`, `nextAction`, `answers` |
| `ClosureOverlayCallbacks` | interface | `onSubmit(response)` and `onSkip()` callbacks |
| `setIcon` | obsidian | Renders clipboard-check icon in header |

## State

**Internal:**
- `answers: Record<string, string>` — collected answers keyed by question ID

## Renders

- Centered overlay (max-width 600px) with header icon + "Closure Ritual" title
- Session title in subtitle: `Reflect on "{title}" before completing.`
- Question form with three input types:
  - **text**: textarea with placeholder
  - **select**: dropdown with options from template
  - **rating**: 5 numbered buttons with visual highlight on selection
- Required fields marked with asterisk; validated on submit with left-border error indicator
- Two action buttons: "Complete Session" (primary CTA) and "Skip" (secondary)

## Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| (none) | — | Uses callbacks instead of EventBus; parent wires submit/skip to service calls |

## API

| Method | Purpose |
|--------|---------|
| `render()` | Render the full closure overlay into container |

## Related

- Parent: [[SessionWorkspaceView]]
- Domain: `ClosureTemplate` in `src/domain/session/types.ts`
- ADR: [[ADR-031 Session v2 Architecture]]
- Flow: [[Run Intentional Session]]
