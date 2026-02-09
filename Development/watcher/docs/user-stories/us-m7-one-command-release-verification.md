---
parent: "[[Development/watcher/docs/personas/Maintainer|Maintainer]]"
domain: Folder Watcher
id: US-M7
title: One-command release verification
persona: Maintainer (Luis)
jtbd: Ship a release
journey: "[[Development/watcher/docs/journeys/journey-6-maintain-and-harden|Journey 6]]"
use-cases: []
---
# US-M7: One-command release verification

> JTBD: Ship a release | Persona: [The Maintainer](Development/watcher/docs/personas/Maintainer.md) | Journey: [Journey 6](../journeys/journey-6-maintain-and-harden.md)

**As a** maintainer,
**I want** `npm run build` to verify tests, types, lint, and bundle in one command,
**so that** the release artifact is verified end-to-end.

## Acceptance Criteria

- [ ] The build script runs vitest → typedoc → tsc → eslint → esbuild in order
- [ ] Any stage failure aborts the pipeline
- [ ] The output `main.js` is a valid Obsidian plugin bundle
