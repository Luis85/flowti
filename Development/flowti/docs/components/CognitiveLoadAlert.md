---
type: Component
domain: Flowti
stage: done
description: "Non-blocking warning banner for cognitive overload detection with dismissible per-render-cycle state"
source: "[[Development/flowti/src/ui/session/CognitiveLoadAlert.ts|CognitiveLoadAlert.ts]]"
parent: "[[SessionWorkspaceView]]"
tags:
  - session
  - component
---

# CognitiveLoadAlert

## Description

CognitiveLoadAlert renders a warning banner when the session state exceeds cognitive load thresholds (FR-16). It uses the pure `detectCognitiveOverload()` helper to check task count, binding count, duration, and low-energy-plus-high-load combinations. The alert is dismissible per render cycle (dismissed state is not persisted). Only shown for running/paused sessions.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `SessionPanelDeps` | interface | Provides `getSession()` |
| `detectCognitiveOverload` | function | Pure helper returning `{ overloaded: boolean; reasons: string[] }` |

## State

**Internal:**
- `dismissed: boolean` — tracks whether the user dismissed the alert this render cycle

**Reads via `deps.getSession()`:**
- Full session object passed to `detectCognitiveOverload()`
- `status` — only shown for running/paused

## Renders

- Error-styled banner with border and background from `--background-modifier-error`
- Header: warning emoji + "Cognitive Overload" title + dismiss button (x)
- Bulleted list of overload reasons
- Suggestion text: "Consider reducing scope, taking a break, or completing existing tasks."
- Hidden when: not overloaded, dismissed, or session not running/paused

## Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| (none) | — | Alert is purely render-driven; refreshed via subscription wiring |

## API

| Method | Purpose |
|--------|---------|
| `render()` | Initial render (delegates to `refreshAlert()`) |
| `refreshAlert()` | Re-evaluate overload and show/hide banner |
| `resetDismissed()` | Reset dismissed state for significant session changes |

## Related

- Parent: [[SessionWorkspaceView]]
- Siblings: [[SessionEnergyIndicator]] (energy level feeds overload detection)
- Helper: `detectCognitiveOverload()` in `src/domain/session/helpers.ts`
- Subscription wiring: [[SessionWorkspaceSubscriptions]]
- ADR: [[ADR-031 Session v2 Architecture]]
