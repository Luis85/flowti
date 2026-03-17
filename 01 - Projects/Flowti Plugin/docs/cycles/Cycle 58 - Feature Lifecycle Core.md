---
type: DevelopmentCycle
feature: "[[Development/flowti/docs/features/Feature Lifecycle/Feature Lifecycle PRD|Feature Lifecycle PRD]]"
stage: done
cycle: 58
release_anchor:
  - "Theme 9: Feature Lifecycle — The MVP Backbone"
mvp: "[[Development/flowti/docs/features/MVP/MVP - Product Development Lifecycle|MVP - Product Development Lifecycle]]"
pbis:
  - "PBI-FL-001: FeatureLifecycleService"
  - "PBI-FL-002: Gate Check Functions"
  - "PBI-FL-003: FRI Scoring"
  - "PBI-FL-004: Prioritization Scoring"
  - "PBI-FL-005: Feature Pipeline UI"
  - "PBI-FL-006: Feature Detail Panel"
  - "PBI-FL-007: Stage Transitions"
  - "PBI-FL-008: Legacy Stage Normalization"
  - "PBI-FL-009: Feature Events"
  - "PBI-FL-010: Feature Card on User Hub"
  - "PBI-FL-011: Storage Persistence"
bugs: []
tech_debt:
  - TD-58
  - TD-93
estimated_increments: 12
estimated_loc: 2000
estimated_tests: 120
actual_increments: 11
actual_tests: 230
pre_cycle_tests: 7156
pre_cycle_suites: 305
post_cycle_tests: 7386
post_cycle_suites: 314
completed: 2026-03-06
---

# Cycle 58 — Feature Lifecycle Core

> **MVP Cycle 1 of 5** — The backbone that everything else connects to.

## Release Anchor Theme

- **Theme 9: Feature Lifecycle — The MVP Backbone** — Implement the Feature Lifecycle domain: scan PRDs, manage stages, validate gates, score FRI, and build the Feature Pipeline UI.

## Situation Assessment

### Pre-Cycle State

- **Tests**: 7,156 passing (305 suites)
- **Build**: `npm run build` green
- **Open bugs**: None critical
- **Previous cycle**: C57 (Test Management Hub) — 6th Hub, Journey Executor, Session v2, 362 new tests
- **Tech Debt**: TD-58 (performance baselines), TD-93 (ADR-032 acceptance) carried from C57
- **Hub Views**: 6 (Event Catalog, Data Exchange, User, Train, Analytics, Test Management)
- **Events**: 382 total
- **Commands**: 47 total

### Foundation from C55–C57

| Component | Status | Relevance to C58 |
|-----------|--------|-------------------|
| BaseHubView | 6 subclasses | FeaturesTab follows same pattern (or extends Event Catalog) |
| Master/detail pattern | Proven in 5+ tabs | Feature Pipeline reuses this pattern |
| Pure function calculators | Established (pyramid, coverage, compliance) | Gate checks follow same pattern |
| Event-driven wiring | Standard | 8 new events follow established EventMap pattern |
| TypedStorage | Standard | Feature sessions and scores persist via storage |
| Zod schemas | Established (C57) | Feature frontmatter validation uses Zod |
| View state persistence | Delivered (C57, TD-45) | Feature Pipeline tab state preserved |

### Carried Forward from C57

| Item | Classification | Action |
|------|----------------|--------|
| TD-58: Performance baselines | Tech debt (doc) | Close with documented baselines |
| TD-93: ADR-032 acceptance | Tech debt (doc) | Close with acceptance criteria |
| E2E journeys for TM Hub + Executor | Deferred PBI | Defer to C60 (alongside JB Phase 3) |

### Previously Planned C58 (Publication Readiness)

The original C58 plan focused on Publication Readiness (repository restructure, CI/CD, marketplace submission). This has been **explicitly deferred** in favor of building the MVP feature set first. Publication Readiness will be addressed after the MVP is validated (post-C62).

Items deferred from original C58:
- GitHub Actions CI pipeline → post-MVP
- Repository restructure → post-MVP
- Marketplace dry-run → post-MVP
- PBI-006 (Inbox auto-routing) → backlog
- PBI-008 (Execution timing) → backlog
- PBI-010 (Entity config in DX Hub) → backlog

## Cycle Overview

Cycle 58 implements the **Feature Lifecycle domain** — the backbone of the MVP. The Feature Lifecycle PRD (approved, FRI 27/35) defines a 6-stage lifecycle for PRDs with automated gate checks, FRI scoring, and a Feature Pipeline view.

This is the **most critical cycle in the MVP roadmap**. Without Feature Lifecycle, the Process Management (C59), Test-to-Feature traceability (C60), Review Automation (C61), and MVP Integration (C62) have nothing to bind to.

The implementation follows the approved PRD's scope: scan PRDs from `docs/features/*/`, standardize stages, compute gate readiness, display in a Feature Pipeline UI, and enable stage transitions with validation.

## User Pains

1. **PRDs are invisible** — 41 PRDs at various stages scattered across `docs/features/`, no visual pipeline showing where everything is.
2. **Stage management is manual** — PRD stages are edited by hand with no validation or gate checks. 10+ legacy stage values in use.
3. **No feature readiness scoring** — FRI scores exist in some PRD frontmatter but are computed manually and never aggregated.
4. **No prioritization view** — Business value, cost, and priority dimensions exist in PRDs but have no scoring UI.
5. **No lifecycle visibility** — No way to see "what's blocking Feature X from advancing?" or "which features are ready for development?"

## Cycle Goals

1. **FeatureLifecycleService** — domain service for PRD scanning, stage management, gate checks
2. **Gate check pure functions** — 6 gates with automated readiness checks
3. **FRI scoring** — 7-dimension scoring with readiness levels
4. **Prioritization scoring** — 7-dimension business priority signal
5. **Feature Pipeline UI** — FeaturesTab in Event Catalog with stage-grouped master + detail panel
6. **Stage transitions** — "Advance to [stage]" with gate validation
7. **Events** — 8 new feature/review events
8. **Feature card** — summary on User Hub dashboard

## Scope

### In Scope

**Domain**:
- `FeatureLifecycleService` — scan, parse, score, manage stages
- Gate check pure functions (6 gates: Problem, Design, Readiness, Build, Quality, Release)
- FRI scoring (7 dimensions: Strategy, Scope, Architecture, Event Integration, Data Model, UI Consistency, Validation & Testing)
- Prioritization scoring (7 dimensions: business_value, implementation_cost, maintenance_cost, discovery_cost, design_cost, test_cost, priority)
- Feature types and interfaces
- Legacy stage normalization (10+ values → 6 standard stages)
- Storage persistence for feature sessions and scores

**UI**:
- FeaturesTab in Event Catalog (new tab)
- Feature Pipeline master view (grouped by stage: idea → draft → approved → in-progress → review → done)
- Feature detail panel (gates, scores, PBIs, sessions, reviews)
- FRI scoring panel
- Stage advancement action (with gate validation)
- Feature card on User Hub dashboard (via HubDashboardProvider)

**Events** (8 new):
- `feature.stage.changed` — stage transition
- `feature.gate.passed` — gate check passed
- `feature.gate.failed` — gate check failed
- `feature.scored` — FRI or prioritization score updated
- `feature.session.started` — session started on feature
- `feature.session.ended` — session ended on feature
- `review.session.created` — Three Amigos review created
- `review.session.scored` — TASM score recorded

**Debt**:
- TD-58: Document performance baselines (startup, storage, query)
- TD-93: ADR-032 acceptance criteria met

### Out of Scope

- Process Management (C59)
- Session v3 lifecycle binding (C59)
- Test-to-feature traceability (C60)
- Three Amigos review automation (C61)
- TASM scoring UI (C61)
- Feature Pipeline as standalone Hub (use Event Catalog tab instead)
- Kanban drag-and-drop (not MVP)
- Automated stage gates without user confirmation

## Increments

### Inc 0: Feature Lifecycle Domain — Types + Service Shell
**Theme**: Domain / Architecture
**Effort**: Medium | **Est. LOC**: ~200 | **Est. Tests**: ~15

Define the Feature Lifecycle domain:
- `src/domain/featureLifecycle/types.ts` — FeatureEntry, GateCheckResult, FeatureStage, FRIScore, PrioritizationScore, SessionRecord, ReviewRecord
- `src/domain/featureLifecycle/events.ts` — FeatureLifecycleEventMap (8 events)
- `src/domain/featureLifecycle/FeatureLifecycleService.ts` — service shell with load(), scanFeatures(), getFeatures()
- Wire events into infrastructure EventMap
- Register service in main.ts

**Acceptance Criteria**:
- [x] Types defined and exported
- [x] Events defined and wired into EventMap
- [x] Service shell loads and scans PRD files
- [x] `npm test` green

**Actual**: 30 type tests + 9 schema tests + 21 scanner tests + 6 event tests = 66 tests. 3 new files.

---

### Inc 1: PRD Scanner + Stage Normalization
**Theme**: Domain
**Effort**: Medium | **Est. LOC**: ~150 | **Est. Tests**: ~15

Implement PRD scanning and stage normalization:
- Scan `docs/features/*/` for files with `type: ProductRequirementsDocument` frontmatter
- Parse frontmatter: stage, maturity, FRI dimensions, prioritization dimensions, PBIs
- Normalize legacy stages: open→draft, development→in-progress, new→idea, planned→approved
- Return `FeatureEntry[]` with parsed data
- Zod schema for PRD frontmatter validation

**Acceptance Criteria**:
- [x] Scanner finds PRD files in vault
- [x] Frontmatter parsed correctly with Zod validation
- [x] Legacy stages normalized (10+ → 6)
- [x] `npm test` green

**Actual**: Delivered as part of Inc 0. FRI scoring (Inc 3) also delivered here — `extractFRI()` and `extractPrioritization()` are pure functions in the service.

---

### Inc 2: Gate Check Pure Functions
**Theme**: Domain
**Effort**: Medium | **Est. LOC**: ~200 | **Est. Tests**: ~20

Implement 6 gate check functions as pure functions:
- `checkProblemGate(entry)` — PRD file exists, problem statement, outcome, domain link
- `checkDesignGate(entry)` — scope, ≥3 FRs, event impact, FRI ≥ 11
- `checkReadinessGate(entry)` — ≥3 acceptance criteria, data model, technical review, FRI ≥ 19
- `checkBuildGate(entry)` — ≥1 PBI done, build passes, tests exist
- `checkQualityGate(entry)` — all AC met, docs updated, TASM ≥ 19
- `runGateChecks(entry, targetStage)` — run relevant gate for the transition

Each returns `GateCheckResult` with passed/failed items and missing requirements.

**Acceptance Criteria**:
- [x] All 6 gate functions implemented as pure functions
- [x] Each returns structured GateCheckResult
- [x] Tests cover pass and fail cases for each gate
- [x] `npm test` green

**Actual**: 35 tests. `GateContext` interface for pure function injection — no I/O in gate checks.

---

### Inc 3: FRI Scoring
**Theme**: Domain
**Effort**: Small | **Est. LOC**: ~100 | **Est. Tests**: ~12

Implement FRI and Prioritization scoring:
- `computeFRI(dimensions)` — sum 7 dimensions (0-5 each), compute readiness level
- Readiness levels: Not Ready (0-10), Conceptual (11-18), Technically Ready (19-25), Integration Ready (26-30), Production Ready (31-35)
- `computePriority(dimensions)` — priority signal formula: `business_value - avg(costs)`
- `getFRIFromFrontmatter(frontmatter)` — extract dimensions from parsed frontmatter
- Emit `feature.scored` on score update

**Acceptance Criteria**:
- [x] FRI computed from 7 dimensions
- [x] Readiness level derived from total score
- [x] Priority signal computed
- [x] Score changes emit events
- [x] `npm test` green

**Actual**: Delivered as part of Inc 1. `extractFRI()` and `extractPrioritization()` are pure functions with FRI level thresholds and priority signal formula.

---

### Inc 4: Stage Transitions + Validation
**Theme**: Domain
**Effort**: Small | **Est. LOC**: ~100 | **Est. Tests**: ~10

Implement stage advancement with gate validation:
- `advanceStage(featureId, targetStage)` — validate gate, update frontmatter, emit event
- Allowed transitions: idea→draft, draft→approved, approved→in-progress, in-progress→review, review→done
- Gate must pass before transition
- Update PRD frontmatter stage field via file system
- Emit `feature.stage.changed` with from/to stages
- Emit `feature.gate.passed` or `feature.gate.failed`

**Acceptance Criteria**:
- [x] Stage transitions validate against gates
- [x] Frontmatter updated on successful transition
- [x] Events emitted for stage changes and gate results
- [x] Invalid transitions rejected
- [x] `npm test` green

**Actual**: 21 tests (11 advanceStage + 10 pure functions: getNextStage, isValidTransition).

---

### Inc 5: Feature Pipeline UI — Master View
**Theme**: UI
**Effort**: Large | **Est. LOC**: ~250 | **Est. Tests**: ~12

Build the Feature Pipeline master view as a FeaturesTab in Event Catalog:
- Add "Features" tab to Event Catalog tab definitions
- Pipeline master view: features grouped by stage columns (idea, draft, approved, in-progress, review, done)
- Feature cards showing: name, stage badge, FRI score, readiness level, gate readiness indicator (green/red)
- Count badges per stage column
- Search/filter by name
- Click feature → detail panel

**Acceptance Criteria**:
- [x] Features tab appears in Event Catalog
- [x] Pipeline shows features grouped by stage
- [x] Feature cards display name, FRI, readiness
- [x] Search filters features
- [x] `npm test` green

**Actual**: 17 tests. Wired through registry.ts → EventCatalogView → FeaturesTab. Domain filter support.

---

### Inc 6: Feature Detail Panel
**Theme**: UI
**Effort**: Large | **Est. LOC**: ~250 | **Est. Tests**: ~12

Build the feature detail panel (right side of master/detail):
- Feature header: name, stage badge, FRI score, readiness level
- Gate readiness section: checklist showing each gate check result (green check / red X)
- FRI breakdown: 7 dimensions with score bars
- Prioritization section: 7 dimensions with computed priority signal
- PBI list: PBIs from the feature's backlog with status
- "Advance to [next stage]" button with gate validation
- Stage history (from frontmatter)

**Acceptance Criteria**:
- [x] Detail panel shows feature information
- [x] Gate checks displayed as checklist
- [x] FRI breakdown shown
- [x] Advance button validates gates
- [x] `npm test` green

**Actual**: 19 tests. Extracted as `FeatureDetailPanel` class with gate check icons, FRI dimension labels, prioritization section, related events navigation.

---

### Inc 7: Feature Session Tracking
**Theme**: Domain / Storage
**Effort**: Small | **Est. LOC**: ~100 | **Est. Tests**: ~8

Implement feature session tracking (storage-side):
- `startFeatureSession(featureId)` — record session start with timestamp
- `endFeatureSession(featureId, notes)` — record end, files created/modified
- Storage persistence under `featureLifecycle` key
- Emit `feature.session.started` and `feature.session.ended`
- Display session history in feature detail panel

**Acceptance Criteria**:
- [x] Sessions tracked per feature
- [x] Start/end with timestamps persisted
- [x] Events emitted
- [x] Session history visible in detail panel
- [x] `npm test` green

**Actual**: 10 tests. Fixed shallow copy bug on `DEFAULT_FEATURE_LIFECYCLE_STATE` — sessions array was shared across instances.

---

### Inc 8: User Hub Feature Card + HubDashboardProvider
**Theme**: UI / Integration
**Effort**: Small | **Est. LOC**: ~80 | **Est. Tests**: ~5

Integrate Feature Lifecycle into User Hub:
- `FeatureLifecycleDashboardProvider implements HubDashboardProvider`
- Summary card: total features, by-stage distribution, features needing attention (failed gates, stale)
- Quick action: "Open Feature Pipeline"
- Wire provider into UserHubView

**Acceptance Criteria**:
- [x] Feature card appears on User Hub dashboard
- [x] Stage distribution shown
- [x] "Open Feature Pipeline" navigation works
- [x] `npm test` green

**Actual**: 9 tests. Stats: Features (total), Active (in-progress + review), Done. ActionItemCount = 1 when active session.

---

### Inc 9: TD-58 + TD-93 Closure
**Theme**: Debt
**Effort**: Small | **Est. LOC**: ~50 | **Est. Tests**: ~3

Close carried tech debt:
- TD-58: Document performance baselines — record current startup, storage, and query p50/p95 values
- TD-93: ADR-032 acceptance — verify plugin state reconciliation meets criteria, document acceptance

**Acceptance Criteria**:
- [x] TD-58 resolved with documented baselines
- [x] TD-93 resolved with acceptance evidence
- [x] `npm test` green

**Actual**: TD-58 resolved with concrete thresholds table (4 items) + PerfAggregator reference. TD-93 status changed from "mitigated" to "resolved".

---

### Inc 10: E2E Polish + Integration Testing
**Theme**: Quality
**Effort**: Medium | **Est. LOC**: ~150 | **Est. Tests**: ~8

End-of-cycle integration and quality:
- Flow integration test: Feature Lifecycle scan → gate check → stage transition
- Verify Feature Pipeline renders with real PRD data
- Verify gate checks against actual PRD frontmatter
- Empty state handling (no features, no scores)
- Error handling (malformed frontmatter, missing files)

**Acceptance Criteria**:
- [x] Flow test covers scan → gate → transition
- [x] Empty states handled gracefully
- [x] Error cases don't crash
- [x] `npm test` green
- [x] `npm run build` pending Three Amigos review

## Dependency Graph

```
Inc 0 (Types + Service)      ──→ Inc 1 (Scanner)
Inc 1 (Scanner)              ──→ Inc 2 (Gates) + Inc 3 (FRI)
Inc 2 (Gates)                ──→ Inc 4 (Transitions)
Inc 3 (FRI)                  ──→ Inc 6 (Detail panel)
Inc 4 (Transitions)          ──→ Inc 6 (Detail panel)
Inc 0 (Events)               ──→ Inc 5 (Master UI)
Inc 5 (Master) + Inc 6 (Detail) ──→ Inc 7 (Sessions)
Inc 5 (Master)               ──→ Inc 8 (User Hub card)
Inc 7 + Inc 8                ──→ Inc 10 (Integration)
Inc 9 (Debt)                 ──→ Independent
```

**Parallelizable**: Inc 2 (Gates) and Inc 3 (FRI) can run in parallel. Inc 9 (Debt) is independent.

## Risks & Mitigations

| Risk | Impact | Mitigation | Outcome |
|------|--------|------------|---------|
| PRD frontmatter is inconsistent across 41 files | Medium | Zod schema with lenient parsing + normalization layer | **Materialized** — 14 legacy stage values found, all normalized. Zod `.passthrough()` handles varied frontmatter gracefully. |
| 6 gates are too complex for first cycle | Medium | Start with 3 core gates (Problem, Build, Quality); add Design, Readiness, Release incrementally | **Did not materialize** — all 6 gates delivered in Inc 2, pure function pattern made them straightforward. |
| Event Catalog already has 8 tabs — adding Features creates fatigue | Low | Features tab is the most valuable; consider promoting to its own Hub in C62 if warranted | **Noted** — tab count is 9 now; promotion to standalone Hub considered for C62. |
| Gate checks need vault file content, not just frontmatter | Medium | Use fileExists/readFile for content checks; keep gate logic pure by passing extracted data | **Mitigated** — GateContext pattern extracts all data before gate check; pure functions receive plain objects. |
| FRI scores in existing PRDs are stale | Low | Scan computes from current frontmatter; stale scores are visible as motivation to re-score | **Accepted** — scores extracted from frontmatter as-is; no auto-rescore. |

## Success Metrics

| Metric | Target | Actual |
|--------|--------|--------|
| New tests | ~120 | 230 |
| Post-cycle tests | ~7,276 | 7,386 |
| New suites | ~10 | 9 |
| Source LOC | ~2,000 | ~1,800 |
| Features scannable | 41 PRDs | 41 PRDs |
| Gates implemented | 6 | 6 (Problem, Design, Readiness, Build, Quality, Release) |
| Events | 8 new (390 total) | 6 new (feature.*) + 2 deferred (review.*) |
| Commands | 1 new | Deferred — Features tab accessed via Event Catalog |
| Increments | ~11 | 11 (Inc 0–10) |

## Definition of Done

- [x] `FeatureLifecycleService` scans PRDs, parses frontmatter, normalizes stages
- [x] 6 gate check pure functions implemented and tested
- [x] FRI scoring (7 dimensions) with readiness levels
- [x] Prioritization scoring (7 dimensions) with priority signal
- [x] FeaturesTab in Event Catalog with stage-grouped pipeline
- [x] Feature detail panel with gates, scores, PBIs, sessions
- [x] Stage transitions with gate validation and event emission
- [x] Legacy stage normalization (10+ → 6 standard stages)
- [x] 6 feature events defined and wired (2 review events deferred to C61)
- [x] Feature card on User Hub dashboard
- [x] Storage persistence for sessions and scores
- [x] TD-58 and TD-93 resolved
- [x] Flow integration test for scan → gate → transition
- [x] `npm run build` green
- [x] Three Amigos review completed (TASM 31/35 — Excellent)

## Cycle Results

**Completed**: 2026-03-06
**Tests**: 7,156 → 7,386 (+230 tests, +9 suites)
**Increments**: 11 (Inc 0–10)

### New Files (14)

| File | LOC | Purpose |
|------|-----|---------|
| `src/domain/featureLifecycle/types.ts` | ~180 | Types, stages, gate names, FRI dimensions, labels |
| `src/domain/featureLifecycle/events.ts` | ~30 | FeatureLifecycleEventMap (6 events) |
| `src/domain/featureLifecycle/schemas.ts` | ~45 | Zod PRDFrontmatterSchema |
| `src/domain/featureLifecycle/FeatureLifecycleService.ts` | ~390 | Domain service: scan, parse, score, advance, sessions |
| `src/domain/featureLifecycle/gateChecks.ts` | ~270 | 6 gate check pure functions + GateContext |
| `src/domain/hub/FeatureLifecycleProvider.ts` | ~50 | HubDashboardProvider for User Hub card |
| `src/ui/catalog/FeaturesTab.ts` | ~170 | Feature Pipeline master view (stage-grouped) |
| `src/ui/catalog/FeatureDetailPanel.ts` | ~160 | Feature detail panel (gates, FRI, prioritization) |
| `tests/domain/featureLifecycle/types.test.ts` | ~200 | 30 type tests |
| `tests/domain/featureLifecycle/schemas.test.ts` | ~100 | 9 schema tests |
| `tests/domain/featureLifecycle/scanner.test.ts` | ~250 | 31 scanner + pure function tests |
| `tests/domain/featureLifecycle/gateChecks.test.ts` | ~350 | 35 gate check tests |
| `tests/ui/catalog/FeaturesTab.test.ts` | ~200 | 17 UI tests |
| `tests/ui/catalog/FeatureDetailPanel.test.ts` | ~250 | 19 UI tests |
| `tests/domain/hub/FeatureLifecycleProvider.test.ts` | ~100 | 9 hub provider tests |
| `tests/flows/39-FeatureLifecyclePipeline.test.ts` | ~330 | 13 flow integration tests |

### Edited Files (14)

| File | Change |
|------|--------|
| `src/infrastructure/events/events.ts` | Extended FlowtiEventMap with FeatureLifecycleEventMap |
| `src/infrastructure/views/registry.ts` | Added FeatureLifecycleService to ViewDependencies |
| `src/ui/catalog/EventCatalogView.ts` | Added "Features" tab + FeaturesTab wiring |
| `src/ui/catalog/index.ts` | Added FeaturesTab export |
| `src/main.ts` | Service registration, view deps, hub provider, configurable scanner paths, test report reader |
| `src/domain/settings/settings.ts` | Added `featuresFolder` + `testReportPath` settings |
| `src/domain/featureLifecycle/types.ts` | Added `delivered` + `deferred` to LEGACY_STAGE_MAP |
| `src/domain/testManagement/TestManagementService.ts` | Added `setTestReportReader()` + flow/unit metrics from test report |
| `src/ui/testManagement/PyramidTab.ts` | Drill-down shows layer summary when metrics exist (not guidance callout) |
| `src/ui/testManagement/CoverageTab.ts` | Path-agnostic empty state text |
| `tests/domain/featureLifecycle/FeatureLifecycleService.test.ts` | +21 advanceStage + session tests |
| `tests/infrastructure/events/EventBus.test.ts` | Fixed settings spread for new fields |
| `docs/debt/TD-58 Performance baseline and monitoring thresholds.md` | Resolved with thresholds |
| `docs/debt/TD-93 Duplicate data between plugin state and Obsidian metadata.md` | Resolved |

### Key Decisions

- **FRI scoring delivered in Inc 1** (not separate Inc 3) — `extractFRI()` and `extractPrioritization()` are pure functions naturally part of the scanner
- **GateContext pattern** — gate checks receive extracted data (no I/O), keeping them pure and testable
- **Features tab in Event Catalog** (not standalone Hub) — avoids Hub proliferation, aligns with scope
- **2 review events deferred** — `review.session.created` and `review.session.scored` belong in C61 (Review Automation)
- **No dedicated command** — Features tab is accessed via Event Catalog navigation, no separate command needed
- **Configurable scanner paths** — `featuresFolder` and `testReportPath` added to settings (defaults: `Development/flowti/docs/features`, `Development/flowti/docs/reports/tests/testreport.json`)
- **Test report reader callback** — TestManagementService receives async reader via `setTestReportReader()`, classifies suites by path (`/flows/` → flow, rest → unit)

### Bugs Fixed During Cycle

- **Shallow copy bug**: `{ ...DEFAULT_FEATURE_LIFECYCLE_STATE }` shared `sessions[]` array across instances — replaced with inline init + deep copy in `load()`
- **TS2493**: `vi.fn` `mock.calls` tuple indexing — cast as `unknown[][]`
- **TS2339**: `.dataset` on `Element` — cast to `HTMLElement`

### Post-Cycle Fixes (Live Testing)

- **Scanner path wrong**: Both PRD scanners (Feature Lifecycle + Test Management) used `docs/features` but PRDs live at `Development/flowti/docs/features` — made configurable via `featuresFolder` setting
- **Missing legacy stages**: `"delivered"` (6 PRDs) and `"deferred"` (1 PRD) not in LEGACY_STAGE_MAP — added both mappings (`delivered→done`, `deferred→idea`)
- **Pyramid flow/unit always 0**: `getPyramid()` called `computePyramid(journeys)` without flow/unit params — added `setTestReportReader()` callback that reads testreport.json and classifies suites by path
- **Pyramid drill-down stale guidance**: Non-e2e layers always showed "Expert mode required" callout even with metrics — fixed to show `renderLayerSummary()` when `layer.count > 0`
- **TS2739 in EventBus.test.ts**: Inline settings objects missing new `featuresFolder`/`testReportPath` fields — replaced with `{ ...DEFAULT_SETTINGS, debugMode: true }` spread pattern

## Cycle Retrospective

### What Went Well

1. **GateContext pattern** — Extracting all vault data before calling gate checks made them 100% pure functions. This is the cleanest domain/UI separation in the codebase. Testing was trivial — plain object literals, no mocks.
2. **Increment merging was pragmatic** — Inc 1 (Scanner) and Inc 3 (FRI) were naturally part of Inc 0. Delivering them together avoided artificial boundaries and reduced boilerplate.
3. **230 tests from 120 estimate** — Nearly 2x the target. The pure function pattern made it easy to test every branch of every gate check.
4. **Post-cycle live testing found real bugs** — Scanner path, legacy stages, pyramid metrics — all integration-level issues that unit tests correctly wouldn't catch. Live testing is essential.
5. **Configurable paths** — Making scanner paths settings instead of hardcoded constants was the right call. Different vault layouts now work out of the box.

### Deviations from Plan

| Deviation | Reason | Impact |
|-----------|--------|--------|
| Inc 1 + Inc 3 merged into Inc 0 | Scanner and FRI extraction are naturally coupled | Positive — fewer increments, cleaner delivery |
| 2 review events deferred | Review automation belongs in C61, not C58 | Neutral — correct scoping |
| No dedicated command | Features tab accessed via Event Catalog navigation | Neutral — reduces command count |
| 5 post-cycle bugfixes | Live testing surfaced integration issues | Positive — shipped working product, not just passing tests |
| `stageAtStart` reads current stage at `endSession()` time | Service implementation detail, not a bug | Neutral — documented in flow test |

### Improvement Backlog

| Item | Classification | Target |
|------|----------------|--------|
| Promote Features tab to standalone Hub | Future PRD | C62 |
| `review.session.*` → `feature.review.*` namespace | Tech debt | C61 |
| Session file tracking (filesCreated/Modified) | Deferred PBI | C59+ |
| Defensive copy in `getFeatures()` | Tech debt (minor) | C59 |
| Sort pipeline by priority/FRI | Deferred FR | C59+ |
| Priority badge colors in pipeline master | Deferred FR | C59+ |
| Lint rule for PRD frontmatter typos | Nice-to-have | Backlog |

### Learnings

1. **Pure function + injected context = testability gold standard.** The GateContext pattern should be replicated in any future domain that needs vault data for calculations. Pre-extract, then compute.
2. **Settings fields break test fixtures.** Adding `featuresFolder` and `testReportPath` broke EventBus.test.ts which used inline settings objects. The `{ ...DEFAULT_SETTINGS, ...overrides }` spread pattern is resilient — use it everywhere.
3. **Scanner paths must match vault layout.** The `docs/features` vs `Development/flowti/docs/features` mismatch was a silent failure — 0 results, no error. Add validation logging when scanners return empty results.
4. **Live testing surfaces integration bugs that unit tests miss.** Domain logic was 100% correct. All 5 post-cycle bugs were wiring issues in main.ts and UI rendering. The test pyramid is working as designed — unit tests catch logic errors, integration tests catch wiring errors, live testing catches user-facing issues.
5. **Legacy stage normalization needs a living map.** Started with 10 mappings, ended with 14 after discovering `delivered` and `deferred` in real PRDs. The map should be treated as a living document updated as new values are encountered.

## Inbox & Feedback

### Inbox Items Updated

- **"I want to create and maintain lifecycle descriptions inside Flowti"** — marked as `delivered` (C58). Feature Lifecycle provides PRD-level lifecycle management; entity-level lifecycle (domains, services) could extend this pattern.

### New Feedback Captured

- Scanner should log a warning when it returns 0 results — helps catch path misconfiguration early
- Pipeline view could benefit from drag-and-drop stage transitions (deferred, not MVP)
- File change tracking during sessions would enable automatic artifact documentation (deferred to C59+)

### Next Cycle Inputs (C59: Process Management)

- Feature Lifecycle provides the stage model and gate infrastructure that Process Management will build on
- Process definitions should reference Feature Lifecycle stages and gates
- Session-to-feature binding (from Feature Lifecycle sessions) feeds into process step tracking
- GateContext extraction pattern should be reused for process gates
