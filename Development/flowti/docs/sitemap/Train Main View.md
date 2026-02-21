---
stage: development
domain: Train
plugin: "[[Development/flowti/README|README]]"
tags:
  - view
  - train
  - navigation
description: Dedicated focused view for navigating thoughts in a train — shows active thought detail, prev/next navigation, branch links, and action buttons
type: View
viewType: flowti-train-main
extends: ItemView
source: "[[Development/flowti/src/ui/train/TrainMainView.ts|TrainMainView.ts]]"
feature: "[[Train of Thoughts PRD]]"
---

# Train Main View

## Description

The Train Main View is a dedicated focused leaf for navigating thoughts in a single train. Unlike Hub views that extend `BaseHubView` with a tabbed shell, this view extends `ItemView` directly because it renders a single-train navigator rather than a multi-tab hub.

The view auto-opens on `train.started` and loads a specific train (by `trainId` via `setState()` or falling back to the active train). It renders a scrollable single-column layout with a header, navigation bar, thought detail, branch links, and action buttons. All mutations go through the EventBus — the view is purely reactive.

### Layout

```
┌─────────────────────────────────────────┐
│ 🚂 Train: My Deep Dive     [running]   │  header
│ ◄ Prev   Thought 3 of 8    Next ►      │  nav bar
├─────────────────────────────────────────┤
│ Database schema needs rethinking        │  thought title
│ Created: 14:35 · Order: #3 · → next    │  metadata
├─────────────────────────────────────────┤
│ Branches:                               │  branch links
│   ↗ Alternative approach using…         │  (clickable)
│   ↗ What about NoSQL instead…           │
├─────────────────────────────────────────┤
│ [Open in Editor]   [Resume Capture]     │  actions
└─────────────────────────────────────────┘
```

## Use Cases

### Navigate thoughts in a train
Use Previous/Next buttons to walk the main chain of thoughts. The counter shows the current position (e.g., "Thought 3 of 8"). Navigation buttons are disabled at chain boundaries.

### Explore branch thoughts
When a thought has branches (alternative continuations), clickable branch links appear below the thought detail. Clicking a branch activates that thought and emits `train.thought.activated` for cross-view sync.

### Resume capturing
Click "Resume Capture" to reopen the serial capture modal at the current position. This button is hidden when the train is completed.

### Open thought in editor
Click "Open in Editor" to open the thought's vault note in the Obsidian editor for full editing.

## Technical Notes

- Registered under view type `flowti-train-main` with the `train-front` icon
- Extends `ItemView` directly (not BaseHubView) — single-train focus, no tabs
- Uses `ft-hide-header` class for Obsidian view header hiding + CSS padding compensation
- Train loading: `trainId` from `setState()` → `getActiveTrain()` (fallback)
- `getState()`/`setState()` persist `trainId` for workspace re-open
- 6 event subscriptions for live updates (started, thought.added, paused, resumed, completed, thought.activated)
- All subscriptions extracted to `TrainMainViewSubscriptions.ts` and cleaned up in `onClose()`
- Source: `src/ui/train/TrainMainView.ts` (~237 LOC)

## Related Flows

These flow docs describe end-to-end user journeys that pass through this view:

- [[Start a Train of Thoughts]] — Serial thought capture, navigation, and train lifecycle

## Related Decisions

- [[L-14 Standalone views dont need BaseHubView]] — Train Main View extends ItemView directly, not BaseHubView
