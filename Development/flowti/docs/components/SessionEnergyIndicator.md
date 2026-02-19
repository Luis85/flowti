---
type: Component
domain: Flowti
stage: done
description: "Clickable 1-5 energy level indicator with lightning bolt dots and text label"
source: "[[Development/flowti/src/ui/session/SessionEnergyIndicator.ts|SessionEnergyIndicator.ts]]"
parent: "[[SessionWorkspaceView]]"
tags:
  - session
  - component
---

# SessionEnergyIndicator

## Description

SessionEnergyIndicator renders a 1-5 energy level display using lightning bolt emoji dots. Each dot is clickable when the session is running or paused, allowing the user to set their energy level. The indicator includes a text label (Drained/Low/Moderate/Good/Energized) with the numeric value. Supports incremental refresh via `refreshEnergy()`.

Read-only when the session is completed, archived, or in other non-active states.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `SessionPanelDeps` | interface | Provides `getSession()`, `eventBus` |
| `EnergyLevel` | type | 1-5 numeric energy level |

## State

**Reads via `deps.getSession()`:**
- `energy` — current `EnergyLevel | null`
- `status` — determines interactivity (running/paused = clickable)

## Renders

- Inline row: "Energy" label + 5 lightning bolt dots + text label
- Active dots at full opacity, inactive at 0.25 opacity
- Each dot has tooltip: `"{Label} ({level}/5)"`
- Text label shows `"{Label} ({level}/5)"` or "Not set" when null
- Dots are clickable in running/paused states, pointer cursor changes accordingly

## Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| `session.energy.set` | Emitted | Set energy level when a dot is clicked |

## API

| Method | Purpose |
|--------|---------|
| `render()` | Initial full render into container |
| `refreshEnergy()` | Update dot highlights and label without full re-render |

## Related

- Parent: [[SessionWorkspaceView]]
- Siblings: [[CognitiveLoadAlert]] (energy feeds overload detection)
- Subscription wiring: [[SessionWorkspaceSubscriptions]]
- ADR: [[ADR-031 Session v2 Architecture]]
