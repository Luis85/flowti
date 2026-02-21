---
type: Component
domain: Train
stage: done
description: "Dedicated ItemView for navigating thoughts in a train — header, nav bar, thought detail, branch links, action buttons"
source: "[[Development/flowti/src/ui/train/TrainMainView.ts|TrainMainView.ts]]"
tags:
  - train
  - view
  - component
---

# TrainMainView

## Description

TrainMainView is the main navigation view for a Train of Thoughts. It extends `ItemView` directly (not BaseHubView) and renders a single-column layout with header, navigation bar, thought detail, branch links, and action buttons. The view auto-opens on `train.started` and persists `trainId` via `getState()`/`setState()`.

Event subscriptions are extracted to `TrainMainViewSubscriptions.ts` following the same pattern as `SessionWorkspaceSubscriptions.ts`.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `IEventBus` | interface | Event subscription and emission |
| `TrainService` | service | Train data access (getTrain, getTimeline, getBranches, getChildren) |
| `TrainViewContext` | interface | Context object passed to subscription setup |
| `setupTrainViewSubscriptions` | function | Extracted event subscription wiring |
| `VIEW_TYPE_TRAIN_MAIN` | constant | Obsidian view type identifier |

## State

**Internal:**
- `trainId: string | null` — ID of the displayed train (persisted via getState/setState)
- `activeThoughtIndex: number` — Index into the timeline array (0-based)
- `renderTimer: ReturnType<typeof setTimeout> | null` — Debounced render scheduling (16ms)

## Renders

- **Header**: train icon, title, status badge (running/paused/completed)
- **Nav bar**: Previous button, "Thought N of M" counter, Next button (disabled at boundaries)
- **Thought detail**: title heading, metadata (created time, order, direction)
- **Branch links**: clickable list of branch children (if any)
- **Action buttons**: "Open in Editor" (opens vault note), "Resume Capture" (reopens capture modal, hidden when completed)
- **Empty state**: shown when no train is loaded

## Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| `train.started` | in | Reset to first thought, re-render |
| `train.thought.added` | in | Re-render to show new thought |
| `train.paused` | in | Re-render status badge |
| `train.resumed` | in | Re-render status badge |
| `train.completed` | in | Re-render, hide Resume button |
| `train.thought.activated` | in/out | Navigate to thought / sync with other views |

## API

| Method | Purpose |
|--------|---------|
| `getViewType()` | Returns `"flowti-train-main"` |
| `getDisplayText()` | Returns `"Train: {title}"` or `"Train of Thoughts"` |
| `getIcon()` | Returns `"train-front"` |
| `getState()` | Returns `{ trainId }` for workspace persistence |
| `setState(state)` | Loads train by ID, resets thought index |
| `onOpen()` | Initial render + subscription setup |
| `onClose()` | Cleanup subscriptions + render timer |

## Wiring

- **Auto-open**: `train.started` listener in main.ts calls `revealOrCreateTrainView(trainId)`
- **Auto-open on resume**: `train.resumed` listener in main.ts calls `revealOrCreateTrainView` + `openTrainModal`
- **Ribbon icon**: opens this view (via `ui.openTrainView`) when a train is active/paused; starts new train otherwise
- **Command**: `flowti:view-train` uses `checkCallback` — only visible when a train is active/paused
- **Session isolation**: `session.started` handler skips Session Workspace auto-open for `train-of-thought` sessions; `session.state.restore` also skipped

## Related

- Subscriptions: [[TrainMainViewSubscriptions]]
- Sitemap: [[Train Main View]]
- Flow: [[Start a Train of Thoughts]]
- Service: `TrainService` in `src/domain/train/TrainService.ts`
