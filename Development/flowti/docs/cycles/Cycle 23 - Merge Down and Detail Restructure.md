---
type: DevelopmentCycle
feature: "[[Train Improvements PRD]]"
stage: in-progress
cycle: 23
date_planned: 2026-02-22
date_completed:
pbis:
  - "[[PBI-TOT-009 Merge Down Direction]]"
bugs:
  - "prompt() does not work in Electron — replaced with InputModal (pre-cycle fix)"
  - "Wikilinks used thought.title instead of file basename — broken links (pre-cycle fix)"
bugs_fixed_precycle:
  - "Rename modal prompt() replaced with InputModal"
  - "buildNavLinks() and generateTrainSummary() use path basename for wikilinks"
tech_debt: []
estimated_increments: 5
actual_increments:
estimated_tests: 80
actual_tests:
total_tests_after:
total_test_files_after:
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
| New tests | ~80 | |
| Source LOC | ~200 | |
| Post-cycle total tests | ~4,016 | |
| Post-cycle test suites | ~163 | |
| New TrainService APIs | 1 | |

---

## Deferred Items

| Item | Rationale | Target |
|------|-----------|--------|
| Merge-down for sub-branches into parent branches | Only main chain targeted | Future |
| Auto-merge on completeTrain() | Changes completion semantics | Future |
| Train types at creation | Needs design session | Cycle 24+ |

---

## Related
- PRD: [[Train Improvements PRD]], [[Train of Thoughts PRD]]
- Prior Cycles: [[Cycle 22 - Train Polish and Management]], [[Cycle 20 - Train Enhancements]]
