---
type: ProductBacklogItem
feature: "[[Obsidian Canvas Integration PRD]]"
stage: planned
priority: medium
phase: 3
dependencies:
  - "[[PBI-CAN-002 Canvas Templates]]"
  - "[[Session Workspaces PRD]]"
tags:
  - canvas
  - session
user_story: "[[Starting a Canvas Session]]"
---

## User Story - Problemspace

As a domain architect, I want to start a Canvas Session that opens a preconfigured canvas in the main pane with the session workspace in the sidebar so that I can design visually while monitoring my session progress.

### User Pains

- Sessions currently open as standalone workspace views
- No way to anchor a session around a canvas for visual domain design
- Canvas files can be attached but not orchestrated as session anchor
- Post-session work (importing canvas nodes as notes) requires manual steps

### User Needs

- "Canvas Session" type in session creation modal
- Canvas opens in main pane with sidebar session monitor
- Canvas template applied based on session type
- Canvas file automatically linked as session artifact
- Post-session import prompt for canvas nodes

## Solutionstatement

### Functional Requirements

- [ ] "Canvas Session" type available in NewSessionModal
- [ ] On start: open canvas in main pane, session workspace in sidebar
- [ ] Apply canvas template based on session type selection
- [ ] Canvas file automatically linked as session artifact
- [ ] Nodes created during session get session frontmatter reference
- [ ] Post-session import: prompt to import canvas nodes as typed notes on completion
- [ ] `canvas.session.started` event emitted on start
- [ ] `canvas.template.applied` event emitted when template loaded

## Acceptance Criteria

- [ ] "New Canvas Session" option in session creation modal
- [ ] Canvas opens in main pane with sidebar session monitor
- [ ] Canvas template applied based on session type
- [ ] Canvas file linked as session artifact
- [ ] Post-session import prompt for canvas nodes
- [ ] npm run build passes

## Related

- PRD: [[Obsidian Canvas Integration PRD]]
- Inbox: [[Canvas session workspace opens canvas as session anchor with sidebar monitor]], [[Starting a Canvas Session]]
- Dependencies: [[PBI-CAN-002 Canvas Templates]], [[Session Workspaces PRD]]
