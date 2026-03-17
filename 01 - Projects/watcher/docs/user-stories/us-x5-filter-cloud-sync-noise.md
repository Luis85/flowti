---
parent: "[[Content Creator|Content Creator]]"
domain: Folder Watcher
id: US-X5
title: Filter cloud sync noise
persona: Content Creator (Max)
jtbd: Filter cloud noise
journey: "[[Development/watcher/docs/journeys/journey-5-sync-across-devices|Journey 5]]"
use-cases:
  - UC-17
  - UC-16
---
# US-X5: Filter cloud sync noise

> JTBD: Filter cloud noise | Persona: [The Content Creator](Content%20Creator.md) | Journey: [Journey 5](../journeys/journey-5-sync-across-devices.md)

**As a** content creator,
**I want** OneDrive temp files and conflict copies filtered out,
**so that** my vault only contains real content.

## Acceptance Criteria

- [ ] `isTempFile()` matches `.tmp`, `.partial`, `.crdownload`
- [ ] `createIgnoredMatcher()` filters dotfiles and system files
- [ ] OneDrive conflict copies (`file (1).md`) can be handled via exclude patterns
