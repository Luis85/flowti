---
parent: "[[Weekend User|Weekend User]]"
domain: Folder Watcher
id: US-W2
title: Incremental reconciliation
persona: Weekend User (Jordan)
jtbd: Skip unchanged files
journey: "[[Development/watcher/docs/journeys/journey-3-catch-up-after-weekend|Journey 3]]"
use-cases:
  - UC-21
  - UC-43
---
# US-W2: Incremental reconciliation

> JTBD: Skip unchanged files | Persona: [The Weekend User](Weekend%20User.md) | Journey: [Journey 3](../journeys/journey-3-catch-up-after-weekend.md)

**As a** weekend user,
**I want** unchanged files skipped instantly during reconciliation,
**so that** it finishes in seconds, not minutes.

## Acceptance Criteria

- [ ] `SyncStateService.needsSync()` returns `false` when mtime and size match the recorded state
- [ ] Only files with changed mtime or size (or no prior state) are processed
- [ ] Skipped files are counted in the `skipped` stat
