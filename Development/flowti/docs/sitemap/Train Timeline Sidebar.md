---
stage: done
domain: Train
plugin: "[[Development/flowti/README|README]]"
tags:
  - view
  - train
  - timeline
  - sidebar
description: Right sidebar view showing the thought graph as a vertical timeline with nodes, branches, active highlighting, and click-to-navigate
type: View
viewType: flowti-train-timeline
extends: ItemView
source: "[[Development/flowti/src/ui/train/TrainTimelineSidebar.ts|TrainTimelineSidebar.ts]]"
feature: "[[Train of Thoughts PRD]]"
parent: "[[Train Main View]]"
---

# Train Timeline Sidebar

## Description

The Train Timeline Sidebar is a right-sidebar view that visualizes the thought graph of a Train of Thoughts session. It renders a vertical node list where each thought is a clickable node with a bullet, title, and timestamp. Branch thoughts are indented to show the graph structure.

The sidebar auto-opens in the right split on `train.started` and syncs bidirectionally with the Train Main View via `train.thought.activated` events. Clicking a node in the sidebar navigates the Main View to that thought (and vice versa).

### Layout

```
┌──────────────────────────────────┐
│ 🚂 My Deep Dive    [running]    │  header
│ 8 thoughts · 2 branches · 12m   │  stats line
├──────────────────────────────────┤
│ ● Initial idea                  │  root (active = filled)
│ │                               │  tree connector
│ ○ Schema design          (+2) ▾ │  node + branch badge + chevron
│ │ ├─ ↗ NoSQL branch             │  branch depth-1 (indented)
│ │ └─ ↗ Graph approach           │  branch depth-1
│ │                               │
│ ○ API endpoints                 │  next node
│ │                               │
│ ○ Error handling                │  next node
└──────────────────────────────────┘
```

## Use Cases

### Visualize thought graph
See the complete thought chain at a glance, with branches indented to show the directed graph structure. The timeline renders the main chain (following "next" relations from root) with branch sub-trees inline.

### Navigate to a thought
Click any node to navigate the Train Main View to that thought. The clicked node gets highlighted with a filled bullet and accent style. Navigation emits `train.thought.activated` for cross-view sync.

### Track active thought
The currently active thought is highlighted with a filled bullet (`●`) and the `.flowti-timeline-node-active` CSS class. Other nodes show an open bullet (`○`). The highlight updates on navigation from the Main View.

### Monitor train status
The header badge shows the train status (running/paused/completed) and updates reactively on lifecycle events.

## Technical Notes

- Registered under view type `flowti-train-timeline` with the `git-branch` icon
- Extends `ItemView` directly (not BaseHubView) — single-timeline focus, no tabs
- Opens in right sidebar via `getRightLeaf(false)` — non-splitting
- Uses `ft-hide-header` class for Obsidian view header hiding
- `getState()`/`setState()` persist `trainId` + `activeThoughtId` for workspace re-open
- 6 event subscriptions for live updates (started, thought.added, paused, resumed, completed, thought.activated)
- All subscriptions extracted to `TrainTimelineSidebarSubscriptions.ts` and cleaned up in `onClose()`
- Recursive `renderSubtree()` — main chain as depth-0 spine, branches at depth+1, nested branches at depth+2
- Tree connectors (`│`, `├─`, `└─`) via CSS pseudo-elements on `.flowti-timeline-connector`
- `(+N)` branch count badge on main-chain nodes with branches
- Collapse/expand: `collapsedNodes = new Set<string>()`, clickable chevrons (▸/▾) on branch-parent nodes
- Compact stats line in header: "X thoughts · Y branches · Z min"
- Auto-scroll active node into view (`scrollIntoView({ block: "nearest" })`)
- Source: `src/ui/train/TrainTimelineSidebar.ts` (~297 LOC)

## Related Flows

These flow docs describe end-to-end user journeys that pass through this view:

- [[Start a Train of Thoughts]] -- Serial thought capture, navigation, and train lifecycle

## Related Decisions

- [[L-14 Standalone views dont need BaseHubView]] -- Train Timeline Sidebar extends ItemView directly, not BaseHubView
