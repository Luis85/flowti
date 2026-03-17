---
parent: "[[Development/watcher/docs/personas/Maintainer|Maintainer]]"
domain: Folder Watcher
id: US-M6
title: Test plan visibility
persona: Maintainer (Luis)
jtbd: Monitor code health
journey: "[[Development/watcher/docs/journeys/journey-6-maintain-and-harden|Journey 6]]"
use-cases: []
---
# US-M6: Test plan visibility

> JTBD: Monitor code health | Persona: [The Maintainer](Development/watcher/docs/personas/Maintainer.md) | Journey: [Journey 6](../journeys/journey-6-maintain-and-harden.md)

**As a** maintainer,
**I want** the test plan index to show coverage percentages and skip reasons per feature,
**so that** I know where the gaps are and what unblocks them.

## Acceptance Criteria

- [ ] `testplan.md` lists all features with pass/skip/total counts
- [ ] Skip reasons are categorized with unblocking strategies
- [ ] The index links to individual feature, use-case, and journey files
