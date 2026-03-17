---
parent: "[[Content Creator|Content Creator]]"
domain: Folder Watcher
id: US-X7
title: Catch up across devices
persona: Content Creator (Max)
jtbd: Catch up across devices
journey: "[[Development/watcher/docs/journeys/journey-5-sync-across-devices|Journey 5]]"
use-cases:
  - UC-20
  - UC-21
---
# US-X7: Catch up across devices

> JTBD: Catch up across devices | Persona: [The Content Creator](Content%20Creator.md) | Journey: [Journey 5](../journeys/journey-5-sync-across-devices.md)

**As a** content creator,
**I want** reconciliation to pull in all phone and tablet edits when I open the desktop,
**so that** I'm instantly up to date without manual steps.

## Acceptance Criteria

- [ ] `reconcileOnStart()` processes all enabled mappings
- [ ] Only files with changed mtime or size are synced (incremental)
- [ ] New files from other devices are imported
