---
type: Idea
stage: discovery
origin: inbox
domain: session
description: "Auto-link files created or modified during a session as session artifacts, building the knowledge graph through usage."
tags: []
priority: "01 - medium"
rank:
related:
  - "[[How can Flowti be maintained, developed, and documented inside Flowti]]"
  - "[[backlog-refinement-2026-02-20]]"
note: "Dogfooding enabler. The session activity log already tracks file events (create, modify, rename). This extends that: when a file event occurs during an active session, auto-add the file as a linked artifact in the session's output panel. No manual attachment needed. The knowledge graph grows by just using the system."
---

## Problem

Session artifacts must be manually linked. Files created during a session are visible in the activity log but not formally attached as session outputs. This means the knowledge graph does not capture the relationship between a session and the work produced.

## Proposed Solution

1. **Auto-link on create**: When a file is created during an active session and it's in a tracked folder, add it to session artifacts
2. **Auto-link on modify**: When a file not already linked is modified significantly during a session, suggest linking it
3. **Session frontmatter**: Add `session: [[Session Name]]` to auto-linked files
4. **Configurable**: Auto-link can be enabled/disabled per session type
5. **Activity log integration**: Artifacts appear in both activity log and output panel
