---
type: DevelopmentCycle
feature: "[[Train of Thoughts PRD]]"
stage: planned
cycle: 14
date_planned: 2026-02-21
date_completed:
pbis:
  - "[[PBI-TOT-002 Train Main View and Timeline Sidebar]]"
bugs:
  - "TrainMainView does not update during capture (trainId not tracked on train.started)"
  - "Sidebar button opens main tab instead of right sidebar for train sessions"
  - "Train sessions from User Hub NewSessionModal have no TrainState"
bugs_fixed_precycle: []
tech_debt: []
estimated_increments: 8
actual_increments:
estimated_tests: 100
actual_tests:
total_tests_after:
total_test_files_after:
---

# Cycle 14: Train View Polish & Session Integration

## Cycle Overview

**User Story:**

> As a knowledge worker using Train of Thoughts, I want the train detail view and timeline sidebar to show useful information, update live during capture, and integrate properly with the User Hub sessions panel — so that the Train experience is cohesive, informative, and navigable.

**User Pains:**
- TrainMainView is sparse — no stats, controls, breadcrumb, timer, or content preview
- Timeline sidebar breaks when thoughts branch (flat inline insertion instead of tree)
- Background views don't update while riding the train (subscription bug: trainId not tracked)
- Sidebar button opens wrong view type (main tab instead of right sidebar)
- Train sessions created from User Hub NewSessionModal have no corresponding TrainState
- Session panel treats train sessions identically to regular sessions — no train icon, no thought count
- No train configuration beyond default duration

**User Needs:**
- Live-updating views during thought capture
- Proper tree structure for branched timelines with connectors
- Train-specific controls (pause/resume/complete) in the main view
- Stats panel (thought count, branches, elapsed time)
- Breadcrumb navigation through thought chain
- Content preview of active thought
- Train-aware User Hub integration (icons, thought counts, "Open Train" button)
- Configurable train settings (folder, auto-open timeline, max thoughts)

---

## Situation Assessment

### Pre-Cycle State

**Plugin health:**
- 3,263 tests passing, 131 test suites, 32 skipped
- Build status: green (`npm test` = tsc + eslint + vitest)
- 8 Train events + 1 UI command event in catalog

**Feature status across contributing PRDs:**

| PRD | Stage | FRI | Delivered So Far |
|-----|-------|-----|------------------|
| [[Train of Thoughts PRD]] | in-progress | 31/35 | 3/3 PBIs delivered (Cycle 13), 8 increments, 73 tests |
| [[Session Workspaces PRD]] | in-progress | 31/35 | v1 complete (8/8 FRs), v2 partial (FR-11 through FR-15 delivered) |
| [[Hubs PRD]] | in-progress | 33/35 | User Hub, Event Catalog, Data Exchange Hub |

**Infrastructure available:**
- TrainService: startTrain, addThought, pause, resume, completeTrain, getTimeline, getBranches, getChildren
- TrainMainView: 237 LOC, ItemView with header + nav bar + thought detail + branch links + actions
- TrainTimelineSidebar: 210 LOC, ItemView with vertical timeline + branch indentation + active highlight
- TrainMainViewSubscriptions: 80 LOC, 6 event listeners (same pattern as SessionWorkspaceSubscriptions)
- TrainTimelineSidebarSubscriptions: 80 LOC, 6 event listeners
- SessionDetailPanel: 350+ LOC, status-based action buttons (not train-aware)
- UserHubView: trainService NOT yet wired as constructor param

**Known bugs (3, to be fixed in Inc 1):**
1. **TrainViewContext missing setTrainId** — `train.started` handler in `TrainMainViewSubscriptions.ts` calls `scheduleRender()` but never sets `this.trainId` on the context. `getTrain()` falls back to `getActiveTrain()` for the initial render, but subsequent events like `train.thought.added` check `event.payload.trainId === ctx.getTrainId()` which returns null — so the view stops updating after the first render.
2. **openWorkspaceForSession() ignores location for train sessions** — The `train-of-thought` type check at line 380 always opens `VIEW_TYPE_TRAIN_MAIN` as a tab, ignoring the `location` parameter. The `location === "sidebar"` branch at line 394 is unreachable for train sessions due to the early return.
3. **train-of-thought in NewSessionModal type dropdown** — Users can create train-of-thought sessions via the NewSessionModal, but these sessions have no corresponding TrainState in TrainService. Opening TrainMainView shows "No active train." Trains should only be created via ribbon/command which creates both session + TrainState together.

**What's next per feature priority:**
1. Fix critical bugs (Inc 1) — prerequisite for all other work
2. Fix timeline branching (Inc 2) — most visible UX issue
3. Enrich views (Inc 3-5) — transform from "blank and useless" to informative
4. Train settings (Inc 6) — user configuration
5. User Hub integration (Inc 7) — cohesive session management
6. Integration tests (Inc 8) — verification

---

## Cycle Goals

1. **Fix critical train bugs** (Inc 1) — live view updates, sidebar routing, NewSessionModal filtering
2. **Fix timeline branching** (Inc 2) — proper tree rendering with CSS connectors
3. **Enrich train views** (Inc 3-5) — stats panel, controls panel, breadcrumb, content preview, timer, collapse/expand
4. **Add train configuration** (Inc 6) — folder, auto-open timeline, max thoughts settings
5. **User Hub train integration** (Inc 7) — train-aware detail panel, master list icons, dashboard card
6. **Integration verification** (Inc 8) — flow tests covering all new functionality

---

## Tech Debt Bundled

None bundled — this is a feature polish and integration cycle.

---

## Increment Plan

### Inc 1: Critical Bug Fixes

**Goal:** Fix 4 bugs that break the current train experience before any polish work.

**Bug A — Views don't update during capture** (`TrainMainViewSubscriptions.ts:23-29`): The `train.started` handler re-renders but never sets `this.trainId`. So `getTrainId()` returns null, and all subsequent event checks (`event.payload.trainId === ctx.getTrainId()`) fail silently. The view appears frozen.

**Bug B — Sidebar opens as main tab** (`UserHubView.ts:377-411`): `openWorkspaceForSession()` handles `train-of-thought` first and always opens `VIEW_TYPE_TRAIN_MAIN` as a tab, ignoring the `location` parameter.

**Bug C — Train sessions from User Hub have no TrainState**: `train-of-thought` visible in `SESSION_TYPES` at `types.ts:35`. Sessions created via NewSessionModal have no corresponding TrainState. Fix: filter out of NewSessionModal types.

**Bug D — TrainTimelineSidebar thought.activated depends on getTrainId()**: Same root cause as Bug A for the sidebar subscription context.

| Step | File | Purpose | Est. LOC |
|------|------|---------|----------|
| 1 | `src/ui/train/TrainMainView.ts` | Add `setTrainId` to `TrainViewContext` interface and `buildContext()` | +5 |
| 2 | `src/ui/train/TrainMainViewSubscriptions.ts` | In `train.started` handler: call `ctx.setTrainId(event.payload.train.id)` | +1 |
| 3 | `src/ui/UserHubView.ts` | Rewrite `openWorkspaceForSession()` train branch: sidebar → `VIEW_TYPE_TRAIN_TIMELINE` in right sidebar; tab → `VIEW_TYPE_TRAIN_MAIN`; no TrainState → fall back to Session Workspace | +20 |
| 4 | `src/ui/UserHubView.ts` | Add `VIEW_TYPE_TRAIN_TIMELINE` import, add `trainService` constructor param | +5 |
| 5 | `src/ui/UserHubView.ts` | Filter `train-of-thought` out of `sessionTypes` passed to NewSessionModal | +3 |
| 6 | `src/main.ts` | Pass `this.trainService` to `UserHubView` constructor | +1 |

**Est. total:** ~40 LOC source, ~60 LOC tests, ~12 new tests

**Test intent:**
- Unit tests: trainId is set on train.started, subsequent thought.added triggers re-render
- Unit tests: sidebar opens timeline, tab opens main view, fallback to Session Workspace when no TrainState
- Unit tests: NewSessionModal types exclude train-of-thought

**Documentation intent:** Update "Start a Train of Thoughts" flow doc with corrected view behavior.

**Architecture seams:**
- `TrainViewContext` interface extended with `setTrainId`
- `UserHubView` gains optional `trainService` constructor param
- NewSessionModal `sessionTypes` filtered at call site (not modifying `SESSION_TYPES` global)

**Acceptance criteria:**
- [ ] TrainMainView updates live when thoughts are added during capture
- [ ] TrainTimelineSidebar updates live when thoughts are added
- [ ] "Sidebar" button on train sessions opens `VIEW_TYPE_TRAIN_TIMELINE` in right sidebar
- [ ] "Workspace" button on train sessions opens `VIEW_TYPE_TRAIN_MAIN` in tab
- [ ] Train sessions without a TrainState fall back to regular Session Workspace
- [ ] `train-of-thought` removed from NewSessionModal type dropdown

---

### Inc 2: Fix Timeline Branching & Tree Connectors

**Goal:** Fix the critical branching bug and add proper tree visualization.

**The bug** (`TrainTimelineSidebar.ts:153-162`): The render loop iterates the main timeline and inserts branches as flat nodes inline, breaking the visual flow. Branches interrupt the main chain instead of appearing as indented sub-trees.

| Step | File | Purpose | Est. LOC |
|------|------|---------|----------|
| 1 | `src/ui/train/TrainTimelineSidebar.ts` | Rewrite `renderTimeline()` with recursive `renderSubtree()` — main chain as depth-0 spine, branches at depth+1 | +40 |
| 2 | `src/ui/train/TrainTimelineSidebar.ts` | Add tree connectors (`│`, `├─`, `└─`) via CSS pseudo-elements on `.flowti-timeline-connector` class | +15 |
| 3 | `src/ui/train/TrainTimelineSidebar.ts` | Add `(+N)` branch count badge on main-chain nodes with branches | +10 |
| 4 | `src/ui/train/TrainTimelineSidebar.ts` | Auto-scroll active node into view after render (`scrollIntoView({ block: "nearest" })`) | +5 |

**Est. total:** ~80 LOC source, ~70 LOC tests, ~15 new tests

**Test intent:**
- Unit tests: main chain renders in uninterrupted vertical order
- Unit tests: branches render indented under parent
- Unit tests: nested branches at depth 2
- Unit tests: branch count badge shows correct number
- Unit tests: active node auto-scrolls

**Acceptance criteria:**
- [ ] Main chain nodes render in uninterrupted vertical order
- [ ] Branches render indented under parent (not interrupting main chain)
- [ ] Nested branches (branch of branch) render at depth 2
- [ ] Nodes with branches show `(+N)` count badge
- [ ] Active node auto-scrolls into view

---

### Inc 3: Extract Train Panels & TrainPanelDeps

**Goal:** Establish the panel extraction pattern before enriching the main view. Creates TrainStatsPanel and TrainControlsPanel.

| Step | File | Purpose | Est. LOC |
|------|------|---------|----------|
| 1 | `src/ui/train/types.ts` | Add `TrainPanelDeps` interface | +15 |
| 2 | `src/ui/train/TrainStatsPanel.ts` (new) | Stat grid: Total Thoughts, Branches, Main Chain Length, Elapsed, Status | ~60 |
| 3 | `src/ui/train/TrainControlsPanel.ts` (new) | Status-aware buttons: Pause, Complete, Resume Capture, Resume | ~50 |
| 4 | `src/ui/train/TrainMainView.ts` | Wire both panels into render flow | +20 |

**Est. total:** ~160 LOC source, ~100 LOC tests, ~18 new tests

**Key detail:** Controls panel calls `trainService.pause()`, `trainService.resume()`, `trainService.completeTrain()` — these handle both train AND session state transitions internally. "Resume Capture" opens the capture modal via callback.

**Test intent:**
- Unit tests: stats panel shows correct values for each stat
- Unit tests: controls visibility per train status (running, paused, completed)
- Unit tests: button clicks emit correct events / call correct service methods

**Acceptance criteria:**
- [ ] Stats panel shows thought count, branch count, chain length, elapsed time
- [ ] Controls show Pause/Complete/Resume Capture for running trains
- [ ] Controls show Resume/Complete for paused trains
- [ ] Completed trains show no controls
- [ ] Clicking Pause/Resume/Complete triggers correct state transitions

---

### Inc 4: Enrich TrainMainView (Breadcrumb, Preview, Timer, Parent Link)

**Goal:** Add the information panels that make the main view actually useful.

| Step | File | Purpose | Est. LOC |
|------|------|---------|----------|
| 1 | `src/ui/train/TrainBreadcrumbPanel.ts` (new) | Trace from active thought back to root: `Root > A > B > [Active]` | ~45 |
| 2 | `src/ui/train/TrainMainView.ts` | Thought content preview: first ~200 chars via `app.vault.cachedRead()` | +25 |
| 3 | `src/ui/train/TrainMainView.ts` | Parent train link when `parentTrainId` exists | +15 |
| 4 | `src/ui/train/TrainMainView.ts` | Session timer display (monospace, when `durationMinutes > 0`) | +15 |
| 5 | `src/ui/train/TrainMainViewSubscriptions.ts` | `session.timer.tick` listener filtered by sessionId | +10 |

**Est. total:** ~140 LOC source, ~80 LOC tests, ~16 new tests

**Test intent:**
- Unit tests: breadcrumb path correctness, click navigation
- Unit tests: content preview truncation
- Unit tests: parent link visibility toggle
- Unit tests: timer display and tick updates

**Acceptance criteria:**
- [ ] Breadcrumb shows full path from root to active thought with clickable segments
- [ ] Content preview shows first ~200 chars of thought note (truncated with "...")
- [ ] Parent train link visible when `parentTrainId` exists, hidden otherwise
- [ ] Timer display visible when `durationMinutes > 0`, updates on tick without full re-render

---

### Inc 5: Timeline Sidebar Collapse/Expand & Polish

**Goal:** Add interactivity to the fixed tree structure.

| Step | File | Purpose | Est. LOC |
|------|------|---------|----------|
| 1 | `src/ui/train/TrainTimelineSidebar.ts` | `collapsedNodes = new Set<string>()` state tracking | +5 |
| 2 | `src/ui/train/TrainTimelineSidebar.ts` | Clickable chevron on branch-parent nodes (▸/▾), toggle + re-render | +25 |
| 3 | `src/ui/train/TrainTimelineSidebar.ts` | Skip collapsed sub-trees in `renderSubtree()` | +10 |
| 4 | `src/ui/train/TrainTimelineSidebar.ts` | Compact stat line in header: "X thoughts · Y branches · Z min" | +15 |

**Est. total:** ~70 LOC source, ~60 LOC tests, ~11 new tests

**Test intent:**
- Unit tests: branches expanded by default
- Unit tests: collapse hides sub-tree, expand restores
- Unit tests: stats line shows correct values

**Acceptance criteria:**
- [ ] Branches expanded by default
- [ ] Clicking chevron collapses branch sub-tree (removed from DOM)
- [ ] Re-clicking restores branches
- [ ] Header shows compact stats line

---

### Inc 6: Train Settings & Configuration

**Goal:** Add configurable train settings to FlowtiSettingTab and User Hub Preferences.

| Step | File | Purpose | Est. LOC |
|------|------|---------|----------|
| 1 | `src/domain/settings/settings.ts` | Add `trainFolder`, `trainAutoOpenTimeline`, `trainMaxThoughts` to Zod schema | +3 |
| 2 | `src/domain/settings/events.ts` | Add 3 settings events | +3 |
| 3 | `src/domain/settings/SettingsService.ts` | Wire event handlers | +9 |
| 4 | `src/domain/settings/FlowtiSettingTab.ts` | Expand `displayTrainSection()`: folder, auto-open toggle, max thoughts | +30 |
| 5 | `src/domain/train/TrainService.ts` | Read `trainMaxThoughts` + `trainFolder` from settings | +10 |
| 6 | `src/main.ts` | Respect `trainAutoOpenTimeline` in `train.started` handler | +5 |
| 7 | `src/ui/userHub/UserHubPreferences.ts` | Add "Trains" category with same settings | +30 |
| 8 | `src/ui/userHub/types.ts` | Add `"trains"` to preferences categories | +1 |

**Est. total:** ~110 LOC source, ~60 LOC tests, ~11 new tests

**Test intent:**
- Unit tests: custom folder used for thought creation
- Unit tests: max thoughts limit enforced
- Unit tests: auto-open toggle respected
- Unit tests: settings events wired correctly

**Acceptance criteria:**
- [ ] Train folder setting controls where thought notes are created (empty = captureFolder default)
- [ ] Auto-open timeline toggle controls whether sidebar opens on train start
- [ ] Max thoughts setting respected by TrainService
- [ ] Settings accessible from both Obsidian Settings tab and User Hub Preferences
- [ ] Default values maintain backward compatibility

---

### Inc 7: User Hub Train-Aware Session Panels

**Goal:** Make SessionDetailPanel train-aware with thought list, train actions, and type label fix. Add visual distinction in master list and dashboard.

| Step | File | Purpose | Est. LOC |
|------|------|---------|----------|
| 1 | `src/ui/userHub/types.ts` | Add `"train-of-thought": "Train of Thought"` to `SESSION_TYPE_LABELS` | +1 |
| 2 | `src/ui/userHub/types.ts` | Add optional `trainService?: TrainService` to `UserHubComponentDeps` | +2 |
| 3 | `src/ui/userHub/SessionDetailPanel.ts` | Train section: thought count, branch count, clickable thought list | +35 |
| 4 | `src/ui/userHub/SessionDetailPanel.ts` | Replace "Workspace" with "Open Train", "Sidebar" with "Timeline" for train sessions | +15 |
| 5 | `src/ui/userHub/UserHubSessions.ts` | `train-front` icon + "N thoughts" badge in master list | +15 |
| 6 | `src/ui/userHub/UserHubDashboard.ts` | Active train card + "Train of Thoughts" quick action | +25 |
| 7 | `src/ui/UserHubView.ts` | Wire `trainService` into component deps via `buildComponentDeps()` | +5 |

**Est. total:** ~130 LOC source, ~90 LOC tests, ~20 new tests

**Test intent:**
- Unit tests: type label renders "Train of Thought"
- Unit tests: train section visible for train sessions, hidden for others
- Unit tests: "Open Train" and "Timeline" buttons for train sessions
- Unit tests: train-front icon in master list
- Unit tests: thought count badge in master list
- Unit tests: dashboard active train card

**Acceptance criteria:**
- [ ] `SESSION_TYPE_LABELS` includes "Train of Thought"
- [ ] Detail panel shows thought count, branch count, clickable thought list for train sessions
- [ ] "Open Train" replaces "Workspace", "Timeline" replaces "Sidebar" for train sessions
- [ ] Train sessions show `train-front` icon + thought count badge in master list
- [ ] Active train on dashboard shows thought count
- [ ] "Train of Thoughts" appears in dashboard quick actions
- [ ] Non-train sessions completely unaffected

---

### Inc 8: Integration Tests & Flow Test Update

**Goal:** End-to-end verification with updated flow tests.

| Step | File | Purpose | Est. LOC |
|------|------|---------|----------|
| 1 | `tests/flows/17-TrainOfThoughts.test.ts` | Add tree structure assertion after branching | +15 |
| 2 | `tests/flows/17-TrainOfThoughts.test.ts` | Add stats panel data accuracy assertions | +10 |
| 3 | `tests/flows/17-TrainOfThoughts.test.ts` | Add User Hub integration tests (type label, train section, sidebar redirect) | +20 |
| 4 | `tests/flows/17-TrainOfThoughts.test.ts` | Add live update test (thought added → view re-renders) | +15 |

**Est. total:** ~70 LOC tests, ~12 new tests

**Acceptance criteria:**
- [ ] Flow 17 covers branching + tree verification + stat accuracy
- [ ] Flow 17 covers live view updates during capture
- [ ] Flow 17 covers User Hub integration (type label, train section, sidebar redirect)
- [ ] `npm test` passes (target: ~3,363 tests)
- [ ] `npm run check` clean

---

## Dependency Graph

```
Inc 1 (Bug Fixes) ──────────────────────────────────┐
    │                                                │
    ├──→ Inc 2 (Fix Branching) → Inc 5 (Collapse)   │
    │                                                │
    ├──→ Inc 3 (Extract Panels) → Inc 4 (Enrich)    │
    │                          └──→ Inc 7 (Hub)      │
    │                                                │
    ├──→ Inc 6 (Settings)                            │
    │                                                │
    └────────────────────────────────────────────────▼
                                               Inc 8 (Integration Tests)
```

Inc 1 must be first (all other work depends on working views).
Inc 2 + Inc 3 + Inc 6 are independent (parallel-safe after Inc 1).
Inc 4 + Inc 5 are independent of each other.
Inc 7 depends on Inc 1 (trainService wiring done in Inc 1).
Inc 8 depends on all.

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Recursive tree rendering performance with large trains (100+ thoughts) | Medium | Limit render depth to 5 levels; virtualize if >100 nodes |
| TrainService.pause()/resume() dual state transitions break if called from controls panel | Medium | Unit test all state transitions explicitly |
| Settings migration for existing users (new Zod fields) | Low | Zod defaults handle missing fields automatically |
| UserHubView constructor change (new trainService param) | Low | Optional param, backward compatible |

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| New tests | ~100 | `npm test` count delta |
| Source LOC | ~800 | Sum of increment estimates |
| Build status | green | `npm test` passes |
| FRI score | 31 → 33+ | Post-cycle FRI re-score |
| Bugs fixed | 3 critical | Manual verification |

---

## Deferred Items

| Item | Rationale | Target |
|------|-----------|--------|
| Canvas rendering of thought graphs | Separate feature (Canvas Integration) | Cycle 15 |
| Train export to external mind-mapping tools | Integration work | Future |
| AI-assisted thought suggestions | Requires external API | Future |
| Train statistics dashboard page | Could be a separate view | Future |
| Custom direction types beyond next/branch | Scope creep; two directions cover 95% of use cases | Future |

---

## Readiness Assessment

### 1. Feature PRD Readiness

- [x] [[Train of Thoughts PRD]] exists at `docs/features/Train of Thoughts/`
- [x] Stage: in-progress (continuation cycle)
- [x] FRI scored: 31/35 (all 7 dimensions)
- [x] FRI meets threshold: 31 ≥ 11 (Stable for continuation)
- [x] Technical Review passed: Cycle 13 Three Amigos review PASS, all PBIs delivered

### 2. Backlog Readiness

- [x] PBI-TOT-002 (continuation) scoped with problem statement and acceptance criteria
- [x] Chunked into 8 increments with vertical value slices
- [x] Dependencies mapped: full dependency graph
- [x] Priority ranked: bug fixes first → views → settings → integration tests

### 3. Cycle Plan Document

- [x] Cycle document exists with required frontmatter
- [x] Situation assessment written (pre-cycle state, plugin health, known bugs)
- [x] Cycle goals defined (6 numbered)
- [x] Proposed increments specified (8 increments with scope, LOC, tests)
- [x] Dependency graph drawn
- [x] Risks identified with mitigations
- [x] Success metrics defined
- [x] Deferred items documented

### 4. Increment Readiness

- [x] Each increment has scope statement, acceptance criteria, test intent, architecture seams, estimated size

### 5. Quality Baseline

- [x] Build pipeline green: `npm test` passes (3,263 tests)
- [x] No critical bugs blocking: 3 train bugs scoped as Inc 1 (part of cycle)
- [x] Previous cycle closed: Cycle 13 marked `stage: done`

### 6. Pre-Cycle Completion

- [x] Pre-cycle work documented (ribbon fix, workspace redirect from previous session)
- [x] Inbox signals reviewed (backlog refinement 2026-02-20 completed)

**DoR Result: PASS** — All criteria satisfied. Cycle 14 is ready to start.

---

## Related

- PRD: [[Train of Thoughts PRD]]
- Parent: [[Session Workspaces PRD]]
- Sibling: [[Quick Capture PRD]]
- Prior Cycle: [[Cycle 13 - Train of Thoughts]]
- Next Cycle: [[Cycle 15 - Canvas Integration]]
