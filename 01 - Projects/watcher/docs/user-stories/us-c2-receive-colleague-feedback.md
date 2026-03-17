---
parent: "[[Development/watcher/docs/personas/Collaborator|Collaborator]]"
domain: Folder Watcher
id: US-C2
title: Receive colleague feedback
persona: Collaborator (Chris)
jtbd: Receive feedback
journey: "[[Development/watcher/docs/journeys/journey-4-share-and-collect-feedback|Journey 4]]"
use-cases:
  - UC-01
  - UC-03
---
# US-C2: Receive colleague feedback

> JTBD: Receive feedback | Persona: [The Collaborator](Development/watcher/docs/personas/Collaborator.md) | Journey: [Journey 4](../journeys/journey-4-share-and-collect-feedback.md)

**As a** collaborator,
**I want** colleague edits in the shared folder to sync back into my vault,
**so that** I see feedback inside Obsidian where I do my writing.

## Acceptance Criteria

- [ ] Forward sync imports changed files from the source folder into the vault
- [ ] Only files with changed mtime or size trigger a sync
- [ ] The vault file content matches the source after sync
