---
parent: "[[Weekend User|Weekend User]]"
domain: Folder Watcher
id: US-W1
title: Auto-reconcile on start
persona: Weekend User (Jordan)
jtbd: Catch up on Monday
journey: "[[Development/watcher/docs/journeys/journey-3-catch-up-after-weekend|Journey 3]]"
use-cases:
  - UC-20
---
# US-W1: Auto-reconcile on start

> JTBD: Catch up on Monday | Persona: [The Weekend User](Weekend%20User.md) | Journey: [Journey 3](../journeys/journey-3-catch-up-after-weekend.md)

**As a** weekend user,
**I want** all accumulated changes synced automatically when I open Obsidian,
**so that** I'm ready to work without manual steps.

## Acceptance Criteria

- [ ] When `syncOnStart` is enabled, `ReconcileService.reconcileOnStart()` runs on plugin load
- [ ] Only mappings with `enabled: true` and `reconcileOnStart: true` are processed
- [ ] Stats (scanned, processed, skipped, errors) are reported per mapping
