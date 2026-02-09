---
parent: "[[Development/watcher/docs/personas/Researcher|Researcher]]"
domain: Folder Watcher
id: US-R2
title: Filter out noise
persona: Researcher (Alex)
jtbd: Filter out noise
journey: "[[Development/watcher/docs/journeys/journey-1-import-external-notes|Journey 1]]"
use-cases:
  - UC-15
  - UC-16
  - UC-17
  - UC-18
---
# US-R2: Filter out noise

> JTBD: Filter out noise | Persona: [The Researcher](Development/watcher/docs/personas/Researcher.md) | Journey: [Journey 1](../journeys/journey-1-import-external-notes.md)

**As a** researcher,
**I want** only `.md` and `.txt` files imported and all temp files, binaries, and dotfiles ignored,
**so that** my vault stays clean and focused on notes.

## Acceptance Criteria

- [ ] Files not matching `fileExtensions` are never synced
- [ ] Temp files (`.tmp`, `.partial`, `.crdownload`) are filtered by `isTempFile()`
- [ ] Dotfiles (`.DS_Store`, `.gitignore`) are filtered by `createIgnoredMatcher()`
- [ ] Files matching `excludePatterns` (e.g. `build/**`) are excluded
