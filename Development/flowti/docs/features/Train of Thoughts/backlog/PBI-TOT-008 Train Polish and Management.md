---
type: ProductBacklogItem
feature: "[[Train Improvements PRD]]"
stage: done
priority: medium
effort: small
dependencies:
  - "[[PBI-TOT-004 Branch Merge]]"
  - "[[PBI-TOT-005 Train Canvas Generation and Sync]]"
user_story: "[[Train Improvements]]"
delivered_in: "[[Cycle 22 - Train Polish and Management]]"
note: "Train lifecycle management — rename, delete, maxThoughts enforcement. 3 increments."
tags:
  - backlog
  - train-of-thought
---

## User Story — Problem Space

As a Train of Thoughts user, I want to rename trains, delete trains I no longer need, and have the maximum thoughts limit enforced so that I can manage my trains cleanly without manual file operations.

### User Pains

- No way to rename a train after creation — title mistakes are permanent
- No way to delete a train — abandoned trains clutter the vault
- `trainMaxThoughts` setting exists but is not enforced — trains grow unbounded

### User Needs

- Rename a train and have all related files (folder, notes, canvas) update automatically
- Delete a train with confirmation (destructive action must be explicit)
- `trainMaxThoughts` setting enforced at capture time — auto-complete when limit reached

## Solution Statement

### Functional Requirements

- [x] FR-08: Train Rename — `renameTrain(trainId, newTitle)` renames folder, updates thought paths, syncs canvas
- [x] FR-09: Train Delete — `deleteTrain(trainId)` removes folder and all contents, removes from state
- [x] FR-10: Train Max Thoughts — `openTrainModal()` checks `trainMaxThoughts` and auto-completes at limit

### Delivered

- **Cycle 22** — 3 increments, 16 tests, 3,936 total tests post-delivery
- Rename uses `InputModal` (Obsidian Modal class, not `window.prompt()` which fails in Electron)
- Delete confirmation uses `InputModal` with "DELETE" text confirmation
- Active thought dot (`.ft-graph-dot-active`) added to timeline for UX polish
- Canvas error logging improved (caught errors for graceful degradation)

## Related

- [[Train Improvements PRD]] (v2, FRI 28/35)
- [[Cycle 22 - Train Polish and Management]]
- [[PBI-TOT-009 Merge Down Direction]] — next PBI in sequence
