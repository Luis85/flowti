---
type: ProductBacklogItem
feature: "[[Train Improvements PRD]]"
stage: planned
priority: medium
effort: medium
dependencies:
  - "[[PBI-TOT-012 Train Closure Context]]"
user_story: "[[In trains, I also want a branch become the new main-line and also have the option to abandon or mark as stale]]"
planned_in: "[[Cycle 25 - Train Completion and Experience]]"
note: "Sub-branch merge-down, branch status labels, Train Hub filtering. Cycle 25 Inc 2-5."
tags:
  - backlog
  - train-of-thought
  - branch
  - hub
---

## User Story — Problem Space

As a Train of Thoughts user with complex branching trains, I want to merge sub-branches into their parent branches (not just the main chain), label branches by status (exploring/stale/promising), and filter/sort trains in the Hub so I can manage longer, more complex thought journeys effectively.

### User Pains

- Sub-branches can only merge down to the main chain, not to parent branches — forces unnecessary traversal
- No way to mark a branch as "stale" or "promising" — all branches look equal in the timeline
- Train Hub has no type filter or sort — finding specific trains requires scrolling and remembering titles
- No duration display in Hub list — hard to gauge train investment

### User Needs

- Sub-branch merge-down into parent branches (extend `findMergeDownTarget`)
- Branch status labels (exploring, stale, promising) with visual indicators in timeline
- Train Hub type filter dropdown
- Train Hub sort options (recent, most thoughts, longest duration)

## Solution Statement

### Functional Requirements

- [ ] FR-26: Sub-branch merge-down — `findMergeDownTarget` handles sub-branches merging into parent branch chain (not just main chain)
- [ ] FR-27: Branch status labels — branches can be tagged "exploring" | "stale" | "promising" with color-coded sidebar indicators
- [ ] FR-28: Train Hub type filter — dropdown filtering by train type in active/history tabs
- [ ] FR-29: Train Hub sort — sort options (recent, most thoughts, longest duration) in tab views

### Key Design Decisions

- **Sub-branch merge**: Walk backward from sub-branch to parent branch origin, then find next node on parent branch. Same algorithm generalized.
- **Branch status**: Stored as `branchStatus?: "exploring" | "stale" | "promising"` on ThoughtNode (branch origins only). Default: none (treated as exploring).
- **Type filter**: Reuses `BUILT_IN_TRAIN_TYPES` constant; "All" default.
- **Sort**: Default = most recent; options exposed as clickable headers in Hub.

### INVEST Assessment

- **I**ndependent: Sub-branch merge and branch status are independent. Hub polish depends on Inc 1 (Hub exists from Cycle 24).
- **N**egotiable: Branch status label names, Hub sort criteria
- **V**aluable: Sub-branch merge addresses explicit PRD deferred item; branch labels improve long-train UX
- **E**stimable: ~200 LOC total, ~40 tests across 3 increments
- **S**mall: 3 sub-increments, each well-bounded
- **T**estable: Merge algorithm testable in isolation; branch status visible in DOM; Hub filter/sort observable

## Related

- [[Train Improvements PRD]] (v3, FRI 31/35)
- [[Cycle 25 - Train Completion and Experience]] Inc 2-5
- [[PBI-TOT-012 Train Closure Context]] — prior PBI in same cycle
- Inbox: [[In trains, I also want a branch become the new main-line and also have the option to abandon or mark as stale]]
- PRD deferred: "Merge-down for sub-branches into parent branches"
