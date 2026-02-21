---
type: ProductBacklogItem
feature: "[[Session Workspaces PRD]]"
stage: discovery
priority: medium
dependencies:
  - "[[PBI-SW-001 Activity Log]]"
tags:
  - session
  - automation
user_story: "[[Session auto-documentation links artifacts on file events]]"
---

## User Story - Problemspace

As a session user, I want files created or modified during my session to be automatically linked as session artifacts so that the knowledge graph builds itself through usage.

### User Pains

- Session artifacts must be manually linked
- Files created during a session are visible in the activity log but not formally attached as outputs
- No session frontmatter added to files created during sessions
- Connection between session and its outputs is implicit, not explicit

### User Needs

- Auto-link created files as session artifacts
- Suggest linking modified files not yet attached
- Add session frontmatter to auto-linked files
- Configurable per session type (enable/disable)

## Solutionstatement

### Functional Requirements

- [ ] Auto-link on create: files created during active session in tracked folder added to session artifacts
- [ ] Auto-link on modify: files not already linked, modified during session, suggested for linking
- [ ] Session frontmatter: add `session: [[Session Name]]` to auto-linked files
- [ ] Configurable: auto-link can be enabled/disabled per session type
- [ ] Activity log integration: artifacts appear in both activity log and output panel
- [ ] Events: `session.artifact.autoLinked` emitted on auto-link

## Acceptance Criteria

- [ ] Files created during session auto-linked as artifacts
- [ ] Modified files suggested for linking
- [ ] Session frontmatter added to auto-linked files
- [ ] Auto-link configurable per session type
- [ ] npm run build passes

## Related

- PRD: [[Session Workspaces PRD]]
- Inbox: [[Session auto-documentation links artifacts on file events]]
