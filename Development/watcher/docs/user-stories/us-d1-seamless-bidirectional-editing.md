---
parent: "[[Development/watcher/docs/personas/Developer|Developer]]"
domain: Folder Watcher
id: US-D1
title: Seamless bidirectional editing
persona: Developer (Sam)
jtbd: Edit seamlessly
journey: "[[Development/watcher/docs/journeys/journey-2-edit-from-both-sides|Journey 2]]"
use-cases:
  - UC-03
---
# US-D1: Seamless bidirectional editing

> JTBD: Edit seamlessly | Persona: [The Developer](Development/watcher/docs/personas/Developer.md) | Journey: [Journey 2](../journeys/journey-2-edit-from-both-sides.md)

**As a** developer,
**I want** edits in Obsidian and VS Code to sync to each other within seconds,
**so that** I work fluidly without thinking about sync.

## Acceptance Criteria

- [ ] A file saved in Obsidian triggers reverse sync to the source folder
- [ ] A file changed in the source folder triggers forward sync to the vault
- [ ] Both directions complete within debounce + processing time
