---
type: DevelopmentCycle
feature: "[[Train Improvements PRD]]"
stage: ready
cycle: 24
date_planned: 2026-02-23
date_completed:
pbis:
  - "[[PBI-TOT-010 Train Hub]]"
  - "[[PBI-TOT-011 Train UX Sprint]]"
bugs: []
bugs_fixed_precycle:
  - "Merge-down dots do not converge visually in timeline — merge connector added"
  - "Clicking timeline node does not open detail view — ui.openTrainView emitted on node click"
tech_debt: []
estimated_increments: 5
actual_increments:
estimated_tests: 80
actual_tests:
total_tests_after:
total_test_files_after:
---

# Cycle 24: Train Value Sprint

## Cycle Overview

**User Story:**

> As a Train of Thoughts user, I want a dedicated Train Hub to manage all my trains from one place, I want the resume flow to be smart about where I am in the graph, and I want quick navigation to the head of the train so I can keep my capture rhythm. I also want to choose a train type at the start and enrich thought notes with properties from the detail page.

**User Pains:**
- No central place to see and manage all trains — must find them via the session list or commands
- When resuming a train, if the active node is mid-chain (not the head), the user must manually navigate to the end before adding thoughts — no way to jump or branch from the current position
- No "Jump to end" button — navigating long trains requires clicking through every node
- No train type selection at creation — all trains look the same
- Can't add frontmatter properties to thought notes from the detail view — must open each note individually
- Train-specific closure insights are lost in the generic session completion view

**User Needs:**
- Central Train Hub with all trains listed, searchable, filterable by status
- "Jump to end" button in detail view that navigates to the head (last main-chain node)
- Smart resume modal: when not on the head node, ask "Jump to end" or "Branch from here"
- Train type selection at start (brainstorm, research, decision, etc.)
- Inline property editor on thought detail page
- Train graph context visible in session closure

---

## Situation Assessment

### Pre-Cycle State (post-Cycle 23 + post-delivery amendments)

**Plugin health:**
- 3,976 tests passing, 161 test suites, 32 skipped
- Build status: green (`npm test` + `npm run check` clean)
- Pre-cycle bug fixes applied: merge connector visualization, timeline node opens detail view

**Train domain status:**
- Domain: ~1,895 LOC (TrainService 864, TrainCanvasWriter 543, TrainCanvasSyncService 137, TrainSummaryWriter 213, helpers 11, types 87, events 40)
- UI: ~2,260 LOC (TrainMainView 700, TrainTimelineSidebar 503, TrainCaptureModal 319, TrainHistoryPanel 171, TrainMergeSelector 127, subscriptions 224, panels 201, types 15)
- Tests: 683 train-specific tests across 18 test files (363 domain + 290 UI + 30 flow)
- FRI: 28/35 (Train Improvements PRD v2)
- 15 events, 20 public service methods, 5 commands, 11 UI components
- 9/9 PBIs delivered (TOT-001 through TOT-009)

**Post-Cycle 23 amendments (2026-02-23):**
- `findMergeDownTarget()` enhanced: returns `{ targetId, originId }` for all branch endpoints
- Merge-down flow redesigned: Case 1 (add on branch, merge into target), Case 2 (add on main, merge branch)
- Already-merged guard: `findMergeDownTarget` returns null when branch is merged
- Per-train timestamped subfolders: each train gets `YYYYMMDD-HHmm Title/` folder
- Rename thought from capture modal (pencil icon)
- Sidebar toggle fix (`isShown()` vs `hasClass`)
- Back button restyled in action row
- 3,976 tests passing (up from 3,952 at Cycle 23 delivery)

**Open review action items (Three Amigos):**
- OBS-1: TrainMainView rendering tests for new layout (QA — this cycle)
- OBS-2: Monitor TrainMainView LOC growth (700 LOC — approaching extraction threshold)

**Inbox signals reviewed (28 vault items):**
- **Addressed this cycle:** Train Hub, train types, frontmatter enrichment, train closure context
- **Deferred with rationale:** Pre-configured train routes (needs template system), branch promotion (complex graph semantics), decision nodes (new type system needed), Zettelkasten method (specialized workflow), AI-assisted trains (infrastructure dependency), multi-window display (Obsidian limitation)

---

## Cycle Goals

1. **Train Hub** — Dedicated BaseHubView for managing all trains from one central place
2. **Jump-to-End & Smart Resume** — Quick navigation + resume decision modal when not at head
3. **Frontmatter Enrichment** — Property editor on thought detail page
4. **Train Types at Creation** — Type selection with type-specific default duration
5. **Train Closure Context + Integration Tests** — Train stats in closure overlay, flow tests for all new behaviors

---

## Scope

### In Scope
- `TrainHubView` extending `BaseHubView<TrainHubPage>` with tabs: Dashboard, Active, History
- "Jump to end" button in TrainMainView nav bar
- Resume modal: "Jump to end" vs "Branch from here" when not on head
- Train type registry with built-in types (brainstorm, research, decision, free-form)
- Type selector in start command / modal
- Inline property editor in thought detail section
- Train graph context injected into session closure overlay
- Integration tests for all new behaviors

### Out of Scope
- Custom train type creation/editing (use built-in types only)
- Train Hub split layout master/detail (start with single list view, add later)
- Cyclical trains / multiple concurrent train management
- AI-driven synthesis
- Pre-configured train routes/templates
- Branch promotion (branch becomes main line)

---

## Increments

### Inc 1: Train Hub

**Goal:** Dedicated BaseHubView for managing all trains from one central place.

**Design:**
- Extends `BaseHubView<TrainHubPage>` with pages: "dashboard" | "active" | "history"
- Dashboard: active train card (if any) + train stats (total, completed, avg thoughts, avg duration)
- Active tab: currently running/paused trains with Resume/Pause/Open/Delete actions
- History tab: completed trains with Open/Delete actions, searchable by title
- Command: `flowti:open-train-hub` — "Open Train hub"
- VIEW_TYPE: `"flowti-train-hub"` in `src/domain/hub/types.ts`

| File | Purpose | Est. LOC |
|------|---------|----------|
| `src/ui/train/TrainHubView.ts` (new) | BaseHubView subclass | ~250 |
| `src/domain/hub/types.ts` | Add VIEW_TYPE_TRAIN_HUB | ~2 |
| `src/main.ts` | Register view + command | ~15 |
| `tests/ui/train/TrainHubView.test.ts` (new) | 15 tests | ~200 |

**Test intent:** Dashboard renders stats, active tab lists running trains with actions, history tab lists completed trains with search, tab navigation works, cleanup on close.

**Documentation intent:** Update command registry documentation. Add Train Hub to hub registry.

**Architecture seams:** Follows BaseHubView pattern (EventCatalogView, DataExchangeHubView). Uses `trainService.getAllTrains()` + `trainService.getActiveTrain()` for data. No new events needed — reuses existing `train.started`, `train.completed`, `train.paused`, `train.resumed` for re-render triggers.

**AC:**
- [ ] Train Hub lists all trains with status badges
- [ ] Active tab shows running/paused trains with action buttons
- [ ] History tab shows completed trains, searchable
- [ ] Dashboard shows train stats
- [ ] `npm test` passes

---

### Inc 2: Jump-to-End & Smart Resume

**Goal:** Quick "Jump to end" button and a smart resume modal that asks what to do when not on the head node.

**Design:**
- **Jump to end button:** In TrainMainView nav bar, left side (before context-aware right action). Fast-forward icon. Visible only when active thought is not the head. Emits `train.thought.activated` with head node ID.
- **Smart resume modal:** When `ui.startTrain` fires for a paused train and the last `activeThoughtId` is NOT the head node, show a modal: "You're on '{activeNode.title}' — not the latest thought." Options: "Jump to end" (navigates to head, opens capture modal from there), "Branch from here" (stays on current node, opens capture modal with branch direction), "Stay here" (dismisses, opens detail view).
- `getHeadNode(trainId)` helper on TrainService: walks main chain via "next" relations, returns last node.

| File | Purpose | Est. LOC |
|------|---------|----------|
| `src/domain/train/TrainService.ts` | `getHeadNode(trainId)` public method | ~15 |
| `src/ui/train/TrainMainView.ts` | Jump-to-end button in nav bar | ~20 |
| `src/ui/train/TrainResumeModal.ts` (new) | Smart resume modal (3 options) | ~80 |
| `src/main.ts` | Wire resume modal in `openTrainModal()` | ~25 |
| `tests/domain/train/trainService.test.ts` | `getHeadNode()` tests | ~20 |
| `tests/ui/train/TrainResumeModal.test.ts` (new) | 8 tests | ~100 |

**Test intent:** `getHeadNode()` unit tests (linear chain, branched chain, empty train, single thought). Resume modal: renders 3 options, "Jump to end" navigates + opens capture, "Branch from here" opens capture with branch direction, "Stay here" dismisses. Jump button visibility: hidden at head, visible mid-chain.

**Documentation intent:** Update `openTrainModal()` JSDoc with resume flow.

**Architecture seams:** `getHeadNode()` is a pure graph traversal (like `getTimeline()` but returns last element). Resume modal follows `TrainCaptureModal` pattern (extends `Modal`, 3 buttons). Integration point: `openTrainModal()` in `main.ts` checks head vs active before opening capture modal.

**AC:**
- [ ] "Jump to end" button appears when not on head node
- [ ] Clicking it navigates to the head thought
- [ ] On resume from mid-chain, modal appears with 3 options
- [ ] "Jump to end" moves to head and continues capture flow
- [ ] "Branch from here" stays on current node, opens capture modal with branch direction
- [ ] "Stay here" dismisses without action
- [ ] `npm test` passes

---

### Inc 3: Frontmatter Enrichment on Detail Page

**Goal:** Inline property editor on the thought detail section in TrainMainView. Users can add/edit frontmatter properties without opening the note file.

**Design:**
- New section in `renderThoughtDetail()`: "Properties" collapsible section
- Read existing frontmatter from the thought file via `metadataCache.getCache(path)?.frontmatter`
- Display key-value pairs with inline edit (click to edit value)
- "Add property" button adds a new key-value row
- On edit/add, write updated frontmatter to the file via `app.fileManager.processFrontMatter()`
- Built-in properties (type, train, direction, order, parent) are read-only with lock icon
- Debounce writes at 500ms to avoid rapid file mutations

| File | Purpose | Est. LOC |
|------|---------|----------|
| `src/ui/train/TrainPropertyEditor.ts` (new) | Property editor component | ~150 |
| `src/ui/train/TrainMainView.ts` | Wire into `renderThoughtDetail()` | ~10 |
| `tests/ui/train/TrainPropertyEditor.test.ts` (new) | 10 tests | ~120 |

**Test intent:** Renders existing properties as key-value list, built-in properties read-only, edit triggers frontmatter update, add new property, empty state message, debounce prevents rapid writes.

**Documentation intent:** None beyond inline code comments.

**Architecture seams:** Property editor is a standalone component following `TrainStatsPanel` pattern (constructor receives container + deps). Uses `metadataCache` (read) and `processFrontMatter` (write) — no new service methods needed. TrainMainView passes thought path to editor.

**AC:**
- [ ] Properties section shows in thought detail view
- [ ] Existing frontmatter properties displayed as key-value list
- [ ] User can edit values inline
- [ ] User can add new key-value properties
- [ ] Built-in properties (type, train, direction) are read-only
- [ ] Changes persist to the file's frontmatter
- [ ] `npm test` passes

---

### Inc 4: Train Types at Creation

**Goal:** Allow choosing a train type when starting a new train. Types have default duration.

**Design:**
- Built-in types: `brainstorm` (default 15min), `research` (25min), `decision` (10min), `free-form` (no timer)
- `TrainTypeConfig`: `{ id: string, label: string, icon: string, defaultDuration: number }`
- `BUILT_IN_TRAIN_TYPES` constant array in `types.ts`
- Start command opens type picker modal before creating train
- Type stored on `TrainState.trainType?: string` (backward compat — existing trains have no type)
- Type badge shown in TrainMainView header and Train Hub list
- `startTrain()` signature extended: `startTrain(title, durationMinutes?, trainType?)` — duration falls back to type default when not specified

| File | Purpose | Est. LOC |
|------|---------|----------|
| `src/domain/train/types.ts` | `TrainTypeConfig`, `BUILT_IN_TRAIN_TYPES`, add `trainType` to TrainState | ~40 |
| `src/ui/train/TrainTypePickerModal.ts` (new) | Type selection modal with icons | ~60 |
| `src/domain/train/TrainService.ts` | Accept `trainType` in `startTrain()` | ~10 |
| `src/main.ts` | Wire type picker before train start | ~15 |
| `src/ui/train/TrainMainView.ts` | Type badge in header | ~5 |
| `src/ui/train/TrainHubView.ts` | Type badge in train list | ~5 |
| `tests/domain/train/trainTypes.test.ts` (new) | 8 tests | ~80 |
| `tests/ui/train/TrainTypePickerModal.test.ts` (new) | 6 tests | ~60 |

**Test intent:** Built-in types constant has 4 entries with correct defaults. `startTrain()` accepts type parameter and stores on state. Type picker renders 4 options. Selection callback returns correct config. Type badge renders in detail view. Existing trains without type display "free-form" fallback.

**Documentation intent:** Update Train Improvements PRD with new FR. Add types to event catalog if new events needed.

**Architecture seams:** `TrainTypeConfig` is a simple data type (no domain service). Type picker follows Obsidian `Modal` pattern. `startTrain()` change is additive (optional parameter). Type badge is a DOM element in existing header render.

**AC:**
- [ ] Type picker shown before train starts
- [ ] 4 built-in types with icons and default durations
- [ ] Selected type stored on TrainState
- [ ] Type badge visible in detail view header
- [ ] Type-specific default duration applied to timer
- [ ] Type visible in Train Hub list
- [ ] Existing trains without type show "free-form" fallback
- [ ] `npm test` passes

---

### Inc 5: Integration Tests + TrainMainView Rendering Tests

**Goal:** Flow tests for all new Cycle 24 behaviors + resolve review action item OBS-1 (TrainMainView rendering tests for new layout).

**Design:**
- New flow test file: `tests/flows/23-TrainHub.test.ts` covering Train Hub, resume flow, types, frontmatter
- TrainMainView rendering tests: verify layout order (nav → controls → canvas callout → detail → breadcrumb), merge-down button visibility, jump-to-end button visibility

| File | Purpose | Est. LOC |
|------|---------|----------|
| `tests/flows/23-TrainHub.test.ts` (new) | 12 integration tests | ~200 |
| `tests/ui/train/TrainMainView.test.ts` | 8 additional rendering tests (OBS-1) | ~100 |

**Test intent:**
- Flow 23: Train Hub renders with active trains, resume modal appears when mid-chain, jump-to-end works, type selection flows through to TrainState, frontmatter edit persists, type badge appears.
- TrainMainView OBS-1: layout section order, merge-down button hidden after merge, jump-to-end button hidden at head, nav bar context-aware action.

**Documentation intent:** Flow documentation for Train Hub user journey.

**Architecture seams:** Flow tests use existing test harness pattern (EventBus + TrainService + CaptureService + mocks). TrainMainView tests follow existing `TrainMainView.test.ts` pattern.

**AC:**
- [ ] All 12 integration scenarios pass
- [ ] 8 TrainMainView rendering tests pass (OBS-1 resolved)
- [ ] No regression on existing 3,976 tests
- [ ] `npm test` passes

---

## Dependency Graph

```
Inc 1 (Train Hub)           ──→ Inc 4 (type badge in Hub)
Inc 2 (Jump/Resume modal)   ──  (independent)
Inc 3 (Property editor)     ──  (independent)
Inc 4 (Train types)         ──→ Inc 5 (type in flow tests)

Inc 1 + Inc 2 + Inc 3 + Inc 4 ──→ Inc 5 (Integration)
```

**Execution order:**
- Phase A: Inc 1 + Inc 2 + Inc 3 (parallel — all independent)
- Phase B: Inc 4 (depends on Inc 1 for Hub type badge)
- Phase C: Inc 5 (integration — depends on all)

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Train Hub scope creep (tabs, filters, sorting) | Medium | Start with 3 simple tabs, defer advanced features |
| Resume modal interrupts flow | Medium | Skip modal entirely when on head node (common case) |
| `processFrontMatter()` race with note sync | Medium | Debounce writes at 500ms, check lastSyncedContent pattern |
| Train type registry grows complex | Low | Built-in types only, no custom types in v1 |
| BaseHubView overhead for simple list | Low | Use minimal tab set, no split layout in this cycle |
| TrainMainView grows past extraction threshold | Medium | Currently 700 LOC — property editor is a standalone component, not inline code |

---

## Success Metrics

| Metric | Target |
|--------|--------|
| New tests | ~80 |
| Source LOC | ~400 |
| Post-cycle total tests | ~4,056 |
| Post-cycle test suites | ~167 |
| New TrainService APIs | 1 (getHeadNode) |
| New views | 1 (TrainHubView) |
| New modals | 2 (TrainResumeModal, TrainTypePickerModal) |
| New events | 0 (reuses existing) |
| FRI score | 28 → 31/35 |
| Review OBS resolved | OBS-1 (TrainMainView rendering tests) |

---

## Deferred Items

| Item | Rationale | Target |
|------|-----------|--------|
| Custom train type creation | Built-in types sufficient for v1 | Future |
| Train Hub split layout (master/detail) | Simple list is enough for now | Future |
| Pre-configured train routes/templates | Needs template system design | Future |
| Branch promotion (branch becomes main) | Complex graph semantics, needs design session | Future |
| Decision nodes | New node type system needed | Future |
| Cyclical trains | Novel concept, needs design session | Future |
| Multiple concurrent train management | Complex, needs UX design | Future |
| AI-driven train synthesis | Blocked on AI infrastructure | Future |
| Zettelkasten method support | Specialized workflow, needs design | Future |
| Canvas round-trip sync | Canvas→train write-back is complex | Future |
| Horizontal/radial canvas layout | Canvas layout API needed | Future |

---

## Definition of Done (Cycle)

### 1. All Increments Completed
- [ ] Each increment satisfies its own acceptance criteria
- [ ] No increment left in partial state
- [ ] Deferred items documented with rationale

### 2. Build & Test Quality
- [ ] `npm test` passes
- [ ] `npm run check` passes (tsc + eslint clean)
- [ ] No test regressions on existing 3,976 tests
- [ ] Test count deviation documented

### 3. Three Amigos Review
- [ ] Cycle-level review conducted
- [ ] All three perspectives represented
- [ ] TASM scores recorded
- [ ] Observations documented

### 4. PRD & Backlog Updates
- [ ] PRD updated — Train Improvements PRD v3 (FRI 28→31)
- [ ] PBIs updated (PBI-TOT-010, PBI-TOT-011)
- [ ] Event model current

### 5. Documentation
- [ ] Cycle plan updated with actual values
- [ ] Success metrics verified

### 6. Cycle Plan Completion
- [ ] Frontmatter updated
- [ ] Success metrics verified with actual values
- [ ] Deviations documented

### 7. Cycle Retrospective
- [ ] "What Went Well" section completed
- [ ] "Deviations from Plan" section completed
- [ ] "Learnings" section completed

---

## DoR Preparation Notes

### 1. Feature PRD Readiness
- [x] PRD exists — [[Train Improvements PRD]] v2, stage: delivered
- [x] PRD stage is `delivered` (continuation cycle — threshold: FRI ≥ 11/35)
- [x] FRI scored — 28/35 (exceeds continuation threshold of 11/35)
- [x] Technical Review passed — [[Three Amigos Review 2026-02-22 Train Polish and Merge Down]] (PASS, TASM 30/35)

### 2. Backlog Readiness
- [x] PBIs defined — [[PBI-TOT-010 Train Hub]], [[PBI-TOT-011 Train UX Sprint]]
- [x] PBIs chunked into 5 increments — vertical slices with end-to-end value
- [x] Dependencies mapped — Inc 1→4→5 chain, Inc 2+3 independent
- [x] Priority ranked — Hub first (highest demand), then UX improvements, types, integration last

### 3. Cycle Plan Document
- [x] Cycle document exists with standard frontmatter
- [x] Situation assessment written (post-Cycle 23 + amendments, 3,976 tests)
- [x] Cycle goals defined (5 goals)
- [x] Proposed increments specified (5 increments with scope, LOC, tests)
- [x] Dependency graph drawn
- [x] Risks identified (6 risks)
- [x] Success metrics defined
- [x] Deferred items documented (11 items)

### 4. Increment Readiness
- [x] All 5 increments have: scope statement, AC, test intent, documentation intent, architecture seams, estimates

### 5. Quality Baseline
- [x] Build pipeline green — `npm test` passes (3,976 tests, 161 suites)
- [x] No critical bugs open — post-delivery amendments resolved all known issues
- [x] Previous cycle closed — Cycle 23 retrospective completed, improvement backlog captured

### 6. Pre-Cycle Completion
- [x] Pre-cycle work documented — merge connector fix, timeline node click fix
- [x] Inbox signals reviewed — 28 vault items triaged (4 addressed, 7 deferred with rationale)

---

## Related
- PRD: [[Train Improvements PRD]], [[Train of Thoughts PRD]]
- Review: [[Three Amigos Review 2026-02-22 Train Polish and Merge Down]]
- Prior Cycles: [[Cycle 22 - Train Polish and Management]], [[Cycle 23 - Merge Down and Detail Restructure]]
- PBIs: [[PBI-TOT-010 Train Hub]], [[PBI-TOT-011 Train UX Sprint]]
- Inbox: [[We need a dedicated Train Hub]], [[The session complete view needs to be adjusted when coming from a train]], [[I want to enrich the frontmatter of train-of-thought notes on the detail page]], [[I want to choose a type of train at the beginning of a new one]]
