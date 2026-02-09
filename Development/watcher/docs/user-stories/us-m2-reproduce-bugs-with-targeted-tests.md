---
parent: "[[Development/watcher/docs/personas/Maintainer|Maintainer]]"
domain: Folder Watcher
id: US-M2
title: Reproduce bugs with targeted tests
persona: Maintainer (Luis)
jtbd: Diagnose a bug report
journey: "[[Development/watcher/docs/journeys/journey-6-maintain-and-harden|Journey 6]]"
use-cases: []
---
# US-M2: Reproduce bugs with targeted tests

> JTBD: Diagnose a bug report | Persona: [The Maintainer](Development/watcher/docs/personas/Maintainer.md) | Journey: [Journey 6](../journeys/journey-6-maintain-and-harden.md)

**As a** maintainer,
**I want** to reproduce user-reported issues with a minimal test,
**so that** I can fix the root cause, not just the symptom.

## Acceptance Criteria

- [ ] Each bug fix includes at least one regression test
- [ ] The test fails before the fix and passes after
- [ ] The test is placed in the relevant test file (service, watcher, feature)
