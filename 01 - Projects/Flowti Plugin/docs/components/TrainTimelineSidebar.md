---
type: Component
domain: Train
stage: done
description: "Vertical timeline sidebar showing thought graph as a recursive tree with connectors, collapse/expand, stats line, and click-to-navigate"
source: "[[Development/flowti/src/ui/train/TrainTimelineSidebar.ts|TrainTimelineSidebar.ts]]"
tags:
  - train
  - view
  - component
---

# TrainTimelineSidebar

## Description

TrainTimelineSidebar is a right-sidebar view for visualizing the thought graph of a Train of Thoughts session. It extends `ItemView` directly (not BaseHubView) and renders a recursive tree with the main chain as a depth-0 spine, branches indented at depth+1, and tree connectors (`│`, `├─`, `└─`). Nodes with branches show a `(+N)` badge and a clickable chevron (▸/▾) for collapse/expand. A compact stats line in the header shows "X thoughts · Y branches · Z min". The active node auto-scrolls into view. The sidebar syncs bidirectionally with TrainMainView via `train.thought.activated`.

Event subscriptions are extracted to `TrainTimelineSidebarSubscriptions.ts` following the same pattern as `TrainMainViewSubscriptions.ts`.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `IEventBus` | interface | Event subscription and emission |
| `TrainService` | service | Train data access (getTrain, getTimeline, getBranches) |
| `TrainTimelineContext` | interface | Context object passed to subscription setup |
| `setupTrainTimelineSubscriptions` | function | Extracted event subscription wiring |
| `VIEW_TYPE_TRAIN_TIMELINE` | constant | Obsidian view type identifier |

## State

**Internal:**
- `trainId: string | null` -- ID of the displayed train (persisted via getState/setState)
- `activeThoughtId: string | null` -- ID of the highlighted thought (persisted via getState/setState)
- `collapsedNodes: Set<string>` -- IDs of collapsed branch-parent nodes
- `renderTimer: ReturnType<typeof setTimeout> | null` -- Debounced render scheduling (16ms)

## Renders

- **Header**: train-front icon, train title, status badge (running/paused/completed)
- **Stats line**: "X thoughts · Y branches · Z min" compact summary
- **Timeline container**: recursive tree via `renderSubtree()` — main chain depth-0, branches depth+1
- **Node**: bullet (filled/open), title, timestamp
- **Tree connectors**: `│`, `├─`, `└─` via CSS pseudo-elements on `.flowti-timeline-connector`
- **Branch badge**: `(+N)` count on main-chain nodes with branches
- **Collapse/expand**: clickable chevron (▸/▾) on branch-parent nodes; collapsed sub-trees hidden
- **Active highlighting**: `.flowti-timeline-node-active` class + filled bullet
- **Auto-scroll**: active node scrolls into view (`scrollIntoView({ block: "nearest" })`)
- **Branch indentation**: 16px padding-left per depth level
- **Empty state**: shown when no train is loaded
- **Empty chain**: shown when train has no thoughts yet

## Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| `train.started` | in | Switch to new train, reset active thought |
| `train.thought.added` | in | Re-render to show new node |
| `train.paused` | in | Re-render status badge |
| `train.resumed` | in | Re-render status badge |
| `train.completed` | in | Re-render status badge |
| `train.thought.activated` | in/out | Highlight node / sync with Main View |

## API

| Method | Purpose |
|--------|---------|
| `getViewType()` | Returns `"flowti-train-timeline"` |
| `getDisplayText()` | Returns `"Timeline: {title}"` or `"Train Timeline"` |
| `getIcon()` | Returns `"git-branch"` |
| `getState()` | Returns `{ trainId, activeThoughtId }` for workspace persistence |
| `setState(state)` | Loads train by ID + active thought, re-renders |
| `onOpen()` | Initial render + subscription setup |
| `onClose()` | Cleanup subscriptions + render timer |

## Wiring

- **Auto-open**: `train.started` listener in main.ts calls `revealOrCreateTrainTimeline(trainId)` to open in right sidebar
- **Right sidebar**: uses `getRightLeaf(false)` for non-splitting right sidebar placement
- **Bidirectional sync**: clicks emit `train.thought.activated`, which TrainMainView listens to (and vice versa)

## Related

- Subscriptions: [[TrainTimelineSidebarSubscriptions]]
- Sitemap: [[Train Timeline Sidebar]]
- Flow: [[Start a Train of Thoughts]]
- Service: `TrainService` in `src/domain/train/TrainService.ts`
- Companion: [[TrainMainView]] (bidirectional sync via `train.thought.activated`)
- Source: `src/ui/train/TrainTimelineSidebar.ts` (~297 LOC)
