---
type: ProductBacklogItem
feature: "[[Train Improvements PRD]]"
stage: planned
priority: high
effort: medium
dependencies:
  - "[[PBI-TOT-009 Merge Down Direction]]"
user_story: "[[Train Improvements]]"
planned_in: "[[Cycle 24 - Train Value Sprint]]"
note: "Dedicated Train Hub BaseHubView for central train management. Cycle 24 Inc 1."
tags:
  - backlog
  - train-of-thought
  - hub
---

## User Story — Problem Space

As a Train of Thoughts user managing multiple trains across sessions, I want a dedicated Train Hub to see all my trains in one place — active, paused, and completed — so that I can quickly resume, review, or delete trains without hunting through session lists or remembering command palette entries.

### User Pains

- No central place to see and manage all trains — must find them via the session list or commands
- No way to see train statistics at a glance (total trains, avg thought count, completion rate)
- Completed trains are invisible unless the user remembers the specific session
- Deleting or reviewing old trains requires navigating to each one individually

### User Needs

- Central Train Hub accessible via command palette and ribbon
- Dashboard with active train card + aggregate statistics
- Active tab listing running/paused trains with Resume, Pause, Open, Delete actions
- History tab listing completed trains, searchable by title, with Open and Delete actions

## Solution Statement

### Functional Requirements

- [ ] FR-15: Train Hub view (`TrainHubView`) extending `BaseHubView<TrainHubPage>` with 3 pages: dashboard, active, history
- [ ] FR-16: Train Hub command (`flowti:open-train-hub`) registered in command palette

### Key Design Decisions

- **Extends BaseHubView** — follows EventCatalogView and DataExchangeHubView pattern for consistency
- **No split layout** in v1 — simple tab-based list view. Master/detail split deferred to future cycle.
- **Reuses existing events** — `train.started`, `train.completed`, `train.paused`, `train.resumed` trigger re-renders via `scheduleRender()`
- **VIEW_TYPE_TRAIN_HUB** canonical in `src/domain/hub/types.ts`

### INVEST Assessment

- **I**ndependent: Yes — no dependency on other Cycle 24 increments
- **N**egotiable: Tab count and dashboard layout are flexible
- **V**aluable: Highest-demand inbox item; central management hub
- **E**stimable: ~250 LOC, ~15 tests; follows established BaseHubView pattern
- **S**mall: Single increment, well-bounded scope
- **T**estable: Dashboard renders stats, tabs list trains, actions trigger service methods

## Related

- [[Train Improvements PRD]] (v2, FRI 28/35)
- [[Cycle 24 - Train Value Sprint]] Inc 1
- [[PBI-TOT-009 Merge Down Direction]] — prior PBI
- Inbox: [[We need a dedicated Train Hub]]
