---
plugin: "[[Development/watcher/README|README]]"
domain: Folder Watcher
type: Persona
---
# Persona: The Maintainer

> Used in: [Journey 6 — Maintain and Harden the Plugin](../journeys/journey-6-maintain-and-harden.md)

## Profile

| | |
|---|---|
| **Name** | Luis |
| **Role** | Plugin developer / maintainer |
| **Tech level** | Advanced — TypeScript, Obsidian API, Node.js, CI/CD |
| **Platform** | Windows 11 |

## Context

Luis builds and maintains the Folder Watcher plugin. He works in VS Code with a fast feedback loop (vitest watch, esbuild hot-reload). His day-to-day concerns are different from end users: he cares about code health, test coverage, safe refactoring, and catching regressions before they reach users. He is the only developer, so every architectural decision sticks — there is no review team to catch oversights.

## Goals

- Catch regressions early with comprehensive automated tests
- Refactor confidently without breaking existing behavior
- Understand failure modes before users encounter them
- Keep the codebase maintainable as feature count grows
- Ship releases that work reliably on Windows, macOS, and Linux

## Pain Points

- Silent error swallowing hides real problems until users report them
- Test gaps in critical paths (VaultWatcher, retry logic) leave blind spots
- Large files (FileSyncService ~1500 LOC) are hard to reason about and test
- Edge cases on Windows (MAX_PATH, EBUSY locks, Unicode NFD vs NFC) don't surface on dev machines
- No integration tests against real file systems — mocks may drift from actual behavior
- Obsidian API surface is large — mocks can go stale

## Jobs to be Done

See [maintainer JTBD](../jtbd/maintainer.md)

## User Stories

See [maintainer user stories](../user-stories/maintainer.md) (8 stories: US-M1 – US-M8)

## Primary Features (from a maintainer perspective)

| Feature | Why it matters |
|---------|---------------|
| [Safety](../features/feature-07-safety.md) | Path traversal, size limits, Unicode — the defensive layer |
| [Reliability](../features/feature-06-reliability.md) | Retry, loop detection, debounce — the resilience layer |
| [Reconciliation](../features/feature-05-reconciliation.md) | Most complex feature; highest regression risk |
| [Persistence](../features/feature-10-persistence.md) | Corrupt/missing state recovery — silent failures are worst |
| [Settings](../features/feature-08-settings.md) | Mapping validation, defaults — misconfiguration = data loss |
