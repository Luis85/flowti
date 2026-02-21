---
type: DevelopmentCycle
feature: "[[Train of Thoughts PRD]]"
stage: done
cycle: 13
date_planned: 2026-02-21
date_completed: 2026-02-21
pbis:
  - "[[PBI-TOT-001 Train Domain and Serial Capture]]"
  - "[[PBI-TOT-002 Train Main View and Timeline Sidebar]]"
  - "[[PBI-TOT-003 Session Nesting and Lifecycle]]"
bugs: []
bugs_fixed_precycle: []
tech_debt: []
estimated_increments: 8
actual_increments: 8
estimated_tests: 110
actual_tests: 73
total_tests_after: 3263
total_test_files_after: 131
---

# Cycle 13: Train of Thoughts

## Cycle Overview

**User Story:**

> As a knowledge worker using Flowti, I want to start a "Train of Thoughts" session that captures a chain of linked ideas via rapid serial capture so that I can brainstorm without breaking my flow and later navigate, branch, and elaborate on my thought timeline.

**User Pains:**
- Quick Capture creates isolated notes — the chain of thought is lost
- No dedicated mode for rapid sequential ideation
- No way to visualize how ideas evolved and branched during brainstorming
- Previous thought context is lost between individual captures

**User Needs:**
- "Start Train of Thoughts" command that enters a serial capture loop
- Each thought linked to the previous, forming a navigable chain
- Dedicated main view for thought detail and navigation
- Timeline sidebar showing the full journey with branches
- Session nesting so new trains don't require stopping the current one

---

## Situation Assessment

### Pre-Cycle State (assumes Cycle 13 complete)

**Plugin health (projected):**
- ~3,300+ tests passing, ~135+ test suites
- Build status: green
- Repository restructured for marketplace (Cycle 13)
- CI/CD pipeline operational (Cycle 13)

**Feature status across contributing PRDs:**

| PRD | Stage | FRI | Delivered So Far |
|-----|-------|-----|------------------|
| [[Train of Thoughts PRD]] | approved | 20/35 | No PBIs delivered yet — greenfield |
| [[Session Workspaces PRD]] | in-progress | 31/35 | v1 complete (8/8 FRs), v2 partial (FR-11, FR-12, FR-13, FR-14, FR-16 delivered) |
| [[Quick Capture PRD]] | in-progress | 25/35 | PBI-QC-001 delivered (Cycle 12) — 10 types, ribbons, modal, command palette, inbox integration |

**Infrastructure available:**
- Session v2: lifecycle state machine, intent, energy, execution plan, reflection, closure ritual
- Quick Capture: 10-type modal, CaptureService, capture.note.created events
- EventBus + Event Catalog: full event tracing, per-domain event composition
- FileSystemClient: note creation, frontmatter management
- InboxService: capture.note.created already wired as inbox source

**What's next per feature priority:**
1. PBI-TOT-001 Train Domain and Serial Capture — critical, no dependencies, establishes domain
2. PBI-TOT-002 Train Main View and Timeline Sidebar — high, depends on PBI-TOT-001
3. PBI-TOT-003 Session Nesting and Lifecycle — medium, depends on PBI-TOT-001 + 002

### Post-Cycle Mid-Review State (2026-02-21, Inc 1-4 complete)

**Plugin health:**
- 3,213 tests passing, 129 test suites, 32 skipped
- Build status: green (`npm test` = tsc + eslint + vitest)
- 5 Train events in catalog (started, thought.added, paused, resumed, completed)

**Delivered so far (Inc 1-4):**
- Train domain: types, TrainService (completeTrain, getTimeline, getBranches, getChildren)
- Serial capture: TrainCaptureModal with Enter, direction selector, Pause/Complete/Add Thought
- Thought linking: ThoughtRelation with "next" / "branch" directions, frontmatter `thought-relations`
- Inbox polish: signal sync sources, mark all read, dedup by filePath, smart timestamps
- Quick Capture polish: 7 ribbons, 8 commands, 11 types, description textarea, captureFolder setting
- Review polish: InputModal Enter key, optimistic modal, completeTrain, train ribbon, friendly start modal, session view fix
- Docs: 2 flow docs updated/created, 1 flow test (13 integration tests)

**Remaining:** Inc 6 (Main View), Inc 7 (Timeline Sidebar), Inc 8 (Session Nesting)

### Post Inc 5 State (2026-02-21, Inc 5 complete)

**Plugin health:**
- 3,190 tests passing, 129 test suites, 32 skipped
- Build status: green (`npm test` = tsc + eslint + vitest)
- 5 Train events + 1 settings event in catalog

**Delivered Inc 5 (Timeboxed Train Sessions):**
- `defaultTrainDuration` setting (Zod schema, FlowtiSettingTab dropdown)
- `durationMinutes` field on TrainState, forwarded via `startTrain()` → `session.create`
- Timer display in TrainCaptureModal (countdown via `session.timer.tick`, auto-complete via `session.timer.completed`)
- "Unlimited (no timer)" option in NewSessionModal for train-of-thought type
- `settings.updateDefaultTrainDuration` event + catalog entry
- 9 new tests (4 TrainService + 5 TrainCaptureModal)

---

## Cycle Goals

1. **Establish the Train of Thoughts domain** (PBI-TOT-001) — ThoughtNode types, TrainService, serial capture loop with thought linking
2. **Deliver dedicated Train views** (PBI-TOT-002) — Train Main View for thought navigation and Timeline Sidebar for graph visualization
3. **Enable session nesting** (PBI-TOT-003) — Starting a new train pauses the current one, closure ritual integration

---

## Tech Debt Bundled

None bundled — this is a greenfield feature cycle.

---

## Increment Plan

### Inc 1: Train Domain Types + Serial Capture (PBI-TOT-001, Part 1)

**Goal:** Establish the ThoughtNode domain types, TrainService core, and serial capture loop via TrainCaptureModal.

| Step | File | Purpose | Est. LOC |
|------|------|---------|----------|
| 1 | `src/domain/train/types.ts` | ThoughtNode, ThoughtRelation, TrainState, TrainEventMap | ~50 |
| 2 | `src/domain/train/events.ts` | Train event definitions: started, thought.added, paused, resumed | ~40 |
| 3 | `src/domain/train/TrainService.ts` | Train lifecycle: startTrain, addThought, pause, resume | ~200 |
| 4 | `src/ui/train/TrainCaptureModal.ts` | Serial capture modal with context display | ~100 |
| 5 | `src/infrastructure/commands/registry.ts` | `flowti:start-train` command | ~15 |
| 6 | `src/infrastructure/events/events.ts` | Compose TrainEventMap into FlowtiEventMap | ~5 |

**Est. total:** ~410 LOC source, ~180 LOC tests, ~35 new tests

**Test intent:**
- Unit tests for TrainService: startTrain creates session + first node, addThought links correctly, pause/resume state transitions
- Unit tests for TrainCaptureModal: renders with context, serial loop behavior
- Integration: command → modal → service → events flow

**Documentation intent:** Create "Start a Train of Thoughts" flow doc.

**Architecture seams:**
- New bounded context `src/domain/train/` — isolated from session internals
- TrainService delegates to SessionService for session lifecycle and CaptureService for note creation
- TrainEventMap composed into FlowtiEventMap via `extends`

**Acceptance criteria:**
- [x] "Start Train of Thoughts" command visible in command palette
- [x] First thought creates a session + vault note
- [x] Each Enter creates a linked note and opens next modal
- [x] Previous thought title shown as context in modal
- [x] `train.started` and `train.thought.added` events emitted
- [x] Escape/close pauses the session

---

### Inc 2: Inbox Polish (cross-cutting)

**Goal:** Polish the Inbox feature based on dogfooding feedback and code gap analysis. Fixes missing signal sync source UI, fragile dedup logic, adds "Mark all read" bulk action, and improves timestamp display.

**Rationale:** Inserted mid-cycle to address UX gaps before adding new features. Independent of Train increments.

| Step | File | Purpose | Est. LOC |
|------|------|---------|----------|
| 1 | `src/domain/inbox/types.ts` | Add signal sync entries to INBOX_SOURCE_DEFINITIONS | +2 |
| 2 | `src/domain/settings/settings.ts` | Add signal sync to default inboxEnabledSources | +2 |
| 3 | `src/ui/userHub/types.ts` | Add signal sync labels to SOURCE_EVENT_LABELS + smart formatTime | +10 |
| 4 | `src/domain/inbox/InboxService.ts` | Add markAllRead() + fix dedup to use filePath | +12 |
| 5 | `src/ui/userHub/UserHubInbox.ts` | Wire "Mark all read" button in header | +8 |

**Est. total:** ~30 LOC source, ~80 LOC tests, ~10 new tests

**Test intent:**
- Unit tests: markAllRead marks all unread, no-op when empty, no-op when all read
- Unit tests: dedup uses filePath not description
- Unit tests: signal sync labels resolve, formatTime date context, Mark all read button visibility + click

**Acceptance criteria:**
- [x] Signal sync sources visible in Preferences > Inbox checkboxes
- [x] Signal sync items show "Signal Sync" / "Signal Sync Error" badges
- [x] "Mark all read" button visible when unread items exist
- [x] Clicking "Mark all read" marks all items as read
- [x] Vault folder dedup uses filePath (not description string match)
- [x] Items from previous days show date prefix (e.g. "Feb 20 14:30")

---

### Inc 3: Quick Capture Polish (cross-cutting)

**Goal:** Polish the Quick Capture feature based on dogfooding feedback and code gap analysis. Exposes the hidden `captureFolder` setting, adds description field to modal, guards empty titles, adds post-capture confirmation Notice, dynamic modal heading, and new `learning` capture type.

**Rationale:** Inserted mid-cycle to address UX gaps before adding new features. Independent of Train increments.

| Step | File | Purpose | Est. LOC |
|------|------|---------|----------|
| 1 | `src/domain/capture/types.ts` | Add `learning` to CaptureType union | +1 |
| 2 | `src/domain/capture/CaptureService.ts` | Guard empty title after sanitization | +3 |
| 3 | `src/ui/capture/QuickCaptureModal.ts` | Dynamic heading + description textarea + learning in dropdown | +20 |
| 4 | `src/domain/settings/FlowtiSettingTab.ts` | Expose captureFolder setting in Documentation section | +14 |
| 5 | `src/main.ts` | Add Notice confirmation after capture | +3 |
| 6 | `src/infrastructure/commands/registry.ts` | Add `flowti:add-learning` command | +8 |

**Est. total:** ~55 LOC source, ~100 LOC tests, ~11 new tests

**Test intent:**
- Unit tests: empty title throws error, learning type creates title-cased frontmatter
- Unit tests: dynamic modal heading, description textarea renders, learning in dropdown, onSubmit with description
- Unit tests: captureFolder setting rendered in FlowtiSettingTab

**Acceptance criteria:**
- [x] Settings > Documentation shows "Quick Capture folder" text input
- [x] QuickCaptureModal shows description textarea below title
- [x] Modal heading says "Capture Idea" from ribbon, "Quick Capture" from command palette
- [x] "Add Learning" command visible in command palette
- [x] Learning type in dropdown (11 options in 2 groups)
- [x] Notice shows "Captured: [title]" after capture
- [x] Empty title after sanitization throws error (no `.md` file)

---

### Inc 4: Thought Linking + Branching (PBI-TOT-001, Part 2)

**Goal:** Wire thought-to-thought linking via frontmatter relations, add branch support, and enable navigation within TrainService.

| Step | File | Purpose | Est. LOC |
|------|------|---------|----------|
| 1 | `src/domain/train/TrainService.ts` | addThought with directional linking, getTimeline, getBranches | ~120 |
| 2 | `src/domain/train/TrainService.ts` | Branch support: resume from any node, branch direction | ~80 |
| 3 | `src/ui/train/TrainCaptureModal.ts` | Direction selector (next/branch default), branching UX | ~40 |
| 4 | `src/domain/train/TrainService.ts` | Frontmatter: `thought-relations` field on vault notes | ~40 |

**Est. total:** ~280 LOC source, ~120 LOC tests, ~25 new tests

**Test intent:**
- Unit tests: directional linking, branch creation, timeline traversal, getBranches helper
- Unit tests: frontmatter relation serialization/deserialization

**Acceptance criteria:**
- [x] Thoughts linked with "next" direction by default
- [x] User can select "branch" direction in capture modal
- [x] Frontmatter includes `thought-relations` field
- [x] TrainService.getTimeline returns ordered chain with branches
- [x] `train.thought.added` payload includes `direction` field

**Also delivered (review polish):**
- [x] InputModal accepts Enter to submit (benefits all 15+ usages across the plugin)
- [x] Optimistic modal opening — next TrainCaptureModal opens immediately, addThought runs in background
- [x] `completeTrain()` method + "Complete" button in modal — frees slot for new trains
- [x] `train.completed` event registered in catalog (5 Train events total)
- [x] Train ribbon icon (train-front) for one-click access
- [x] Friendly start modal: "Start a new Train of Thoughts" / "What are you thinking?"
- [x] Session completion view fix — no longer auto-opens sidebar when session view already visible
- [x] Flow doc: "Capture Ideas and Feedback" updated for Inc 3 (7 ribbons, 8 commands, 11 types, description)
- [x] Flow doc: "Start a Train of Thoughts" created covering Inc 1 + Inc 4 scope
- [x] Flow test: `17-TrainOfThoughts.test.ts` — 13 integration tests covering full lifecycle

---

### Inc 5: Timeboxed Train Sessions (PBI-TOT-001, Part 3)

**Goal:** Add optional timer to trains — frictionless by default (no timer), configurable via settings, visible countdown in capture modal.

**Rationale:** User-requested mid-cycle. Leverages existing session timer infrastructure (`session.timer.tick`, `session.timer.completed`).

| Step | File | Purpose | Est. LOC |
|------|------|---------|----------|
| 1 | `src/domain/train/types.ts` | Add `durationMinutes` to TrainState | +1 |
| 2 | `src/domain/settings/settings.ts` | Add `defaultTrainDuration` to Zod schema (default: 0) | +1 |
| 3 | `src/domain/settings/events.ts` | Add `settings.updateDefaultTrainDuration` event | +2 |
| 4 | `src/domain/settings/SettingsService.ts` | Add handler for new event | +4 |
| 5 | `src/infrastructure/events/catalog.ts` | Add catalog entry | +1 |
| 6 | `src/domain/train/TrainService.ts` | Forward `durationMinutes` through `startTrain()` + `createSessionViaEvent()` | +6 |
| 7 | `src/ui/train/TrainCaptureModal.ts` | Timer display + tick/completed subscriptions + cleanup | +35 |
| 8 | `src/domain/settings/FlowtiSettingTab.ts` | "Train of Thoughts" section with duration dropdown | +18 |
| 9 | `src/main.ts` | Read setting, pass duration, build timer subscription closures | +20 |
| 10 | `src/ui/modals.ts` | "Unlimited (no timer)" option in NewSessionModal | +1 |

**Est. total:** ~90 LOC source, ~80 LOC tests, ~9 new tests

**Test intent:**
- Unit tests: TrainService defaults/forwards durationMinutes, persists on TrainState
- Unit tests: TrainCaptureModal timer display, tick updates, completion auto-close, cleanup

**Acceptance criteria:**
- [x] `defaultTrainDuration` setting in preferences (dropdown: Unlimited, 5, 10, 15, 25, 50 min)
- [x] Default is 0 (Unlimited / no timer) — frictionless capture
- [x] `durationMinutes` stored on TrainState and forwarded to session.create
- [x] Timer countdown shown in capture modal when duration > 0
- [x] Timer updates every second via session.timer.tick
- [x] Modal auto-closes and train completes when timer expires
- [x] Timer subscriptions cleaned up on modal close
- [x] NewSessionModal shows "Unlimited" option for train-of-thought type
- [x] 9 new tests passing

---

### Inc 6: Train Main View (PBI-TOT-002, Part 1)

**Goal:** Dedicated main view for navigating thoughts in a train — shows active thought detail, prev/next navigation, branch links, and action buttons. Extends ItemView directly (like SessionWorkspaceView), not BaseHubView (trains are single-focus, not multi-tab hubs).

| Step | File | Purpose | Est. LOC |
|------|------|---------|----------|
| 1 | `src/ui/train/types.ts` | `VIEW_TYPE_TRAIN_MAIN`, `VIEW_TYPE_TRAIN_TIMELINE` constants | ~5 |
| 2 | `src/ui/train/TrainMainView.ts` | ItemView: header, nav bar, thought detail, branches, actions | ~300 |
| 3 | `src/ui/train/TrainMainViewSubscriptions.ts` | Event subscriptions (train.started/paused/resumed/completed/thought.added) | ~60 |
| 4 | `src/domain/train/events.ts` | Add `train.thought.activated` event (view navigation) | ~3 |
| 5 | `src/infrastructure/events/catalog.ts` | Catalog entry for `train.thought.activated` | ~1 |
| 6 | `src/main.ts` | `registerView()` + auto-open on `train.started` | ~20 |
| 7 | Tests | TrainMainView rendering + navigation + event subscriptions | ~120 |

**Est. total:** ~390 LOC source, ~120 LOC tests, ~20 new tests

**Architecture:**
- Follows SessionWorkspaceView pattern: ItemView + extracted subscriptions module
- `getState()`/`setState()` persist `trainId` for workspace re-open
- TrainService provides all data (getTrain, getTimeline, getBranches, getChildren)
- New `train.thought.activated` event for view↔view navigation sync (needed for Inc 7 timeline)

**Layout:**
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

**Test intent:**
- Unit tests: renders active thought with title, metadata, navigation
- Unit tests: Previous/Next buttons navigate correctly, disabled at edges
- Unit tests: branch links rendered, click emits `train.thought.activated`
- Unit tests: "Open in editor" link, "Resume capture" button
- Unit tests: re-renders on train events (thought.added, paused, completed)
- Unit tests: getState/setState persist trainId

**Acceptance criteria:**
- [x] Train Main View registered as Obsidian view (`flowti-train-main`)
- [x] Active thought content displayed with title, order, direction, timestamp
- [x] Previous/Next navigation buttons (disabled at chain boundaries)
- [x] Branch links shown for thoughts with multiple continuations
- [x] Click on branch link activates that thought + emits `train.thought.activated`
- [x] "Open in editor" opens the vault note
- [x] "Resume capture" reopens the serial capture modal
- [x] View auto-opens on `train.started` event
- [x] View re-renders on thought.added, train.paused, train.completed
- [x] `train.thought.activated` event registered in catalog

### Post Inc 6 State (2026-02-21, Inc 6 complete + bug fixes)

**Plugin health:**
- 3,221 tests passing, 130 test suites, 32 skipped
- Build status: green (`npm test` = tsc + eslint + vitest)
- 8 Train events + 1 UI command event in catalog

**Delivered Inc 6 (Train Main View):**
- `TrainMainView` (~237 LOC) extends ItemView — header, nav bar, thought detail, branch links, action buttons
- `TrainMainViewSubscriptions.ts` (~80 LOC) — 6 event subscriptions extracted (same pattern as SessionWorkspaceSubscriptions)
- `train.thought.activated` event added for view↔view navigation sync
- View auto-opens on `train.started`, persists `trainId` via `getState()`/`setState()`
- `VIEW_TYPE_TRAIN_MAIN` + `VIEW_TYPE_TRAIN_TIMELINE` constants in `src/ui/train/types.ts`
- 31 new tests (rendering, navigation, event subscriptions, branch links, action buttons)

**Bug fixes applied post-Inc 6 (5 issues):**
- **Train–session lifecycle sync** (`TrainService.setupListeners()`): `session.completed`, `session.resumed`, `session.paused` now auto-sync linked train status — prevents trains getting stuck when session is managed externally
- **Session Workspace suppression** (`main.ts`): `session.started` handler skips auto-open for `train-of-thought` sessions — trains use TrainMainView, not Session Workspace
- **Workspace state restore skip** (`lifecycleHandlers.ts`): `session.state.restore` skipped for train sessions — prevents stale file opening on resume
- **Timer hidden for untimed sessions** (`SessionWorkspaceView.ts`): timer panel only renders when `durationMinutes > 0`
- **"View Train" command + ribbon** (`main.ts`, `registry.ts`): `flowti:view-train` uses `checkCallback` (hidden when no active train); ribbon icon opens Train Main View when train exists, starts new train otherwise
- **`ui.openTrainView` event** + catalog entry added for manual view opening
- **`train.resumed` listener** in main.ts auto-opens Train Main View + capture modal on resume

**Remaining:** Inc 7 (Timeline Sidebar), Inc 8 (Session Nesting)

---

### Inc 7: Timeline Sidebar (PBI-TOT-002, Part 2)

**Goal:** Right sidebar timeline view showing thought graph with click-to-navigate and branch rendering. Syncs with Train Main View via `train.thought.activated` event (bidirectional).

| Step | File | Purpose | Est. LOC |
|------|------|---------|----------|
| 1 | `src/ui/train/TrainTimelineSidebar.ts` | ItemView: vertical timeline with nodes, branches, active highlight | ~200 |
| 2 | `src/ui/train/TrainTimelineSidebarSubscriptions.ts` | Event subscriptions (same 6 as Main View) | ~80 |
| 3 | `src/main.ts` | `registerView()` + auto-open in right sidebar on `train.started` | ~20 |
| 4 | Tests | TrainTimelineSidebar rendering + navigation + sync | ~100 |

**Est. total:** ~300 LOC source, ~100 LOC tests, ~20 new tests

**Architecture:**
- Follows same pattern as TrainMainView: ItemView + extracted subscriptions module
- `getState()`/`setState()` persist `trainId` + `activeThoughtId` for workspace re-open
- TrainService provides data: `getTrain()`, `getTimeline()`, `getBranches()`
- Bidirectional sync with Main View via `train.thought.activated` event
- Sidebar owns `activeThoughtId`, Main View owns `activeThoughtIndex` — sync via event

**Layout:**
```
┌──────────────────────┐
│ 🚂 My Deep Dive      │  header (train title)
├──────────────────────┤
│ ● Initial idea       │  root node (active = highlight)
│ │                    │
│ ● Schema design      │  next node
│ ├─● NoSQL branch     │  branch fork
│ │                    │
│ ● API endpoints      │  next node
│ │                    │
│ ○ Error handling     │  current (highlighted)
└──────────────────────┘
```

**Test intent:**
- Unit tests: renders correct DOM structure for linear chain (nodes + connectors)
- Unit tests: branch forks rendered as indented sub-trees
- Unit tests: active node gets highlight class
- Unit tests: click on node emits `train.thought.activated`
- Unit tests: re-renders on `train.thought.added`, `train.thought.activated`
- Unit tests: `getState`/`setState` persist trainId + activeThoughtId

**Acceptance criteria:**
- [x] Timeline Sidebar registered as Obsidian view (`flowti-train-timeline`)
- [x] Graph shows all thoughts as vertical nodes with connecting lines
- [x] Branches visualized as indented sub-trees
- [x] Active node highlighted with accent style
- [x] Click on node navigates to that thought in Main View
- [x] Timestamps shown on each node
- [x] Auto-opens in right sidebar on `train.started`
- [x] Syncs with Main View via `train.thought.activated` (bidirectional)

### Post Inc 7 State (2026-02-21, Inc 7 complete)

**Plugin health:**
- 3,251 tests passing, 131 test suites, 32 skipped
- Build status: green (`npm test` = tsc + eslint + vitest)
- 8 Train events + 1 UI command event in catalog

**Delivered Inc 7 (Timeline Sidebar):**
- `TrainTimelineSidebar` (~210 LOC) extends ItemView — header, vertical timeline with node graph, branch indentation, active highlighting
- `TrainTimelineSidebarSubscriptions.ts` (~80 LOC) — 6 event subscriptions extracted (same pattern as Main View)
- Timeline auto-opens in right sidebar on `train.started`
- Click-to-navigate emits `train.thought.activated` for bidirectional sync with Main View
- `getState()`/`setState()` persists `trainId` + `activeThoughtId` for workspace re-open
- Branch nodes rendered with indentation (16px) + `↗` indicator
- Active node: filled bullet `●` + `.flowti-timeline-node-active` highlight class
- 30 new tests (rendering, navigation, active highlighting, event subscriptions, click navigation, branch rendering)
- `revealOrCreateTrainTimeline()` helper in main.ts — opens in right sidebar via `getRightLeaf(false)`

**Remaining:** Inc 8 (Session Nesting)

---

### Inc 8: Session Nesting + Closure (PBI-TOT-003)

**Goal:** Enable session nesting for trains and integrate with the closure ritual system.

| Step | File | Purpose | Est. LOC |
|------|------|---------|----------|
| 1 | `src/domain/train/TrainService.ts` | Nesting: pause active, link sessions | ~80 |
| 2 | `src/domain/train/types.ts` | DEFAULT_TRAIN_CLOSURE_TEMPLATE, session type config | ~30 |
| 3 | `src/domain/session/types.ts` | `train-of-thought` in SessionTypeConfig map | ~10 |
| 4 | `src/ui/train/TrainMainView.ts` | "Resume" button, spawned-from link display | ~40 |
| 5 | Integration | Wire nesting events, closure template resolution | ~30 |

**Est. total:** ~190 LOC source, ~80 LOC tests, ~15 new tests

**Test intent:**
- Unit tests: starting new train pauses active, links sessions
- Unit tests: resume pauses the other train
- Unit tests: closure template resolved for train-of-thought type
- Flow test: full nesting lifecycle

**Acceptance criteria:**
- [x] Starting a new train pauses the currently running train
- [x] New train links to the paused train (`parentTrainId`)
- [x] Resuming a train pauses the current one
- [x] Closure ritual triggers on train completion (`session.closure.started` → Session Workspace)
- [x] Train-specific closure questions shown (4 questions: key-insight, patterns, follow-up, outcome)
- [x] Train sessions appear in session history (via `session.create` with `train-of-thought` type)

### Post Inc 8 State (2026-02-21, Inc 8 complete)

**Plugin health:**
- 3,263 tests passing, 131 test suites, 32 skipped
- Build status: green (`npm test` = tsc + eslint + vitest)
- 8 Train events + 1 UI command event in catalog

**Delivered Inc 8 (Session Nesting + Closure):**
- `parentTrainId` field on TrainState — links nested trains to their parent
- `startTrain()` auto-pauses active running train before creating new one (nesting)
- `resume()` auto-pauses other running train before resuming target train
- `closureTemplate` added to `SESSION_TYPE_CONFIGS["train-of-thought"]` — 4 questions (key-insight, patterns, follow-up, outcome), 2 required fields
- `SessionWorkspaceView.getTypeClosureTemplates()` updated to include built-in `SESSION_TYPE_CONFIGS` closure templates (was only reading custom types)
- `session.closure.started` listener auto-opens Session Workspace for train-of-thought sessions (train sessions suppress workspace on start but need it for closure)
- `ui.startTrain` handler updated: paused → resume; running or none → prompt for new title (nesting via `startTrain()`)
- 12 new tests: 6 nesting tests in TrainService.test.ts + 6 closure template tests in closureRitual.test.ts

**Cycle complete — all 8 increments delivered.**

---

## Dependency Graph

```
Inc 1: Train Domain + Serial Capture
  │
  │   Inc 2: Inbox Polish (independent)
  │   Inc 3: Quick Capture Polish (independent)
  │
  ▼
Inc 4: Thought Linking + Branching
  │
  │   Inc 5: Timeboxed Train Sessions (independent — enhances capture modal)
  │
  ├──────────────────┐
  ▼                  ▼
Inc 6: Main View   Inc 7: Timeline Sidebar
  │                  │
  └────────┬─────────┘
           ▼
    Inc 8: Session Nesting + Closure
```

Inc 2, 3, and 5 are independent cross-cutting increments.
Inc 6 and Inc 7 can be developed in parallel after Inc 4 is complete.

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Timeline graph rendering complexity | High | Start with simple HTML/CSS tree (nested divs + CSS grid); defer canvas/SVG to future cycle |
| Serial capture modal UX (rapid succession) | Medium | Prototype with existing QuickCaptureModal; test with 10+ thoughts for responsiveness |
| Frontmatter relation format conflicts with other plugins | Low | Use dedicated `thought-relations` key; validate on load; document schema |
| Large thought chains (100+ nodes) performance | Medium | Virtualize timeline sidebar; lazy-load thought content; defer to v2 if needed |
| Session nesting edge cases (3+ concurrent trains) | Medium | Hard limit at 1 level of nesting for v1; log warning for attempted deeper nesting |

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| New tests | 110+ | `npm test` count delta |
| Source LOC | ~1,735 | Sum of increment estimates |
| Test LOC | ~560 | Sum of test estimates |
| Build status | green | `npm test` passes |
| FRI score | 20 → 25+ | Post-cycle FRI re-score |
| Train sessions created in first week | 5+ | Manual verification |

---

## Deferred Items

| Item | Rationale | Target |
|------|-----------|--------|
| Canvas rendering of thought graphs | Complex; HTML/CSS tree sufficient for v1 | Cycle 15+ |
| Custom direction types beyond next/branch | Scope creep; two directions cover 95% of use cases | Cycle 15+ |
| AI-assisted thought suggestions | Requires external API; out of scope for initial delivery | Future |
| Multi-level session nesting (train-in-train-in-train) | Edge case; 1 level covers the primary use case | Cycle 15+ |
| Thought merge/split operations | Complex UX; defer until user feedback validates need | Future |
| Export to external mind-mapping tools | Integration work; not core functionality | Future |

---

## Readiness Assessment

### 1. Feature PRD Readiness

- [x] [[Train of Thoughts PRD]] exists at `docs/features/Train of Thoughts/`
- [x] Stage: approved
- [x] FRI scored: 20/35 (Technically Ready threshold: 19)
- [ ] Technical Review: pending (to be conducted pre-cycle)

### 2. Backlog Readiness

- [x] 3 PBIs defined: PBI-TOT-001, PBI-TOT-002, PBI-TOT-003
- [x] Chunked into 5 increments with dependencies mapped
- [x] Priority ranked: 001 (Must) → 002 (Must) → 003 (Should)

### 3. Cycle Plan Document

- [x] All required sections present (situation, goals, increments, dependency graph, risks, metrics, deferred)

### 4. Increment Readiness

- [x] Each increment has: scope, step table, LOC estimates, test intent, acceptance criteria

### 5. Quality Baseline

- [ ] Build pipeline green (verify pre-cycle)
- [ ] No critical bugs blocking this cycle
- [ ] Previous cycle (Cycle 13) closed

### 6. Pre-Cycle Completion

- [x] Inbox source idea enriched and linked
- [x] PRD created with JTBD, User Stories, FRI scoring
- [x] PBIs created with Gherkin use cases and functional requirements

---

## Related

- PRD: [[Train of Thoughts PRD]]
- Parent: [[Session Workspaces PRD]]
- Sibling: [[Quick Capture PRD]]
- Inbox: [[I want to have the option to create a serial note session on every enter a new quick capture modal opens with the last note title in the description]]
- Prior Cycles: [[Cycle 12 - User Hub Inbox]]
