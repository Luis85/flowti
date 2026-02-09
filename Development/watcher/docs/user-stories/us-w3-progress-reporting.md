---
parent: "[[Weekend User|Weekend User]]"
domain: Folder Watcher
id: US-W3
title: Progress reporting
persona: Weekend User (Jordan)
jtbd: See progress
journey: "[[Development/watcher/docs/journeys/journey-3-catch-up-after-weekend|Journey 3]]"
use-cases:
  - UC-39
---
# US-W3: Progress reporting

> JTBD: See progress | Persona: [The Weekend User](Weekend%20User.md) | Journey: [Journey 3](../journeys/journey-3-catch-up-after-weekend.md)

**As a** weekend user,
**I want** a progress indicator during reconciliation,
**so that** I know it's working and how long it will take.

## Acceptance Criteria

- [ ] `onProgress` callback fires with `mappingId`, `phase`, and count information
- [ ] Progress is throttled at `progressThrottleMs` to avoid UI flooding
- [ ] The status bar shows the current mapping being reconciled
