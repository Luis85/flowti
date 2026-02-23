---
type: DevelopmentCycle
feature: "[[Train Improvements PRD]]"
stage: delivered
cycle: 23
date_planned: 2026-02-22
date_completed: 2026-02-22
pbis:
  - "[[PBI-TOT-009 Merge Down Direction]]"
bugs:
  - "prompt() does not work in Electron — replaced with InputModal (pre-cycle fix)"
  - "Wikilinks used thought.title instead of file basename — broken links (pre-cycle fix)"
  - "Canvas not synced on train completion/pause/resume/rename — status annotation stale (pre-cycle fix)"
  - "Sidebar toggle button did nothing when Train Timeline was visible (post-delivery fix)"
  - "Merge-down added thought to branch instead of main chain (post-delivery fix)"
  - "Merge-down Case 1 created duplicate 'next' relations from target node (post-delivery fix)"
bugs_fixed_precycle:
  - "Rename modal prompt() replaced with InputModal"
  - "buildNavLinks() and generateTrainSummary() use path basename for wikilinks"
  - "TrainCanvasSyncService now listens to train.completed/paused/resumed/renamed"
tech_debt: []
estimated_increments: 5
actual_increments: 4
estimated_tests: 80
actual_tests: 26
total_tests_after: 3976
total_test_files_after: 161
---

# Cycle 23: Merge Down & Detail View Restructure

## Cycle Overview

**User Story:**

> As a Train of Thoughts user working on a branch, I want to quickly merge the branch endpoint back down into the main chain — both from the capture modal during flow and from the detail view when reviewing — so that I can converge divergent thinking without breaking my capture rhythm. I also want the detail view to prioritize actionable controls at the top, with the breadcrumb (which grows fast) at the bottom.

**User Pains:**
- When on the last thought of a branch during serial capture, there is no way to merge back into the main chain from the modal — the user must finish, navigate to TrainMainView, find the branch endpoint, click "Merge into...", and manually select a target
- The existing "Merge into..." button requires manual target selection even when the obvious target is unambiguous
- No way to combine "add thought" and "merge" in one action
- Tab-to-toggle direction only cycles next/branch — no merge option reachable via keyboard
- Detail view puts nav buttons in the middle and controls at the bottom — the most actionable elements should be first
- Breadcrumb grows quickly in a session and shouldn't dominate the top

**User Needs:**
- "Merge down" direction option in capture modal when on a branch endpoint
- One-click "Merge down" button in detail view that auto-selects the default target
- Restructured detail view: nav+controls first, canvas callout, breadcrumb last

---

## Situation Assessment

### Pre-Cycle State (post-Cycle 22 + bug fixes)

**Plugin health:**
- 3,936 tests passing, 160 test suites, 32 skipped
- Build status: green
- Pre-cycle bug fixes applied: InputModal for rename, wikilinks use file basename

**Train domain status:**
- Domain: ~1,700 LOC (TrainService 710, TrainCanvasWriter 543, TrainCanvasSyncService 124, TrainSummaryWriter ~206, helpers 12)
- UI: ~2,200 LOC (TrainMainView 619, TrainTimelineSidebar 472, TrainCaptureModal 245, TrainHistoryPanel ~171, panels ~180, subscriptions ~450)
- Merge system: `mergeBranch()`, `undoMerge()`, `getMerges()`, main-chain protection, cycle detection
- Canvas: 7 roles, groups, annotations, edge styling with merge edges (blue, horizontal)

---

## Cycle Goals

1. **findMergeDownTarget() helper** — Pure function determining the best merge target for a branch endpoint
2. **Detail view layout restructure** — Nav+controls first, canvas callout, breadcrumb last
3. **Capture modal "Merge down" direction** — Third dropdown option, triggers add-thought + auto-merge
4. **Detail view "Merge down" button** — One-click button with auto-selected target
5. **Integration tests** — Flow 22 covering merge-down + layout

---

## Scope

### In Scope
- `TrainService.findMergeDownTarget(trainId, sourceId)`: returns targetId or null
- `TrainMainView.render()`: restructure section order
- `TrainCaptureModal`: "Merge down" dropdown option + `onMergeDown` callback
- `main.ts openTrainModal()`: detect branch endpoint, implement `onMergeDown` handler
- `TrainMainView.renderMergeSection()`: "Merge down" button with auto-target
- Canvas callout section in detail view
- Tab key cycling with 3 directions
- Integration tests for all new behaviors

### Out of Scope
- New `ThoughtDirection` value — "merge-down" is UI-only
- Merge-down for sub-branches into parent branches (only main chain)
- Auto-merge-down on train completion
- Canvas preview of merge edge before committing

---

## Increments

### Inc 1: findMergeDownTarget() Helper

**Goal:** Pure function determining the best merge target for a branch endpoint.

| Step | File | Purpose |
|------|------|---------|
| 1 | `src/domain/train/TrainService.ts` | `findMergeDownTarget(trainId, sourceId)` — walks backward from source through parent relations; at each "branch" edge, checks if the origin has a "next" child. Returns `{ targetId, originId }` or null. |
| 2 | `tests/domain/train/trainMerge.test.ts` | 12 tests: simple branch, deep branch, branch from head, main-chain rejection, root rejection, nonexistent, sub-branches, extended main chain, middle branch |

**Return type:** `{ targetId: string | null; originId: string } | null` — `targetId` is the existing merge target (or null if origin has no next), `originId` is the branch point.

**AC:**
- [x] Returns correct target for branch endpoints
- [x] Returns null for main-chain and root nodes
- [x] Handles sub-branches (returns nearest branch origin)
- [x] Returns originId even when no next exists (enables merge-down from branch endpoint at main chain head)
- [x] `npm test` passes

---

### Inc 2: Detail View Layout Restructure

**Goal:** Restructure TrainMainView: nav+controls first, canvas callout section, breadcrumb last. Merge-down button integrated.

| Step | File | Purpose |
|------|------|---------|
| 1 | `src/ui/train/TrainMainView.ts` | Reorder `render()` sections: header → inline controls (Pause/Complete/Resume) → nav bar (Back/Next/Add/Merge Down) → canvas callout → thought detail → breadcrumb |
| 2 | `src/ui/train/TrainMainView.ts` | Merge-down button in nav bar: emits `ui.startTrain` with `mergeDown: true` flag to open capture modal pre-set to merge-down direction |

**Merge-down in detail view:** Clicking "Merge down" in the nav bar opens the capture modal with direction pre-selected to "merge-down". User enters a thought title, and the system adds the thought + auto-merges.

**AC:**
- [x] Nav bar at top with context-aware right action (Merge Down / Next / Add Thought)
- [x] Merge-down button opens capture modal (not direct merge)
- [x] Canvas callout section between controls and detail
- [x] Breadcrumb at bottom
- [x] `npm test` passes

---

### Inc 3: Capture Modal "Merge Down" Direction

**Goal:** Third dropdown option in direction selector, Tab-cycleable, triggers add-thought + auto-merge.

| Step | File | Purpose |
|------|------|---------|
| 1 | `src/ui/train/TrainCaptureModal.ts` | Added `isBranchEndpoint`, `onMergeDown`, `defaultMergeDown` options. "Merge down ↓" added to dropdown when `isBranchEndpoint`. Tab cycles: next → branch → merge-down. |
| 2 | `src/main.ts` | `openTrainModal()` detects branch endpoint via `findMergeDownTarget()`, wires `onMergeDown` callback: adds thought then merges. Two code paths: with existing target (merge into it) and without (create next from origin, then merge). |
| 3 | `tests/flows/22-TrainMergeDown.test.ts` | 11 integration tests covering findMergeDownTarget + merge-down action + event sequencing |

**AC:**
- [x] "Merge down ↓" appears in dropdown when on branch endpoint
- [x] Tab cycles through next/branch/merge-down
- [x] Submitting with merge-down creates thought + auto-merges
- [x] Works both with and without existing merge target on main chain
- [x] `npm test` passes

---

### Inc 4: Detail View "Merge Down" Button *(merged into Inc 2)*

Absorbed into Inc 2. The merge-down button in the detail view nav bar was implemented as part of the layout restructure.

---

### Inc 5: Integration Tests

**Goal:** Flow 22 covering merge-down scenarios end-to-end.

| Step | File | Purpose |
|------|------|---------|
| 1 | `tests/flows/22-TrainMergeDown.test.ts` | 11 tests: target detection (happy path, deep branch, head branch, sub-branch), merge-down action (add + merge), canvas sync on merge, multiple branches, event sequencing, target-changes-as-chain-grows |

**AC:**
- [x] All 11 integration tests pass
- [x] No regression on existing tests
- [x] `npm test` passes

---

## Dependency Graph

```
Inc 1 (findMergeDownTarget) ──┬──→ Inc 3 (Modal)
                              └──→ Inc 4 (Detail button)

Inc 2 (Layout restructure)   ──→ Inc 4 (merge-down button in new layout)

Inc 1 + Inc 2 + Inc 3 + Inc 4 ──→ Inc 5 (Integration)
```

**Execution order:**
- Phase A: Inc 1 + Inc 2 (parallel)
- Phase B: Inc 3 + Inc 4 (parallel)
- Phase C: Inc 5 (integration)

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| "merge-down" string leaks into ThoughtDirection | Medium | Intercepted in `onMergeDown` before `onSubmit`. |
| Wrong target for complex graphs | High | 12 dedicated tests covering deep/sub-branch cases. |
| Layout restructure breaks UI tests | Medium | Tests verify presence not order; update as needed. |
| Combined nav+controls too crowded | Low | flex-wrap for responsive layout. |

---

## Success Metrics

| Metric | Target | Actual |
|--------|--------|--------|
| New tests | ~80 | 26 (+11 merge, +4 canvasSync, +11 flow) |
| Removed tests | 0 | -9 (keyboard nav removed by request) |
| Post-cycle total tests | ~4,016 | 3,976 (3,952 at delivery + 24 post-delivery) |
| Post-cycle test suites | ~163 | 161 |
| New TrainService APIs | 1 | 1 (findMergeDownTarget) |

---

## Deferred Items

| Item | Rationale | Target |
|------|-----------|--------|
| Merge-down for sub-branches into parent branches | Only main chain targeted | Future |
| Auto-merge on completeTrain() | Changes completion semantics | Future |
| Train types at creation | Needs design session | Cycle 24+ |

---

## Definition of Done (Cycle)

### 1. All Increments Completed
- [x] Each increment satisfies its own acceptance criteria (4/4 delivered, Inc 4 merged into Inc 2)
- [x] No increment left in partial state
- [x] Deferred items documented with rationale

### 2. Build & Test Quality
- [x] `npm test` passes — 3,976 tests, 161 suites, 32 skipped (updated post-delivery)
- [x] `npm run check` passes (tsc + eslint clean)
- [x] No test regressions on existing 3,936 tests
- [x] Test count deviation documented — see §Deviations from Plan

### 3. Three Amigos Review
- [x] Cycle-level review conducted — see [[Three Amigos Review 2026-02-22 Train Polish and Merge Down]]
- [x] All three perspectives represented
- [x] TASM scores recorded (32/35)
- [x] Observations documented

### 4. PRD & Backlog Updates
- [x] PRD updated — [[Train Improvements PRD]] v2 (FRI 25→28, new FRs added)
- [x] PBI updated — [[PBI-TOT-009 Merge Down Direction]] (stage: done)
- [x] Event model current — no new events (uses existing `train.branch.merged`)

### 5. Documentation
- [x] Cycle plan updated with actual values
- [x] Success metrics verified
- [x] Pre-cycle bug fixes documented in frontmatter

### 6. Cycle Plan Completion
- [x] Frontmatter updated (actual_increments, actual_tests, total_tests_after, date_completed)
- [x] Success metrics verified with actual values
- [x] Deviations documented
- [x] Risks reviewed

### 7. Cycle Retrospective
- [x] "What Went Well" section completed
- [x] "Deviations from Plan" section completed
- [x] "Improvement Backlog" section completed
- [x] "Learnings" section completed

---

## Retrospective

### What Went Well
- **Pre-cycle bug fixes** caught 3 issues (prompt() in Electron, wikilink paths, canvas sync listeners) before they affected the main delivery
- **`findMergeDownTarget()` algorithm** was clean and testable — pure graph traversal with 11 unit tests + 11 integration tests
- **"merge-down" as UI-only concept** kept ThoughtDirection type clean — intercepted in `onMergeDown` callback, never reaches domain layer
- **Layout restructure** improved UX significantly: nav+controls at top, breadcrumb at bottom, canvas callout section
- **Responsive to mid-cycle feedback**: keyboard nav removal, merge UI redesign, sidebar toggle fix, content preview styling, modal title change — all addressed in-session
- **Tab cycling extended to 3 options** (next/branch/merge-down) was a natural evolution of the existing Tab toggle

### Deviations from Plan
- **Test count: 80 estimated → 26 actual (-54)**: Three factors:
  1. **Inc 4 merged into Inc 2** — the merge-down detail button was implemented as part of the layout restructure, not as a separate increment (0 separate tests)
  2. **Keyboard navigation removed** — 9 existing tests deleted per user request, and 6 planned tests for keyboard+merge-down never written
  3. **UI polish round** caused 1 test to be removed (banner test → replaced with heading test, net -1)
- **Actual increments: 5 planned → 4 delivered** — Inc 4 was absorbed into Inc 2 since the merge-down button was naturally placed during the layout restructure
- **Mid-cycle UI feedback round** — 8 additional UI changes were applied after the main increments (nav bar, callout, canvas button, sidebar toggle, breadcrumb, modal title, content preview, timeline head dot)

### Improvement Backlog
| Item | Classification | Target |
|------|---------------|--------|
| Merge-down for sub-branches into parent branches | Future PBI | Future |
| Auto-merge-all on completeTrain() | Future PBI | Future |
| Train types at creation | Next cycle input | Cycle 24+ |
| Canvas preview of merge edge before committing | Future PBI | Future |

### Learnings
- **UI-only direction values work well**: "merge-down" never touching `ThoughtDirection` type prevents type pollution. The `onMergeDown` callback pattern is reusable for other UI-only actions.
- **Canvas sync listeners must track ALL state mutations**: Adding 4 listeners (completed/paused/resumed/renamed) in the pre-cycle fix was a lesson — any event that changes data rendered in the canvas annotation needs a sync trigger.
- **Obsidian sidebar toggle behavior**: `rightSplit.collapsed` check is not enough — must also consider which leaf is active. The fix to always reveal (never collapse from the train button) is simpler and more predictable.
- **Mid-cycle UI feedback is valuable**: Rapid iteration on layout, modal UX, and visual indicators in the same session produces better results than planning them separately.

---

## Post-Delivery Amendments (2026-02-23)

Changes applied after initial delivery during user testing. All amendments maintain green build (3,976 tests, 161 suites).

### Bug Fixes

| Bug | Root Cause | Fix |
|-----|-----------|-----|
| Sidebar toggle did nothing when Train Timeline visible | `containerEl.hasClass("mod-active")` unreliable with single-tab sidebar | Replaced with `timelineLeaf.view?.containerEl?.isShown?.()` in `main.ts` |
| Merge-down added thought to old branch | `addThought("next", fromThoughtId)` from branch endpoint stays on branch | Restructured: Case 1 adds on branch then merges into target; Case 2 adds on main then merges branch into it |
| Case 1 merge-down created duplicate "next" relations | `addThought("next", targetId)` when target already has a "next" child | Changed Case 1: add thought on branch from endpoint, merge new thought into target, continue from target |
| Post-merge modal continued from branch instead of main | `openTrainModal` passed `newThought.id` (branch node) | Changed to pass `mergeDownInfo.targetId` (main chain) |
| Merge-down button/option still visible after branch already merged | `findMergeDownTarget()` didn't check for existing merge relations | Added forward walk from source through "next" edges; returns null if any node is already a merge source |

### Enhancements

| Enhancement | Files Changed |
|-------------|--------------|
| `findMergeDownTarget()` returns `{ targetId, originId }` instead of `string \| null` — enables merge-down on all branch endpoints (even when origin has no "next") | `TrainService.ts`, `TrainMainView.ts`, `main.ts`, 5 test files |
| Detail view "Merge down" button opens capture modal (via `ui.startTrain` with `mergeDown: true`) instead of calling `mergeBranch()` directly | `TrainMainView.ts`, `main.ts`, `events.ts` |
| `TrainCaptureModalOptions.defaultMergeDown` pre-selects merge-down direction | `TrainCaptureModal.ts`, `main.ts` |
| Back button moved to action row (outer left, `marginRight: auto`), styled as text button matching Next | `TrainCaptureModal.ts` |
| "Tab to cycle" hint positioned before dropdown (not after) | `TrainCaptureModal.ts` |
| Action row spans full modal width (`settingEl.style.width = "100%"`) | `TrainCaptureModal.ts` |
| Rename thought from capture modal (pencil icon in title row) | `TrainCaptureModal.ts`, `TrainService.ts`, `main.ts` |

### Merge-Down Flow (Final Design)

Two code paths based on `findMergeDownTarget()` result:

- **Case 1** (`targetId` exists): Add thought on branch (from endpoint) → merge new thought into main chain target → continue modal from target
- **Case 2** (`targetId` null, origin is head): Add thought as "next" from origin (extends main chain) → merge branch endpoint into new thought → continue modal from new thought

---

## Inbox & Feedback Loop

### Inbox Items Updated
| Item | Disposition |
|------|-------------|
| Merge branch back to main chain from modal | **Delivered** in Inc 3 (stage: delivered) |
| One-click merge-down in detail view | **Delivered** in Inc 2 (stage: delivered) |
| Detail view layout: controls first, breadcrumb last | **Delivered** in Inc 2 (stage: delivered) |

### New Feedback Captured
- Canvas not synced on train completion/pause/resume/rename — fixed as pre-cycle bug
- Merge UI hard to understand visually — addressed in layout restructure
- Keyboard navigation doesn't work in Obsidian views — feature removed, use commands instead
- Modal title should show thought context — addressed in UI polish round
- Timeline head node needs visual distinction — addressed with diamond dot
- Sidebar toggle should close when Train Timeline is open — fixed post-delivery
- Merge-down should always be available on branch endpoints — fixed post-delivery (enhanced `findMergeDownTarget`)
- Detail merge-down should open capture modal for a concluding thought — fixed post-delivery
- Back button should match Next button style — fixed post-delivery
- Merge-down from main should add to main chain, not old branch — fixed post-delivery (Case 1/2 restructure)

### Next Cycle Inputs
- Train types at creation time
- BaseActionView extraction (if 3rd action view built)

---

## Related
- PRD: [[Train Improvements PRD]], [[Train of Thoughts PRD]]
- Review: [[Three Amigos Review 2026-02-22 Train Polish and Merge Down]]
- PBI: [[PBI-TOT-009 Merge Down Direction]]
- Prior Cycles: [[Cycle 22 - Train Polish and Management]], [[Cycle 20 - Train Enhancements]]
