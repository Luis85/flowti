---
type: ReadinessCheck
date: 2026-03-06
cycle: 58
feature: "[[Development/flowti/docs/features/Feature Lifecycle/Feature Lifecycle PRD|Feature Lifecycle PRD]]"
result: PASS
conditions: []
---

# Definition of Ready Check: Cycle 58 — Feature Lifecycle Core

**Cycle**: [[Cycle 58 - Feature Lifecycle Core]]
**Feature/Driver**: [[Feature Lifecycle PRD]] (Theme 9: Feature Lifecycle — The MVP Backbone)
**FRI**: 27/35 (Integration Ready threshold: >=19/35) — **PASS**
**Date**: 2026-03-06
**Result**: **PASS** (no conditions)

## Readiness Summary

| Section | Status | Notes |
|---------|--------|-------|
| 1. Feature PRD Readiness | PASS | FRI 27/35; PRD approved with 30+ FRs; stage `approved`; Technical Review passed 2026-02-15; exceeds new-feature threshold |
| 2. Backlog Readiness | PASS | 11 PBIs defined with estimates; chunked into 11 increments; dependency graph documented; priority ranked |
| 3. Cycle Plan Document | PASS | Full plan with situation assessment, 8 goals, 11 increments with AC/LOC/test estimates, dependency graph, 5 risks, success metrics, deferred items |
| 4. Increment Readiness | PASS | All 11 increments have: scope, AC, LOC/test estimates. Architecture seams align with PRD §9 service API |
| 5. Quality Baseline | PASS | 7,156 tests (305 suites), green build, 0 errors, no critical bugs, C57 closed |
| 6. Pre-Cycle Completion | PASS | C57 closed (stage: done, 9 increments), MVP roadmap planned (C58–C62), inbox reviewed, backlog refinement completed |

## FRI Score Breakdown

| Dimension | Score | Rationale |
|-----------|-------|-----------|
| Strategy | 5/5 | Directly serves MVP Theme 9 "Feature Lifecycle — The MVP Backbone". Addresses the core gap: 41 PRDs with no visibility, scoring, or gate management. All subsequent MVP cycles (C59–C62) depend on this. PRD explicitly positions Feature Lifecycle as the entity everything else binds to. |
| Scope | 5/5 | 30+ functional requirements across 7 sections (Discovery, Phase Mapping, Gates, FRI, Sessions, Reviews, Transitions). Clear in-scope/out-of-scope boundaries. Data model, event impact, adapter API all specified. 6 stages, 6 gates, 7 FRI dimensions, 7 prioritization dimensions — all enumerated. |
| Architecture | 4/5 | PRD §9 defines `FeatureLifecycleService` API (11 methods). Gate checks specified as pure functions (§5, 6 gates). Follows established patterns: BaseHubView tabs, master/detail, TypedStorage, EventMap composition. FeaturesTab follows proven ProductsTab/HealthTab pattern. Gap: No existing spike code — this is greenfield implementation (mitigated by mature patterns). |
| Event Integration | 4/5 | 8 events specified with payloads (PRD §7). Consumes 4 existing events (file.created, file.modified, settings.changed, doc.created). Follows established `domain.entity.verb` naming. Events already listed in PRD frontmatter `related_events`. Gap: `review.session.created/scored` interaction with future C61 review automation not fully specified. |
| Data Model | 4/5 | PRD §6 defines 4 entity types (FeatureEntry, GateCheckResult, SessionRecord, ReviewRecord). Frontmatter schema specified with exact field names matching existing PRD conventions. Storage schema defined. Decomposition hierarchy documented (Domain → JTBD → User Stories → PRD → Product → Features → PBIs → Use Cases). Gap: No Zod schemas yet — cycle plan addresses this in Inc 1. |
| UI Consistency | 3/5 | Follows established master/detail pattern proven in 5+ tabs. FeaturesTab is a new tab in Event Catalog — same shell, same interaction model. Stage grouping mirrors existing category grouping patterns. Detail panel sections (gates, scores, sessions) are new UI but follow existing accordion/list patterns. Gap: No mockups; FRI scoring form and gate checklist are new interaction patterns. |
| Validation & Testing | 2/5 | ~120 new tests targeted across 11 increments. Per-increment test counts estimated. All increments have `npm test` green criterion. Gate checks are pure functions — highly testable. Gap: No flow-level integration test specified in PRD (cycle plan addresses this in Inc 10). No E2E journey defined for Feature Pipeline (deferred to C62). Test strategy is implicitly unit-focused. |
| **Total** | **27/35** | **Exceeds new-feature threshold (19/35). Gaps concentrated in UI Consistency and Validation — expected for a new domain with no prior implementation.** |

## Section-by-Section Verification

### 1. Feature PRD Readiness

- [x] PRD exists: [[Feature Lifecycle PRD]] — approved, 30+ functional requirements across 7 sections
- [x] Stage: `approved` — reached via Problem Gate → Design Gate transitions on 2026-02-15
- [x] FRI scored: 27/35 across 7 dimensions (persisted in frontmatter)
- [x] FRI meets threshold: 27 >= 19 (new feature) ✓ — Integration Ready level
- [x] Technical Review: Passed 2026-02-15 — documented in PRD Stage History (Technical Architect sign-off)

### 2. Backlog Readiness

- [x] PBIs defined: 11 PBIs (PBI-FL-001 through PBI-FL-011) with problem statements, solution approaches, acceptance criteria per increment
- [x] PBIs chunked into increments: 11 increments (Inc 0 through Inc 10), each a vertical slice
  - Inc 0: Types + Service shell (foundation)
  - Inc 1: Scanner + normalization (discovery)
  - Inc 2: Gate checks (domain logic)
  - Inc 3: FRI scoring (domain logic)
  - Inc 4: Stage transitions (domain logic)
  - Inc 5: Pipeline UI master view (UI)
  - Inc 6: Detail panel (UI)
  - Inc 7: Session tracking (domain + storage)
  - Inc 8: User Hub card (integration)
  - Inc 9: TD-58 + TD-93 (debt closure)
  - Inc 10: Integration testing + polish (quality)
- [x] Dependencies mapped: ASCII dependency graph in cycle plan; parallelism identified (Inc 2 || Inc 3, Inc 9 independent)
- [x] Priority ranked: foundation first (Inc 0→1), domain logic next (Inc 2→4), UI last (Inc 5→6); debt independent
- [x] LOC and test estimates per increment (total: ~2,000 LOC, ~120 tests)

### 3. Cycle Plan Document

- [x] Frontmatter present: type, feature, stage, cycle, release_anchor, mvp link, pbis (11), bugs, tech_debt (2), estimated_increments (12), estimated_tests (120), pre_cycle_tests (7156), pre_cycle_suites (305)
- [x] Situation assessment written: pre-cycle state with test counts, build status, hub views, event count, command count, C57 summary, foundation table (7 components), carried-forward items (3), deferred items from original C58
- [x] Cycle goals defined: 8 goals with clear deliverables (service, gates, FRI, prioritization, pipeline UI, transitions, events, dashboard card)
- [x] Proposed increments: 11 increments (Inc 0–10), each with: theme, effort, LOC estimate, test estimate, description, acceptance criteria
- [x] Dependency graph drawn: ASCII diagram with parallelism identified
- [x] Risks identified: 5 risks with impact ratings and mitigations
- [x] Success metrics defined: 9 measurable targets (tests, suites, LOC, features scannable, gates, events, commands, increments)
- [x] Deferred items documented: 6 items from original C58 (CI/CD, repo restructure, marketplace) + 4 future-cycle items (C59–C61 scope exclusions)

### 4. Increment Readiness

For each increment, checking: scope ✓/✗, AC ✓/✗, test intent ✓/✗, doc intent ✓/✗, architecture seams ✓/✗, estimated size ✓/✗

#### Inc 0: Feature Lifecycle Domain — Types + Service Shell
- [x] Scope: Define types (FeatureEntry, GateCheckResult, FeatureStage, FRIScore, etc.), events (8), service shell
- [x] AC: 4 criteria — types exported, events wired, service scans PRDs, tests green
- [x] Test intent: ~15 tests (types, event definitions, service initialization)
- [x] Doc intent: Implied — new domain directory establishes patterns
- [x] Architecture seams: New `src/domain/featureLifecycle/` directory; events composed into infrastructure EventMap
- [x] Estimate: ~200 LOC, ~15 tests

#### Inc 1: PRD Scanner + Stage Normalization
- [x] Scope: Scan `docs/features/*/` for PRD frontmatter, parse with Zod, normalize 10+ legacy stages to 6
- [x] AC: 4 criteria — scanner finds PRDs, Zod validation, legacy normalization, tests green
- [x] Test intent: ~15 tests (scanning, parsing, normalization mapping)
- [x] Doc intent: Implied — Zod schema documents frontmatter contract
- [x] Architecture seams: Uses FileSystemClient for vault scanning; Zod schema defines validation boundary
- [x] Estimate: ~150 LOC, ~15 tests

#### Inc 2: Gate Check Pure Functions
- [x] Scope: 6 gate check functions as pure functions, structured GateCheckResult
- [x] AC: 4 criteria — all 6 gates implemented, structured results, pass/fail coverage, tests green
- [x] Test intent: ~20 tests (pass + fail per gate × 6 gates, edge cases)
- [x] Doc intent: Implied — pure functions are self-documenting via types
- [x] Architecture seams: Pure functions in dedicated file; no Obsidian imports; follows established calculator pattern
- [x] Estimate: ~200 LOC, ~20 tests

#### Inc 3: FRI Scoring
- [x] Scope: FRI computation from 7 dimensions, readiness levels, prioritization signal, event emission
- [x] AC: 5 criteria — FRI computed, readiness levels, priority signal, events emitted, tests green
- [x] Test intent: ~12 tests (dimension scoring, level boundaries, priority formula)
- [x] Doc intent: Implied — readiness level thresholds documented in code
- [x] Architecture seams: Pure computation functions; event emission via EventBus
- [x] Estimate: ~100 LOC, ~12 tests

#### Inc 4: Stage Transitions + Validation
- [x] Scope: Stage advancement with gate validation, frontmatter updates, event emission
- [x] AC: 5 criteria — gate validation, frontmatter update, events emitted, invalid transitions rejected, tests green
- [x] Test intent: ~10 tests (valid transitions, gate failures, invalid transitions, event assertions)
- [x] Doc intent: None (incremental on Inc 0 service)
- [x] Architecture seams: Service method; uses gate checks (Inc 2); FileSystemClient for frontmatter update
- [x] Estimate: ~100 LOC, ~10 tests

#### Inc 5: Feature Pipeline UI — Master View
- [x] Scope: FeaturesTab in Event Catalog, stage-grouped pipeline, feature cards, search/filter
- [x] AC: 5 criteria — tab appears, stage grouping, feature cards with metrics, search works, tests green
- [x] Test intent: ~12 tests (tab registration, rendering, stage grouping, card content, search)
- [x] Doc intent: Implied — new tab follows established pattern
- [x] Architecture seams: New `src/ui/featureLifecycle/` components; EventCatalogView tab definitions
- [x] Estimate: ~250 LOC, ~12 tests

#### Inc 6: Feature Detail Panel
- [x] Scope: Detail panel with gates, FRI breakdown, prioritization, PBIs, advance button
- [x] AC: 5 criteria — detail shows info, gate checklist, FRI breakdown, advance button, tests green
- [x] Test intent: ~12 tests (panel rendering, gate display, score display, advance interaction)
- [x] Doc intent: None (incremental on Inc 5 UI)
- [x] Architecture seams: Detail component follows master/detail pattern; uses gate checks and FRI scoring
- [x] Estimate: ~250 LOC, ~12 tests

#### Inc 7: Feature Session Tracking
- [x] Scope: Session start/end per feature, storage persistence, event emission, session history display
- [x] AC: 5 criteria — sessions tracked, timestamps persisted, events emitted, history visible, tests green
- [x] Test intent: ~8 tests (start, end, persistence, event emission, history retrieval)
- [x] Doc intent: None (storage schema self-documenting)
- [x] Architecture seams: TypedStorage for persistence; EventBus for file tracking events
- [x] Estimate: ~100 LOC, ~8 tests

#### Inc 8: User Hub Feature Card + HubDashboardProvider
- [x] Scope: Dashboard provider, summary card with stage distribution, quick action navigation
- [x] AC: 4 criteria — card appears, distribution shown, navigation works, tests green
- [x] Test intent: ~5 tests (provider registration, card rendering, data aggregation)
- [x] Doc intent: None (follows established HubDashboardProvider pattern)
- [x] Architecture seams: Implements HubDashboardProvider interface; wired into UserHubView
- [x] Estimate: ~80 LOC, ~5 tests

#### Inc 9: TD-58 + TD-93 Closure
- [x] Scope: Document performance baselines (TD-58), verify ADR-032 acceptance (TD-93)
- [x] AC: 3 criteria — TD-58 resolved, TD-93 resolved, tests green
- [x] Test intent: ~3 tests (baseline verification tests)
- [x] Doc intent: Tech debt items closed with documentation
- [x] Architecture seams: Documentation-only; no code changes expected
- [x] Estimate: ~50 LOC, ~3 tests

#### Inc 10: E2E Polish + Integration Testing
- [x] Scope: Flow integration test (scan → gate → transition), empty states, error handling
- [x] AC: 5 criteria — flow test, empty states, error handling, tests green, build green
- [x] Test intent: ~8 tests (flow test, empty state, malformed frontmatter, missing files)
- [x] Doc intent: None (tests are the documentation)
- [x] Architecture seams: Flow test follows established pattern in `tests/flows/`
- [x] Estimate: ~150 LOC, ~8 tests

### 5. Quality Baseline

- [x] Build pipeline green: `npm run check` passes — 0 errors (verified 2026-03-06)
- [x] Test suite green: `npm test` → 7,156 tests, 305 suites, 0 failures, 32 skipped (verified 2026-03-06)
- [x] No critical bugs open (verified post-C57)
- [x] Previous cycle closed: C57 stage `done`, date_completed 2026-03-05, 9 increments delivered, 362 new tests, Test Management Hub delivered

### 6. Pre-Cycle Completion

- [x] Pre-cycle work documented: MVP backlog refinement completed — [[Backlog Refinement - MVP Cycles C58-C62]] with 50 PBIs across 5 cycles, risk assessment, adaptability rules
- [x] MVP roadmap created: [[MVP - Product Development Lifecycle]] with gap analysis across 6 domains, 4 actors, 15-step lifecycle journey
- [x] Cycle plans created: C58–C62, each with full situation assessment, increments, dependency graphs, risks, success metrics
- [x] Inbox signals reviewed:
  - **PRD - Process Mapping** (vault inbox) — Core MVP domain, targeted for C59. Phase 1 scope defined.
  - **PRD - Process Execution Framework** (vault inbox) — Core MVP domain, targeted for C59. Phase 1 scope defined.
  - **"I want to build a clear picture from vision to shipped value"** — Directly addressed by Feature Pipeline (C58). In scope.
  - **"How can I use Flowti to get guided from idea to solution"** — Feature Lifecycle flow addresses this. In scope.
  - **"How can agile methods be adopted by Sessions"** — Lifecycle Sessions targeted for C59. Deferred.
  - TD-58, TD-93 — Carried from C57, in scope for Inc 9.

## Observations

1. **Feature Lifecycle PRD is the most mature input for a new-feature cycle**: FRI 27/35 (Integration Ready), approved stage, comprehensive spec with 30+ FRs, full data model, event impact, and adapter API defined. This is significantly more prepared than typical new-feature starts.

2. **All 41 existing PRDs provide real test data**: The scanner will operate on 41 real PRD files with diverse frontmatter patterns. This validates the normalization layer against real-world data from day one — no synthetic test data needed for integration testing.

3. **Gate check pure functions are the lowest-risk, highest-value increment**: Following the established calculator pattern (pyramid, coverage, compliance), gate checks are pure functions with no I/O. They are highly testable, easily debuggable, and provide immediate user value by surfacing what's blocking PRD advancement.

4. **Original C58 (Publication Readiness) was explicitly deferred**: The user prioritized MVP feature development over release readiness. All Publication Readiness items (CI/CD, repo restructure, marketplace) are deferred to post-C62. This is a deliberate roadmap decision, not scope creep.

5. **C58 is the critical path for the entire MVP**: Feature Lifecycle is the entity that Process Management (C59), Test Traceability (C60), Review Automation (C61), and MVP Integration (C62) all bind to. Delays in C58 cascade through the entire 5-cycle plan.

6. **Inc 2 and Inc 3 are parallelizable**: Gate checks (Inc 2) and FRI scoring (Inc 3) both depend on Inc 1 (scanner) but not on each other. Running them in parallel shortens the critical path to Inc 4 (transitions) and Inc 6 (detail panel).

7. **Tech debt items (Inc 9) are independent**: TD-58 and TD-93 are documentation-only closures that can be done at any point during the cycle without blocking other increments.

## Related

- [[Cycle 58 - Feature Lifecycle Core]]
- [[Feature Lifecycle PRD]]
- [[Backlog Refinement - MVP Cycles C58-C62]]
- [[MVP - Product Development Lifecycle]]
- [[Cycle 57 - Test Management Hub]]
- [[Definition of Ready Check - Cycle 55]]
- [[Definition of Ready (Cycle)]]
