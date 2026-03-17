---
parent: "[[Development/watcher/docs/personas/Maintainer|Maintainer]]"
domain: Folder Watcher
id: US-M1
title: Validate changes via test suite
persona: Maintainer (Luis)
jtbd: Validate a change
journey: "[[Development/watcher/docs/journeys/journey-6-maintain-and-harden|Journey 6]]"
use-cases: []
---
# US-M1: Validate changes via test suite

> JTBD: Validate a change | Persona: [The Maintainer](Development/watcher/docs/personas/Maintainer.md) | Journey: [Journey 6](../journeys/journey-6-maintain-and-harden.md)

**As a** maintainer,
**I want** the full test suite to give a clear pass/fail after every change,
**so that** I know nothing is broken before releasing.

## Acceptance Criteria

- [ ] `npm run build` runs vitest, typedoc, tsc, eslint, and esbuild in sequence
- [ ] Any test failure causes the pipeline to exit with a non-zero code
- [ ] All 460+ tests pass on a clean build
