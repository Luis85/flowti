---
type: Flow
domain: Flowti
stage: done
description: Serial thought capture via a recursive modal loop — each thought becomes a linked vault note in a navigable chain with optional branching
domains:
  - Train
services:
  - TrainService
  - CaptureService
events:
  - train.started
  - train.thought.added
  - train.paused
  - train.resumed
  - train.completed
  - train.thought.activated
  - ui.startTrain
  - session.closure.started
  - session.closure.completed
tags:
  - train
  - capture
---

# Start a Train of Thoughts

## Overview

Train of Thoughts provides serial thought capture via a command palette action or ribbon icon. The user names their train, then enters a recursive modal loop — each thought gets a title, an optional direction (continue chain or branch), and is immediately saved as a vault note with structured frontmatter. CaptureService creates the note (skipping `capture.note.created` for thoughts to avoid duplicate inbox items), TrainService links it into a directed graph via `ThoughtRelation` records, and frontmatter is enriched with compass navigation links (`next`, `back`, `up`, `down`) and `train-session` fields. The user can pause (Escape/close), complete (done forever), or keep adding thoughts. A paused train can be resumed later; a completed train frees the slot for a new one.

## Trigger

User clicks the "Train of Thoughts" ribbon icon (train-front) or invokes the "Start Train of Thoughts" command from the command palette (Ctrl/Cmd+P → "Start Train of Thoughts"). If an active or paused train exists, the ribbon icon opens the Train Main View instead of starting a new train. The "View Train of Thoughts" command is only visible when a train is active or paused.

## Steps

### 1. User Initiates Train

- **View/Service**: main.ts (ribbon icon / command registry)
- **User Action**: Clicks ribbon icon or invokes command from palette
- **System Response**: The ribbon icon first checks for an active train. If one exists (running or paused), it emits `ui.openTrainView` to open the Train Main View. Otherwise, it emits `ui.startTrain`. The `ui.startTrain` listener checks for an active train: if paused, it resumes the train (which auto-opens the Train Main View + capture modal via the `train.resumed` listener). If no paused train exists (running or none), it opens an InputModal for the train title. Starting a new train while one is already running auto-pauses the running train (session nesting) and sets `parentTrainId` on the new train.
- **Events**: `ui.openTrainView` (if train exists) or `ui.startTrain` (if no train)

### 2. User Names the Train

- **View/Service**: InputModal
- **User Action**: Types a train title and presses Enter or clicks "Start". The modal heading reads "Start a new Train of Thoughts" with the prompt "What are you thinking?" and a placeholder "e.g. Exploring a new idea…".
- **System Response**: InputModal captures the title. On submit, main.ts reads `defaultTrainDuration` from settings and calls `TrainService.startTrain(title, durationMinutes)`. TrainService creates a linked session via `session.create` event (type: "train-of-thoughts", durationMinutes), waits for `session.created`, starts the session, then creates a `TrainState` with status "running" and `durationMinutes`. The train is persisted via TypedStorage. If `trainAutoOpenTimeline` is enabled in settings, the Timeline Sidebar auto-opens in the right sidebar.
- **Events**: `session.create`, `session.created`, `session.start`, `train.started`

### 3. Capture Modal Opens

- **View/Service**: TrainCaptureModal
- **User Action**: (none — automatic)
- **System Response**: main.ts opens a `TrainCaptureModal` with the train title, previous thought title (null for first), thought count, and timer configuration. The modal displays: heading ("Train: [title]"), countdown timer (if `durationMinutes > 0`), context banner ("Previous: [title]" if not first), thought counter ("Thought #N"), title input with auto-focus, direction selector (if not first thought), and three action buttons: Pause, Complete, Add Thought. When timeboxed, the timer counts down via `session.timer.tick` events and auto-completes the train when time expires.
- **Events**: (none — UI display only)

### 4. User Enters Thought Title

- **View/Service**: TrainCaptureModal
- **User Action**: Types a thought title. Optionally selects direction: "Continue chain →" (next, default) or "Branch ↗" (branch).
- **System Response**: The modal captures the title and direction values. Title input has auto-focus and supports Enter key to submit.
- **Events**: (none — user input)

### 5. User Submits Thought

- **View/Service**: TrainCaptureModal → main.ts → TrainService → CaptureService
- **User Action**: Presses Enter or clicks "Add Thought"
- **System Response**: The modal calls `onSubmit(title, direction)`. main.ts fires `addThought(trainId, title, { direction })` as fire-and-forget (no blocking). A new `TrainCaptureModal` opens immediately with optimistic context (previous title = submitted title, count + 1). Meanwhile, TrainService creates the vault note via CaptureService (type: "thought") — when `trainFolder` is configured in settings, the note is created there instead of the default `captureFolder`. CaptureService skips `capture.note.created` for type "thought" to prevent duplicate inbox items. TrainService creates a `ThoughtNode`, links it to the previous thought via a `ThoughtRelation` with the selected direction, persists state, and enriches frontmatter with compass navigation links (`next`, `back`, `up`, `down`), `train-session`, and `thought-order` fields.
- **Events**: `train.thought.added` (with `direction` field)

### 6. User Pauses Train

- **View/Service**: TrainCaptureModal → main.ts → TrainService
- **User Action**: Clicks "Pause" button or presses Escape / closes the modal
- **System Response**: The modal calls `onCancel()`. main.ts calls `TrainService.pause(trainId)`. The train status changes to "paused", `pausedAt` timestamp is set, and `session.pause` + `train.paused` events are emitted. The user can resume later via the same ribbon icon or command.
- **Events**: `session.pause`, `train.paused`

### 7. User Completes Train

- **View/Service**: TrainCaptureModal → main.ts → TrainService
- **User Action**: Clicks "Complete" button
- **System Response**: The modal calls `onComplete()`. main.ts calls `TrainService.completeTrain(trainId)`. The train status changes to "completed", `completedAt` timestamp is set, and `session.complete` + `train.completed` events are emitted. The train is now done — using the train command again will prompt for a new train title.
- **Events**: `session.complete`, `train.completed`

### 8. User Resumes Paused Train

- **View/Service**: main.ts → TrainService → TrainCaptureModal
- **User Action**: Clicks ribbon icon or invokes command while a paused train exists
- **System Response**: The `ui.startTrain` handler calls `getActiveTrain()`, finds the paused train, calls `TrainService.resume(trainId)`, and opens the capture modal at the current position (last thought as context, current count).
- **Events**: `session.resume`, `train.resumed`

## Decision Points

| Decision | Options | Default |
|----------|---------|---------|
| Thought direction | "Continue chain →" (next) or "Branch ↗" (branch) | next |
| Close action | Pause (resume later) or Complete (done forever) | Pause (Escape) |
| Train title | User-entered free text | (required) |
| Timer duration | Unlimited, 5, 10, 15, 25, 50 min (configurable in Settings) | `defaultTrainDuration` setting (default: 0 = Unlimited) |
| Thought folder | `trainFolder` setting or `captureFolder` fallback | `captureFolder` (inbox) |
| Auto-open timeline | `trainAutoOpenTimeline` toggle | enabled |
| Max thoughts | `trainMaxThoughts` cap | 500 |

### 9. User Navigates Thoughts in Main View

- **View/Service**: TrainMainView
- **User Action**: Clicks Previous/Next buttons, branch links, breadcrumb segments, or control buttons (Pause/Resume/Complete/Add Thought/Open in Editor)
- **System Response**: The Train Main View auto-opens on `train.started` as a new tab (or updates an existing tab). It shows a breadcrumb path (root to active thought), a stats grid (thoughts, branches, chain length, elapsed time, status), the active thought with title, order, direction, and metadata, a content preview (first ~200 chars of the vault note), and status-aware control buttons. When `durationMinutes > 0`, a monospace timer counts down via `session.timer.tick`. When `parentTrainId` exists, a link to the parent train is shown. Previous/Next buttons navigate the main chain (disabled at boundaries). Branch links are clickable and switch to the branched thought. The view persists `trainId` via `getState()`/`setState()` for workspace re-open. Navigation emits `train.thought.activated` for cross-view sync.
- **Events**: `train.thought.activated`

### 10. User Monitors Timeline in Sidebar

- **View/Service**: TrainTimelineSidebar
- **User Action**: Views the thought graph in the right sidebar; clicks on nodes to navigate; collapses/expands branches
- **System Response**: The Train Timeline Sidebar auto-opens in the right sidebar on `train.started`. A compact stats line shows "X thoughts · Y branches · Z min". It renders a recursive tree with the main chain as a depth-0 spine and branches indented at depth+1, connected by tree connectors (`│`, `├─`, `└─`). Each node shows a bullet (filled for active, open for inactive), title, and timestamp. Nodes with branches show a `(+N)` badge and a clickable chevron (▸/▾) for collapse/expand. The active node auto-scrolls into view. Clicking a node emits `train.thought.activated` which the Main View listens to (and vice versa) for bidirectional sync. The sidebar persists `trainId` + `activeThoughtId` via `getState()`/`setState()`.
- **Events**: `train.thought.activated`

## Events Sequence

### Start + Capture

```
[Ribbon click / Command invoke]
    → ui.startTrain
    → [InputModal opens — user enters title]
    → session.create { type: "train-of-thoughts" }
    → session.created { session }
    → session.start { sessionId }
    → train.started { train }
    → [TrainCaptureModal opens]
    → [User types thought + submits]
    → CaptureService.capture() (skips capture.note.created for type "thought")
    → train.thought.added { trainId, thought, previousTitle, direction }
    → [Next modal opens immediately — loop continues]
```

### Pause + Resume

```
[User closes modal / clicks Pause]
    → session.pause { sessionId }
    → train.paused { trainId }
    ...later...
[User invokes train command again]
    → ui.startTrain
    → session.resume { sessionId }
    → train.resumed { trainId }
    → [TrainCaptureModal opens at current position]
```

### Nesting (start new train while one is running)

```
[User invokes "Start Train" while Train A is running]
    → ui.startTrain
    → [InputModal opens — user enters title]
    → TrainService.startTrain(title)
    → TrainService.pause(trainA.id)   ← auto-pause
        → session.pause { sessionId: trainA.sessionId }
        → train.paused { trainId: trainA.id }
    → session.create { type: "train-of-thoughts" }
    → train.started { train: { ...trainB, parentTrainId: trainA.id } }
```

### Complete + Closure Ritual

```
[User clicks Complete]
    → session.complete { sessionId }
    → session.closure.started { sessionId }  ← session transitions to "reviewing"
    → [Session Workspace auto-opens for train-of-thought sessions]
    → [Closure overlay renders train-specific questions]
    → [User submits closure response]
    → session.closure.completed { sessionId, response }
    → session.completed { session }
    → train.completed { trainId, thoughtCount }
```

## Frontmatter Template

### Thought note (created by CaptureService + enriched by TrainService)

Navigation uses a compass model: `next` (linear forward), `back` (linear backward), `up` (branch children), `down` (branch parent). Each property is a list of wikilinks rebuilt from the full relation graph.

```yaml
---
type: Thought
created: 2026-02-21T14:30:00.000Z
origin: quick-capture
train-session: "My Deep Dive"
thought-order: 2
next: []
back:
  - "[[Previous Thought Title]]"
up: []
down: []
---
```

### Source thought (updated with forward link)

```yaml
---
next:
  - "[[New Thought Title]]"
back: []
up: []
down: []
---
```

## Train State Model

| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique train ID (`train_<uuid>`) |
| sessionId | string | Linked session ID |
| title | string | User-provided train title |
| status | `"running" \| "paused" \| "completed"` | Current state |
| thoughts | ThoughtNode[] | Ordered array of thought nodes |
| relations | ThoughtRelation[] | Directed edges: `{ fromId, toId, direction }` |
| createdAt | ISO string | Creation timestamp |
| pausedAt | ISO string \| null | Last pause timestamp |
| durationMinutes | number | Timer duration (0 = unlimited / no timer) |
| completedAt | ISO string \| null | Completion timestamp |
| parentTrainId | string \| undefined | ID of the train that was paused when this one started (nesting) |

## Navigation Helpers

| Method | Returns | Description |
|--------|---------|-------------|
| `getTimeline(trainId)` | ThoughtNode[] | Main chain — follows "next" relations from root |
| `getBranches(trainId, thoughtId)` | ThoughtNode[] | Branch children of a specific thought |
| `getChildren(trainId, thoughtId)` | ThoughtNode[] | All children (next + branch) |

## Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `trainFolder` | string | `""` (empty = use `captureFolder`) | Folder for thought notes created during trains |
| `trainAutoOpenTimeline` | boolean | `true` | Auto-open Timeline Sidebar on `train.started` |
| `trainMaxThoughts` | number | 500 | Maximum thoughts per train before cap |
| `defaultTrainDuration` | number | 0 | Default timer duration in minutes (0 = unlimited) |

Settings are accessible from both the Obsidian Settings tab (Train section) and the User Hub Preferences tab (Trains category).

## Related Decisions

- TrainService depends on CaptureService for note creation — reuses the same file creation + frontmatter logic
- CaptureInput `folder?` override allows TrainService to redirect note creation to `trainFolder` without bypassing CaptureService
- TrainService uses a late-binding `getSettings` pattern (same as CaptureService) for trainFolder access
- Each train creates a linked session (type: "train-of-thoughts") to integrate with session lifecycle
- `ThoughtRelation` uses `direction: "next" | "branch"` instead of generic `type` for clarity
- Frontmatter uses compass navigation model (`next`, `back`, `up`, `down`) — wikilink arrays rebuilt from the full relation graph on each update
- Optimistic modal opening (fire-and-forget addThought) keeps the capture loop fast — file I/O doesn't block the next modal
- MAX_THOUGHTS_PER_TRAIN = 500 (configurable via `trainMaxThoughts`), MAX_TRAINS = 100 with oldest-first eviction
- Train sessions suppress Session Workspace auto-open (`session.type === "train-of-thought"` guard) and workspace state restore — trains use TrainMainView as their primary view
- Train–session lifecycle sync: `session.completed/resumed/paused` events auto-sync the linked train status via `TrainService.setupListeners()`
- Three extracted panels (TrainStatsPanel, TrainControlsPanel, TrainBreadcrumbPanel) keep TrainMainView focused on orchestration while panels own rendering

## Closure Ritual

When a train session completes (via `session.complete`), the session transitions to "reviewing" status and emits `session.closure.started`. For `train-of-thought` sessions, this auto-opens the Session Workspace where the closure overlay renders train-specific questions:

| Question | Type | Required |
|----------|------|----------|
| "What was the key insight from this train?" | text | yes |
| "Did any patterns or connections emerge?" | text | no |
| "What needs further exploration?" | text | no |
| "How productive was this session?" | select (very/somewhat/not productive) | yes |

The user can submit the closure response or skip it. Submitting transitions the session to "completed" status; skipping also completes but without a closure response.

Template resolution follows the 3-tier hierarchy: type-specific (`SESSION_TYPE_CONFIGS["train-of-thought"].closureTemplate`) → global override → `DEFAULT_CLOSURE_TEMPLATE`.

## Session Nesting

Starting a new train while one is already running causes the running train to auto-pause. The new train stores `parentTrainId` linking back to the paused train. Resuming a train also auto-pauses any other running train. This enables quick context switches between thought chains without losing state.

Nesting is limited to one level — there is no deep nesting beyond pausing one train to start another.

## User Hub Integration

Train-of-thought sessions have special treatment in the User Hub:

- **Master list**: train-front icon + "N thoughts" badge on train sessions
- **Detail panel**: train section showing thought count, branch count, clickable thought list (max 5 shown)
- **Action buttons**: "Open Train" replaces "Workspace", "Timeline" replaces "Sidebar" for train sessions
- **Dashboard**: active train card shows train-front icon + thought count badge
- **NewSessionModal**: `train-of-thought` type is filtered out — trains are only created via ribbon/command

## Known Limitations

- Branch thoughts always link from the last thought unless caller specifies `fromThoughtId`
- No way to delete individual thoughts from a train

## Related Use Cases

- [[Capture Ideas and Feedback]] (CaptureService creates thought notes with `type: "thought"`)
- [[Create and Manage Sessions]] (each train creates a linked session)
- [[Browse and Configure Events]] (train events registered in catalog under "Train" category)
