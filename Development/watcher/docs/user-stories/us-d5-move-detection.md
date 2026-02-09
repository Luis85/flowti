---
parent: "[[Development/watcher/docs/personas/Developer|Developer]]"
domain: Folder Watcher
id: US-D5
title: Move detection
persona: Developer (Sam)
jtbd: Detect moves
journey: "[[Development/watcher/docs/journeys/journey-2-edit-from-both-sides|Journey 2]]"
use-cases:
  - UC-13
---
# US-D5: Move detection

> JTBD: Detect moves | Persona: [The Developer](Development/watcher/docs/personas/Developer.md) | Journey: [Journey 2](../journeys/journey-2-edit-from-both-sides.md)

**As a** developer,
**I want** file renames in the source folder to be reflected as moves in the vault,
**so that** my Obsidian links and backlinks stay intact.

## Acceptance Criteria

- [ ] A delete + add within `MOVE_DETECT_WINDOW_MS` with matching size and extension is treated as a move
- [ ] The vault file is renamed, not deleted and re-created
- [ ] VaultWatcher handles renames within, into, and out of the target folder
