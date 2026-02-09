---
parent: "[[Weekend User|Weekend User]]"
domain: Folder Watcher
id: US-W5
title: Concurrent reconcile guard
persona: Weekend User (Jordan)
jtbd: Avoid double runs
journey: "[[Development/watcher/docs/journeys/journey-3-catch-up-after-weekend|Journey 3]]"
use-cases:
  - UC-24
---
# US-W5: Concurrent reconcile guard

> JTBD: Avoid double runs | Persona: [The Weekend User](Weekend%20User.md) | Journey: [Journey 3](../journeys/journey-3-catch-up-after-weekend.md)

**As a** weekend user,
**I want** a second reconcile attempt to be rejected with a clear notice,
**so that** I don't corrupt state or create conflicts.

## Acceptance Criteria

- [ ] While `isRunning()` is `true`, calling `reconcileAll()` returns `false`
- [ ] A notice is shown containing "already in progress"
- [ ] The first reconciliation continues uninterrupted
