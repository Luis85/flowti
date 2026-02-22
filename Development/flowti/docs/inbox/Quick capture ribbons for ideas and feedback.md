---
type: Idea
stage: delivered
delivered_in: "[[Cycle 12 - User Hub Inbox]]"
origin: inbox
domain: inbox
description: "Two action ribbons and commands for instant idea and feedback capture — minimal friction to feed the knowledge graph."
tags: []
priority: "2 - high"
rank:
planned_in: "[[Cycle 12 - User Hub Inbox]]"
related:
  - "[[I want to capture feedback and input as fast as possible]]"
  - "[[I want to quickly capture a note to my inbox to distribute the note later]]"
  - "[[backlog-refinement-2026-02-20]]"
  - "[[Cycle Sequence Review 2026-02-20 Azure DevOps Prioritization]]"
note: "Dogfooding enabler. Two ribbon actions: 'Add Idea' and 'Add Feedback'. Each opens a minimal modal (title only). Note created in configured target folder with configured template. Third command: type-based quick-capture that asks for type first, then title. Custom types with custom templates and targets can be configured."
---

## Problem

Capturing ideas and feedback during a session or daily work requires too many steps: navigate to folder, create note, add frontmatter, write content. This friction means ideas get lost or are captured outside the system.

## Proposed Solution

1. **Two ribbon actions**: "Add Idea" and "Add Feedback"
2. **Minimal modal**: Title input only, Enter to confirm
3. **Auto-create**: Note created in configured target folder with type-specific template
4. **Configurable**: Target folder and template per capture type in settings
5. **Third command**: "Quick Capture" — asks for type first (idea, feedback, bug, custom), then title
6. **Custom types**: Users can define additional capture types with their own template and target
7. **Navigation option**: After creation, stay where you are or navigate to new note

## Acceptance Criteria

- [ ] "Add Idea" and "Add Feedback" ribbon actions visible
- [ ] Clicking ribbon opens modal with title input
- [ ] Note created in configured folder with correct frontmatter
- [ ] "Quick Capture" command available in command palette
- [ ] Custom capture types configurable in settings
- [ ] `npm run build` passes
