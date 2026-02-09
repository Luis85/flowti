---
parent: "[[Development/watcher/docs/personas/Collaborator|Collaborator]]"
domain: Folder Watcher
id: US-C6
title: Catch up after absence
persona: Collaborator (Chris)
jtbd: Catch up after absence
journey: "[[Development/watcher/docs/journeys/journey-4-share-and-collect-feedback|Journey 4]]"
use-cases:
  - UC-20
  - UC-21
---
# US-C6: Catch up after absence

> JTBD: Catch up after absence | Persona: [The Collaborator](Development/watcher/docs/personas/Collaborator.md) | Journey: [Journey 4](../journeys/journey-4-share-and-collect-feedback.md)

**As a** collaborator,
**I want** reconciliation to sync all changes colleagues made while I was away,
**so that** I'm fully up to date without checking each folder.

## Acceptance Criteria

- [ ] `reconcileOnStart()` processes all enabled mappings with `reconcileOnStart: true`
- [ ] New files, modified files, and deleted files are all handled
- [ ] Stats are reported per mapping via `applyReconcileStats()`
