---
type: Component
domain: Train
stage: done
description: "Breadcrumb path from root thought to active thought — clickable segments for navigation"
source: "[[Development/flowti/src/ui/train/TrainBreadcrumbPanel.ts|TrainBreadcrumbPanel.ts]]"
parent: "[[TrainMainView]]"
tags:
  - train
  - component
  - panel
---

# TrainBreadcrumbPanel

## Description

TrainBreadcrumbPanel renders a clickable breadcrumb path from the root thought to the currently active thought. Each intermediate segment is clickable and navigates to that thought via `train.thought.activated`. The active (last) segment is styled distinctly and is not clickable.

The path is computed by walking backwards from the target thought through the `ThoughtRelation` graph using a reverse parent map, with cycle protection via a visited set.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `TrainPanelDeps` | interface | Shared deps: `eventBus` for navigation events |
| `TrainState` | type | Train data with thoughts and relations |
| `ThoughtNode` | type | Active thought for path computation |

## State

**Stateless** — path computed from `TrainState` relations on each render.

## Renders

- **Breadcrumb bar**: horizontal sequence of `Root › A › B › [Active]`
- **Segments**: clickable spans (except the active/last one)
- **Separators**: ` › ` between segments
- **Active segment**: `.ft-train-breadcrumb-active` class, not clickable

## Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| `train.thought.activated` | out | Navigate to clicked breadcrumb segment |

## API

| Method | Purpose |
|--------|---------|
| `constructor(el, deps)` | Bind to DOM element and deps |
| `render(train, activeThought)` | Clear and re-render breadcrumb path |

## Algorithm

1. Build `thoughtById` map from `train.thoughts`
2. Build reverse `parentMap` (toId → fromId) from `train.relations`
3. Walk backwards from `activeThought` to root via `parentMap`
4. Cycle protection: `visited` set prevents infinite loops
5. Return path array in root-to-active order

## Related

- Parent: [[TrainMainView]]
- Deps: `TrainPanelDeps` in `src/ui/train/types.ts`
- Source: `src/ui/train/TrainBreadcrumbPanel.ts` (~73 LOC)
