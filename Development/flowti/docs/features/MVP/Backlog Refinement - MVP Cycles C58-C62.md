---
type: Process
domain: Flowti/MVP
stage: active
version: 1
tags:
  - backlog
  - refinement
  - mvp
  - roadmap
created: 2026-03-06
---

# Backlog Refinement — MVP Cycles C58–C62

## Purpose

This document captures the backlog refinement for the first Product Increment (MVP). It maps existing PRDs, inbox items, tech debt, and deferred work to the 5-cycle roadmap.

## Pre-State

- **Tests**: 7,156 (305 suites)
- **Events**: 382
- **Commands**: 47
- **Hub Views**: 6
- **Domains**: 24

## Input Sources

### Ready PRDs (approved, ready for implementation)

| PRD | Stage | FRI | Target Cycle |
|-----|-------|-----|-------------|
| **Feature Lifecycle** | approved | 27/35 | **C58** |

### Draft PRDs (require promotion + scoping for MVP)

| PRD | Location | Target Cycle | MVP Scope |
|-----|----------|-------------|-----------|
| **PRD - Process Mapping** | vault inbox | **C59** | Phase 1: 4 core node types, canvas parser, validation, Development Lifecycle as reference process |
| **PRD - Process Execution Framework** | vault inbox | **C59** | Phase 1: state tracking, step transitions, event emission; defer metrics dashboards, simulation |

### Deferred from C57

| Item | Type | Target Cycle | Notes |
|------|------|-------------|-------|
| E2E Journey: Test Management Hub | PBI (deferred) | C60 or C62 | Create alongside Journey Builder Phase 3 |
| E2E Journey: Journey Executor | PBI (deferred) | C60 or C62 | Create alongside Journey Executor v2 |
| TD-58: Performance baselines | Tech debt | C62 | Documentation-only, low priority |
| TD-93: ADR-032 acceptance | Tech debt | C62 | Documentation-only, low priority |

### Relevant Inbox Items

| Inbox Item | Stage | MVP Relevance | Target |
|------------|-------|--------------|--------|
| PRD - Process Mapping | draft | Core MVP domain | C59 |
| PRD - Process Execution Framework | draft | Core MVP domain | C59 |
| How can Flowti improve the whole Software-Dev Pre-Production Process | — | Validates MVP vision | Reference |
| How can I make following the Process a habit | discovery | Process compliance UI | C59 |
| Track when a Process or Flow starts and ends | discovery | Process state tracking | C59 |
| Use PEF to guide user through flows and processes | — | Process execution integration | C59–C60 |
| Use PEF to guide Onboarding or improve UX | backlog | Process-driven onboarding | Post-MVP |
| Execute a Process Mapping Workshop | — | Process design tooling | C59 |
| I want to build a clear picture from vision to shipped value | — | Feature Pipeline view | C58 |
| How can I use Flowti to get guided from idea to solution | — | Feature Lifecycle flow | C58 |
| How can agile methods be adopted by Sessions | — | Lifecycle Sessions | C59 |

### Tech Debt (open, relevant to MVP)

| ID | Title | Impact | Target |
|----|-------|--------|--------|
| TD-06 | UI layer bypasses EventBridge | Medium | Best effort during relevant cycles |
| TD-130 | JourneyBuilderSidebar exceeds 600 LOC | Medium | C60 (during JB Phase 3) |
| TD-132 | Shared UI primitives not extracted | Medium | C62 (integration polish) |

---

## Cycle Assignments

### C58: Feature Lifecycle Core

**Goal**: The backbone — make features visible, scorable, and advanceable.

**PBIs:**

| ID | Title | Est. Tests | Priority |
|----|-------|-----------|----------|
| PBI-FL-001 | FeatureLifecycleService — scan, parse, stage management | ~20 | 1 |
| PBI-FL-002 | Gate check pure functions (6 gates) | ~20 | 1 |
| PBI-FL-003 | FRI scoring (7 dimensions, readiness levels) | ~15 | 1 |
| PBI-FL-004 | Prioritization scoring (7 dimensions) | ~10 | 2 |
| PBI-FL-005 | Feature Pipeline UI — FeaturesTab in Event Catalog | ~15 | 1 |
| PBI-FL-006 | Feature detail panel (gates, scores, PBIs, sessions) | ~10 | 1 |
| PBI-FL-007 | Stage transitions with gate validation | ~10 | 1 |
| PBI-FL-008 | Legacy stage normalization | ~5 | 2 |
| PBI-FL-009 | Events (8 new feature.* + review.*) | ~5 | 1 |
| PBI-FL-010 | Feature card on User Hub dashboard | ~5 | 3 |
| PBI-FL-011 | Storage persistence for sessions and scores | ~5 | 1 |

**Entry criteria**: Feature Lifecycle PRD is approved (done). Tests green (done).
**Exit criteria**: Features visible in Pipeline, FRI scoring works, gates validate, stage transitions emit events.

---

### C59: Process Management Phase 1 + Lifecycle Sessions

**Goal**: Make the Development Lifecycle visible as an executable process and make sessions lifecycle-aware.

**PBIs:**

| ID | Title | Est. Tests | Priority |
|----|-------|-----------|----------|
| PBI-PM-001 | Promote Process PRDs to features directory | ~0 | 1 |
| PBI-PM-002 | ProcessService — process definition model, scanning | ~15 | 1 |
| PBI-PM-003 | Process node types Phase 1 (Start, Activity, Decision, End) | ~15 | 1 |
| PBI-PM-004 | Canvas process parser — read nodes/edges from Canvas | ~15 | 1 |
| PBI-PM-005 | Process validation — core lint rules (structural) | ~15 | 1 |
| PBI-PM-006 | Development Lifecycle as reference process map | ~5 | 2 |
| PBI-PM-007 | Phase-to-stage mapping (10 phases → 6 stages) | ~10 | 1 |
| PBI-PM-008 | Process compliance indicators per feature | ~10 | 2 |
| PBI-SS-001 | Session v3 — feature binding ("Start session on Feature X") | ~15 | 1 |
| PBI-SS-002 | Session completion → feature progress update | ~10 | 2 |
| PBI-PM-009 | Process events (12 new process.*) | ~5 | 1 |

**Entry criteria**: C58 complete, FeatureLifecycleService exists.
**Exit criteria**: Development Lifecycle modeled as process, sessions bound to features, compliance indicators visible.

---

### C60: Journey Builder Phase 3 + Feature Quality

**Goal**: Connect testing to features and enhance the journey authoring experience.

**PBIs:**

| ID | Title | Est. Tests | Priority |
|----|-------|-----------|----------|
| PBI-JB-001 | Lifecycle journey templates (5 templates for lifecycle phases) | ~10 | 2 |
| PBI-JB-002 | Journey Executor v2 — retry logic, conditional steps | ~15 | 1 |
| PBI-JB-003 | Journey Executor v2 — enhanced error reporting | ~10 | 1 |
| PBI-TQ-001 | Feature-centric test view in Test Management Hub | ~15 | 1 |
| PBI-TQ-002 | Test-to-PRD traceability (journey → feature binding) | ~10 | 1 |
| PBI-TQ-003 | Test result history per feature (timeline) | ~10 | 2 |
| PBI-TQ-004 | TD-130 resolution — JourneyBuilderSidebar decomposition | ~5 | 3 |
| PBI-JB-004 | E2E journey: Test Management Hub (deferred from C57) | ~15 | 2 |
| PBI-JB-005 | E2E journey: Journey Executor (deferred from C57) | ~10 | 2 |

**Entry criteria**: C59 complete, features have stages and compliance indicators.
**Exit criteria**: Journeys linked to features, test results visible per feature, lifecycle templates available.

---

### C61: Quality + Review Automation

**Goal**: Close the review loop with automation, scoring, and quality dashboards.

**PBIs:**

| ID | Title | Est. Tests | Priority |
|----|-------|-----------|----------|
| PBI-QA-001 | Three Amigos review session creation (auto-scaffold doc) | ~10 | 1 |
| PBI-QA-002 | Review context pre-fill (PRD summary, test results, coverage) | ~10 | 1 |
| PBI-QA-003 | TASM scoring UI in Feature detail panel | ~10 | 1 |
| PBI-QA-004 | TASM score persistence to review doc frontmatter | ~10 | 1 |
| PBI-QA-005 | Quality dashboard — feature × quality matrix | ~15 | 1 |
| PBI-QA-006 | Feature quality gate automation (system checks) | ~10 | 2 |
| PBI-QA-007 | Review history per feature (timeline with TASM trend) | ~10 | 2 |
| PBI-QA-008 | Compliance reporting — ISO characteristics per feature | ~10 | 3 |
| PBI-QA-009 | Process→Journey compilation Phase 1 (happy path only) | ~15 | 2 |

**Entry criteria**: C60 complete, test traceability exists, features have quality data.
**Exit criteria**: Reviews create structured docs, TASM scores persist, quality dashboard shows feature health.

---

### C62: MVP Integration + Polish

**Goal**: Wire everything into one coherent end-to-end experience.

**PBIs:**

| ID | Title | Est. Tests | Priority |
|----|-------|-----------|----------|
| PBI-MVP-001 | Full lifecycle E2E journey (idea → done, 15 steps) | ~15 | 1 |
| PBI-MVP-002 | Cross-hub navigation (Feature → Tests → Reviews → Analytics) | ~10 | 1 |
| PBI-MVP-003 | MVP cockpit dashboard (unified feature lifecycle view) | ~15 | 1 |
| PBI-MVP-004 | Deep links (feature → tests, reviews, sessions, PBIs) | ~10 | 2 |
| PBI-MVP-005 | Empty states and onboarding callouts for new domains | ~5 | 2 |
| PBI-MVP-006 | TD-58 resolution — performance baselines | ~5 | 3 |
| PBI-MVP-007 | TD-93 resolution — ADR-032 acceptance | ~0 | 3 |
| PBI-MVP-008 | TD-132 resolution — shared UI primitives | ~10 | 3 |
| PBI-MVP-009 | Updated component docs and sitemap | ~0 | 2 |
| PBI-MVP-010 | MVP user testing preparation (guided walkthrough) | ~10 | 2 |

**Entry criteria**: C61 complete, all domains connected.
**Exit criteria**: End-to-end journey passes, cross-hub nav works, dashboard shows lifecycle, MVP ready for user testing.

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Feature Lifecycle is larger than estimated | Medium | High | Start with 3 simple gates; add incrementally |
| Process Mapping Canvas parser is complex | Medium | Medium | Start with 4 node types; use existing canvas parsing from Journey Builder |
| Session v3 lifecycle binding creates tight coupling | Medium | Medium | Event-based binding via feature.session.started/ended |
| C62 integration discovers missing pieces | Medium | Medium | Each cycle delivers testable increments |
| 5 cycles is insufficient for MVP | Medium | High | Roadmap is adaptive; C62 scope flexes; can extend to C63 |
| Two Process PRDs compete for scope | Low | Medium | MVP scopes Phase 1 only; full vision deferred |

## Adaptability Rules

1. **Each cycle is independently valuable** — Feature Lifecycle alone improves the product even without Process Management
2. **Cycles can be resequenced** — C60 and C61 have weak ordering; quality work can overlap with journey work
3. **PBI priorities guide cuts** — Priority 3 items can be deferred without blocking the MVP
4. **The journey file is living documentation** — update it as capabilities land
5. **Retrospectives feed forward** — each cycle's improvement backlog refines the next cycle's plan
