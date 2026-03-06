---
type: DevelopmentCycle
feature: "[[Development/flowti/docs/features/MVP/MVP - Product Development Lifecycle|MVP - Product Development Lifecycle]]"
stage: planned
cycle: 60
release_anchor:
  - "Theme 12: Journey Builder Phase 3 — Lifecycle Templates + Executor v2"
  - "Theme 13: Feature Quality — Test-to-PRD Traceability"
mvp: "[[Development/flowti/docs/features/MVP/MVP - Product Development Lifecycle|MVP - Product Development Lifecycle]]"
pbis:
  - "PBI-JB-001: Lifecycle Journey Templates"
  - "PBI-JB-002: Journey Executor v2 Retry"
  - "PBI-JB-003: Journey Executor v2 Reporting"
  - "PBI-TQ-001: Feature-Centric Test View"
  - "PBI-TQ-002: Test-to-PRD Traceability"
  - "PBI-TQ-003: Test Result History"
  - "PBI-TQ-004: TD-130 JB Sidebar Decomposition"
  - "PBI-JB-004: E2E Journey TM Hub"
  - "PBI-JB-005: E2E Journey Executor"
bugs: []
tech_debt:
  - TD-130
estimated_increments: 10
estimated_loc: 1800
estimated_tests: 100
pre_cycle_tests: 7396
pre_cycle_suites: 325
---

# Cycle 60 — Journey Builder Phase 3 + Feature Quality

> **MVP Cycle 3 of 5** — Connect testing to features and enhance the journey toolchain.

## Release Anchor Theme

- **Theme 12: Journey Builder Phase 3 — Lifecycle Templates + Executor v2** — Add lifecycle journey templates, retry logic, conditional steps, and enhanced error reporting.
- **Theme 13: Feature Quality — Test-to-PRD Traceability** — Build feature-centric quality views connecting test results to features.

## Situation Assessment

### Pre-Cycle State

- **Tests**: ~7,396 passing (~325 suites) — projected after C59
- **Build**: `npm run build` green
- **Previous cycles**: C58 (Feature Lifecycle Core), C59 (Process Management + Sessions)
- **Feature Lifecycle**: Operational — PRDs scanned, gated, scored, session-bound
- **Process Management**: Phase 1 — 4 node types, canvas parser, validation, reference process
- **Session v3**: Lifecycle-aware — sessions bound to features
- **Journey Builder**: v1.2 (C56), 34 tools, canvas sync
- **Journey Executor**: v1 (C57), dry-run, step tracking

### Foundation

| Component | Status | Relevance to C60 |
|-----------|--------|-------------------|
| Journey Builder v1.2 | Delivered (C56) | Phase 3 builds on top |
| Journey Executor v1 | Delivered (C57) | v2 enhances with retry + conditionals |
| Test Management Hub | 5 tabs (C57) | Feature quality view adds to Coverage tab |
| FeatureLifecycleService | Delivered (C58) | Feature scanning for traceability binding |
| Process validation | Delivered (C59) | Journey templates for process steps |
| TD-130 | Open | JourneyBuilderSidebar decomposition |

### Carried Forward

| Item | Classification | Action |
|------|----------------|--------|
| E2E Journey: TM Hub | Deferred from C57 | Deliver this cycle |
| E2E Journey: Executor | Deferred from C57 | Deliver this cycle |
| TD-130: JB Sidebar size | Tech debt | Decompose during Phase 3 work |

## Cycle Overview

Cycle 60 has two dimensions:

1. **Journey Builder Phase 3** — Add lifecycle-specific journey templates (templates for each lifecycle phase), improve the executor with retry/backoff and conditional step support, and enhance error reporting.

2. **Feature Quality** — Connect test results to features. The Test Management Hub gets a feature-centric quality section where users can see: which journeys test which features, test results per feature over time, and quality trends.

This cycle also clears the C57-deferred E2E journeys for the Test Management Hub and Journey Executor.

## User Pains

1. **No lifecycle journey templates** — Users must create journeys from scratch; no templates for common lifecycle activities.
2. **Executor failures are cryptic** — When a journey step fails, the error message is minimal. No retry logic for transient failures.
3. **Tests are disconnected from features** — Test Management Hub shows journeys, but can't answer "what tests cover Feature X?"
4. **No test result trends** — No history of test results per feature over time.
5. **JourneyBuilderSidebar is too large** — 769 LOC orchestrator (TD-130) hinders maintainability.

## Scope

### In Scope

**Journey Builder Phase 3**:
- 5 lifecycle journey templates (backlog review, planning, development, testing, review)
- Journey Executor v2: retry logic with configurable attempts/backoff
- Journey Executor v2: conditional steps (`when` field on steps)
- Journey Executor v2: enhanced error reporting (stack traces, context, suggestions)
- TD-130: JourneyBuilderSidebar decomposition (extract template manager, journey metadata editor)

**Feature Quality**:
- Feature-centric quality section in Test Management Hub Coverage tab
- Test-to-PRD traceability: journeys declare `feature` field linking to PRD
- Test result history per feature: timeline of runs with pass/fail/skip
- Quality summary in Feature Pipeline detail panel (test count, pass rate, last run)

**E2E Journeys (deferred from C57)**:
- E2E journey: Test Management Hub (open, navigate tabs, verify content)
- E2E journey: Journey Executor (run a journey, verify results)

### Out of Scope

- Three Amigos review automation (C61)
- TASM scoring UI (C61)
- Process→Journey compilation (C61)
- Full quality dashboard (C61)
- AI-powered test suggestions

## Increments

### Inc 0: Journey Executor v2 — Retry Logic
**Theme**: Domain
**Effort**: Medium | **Est. LOC**: ~150 | **Est. Tests**: ~12

Add retry/backoff to Journey Executor:
- Configurable retry per step: `{ maxRetries: number, backoffMs: number }`
- Exponential backoff between retries
- Retry only on transient failures (timeout, network errors)
- Report retry attempts in step result
- Default: no retry (backward compatible)

**Acceptance Criteria**:
- [ ] Steps can be retried on transient failure
- [ ] Backoff increases between retries
- [ ] Retry attempts reported in results
- [ ] Default behavior unchanged (no retry)
- [ ] `npm test` green

---

### Inc 1: Journey Executor v2 — Conditional Steps + Error Reporting
**Theme**: Domain
**Effort**: Medium | **Est. LOC**: ~150 | **Est. Tests**: ~12

Add conditional steps and enhanced errors:
- `when` field on steps: expression evaluated before execution (skip if false)
- Expression evaluator: simple field checks (`status == "passing"`, `count > 0`)
- Enhanced error reporting: include step context, action that failed, stack trace excerpt
- Failure suggestions: common failure patterns → fix suggestions

**Acceptance Criteria**:
- [ ] Conditional steps skip when expression is false
- [ ] Expression evaluator handles simple comparisons
- [ ] Error reports include context and suggestions
- [ ] `npm test` green

---

### Inc 2: Lifecycle Journey Templates
**Theme**: Content / Domain
**Effort**: Medium | **Est. LOC**: ~200 | **Est. Tests**: ~8

Create 5 lifecycle journey templates:
- **Backlog Review**: Open Feature Pipeline → review stages → check gates → flag items needing attention
- **Sprint Planning**: Open features → select approved items → create cycle plan → set session goals
- **Development Checkpoint**: Open session → verify artifacts → check build → review progress
- **Test Validation**: Open TM Hub → run journeys → check coverage → review pyramid
- **Quality Review**: Open Feature Pipeline → check TASM → review compliance → advance stage

Each template is a JSON config file with documented steps and placeholder actions.

**Acceptance Criteria**:
- [ ] 5 lifecycle templates created as JSON configs
- [ ] Each template follows journey config schema
- [ ] Templates available in Journey Builder template picker
- [ ] `npm test` green

---

### Inc 3: Test-to-PRD Traceability
**Theme**: Domain / Integration
**Effort**: Medium | **Est. LOC**: ~150 | **Est. Tests**: ~12

Connect journeys to features:
- Add optional `feature` field to journey config schema
- `TestManagementService.getJourneysForFeature(featureId)` — query by domain or feature field
- `FeatureLifecycleService.getTestSummary(featureId)` — return test count, pass rate, last run
- Cross-reference: feature detail panel shows linked journeys

**Acceptance Criteria**:
- [ ] Journey configs support `feature` field
- [ ] Query returns journeys for a given feature
- [ ] Test summary available per feature
- [ ] `npm test` green

---

### Inc 4: Test Result History
**Theme**: Domain / Storage
**Effort**: Medium | **Est. LOC**: ~150 | **Est. Tests**: ~10

Track test result history per feature:
- Store journey run results: `{ featureId, journeyId, timestamp, passed, failed, skipped }`
- Rolling history (last 20 runs per feature)
- Trend computation: pass rate over time, regression detection
- Storage persistence under `testResultHistory` key

**Acceptance Criteria**:
- [ ] Run results stored per feature
- [ ] Rolling history maintained
- [ ] Trend computation works
- [ ] `npm test` green

---

### Inc 5: Feature Quality UI in TM Hub
**Theme**: UI
**Effort**: Large | **Est. LOC**: ~200 | **Est. Tests**: ~10

Add feature-centric quality view to Test Management Hub:
- Feature quality section in Coverage tab (or new "Feature Quality" tab)
- Master list: features with test count, pass rate, last run date
- Detail: linked journeys, result timeline, trend chart placeholder
- Status badges: fully tested / partially tested / untested
- Click feature → navigate to Feature Pipeline detail

**Acceptance Criteria**:
- [ ] Feature quality section renders in TM Hub
- [ ] Features listed with test metrics
- [ ] Detail shows linked journeys and results
- [ ] Navigation to Feature Pipeline works
- [ ] `npm test` green

---

### Inc 6: Quality Summary in Feature Detail
**Theme**: UI / Integration
**Effort**: Small | **Est. LOC**: ~80 | **Est. Tests**: ~5

Add quality summary to Feature Pipeline detail panel:
- "Quality" section: test count, pass rate, last run, trend indicator (↑↓→)
- Link to Test Management Hub for full view
- Gate integration: Build Gate checks test existence, Quality Gate checks pass rate

**Acceptance Criteria**:
- [ ] Quality section in feature detail
- [ ] Metrics displayed
- [ ] Link to TM Hub works
- [ ] `npm test` green

---

### Inc 7: TD-130 — JourneyBuilderSidebar Decomposition
**Theme**: Architecture / Debt
**Effort**: Medium | **Est. LOC**: ~100 | **Est. Tests**: ~5

Decompose JourneyBuilderSidebar (769 LOC):
- Extract `TemplateManager` — template selection and creation logic
- Extract `JourneyMetadataEditor` — journey name, description, domain, feature editing
- Sidebar becomes thin orchestrator delegating to extracted components
- Verify no regressions in existing JB tests

**Acceptance Criteria**:
- [ ] TemplateManager extracted
- [ ] MetadataEditor extracted
- [ ] Sidebar LOC reduced below 600
- [ ] Existing tests pass
- [ ] `npm test` green

---

### Inc 8: E2E Journeys (TM Hub + Executor)
**Theme**: Quality / E2E
**Effort**: Medium | **Est. LOC**: ~150 | **Est. Tests**: ~10

Create the C57-deferred E2E journeys:
- E2E Journey: Test Management Hub — open Hub, navigate tabs, verify dashboard, check journey list
- E2E Journey: Journey Executor — create test journey, execute, verify results, check report
- Both journeys follow established format with config JSON + test file

**Acceptance Criteria**:
- [ ] TM Hub E2E journey passes
- [ ] Executor E2E journey passes
- [ ] Journey configs validated
- [ ] `npm test` green

---

### Inc 9: Integration Testing + Polish
**Theme**: Quality
**Effort**: Small | **Est. LOC**: ~70 | **Est. Tests**: ~8

End-of-cycle quality:
- Flow test: create journey with feature link → execute → verify results in TM Hub → verify in Feature detail
- Verify lifecycle templates appear in Journey Builder
- Empty state handling (no results, no linked journeys)
- Error handling (invalid feature link, stale results)

**Acceptance Criteria**:
- [ ] Flow test covers full traceability chain
- [ ] Empty states handled
- [ ] `npm test` green
- [ ] `npm run build` green

## Dependency Graph

```
Inc 0 (Retry)              ──→ Inc 1 (Conditionals + errors)
Inc 1 (Conditionals)       ──→ Inc 2 (Templates)
Inc 3 (Traceability)       ──→ Inc 4 (History) + Inc 5 (Quality UI)
Inc 4 (History)            ──→ Inc 5 (Quality UI)
Inc 5 (Quality UI)         ──→ Inc 6 (Feature detail) + Inc 9 (Integration)
Inc 7 (TD-130)             ──→ Independent (parallel with 0-1)
Inc 8 (E2E)                ──→ After Inc 5 (needs quality UI)
```

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Conditional step expressions become complex | Medium | Start with simple comparisons; defer full expression engine |
| Test result storage grows large | Low | Rolling window (20 per feature); purge on demand |
| Feature linking requires journey config format change | Low | Additive field — backward compatible |
| E2E journeys are flaky | Medium | Use established E2E patterns from C53; settle delays |

## Success Metrics

| Metric | Target |
|--------|--------|
| New tests | ~100 |
| Post-cycle tests | ~7,496 |
| New suites | ~8 |
| Source LOC | ~1,800 |
| Lifecycle templates | 5 |
| E2E journeys | 2 new (9+ total) |
| TD resolved | 1 (TD-130) |
| Increments | ~10 |

## Definition of Done

- [ ] Journey Executor v2: retry, conditional steps, enhanced errors
- [ ] 5 lifecycle journey templates created
- [ ] Test-to-PRD traceability via `feature` field
- [ ] Test result history per feature with trends
- [ ] Feature quality view in Test Management Hub
- [ ] Quality summary in Feature Pipeline detail panel
- [ ] TD-130 resolved (JB sidebar decomposition)
- [ ] 2 E2E journeys (TM Hub + Executor)
- [ ] Flow integration test for traceability chain
- [ ] `npm run build` green
- [ ] Three Amigos review completed
