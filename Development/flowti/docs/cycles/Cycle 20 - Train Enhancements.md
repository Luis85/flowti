---
type: DevelopmentCycle
feature: "[[Train Improvements PRD]]"
stage: planned
cycle: 20
date_planned: 2026-02-22
date_completed:
pbis:
  - "[[PBI-TOT-007 Train Enhancements]]"
bugs: []
bugs_fixed_precycle: []
tech_debt: []
estimated_increments: 6
actual_increments:
estimated_tests: 63
actual_tests:
total_tests_after:
total_test_files_after:
---

# Cycle 20: Train Enhancements

## Cycle Overview

**User Story:**

> As a Train of Thoughts user, I want to navigate from the sidebar to the full train detail, browse my completed trains, navigate thoughts with the keyboard, and receive a synthesized summary document when I finish — so that the train experience feels complete and productive rather than ending abruptly.

**User Pains:**
- Sidebar shows the timeline but has no way to open the full Train Main View — users must find it via the tab bar
- Timeline reads top-to-bottom (root at top) but the mental model is "stacking" — newest thought should be at top
- No keyboard navigation in the main view — traversing thoughts requires clicking each nav button
- Completing a train produces no deliverable output — the train just stops with no summary or synthesis
- No way to browse past trains — completed trains vanish from the active view with no history access
- Generic session completion view misses train-specific insights (thought count, branches, merge graph)

**User Needs:**
- Sidebar header: "Open Train" button that reveals or opens the TrainMainView
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

1. **Sidebar → Main View navigation** — "Open Train" button in sidebar header to reveal TrainMainView
2. **Bottom-to-top timeline** — Reverse timeline rendering so newest thoughts stack on top (both sidebar and main view)
3. **Main view keyboard navigation** — Arrow keys for thought traversal, Enter to open note
4. **Train summary document** — auto-generate structured markdown on completion
5. **Train history panel** — browse all trains with status filter and navigation
6. **Integration tests** — verify all new behaviors in Flow 20

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

### Inc 1: Sidebar → Main View Navigation

**Goal:** Add an "Open Train" button to the TrainTimelineSidebar header so users can open/reveal the full TrainMainView from the sidebar.

| Step | File | Purpose | Est. LOC |
|------|------|---------|----------|
| 1 | `src/ui/train/TrainTimelineSidebar.ts` | Add "Open Train" icon button in `renderHeader()` next to canvas button | ~15 |
| 2 | `src/ui/train/TrainTimelineSidebar.ts` | Button emits `ui.openTrainView` and passes trainId via workspace state | ~10 |
| 3 | `src/main.ts` | Ensure `ui.openTrainView` handler sets trainId state on the revealed leaf | ~5 |
| 4 | `tests/ui/train/TrainTimelineSidebar.test.ts` | Tests for button rendering, click behavior, state passing | ~60 |

**Est. total:** ~30 LOC source, ~60 LOC tests, ~8 new tests

**Implementation detail:** The `ui.openTrainView` event already exists (Cycle 19 Inc 3). The sidebar button clicks → emits this event. The main.ts handler already calls `revealOrCreateTrainMain()`. Enhancement: pass `trainId` in the event payload so the revealed view shows the correct train (not just the active one). This enables opening completed trains from history too.

**Test intent:** Button renders in sidebar header. Click emits `ui.openTrainView`. Button shows train-front icon. No button when no train loaded. Event payload includes trainId.

**Documentation intent:** None (UI behavior addition).

**Acceptance criteria:**
- [ ] "Open Train" button visible in sidebar header next to canvas button
- [ ] Click opens/reveals TrainMainView with the correct trainId
- [ ] Works for both active and completed trains
- [ ] `npm test` passes

---

### Inc 2: Bottom-to-Top Timeline Rendering

**Goal:** Reverse the timeline rendering order so the newest thought appears at the top and the root at the bottom, following the "stacking state over state" metaphor.

| Step | File | Purpose | Est. LOC |
|------|------|---------|----------|
| 1 | `src/ui/train/TrainTimelineSidebar.ts` | Reverse `renderChain()` output — render newest-first, root at bottom | ~20 |
| 2 | `src/ui/train/TrainTimelineSidebar.ts` | Auto-scroll to top (newest) instead of active node on initial render | ~5 |
| 3 | `src/ui/train/TrainMainView.ts` | Update thought counter: "Thought N of M" reflects reversed order | ~5 |
| 4 | `tests/ui/train/TrainTimelineSidebar.test.ts` | Tests for reversed node order in DOM | ~40 |
| 5 | `tests/ui/train/TrainMainView.test.ts` | Update counter expectations | ~20 |

**Est. total:** ~30 LOC source, ~60 LOC tests, ~8 new tests

**Implementation detail:** The sidebar currently walks the train graph root-first and appends nodes top-to-bottom. Reversal approach: collect all rendered nodes into a DocumentFragment, then prepend them in reverse order (or use CSS `flex-direction: column-reverse` on the timeline container). The simpler CSS approach avoids changing the tree-walk algorithm — just flip the container direction and adjust the auto-scroll target.

**Test intent:** First DOM child in timeline container is the newest thought (head or last-added). Root node appears at the bottom. Branch indentation still works correctly. Active node indicator works in reversed layout. New thoughts appear at the top when added.

**Documentation intent:** None (UI rendering change).

**Acceptance criteria:**
- [ ] Newest thought renders at the top of the timeline
- [ ] Root node renders at the bottom
- [ ] Branch indentation and connectors still display correctly
- [ ] New thoughts added during capture appear at top
- [ ] `npm test` passes

---

### Inc 3: Main View Keyboard Navigation

**Goal:** Add keyboard shortcuts to TrainMainView for navigating thoughts without the mouse.

| Step | File | Purpose | Est. LOC |
|------|------|---------|----------|
| 1 | `src/ui/train/TrainMainView.ts` | Add keydown listener on contentEl for Arrow Up/Down/Enter | ~25 |
| 2 | `src/ui/train/TrainMainView.ts` | `navigatePrev()` / `navigateNext()` helpers reusing existing nav logic | ~15 |
| 3 | `src/ui/train/TrainMainView.ts` | Enter key opens thought note file in editor | ~10 |
| 4 | `tests/ui/train/TrainMainView.test.ts` | Tests for keyboard navigation, edge cases | ~80 |

**Est. total:** ~50 LOC source, ~80 LOC tests, ~10 new tests

**Keyboard map:**
- `ArrowDown` → Navigate to next thought (same as clicking "Next" button)
- `ArrowUp` → Navigate to previous thought (same as clicking "Prev" button)
- `Enter` → Open current thought's note file in the editor (via `app.workspace.openLinkText`)

**Test intent:** ArrowDown advances to next thought. ArrowUp goes back. ArrowDown at last thought does nothing. ArrowUp at first thought does nothing. Enter emits navigation event or calls workspace API. Keyboard events fire `train.thought.activated`. Focus management works after open/render.

**Documentation intent:** None (keyboard UX addition).

**Acceptance criteria:**
- [ ] ArrowDown/ArrowUp navigate through thoughts
- [ ] Enter opens the current thought's note file
- [ ] Navigation wraps correctly (no action at boundaries)
- [ ] `train.thought.activated` emitted on keyboard navigation
- [ ] `npm test` passes

---

### Inc 4: Train Summary Document Generation

**Goal:** Auto-generate a structured markdown summary note when a train completes, delivering the synthesis that users need.

| Step | File | Purpose | Est. LOC |
|------|------|---------|----------|
| 1 | `src/domain/train/TrainSummaryWriter.ts` | Pure function: `generateTrainSummary(train): string` → markdown | ~80 |
| 2 | `src/domain/train/TrainService.ts` | Add `completeTrain()` hook: after completion, generate + save summary | ~20 |
| 3 | `src/domain/train/events.ts` | Add `train.summary.created` event | ~3 |
| 4 | `src/infrastructure/events/catalog.ts` | Register new event in catalog | ~2 |
| 5 | `tests/domain/train/trainSummaryWriter.test.ts` | Tests for summary content, edge cases | ~100 |

**Est. total:** ~105 LOC source, ~100 LOC tests, ~15 new tests

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

**Test intent:** Summary contains train title as heading. Stats section has correct counts. Timeline lists thoughts in order with timestamps. Branch section shows branch origins and children. Merge section lists merge pairs. Empty train (0 thoughts) produces minimal summary. Single-thought train has no branches/merges sections. Summary frontmatter has correct metadata.

**Documentation intent:** Register `train.summary.created` event in catalog.

**Acceptance criteria:**
- [ ] Summary document created in train folder on completion
- [ ] Contains train title, stats, timeline, branches, merges
- [ ] Frontmatter has type, train, status, thought count, dates
- [ ] `train.summary.created` event emitted with path
- [ ] Empty/single-thought trains handled gracefully
- [ ] `npm test` passes

---

### Inc 5: Train History Panel

**Goal:** Show a browsable list of all trains (active, paused, completed) when no train is focused in the main view.

| Step | File | Purpose | Est. LOC |
|------|------|---------|----------|
| 1 | `src/ui/train/TrainHistoryPanel.ts` | New component: compact train cards with title, status badge, stats | ~100 |
| 2 | `src/ui/train/TrainMainView.ts` | Replace empty state with TrainHistoryPanel when no active train | ~15 |
| 3 | `src/ui/train/TrainHistoryPanel.ts` | Status filter buttons (All / Active / Completed) | ~30 |
| 4 | `src/ui/train/TrainHistoryPanel.ts` | Click card → open that train in main view | ~10 |
| 5 | `tests/ui/train/TrainHistoryPanel.test.ts` | Tests for rendering, filtering, navigation | ~80 |

**Est. total:** ~155 LOC source, ~80 LOC tests, ~12 new tests

**Card layout:**
```
┌──────────────────────────────┐
│ 🚂 My Train Title    ● running │
│ 5 thoughts · 2 branches · 12m  │
│ Started 2:30 PM                 │
└──────────────────────────────┘
```

**Test intent:** Panel renders all trains from `getAllTrains()`. Status filter shows only matching trains. Click on card sets trainId and re-renders main view. Empty state when no trains exist. Completed trains show completion date. Cards sorted by creation date (newest first).

**Documentation intent:** None (UI component).

**Acceptance criteria:**
- [ ] Train history panel shows when no train is focused
- [ ] Each card shows title, status badge, thought count, branch count, duration
- [ ] Status filter buttons (All / Active / Completed) work
- [ ] Click card opens that train in main view
- [ ] Completed trains browsable from history
- [ ] `npm test` passes

---

### Inc 6: Integration Tests & Polish

**Goal:** Update Flow 19 / create Flow 20 for all new behaviors, verify cross-feature interactions.

| Step | File | Purpose | Est. LOC |
|------|------|---------|----------|
| 1 | `tests/flows/20-TrainEnhancements.test.ts` | New flow test: start → capture → complete → summary created | ~120 |
| 2 | Same file | Keyboard nav test: ArrowDown/Up through thoughts | ~40 |
| 3 | Same file | History panel test: completed train appears in history, clickable | ~40 |

**Est. total:** ~0 LOC source, ~200 LOC tests, ~10 new tests

**Test intent:** Full lifecycle: start train → add 3 thoughts → branch → complete → verify summary document created. Keyboard navigation through thought sequence. History panel shows train after completion. Sidebar "Open Train" button opens correct train.

**Documentation intent:** Update cycle plan with actual values. Update Train Improvements PRD FRI if applicable.

**Acceptance criteria:**
- [ ] Flow 20 covers summary generation lifecycle
- [ ] Flow 20 covers keyboard navigation
- [ ] All existing tests pass
- [ ] `npm test` passes

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

| Metric | Target |
|--------|--------|
| New tests | ~63 |
| Source LOC | ~370 |
| Post-cycle total tests | ~3,894 |
| Post-cycle test suites | ~159 |
| Sidebar nav tests | ~8 |
| Timeline reversal tests | ~8 |
| Keyboard nav tests | ~10 |
| Summary writer tests | ~15 |
| History panel tests | ~12 |
| Integration tests | ~10 |

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
- [ ] Each increment satisfies its own acceptance criteria
- [ ] No increment left in partial state
- [ ] Deferred items documented with rationale

### 2. Build & Test Quality
- [ ] `npm test` passes (all existing + ~63 new)
- [ ] `npm run check` passes (tsc + eslint clean)
- [ ] No test regressions on existing 3,831 tests

### 3. Feature Completeness
- [ ] Sidebar "Open Train" button opens TrainMainView
- [ ] Timeline renders bottom-to-top (newest at top, root at bottom)
- [ ] Arrow keys navigate thoughts in main view
- [ ] Summary document generated on train completion
- [ ] Train history panel shows all trains with filtering
- [ ] Integration test covers full lifecycle

### 4. Documentation
- [ ] Cycle plan updated with actual values
- [ ] Success metrics verified
- [ ] PRD FRI re-scored if applicable

---

## Related
- PRD: [[Train Improvements PRD]], [[Train of Thoughts PRD]]
- Prior Cycles: [[Cycle 17 - Train Canvas and Branch Merge]], [[Cycle 18 - Train Canvas Visualization]], [[Cycle 19 - Train Merge Rules and Navigation]]
- Inbox: [[The session complete view needs to be adjusted when coming from a train]], [[How can we enhance trains with synthesis]], [[I want to move with the keyboard trough my train]]
