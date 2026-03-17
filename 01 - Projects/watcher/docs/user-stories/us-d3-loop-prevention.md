---
parent: "[[Development/watcher/docs/personas/Developer|Developer]]"
domain: Folder Watcher
id: US-D3
title: Loop prevention
persona: Developer (Sam)
jtbd: Prevent loops
journey: "[[Development/watcher/docs/journeys/journey-2-edit-from-both-sides|Journey 2]]"
use-cases:
  - UC-27
---
# US-D3: Loop prevention

> JTBD: Prevent loops | Persona: [The Developer](Development/watcher/docs/personas/Developer.md) | Journey: [Journey 2](../journeys/journey-2-edit-from-both-sides.md)

**As a** developer,
**I want** the sync loop detector to block bounce-back events,
**so that** my CPU and disk are not consumed by infinite sync cycles.

## Acceptance Criteria

- [ ] After a forward sync, `SyncLoopDetector.isRecentlySynced()` returns `true` for the synced path
- [ ] The reverse sync skips files flagged as recently synced
- [ ] After `COOLDOWN_MS` (5000 ms), the file is eligible for sync again
- [ ] Path normalization handles Windows backslashes
