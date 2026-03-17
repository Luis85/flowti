---
parent: "[[Development/watcher/docs/personas/Developer|Developer]]"
domain: Folder Watcher
id: US-D4
title: Keep-newer conflict resolution
persona: Developer (Sam)
jtbd: Resolve conflicts fairly
journey: "[[Development/watcher/docs/journeys/journey-2-edit-from-both-sides|Journey 2]]"
use-cases:
  - UC-08
---
# US-D4: Keep-newer conflict resolution

> JTBD: Resolve conflicts fairly | Persona: [The Developer](Development/watcher/docs/personas/Developer.md) | Journey: [Journey 2](../journeys/journey-2-edit-from-both-sides.md)

**As a** developer,
**I want** the newer version to win automatically when both sides change,
**so that** I don't lose my most recent work.

## Acceptance Criteria

- [ ] `ConflictResolver.resolveForward()` compares source mtime vs vault mtime
- [ ] The file with the newer mtime results in `action: "overwrite"`
- [ ] The file with the older mtime results in `action: "skip"`
