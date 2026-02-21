---
type: ProductBacklogItem
feature: "[[Quick Capture PRD]]"
stage: planned
priority: high
tags:
  - release-blocker
  - inbox
  - capture
planned_in: "[[Cycle 12 - User Hub Inbox]]"
user_story: "[[Quick capture ribbons for ideas and feedback]]"
---

## User Story - Problemspace

As a vault user, I want one-click ribbon actions to capture ideas and feedback so that I can quickly feed the knowledge graph without disrupting my current work.

### User Pains

- Capturing ideas requires navigating to a folder, creating a note, adding frontmatter
- High friction means ideas and feedback get lost
- No way to capture without leaving current context

### User Needs

- "Add Idea" and "Add Feedback" ribbon actions
- Minimal modal with title input only
- Note auto-created with typed frontmatter
- "Quick Capture" command with type selector

## Solutionstatement

### Functional Requirements

- [ ] Two ribbon actions: "Add Idea" (lightbulb icon) and "Add Feedback" (message-circle icon)
- [ ] Minimal modal: title input, Enter to confirm
- [ ] Note created in configured folder with frontmatter template
- [ ] "Quick Capture" command: type selector (idea, feedback, bug, custom) → title input
- [ ] Configurable target folder per type in Settings
- [ ] Custom capture types: type name, template, target folder
- [ ] Navigation option: stay or open new note
- [ ] Events: `capture.idea.created`, `capture.feedback.created`, `capture.note.created`

## Acceptance Criteria

- [ ] Ribbon actions visible and functional
- [ ] Notes created with correct frontmatter
- [ ] Quick Capture command works from palette
- [ ] Custom types configurable
- [ ] npm run build passes

## Related

- PRD: [[Quick Capture PRD]]
- Inbox: [[Quick capture ribbons for ideas and feedback]]
