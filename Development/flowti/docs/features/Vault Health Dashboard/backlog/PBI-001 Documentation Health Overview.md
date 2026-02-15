---
type: ProductBacklogItem
feature: "[[Vault Health Dashboard PRD]]"
priority: medium
stage: draft
userStories: []
useCases:
  - "[[Fix Documentation Gaps]]"
  - "[[Improve Event Coverage]]"
  - "[[Resolve Broken References]]"
  - "[[Review Vault Health Score]]"
---

## User Story

As a vault maintainer, I want a health dashboard that scores my documentation coverage, event coverage, and reference integrity so that I can identify and fix gaps, broken references, and uncovered events from a single view.

## Functional Requirements

- [ ] Health tab in Event Catalog with aggregate health score (0-100), color-coded green/yellow/red
- [ ] Six diagnostic checks grouped under four categories: Documentation, Consistency, References, Coverage
- [ ] Documentation Coverage check: ratio of documented vs undocumented domains and services, with affected items list
- [ ] Event Coverage check: ratio of events with subscriptions or definitions vs uncovered events
- [ ] Reference Integrity check: detect broken cross-references in flow, system, actor, and product frontmatter
- [ ] Affected items are clickable: navigate directly to the relevant tab with the entity selected
- [ ] "Create Doc" action available for undocumented entities navigated from the health check
- [ ] Search bar filters checks by title or summary text
- [ ] Scores recompute on return to Health tab (re-scan all entity tabs)

## Acceptance Criteria

- [ ] Health tab displays an aggregate score with "N of M checks passing" summary
- [ ] Each check shows severity dot, title, score percentage, and progress bar
- [ ] Clicking a failing check lists all affected items with entity name and reason
- [ ] Clicking an affected item navigates to the correct tab with the entity selected
- [ ] Fixing an issue (e.g., creating a doc) and returning to Health shows an improved score
- [ ] Empty vault shows no false positives (all checks pass trivially)
- [ ] System events are excluded from checks when `showSystemEvents` is disabled
- [ ] `npm run build` passes
