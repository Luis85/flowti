---
parent: "[[Content Creator|Content Creator]]"
domain: Folder Watcher
id: US-X8
title: Consistent filenames across platforms
persona: Content Creator (Max)
jtbd: Consistent filenames
journey: "[[Development/watcher/docs/journeys/journey-5-sync-across-devices|Journey 5]]"
use-cases:
  - UC-33
---
# US-X8: Consistent filenames across platforms

> JTBD: Consistent filenames | Persona: [The Content Creator](Content%20Creator.md) | Journey: [Journey 5](../journeys/journey-5-sync-across-devices.md)

**As a** content creator,
**I want** filenames with accents or special characters to match correctly across Android and Windows,
**so that** I don't get phantom duplicates across platforms.

## Acceptance Criteria

- [ ] `toVaultPath()` normalizes all paths to NFC
- [ ] A file created as NFD on Android matches its NFC equivalent on Windows
- [ ] No duplicate vault entries for the same logical filename
