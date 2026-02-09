---
parent: "[[Content Creator|Content Creator]]"
domain: Folder Watcher
id: US-X3
title: Single source of truth
persona: Content Creator (Max)
jtbd: Single source of truth
journey: "[[Development/watcher/docs/journeys/journey-5-sync-across-devices|Journey 5]]"
use-cases:
  - UC-03
  - UC-08
  - UC-20
---
# US-X3: Single source of truth

> JTBD: Single source of truth | Persona: [The Content Creator](Content%20Creator.md) | Journey: [Journey 5](../journeys/journey-5-sync-across-devices.md)

**As a** content creator,
**I want** the vault to always have the latest version from any device,
**so that** I never work from stale content.

## Acceptance Criteria

- [ ] Bidirectional sync propagates changes from source → vault and vault → source
- [ ] `keepNewer` ensures the most recent edit wins regardless of direction
- [ ] Reconciliation on start catches any changes accumulated while the desktop was off
