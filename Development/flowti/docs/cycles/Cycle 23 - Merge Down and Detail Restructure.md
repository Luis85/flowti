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
bugs_fixed_precycle:
  - "Rename modal prompt() replaced with InputModal"
  - "buildNavLinks() and generateTrainSummary() use path basename for wikilinks"
  - "TrainCanvasSyncService now listens to train.completed/paused/resumed/renamed"
tech_debt: []
estimated_increments: 5
actual_increments: 4
estimated_tests: 80
actual_tests: 26
total_tests_after: 3952
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
*(See plan file for full details)*

### Inc 2: Detail View Layout Restructure
*(See plan file for full details)*

### Inc 3: Capture Modal "Merge Down" Direction
*(See plan file for full details)*

### Inc 4: Detail View "Merge Down" Button
*(See plan file for full details)*

### Inc 5: Integration Tests
*(See plan file for full details)*

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
| Post-cycle total tests | ~4,016 | 3,952 |
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
- [x] `npm test` passes — 3,952 tests, 161 suites, 32 skipped
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

### Next Cycle Inputs
- Train types at creation time
- BaseActionView extraction (if 3rd action view built)

---

## Related
- PRD: [[Train Improvements PRD]], [[Train of Thoughts PRD]]
- Review: [[Three Amigos Review 2026-02-22 Train Polish and Merge Down]]
- PBI: [[PBI-TOT-009 Merge Down Direction]]
- Prior Cycles: [[Cycle 22 - Train Polish and Management]], [[Cycle 20 - Train Enhancements]]
