---
type: ProductBacklogItem
feature: "[[Feature Lifecycle PRD]]"
priority: high
stage: draft
userStories:
  - "[[As User, I want to see where each feature stands in the development lifecycle]]"
useCases:
  - "[[Review Feature Pipeline]]"
  - "[[Advance a Feature to the Next Stage]]"
---

## User Story

As a vault maintainer, I want a Feature Pipeline view that shows every PRD positioned at its current lifecycle stage so that I can see at a glance which features need attention, which are blocked at gates, and which are ready to advance.

## Functional Requirements

- [ ] Scan `docs/features/*/` for files with `type: ProductRequirementsDocument` frontmatter
- [ ] Extract `stage` field and validate against allowed values (`idea`, `draft`, `approved`, `in-progress`, `review`, `done`)
- [ ] Normalize legacy stage values on first scan (`open` → `draft`, `development` → `in-progress`, `new` → `idea`)
- [ ] Display PRDs grouped by stage in the master panel with count badges per stage
- [ ] Each PRD row shows: feature name, stage badge, maturity level, FRI score (if scored), gate readiness indicator
- [ ] Gate readiness computed via pure gate check functions (Problem Gate, Design Gate, Readiness Gate, Build Gate, Quality Gate)
- [ ] Clicking a PRD shows detail panel with: gate checklist, backlog items (PBIs + use cases), score summary
- [ ] "Advance to [next stage]" button validates gate checks → updates frontmatter `stage` field → emits `feature.stage.changed`
- [ ] Search/filter bar to find features by name
- [ ] Features tab added to Event Catalog tab bar (after Products)

## Acceptance Criteria

- [ ] All PRD files discovered and displayed grouped by their stage
- [ ] Legacy stage values are auto-normalized to the standard set
- [ ] Gate checklist shows pass/fail for each check with explanations
- [ ] Advancing a feature updates the PRD frontmatter and the view reflects the change
- [ ] Gate check functions are pure and unit-testable
- [ ] Dashboard shows Features stat card with stage distribution
- [ ] `npm run build` passes
