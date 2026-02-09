---
parent: "[[Development/watcher/docs/personas/Developer|Developer]]"
domain: Folder Watcher
id: US-D2
title: Debounced rapid saves
persona: Developer (Sam)
jtbd: Avoid sync storms
journey: "[[Development/watcher/docs/journeys/journey-2-edit-from-both-sides|Journey 2]]"
use-cases:
  - UC-28
---
# US-D2: Debounced rapid saves

> JTBD: Avoid sync storms | Persona: [The Developer](Development/watcher/docs/personas/Developer.md) | Journey: [Journey 2](../journeys/journey-2-edit-from-both-sides.md)

**As a** developer,
**I want** rapid saves debounced into a single sync operation,
**so that** the plugin doesn't fire hundreds of redundant syncs.

## Acceptance Criteria

- [ ] Multiple vault events within `MIN_REVERSE_DEBOUNCE_MS` (1500 ms) are collapsed into one sync
- [ ] Only the final state of the file is synced, not intermediate saves
- [ ] The debounce timer resets on each new event for the same file
