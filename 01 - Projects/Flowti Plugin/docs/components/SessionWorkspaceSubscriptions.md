---
type: Component
domain: Flowti
stage: done
description: "Event subscription wiring module for SessionWorkspaceView with 24 listeners and SubscriptionViewContext interface"
source: "[[Development/flowti/src/ui/session/SessionWorkspaceSubscriptions.ts|SessionWorkspaceSubscriptions.ts]]"
parent: "[[SessionWorkspaceView]]"
tags:
  - session
  - component
  - infrastructure
---

# SessionWorkspaceSubscriptions

## Description

SessionWorkspaceSubscriptions is an extracted module containing all 24 event listeners for the Session Workspace. It was extracted from `SessionWorkspaceView` to keep the main view under 450 LOC. The module exports a `setupEventSubscriptions()` function that takes a `SubscriptionViewContext` and an `IEventBus`, returning an array of unsubscribe functions for cleanup.

All listeners follow a consistent pattern: check session ID match, refresh session state, then notify the appropriate panel for incremental update or trigger a full re-render.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `IEventBus` | interface | Event bus for subscribing to session events |
| `SubscriptionViewContext` | interface | Narrow view context with `getSession()`, `setSession()`, `refreshSession()`, `render()`, `renderActions()`, panel accessors |

## Subscriptions (24 total)

| Event Group | Events | Handler |
|-------------|--------|---------|
| Timer | `session.timer.tick`, `session.timer.completed` | Update timer display or full re-render |
| Duration | `session.duration.updated` | Full re-render |
| Lifecycle | `session.started`, `.paused`, `.resumed`, `.completed` | Full re-render (own) or action refresh (other) |
| Closure | `session.closure.started`, `.completed` | Full re-render |
| Energy | `session.energy.changed` | Refresh energy indicator |
| Goals | `session.goal.added`, `.toggled`, `.removed`, `.reordered` | Refresh goals panel |
| Tasks | `session.task.added`, `.completed`, `.removed`, `.reordered` | Refresh execution panel |
| Decisions | `session.decision.recorded`, `.removed` | Refresh decision panel |
| Reflections | `session.reflection.added`, `.removed` | Refresh reflection panel |
| Notes | `session.notes.updated`, `session.notes.reverseSynced` | Update notes panel |
| Files | `session.notesFile.updated`, `session.canvasFile.updated` | Full re-render |
| Context | `session.context.bound`, `.unbound`, `.typeChanged` | Full re-render |
| Activity | `session.activity.tracked`, `session.activity.filter.updated`, `session.artifact.added` | Refresh activity panel or re-render |
| Paths | `session.paths.updated` | Full re-render |
| Output | `session.output.generated` | Refresh output panel |
| Overload | `session.overload.detected` | Refresh alert banner |
| Delete | `session.deleted` | Show empty state |
| Workspace | `session.state.save`, `session.state.restore` | Capture/restore workspace state |

## API

| Export | Purpose |
|--------|---------|
| `SubscriptionViewContext` | Interface consumed by setup function |
| `setupEventSubscriptions(ctx, eventBus)` | Registers all 24 listeners, returns unsubscribe array |

## Related

- Parent: [[SessionWorkspaceView]]
- Panels: [[SessionGoalsPanel]], [[SessionExecutionPanel]], [[SessionReflectionPanel]], [[SessionEnergyIndicator]], [[CognitiveLoadAlert]], [[SessionActivityPanel]], [[SessionOutputPanel]]
- ADR: [[ADR-031 Session v2 Architecture]]
