---
type: DecisionNote
adr: ADR-028
title: Obsidian CLI for Automated Testing
status: Accepted
date: 2026-02-18
date_accepted: 2026-02-28
resolved_cycle: "[[Cycle 53 - Obsidian CLI Spike]]"
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

**Accepted** — implemented in Cycle 53 (Obsidian CLI Spike). The official Obsidian CLI (1.12+) provides 100+ commands with direct access to the app context via `eval`.

## Context

Flowti's test suite (5,813 tests across 252 suites) runs entirely in Node.js via Vitest, using mock stubs for all Obsidian APIs (`obsidian-stub.ts`). This covers domain logic, service behavior, and UI rendering comprehensively, but cannot verify:

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

## Open Questions (Resolved)

1. **Which CLI tool?** → **Official Obsidian CLI (1.12+)**. Released 2026-02-27. 100+ commands. Community tools are no longer needed.
2. **Vault fixture management?** → **CLI-based setup/teardown.** `obsidian create path=... content=...` for setup, `obsidian delete path=...` for teardown. Timestamp-prefixed folders (`_e2e-test-<ts>`) prevent collision. See `tests/e2e/helpers/fixtures.ts`.
3. **CI infrastructure?** → **Deferred to post-spike.** Obsidian must be running (no headless mode). CI requires Xvfb or similar display server. Tests gated behind `OBSIDIAN_E2E=1` env flag so they skip gracefully in CI until infrastructure is ready.
4. **Test scope?** → **5 smoke tests + 4 eval tests.** Plugin loaded, file CRUD, frontmatter round-trip, search, plugin reload, plugin state inspection, command execution, service key enumeration. See `tests/e2e/smoke.test.ts` and `tests/e2e/eval.test.ts`.
5. **Maintenance burden?** → **Low.** Official Obsidian CLI with stable API. Community adoption growing. `IProcessRunner` injection seam allows unit testing without CLI binary.

## Consequences

### Positive

- **Real API confidence** — verify vault operations, metadataCache timing, file system events
- **CI integration** — automated regression testing on every PR
- **Bug prevention** — catch issues that mocks hide (e.g., metadataCache timing bugs, file collision edge cases)

### Negative

- ~~**Setup complexity** — Obsidian CLI tooling is not first-party~~ → Resolved: official CLI since 1.12
- **Execution time** — CLI tests are slower than Vitest (~1-3s per test vs. milliseconds)
- **Environment dependency** — tests require Obsidian running (no headless mode yet)

### Neutral

- **No changes to existing tests** — Vitest suite remains the primary test layer
- **Incremental adoption** — start with 5-10 smoke tests, expand based on value

## Implementation

### Architecture

| Component | Path | Purpose |
|-----------|------|---------|
| CLI types | `src/infrastructure/cli/types.ts` | `IProcessRunner`, `ObsidianCliOptions`, `CliError`, `EvalResult`, `PluginEntry`, `PluginStateSnapshot` |
| CLI wrapper | `src/infrastructure/cli/ObsidianCli.ts` | Typed wrapper — `run()`, `eval()`, `createFile()`, `readFile()`, `deleteFile()`, `setProperty()`, `search()`, `getPlugins()`, `reloadPlugin()`, `executeCommand()`, `getPluginState()`, `evalJson()` |
| E2E config | `tests/e2e/vitest.e2e.config.ts` | Standalone vitest config — serial execution, 30s timeout |
| Fixtures | `tests/e2e/helpers/fixtures.ts` | `createFixture()` with timestamp-prefixed folders |
| Smoke tests | `tests/e2e/smoke.test.ts` | 5 smoke tests (plugin, CRUD, frontmatter, search, reload) |
| Eval tests | `tests/e2e/eval.test.ts` | 4 eval tests (instance access, state, command, services) |
| Unit tests | `tests/infrastructure/cli/ObsidianCli.test.ts` | 26 unit tests for wrapper |
| Eval unit tests | `tests/infrastructure/cli/ObsidianCli.eval.test.ts` | 11 unit tests for eval methods |

### Test Layers (Updated)

| Layer | Tool | Tests | What It Covers |
|-------|------|-------|----------------|
| Unit | Vitest + mocks | 5,813 | Domain logic, service behavior, UI rendering |
| E2E | Obsidian CLI | 9 | Real vault I/O, plugin lifecycle, eval state inspection |
| Manual | Checklist | ~19 items | CSS rendering, UX flows, cross-plugin |

## Related

- ADR-012: Build Pipeline as Quality Gate (CLI tests would be an additional gate)
- ADR-016: Real EventBus in Tests (already uses real EventBus, not mocks)
- [[Cycle 53 - Obsidian CLI Spike]] — implementation cycle
- [[PBI-CLI-001 Obsidian CLI Exploration and Validation]]
- [[PBI-CLI-002 E2E Test Foundation with Obsidian CLI]]
- [[PBI-CLI-003 Plugin Command Execution via CLI Eval]]
- PRD: (cross-cutting — applies to all features)
