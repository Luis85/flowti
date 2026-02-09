---
parent: "[[Development/watcher/docs/personas/Researcher|Researcher]]"
domain: Folder Watcher
id: US-R1
title: Auto-import new notes
persona: Researcher (Alex)
jtbd: Import new notes
journey: "[[Development/watcher/docs/journeys/journey-1-import-external-notes|Journey 1]]"
use-cases:
  - UC-01
  - UC-03
---
# US-R1: Auto-import new notes

> JTBD: Import new notes | Persona: [The Researcher](Development/watcher/docs/personas/Researcher.md) | Journey: [Journey 1](../journeys/journey-1-import-external-notes.md)

**As a** researcher,
**I want** new files in my Dropbox folder to appear in my Obsidian vault automatically,
**so that** I don't have to remember to copy them manually.

## Acceptance Criteria

- [ ] When a new `.md` or `.txt` file is saved in the source folder, it is synced to the vault within the debounce window
- [ ] The file content in the vault matches the source byte-for-byte
- [ ] SyncStateService records the file's mtime and size after sync
