---
parent: "[[Weekend User|Weekend User]]"
domain: Folder Watcher
id: US-W4
title: Cancel reconciliation
persona: Weekend User (Jordan)
jtbd: Cancel if needed
journey: "[[Development/watcher/docs/journeys/journey-3-catch-up-after-weekend|Journey 3]]"
use-cases:
  - UC-23
---
# US-W4: Cancel reconciliation

> JTBD: Cancel if needed | Persona: [The Weekend User](Weekend%20User.md) | Journey: [Journey 3](../journeys/journey-3-catch-up-after-weekend.md)

**As a** weekend user,
**I want** to cancel reconciliation cleanly and immediately,
**so that** I can fix my settings before it processes everything.

## Acceptance Criteria

- [ ] Calling `ReconcileService.cancel()` stops processing after the current mapping completes
- [ ] No further mappings are processed after cancellation
- [ ] `isRunning()` returns `false` after cancel completes
