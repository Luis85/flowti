---
parent: "[[Development/watcher/docs/personas/Maintainer|Maintainer]]"
domain: Folder Watcher
id: US-M4
title: Safe refactoring
persona: Maintainer (Luis)
jtbd: Refactor with confidence
journey: "[[Development/watcher/docs/journeys/journey-6-maintain-and-harden|Journey 6]]"
use-cases: []
---
# US-M4: Safe refactoring

> JTBD: Refactor with confidence | Persona: [The Maintainer](Development/watcher/docs/personas/Maintainer.md) | Journey: [Journey 6](../journeys/journey-6-maintain-and-harden.md)

**As a** maintainer,
**I want** all tests to stay green after extracting classes or reorganizing modules,
**so that** I know the refactor preserved behavior.

## Acceptance Criteria

- [ ] No test changes are needed when refactoring internal implementation details
- [ ] Public API contracts (function signatures, return types) remain stable
- [ ] Import paths update cleanly (no broken `../../` references)
