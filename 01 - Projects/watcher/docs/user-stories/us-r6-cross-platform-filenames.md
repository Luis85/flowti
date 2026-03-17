---
parent: "[[Development/watcher/docs/personas/Researcher|Researcher]]"
domain: Folder Watcher
id: US-R6
title: Cross-platform filenames
persona: Researcher (Alex)
jtbd: Cross-platform names
journey: "[[Development/watcher/docs/journeys/journey-1-import-external-notes|Journey 1]]"
use-cases:
  - UC-33
---
# US-R6: Cross-platform filenames

> JTBD: Cross-platform names | Persona: [The Researcher](Development/watcher/docs/personas/Researcher.md) | Journey: [Journey 1](../journeys/journey-1-import-external-notes.md)

**As a** researcher,
**I want** accented filenames to match correctly across macOS and Windows,
**so that** I don't get duplicates.

## Acceptance Criteria

- [ ] `toVaultPath()` applies NFC normalization
- [ ] A file created as NFD (`café.md`) on macOS matches NFC (`café.md`) on Windows
- [ ] No duplicate vault entries are created for the same logical filename
