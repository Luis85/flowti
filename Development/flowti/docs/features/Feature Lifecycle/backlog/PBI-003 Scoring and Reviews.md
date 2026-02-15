---
type: ProductBacklogItem
feature: "[[Feature Lifecycle PRD]]"
priority: medium
stage: draft
userStories:
  - "[[As User, I want to score my features so that I can track readiness objectively]]"
useCases:
  - "[[Score Feature Readiness]]"
  - "[[Run a Three Amigos Review]]"
---

## User Story

As a vault maintainer, I want to score each feature's readiness (FRI) and quality (TASM) so that I can make objective decisions about which features are ready to advance, and track quality trends over time through structured review sessions.

## Functional Requirements

### FRI Scoring
- [ ] "Score FRI" action on feature detail opens a scoring form with 7 dimensions (Strategy, Scope, Architecture, Event Integration, Data Model, UI Consistency, Validation & Testing)
- [ ] Each dimension scored 0-5 via slider or dropdown
- [ ] Total computed and readiness level determined: Not Ready (0-10), Conceptual (11-18), Technically Ready (19-25), Integration Ready (26-30), Production Ready (31-35)
- [ ] Scores persisted to PRD frontmatter (`maturity_score_*` fields)
- [ ] `feature.scored` event emitted with full score breakdown
- [ ] Score summary shown in feature detail panel with dimension breakdown

### Three Amigos Review Integration
- [ ] "New Review" action creates a Three Amigos session doc from template in the feature's backlog folder
- [ ] Doc pre-filled with: feature name, date, `related_features` link to PRD
- [ ] Review doc discovered by scanning for `type: ReviewSessionTemplate` or `session_type: ThreeAmigos` in feature backlog
- [ ] TASM scores extracted from review doc frontmatter (`scores_*` fields)
- [ ] Most recent TASM score and health level shown in feature detail
- [ ] `review.session.scored` event emitted when review doc is detected with scores > 0

## Acceptance Criteria

- [ ] FRI scoring form renders 7 dimensions with sliders and computes total
- [ ] Saving FRI updates the PRD frontmatter and the view reflects the new score
- [ ] Creating a review session produces a valid Three Amigos doc from template
- [ ] TASM scores are extracted from review docs and displayed in feature detail
- [ ] Gate checks reference FRI scores for Design Gate (>= 11) and Readiness Gate (>= 19)
- [ ] `npm run build` passes
