---
parent: "[[Development/watcher/docs/personas/Researcher|Researcher]]"
domain: Folder Watcher
id: US-R3
title: Resume after offline
persona: Researcher (Alex)
jtbd: Resume after offline
journey: "[[Development/watcher/docs/journeys/journey-1-import-external-notes|Journey 1]]"
use-cases:
  - UC-20
  - UC-21
  - UC-43
---
# US-R3: Resume after offline

> JTBD: Resume after offline | Persona: [The Researcher](Development/watcher/docs/personas/Researcher.md) | Journey: [Journey 1](../journeys/journey-1-import-external-notes.md)

**As a** researcher,
**I want** only new and changed files synced when I open Obsidian after days away,
**so that** I'm up to date in seconds, not minutes.

## Acceptance Criteria

- [ ] Reconciliation on start processes only files where mtime or size has changed
- [ ] Files with unchanged mtime+size are skipped without reading content
- [ ] New files (no prior state) are synced
