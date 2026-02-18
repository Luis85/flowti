---
type: DecisionNote
adr: ADR-028
title: Obsidian CLI for Automated Testing
status: Proposed
date: 2026-02-18
domain: cross-cutting
category: Testing
drivers:
  - Integration Test Coverage
  - CI/CD Readiness
  - Confidence in Obsidian API Interactions
tags:
  - decision
  - testing
  - ci
  - obsidian
---

# ADR-028: Obsidian CLI for Automated Testing

## Status

**Proposed** — not yet implemented.

## Context

Flowti's test suite (2,177 tests across 84 suites) runs entirely in Node.js via Vitest, using mock stubs for all Obsidian APIs (`obsidian-stub.ts`). This covers domain logic, service behavior, and UI rendering comprehensively, but cannot verify:

1. **Real Obsidian API interactions** — `vault.create()`, `vault.modify()`, `metadataCache`, `workspace.getLeaf()`, file system events, `revealInFolder()`, etc.
2. **Plugin lifecycle** — `onload()` → `onLayoutReady()` → `onunload()` sequence with real Obsidian
3. **CSS rendering** — Obsidian theme integration, view container behavior, `.ft-section` class rendering
4. **Cross-plugin compatibility** — interactions with Dataview, Templater, or other community plugins

### The Question: How Do We Test Against Real Obsidian?

Three approaches considered:

1. **Obsidian CLI (headless)** — Use Obsidian's headless mode or a community CLI tool to launch a vault, load the plugin, and run integration tests programmatically.
2. **Playwright/Puppeteer E2E** — Launch Obsidian as a desktop app, automate via browser automation tools. Full UI testing.
3. **Manual test protocol** — Formalized manual test scripts (`manual-test-strategy.md` already exists) with checklist verification.

## Decision

**Option 1: Obsidian CLI for integration tests, complementing existing Vitest unit tests.**

### Why CLI Over E2E

- **Speed** — headless execution is orders of magnitude faster than Playwright controlling a desktop app
- **CI-friendly** — CLI can run in GitHub Actions without display servers or Electron setup
- **Focused** — tests target API behavior (vault operations, event sequences), not pixel-perfect rendering
- **Existing pattern** — community tools like `obsidian-cli` and `hot-reload` demonstrate headless vault operation

### Why Not Replace Unit Tests

The CLI approach **complements** rather than replaces the Vitest suite:

| Layer | Tool | Tests | What It Covers |
|-------|------|-------|----------------|
| Unit | Vitest + mocks | 2,177 | Domain logic, service behavior, UI rendering |
| Integration | Obsidian CLI | ~50 (target) | Real vault I/O, plugin lifecycle, event flow |
| Manual | Checklist | ~19 items | CSS rendering, UX flows, cross-plugin |

## Open Questions

1. **Which CLI tool?** Community options exist but maturity varies. Evaluate `obsidian-cli`, `run-obsidian`, or a custom Electron launcher.
2. **Vault fixture management?** Tests need a clean vault state. Options: fresh vault per suite, fixture vault with known state, teardown/cleanup hooks.
3. **CI infrastructure?** GitHub Actions would need Node.js + Electron (or headless Chromium). Cost and setup complexity.
4. **Test scope?** Start with critical paths: plugin load/unload, session CRUD with real vault files, file rename events, settings persistence. Expand later.
5. **Maintenance burden?** CLI API changes with Obsidian updates. Tests must not become a fragile maintenance sink.

## Consequences

### Positive

- **Real API confidence** — verify vault operations, metadataCache timing, file system events
- **CI integration** — automated regression testing on every PR
- **Bug prevention** — catch issues that mocks hide (e.g., metadataCache timing bugs, file collision edge cases)

### Negative

- **Setup complexity** — Obsidian CLI tooling is not first-party; community tools may lag behind Obsidian releases
- **Execution time** — CLI tests will be slower than Vitest (seconds vs. milliseconds per test)
- **Environment dependency** — tests require Obsidian binary or compatible runtime

### Neutral

- **No changes to existing tests** — Vitest suite remains the primary test layer
- **Incremental adoption** — start with 5-10 smoke tests, expand based on value

## Related

- ADR-012: Build Pipeline as Quality Gate (CLI tests would be an additional gate)
- ADR-016: Real EventBus in Tests (already uses real EventBus, not mocks)
- Reference: `docs/inbox/manual-test-strategy.md` (existing manual test protocol)
- PRD: (cross-cutting — applies to all features)
