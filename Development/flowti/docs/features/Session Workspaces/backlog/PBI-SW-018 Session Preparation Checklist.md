---
type: ProductBacklogItem
feature: "[[Session Workspaces PRD]]"
stage: discovery
priority: medium
dependencies:
  - "[[PBI-SW-010 Session Lifecycle v2 and Intent Layer]]"
tags:
  - session
  - preparation
user_story: "[[Session preparation checklist as guided pre-session workflow]]"
---

## User Story - Problemspace

As a session user, I want a guided pre-session checklist so that I ensure goals are set, context is loaded, and artifacts are prepared before starting work.

### User Pains

- Sessions started without preparation lead to unfocused work
- Crucial steps like reviewing previous reflections get skipped
- No structured pre-session workflow — users jump straight to execution
- Missing context or artifacts discovered mid-session disrupts flow

### User Needs

- Pre-session checklist presented before "Start"
- Configurable per session type
- Default items: goals defined, context attached, previous reflection reviewed
- Skip option for power users

## Solutionstatement

### Functional Requirements

- [ ] Pre-session checklist: configurable per session type
- [ ] Default checklist items:
  - Goals defined (at least 1)
  - Context notes attached
  - Previous session reflection reviewed
  - Canvas/artifacts prepared (for canvas sessions)
  - Time estimate set
- [ ] Guided flow: checklist presented before "Start" button becomes active
- [ ] Template-based: each session template can define its own checklist
- [ ] Skip option: "Start anyway" for power users
- [ ] Event: `session.preparation.completed` emitted when checklist complete

## Acceptance Criteria

- [ ] Checklist visible in prepared state before Start
- [ ] Start button gated on checklist completion (or skip)
- [ ] Configurable per session type
- [ ] Custom checklist items supported via templates
- [ ] npm run build passes

## Related

- PRD: [[Session Workspaces PRD]]
- Inbox: [[Session preparation checklist as guided pre-session workflow]]
