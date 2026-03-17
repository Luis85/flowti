---
type: Component
domain: Train
stage: done
description: "Stat grid showing train metrics — thoughts, branches, chain length, elapsed time"
source: "[[Development/flowti/src/ui/train/TrainStatsPanel.ts|TrainStatsPanel.ts]]"
parent: "[[TrainMainView]]"
tags:
  - train
  - component
  - panel
---

# TrainStatsPanel

## Description

TrainStatsPanel renders a 4-cell stat grid via the shared `renderStatGrid()` utility. It computes derived values (branch count, chain length, elapsed time) on each render using TrainService helper methods. The panel is owned by TrainMainView and renders into a designated element.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `TrainPanelDeps` | interface | Shared deps: `trainService`, `eventBus`, `scheduleRender()` |
| `TrainState` | type | Train data for computing stats |
| `TrainService` | service | `getTimeline()` for chain length, `getBranches()` for branch count |

## State

**Stateless** — all values computed from `TrainState` on each render.

## Renders

| Stat | Icon | Value | Source |
|------|------|-------|--------|
| Thoughts | brain | Total thought count | `train.thoughts.length` |
| Branches | git-branch | Total branch count | Sum of `getBranches()` across all thoughts |
| Chain | link | Main chain length | `getTimeline(trainId).length` |
| Elapsed | clock | Minutes:seconds | Computed from `createdAt` to `completedAt`/`pausedAt`/now |

## API

| Method | Purpose |
|--------|---------|
| `constructor(el, deps)` | Bind to DOM element and deps |
| `render(train)` | Clear and re-render the stat grid |

## Related

- Parent: [[TrainMainView]]
- Deps: `TrainPanelDeps` in `src/ui/train/types.ts`
- Source: `src/ui/train/TrainStatsPanel.ts` (~57 LOC)
