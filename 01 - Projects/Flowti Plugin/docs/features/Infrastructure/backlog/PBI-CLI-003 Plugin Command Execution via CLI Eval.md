---
type: ProductBacklogItem
feature: "[[Infrastructure PRD]]"
priority: medium
stage: done
planned_in: "[[Cycle 53 - Obsidian CLI Spike]]"
delivered_in: "[[Cycle 53 - Obsidian CLI Spike]]"
estimated_loc: 60
actual_loc: 316
estimated_tests: 10
actual_e2e_tests: 69
effort: medium
dependencies:
  - "[[PBI-CLI-002 E2E Test Foundation with Obsidian CLI]]"
tags:
  - backlog
  - cli
  - testing
  - infrastructure
related:
  - "[[ADR-028 Obsidian CLI for Automated Testing]]"
---

## User Story

As a plugin developer, I want to execute Flowti commands and inspect plugin state from the terminal via `obsidian eval` so that E2E tests can trigger and verify plugin behavior programmatically, not just file-level operations.

### User Pains

- Current E2E scope is limited to file/search operations — can't test plugin-level behavior
- No way to trigger Flowti palette commands from outside the UI
- No way to inspect in-memory state (session count, inbox count, event history) for assertions

### User Needs

- Access Flowti plugin instance via `eval`
- Execute Flowti commands programmatically
- Inspect plugin state for test assertions
- Verify event emission and handler execution

## Solution Statement

### Functional Requirements

- [x] Access Flowti plugin instance via `obsidian eval code="app.plugins.plugins['flowti-ibde']"` — used throughout all E2E tests
- [x] Execute at least one Flowti command via `eval`-based handler invocation — `executeCommand()` + `command id=`
- [x] Verify event emission by inspecting state changes after `eval` — `_e2eEventTrace` wildcard listener
- [x] Prototype EventBus interaction: emit events and verify handlers fire — `hub.navigate` → `hub.tab.changed` chain verified
- [x] Error handling for eval failures (plugin not loaded, syntax errors) — EvalResult with success/value/error

### Architecture Seams

| File | Type | Purpose |
|------|------|---------|
| `src/infrastructure/cli/ObsidianCli.ts` | Modified | Add eval-specific helpers (e.g., `getPluginState()`, `executeCommand()`) |
| `src/infrastructure/cli/types.ts` | Modified | Add eval result types |
| `tests/infrastructure/cli/ObsidianCli.eval.test.ts` | New | Eval wrapper unit tests |
| `tests/e2e/eval.test.ts` | New | E2E eval integration tests |

## INVEST Assessment

| Criterion | Met? | Notes |
|-----------|------|-------|
| Independent | Partial | Depends on PBI-CLI-002 (CLI wrapper must exist). Scope is self-contained once wrapper exists |
| Negotiable | Yes | Depth of state inspection and number of commands tested can be adjusted |
| Valuable | Yes | Unlocks plugin-level E2E testing — the highest-value test category |
| Estimable | Yes | ~60 LOC production, ~80 LOC test. Single increment |
| Small | Yes | Builds on existing wrapper; focused on eval-specific patterns |
| Testable | Yes | Unit tests with mock eval; E2E tests against live Obsidian |

## Acceptance Criteria

- [x] Can access Flowti plugin instance via `eval` — `app.plugins.plugins['flowti-ibde']` used in all E2E suites
- [x] Can execute at least one Flowti command via `eval` — 36 commands verified, `executeCommand()` used in all journeys
- [x] Can verify event emission via state inspection — wildcard trace captures all events, `assertEventEmitted()` helper
- [x] Tests for `eval`-based interactions — 69 E2E tests exercise eval extensively
- [x] `npm test` green (E2E tests gated behind flag) — unit tests (5,776) unaffected

## Delivery Notes

Delivered as Inc 4 of Cycle 53. `eval` proved to be the most powerful CLI capability — enables full `app` context access for state inspection, command execution, EventBus interaction, DOM manipulation, screenshot capture, and notice display. All subsequent E2E infrastructure (fixtures, journey runner, navigation helpers) builds on eval patterns.
