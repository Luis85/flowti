---
type: ProductBacklogItem
feature: "[[Train Improvements PRD]]"
stage: done
priority: medium
effort: medium
dependencies:
  - "[[PBI-TOT-004 Branch Merge]]"
  - "[[PBI-TOT-008 Train Polish and Management]]"
user_story: "[[Train Improvements]]"
delivered_in: "[[Cycle 23 - Merge Down and Detail Restructure]]"
note: "Merge-down auto-target + detail view layout restructure. 4 increments."
tags:
  - backlog
  - train-of-thought
  - merge
---

## User Story — Problem Space

As a Train of Thoughts user working on a branch, I want to quickly merge the branch endpoint back down into the main chain — both from the capture modal during flow and from the detail view when reviewing — so that I can converge divergent thinking without breaking my capture rhythm. I also want the detail view to prioritize actionable controls at the top, with the breadcrumb (which grows fast) at the bottom.

### User Pains

- When on the last thought of a branch, there is no way to merge back from the capture modal
- The existing "Merge into..." button requires manual target selection even when the target is unambiguous
- No way to combine "add thought" and "merge" in one action
- Detail view puts nav buttons in the middle and controls at the bottom — most actionable elements should be first
- Breadcrumb grows quickly in a session and dominates the top

### User Needs

- "Merge down" direction option in capture modal when on a branch endpoint
- One-click "Merge down" button in detail view that auto-selects the default target
- Restructured detail view: nav+controls first, canvas callout, breadcrumb last

## Solution Statement

### Functional Requirements

- [x] FR-11: `findMergeDownTarget(trainId, sourceId)` — pure graph traversal determining best merge target for branch endpoint
- [x] FR-12: Detail View Layout Restructure — Header → Nav+Controls → Stats → Detail → Canvas callout → Content preview → Branches → Merge → Breadcrumb

### Key Design Decisions

- **"merge-down" is UI-only** — the string never reaches `ThoughtDirection` type. Intercepted in `onMergeDown` callback.
- **`findMergeDownTarget()` is a pure function** — walks backward from source to find branch origin (first main-chain ancestor), then returns the next main-chain node.
- **Tab key cycles 3 options** — next → branch → merge-down (when available) → next.
- **No new events** — merge-down uses existing `train.branch.merged` event.

### Delivered

- **Cycle 23** — 4 increments (Inc 4 merged into Inc 2), 26 tests added (net +16 after 9 keyboard nav removed), 3,952 total tests post-delivery
- Pre-cycle bug fixes: InputModal for rename, wikilinks use file basename, canvas sync on completion/pause/resume/rename
- Mid-cycle UI polish: nav bar 3-column layout, diamond head dot, "Path" breadcrumb heading, "Start" indicator, modal title shows previous thought, counter in button row

## Related

- [[Train Improvements PRD]] (v2, FRI 28/35)
- [[Cycle 23 - Merge Down and Detail Restructure]]
- [[PBI-TOT-008 Train Polish and Management]] — prior PBI
- [[Three Amigos Review 2026-02-22 Train Polish and Merge Down]]
