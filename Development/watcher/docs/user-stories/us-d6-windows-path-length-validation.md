---
parent: "[[Development/watcher/docs/personas/Developer|Developer]]"
domain: Folder Watcher
id: US-D6
title: Windows path length validation
persona: Developer (Sam)
jtbd: Handle long paths
journey: "[[Development/watcher/docs/journeys/journey-2-edit-from-both-sides|Journey 2]]"
use-cases:
  - UC-32
---
# US-D6: Windows path length validation

> JTBD: Handle long paths | Persona: [The Developer](Development/watcher/docs/personas/Developer.md) | Journey: [Journey 2](../journeys/journey-2-edit-from-both-sides.md)

**As a** developer,
**I want** a clear warning when a file path exceeds MAX_PATH (260 chars),
**so that** I don't encounter cryptic file system errors later.

## Acceptance Criteria

- [ ] `validateTargetPath()` rejects paths >= 260 chars on Windows
- [ ] `validateSourcePath()` rejects paths >= 260 chars on Windows
- [ ] The error message includes the path and the limit
