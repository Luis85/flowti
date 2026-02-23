---
type: ProductBacklogItem
feature: "[[Train Improvements PRD]]"
stage: planned
priority: high
effort: medium
dependencies:
  - "[[PBI-TOT-011 Train UX Sprint]]"
user_story: "[[How can we better integrate trains and sessions and closure rituals]]"
planned_in: "[[Cycle 25 - Train Completion and Experience]]"
note: "Train stats in session closure overlay when session originated from a train. Cycle 25 Inc 1."
tags:
  - backlog
  - train-of-thought
  - session
  - closure
---

## User Story — Problem Space

As a Train of Thoughts user who completes a train session, I want the closure ritual to show train-specific context (thought count, branches, merges, key thought titles) so that my reflection is grounded in what actually happened during the train journey, not just generic session stats.

### User Pains

- When completing a session that contains a train, the closure overlay shows generic session stats (duration, activity count) but nothing about the train structure
- Train-specific insights (how many thoughts, whether branches were merged, head vs branches) are lost in the closure
- No connection between the train journey and the reflection questions

### User Needs

- Train stats panel in SessionClosureOverlay showing thought count, branch count, merge count
- Key thought titles listed as context for reflection
- Train type badge visible in closure overlay
- Closure questions can reference train context

## Solution Statement

### Functional Requirements

- [ ] FR-24: Train context panel in SessionClosureOverlay showing train stats when session originated from train
- [ ] FR-25: Train summary section with key thought titles (head, branch origins, merge targets) in closure overlay

### Key Design Decisions

- **Detection**: Check if active session has a corresponding train via `trainService.getActiveTrain()` or session's train reference
- **Read-only context**: Closure overlay reads train state but does not mutate it
- **Standalone panel**: Train context is a separate section in the overlay, not mixed into existing closure questions
- **Graceful absence**: When no train is associated, no train section renders (no blank panel)

### INVEST Assessment

- **I**ndependent: Yes — closure overlay already exists; train section is additive
- **N**egotiable: Amount of train detail shown in closure, question customization
- **V**aluable: Directly addresses Three Amigos OBS-2 (Cycle 24 review)
- **E**stimable: ~100 LOC overlay extension + ~50 LOC train stats, ~10 tests
- **S**mall: Single increment
- **T**estable: Overlay renders train section when train exists, hides when absent

## Related

- [[Train Improvements PRD]] (v3, FRI 31/35)
- [[Cycle 25 - Train Completion and Experience]] Inc 1
- [[PBI-TOT-011 Train UX Sprint]] — prior PBI
- Three Amigos: [[Three Amigos Review 2026-02-23 Train Value Sprint]] OBS-2
- Inbox: [[How can we better integrate trains and sessions and closure rituals]], [[The session complete view needs to be adjusted when coming from a train]]
