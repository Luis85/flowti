---
parent: "[[Content Creator|Content Creator]]"
domain: Folder Watcher
id: US-X6
title: Handle overlapping device edits
persona: Content Creator (Max)
jtbd: Handle overlapping edits
journey: "[[Development/watcher/docs/journeys/journey-5-sync-across-devices|Journey 5]]"
use-cases:
  - UC-08
  - UC-09
---
# US-X6: Handle overlapping device edits

> JTBD: Handle overlapping edits | Persona: [The Content Creator](Content%20Creator.md) | Journey: [Journey 5](../journeys/journey-5-sync-across-devices.md)

**As a** content creator,
**I want** overlapping edits resolved automatically — newer wins or both preserved,
**so that** I never silently lose an edit from any device.

## Acceptance Criteria

- [ ] `keepNewer` resolves simple conflicts where one edit is clearly later
- [ ] `rename` creates a conflict copy when edits happen near-simultaneously
- [ ] Both the original and the conflict copy are retained in the vault
