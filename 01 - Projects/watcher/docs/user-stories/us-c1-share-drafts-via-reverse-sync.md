---
parent: "[[Development/watcher/docs/personas/Collaborator|Collaborator]]"
domain: Folder Watcher
id: US-C1
title: Share drafts via reverse sync
persona: Collaborator (Chris)
jtbd: Share drafts
journey: "[[Development/watcher/docs/journeys/journey-4-share-and-collect-feedback|Journey 4]]"
use-cases:
  - UC-03
---
# US-C1: Share drafts via reverse sync

> JTBD: Share drafts | Persona: [The Collaborator](Development/watcher/docs/personas/Collaborator.md) | Journey: [Journey 4](../journeys/journey-4-share-and-collect-feedback.md)

**As a** collaborator,
**I want** files I write in Obsidian to sync to the shared team folder automatically,
**so that** colleagues can review them without me sending files around.

## Acceptance Criteria

- [ ] VaultWatcher detects file changes in the target folder
- [ ] Reverse sync copies the file from the vault to the source folder
- [ ] The sync respects debounce timing (`MIN_REVERSE_DEBOUNCE_MS`)
