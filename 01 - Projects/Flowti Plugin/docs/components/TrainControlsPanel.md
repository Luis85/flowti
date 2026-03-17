---
type: Component
domain: Train
stage: done
description: "Status-aware action buttons for train lifecycle — Pause, Resume, Complete, Add Thought"
source: "[[Development/flowti/src/ui/train/TrainControlsPanel.ts|TrainControlsPanel.ts]]"
parent: "[[TrainMainView]]"
tags:
  - train
  - component
  - panel
---

# TrainControlsPanel

## Description

TrainControlsPanel renders status-aware action buttons that control the train lifecycle. Button visibility depends on the train's current status. All mutations go through TrainService; the panel calls `deps.scheduleRender()` after each action to trigger a view update.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `TrainPanelDeps` | interface | Shared deps: `trainService`, `eventBus`, `scheduleRender()` |
| `TrainState` | type | Train data for status-based rendering |
| `setIcon` | obsidian | Icon rendering for buttons |

## State

**Stateless** — button visibility derived from `train.status` on each render.

## Renders

| Status | Buttons |
|--------|---------|
| running | Pause, Complete, Add Thought (primary) |
| paused | Resume, Complete |
| completed | (none) |

## Button Actions

| Button | Service Call | Event |
|--------|------------|-------|
| Pause | `trainService.pause(trainId)` | `train.paused` |
| Resume | `trainService.resume(trainId)` | `train.resumed` |
| Complete | `trainService.completeTrain(trainId)` | `train.completed` |
| Add Thought | — | `ui.startTrain` (reopens capture modal) |

## API

| Method | Purpose |
|--------|---------|
| `constructor(el, deps)` | Bind to DOM element and deps |
| `render(train)` | Clear and re-render status-aware buttons |

## Related

- Parent: [[TrainMainView]]
- Deps: `TrainPanelDeps` in `src/ui/train/types.ts`
- Source: `src/ui/train/TrainControlsPanel.ts` (~63 LOC)
