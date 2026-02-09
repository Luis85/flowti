---
parent: "[[Development/watcher/docs/personas/Researcher|Researcher]]"
domain: Folder Watcher
id: US-R5
title: Handle large files safely
persona: Researcher (Alex)
jtbd: Handle large files safely
journey: "[[Development/watcher/docs/journeys/journey-1-import-external-notes|Journey 1]]"
use-cases:
  - UC-30
---
# US-R5: Handle large files safely

> JTBD: Handle large files safely | Persona: [The Researcher](Development/watcher/docs/personas/Researcher.md) | Journey: [Journey 1](../journeys/journey-1-import-external-notes.md)

**As a** researcher,
**I want** files exceeding the size limit to be skipped gracefully,
**so that** my vault and plugin stay responsive.

## Acceptance Criteria

- [ ] Files larger than `MAX_FILE_SIZE_BYTES` (100 MB) are not read into memory
- [ ] The sync result returns `action: "skipped"`, `reason: "file_too_large"`
- [ ] A warning is logged with the file path and size
