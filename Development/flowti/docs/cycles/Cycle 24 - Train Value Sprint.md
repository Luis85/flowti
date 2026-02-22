---
type: DevelopmentCycle
feature: "[[Train Improvements PRD]]"
stage: planned
cycle: 24
date_planned: 2026-02-22
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

### Pre-Cycle State (post-Cycle 23 + bug fixes)

**Plugin health:**
- 3,954 tests passing, 161 test suites, 32 skipped
- Build status: green
- Pre-cycle bug fixes applied: merge connector visualization, timeline node opens detail view

**Train domain status:**
- Domain: ~1,800 LOC (TrainService 710, TrainCanvasWriter 543, TrainCanvasSyncService 124, TrainSummaryWriter 214, helpers 12)
- UI: ~2,300 LOC (TrainMainView 686, TrainTimelineSidebar 490, TrainCaptureModal 271, TrainHistoryPanel ~171, panels ~180, subscriptions ~450)
- FRI: 28/35 (Train Improvements PRD v2)
- 14 events, 23 public service methods, 11 UI components

---

## Cycle Goals

1. **Train Hub** — Dedicated BaseHubView for managing all trains
2. **Jump-to-End & Smart Resume** — Quick navigation + resume decision modal
3. **Frontmatter Enrichment** — Property editor on thought detail
4. **Train Types at Creation** — Type selection with type-specific config
5. **Train Closure Context + Integration Tests**

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
- Train Hub as full BaseHubView with split layout (start simple — single list view)
- Cyclical trains / multiple concurrent train management
- AI-driven synthesis

---

## Increments

### Inc 1: Train Hub

**Goal:** Dedicated BaseHubView for managing all trains from one central place.

**Design:**
- Extends `BaseHubView<TrainHubPage>` with pages: "dashboard" | "active" | "history"
- Dashboard: active train card (if any) + train stats (total, completed, avg thoughts, avg duration)
- Active tab: currently running/paused trains with Resume/Pause/Open/Delete actions
- History tab: completed trains with Open/Delete actions, searchable by title
- Command: `flowti:open-train-hub` — "Open Train Hub"
- VIEW_TYPE: `"flowti-train-hub"` in `src/domain/hub/types.ts`

| File | Purpose | Est. LOC |
|------|---------|----------|
| `src/ui/train/TrainHubView.ts` | BaseHubView subclass | ~250 |
| `src/domain/hub/types.ts` | Add VIEW_TYPE_TRAIN_HUB | ~2 |
| `src/main.ts` | Register view + command | ~15 |
| `tests/ui/train/TrainHubView.test.ts` | 15 tests | ~200 |

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
- **Jump to end button:** In TrainMainView nav bar, right side. Emits `train.thought.activated` with the head node ID. Button label: fast-forward icon. Visible only when active thought is not the head.
- **Smart resume modal:** When `resumeTrain()` is called and the persisted `activeThoughtId` is NOT the head node, show a modal: "You're on '{activeNode.title}' — not the latest thought." Options: "Jump to end" (navigates to head, continue adding next), "Branch from here" (stays on current node, next thought branches), "Stay here" (dismisses modal).
- `getHeadNode(trainId)` helper on TrainService: returns the last node on main chain.

| File | Purpose | Est. LOC |
|------|---------|----------|
| `src/domain/train/TrainService.ts` | `getHeadNode(trainId)` public method | ~15 |
| `src/ui/train/TrainMainView.ts` | Jump-to-end button in nav bar | ~20 |
| `src/ui/train/TrainResumeModal.ts` | Smart resume modal (3 options) | ~80 |
| `src/main.ts` | Wire resume modal in `handleTrainResume()` | ~25 |
| `tests/domain/train/trainService.test.ts` | `getHeadNode()` tests | ~20 |
| `tests/ui/train/TrainResumeModal.test.ts` | 8 tests | ~100 |

**AC:**
- [ ] "Jump to end" button appears when not on head node
- [ ] Clicking it navigates to the head thought
- [ ] On resume, if not on head, modal appears with 3 options
- [ ] "Jump to end" moves to head and continues capture flow
- [ ] "Branch from here" stays on current node and next thought creates a branch
- [ ] "Stay here" dismisses without action
- [ ] `npm test` passes

---

### Inc 3: Frontmatter Enrichment on Detail Page

**Goal:** Inline property editor on the thought detail section in TrainMainView. Users can add/edit frontmatter properties without opening the note file.

**Design:**
- New section in `renderThoughtDetail()`: "Properties" collapsible section
- Read existing frontmatter from the thought file via `metadataCache`
- Display key-value pairs with inline edit (click to edit)
- "Add property" button adds a new key-value row
- On edit/add, write updated frontmatter to the file via `processFrontMatter()`
- Built-in properties (type, train, direction, etc.) are read-only

| File | Purpose | Est. LOC |
|------|---------|----------|
| `src/ui/train/TrainPropertyEditor.ts` | Property editor component | ~150 |
| `src/ui/train/TrainMainView.ts` | Wire into `renderThoughtDetail()` | ~10 |
| `tests/ui/train/TrainPropertyEditor.test.ts` | 10 tests | ~120 |

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

**Goal:** Allow choosing a train type when starting a new train. Types have default duration and closure template.

**Design:**
- Built-in types: `brainstorm` (default 15min), `research` (25min), `decision` (10min), `free-form` (no timer)
- `TrainTypeConfig`: `{ id, label, icon, defaultDuration, closureTemplate? }`
- `BUILT_IN_TRAIN_TYPES` constant array
- Start command opens type picker (dropdown or quick-select modal) before creating train
- Type stored on `TrainState.trainType` field (optional, backward compat)
- Type badge shown in TrainMainView header and Train Hub list
- Type-specific closure template passed to session closure overlay

| File | Purpose | Est. LOC |
|------|---------|----------|
| `src/domain/train/types.ts` | `TrainTypeConfig`, `BUILT_IN_TRAIN_TYPES`, add `trainType` to TrainState | ~40 |
| `src/ui/train/TrainTypePickerModal.ts` | Type selection modal | ~60 |
| `src/domain/train/TrainService.ts` | Accept `trainType` in `startTrain()` | ~10 |
| `src/main.ts` | Wire type picker before train start | ~15 |
| `src/ui/train/TrainMainView.ts` | Type badge in header | ~5 |
| `tests/domain/train/trainTypes.test.ts` | 8 tests | ~80 |
| `tests/ui/train/TrainTypePickerModal.test.ts` | 6 tests | ~60 |

**AC:**
- [ ] Type picker shown before train starts
- [ ] 4 built-in types with icons and default durations
- [ ] Selected type stored on TrainState
- [ ] Type badge visible in detail view header
- [ ] Type-specific default duration applied to timer
- [ ] Type visible in Train Hub list
- [ ] `npm test` passes

---

### Inc 5: Train Closure Context + Integration Tests

**Goal:** Inject train graph context into the session closure overlay and add integration tests for all new behaviors.

**Design:**
- When closure overlay renders for a train session, show train stats section: thought count, branch count, merge count, duration, main chain length
- `computeTrainClosureContext(train)` pure function → `{ thoughtCount, branchCount, mergeCount, mainChainLength, duration }`
- Integration test file: `tests/flows/23-TrainHub.test.ts`

| File | Purpose | Est. LOC |
|------|---------|----------|
| `src/domain/train/helpers.ts` | `computeTrainClosureContext()` pure function | ~20 |
| `src/ui/session/SessionClosureOverlay.ts` | Render train context section when session has trainId | ~25 |
| `tests/flows/23-TrainHub.test.ts` | 15 integration tests | ~250 |

**AC:**
- [ ] Closure overlay shows train stats when session is a train session
- [ ] Stats match actual train graph state
- [ ] All 15 integration scenarios pass
- [ ] No regression on existing tests
- [ ] `npm test` passes

---

## Dependency Graph

```
Inc 1 (Train Hub)           ──→ Inc 4 (type badge in Hub)
Inc 2 (Jump/Resume modal)   ──  (independent)
Inc 3 (Property editor)     ──  (independent)
Inc 4 (Train types)         ──→ Inc 5 (type-specific closure)

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
| Resume modal interrupts flow | Medium | "Don't show again" option, or skip when on head node |
| `processFrontMatter()` race with note sync | Medium | Debounce writes, check lastSyncedContent |
| Train type registry grows complex | Low | Built-in types only, no custom types in v1 |
| BaseHubView overhead for simple list | Low | Use minimal tab set, no split layout needed |

---

## Success Metrics

| Metric | Target |
|--------|--------|
| New tests | ~80 |
| Source LOC | ~400 |
| Post-cycle total tests | ~4,034 |
| Post-cycle test suites | ~166 |
| New TrainService APIs | 1 (getHeadNode) |
| New views | 1 (TrainHubView) |
| New events | 0 (reuses existing) |
| FRI score | 28 → 31/35 |

---

## Deferred Items

| Item | Rationale | Target |
|------|-----------|--------|
| Custom train type creation | Built-in types sufficient for v1 | Future |
| Train Hub split layout (master/detail) | Simple list is enough for now | Future |
| Cyclical trains | Novel concept, needs design session | Future |
| Multiple concurrent train management | Complex, needs UX design | Future |
| AI-driven train synthesis | Blocked on AI infrastructure | Future |

---

## Definition of Done (Cycle)

### 1. All Increments Completed
- [ ] Each increment satisfies its own acceptance criteria
- [ ] No increment left in partial state
- [ ] Deferred items documented with rationale

### 2. Build & Test Quality
- [ ] `npm test` passes
- [ ] `npm run check` passes (tsc + eslint clean)
- [ ] No test regressions on existing tests
- [ ] Test count deviation documented

### 3. Three Amigos Review
- [ ] Cycle-level review conducted
- [ ] All three perspectives represented
- [ ] TASM scores recorded
- [ ] Observations documented

### 4. PRD & Backlog Updates
- [ ] PRD updated — Train Improvements PRD v3
- [ ] PBIs updated
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

## Related
- PRD: [[Train Improvements PRD]], [[Train of Thoughts PRD]]
- Prior Cycles: [[Cycle 22 - Train Polish and Management]], [[Cycle 23 - Merge Down and Detail Restructure]]
- PBIs: [[PBI-TOT-010 Train Hub]], [[PBI-TOT-011 Train UX Sprint]]
- Inbox: [[We need a dedicated Train Hub]], [[The session complete view needs to be adjusted when coming from a train]], [[I want to enrich the frontmatter of train-of-thought notes on the detail page]], [[I want to choose a type of train at the beginning of a new one]]
