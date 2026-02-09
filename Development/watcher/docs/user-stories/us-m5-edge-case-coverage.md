---
parent: "[[Development/watcher/docs/personas/Maintainer|Maintainer]]"
domain: Folder Watcher
id: US-M5
title: Edge-case coverage
persona: Maintainer (Luis)
jtbd: Understand failure modes
journey: "[[Development/watcher/docs/journeys/journey-6-maintain-and-harden|Journey 6]]"
use-cases:
  - UC-26
  - UC-32
  - UC-33
  - UC-43
---
# US-M5: Edge-case coverage

> JTBD: Understand failure modes | Persona: [The Maintainer](Development/watcher/docs/personas/Maintainer.md) | Journey: [Journey 6](../journeys/journey-6-maintain-and-harden.md)

**As a** maintainer,
**I want** tests for edge cases like EBUSY, ENOENT, corrupt state, and Unicode,
**so that** I cover real-world scenarios, not just happy paths.

## Acceptance Criteria

- [ ] `retry.test.ts` covers retryable vs non-retryable errors
- [ ] `SyncStateService.test.ts` covers corrupted and unknown-version state files
- [ ] `utils.test.ts` covers NFC/NFD normalization and path length limits
- [ ] `VaultWatcher.test.ts` covers queue overflow, file filtering, and rename directions
