---
type: ProductBacklogItem
feature: "[[Infrastructure PRD]]"
priority: high
stage: planned
planned_in: "[[Cycle 53 - Obsidian CLI Spike]]"
estimated_loc: 200
estimated_tests: 15
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
- [ ] `ObsidianCli` class wrapping `execSync`/`exec` calls
- [ ] Methods: `run()`, `eval()`, `createFile()`, `readFile()`, `deleteFile()`, `setProperty()`, `search()`, `getPlugins()`
- [ ] JSON output parsing for structured assertions
- [ ] Error handling for CLI failure modes (not running, timeout)
- [ ] Configurable vault targeting via `vault=` parameter

**E2E Test Harness (Inc 3)**:
- [ ] Test fixture management: create test folder, seed files, teardown
- [ ] Separate vitest config for E2E (longer timeouts, sequential execution)
- [ ] Environment flag gating (`OBSIDIAN_E2E=1`)
- [ ] 5 smoke tests: plugin loaded, file CRUD, frontmatter round-trip, search, plugin reload

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

- [ ] CLI wrapper class with typed methods
- [ ] JSON output parsing for structured data
- [ ] Error handling for CLI failure modes
- [ ] Unit tests for wrapper (mock execSync)
- [ ] E2E test harness with setup/teardown
- [ ] 5 smoke tests pass against running Obsidian instance
- [ ] Tests gated behind environment flag
- [ ] Separate vitest config for E2E
- [ ] `npm test` green
