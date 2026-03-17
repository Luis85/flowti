---
type: ThreeAmigosReview
date: 2026-02-22
feature: "[[Train Improvements PRD]]"
scope: Cycles 22-23 delivery (Train Polish + Merge Down + Detail View Restructure)
verdict: pass
fri_before: 25
fri_after: 28
participants:
  - Business (Product Owner)
  - Development (Technical Architect)
  - QA (Test Lead)
tags:
  - review
  - train-of-thought
  - merge
---

# Three Amigos Review: Train Polish & Merge Down — Cycles 22-23 Delivery

**Date:** 2026-02-22
**Scope:** Cycles 22-23 complete — Train rename, delete, maxThoughts enforcement, merge-down auto-target, detail view restructure, capture modal merge-down direction, canvas sync improvements, UI polish
**Previous Review:** N/A for Train Improvements (greenfield increments on existing Train domain)
**Current State:** FRI 28/35, 3,952 tests (161 suites), 12 FRs delivered (FR-01 through FR-12), 4/4 PBIs delivered

---

## Verdict: PASS

All three perspectives agree: the Train Polish and Merge Down features are **delivered and production-ready**. Cycle 22 addressed train lifecycle management (rename, delete, maxThoughts fix) and Cycle 23 added merge-down convergence with a significant detail view UX restructure. Combined delivery: 5 new FRs (FR-08 through FR-12), 2 PBIs (PBI-TOT-008, PBI-TOT-009), ~300 source LOC, 42 new tests (net +16 after 9 keyboard nav tests removed + test consolidation). Pre-cycle bug fixes caught 3 issues before they affected delivery.

---

## Business Perspective (Product Owner)

### Delivered Value Assessment

| Metric | Cycle 22 | Cycle 23 | Combined |
|--------|----------|----------|----------|
| PBIs delivered | 1 (PBI-TOT-008) | 1 (PBI-TOT-009) | 2/2 |
| FRs delivered | 3 (FR-08, FR-09, FR-10) | 2 (FR-11, FR-12) | 5 new FRs |
| Tests added | +16 net | +16 net (26 added, -9 removed, -1 consolidated) | +32 net |
| Pre-cycle bugs fixed | 0 | 3 (InputModal, wikilinks, canvas sync) | 3 |
| FRI score | — | 25 → 28/35 | +3 |

**Strengths:**
- **Train rename and delete** complete the lifecycle — users can now manage trains fully without manual file operations
- **Merge-down auto-target** eliminates the most tedious merge workflow: finding the right target. `findMergeDownTarget()` does it automatically.
- **Capture modal merge-down direction** keeps users in flow — no need to leave the capture loop to merge
- **Detail view restructure** puts controls first, breadcrumb last — respects the "most actionable first" principle
- **Pre-cycle bug fixes** prevented 3 user-facing issues (Electron prompt() failure, broken wikilinks, stale canvas)

**Gaps identified (deferred):**
1. Merge-down for sub-branches into parent branches (only main chain)
2. Auto-merge all branches on train completion
3. Train types at creation time (needs design session)

---

## Development Perspective (Technical Architect)

### Architecture Assessment

| Area | Rating | Notes |
|------|--------|-------|
| `findMergeDownTarget()` algorithm | Excellent | Pure graph traversal: walk backward to branch origin → find next main-chain node. 11 unit tests covering deep/sub-branch/edge cases. |
| UI restructure | Good | Clean reorder of render sections. Nav bar with 3-column layout (Prev | Controls | Next). Canvas callout replaces header button. |
| Capture modal merge-down | Excellent | "merge-down" is UI-only string — intercepted in `onMergeDown` callback, never reaches `ThoughtDirection` type. Clean separation. |
| Canvas sync improvements | Good | 4 new event listeners (completed/paused/resumed/renamed) ensure canvas stays current. Caught as pre-cycle bug. |
| Tab cycling extension | Good | 3-option cycle (next → branch → merge-down) is natural extension of existing 2-option toggle. |

**Architecture observations:**
1. **`findMergeDownTarget()` is a pure function** with no side effects — testable in isolation, no Obsidian deps
2. **"merge-down" as UI-only value** is the right pattern — prevents type pollution in the domain layer
3. **Detail view layout is hardcoded render order** — if more view customization is needed, consider a declarative section registry
4. **TrainMainView** at 686 LOC is approaching extraction threshold — monitor for panel extraction opportunity
5. **No new events added** — both cycles reuse existing `train.branch.merged` event, which shows good event model design

**Pre-cycle bug fixes (Cycle 23):**
- `prompt()` → `InputModal`: Electron does not support `window.prompt()`. All modals now use Obsidian's `Modal` class with `InputModal` wrapper.
- Wikilink paths: `buildNavLinks()` and `generateTrainSummary()` were using `thought.title` instead of file basename, creating broken wikilinks.
- Canvas sync listeners: `TrainCanvasSyncService` only listened to `train.thought.added` and merge events. Added `train.completed`, `train.paused`, `train.resumed`, `train.renamed` listeners.

---

## QA Perspective (Test Lead)

### Coverage Summary

| Area | Tests | Notes |
|------|-------|-------|
| Train rename/delete (Cycle 22) | 16 | Service + UI tests |
| `findMergeDownTarget()` unit (Cycle 23) | 11 | Happy path, deep branch, sub-branch, no target, main chain source |
| Canvas sync new listeners (Cycle 23) | 4 | completed/paused/resumed/renamed triggers |
| Flow 22 integration (Cycle 23) | 11 | Merge-down end-to-end |
| TrainCaptureModal (updated) | 26 | Including merge-down direction, timer, keyboard nav |
| **Total new** | **42** | **Net +16 after removals** |

### Test Progression

| Milestone | Tests | Suites |
|-----------|-------|--------|
| Pre-Cycle 22 | 3,920 | 159 |
| Post-Cycle 22 | 3,936 | 160 |
| Post-Cycle 23 | 3,952 | 161 |
| **Delta** | **+32 net** | **+2** |

### Test Deviations

**Cycle 22:** 30 estimated → 16 actual. Rename and delete service methods are thin wrappers; fewer edge cases than anticipated.

**Cycle 23:** 80 estimated → 26 actual (net +16). Three factors:
1. Inc 4 merged into Inc 2 — merge-down button implemented as part of layout restructure
2. Keyboard navigation removed per user request — 9 tests deleted, 6 planned tests never written
3. UI polish round caused 1 test consolidation

### Coverage Gaps

1. **TrainMainView rendering tests** (Medium): No dedicated rendering tests for the restructured layout. Verified manually + indirectly through flow tests.
2. **Merge-down from capture modal** (Low): Tested at unit level (callback called) but not full integration (addThought + mergeBranch sequence). Covered in Flow 22.

---

## Consolidated Observations

### OBS-1: TrainMainView Approaching Extraction Threshold (686 LOC)
**Owner:** Technical Architect
**Priority:** Low-Medium
**Action:** Monitor. If more sections are added, consider extracting panel components (like SessionWorkspaceView's panel extraction pattern). Current size is manageable.

### OBS-2: Keyboard Navigation Removed — Design Decision
**Owner:** Business
**Priority:** Informational
**Action:** Keyboard navigation (arrow keys) was removed per user request. Tab-to-cycle direction is retained as the only keyboard shortcut in the capture modal. Obsidian's built-in view navigation doesn't support custom keyboard shortcuts in ItemView. Commands + Tab cycling are sufficient.

### OBS-3: Pre-Cycle Bug Fixes Validate Continuous Testing
**Owner:** QA
**Priority:** Informational
**Action:** The 3 pre-cycle bug fixes (InputModal, wikilinks, canvas sync) were discovered during manual testing between cycles. This validates the practice of testing in Obsidian between cycles, not just relying on automated tests.

---

## Action Items

| # | Action | Owner | Target | Status |
|---|--------|-------|--------|--------|
| 1 | Add TrainMainView rendering tests for new layout | QA | Next quality cycle | Open |
| 2 | Monitor TrainMainView LOC growth (686) | Architect | Ongoing | Open |
| 3 | Design session for train types at creation | Business + Dev | Cycle 24+ | Open |
| 4 | Consider merge-down for sub-branches | Business | Future | Open |

---

## Metrics Snapshot

| Metric | Pre-Cycle 22 | Post-Cycle 23 | Delta |
|--------|-------------|---------------|-------|
| Tests total | 3,920 | 3,952 | +32 |
| Test suites | 159 | 161 | +2 |
| Train FRs | 7 | 12 | +5 |
| Train PBIs | 5 | 9 | +4 |
| FRI score | 25/35 | 28/35 | +3 |
| TrainService LOC | ~650 | ~710 | +60 |
| TrainMainView LOC | ~620 | ~686 | +66 |

---

## TASM Scoring Summary

```yaml
tasm:
  product_value_clarity: 4  # Merge-down solves real pain, rename/delete complete lifecycle. -1: no train types yet
  architectural_integrity: 5  # Pure findMergeDownTarget(), UI-only merge-down, clean event model, no new domain types
  event_discipline: 4  # Reuses existing train.branch.merged (good). Canvas sync listeners added. -1: no new events needed but listener gaps caught late
  data_model_integrity: 4  # findMergeDownTarget algorithm clean. trainMaxThoughts enforced. -1: no data model extensions
  ux_flow_quality: 5  # Layout restructure, merge-down in modal + detail, diamond head dot, breadcrumb path heading, responsive controls
  performance_scalability: 4  # Canvas sync debounced, render debounced. -1: no large-train performance testing
  documentation_discipline: 4  # Cycle docs complete, PRD updated, PBIs created. -1: no new flow docs for merge-down
  total: 30
  max: 35
  health_level: excellent
```

---

## Related

- [[Train Improvements PRD]] (v2, FRI 28/35, stage: delivered)
- [[Cycle 22 - Train Polish and Management]] (delivered, 3 increments)
- [[Cycle 23 - Merge Down and Detail Restructure]] (delivered, 4 increments)
- [[PBI-TOT-008 Train Polish and Management]] (stage: done)
- [[PBI-TOT-009 Merge Down Direction]] (stage: done)
- [[Three Amigos Review 2026-02-22 Canvas Integration]] — same-day review (different feature)
