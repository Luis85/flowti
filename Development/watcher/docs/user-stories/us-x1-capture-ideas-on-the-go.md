---
parent: "[[Content Creator|Content Creator]]"
domain: Folder Watcher
id: US-X1
title: Capture ideas on the go
persona: Content Creator (Max)
jtbd: Capture on the go
journey: "[[Development/watcher/docs/journeys/journey-5-sync-across-devices|Journey 5]]"
use-cases:
  - UC-01
  - UC-03
  - UC-25
---
# US-X1: Capture ideas on the go

> JTBD: Capture on the go | Persona: [The Content Creator](Content%20Creator.md) | Journey: [Journey 5](../journeys/journey-5-sync-across-devices.md)

**As a** content creator,
**I want** notes I write on my phone to appear in my desktop vault within minutes,
**so that** no idea gets lost between devices.

## Acceptance Criteria

- [ ] A file synced to OneDrive from the phone is detected in the local source folder
- [ ] Forward sync imports it into the vault after stability checks pass
- [ ] SyncStateService records the file to prevent re-processing
