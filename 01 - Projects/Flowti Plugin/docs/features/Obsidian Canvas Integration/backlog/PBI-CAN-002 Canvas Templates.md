---
type: ProductBacklogItem
feature: "[[Obsidian Canvas Integration PRD]]"
stage: planned
priority: medium
phase: 2
dependencies:
  - "[[PBI-CAN-001 Canvas Parser and Importer]]"
tags:
  - canvas
  - session
user_story: "[[Canvas template library for session types]]"
---

## User Story - Problemspace

As a session user, I want preconfigured canvas templates for different session types so that I can start a visual design session with a structured layout ready to fill.

### User Pains

- No preconfigured canvas layouts — every canvas starts blank
- Creating groups and structure manually takes time and disrupts creative flow
- Different session types benefit from different canvas layouts but no template system exists

### User Needs

- Library of canvas templates per session type
- At least 5 built-in templates (Domain Design, Sprint Planning, Retrospective, Brainstorm, Flow Design)
- Custom template creation and management
- Templates stored as `.canvas` JSON files

## Solutionstatement

### Functional Requirements

- [ ] Canvas template storage in `var/config/canvas-templates/`
- [ ] Built-in templates:
  - Domain Design: Groups for Actors, Systems, Events, Services, Flows + Legend
  - Sprint Planning: Groups for Backlog, Sprint Scope, Risks, Dependencies
  - Retrospective: Groups for Went Well, Improve, Actions
  - Brainstorm: Empty canvas with Legend group only
  - Flow Design: Groups for Trigger, Steps, Decision Points, Outcomes
- [ ] Template picker modal for selection during session creation
- [ ] Custom template creation: save current canvas as template
- [ ] Template management in settings or Data Exchange Hub

## Acceptance Criteria

- [ ] At least 5 built-in canvas templates available
- [ ] Templates loadable from `var/config/canvas-templates/`
- [ ] Template picker modal works in session creation flow
- [ ] Custom templates can be saved and managed
- [ ] npm run build passes

## Related

- PRD: [[Obsidian Canvas Integration PRD]]
- Inbox: [[Canvas template library for session types]]
