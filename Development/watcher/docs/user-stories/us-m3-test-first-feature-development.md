---
parent: "[[Development/watcher/docs/personas/Maintainer|Maintainer]]"
domain: Folder Watcher
id: US-M3
title: Test-first feature development
persona: Maintainer (Luis)
jtbd: Add a feature safely
journey: "[[Development/watcher/docs/journeys/journey-6-maintain-and-harden|Journey 6]]"
use-cases: []
---
# US-M3: Test-first feature development

> JTBD: Add a feature safely | Persona: [The Maintainer](Development/watcher/docs/personas/Maintainer.md) | Journey: [Journey 6](../journeys/journey-6-maintain-and-harden.md)

**As a** maintainer,
**I want** to write acceptance tests before touching production code,
**so that** new features work as designed from the start.

## Acceptance Criteria

- [ ] New features have a corresponding user journey or feature test
- [ ] Tests are written before or alongside the implementation
- [ ] Skipped tests (`it.skip`) mark unimplemented scenarios with clear descriptions
