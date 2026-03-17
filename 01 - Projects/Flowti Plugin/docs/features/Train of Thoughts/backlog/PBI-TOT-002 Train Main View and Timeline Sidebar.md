---
type: ProductBacklogItem
feature: "[[Train of Thoughts PRD]]"
stage: planned
priority: high
effort: large
dependencies:
  - "[[PBI-TOT-001 Train Domain and Serial Capture]]"
user_story: "[[I want to have the option to create a serial note session on every enter a new quick capture modal opens with the last note title in the description]]"
note: "UI layer for Train of Thoughts — dedicated main view for thought navigation and detail, timeline sidebar for graph visualization. 2 increments: Inc 3 = Train Main View, Inc 4 = Timeline Sidebar."
tags:
  - backlog
  - train-of-thought
  - ui
---

## User Story — Problem Space

As a user, I want a dedicated view to navigate my thought chain and a sidebar timeline graph so that I can visualize, browse, and branch my train of thoughts.

### User Pains

- No way to see the full structure of a thought chain
- No visual timeline showing how ideas evolved and branched
- No dedicated navigation between linked thoughts
- Thought detail requires opening each note individually

### User Needs

- Train Main View: current thought content, navigation, branch links, open-in-editor action
- Timeline Sidebar: top-down graph with branching, click-to-navigate, timestamps
- Seamless navigation between capture mode (modal) and review mode (views)

## Solution Statement

### Use Cases

**Gherkin:**
```gherkin
Given a train session with 5 thoughts in a linear chain
When the user views the Train Main View
Then the active thought's content is displayed
And "Previous" and "Next" navigation buttons are shown
And a link to open the underlying note in Obsidian's editor is visible

Given a train session with a branch at thought #3
When the user navigates to thought #3 in the Timeline Sidebar
Then thought #3 becomes active in the Train Main View
And branch links ("Path A", "Path B") are shown below the content
And the Timeline Sidebar highlights the active node

Given the user clicks "Resume" on a paused train
When the TrainCaptureModal opens
Then capture continues from the currently active thought
```

### Functional Requirements

- [ ] `TrainMainView` extends `ItemView` — thought detail with title, content, properties, navigation
- [ ] Previous/Next navigation buttons following the chain
- [ ] Branch links shown when a thought has multiple continuations
- [ ] "Open in editor" link to open the underlying vault note
- [ ] "Resume capture" button to reopen the serial capture modal from the active thought
- [ ] `TrainTimelineSidebar` extends `ItemView` — top-down timeline graph
- [ ] Graph nodes are clickable (navigates to that thought in the Main View)
- [ ] Branches visualized as tree forks
- [ ] Active node highlighted in the graph
- [ ] Timestamps shown on the timeline axis
- [ ] Events: `train.thought.activated` when user navigates

### Technical Requirements

- [ ] `src/ui/train/TrainMainView.ts` — main view (~300 LOC)
- [ ] `src/ui/train/TrainTimelineSidebar.ts` — sidebar view (~250 LOC)
- [ ] `src/ui/train/TrainTimelineRenderer.ts` — graph rendering component (~200 LOC)
- [ ] `src/domain/hub/types.ts` — VIEW_TYPE constants for both views
- [ ] View registration in `main.ts`

### Constraints

- Timeline rendering must work with pure HTML/CSS (no external graph libraries for v1)
- Main View must not duplicate Obsidian's editor — it shows rendered content + navigation chrome
- Both views must re-render on train events (thought.added, thought.activated)

### Inc 3: Train Main View

**Goal:** Dedicated main view for thought navigation and detail.

| Step | File | Purpose | Est. LOC |
|------|------|---------|----------|
| 1 | `src/ui/train/TrainMainView.ts` | ItemView: thought detail, nav buttons, branch links | ~300 |
| 2 | `src/ui/train/types.ts` | VIEW_TYPE_TRAIN_MAIN, VIEW_TYPE_TRAIN_TIMELINE | ~10 |
| 3 | `src/main.ts` | Register TrainMainView + leaf activation | ~15 |
| 4 | Integration | Wire train events to view re-render | ~30 |

**Est. total:** ~355 LOC source, ~100 LOC tests, ~20 new tests

### Inc 4: Timeline Sidebar

**Goal:** Sidebar timeline graph visualization with click-to-navigate.

| Step | File | Purpose | Est. LOC |
|------|------|---------|----------|
| 1 | `src/ui/train/TrainTimelineRenderer.ts` | HTML/CSS tree graph component | ~200 |
| 2 | `src/ui/train/TrainTimelineSidebar.ts` | ItemView wrapper for timeline | ~250 |
| 3 | `src/main.ts` | Register sidebar view | ~10 |
| 4 | Integration | Click-to-navigate, active node highlight, auto-scroll | ~40 |

**Est. total:** ~500 LOC source, ~80 LOC tests, ~15 new tests
