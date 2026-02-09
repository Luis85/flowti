---
parent: "[[Development/watcher/docs/personas/Collaborator|Collaborator]]"
domain: Folder Watcher
id: US-C7
title: Clean up after reorganizations
persona: Collaborator (Chris)
jtbd: Handle reorganizations
journey: "[[Development/watcher/docs/journeys/journey-4-share-and-collect-feedback|Journey 4]]"
use-cases:
  - UC-13
  - UC-14
---
# US-C7: Clean up after reorganizations

> JTBD: Handle reorganizations | Persona: [The Collaborator](Development/watcher/docs/personas/Collaborator.md) | Journey: [Journey 4](../journeys/journey-4-share-and-collect-feedback.md)

**As a** collaborator,
**I want** orphaned vault copies cleaned up when files are moved or renamed in the shared folder,
**so that** my vault mirrors the current shared folder structure.

## Acceptance Criteria

- [ ] Moves in the source folder are detected as renames (not delete + add)
- [ ] Orphan cleanup removes vault files whose source no longer exists
- [ ] Cleanup respects `deletionHandling` setting (ignore, trash)
