---
type: Component
domain: Flowti
stage: done
description: "Large countdown timer display with editable duration for prepared sessions"
source: "[[Development/flowti/src/ui/session/SessionTimerPanel.ts|SessionTimerPanel.ts]]"
parent: "[[SessionWorkspaceView]]"
tags:
  - session
  - component
---

# SessionTimerPanel

## Description

SessionTimerPanel renders the countdown timer at the top of the Session Workspace. Shows remaining time in large monospace font (36px, 700 weight). When the session is in "prepared" state, the duration is editable via a number input. Uses `formatDuration()` and `computeRemainingMs()` helpers for display calculation. Timer ticks are received via `updateDisplay()` from the subscription wiring.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `SessionPanelDeps` | interface | Provides `getSession()`, `eventBus` |
| `formatDuration` | function | Formats milliseconds to `HH:MM:SS` display |
| `computeRemainingMs` | function | Calculates remaining time from session state |

## State

**Reads via `deps.getSession()`:**
- `durationMinutes` — session duration for prepared state editor
- `status` — determines if duration is editable (prepared only)

## Renders

- Centered large timer display (monospace, letter-spaced)
- For "prepared" sessions: number input + "minutes" label for duration editing
- For running/paused: "Time Remaining" label below timer

## Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| `session.duration.update` | Emitted | Update duration when input value changes (prepared state only) |

## API

| Method | Purpose |
|--------|---------|
| `render()` | Initial full render into container |
| `updateDisplay(remainingMs)` | Update timer text without re-render (called on each tick) |

## Related

- Parent: [[SessionWorkspaceView]]
- Helpers: `formatDuration()`, `computeRemainingMs()` in `src/domain/session/helpers.ts`
- Subscription wiring: [[SessionWorkspaceSubscriptions]]
