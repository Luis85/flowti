---
parent: "[[Development/watcher/docs/personas/Researcher|Researcher]]"
domain: Folder Watcher
id: US-R4
title: Trust the sync
persona: Researcher (Alex)
jtbd: Trust the sync
journey: "[[Development/watcher/docs/journeys/journey-1-import-external-notes|Journey 1]]"
use-cases:
  - UC-06
  - UC-07
  - UC-08
---
# US-R4: Trust the sync

> JTBD: Trust the sync | Persona: [The Researcher](Development/watcher/docs/personas/Researcher.md) | Journey: [Journey 1](../journeys/journey-1-import-external-notes.md)

**As a** researcher,
**I want** the plugin to only overwrite vault files when the source is genuinely newer,
**so that** I never lose edits I made inside Obsidian.

## Acceptance Criteria

- [ ] With `conflictResolution: "overwrite"`, an existing vault file is overwritten only when source exists
- [ ] With `conflictResolution: "keepNewer"`, the file with the newer mtime wins
- [ ] With `conflictResolution: "skip"`, existing vault files are never overwritten
