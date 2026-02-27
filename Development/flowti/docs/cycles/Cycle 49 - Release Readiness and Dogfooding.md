---
type: DevelopmentCycle
feature: "[[Backlog Refinement - Post Cycle 48]]"
stage: planning
cycle: 49
date_planned: 2026-02-27
release_anchor:
  - "Theme 1: Ship It — Release Path"
  - "Theme 2: Dogfooding — Flowti Builds Flowti"
  - "Theme 5: Architecture — Invest in the Platform"
pbis:
  - "PBI-009: Ingest build/test reports as vault notes"
  - "PBI-NUD-001: Backlog refinement nudge"
  - "TD-119: README/CHANGELOG/AGENTS stats update"
  - "TD-128: DashboardsTab decomposition"
  - "TD-121: Session handler dedicated tests"
  - "RB-6/RB-7 scope decision"
bugs: []
tech_debt:
  - TD-119
  - TD-128
  - TD-121
estimated_increments: 6
pre_cycle_tests: 5315
pre_cycle_suites: 222
---

# Cycle 49 — Release Readiness and Dogfooding

## Release Anchor Themes

- **Theme 1: Ship It** — Close the gap between "technically ready" and "actually shippable"
- **Theme 2: Dogfooding** — Prove the product by using it to track its own development
- **Theme 5: Architecture** — Targeted debt reduction for long-term velocity

## Cycle Overview

Cycle 49 bridges stabilization (C48) with user-facing investment (C50). The focus is twofold: make the project's public artifacts (README, CHANGELOG, AGENTS) accurate and trustworthy, and begin dogfooding by ingesting our own build artifacts into the vault. Simultaneously, we pay down two medium-severity architecture debts (DashboardsTab decomposition, session handler tests) that have compounded over recent cycles.

This is a **hybrid cycle** — part release hygiene, part internal tooling, part architecture investment.

## User Pains

1. **README/CHANGELOG/AGENTS contain stale statistics** — Source files claimed at 110 (actual 230+), test counts outdated, service counts wrong. First impression for GitHub visitors is inaccurate (TD-119).
2. **DashboardsTab is 1,149 LOC with duplicated callback factories** — Every new tile type requires touching the same monolithic orchestrator (TD-128).
3. **Session handler modules have zero dedicated tests** — 6 handler modules (972 LOC) extracted in TD-101 are only tested indirectly through SessionService.test.ts. Complex branching logic is under-covered (TD-121).
4. **Build/test reports are not captured in the vault** — After every cycle we manually note test counts. Reports should be auto-ingested as typed vault notes for trend analysis (PBI-009).
5. **No nudge for backlog refinement** — Inbox grows unbounded without a periodic reminder to triage (PBI-NUD-001).
6. **Open release blockers have no explicit scope decision** — RB-6 (CLI installer) and RB-7 (pipeline merge) need a v1 vs v1.1 cut decision.

## Situation Assessment

- **Codebase**: 5,315 tests, 222 suites, 0 lint warnings, clean build
- **CSS**: 12 layered source files, build pipeline operational
- **Security**: SecretStore in place, ESLint compliance achieved
- **Architecture**: Session decomposed (C48), onboarding extracted (C47), CSS restructured (C48)
- **Gap**: Public-facing documentation is stale, internal dogfooding is manual, DashboardsTab and session handlers need attention

## Cycle Goals

1. **Update all public-facing statistics** (README.md, AGENTS.md, CHANGELOG.md) to reflect actual project state
2. **Decompose DashboardsTab** (1,149 LOC) into focused modules with extracted callback factory
3. **Add dedicated tests for 6 session handler modules** (closureHandlers, fieldHandlers, lifecycleHandlers, syncHandlers, taskHandlers, trackingHandlers)
4. **Ingest Vitest JSON reports and coverage summaries** as typed vault notes (TestReport, CoverageReport)
5. **Implement backlog refinement nudge** — configurable periodic reminder to triage inbox
6. **Document RB-6/RB-7 scope decision** — explicitly cut or defer to v1.1

## Scope

### In Scope
- TD-119: Stats update across README, AGENTS, CHANGELOG
- TD-128: DashboardsTab decomposition (extract TileCallbackFactory, reduce to <400 LOC orchestrator)
- TD-121: 6 dedicated test files for session handler modules (target: ~105 new tests)
- PBI-009: Build report ingestion (Vitest JSON → TestReport note, V8 coverage → CoverageReport note)
- PBI-NUD-001: Backlog refinement nudge (NudgeService integration, configurable interval)
- RB-6/RB-7 scope decision document

### Out of Scope
- New UI features (deferred to C50)
- Signal v2 adapters
- Hub framework changes (deferred to C52)
- Knowledge base expansion (deferred to C50)

## Increments

### Inc 1: Public Stats Update (TD-119)
**Theme**: Ship It
**Effort**: Small

Update README.md, AGENTS.md, and CHANGELOG.md with accurate statistics:
- Source files: 230+
- Tests: 5,315 (222 suites)
- Domains: 21
- Services: count from actual service files
- Tech debt: 32 open / 105 total
- CSS files: 12 layered source files

**Acceptance Criteria**:
- [ ] All three files contain consistent, accurate statistics
- [ ] Statistics match `npm test` output and file counts
- [ ] No manual counting — derive from scripts or build output where possible

### Inc 2: RB-6/RB-7 Scope Decision
**Theme**: Ship It
**Effort**: Tiny

Document explicit scope decisions for the two remaining release blockers:
- **RB-6 (CLI Installer)**: Defer to v1.1 — installer wizard is functional for v1
- **RB-7 (Pipeline Multi-Source Merge)**: Defer to v1.1 (Cycle 53) — single-source import works for v1

**Acceptance Criteria**:
- [ ] Decision documented in release blocker files with rationale
- [ ] Backlog Refinement note updated with decision

### Inc 3: DashboardsTab Decomposition (TD-128)
**Theme**: Architecture
**Effort**: Medium

Extract the duplicated tile callback factory from DashboardsTab (1,149 LOC):
- Extract `TileCallbackFactory` (or similar) as a standalone module
- Extract tile CRUD operations into `dashboardTileOperations.ts`
- Reduce DashboardsTab to orchestrator role (<500 LOC target)
- Maintain all existing test coverage

**Acceptance Criteria**:
- [ ] DashboardsTab < 500 LOC
- [ ] TileCallbackFactory is independently testable
- [ ] All existing dashboard tests pass
- [ ] New unit tests for extracted modules
- [ ] `npm test` green

### Inc 4: Session Handler Dedicated Tests (TD-121)
**Theme**: Architecture
**Effort**: Medium

Create dedicated test files for the 6 session handler modules extracted in TD-101:
- `closureHandlers.test.ts` (~40 tests — session close, note generation, summary)
- `fieldHandlers.test.ts` (~20 tests — field updates, validation)
- `lifecycleHandlers.test.ts` (~15 tests — state transitions, timer)
- `syncHandlers.test.ts` (~15 tests — note sync, activity log)
- `taskHandlers.test.ts` (~10 tests — task CRUD, status changes)
- `trackingHandlers.test.ts` (~5 tests — file tracking, dedup)

**Acceptance Criteria**:
- [ ] 6 new test files created
- [ ] ~105 new tests (adjust based on actual branching complexity)
- [ ] All handler edge cases covered (error paths, empty state, boundary conditions)
- [ ] `npm test` green
- [ ] No changes to production code (test-only increment)

### Inc 5: Build Report Ingestion (PBI-009)
**Theme**: Dogfooding
**Effort**: Medium

Auto-ingest Vitest JSON reports and V8 coverage summaries as typed vault notes:
- Run `vitest run --reporter=json --outputFile=reports/test-report.json`
- Parse JSON → create TestReport note (frontmatter: date, passed, failed, skipped, suites, duration)
- Parse V8 coverage summary → create CoverageReport note (frontmatter: date, lines, branches, functions, statements)
- Store in `docs/reports/tests/` and `docs/reports/coverage/`
- Emit `ingestion.report.created` event

**Acceptance Criteria**:
- [ ] TestReport note auto-generated from Vitest JSON output
- [ ] CoverageReport note auto-generated from V8 coverage summary
- [ ] Frontmatter contains structured, queryable metrics
- [ ] Reports stored in appropriate folders
- [ ] Event emitted on creation
- [ ] New tests for report parsing logic
- [ ] `npm test` green

### Inc 6: Backlog Refinement Nudge (PBI-NUD-001)
**Theme**: Dogfooding
**Effort**: Small

Implement a periodic nudge that reminds the user to triage their inbox:
- Leverage existing NudgeService (188 LOC) infrastructure
- Configurable interval (default: 7 days since last refinement)
- Nudge text: "Your inbox has {count} items. Time for a quick triage?"
- Clicking nudge navigates to inbox view
- Dismiss suppresses for configured interval

**Acceptance Criteria**:
- [ ] Nudge fires after configured interval
- [ ] Shows inbox item count
- [ ] Click navigates to inbox
- [ ] Dismiss resets timer
- [ ] Configurable in settings
- [ ] New tests for nudge trigger logic
- [ ] `npm test` green

## Dependency Graph

```
Inc 1 (Stats)     ──→ Independent
Inc 2 (RB Scope)  ──→ Independent
Inc 3 (TD-128)    ──→ Independent
Inc 4 (TD-121)    ──→ Independent
Inc 5 (PBI-009)   ──→ Independent
Inc 6 (PBI-NUD)   ──→ Independent (uses existing NudgeService)
```

All increments are independent and can be executed in any order.

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| DashboardsTab decomposition breaks dashboard rendering | High | Extract without behavior change; run existing tests after each step |
| Vitest JSON output format changes | Low | Pin Vitest version; schema validation on parse |
| NudgeService API insufficient for refinement nudge | Low | NudgeService already supports 8 events; extend if needed |
| Session handler tests reveal bugs in handlers | Medium | Fix bugs as found; this is the value of the tests |

## Success Metrics

| Metric | Target |
|--------|--------|
| New tests | ~120 (105 session handlers + 15 others) |
| Post-cycle tests | ~5,435 |
| DashboardsTab LOC | < 500 (from 1,149) |
| Tech debt resolved | TD-119, TD-128, TD-121 |
| Increments | 6 |
| Stats accuracy | All public files match actual counts |

## Deferred Items

- PBI-ONB-016: Command Catalog → Cycle 50
- PBI-ONB-014: Configurable Startpage → Cycle 50
- TD-87: Knowledge base expansion → Cycle 50
- Hub framework (TD-49, TD-50) → Cycle 52
- Signal ADO hardening → Cycle 54

## Definition of Ready

- [ ] All PBIs have acceptance criteria
- [ ] Tech debt items have clear scope and target metrics
- [ ] No blocking dependencies between increments
- [ ] Pre-cycle test baseline recorded (5,315 tests, 222 suites)

## Definition of Done

- [ ] All acceptance criteria met for each increment
- [ ] `npm test` green (tsc + eslint + vitest)
- [ ] `npm run build` succeeds
- [ ] No new lint warnings introduced
- [ ] All new code has tests
- [ ] Memory files updated (MEMORY.md, cycle-history.md)
- [ ] Three Amigos Review completed
