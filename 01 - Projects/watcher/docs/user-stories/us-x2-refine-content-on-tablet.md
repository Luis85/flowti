---
parent: "[[Content Creator|Content Creator]]"
domain: Folder Watcher
id: US-X2
title: Refine content on tablet
persona: Content Creator (Max)
jtbd: Refine on tablet
journey: "[[Development/watcher/docs/journeys/journey-5-sync-across-devices|Journey 5]]"
use-cases:
  - UC-08
---
# US-X2: Refine content on tablet

> JTBD: Refine on tablet | Persona: [The Content Creator](Content%20Creator.md) | Journey: [Journey 5](../journeys/journey-5-sync-across-devices.md)

**As a** content creator,
**I want** edits I make on my tablet to sync back to the desktop vault,
**so that** I can continue working seamlessly on the desktop.

## Acceptance Criteria

- [ ] A newer version arriving from the tablet overwrites the vault copy (`keepNewer`)
- [ ] The overwrite only happens when the source mtime is strictly newer
- [ ] SyncState is updated after the overwrite
