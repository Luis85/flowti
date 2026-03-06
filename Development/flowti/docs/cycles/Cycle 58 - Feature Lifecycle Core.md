---
type: DevelopmentCycle
feature: "[[Development/flowti/docs/features/Feature Lifecycle/Feature Lifecycle PRD|Feature Lifecycle PRD]]"
stage: planned
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
pre_cycle_tests: 7156
pre_cycle_suites: 305
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
- [ ] Types defined and exported
- [ ] Events defined and wired into EventMap
- [ ] Service shell loads and scans PRD files
- [ ] `npm test` green

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
- [ ] Scanner finds PRD files in vault
- [ ] Frontmatter parsed correctly with Zod validation
- [ ] Legacy stages normalized (10+ → 6)
- [ ] `npm test` green

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
- [ ] All 6 gate functions implemented as pure functions
- [ ] Each returns structured GateCheckResult
- [ ] Tests cover pass and fail cases for each gate
- [ ] `npm test` green

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
- [ ] FRI computed from 7 dimensions
- [ ] Readiness level derived from total score
- [ ] Priority signal computed
- [ ] Score changes emit events
- [ ] `npm test` green

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
- [ ] Stage transitions validate against gates
- [ ] Frontmatter updated on successful transition
- [ ] Events emitted for stage changes and gate results
- [ ] Invalid transitions rejected
- [ ] `npm test` green

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
- [ ] Features tab appears in Event Catalog
- [ ] Pipeline shows features grouped by stage
- [ ] Feature cards display name, FRI, readiness
- [ ] Search filters features
- [ ] `npm test` green

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
- [ ] Detail panel shows feature information
- [ ] Gate checks displayed as checklist
- [ ] FRI breakdown shown
- [ ] Advance button validates gates
- [ ] `npm test` green

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
- [ ] Sessions tracked per feature
- [ ] Start/end with timestamps persisted
- [ ] Events emitted
- [ ] Session history visible in detail panel
- [ ] `npm test` green

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
- [ ] Feature card appears on User Hub dashboard
- [ ] Stage distribution shown
- [ ] "Open Feature Pipeline" navigation works
- [ ] `npm test` green

---

### Inc 9: TD-58 + TD-93 Closure
**Theme**: Debt
**Effort**: Small | **Est. LOC**: ~50 | **Est. Tests**: ~3

Close carried tech debt:
- TD-58: Document performance baselines — record current startup, storage, and query p50/p95 values
- TD-93: ADR-032 acceptance — verify plugin state reconciliation meets criteria, document acceptance

**Acceptance Criteria**:
- [ ] TD-58 resolved with documented baselines
- [ ] TD-93 resolved with acceptance evidence
- [ ] `npm test` green

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
- [ ] Flow test covers scan → gate → transition
- [ ] Empty states handled gracefully
- [ ] Error cases don't crash
- [ ] `npm test` green
- [ ] `npm run build` green

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

| Risk | Impact | Mitigation |
|------|--------|------------|
| PRD frontmatter is inconsistent across 41 files | Medium | Zod schema with lenient parsing + normalization layer |
| 6 gates are too complex for first cycle | Medium | Start with 3 core gates (Problem, Build, Quality); add Design, Readiness, Release incrementally |
| Event Catalog already has 8 tabs — adding Features creates fatigue | Low | Features tab is the most valuable; consider promoting to its own Hub in C62 if warranted |
| Gate checks need vault file content, not just frontmatter | Medium | Use fileExists/readFile for content checks; keep gate logic pure by passing extracted data |
| FRI scores in existing PRDs are stale | Low | Scan computes from current frontmatter; stale scores are visible as motivation to re-score |

## Success Metrics

| Metric | Target |
|--------|--------|
| New tests | ~120 |
| Post-cycle tests | ~7,276 |
| New suites | ~10 |
| Source LOC | ~2,000 |
| Features scannable | 41 PRDs |
| Gates implemented | 6 (Problem, Design, Readiness, Build, Quality, Release) |
| Events | 8 new (390 total) |
| Commands | 1 new (flowti:feature-pipeline) |
| Increments | ~11 |

## Definition of Done

- [ ] `FeatureLifecycleService` scans PRDs, parses frontmatter, normalizes stages
- [ ] 6 gate check pure functions implemented and tested
- [ ] FRI scoring (7 dimensions) with readiness levels
- [ ] Prioritization scoring (7 dimensions) with priority signal
- [ ] FeaturesTab in Event Catalog with stage-grouped pipeline
- [ ] Feature detail panel with gates, scores, PBIs, sessions
- [ ] Stage transitions with gate validation and event emission
- [ ] Legacy stage normalization (10+ → 6 standard stages)
- [ ] 8 feature/review events defined and wired
- [ ] Feature card on User Hub dashboard
- [ ] Storage persistence for sessions and scores
- [ ] TD-58 and TD-93 resolved
- [ ] Flow integration test for scan → gate → transition
- [ ] `npm run build` green
- [ ] Three Amigos review completed
