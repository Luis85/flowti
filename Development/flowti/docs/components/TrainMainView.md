---
type: Component
domain: Train
stage: done
description: "Dedicated ItemView for navigating thoughts in a train — header, breadcrumb, stats, nav bar, thought detail, content preview, branch links, controls, timer"
source: "[[Development/flowti/src/ui/train/TrainMainView.ts|TrainMainView.ts]]"
tags:
  - train
  - view
  - component
---

# TrainMainView

## Description

TrainMainView is the main navigation view for a Train of Thoughts. It extends `ItemView` directly (not BaseHubView) and renders a single-column layout with header, breadcrumb, stats grid, navigation bar, thought detail with content preview, branch links, controls panel, and optional timer/parent link. The view auto-opens on `train.started` and persists `trainId` via `getState()`/`setState()`.

Event subscriptions are extracted to `TrainMainViewSubscriptions.ts` following the same pattern as `SessionWorkspaceSubscriptions.ts`. Three panel components are extracted: `TrainStatsPanel`, `TrainControlsPanel`, and `TrainBreadcrumbPanel`.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `IEventBus` | interface | Event subscription and emission |
| `TrainService` | service | Train data access (getTrain, getTimeline, getBranches, getChildren) |
| `TrainViewContext` | interface | Context object passed to subscription setup |
| `setupTrainViewSubscriptions` | function | Extracted event subscription wiring |
| `TrainStatsPanel` | component | Stat grid (thoughts, branches, chain, elapsed, status) |
| `TrainControlsPanel` | component | Status-aware lifecycle buttons (pause/resume/complete/add thought) |
| `TrainBreadcrumbPanel` | component | Root-to-active thought path with clickable segments |
| `VIEW_TYPE_TRAIN_MAIN` | constant | Obsidian view type identifier |

## State

**Internal:**
- `trainId: string | null` — ID of the displayed train (persisted via getState/setState)
- `activeThoughtIndex: number` — Index into the timeline array (0-based)
- `renderTimer: ReturnType<typeof setTimeout> | null` — Debounced render scheduling (16ms)

## Renders

- **Header**: train icon, title, status badge (running/paused/completed)
- **Breadcrumb**: root-to-active thought path with clickable segments (via `TrainBreadcrumbPanel`)
- **Stats grid**: thoughts, branches, chain length, elapsed, status (via `TrainStatsPanel`)
- **Nav bar**: Previous button, "Thought N of M" counter, Next button (disabled at boundaries)
- **Thought detail**: title heading, metadata (created time, order, direction)
- **Content preview**: first ~200 chars of thought note via `app.vault.cachedRead()` (truncated with "...")
- **Branch links**: clickable list of branch children (if any)
- **Controls panel**: status-aware buttons — Pause/Complete/Add Thought (running), Resume/Complete (paused) (via `TrainControlsPanel`)
- **Action buttons**: "Open in Editor" (opens vault note)
- **Timer**: monospace countdown when `durationMinutes > 0`, updates on `session.timer.tick` (DOM-only)
- **Parent link**: clickable link to parent train when `parentTrainId` exists
- **Empty state**: shown when no train is loaded

## Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| `train.started` | in | Set trainId, reset to first thought, re-render |
| `train.thought.added` | in | Re-render to show new thought |
| `train.paused` | in | Re-render status badge + controls |
| `train.resumed` | in | Re-render status badge + controls |
| `train.completed` | in | Re-render, hide controls |
| `train.thought.activated` | in/out | Navigate to thought / sync with other views |
| `session.timer.tick` | in | Update timer display (DOM-only, filtered by sessionId) |

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
- Panels: [[TrainStatsPanel]], [[TrainControlsPanel]], [[TrainBreadcrumbPanel]]
- Sitemap: [[Train Main View]]
- Flow: [[Start a Train of Thoughts]]
- Service: `TrainService` in `src/domain/train/TrainService.ts`
- Source: `src/ui/train/TrainMainView.ts` (~323 LOC)
