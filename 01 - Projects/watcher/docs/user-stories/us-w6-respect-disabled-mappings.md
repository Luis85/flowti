---
parent: "[[Weekend User|Weekend User]]"
domain: Folder Watcher
id: US-W6
title: Respect disabled mappings
persona: Weekend User (Jordan)
jtbd: Control what syncs
journey: "[[Development/watcher/docs/journeys/journey-3-catch-up-after-weekend|Journey 3]]"
use-cases:
  - UC-20
  - UC-36
---
# US-W6: Respect disabled mappings

> JTBD: Control what syncs | Persona: [The Weekend User](Weekend%20User.md) | Journey: [Journey 3](../journeys/journey-3-catch-up-after-weekend.md)

**As a** weekend user,
**I want** disabled mappings and mappings without `reconcileOnStart` to be skipped,
**so that** paused or inactive mappings are not processed.

## Acceptance Criteria

- [ ] Mappings with `enabled: false` are never reconciled
- [ ] Mappings with `reconcileOnStart: false` are skipped by `reconcileOnStart()`
- [ ] Manual `reconcileAll()` still respects the `enabled` flag
