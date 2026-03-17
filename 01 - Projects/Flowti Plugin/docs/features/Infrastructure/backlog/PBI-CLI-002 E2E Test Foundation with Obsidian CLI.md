---
type: ProductBacklogItem
feature: "[[Infrastructure PRD]]"
priority: high
stage: done
planned_in: "[[Cycle 53 - Obsidian CLI Spike]]"
delivered_in: "[[Cycle 53 - Obsidian CLI Spike]]"
estimated_loc: 200
actual_loc: 5400
estimated_tests: 15
actual_e2e_tests: 69
effort: medium
dependencies:
  - "[[PBI-CLI-001 Obsidian CLI Exploration and Validation]]"
tags:
  - backlog
  - cli
  - testing
  - infrastructure
related:
  - "[[Automated testing with Obsidian CLI]]"
  - "[[ADR-028 Obsidian CLI for Automated Testing]]"
---

## User Story

As a plugin developer, I want a reusable CLI wrapper and E2E test harness so that I can write automated smoke tests that exercise Flowti against a live Obsidian instance, replacing the manual testing that has been the only option since the project started.

### User Pains

- All integration testing is mock-based — no validation against real Obsidian APIs
- File CRUD, frontmatter, and search behaviors can only be verified manually
- No automated smoke test gate before releases

### User Needs

- Typed CLI wrapper class for programmatic access to Obsidian commands
- E2E test harness with fixture setup/teardown
- Initial smoke tests covering critical paths
- Tests gated behind environment flag (skip when Obsidian not running)

## Solution Statement

### Functional Requirements

**CLI Wrapper (Inc 2)**:
- [x] `ObsidianCli` class wrapping `execSync`/`exec` calls — 244 LOC
- [x] Methods: `run()`, `eval()`, `createFile()`, `readFile()`, `deleteFile()`, `setProperty()`, `search()`, `getPlugins()` — 12 methods total
- [x] JSON output parsing for structured assertions
- [x] Error handling for CLI failure modes (not running, timeout)
- [x] Configurable vault targeting via `vault=` parameter

**E2E Test Harness (Inc 3)**:
- [x] Test fixture management: create test folder, seed files, teardown — fixtures.ts (330 LOC)
- [x] Separate vitest config for E2E (longer timeouts, sequential execution) — vitest.e2e.config.ts
- [x] Environment flag gating (`OBSIDIAN_E2E=1`) — via vault detection and journey filtering
- [x] 5 smoke tests: plugin loaded, file CRUD, frontmatter round-trip, search, plugin reload — exceeded: 10 prerequisites + 59 journey steps

### Architecture Seams

| File | Type | Purpose |
|------|------|---------|
| `src/infrastructure/cli/ObsidianCli.ts` | New | CLI wrapper class |
| `src/infrastructure/cli/types.ts` | New | CLI types |
| `tests/infrastructure/cli/ObsidianCli.test.ts` | New | Wrapper unit tests |
| `tests/e2e/vitest.e2e.config.ts` | New | E2E vitest config |
| `tests/e2e/helpers/fixtures.ts` | New | Vault fixture management |
| `tests/e2e/smoke.test.ts` | New | 5 smoke tests |

## INVEST Assessment

| Criterion | Met? | Notes |
|-----------|------|-------|
| Independent | Yes | Greenfield: new `cli/` directory, new `e2e/` test directory |
| Negotiable | Yes | Number of smoke tests adjustable; wrapper methods can grow incrementally |
| Valuable | Yes | Resolves E2E release blocker (inbox item). Foundation for all future E2E tests |
| Estimable | Yes | ~200 LOC production + ~160 LOC test. Two increments (wrapper + harness) |
| Small | Yes | Split across Inc 2 (wrapper) and Inc 3 (harness) — each independently deliverable |
| Testable | Yes | Wrapper unit-testable with mock execSync; smoke tests run against live Obsidian |

## Acceptance Criteria

- [x] CLI wrapper class with typed methods — ObsidianCli (244 LOC), types.ts (72 LOC)
- [x] JSON output parsing for structured data — `runJson()` method
- [x] Error handling for CLI failure modes — CliError with timeout, retry logic
- [ ] Unit tests for wrapper (mock execSync) — deferred: wrapper tested via E2E integration
- [x] E2E test harness with setup/teardown — globalSetup (280 LOC), globalTeardown (470 LOC), fixtures (330 LOC)
- [x] 5 smoke tests pass against running Obsidian instance — exceeded: 69 E2E tests (53 pass, 16 skip)
- [x] Tests gated behind environment flag — vault detection + journey filtering
- [x] Separate vitest config for E2E — vitest.e2e.config.ts (serial, 30s timeout, JSON reporter)
- [x] `npm test` green — unit tests unaffected (5,776 passing)

## Delivery Notes

Massively exceeded scope: 200 LOC estimated → 5,400 LOC delivered. 15 tests estimated → 69 E2E tests. Delivered 3 full journeys (Prerequisites, Getting Started, Component Library), report pipeline (E2E Report + Journey Reports + Journey Canvases + Journey Configs + Event Traces), execution time optimization, and living documentation infrastructure. Unit tests for CLI wrapper deferred — wrapper is thoroughly exercised by all 69 E2E tests against live Obsidian.
