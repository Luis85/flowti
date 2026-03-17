---
type: DevelopmentCycle
feature: "[[Train Improvements PRD]]"
stage: delivered
cycle: 20
date_planned: 2026-02-22
date_completed: 2026-02-22
pbis:
  - "[[PBI-TOT-007 Train Enhancements]]"
bugs: []
bugs_fixed_precycle: []
tech_debt: []
estimated_increments: 6
actual_increments: 6
estimated_tests: 63
actual_tests: 65
total_tests_after: 3896
total_test_files_after: 158
tags:
---

# Cycle 20: Train Enhancements

## Cycle Overview

**User Story:**

> As a Train of Thoughts user, I want to navigate from the sidebar to the full train detail, browse my completed trains, navigate thoughts with the keyboard, and receive a synthesized summary document when I finish — so that the train experience feels complete and productive rather than ending abruptly.

**User Pains:**
- Sidebar shows the timeline but has no way to open the full Train Main View — users must find it via the tab bar
- Timeline reads top-to-bottom (root at top) but the mental model is "stacking" — newest thought should be at top
- Text-based bullets (○/●) and tree connectors (├─/└─) don't provide enough visual differentiation for branches
- No keyboard navigation in the main view — traversing thoughts requires clicking each nav button
- Completing a train produces no deliverable output — the train just stops with no summary or synthesis
- No way to browse past trains — completed trains vanish from the active view with no history access
- Generic session completion view misses train-specific insights (thought count, branches, merge graph)

**User Needs:**
- Sidebar header: "Open Train" button that reveals or opens the TrainMainView
- VS Code-style git graph visualization: colored lane rails, circular node dots, fork connectors
- Timeline rendered bottom-to-top: newest thought at top, root at bottom (stacking metaphor)
- Arrow keys (Up/Down) to navigate through thoughts in the main view
- Auto-generated summary markdown document on train completion
- Train history panel: browse all trains (active, paused, completed) with compact cards
- Train-specific stats in the summary: thought count, branch count, merges, duration, timeline

---

## Situation Assessment

### Pre-Cycle State (post-Cycle 19)

**Plugin health:**
- 3,831 tests passing, 155 test suites
- Build status: green
- Cycle 19 delivered: merge rules, command palette, keyboard capture modal, canvas reconciliation

**Train domain status (Cycle 19 delivered):**
- Domain: 1,421 LOC (TrainService 638, TrainCanvasWriter 543, TrainCanvasSyncService 124)
- UI: 1,666 LOC (TrainMainView 510, TrainTimelineSidebar 384, TrainCaptureModal 245)
- Tests: 8,218 LOC across 16 test files
- Merge: DAG validation + main chain protection + UI enforcement
- Canvas: enriched visualization with groups, annotations, 7 roles, reconciliation
- Commands: 4 palette commands (Resume, Complete, Open Canvas, Open Timeline)
- Keyboard: Esc to close, Tab to toggle direction in capture modal

**Inbox signals addressed this cycle:**
- "The session complete view needs to be adjusted when coming from a train" → Inc 3 (train summary)
- "How can we enhance trains with synthesis" → Inc 3 (summary document generation)
- "I want to move with the keyboard through my train" → Inc 2 (main view keyboard nav)
- "I want to reach the Train Detail page from the sidebar" → Inc 1 (sidebar navigation)

---

## Cycle Goals

1. **Sidebar → Main View navigation** — "Open Train" button in sidebar header to reveal TrainMainView ✅
2. **Git graph timeline + bottom-to-top** — VS Code-style git graph visualization with colored lanes, reverse rendering (newest at top) ✅
3. **Main view keyboard navigation** — Arrow keys for thought traversal, Enter to open note ✅
4. **Train summary document** — auto-generate structured markdown on completion ✅
5. **Train history panel** — browse all trains with status filter and navigation ✅
6. **Integration tests** — verify all new behaviors in Flow 20 ✅

---

## Scope

### In Scope
- Sidebar header: "Open Train" icon button that emits `ui.openTrainView` + sets state to current trainId
- Bottom-to-top timeline: reverse render order in sidebar and main view thought counter
- TrainMainView: keydown listener for Arrow Up/Down (prev/next), Enter (open note in editor)
- TrainSummaryWriter: pure function generating markdown from train state (thought list, branches, merges, stats)
- TrainService: `generateSummary(trainId)` calling writer + file creation + event emission
- Train history: rendered in TrainMainView empty state or as a sub-panel when no active train
- Integration tests for all new behaviors

### Out of Scope
- Train types at creation (deferred — needs type registry, settings UI)
- Dedicated Train Hub view (trains don't warrant a full BaseHubView hub yet)
- Round-trip canvas→train sync
- AI-driven thought synthesis
- Cross-cycle train continuations

---

## Definition of Ready — Verification

### 1. Feature PRD Readiness
- [x] PRD exists and is approved — [[Train Improvements PRD]] (stage: in-progress)
- [x] FRI scored — 25/35 (continuation threshold: 11/35)
- [x] Technical Review passed — Cycles 17-19 delivered successfully

### 2. Backlog Readiness
- [x] PBIs defined — PBI-TOT-007 (Train Enhancements)
- [x] PBIs chunked into increments — 5 vertical slices
- [x] Dependencies mapped — Inc 1→5, Inc 2→5, Inc 3→5, Inc 4→5
- [x] Priority ranked — sidebar nav (user request) → keyboard → summary → history → integration

### 3. Cycle Plan Document
- [x] Cycle document exists with proper frontmatter
- [x] Situation assessment written
- [x] Cycle goals defined — 5 goals with clear deliverables
- [x] Proposed increments specified — 5 increments with goal, scope, LOC, tests
- [x] Dependency graph drawn
- [x] Risks identified
- [x] Success metrics defined
- [x] Deferred items documented

### 4. Increment Readiness
- [x] Scope statement defined per increment
- [x] Acceptance criteria written per increment
- [x] Test intent stated per increment
- [x] Documentation intent stated per increment
- [x] Architecture seams confirmed
- [x] Estimated size per increment

### 5. Quality Baseline
- [x] Build pipeline green — `npm test` passes, 3,831 tests, 155 suites
- [x] No critical bugs open
- [x] Previous cycle closed — Cycle 19 delivered, stage=delivered

### 6. Pre-Cycle Completion
- [x] Inbox signals reviewed — 4 items addressed, 6+ deferred with rationale
- [x] No pre-cycle bug fixes needed

**Result: All DoR items satisfied. Cycle is READY to start.**

---

### Inc 1: Sidebar → Main View Navigation ✅

**Goal:** Add an "Open Train" button to the TrainTimelineSidebar header so users can open/reveal the full TrainMainView from the sidebar.

| Step | File | Purpose | Actual LOC |
|------|------|---------|------------|
| 1 | `src/infrastructure/ui/events.ts` | Update `ui.openTrainView` payload to accept optional `trainId` | ~2 |
| 2 | `src/main.ts` | Update handler to use `event.payload.trainId` with active train fallback | ~3 |
| 3 | `src/ui/train/TrainTimelineSidebar.ts` | Add "Open Train" icon button (maximize-2) in `renderHeader()` | ~12 |
| 4 | `tests/ui/train/TrainTimelineSidebar.test.ts` | Tests for button rendering, click payload, stopPropagation | ~30 |

**Actual total:** ~17 LOC source, ~30 LOC tests, ~3 new tests

**Implementation detail:** Updated `ui.openTrainView` event type from `Record<string, never>` to `{ trainId?: string }`. Backward compatible — existing callers passing `{}` still work. Sidebar button emits with `{ trainId: train.id }`, main.ts handler uses payload trainId with fallback to active train.

**Acceptance criteria:**
- [x] "Open Train" button visible in sidebar header (maximize-2 icon, ariaLabel "Open train detail")
- [x] Click emits `ui.openTrainView` with `{ trainId }` payload
- [x] main.ts handler uses trainId from payload, falls back to active train
- [x] stopPropagation prevents parent click handlers from firing
- [x] `npm test` passes

---

### Inc 2: Git Graph Timeline + Bottom-to-Top Rendering ✅

**Goal:** Replace the text-based timeline with a VS Code-style git graph visualization, and reverse rendering order so newest thought stacks on top.

| Step | File | Purpose | Actual LOC |
|------|------|---------|------------|
| 1 | `src/ui/train/TrainTimelineSidebar.ts` | New `computeGraphLayout()` pure function — walks graph, assigns lanes, tracks active rails | ~55 |
| 2 | `src/ui/train/TrainTimelineSidebar.ts` | Replace `renderChain()`/`renderNode()` with `renderGraphTimeline()`/`renderGraphRow()` — colored rails, dots, fork connectors | ~80 |
| 3 | `src/ui/train/TrainTimelineSidebar.ts` | Bottom-to-top: reverse layout rows before rendering | ~2 |
| 4 | `styles.css` | New `.ft-graph-*` CSS classes — lane colors (6), rails, dots, fork connectors, content layout | ~85 |
| 5 | `tests/ui/train/TrainTimelineSidebar.test.ts` | Tests for graph rendering, bottom-to-top order, layout computation | ~200 |

**Actual total:** ~140 LOC source, ~85 LOC CSS, ~200 LOC tests, ~15 new tests (8 updated + 8 pure function tests)

**Implementation detail:**
- **`computeGraphLayout()`**: Exported pure function. Walks "next" chains at lane 0, "branch" forks at lane+1. Returns `GraphRow[]` with per-row `activeLanes: Map<number, string>` snapshots. Collapsed nodes suppress branch recursion. Capped at lane 5.
- **`LANE_COLORS`**: 6 CSS custom properties with hex fallbacks (`--ft-lane-0` through `--ft-lane-5`). Uses Obsidian's `--interactive-accent`, `--color-orange`, `--color-purple`, `--color-green`, `--color-yellow`, `--color-cyan`.
- **Graph cell per row**: Fixed-width positioned container with vertical rail segments (2px, full height), fork connectors (horizontal line from parent lane center to branch lane center), and circular node dots (10px, centered via `transform: translate(-50%, -50%)`).
- **Bottom-to-top**: `[...rows].reverse()` before rendering — newest at top, root at bottom.
- **Replaced**: `renderChain()`, `renderNode()` (text bullets ○/●, tree connectors ├─/└─, paddingLeft indentation) → graph cells with colored rails, CSS dots, horizontal fork connectors.

**Test intent:** Bottom-to-top DOM order verified. Graph dots replace bullets. Fork connectors on branch starts only. Rails count matches active lanes. Collapse/expand still works. Pure function tests for lane assignment, active lane tracking, depth cap, collapsed nodes.

**Acceptance criteria:**
- [x] VS Code-style git graph with colored lane rails and circular dots
- [x] Fork connectors show horizontal lines from parent lane to branch lane
- [x] 6 lane colors with CSS custom property fallbacks
- [x] Newest thought renders at the top of the timeline (bottom-to-top)
- [x] Root node renders at the bottom
- [x] Branch nodes on separate lanes (no paddingLeft — graph cell handles positioning)
- [x] `computeGraphLayout()` exported as pure function with independent tests
- [x] Collapse/expand, click navigation, merge badges all preserved
- [x] `npm test` passes — 3,846 tests (155 suites)

---

### Inc 3: Main View Keyboard Navigation ✅

**Goal:** Add keyboard shortcuts to TrainMainView for navigating thoughts without the mouse.

| Step | File | Purpose | Actual LOC |
|------|------|---------|------------|
| 1 | `src/ui/train/TrainMainView.ts` | `handleKeydown()` method — ArrowDown/ArrowUp/Enter handling | ~25 |
| 2 | `src/ui/train/TrainMainView.ts` | Set `contentEl.tabIndex = 0` and wire keydown listener in `onOpen()` | ~3 |
| 3 | `tests/ui/train/TrainMainView.test.ts` | 8 keyboard navigation tests | ~80 |

**Actual total:** ~28 LOC source, ~80 LOC tests, ~8 new tests

**Keyboard map:**
- `ArrowDown` → Navigate to next thought (same as clicking "Next" button)
- `ArrowUp` → Navigate to previous thought (same as clicking "Prev" button)
- `Enter` → Open current thought's note file in the editor (via `app.workspace.openLinkText`)

**Acceptance criteria:**
- [x] ArrowDown/ArrowUp navigate through thoughts
- [x] Enter opens the current thought's note file
- [x] No action at boundaries (first/last thought)
- [x] `train.thought.activated` emitted on ArrowDown/ArrowUp
- [x] Unrelated keys ignored
- [x] `npm test` passes — 3,855 tests (155 suites)

---

### Inc 4: Train Summary Document Generation ✅

**Goal:** Auto-generate a structured markdown summary note when a train completes, delivering the synthesis that users need.

| Step | File | Purpose | Actual LOC |
|------|------|---------|------------|
| 1 | `src/domain/train/TrainSummaryWriter.ts` | Pure function: `generateTrainSummary(train): string` → markdown with frontmatter, stats, timeline, branches, merges | ~85 |
| 2 | `src/domain/train/TrainService.ts` | `writeSummary()` private method called from `completeTrain()` + `session.completed` listener | ~15 |
| 3 | `src/domain/train/events.ts` | Add `train.summary.created` event | ~2 |
| 4 | `src/infrastructure/events/catalog.ts` | Register new event in catalog | ~1 |
| 5 | `tests/domain/train/trainSummaryWriter.test.ts` | 18 tests: frontmatter, stats, timeline, branches, merges, edge cases | ~210 |

**Actual total:** ~103 LOC source, ~210 LOC tests, ~18 new tests

**Summary document structure:**
```markdown
---
type: TrainSummary
train: "{title}"
status: completed
thoughts: {count}
branches: {count}
merges: {count}
duration: {minutes}
created: {ISO date}
completed: {ISO date}
---

# Train Summary: {title}

## Stats
- **Duration:** {N} minutes
- **Thoughts:** {N} ({main chain} main + {branch count} branched)
- **Merges:** {N}

## Timeline
1. {thought title} ({time}) — root
2. {thought title} ({time})
   - ↗ {branch thought} ({time})
3. ...

## Branches
- Branch from "{origin title}": {child titles}

## Merges
- {source title} → {target title}
```

**Implementation detail:**
- **`generateTrainSummary(train)`**: Pure function producing full markdown with YAML frontmatter (type, train, status, thoughts, branches, merges, duration, created, completed) + 4 content sections (Stats, Timeline, Branches, Merges). Uses wikilinks `[[title]]` for thought references. Timeline section shows branch children inline with `↗` prefix. Sections omitted when empty (no branches → no Branches section).
- **`writeSummary()`**: Private method on TrainService, called fire-and-forget from both `completeTrain()` and `session.completed` listener. Skips empty trains (0 thoughts). Creates file at `{trainFolder}/{title} — Summary.md`.
- **UTC timestamps**: `formatTime()` uses `getUTCHours()/getUTCMinutes()` for deterministic output.

**Test intent:** Frontmatter correctness (type, title, status, counts, dates, escaping). Stats section with main/branched breakdown. Timeline in order with root suffix and inline branches. Branch grouping by origin. Merge pairs. Empty/single-thought edge cases. Null completedAt handling.

**Documentation intent:** Register `train.summary.created` event in catalog.

**Acceptance criteria:**
- [x] Summary document created in train folder on completion
- [x] Contains train title, stats, timeline, branches, merges
- [x] Frontmatter has type, train, status, thought count, dates
- [x] `train.summary.created` event emitted with path
- [x] Empty/single-thought trains handled gracefully
- [x] `npm test` passes — 3,873 tests (156 suites)

---

### Inc 5: Train History Panel ✅

**Goal:** Show a browsable list of all trains (active, paused, completed) when no train is focused in the main view.

| Step | File | Purpose | Actual LOC |
|------|------|---------|------------|
| 1 | `src/ui/train/TrainHistoryPanel.ts` | New component: compact train cards with title, status badge, stats, filters | ~135 |
| 2 | `src/ui/train/TrainMainView.ts` | Replace empty state with TrainHistoryPanel via `onSelectTrain` callback | ~10 |
| 3 | `tests/ui/train/TrainHistoryPanel.test.ts` | 13 tests: rendering, filtering, navigation, sorting | ~250 |
| 4 | `tests/ui/train/TrainMainView.test.ts` | Updated "hides controls" test — now checks controls section not buttons count | ~3 |

**Actual total:** ~145 LOC source, ~250 LOC tests, ~13 new tests

**Implementation detail:**
- **TrainHistoryPanel**: Self-contained component with internal `filter: TrainStatusFilter` state. Renders header, filter bar (All/Active/Completed), and sorted card list. Cards show train-front icon, title, status badge, stats row (thoughts/branches/duration), and date row. Cards sorted newest first. Click calls `onSelectTrain(trainId)`.
- **TrainMainView integration**: `renderEmptyState()` replaced from static text to `TrainHistoryPanel` instance with callback that sets `trainId` and re-renders.
- **Filter logic**: "Active" = running + paused; "Completed" = completed only; "All" = no filter. Empty results show contextual message.

**Acceptance criteria:**
- [x] Train history panel shows when no train is focused
- [x] Each card shows title, status badge, thought count, branch count, duration
- [x] Status filter buttons (All / Active / Completed) work
- [x] Click card opens that train in main view
- [x] Completed trains browsable from history
- [x] `npm test` passes — 3,886 tests (157 suites)

---

### Inc 6: Integration Tests & Polish ✅

**Goal:** Create Flow 20 covering the full enhanced train lifecycle.

| Step | File | Purpose | Actual LOC |
|------|------|---------|------------|
| 1 | `tests/flows/20-TrainEnhancements.test.ts` | Flow test: summary generation lifecycle (4 tests) | ~150 |
| 2 | Same file | History browsing tests (3 tests) | ~50 |
| 3 | Same file | Full lifecycle test: start → capture → branch → complete → summary → accessible | ~40 |
| 4 | Same file | Event sequencing + summary writer edge cases (2 tests) | ~30 |
| 5 | `src/domain/train/TrainCanvasWriter.ts` | Export `NodePosition` interface (user request) | ~1 |

**Actual total:** ~1 LOC source, ~270 LOC tests, ~10 new tests

**Implementation detail:**
- Flow 20 tests use the standard test harness pattern (EventBus + mock SessionService + CaptureService + TrainService) from Flow 19.
- Summary generation verified at 3 levels: file creation path, event emission, and content via pure function.
- Empty train (0 thoughts) verified to skip summary generation.
- Full lifecycle test covers all phases: start → capture → branch → complete → summary event → history access.
- Event sequencing test verifies `train.completed` fires before `train.summary.created`.

**Acceptance criteria:**
- [x] Flow 20 covers summary generation lifecycle (4 tests)
- [x] Flow 20 covers history browsing (3 tests)
- [x] Flow 20 covers full lifecycle with branches (1 test)
- [x] All existing tests pass
- [x] `npm test` passes — 3,896 tests (158 suites)

---

## Dependency Graph

```
Inc 1 (Sidebar Nav)    ──→ Inc 6 (Integration)
Inc 2 (Timeline Flip)  ──→ Inc 6 (Integration)
Inc 3 (Keyboard Nav)   ──→ Inc 6 (Integration)
Inc 4 (Summary Doc)    ──→ Inc 6 (Integration)
Inc 5 (History Panel)  ──→ Inc 6 (Integration)
```

**Execution order:**
- Phase A: Inc 1 + Inc 2 (parallel — independent sidebar/timeline UI changes)
- Phase B: Inc 3 + Inc 4 (parallel — keyboard nav + summary writer)
- Phase C: Inc 5 (history panel — can use reversed timeline)
- Phase D: Inc 6 (integration — depends on all)

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Summary document conflicting with manual notes in train folder | Low | Use distinctive filename: `{title} — Summary.md` with TrainSummary frontmatter type |
| Reversed timeline confusing for existing users | Medium | Consistent bottom-to-top across both sidebar and main view; auto-scroll to newest |
| Keyboard shortcuts conflicting with Obsidian global shortcuts | Medium | Only listen when TrainMainView has focus; use `contentEl.tabIndex = 0` for focusability |
| History panel performance with many trains (100+) | Low | Trains are lightweight state objects; no file I/O for card rendering |
| Main view state confusion when navigating from history to active train | Medium | Clear trainId state when starting new train; history panel greys out current active train |
| Summary writer producing inconsistent output for edge cases | Low | Pure function with comprehensive tests; empty/single-thought handled explicitly |

---

## Success Metrics

| Metric | Target | Actual |
|--------|--------|--------|
| New tests | ~63 | 65 |
| Source LOC | ~370 | ~490 |
| Post-cycle total tests | ~3,894 | 3,896 |
| Post-cycle test suites | ~159 | 158 |
| Sidebar nav tests | ~8 | 3 |
| Git graph timeline tests | ~8 | 15 |
| Keyboard nav tests | ~10 | 8 |
| Summary writer tests | ~15 | 18 |
| History panel tests | ~12 | 13 |
| Integration tests | ~10 | 10 |

---

## Deferred Items

| Item | Rationale | Target |
|------|-----------|--------|
| Train types at creation | Needs type registry, settings UI, per-type config | Cycle 21+ |
| Train templates (save/reuse) | Depends on train types | Future |
| Cyclical trains (loop back) | Novel concept requiring state machine changes | Future spike |
| AI-driven thought synthesis | Requires AI infrastructure | Future |
| Thought frontmatter enrichment UI | Low priority; frontmatter already updated automatically | Future |
| Multi-window train + canvas split | Obsidian-native; workaround exists via split panes | Future |
| Cross-cycle train continuations | Novel concept, unclear UX | Future |
| Train-specific closure ritual questions | Depends on train types for meaningful differentiation | Cycle 21+ |

---

## Inbox Signals Reviewed

| Inbox Item | Disposition |
|------------|-------------|
| Session complete view adjusted for train | **Addressed** in Inc 4 (train summary doc) |
| Enhance trains with synthesis | **Addressed** in Inc 4 (summary generation on completion) |
| Move with keyboard through train | **Addressed** in Inc 3 (ArrowUp/Down + Enter) |
| Reach Train Detail from sidebar | **Addressed** in Inc 1 (Open Train button) |
| Timeline should stack bottom-to-top | **Addressed** in Inc 2 (reversed timeline rendering) |
| Choose train type at start | **Deferred** — needs type registry and settings UI |
| Better integrate trains and sessions | **Partial** — summary doc bridges train→session output; deeper integration deferred |
| Open train in new window | **Deferred** — Obsidian-native, workaround exists |
| Enrich frontmatter on detail page | **Deferred** — low priority |
| Train running in cycles | **Deferred** — novel concept |
| AI follow train-of-thought | **Deferred** — requires AI infrastructure |

---

## Definition of Done (Cycle)

### 1. All Increments Completed
- [x] Each increment satisfies its own acceptance criteria (6/6 ✅)
- [x] No increment left in partial state
- [x] Deferred items documented with rationale

### 2. Build & Test Quality
- [x] `npm test` passes — 3,896 tests, 158 suites, 32 skipped
- [x] `npm run check` passes (tsc + eslint clean)
- [x] No test regressions on existing 3,831 tests (+65 new)

### 3. Feature Completeness
- [x] Sidebar "Open Train" button opens TrainMainView
- [x] Timeline renders bottom-to-top with git graph visualization (newest at top, root at bottom)
- [x] Arrow keys navigate thoughts in main view (ArrowDown/Up + Enter to open)
- [x] Summary document generated on train completion (markdown with frontmatter, stats, timeline, branches, merges)
- [x] Train history panel shows all trains with filtering (All/Active/Completed)
- [x] Integration test covers full lifecycle (Flow 20, 10 tests)

### 4. Documentation
- [x] Cycle plan updated with actual values
- [x] Success metrics verified
- [x] `train.summary.created` event registered in catalog
- [x] `NodePosition` type exported for documentation tooling

---

## Related
- PRD: [[Train Improvements PRD]], [[Train of Thoughts PRD]]
- Prior Cycles: [[Cycle 17 - Train Canvas and Branch Merge]], [[Cycle 18 - Train Canvas Visualization]], [[Cycle 19 - Train Merge Rules and Navigation]]
- Inbox: [[The session complete view needs to be adjusted when coming from a train]], [[How can we enhance trains with synthesis]], [[I want to move with the keyboard trough my train]]
