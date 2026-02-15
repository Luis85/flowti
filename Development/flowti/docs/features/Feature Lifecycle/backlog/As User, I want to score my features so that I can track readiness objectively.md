---
type: UserStory
feature: "[[Feature Lifecycle PRD]]"
stage: draft
tags:
  - user-story
  - feature-lifecycle
---

# As User, I want to score my features so that I can track readiness objectively

## Story

As a vault maintainer, I want to score each feature across the 7 FRI dimensions (Strategy, Scope, Architecture, Event Integration, Data Model, UI Consistency, Validation) so that I have an objective measure of readiness that informs quality gate decisions and tracks maturation over time.

## Notes

- FRI is scored pre-implementation (readiness to build)
- TASM is scored post-implementation (quality of what was built)
- Together they form: FRI → Build Right, TASM → Stay Right
- Scores persist in PRD frontmatter and influence automated gate checks
