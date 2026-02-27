---
type: DevelopmentCycle
feature: "[[Backlog Refinement - Post Cycle 48]]"
stage: ready
cycle: 49
date_planned: 2026-02-27
release_anchor:
  - "Theme 1: Ship It — Release Path"
  - "Theme 2: Dogfooding — Flowti Builds Flowti"
  - "Theme 5: Architecture — Invest in the Platform"
pbis:
  - "TD-119: README/CHANGELOG/AGENTS stats update"
  - "RB-6/RB-7 scope decision"
  - "TD-128: DashboardsTab decomposition"
  - "TD-121: Session handler dedicated tests"
  - "PBI-009: Ingest build/test reports as vault notes"
  - "PBI-NUD-001: Backlog refinement nudge"
bugs: []
tech_debt:
  - TD-119
  - TD-128
  - TD-121
estimated_increments: 6
estimated_tests: 120
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

This is a **hybrid cycle** — part release hygiene, part internal tooling, part architecture investment. It is not driven by a single feature PRD but by the [[Backlog Refinement - Post Cycle 48]] strategic review.

## FRI Assessment

This is a **continuation/debt cycle** (threshold: ≥11/35). FRI scored against the Backlog Refinement document:

| Dimension | Score | Rationale |
|-----------|-------|-----------|
| Strategy | 5/5 | Directly aligned with 3 of 5 Release Anchor Themes |
| Scope | 5/5 | Clear in/out scope; 6 increments with explicit boundaries |
| Architecture | 4/5 | TD-128 seams identified (callback factory, context builder); PBI-009 needs DocService extension |
| Event Integration | 4/5 | Nudge events exist (8 types); report ingestion event identified; session handlers exercise 40+ events |
| Data Model | 3/5 | NudgeConfig model exists but needs interval extension; TestReport/CoverageReport schemas need definition |
| UI Consistency | 4/5 | Nudge uses existing notification pattern; stats update is doc-only; DashboardsTab extraction is internal |
| Validation & Testing | 4/5 | Test intent clear per increment; 120 new tests targeted |
| **Total** | **29/35** | **Exceeds both thresholds (19 new, 11 continuation)** |

## User Pains

1. **README/CHANGELOG/AGENTS contain stale statistics** — Source files claimed at 110 (actual 230+), test counts outdated at 2,855 (actual 5,315), service counts wrong. First impression for GitHub visitors is inaccurate (TD-119).
2. **DashboardsTab is 1,060 LOC with duplicated callback factories** — 37 callback handlers wired inline; 11 are duplicated with AnalyticsDashboardPage (665 LOC). Every new tile type requires touching the same monolithic orchestrator (TD-128).
3. **Session handler modules have zero dedicated tests** — 6 handler modules (1,047 LOC, 52 exported functions) extracted in TD-101 are only tested indirectly through SessionService.test.ts. Two silent `catch {}` blocks in syncHandlers are never exercised directly (TD-121).
4. **Build/test reports are not captured in the vault** — After every cycle we manually note test counts. Build reports exist (185+ in `docs/reports/builds/`) but no test or coverage reports are auto-generated (PBI-009).
5. **No nudge for backlog refinement** — Current NudgeService supports daily time-based nudges (HH:MM) but not periodic interval nudges (every N days). Inbox grows unbounded without a reminder to triage (PBI-NUD-001).
6. **Open release blockers have no explicit scope decision** — RB-6 (CLI installer) and RB-7 (pipeline merge) need a v1 vs v1.1 cut decision.

## Situation Assessment

- **Codebase**: 5,315 tests, 222 suites, 0 lint warnings, clean build
- **CSS**: 12 layered source files in `css/`, build pipeline operational
- **Security**: SecretStore in place, ESLint marketplace compliance achieved (RB-2 resolved)
- **Architecture**: Session decomposed (C48, 982→26 LOC barrel), onboarding extracted (C47), CSS restructured (C48)
- **Build**: `npm test` green, `npm run build` green, no critical bugs open
- **Previous cycle**: C48 closed with retrospective completed, TASM 34/35
- **Gap**: Public-facing documentation stale, internal dogfooding manual, DashboardsTab and session handlers need attention

## Cycle Goals

1. **Ship readiness**: Make all public-facing artifacts accurate and decide on remaining release blockers
2. **Architecture debt**: Decompose DashboardsTab and add dedicated tests for session handler modules
3. **Dogfooding foundation**: Begin ingesting our own build artifacts and implement periodic refinement nudge

## Scope

### In Scope
- TD-119: Stats update across README, AGENTS, CHANGELOG
- RB-6/RB-7: Scope decision documented with rationale
- TD-128: DashboardsTab decomposition (extract DashboardCallbackFactory + buildTileRenderContext)
- TD-121: 6 dedicated test files for session handler modules (target: ~105 new tests)
- PBI-009: Build report ingestion (Vitest JSON → TestReport note, V8 coverage → CoverageReport note)
- PBI-NUD-001: Backlog refinement nudge (extend NudgeService with interval-based triggering)

### Out of Scope
- New UI features (deferred to C50)
- Signal v2 adapters (deferred beyond C55)
- Hub framework changes (deferred to C52)
- Knowledge base expansion (deferred to C50)
- AnalyticsDashboardPage refactoring (benefits from TD-128 factories but migration is separate work)

## PBI Backlog (Priority Ranked)

### Priority 1: TD-119 — README/CHANGELOG/AGENTS Stats Update
**INVEST**: Independent ✓ | Negotiable (scope fixed) | Valuable (first impression) | Estimable ✓ | Small ✓ | Testable (diff verification)

### Priority 2: RB-6/RB-7 Scope Decision
**INVEST**: Independent ✓ | Negotiable ✗ (decision needed) | Valuable (removes ambiguity) | Estimable ✓ | Small ✓ | Testable (document exists)

### Priority 3: TD-128 — DashboardsTab Decomposition
**INVEST**: Independent ✓ | Negotiable (extraction depth) | Valuable (maintainability) | Estimable ✓ | Small-Medium | Testable (LOC target + test pass)

### Priority 4: TD-121 — Session Handler Dedicated Tests
**INVEST**: Independent ✓ | Negotiable (test count) | Valuable (coverage + bug discovery) | Estimable ✓ | Medium | Testable (test count target)

### Priority 5: PBI-009 — Build Report Ingestion
**INVEST**: Independent ✓ | Negotiable (report types) | Valuable (dogfooding) | Estimable ✓ | Medium | Testable (report generation)

### Priority 6: PBI-NUD-001 — Backlog Refinement Nudge
**INVEST**: Independent ✓ | Negotiable (interval logic) | Valuable (habit formation) | Estimable ✓ | Small-Medium | Testable (nudge fires after interval)

## Increments

### Inc 1: Public Stats Update (TD-119)

**Theme**: Ship It
**Effort**: Small
**Estimate**: ~50 LOC changed, 0 new tests

**Scope**: Update README.md, AGENTS.md, and CHANGELOG.md with accurate statistics derived from actual file counts and `npm test` output. Excludes adding automation scripts (future improvement).

**Files to Modify**:

| File | Purpose | Est. Change |
|------|---------|-------------|
| `README.md` (573 LOC) | Update module overview stats, service count, test count, domain count, CSS architecture | ~30 lines changed |
| `AGENTS.md` (580 LOC) | Update source tree, service table, view table, command table, test counts | ~40 lines changed |
| `CHANGELOG.md` (53 LOC) | Update test count, tech debt count, cycle count, source stats | ~15 lines changed |

**Events**: None produced or consumed.

**Test Intent**: No new tests. Verification via manual diff review — all three files must show consistent numbers.

**Documentation Intent**: These ARE the documentation being updated. TD-119 marked as resolved.

**Architecture Seams**: None. Pure documentation change.

**Acceptance Criteria**:
- [ ] All three files contain consistent, accurate statistics
- [ ] Statistics match `npm test` output and file counts
- [ ] Source files: 230+, Tests: 5,315 (222 suites), Domains: 21, Tech debt: 32 open / 105 total
- [ ] No manual counting — derive from `npm test` output and glob counts where possible

---

### Inc 2: RB-6/RB-7 Scope Decision

**Theme**: Ship It
**Effort**: Tiny
**Estimate**: ~20 LOC changed, 0 new tests

**Scope**: Document explicit v1 vs v1.1 decisions for remaining release blockers. Decision: both defer to v1.1.

**Files to Modify**:

| File | Purpose | Est. Change |
|------|---------|-------------|
| Release blocker docs (RB-6, RB-7) | Add decision, rationale, target cycle | ~10 lines each |
| `Backlog Refinement - Post Cycle 48.md` | Update RB status table | ~5 lines |

**Events**: None.

**Test Intent**: None. Decision documentation only.

**Documentation Intent**: RB-6/RB-7 documents updated with scope decision and target cycle.

**Architecture Seams**: None.

**Acceptance Criteria**:
- [ ] RB-6 decision documented: Defer to v1.1 (CLI installer not required for wizard-based v1)
- [ ] RB-7 decision documented: Defer to v1.1 / Cycle 53 (single-source import sufficient for v1)
- [ ] Backlog Refinement note updated with decisions

---

### Inc 3: DashboardsTab Decomposition (TD-128)

**Theme**: Architecture
**Effort**: Medium
**Estimate**: +300 new LOC, -310 removed LOC (net -10), ~15 new tests

**Scope**: Extract the duplicated callback factory pattern (37 inline handlers, 11 shared with AnalyticsDashboardPage) into a standalone `DashboardCallbackFactory` and a `buildTileRenderContext` pure function. DashboardsTab reduces from orchestrator-that-does-everything to orchestrator-that-delegates. AnalyticsDashboardPage migration is out of scope (it can adopt the factory later).

**Files to Create**:

| File | Purpose | Est. LOC |
|------|---------|----------|
| `src/ui/analytics/DashboardCallbackFactory.ts` | Shared tile callback factory: createTitleChange, createWidthChange, createChartValueColumnChange, etc. | ~150 |
| `src/ui/analytics/buildTileRenderContext.ts` | Pure function: assemble tile rendering context (measurement resolution, filter merging, cache key) | ~100 |
| `tests/ui/analytics/DashboardCallbackFactory.test.ts` | Factory unit tests: verify callback wiring, cache invalidation strategy per callback | ~40 |
| `tests/ui/analytics/buildTileRenderContext.test.ts` | Context builder tests: measurement resolution, filter merging, cross-tile filter toggle | ~30 |

**Files to Modify**:

| File | Purpose | Est. Change |
|------|---------|-------------|
| `src/ui/analytics/DashboardsTab.ts` (1,060 LOC) | Replace inline callbacks with factory calls; replace context assembly with builder call | 1,060 → ~750 LOC |

**Implementation Order**:
1. Create `DashboardCallbackFactory` with shared callback methods
2. Create `buildTileRenderContext` pure function
3. Write tests for both new modules
4. Refactor DashboardsTab to use factory + context builder
5. Verify all 327 existing dashboard tests pass

**Events Consumed** (unchanged): Via `deps.analyticsService.*` — `updateTile`, `removeTile`, `reorderTile`, `runSavedQuery`, etc.
**Events Produced** (unchanged): Via AnalyticsService — `analytics.tile.updated`, `analytics.dashboard.updated`, etc.

**Test Intent**: ~15 new tests across 2 test files. Focus on: callback factory wiring (does each callback call the right service method?), cache invalidation strategy (clearOne vs clearByQueryId vs clear per callback type), context builder (measurement-aware queryId, cross-tile filter toggle logic).

**Documentation Intent**: TD-128 marked as resolved. No user-facing docs needed (internal refactoring).

**Architecture Seams**:
- `DashboardCallbackFactory` receives `DashboardCallbackFactoryDeps` (analyticsService, tileResultCache, setState, scheduleRender)
- `buildTileRenderContext` is a pure function — no deps beyond input parameters
- DashboardsTab `deps` interface unchanged — factory is an internal concern
- **Gotcha**: Cache invalidation varies per callback (`clearOne` for column changes, `clearByQueryId` for filtered queries, `clear()` for measurement swaps) — factory must preserve this
- **Gotcha**: Cross-tile filter toggle logic (same tile+column+value = toggle off) in lines 562-563 is subtle

**Acceptance Criteria**:
- [ ] DashboardsTab ≤ 750 LOC (from 1,060)
- [ ] DashboardCallbackFactory is independently testable with injected deps
- [ ] buildTileRenderContext is a pure function with no side effects
- [ ] All 327 existing dashboard tests pass (DashboardCrud, DashboardLifecycle, dashboardUtils, FilterBar, Breadcrumbs)
- [ ] New unit tests for factory (callback wiring, cache invalidation) and context builder (filter merging)
- [ ] `npm test` green

---

### Inc 4: Session Handler Dedicated Tests (TD-121)

**Theme**: Architecture
**Effort**: Medium
**Estimate**: +0 production LOC, ~105 new tests (~700 test LOC)

**Scope**: Create 6 dedicated test files for the session handler modules extracted in TD-101. Test-only increment — no production code changes. Focus on edge cases, error paths, and boundary conditions not covered by indirect testing through SessionService.test.ts.

**Files to Create**:

| File | Purpose | Est. Tests |
|------|---------|------------|
| `tests/domain/session/handlers/fieldHandlers.test.ts` | 18 exported functions: capacity checks, file I/O error handling in handleOutputGenerate (37 LOC, 2 silent catches), conditional mode emission, dedup in handleLinkAdd | ~40 |
| `tests/domain/session/handlers/lifecycleHandlers.test.ts` | 8 functions: stale activeSessionId cleanup in handleStart (3 branches), elapsed time accumulation in handlePause, FR-14 closure gate in completeSession, MAX_SESSIONS cap | ~20 |
| `tests/domain/session/handlers/syncHandlers.test.ts` | 6 functions: debounce timer cancel/reschedule, content dedup check in executeReverseSync (38 LOC), 2 silent `catch {}` blocks (lines 46-49, 120-122), goal/task toggle loops | ~15 |
| `tests/domain/session/handlers/taskHandlers.test.ts` | 8 functions: TASK_ALLOWED_STATES gating, order re-indexing after splice, capacity checks with cap event, completedAt timestamp logic | ~15 |
| `tests/domain/session/handlers/trackingHandlers.test.ts` | 8 functions: ARTIFACT_DEDUP_WINDOW_MS timing, isExcluded filtering, MAX_SESSION_ACTIVITY cap with slice, bulk path reconciliation across sessions + templates | ~10 |
| `tests/domain/session/handlers/closureHandlers.test.ts` | 4 functions: status + closureResponse guard gates, FR-14 closure ritual pattern, sync scheduling | ~5 |

**Implementation Order**:
1. Create test infrastructure: `SessionHandlerContext` mock factory using `createMockStorage<SessionState>()` + `EventBus()`
2. fieldHandlers.test.ts (highest complexity, 300 LOC handler)
3. lifecycleHandlers.test.ts (state machine complexity)
4. syncHandlers.test.ts (silent catch blocks)
5. taskHandlers.test.ts
6. trackingHandlers.test.ts
7. closureHandlers.test.ts (simplest)

**Events Exercised**:
- **Consumed** (via handler calls): `session.create`, `session.start`, `session.pause`, `session.resume`, `session.complete`, `session.duration.update`, `session.notes.update`, `session.link.add`, `session.context.bind`, `session.goal.add`, `session.goal.toggle`, `session.task.*`, `file.created`, `file.modified`, `file.renamed`, `folder.renamed`
- **Produced** (asserted in tests): `session.created`, `session.started`, `session.paused`, `session.intent.updated`, `session.mode.set`, `session.overload.detected`, `session.artifact.added`, `session.task.capReached`, `session.notes.synced`, `session.notes.syncFailed`, `session.completed` (40+ event types total)

**Test Intent**: ~105 new tests. Priority targets:
1. **High gap**: fieldHandlers.handleOutputGenerate (37 LOC, 2 silent catches — never tested in isolation)
2. **High gap**: syncHandlers.executeReverseSync (38 LOC, content dedup, 2 silent catches, toggle loops)
3. **Medium gap**: lifecycleHandlers.handleStart (stale state cleanup, 3 branches)
4. **Medium gap**: trackingHandlers bulk path reconciliation (recursive across sessions + templates)

**Documentation Intent**: TD-121 marked as resolved.

**Architecture Seams**:
- All handlers receive `SessionHandlerContext` (defined in `handlers/types.ts`, 55 LOC)
- Context includes: `state`, `storage`, `eventBus`, `fileSystem`, `timers`, `syncState`
- Mock factory needed: `createMockHandlerContext()` → returns typed context with vi.fn() stubs
- **Gotcha**: Handlers mutate `state` directly (fire-and-forget contract) — tests must verify state changes synchronously before any await

**Acceptance Criteria**:
- [ ] 6 new test files created in `tests/domain/session/handlers/`
- [ ] ~105 new tests (adjust based on actual branching complexity discovered during writing)
- [ ] All silent `catch {}` blocks exercised (syncHandlers lines 46-49, 120-122; fieldHandlers lines 247-252, 267-270)
- [ ] Handler edge cases covered: error paths, empty state, boundary conditions, capacity limits
- [ ] No changes to production code (test-only increment)
- [ ] `npm test` green

---

### Inc 5: Build Report Ingestion (PBI-009)

**Theme**: Dogfooding
**Effort**: Medium
**Estimate**: +200 new LOC, ~10 new tests

**Scope**: Auto-generate TestReport and CoverageReport vault notes from Vitest JSON output and V8 coverage summary. Follows the existing build report pattern (`docs/reports/builds/`) with YAML frontmatter. Integrated into `esbuild.config.mjs` post-build hook. Does NOT modify Vitest configuration — uses existing JSON reporter output.

**Files to Create**:

| File | Purpose | Est. LOC |
|------|---------|----------|
| `src/domain/docs/reportParser.ts` | Parse Vitest JSON report and V8 coverage JSON into structured frontmatter objects | ~80 |
| `scripts/generate-test-report.mjs` | Node script: read JSON output, call parser, write markdown note to `docs/reports/tests/` | ~60 |
| `scripts/generate-coverage-report.mjs` | Node script: read coverage JSON, call parser, write markdown note to `docs/reports/coverage/` | ~60 |
| `tests/domain/docs/reportParser.test.ts` | Parser unit tests: Vitest JSON shape, coverage shape, edge cases (empty results, zero coverage) | ~80 |

**Files to Modify**:

| File | Purpose | Est. Change |
|------|---------|-------------|
| `esbuild.config.mjs` | Add post-build step: run report generation scripts | ~10 lines |
| `package.json` | Add `test:report` script: `vitest run --reporter=json --outputFile=reports/test-report.json` | ~2 lines |

**Implementation Order**:
1. Define TestReport and CoverageReport frontmatter schemas
2. Implement `reportParser.ts` (parse JSON → frontmatter object)
3. Write parser tests with sample JSON fixtures
4. Create generation scripts
5. Wire into build pipeline
6. Generate first reports and verify vault rendering

**Events**: `ingestion.report.created` emitted by generation script (optional — script runs outside plugin context; may emit via file creation event instead).

**Test Intent**: ~10 new tests in reportParser.test.ts. Focus on: Vitest JSON structure parsing (testResults, numPassedTests, numFailedTests, numPendingTests), coverage summary parsing (lines, branches, functions, statements as percentages), edge cases (empty test suite, zero coverage, missing fields).

**Documentation Intent**: Create report template documentation. Existing build report pattern (`docs/reports/builds/`) serves as reference.

**Architecture Seams**:
- `reportParser.ts` is a pure function module — no EventBus, no Obsidian dependency
- Generation scripts are Node.js (run in build pipeline, not plugin runtime)
- Report notes follow existing build report convention: timestamped filename, YAML frontmatter, markdown body
- **Gotcha**: Vitest JSON reporter output shape may vary between versions — add schema validation
- **Gotcha**: Coverage report requires `--coverage` flag and V8 provider configuration

**Acceptance Criteria**:
- [ ] TestReport note auto-generated with frontmatter: date, passed, failed, skipped, suites, duration_ms
- [ ] CoverageReport note auto-generated with frontmatter: date, lines_pct, branches_pct, functions_pct, statements_pct
- [ ] Reports stored in `docs/reports/tests/` and `docs/reports/coverage/`
- [ ] Frontmatter is queryable by Analytics Hub
- [ ] Parser handles edge cases (empty results, missing fields)
- [ ] New tests for report parsing logic (~10 tests)
- [ ] `npm test` green

---

### Inc 6: Backlog Refinement Nudge (PBI-NUD-001)

**Theme**: Dogfooding
**Effort**: Small-Medium
**Estimate**: +80 new LOC, ~8 new tests

**Scope**: Extend NudgeService to support interval-based nudges (every N days) in addition to existing daily time-based nudges (HH:MM). Add a default backlog refinement nudge configuration. Nudge shows inbox item count and navigates to inbox on click.

**Architecture Decision**: Current NudgeConfig uses `time: string` (HH:MM) for daily triggering. Interval nudges need `intervalDays?: number` and `lastTriggeredDate?: string` fields. When `intervalDays` is set, the nudge fires at the specified `time` only if `lastTriggeredDate` is more than `intervalDays` ago.

**Files to Modify**:

| File | Purpose | Est. Change |
|------|---------|-------------|
| `src/domain/nudge/types.ts` (72 LOC) | Add `intervalDays?: number`, `lastTriggeredDate?: string` to NudgeConfig; add default backlog refinement config | +15 LOC |
| `src/domain/nudge/NudgeService.ts` (189 LOC) | Extend `evaluate()` to check interval condition; update dismiss to set lastTriggeredDate; add inbox count query | +40 LOC |
| `src/domain/nudge/events.ts` (24 LOC) | Add `inboxItemCount?: number` to `nudge.triggered` payload | +3 LOC |
| `src/ui/NudgeNotification.ts` (84 LOC) | Show inbox count in subtitle when present; navigate to inbox on Start click | +15 LOC |
| `src/main.ts` | Register default backlog refinement nudge config on first install | +5 LOC |

**Files to Create**:

| File | Purpose | Est. LOC |
|------|---------|----------|
| `tests/domain/nudge/intervalNudge.test.ts` | Interval-based nudge tests: fires after N days, skips before interval, resets on trigger | ~60 |

**Implementation Order**:
1. Extend NudgeConfig types with interval fields
2. Extend NudgeService.evaluate() with interval check
3. Add default backlog refinement config (7-day interval, 10:00 time, disabled by default)
4. Update NudgeNotification to show inbox count and navigate to inbox
5. Write dedicated interval nudge tests
6. Wire default config in main.ts

**Events Consumed**: `nudge.configure`, `nudge.remove`, `nudge.dismiss` (existing)
**Events Produced**: `nudge.triggered` (extended payload with `inboxItemCount`), `nudge.configured`, `nudge.dismissed` (existing)

**Test Intent**: ~8 new tests in intervalNudge.test.ts. Focus on: interval calculation (fires after N days, does not fire before), lastTriggeredDate persistence, interaction with daily dismiss (interval nudge dismissed = lastTriggeredDate set), backward compatibility (nudges without intervalDays work as before).

**Documentation Intent**: None — internal feature. User-facing via Settings UI (existing nudge preferences panel).

**Architecture Seams**:
- `NudgeConfig.intervalDays` is optional — all existing configs continue to work (backward-compatible)
- `NudgeService.evaluate()` branching: if `intervalDays` is set → check interval; else → existing time-based check
- InboxService dependency: NudgeService needs inbox item count → inject `getInboxCount: () => number` callback (same pattern as `isSessionTypeActive`)
- **Gotcha**: Midnight rollover resets `dismissedToday` but NOT `lastTriggeredDate` — interval nudges survive daily reset

**Acceptance Criteria**:
- [ ] Interval nudge fires after configured number of days (default: 7)
- [ ] Shows inbox item count in nudge notification subtitle
- [ ] Click navigates to inbox view (emits appropriate navigation event)
- [ ] Dismiss sets `lastTriggeredDate`, suppressing for full interval
- [ ] Configurable in settings via existing NudgePreferences UI
- [ ] Backward-compatible: existing time-based nudges unaffected
- [ ] New tests for interval trigger logic (~8 tests)
- [ ] `npm test` green

---

## Dependency Graph

```
Inc 1 (Stats)     ──→ Independent
Inc 2 (RB Scope)  ──→ Independent
Inc 3 (TD-128)    ──→ Independent
Inc 4 (TD-121)    ──→ Independent
Inc 5 (PBI-009)   ──→ Independent
Inc 6 (PBI-NUD)   ──→ Independent (extends existing NudgeService)
```

All increments are independent and can be executed in any order.

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| DashboardsTab decomposition breaks dashboard rendering | High | Extract without behavior change; run all 327 existing tests after each extraction step |
| Session handler tests reveal bugs in handlers | Medium | Fix bugs as found — this is the value of the tests; track as unplanned bugfix increments |
| Vitest JSON output format varies between versions | Low | Pin Vitest version; add schema validation with fallback defaults |
| NudgeService interval extension breaks existing daily nudges | Medium | intervalDays is optional; all existing codepaths unchanged when field is absent |
| syncHandlers silent catch blocks mask real errors | Medium | Tests will expose what errors are caught; decide per-case whether to log or rethrow |

## Success Metrics

| Metric | Target |
|--------|--------|
| New tests | ~120 (105 session handlers + 15 dashboard + 10 reports + 8 nudge - overlaps) |
| Post-cycle tests | ~5,435 |
| DashboardsTab LOC | ≤ 750 (from 1,060) |
| Tech debt resolved | TD-119, TD-128, TD-121 |
| Release blockers decided | RB-6, RB-7 (deferred to v1.1) |
| Stats accuracy | All public files match actual counts |
| Increments | 6 |

## Deferred Items

| Item | Target | Rationale |
|------|--------|-----------|
| PBI-ONB-016: Command Catalog | Cycle 50 | User Activation theme |
| PBI-ONB-014: Configurable Startpage | Cycle 50 | User Activation theme |
| TD-87: Knowledge base expansion | Cycle 50 | User Activation theme |
| Hub framework (TD-49, TD-50) | Cycle 52 | Architecture theme — sequential dependency chain |
| Signal ADO hardening | Cycle 54 | Feature Deepening theme |
| AnalyticsDashboardPage migration to DashboardCallbackFactory | Future | Benefit from TD-128 but separate scope |

## Quality Baseline

- [x] `npm run build` passes (verified post-C48)
- [x] `npm test` green: 5,315 tests, 222 suites, 0 failures
- [x] `npm run check` clean: 0 lint errors, 0 lint warnings
- [x] No critical bugs open
- [x] Previous cycle closed: C48 retrospective completed, TASM 34/35

## Pre-Cycle Completion

- [x] Backlog refinement completed ([[Backlog Refinement - Post Cycle 48]])
- [x] 5 Release Anchor Themes defined and approved
- [x] Signal v2 explicitly deferred (strategic cut documented)
- [x] Cycles 49–55 roadmap planned
- [x] Inbox signals reviewed: 149 items triaged in C48 refinement (88 archived/merged)
- [ ] No pre-cycle fixes required

## Definition of Ready

- [x] All PBIs have acceptance criteria
- [x] PBIs assessed with INVEST criteria
- [x] PBIs chunked into increments with vertical slices
- [x] Dependencies mapped (all independent)
- [x] Priority ranked (by value: Ship It → Architecture → Dogfooding)
- [x] Tech debt items have clear scope and target metrics
- [x] FRI scored: 29/35 (exceeds 11/35 continuation threshold)
- [x] Pre-cycle test baseline recorded (5,315 tests, 222 suites)
- [x] Increment readiness verified (scope, AC, test intent, doc intent, architecture seams, file lists, LOC estimates)
- [x] Quality baseline verified (build green, no critical bugs, previous cycle closed)

## Definition of Done

- [ ] All acceptance criteria met for each increment
- [ ] `npm test` green (tsc + eslint + vitest)
- [ ] `npm run build` succeeds
- [ ] No new lint warnings introduced
- [ ] All new code has tests
- [ ] Memory files updated (MEMORY.md, cycle-history.md)
- [ ] Three Amigos Review completed with Release Anchor Theme reference
