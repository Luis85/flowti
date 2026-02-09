---
parent: "[[Development/watcher/docs/personas/Collaborator|Collaborator]]"
domain: Folder Watcher
id: US-C3
title: Preserve both versions on conflict
persona: Collaborator (Chris)
jtbd: Preserve both versions
journey: "[[Development/watcher/docs/journeys/journey-4-share-and-collect-feedback|Journey 4]]"
use-cases:
  - UC-09
---
# US-C3: Preserve both versions on conflict

> JTBD: Preserve both versions | Persona: [The Collaborator](Development/watcher/docs/personas/Collaborator.md) | Journey: [Journey 4](../journeys/journey-4-share-and-collect-feedback.md)

**As a** collaborator,
**I want** a renamed conflict copy created when both sides edit simultaneously,
**so that** neither version is lost and I can merge manually.

## Acceptance Criteria

- [ ] With `conflictResolution: "rename"`, the incoming file gets a `(conflict ...)` suffix
- [ ] The original vault file remains untouched
- [ ] Multiple concurrent conflicts produce unique filenames
