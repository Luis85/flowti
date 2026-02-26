---
type: ReadinessCheck
date: 2026-02-26
cycle: 47
feature: "[[Onboarding PRD]]"
result: PASS
conditions: []
---

# Definition of Ready Check: Cycle 47 — Onboarding Phase 2: Contextual Guidance

**Date:** 2026-02-26
**Cycle:** [[Cycle 47 - Onboarding Phase 2]]
**Feature:** [[Onboarding PRD]] (v2, FRI 24/35, stage: in-progress)

---

## Readiness Summary

| Section | Status | Notes |
|---------|--------|-------|
| 1. Feature PRD Readiness | PASS | PRD v2, FRI 24/35 (≥11 continuation threshold; ≥19 new-feature threshold), stage: in-progress. 20 FRs across 3 phases, 10 delivered. |
| 2. Backlog Readiness | PASS | 5 PBIs (PBI-ONB-010, 011, 012, 013, 017), 5 increments, dependencies mapped, priority ranked. |
| 3. Cycle Plan Document | PASS | Full cycle doc with situation assessment, 5 goals, 5 increments, 6 risks, success metrics, backlog refinement (12 items triaged). |
| 4. Increment Readiness | PASS | All 5 increments have scope, AC, test intent, file tables, LOC estimates, architecture seams. |
| 5. Quality Baseline | PASS | 5,201 tests, 219 suites, green build (`npm test` clean). No critical bugs. Cycle 46 closed (stage: completed). |
| 6. Pre-Cycle Completion | PASS | No pre-cycle fixes needed. Backlog refinement conducted — 13 inbox items triaged, 5 PBIs scoped. |

---

## Result: PASS

Cycle 47 meets all 6 readiness sections. No conditions to clear before execution.

---

## FRI Score: 24/35 (Technically Ready)

| Dimension | Score | Rationale |
|-----------|-------|-----------|
| Strategy | 4/5 | Onboarding is core to user retention; "first hour to productivity" is a stated product goal. 3-phase roadmap with clear problem statement. No formal strategy doc (-1). |
| Scope | 4/5 | 3 phases clearly delineated with in-scope/out-of-scope. 20 FRs numbered and phased. Phase 3 items still in discovery (-1). |
| Architecture | 3/5 | OnboardingService extraction path defined, migration strategy documented, BaseHubView integration point identified. Not yet validated in code — this IS the implementation cycle. |
| Event Integration | 3/5 | 4 events defined with payloads and triggers. Event catalog category specified. `installer.completed` consumption documented. Events not yet implemented. |
| Data Model | 3/5 | `OnboardingState` type fully defined. Migration from `AnalyticsState.onboardingChecklist` planned (same pattern as analytics migration from DX Hub). Storage key specified. |
| UI Consistency | 4/5 | Reuses established patterns: empty state hero (C45), `ft-stat-card` grid, callout banners, Settings section layout. Callout pattern is new but follows `ft-stat-card` conventions. |
| Validation & Testing | 3/5 | Phase 1 has 9 tests passing. Phase 2 estimates ~55 tests across 5 increments. Test intent stated per increment with specific scenarios. |

**Threshold check:** Continuation cycle requires ≥11/35 (Stable). Score 24/35 exceeds both continuation threshold (11) and new-feature threshold (19).

---

## 1. Feature PRD Readiness

- [x] PRD exists — [[Onboarding PRD]] v2
- [x] PRD stage is `in-progress` (continuation cycle — Phase 1 delivered in C45/C46, Phase 2 planned)
- [x] FRI scored — 24/35 (Strategy 4, Scope 4, Architecture 3, Event Integration 3, Data Model 3, UI Consistency 4, Validation & Testing 3)
- [x] FRI meets threshold — 24 ≥ 11 (continuation cycle threshold); also ≥ 19 (new-feature threshold)
- [x] Technical Review passed — Cycle 46 completed cleanly (5/5 increments, 5,201 tests, 2 bugs fixed mid-cycle, zero regressions)
- [x] v2 Functional Requirements defined — FR-3, FR-6, FR-13, FR-14, FR-15 (Phase 2) and FR-16–FR-20 (Phase 3) added
- [x] v2 Extended Backlog updated — 17 PBIs total (8 Done, 4 Planned, 5 Discovery)
- [x] Inbox refinement completed — 13 onboarding-related items triaged with decisions and rationale

## 2. Backlog Readiness

- [x] PBIs defined — [[PBI-ONB-012 OnboardingService Extraction]], [[PBI-ONB-010 Contextual View Callouts]], [[PBI-ONB-011 Onboarding Reset from Settings]], [[PBI-ONB-013 Onboarding Lifecycle Events]], [[PBI-ONB-017 Hub Empty States]]
- [x] PBIs chunked into 5 increments — each a vertical slice with end-to-end value (service extraction → callouts → settings → events → empty states)
- [x] Dependencies mapped — Inc 1 is foundation; Inc 2–4 depend on Inc 1 (OnboardingService); Inc 5 is independent (UI-only)
- [x] Priority ranked — Foundation first (Inc 1), core features second (Inc 2–3), infrastructure third (Inc 4), UX polish last (Inc 5)

**Note:** Each PBI has problem statement, solution approach, and acceptance criteria documented in the cycle plan increments.

## 3. Cycle Plan Document

- [x] Cycle document exists with standard frontmatter — stage `planned`, 5 PBIs, 1 tech debt item (TD-23)
- [x] Situation assessment written — post-Cycle 46 state: 5,201 tests, 219 suites, onboarding domain status (OnboardingChecklist in AnalyticsState, 9 tests, 4 gaps identified), Hub view status (5 subclasses, only Analytics Hub well-served), Settings status (12 sections, no onboarding section)
- [x] Cycle goals defined — 5 goals (OnboardingService Extraction, Contextual Callouts, Settings Reset, Lifecycle Events, Hub Empty States)
- [x] Proposed increments specified — 5 increments with scope tables, file lists, LOC estimates, test counts
- [x] Dependency graph drawn — Inc 1 foundation, Inc 2–4 depend on Inc 1, Inc 5 independent; parallelism identified
- [x] Risks identified — 6 risks with mitigations (migration data loss, BaseHubView complexity, intrusive callouts, accidental reset, empty state flash, new storage key)
- [x] Success metrics defined — ~55 tests, ~5,256 total, ~222 suites, 4 onboarding events, 4 Hub views with empty states, 4 Hub views with callouts, 6 FRs delivered
- [x] Deferred items documented — 8 items with rationale and target (PBI-ONB-014/015/016/018, PM seed content, example domain seeding, Train Hub empty state, onboarding telemetry)

## 4. Increment Readiness

| Inc | Scope | AC | Test Intent | Doc Intent | Architecture Seams | Estimate |
|-----|-------|----|-------------|------------|---------------------|----------|
| 1 | OnboardingService Extraction — standalone service with `onboarding` storage key, migration from AnalyticsState | 7 criteria | ~12 tests (migration, init, callout CRUD, first-visit, reset, persistence) | Update Onboarding PRD: FR-14 delivered | New `src/domain/onboarding/` (types.ts, OnboardingService.ts, events.ts) + main.ts wiring + AnalyticsService delegation | +200 / -45 LOC |
| 2 | Contextual View Callouts — first-visit dismissible callout banners on 4 Hub views | 8 criteria | ~12 tests (4 views × 3 scenarios: first-visit render, dismiss persist, no-show on revisit) | Update Onboarding PRD: FR-3, FR-15 delivered | BaseHubView `renderOnboardingCallout()` helper + per-view callout content | +100 LOC |
| 3 | Onboarding Reset from Settings — "Reset onboarding" button in FlowtiSettingsTab | 7 criteria | ~8 tests (render, button trigger, state reset, event emission, feedback) | Update Onboarding PRD: FR-6 delivered | FlowtiSettingsTab new section + OnboardingService.resetAll() | +30 LOC |
| 4 | Onboarding Lifecycle Events — 4 events emitted on onboarding state transitions | 7 criteria | ~10 tests (4 event types × 2-3 scenarios: emit on transition, no-emit on reload, payload) | Update Onboarding PRD: FR-13 delivered. Register events in catalog. | OnboardingEventMap + OnboardingService emission hooks + catalog registration | +30 LOC |
| 5 | Hub Empty States — welcoming empty states for User Hub, DX Hub, Event Catalog | 7 criteria | ~13 tests (3 views × render/content/disappear scenarios) | Update Onboarding PRD: FR-20 partially delivered | Per-view `renderEmptyState()` using `ft-stat-card` pattern | +140 LOC |

All increments pass individual readiness check:
- [x] Scope statement defined — all 5 increments have clear goal + scope table with file lists
- [x] Acceptance criteria written — 36 testable criteria across 5 increments
- [x] Test intent stated — ~55 tests planned (12 + 12 + 8 + 10 + 13)
- [x] Documentation intent stated — all 5 increments update the Onboarding PRD with delivered FRs; Inc 4 adds event catalog entries
- [x] Architecture seams confirmed — file tables identify new files, modified files, and LOC deltas
- [x] Estimated size — LOC and test count estimates provided for all increments

## 5. Quality Baseline

- [x] Build pipeline green — `npm test` passes (5,201 tests, 219 suites, 0 failures, 32 skipped)
- [x] No critical bugs open — Cycle 46 `bugs: []` in post-cycle state; 2 bugs fixed during cycle (save query latency, deep merge), none remaining
- [x] Previous cycle closed — Cycle 46 stage `completed`, date_completed 2026-02-26, 5/5 increments delivered, 44 new tests, delivery summary written

## 6. Pre-Cycle Completion

- [x] Pre-cycle work documented — no pre-cycle fixes needed (`bugs_fixed_precycle: []` in Cycle 47 plan)
- [x] Inbox signals reviewed — backlog refinement analysed 13 onboarding-related items from 2 inboxes:
  - Vault inbox (`00 - Connectivity/inbox/`): 11 items reviewed — 2 delivered, 4 partially delivered, 1 partially superseded, 3 backlog, 1 observation
  - Plugin inbox (`Development/flowti/docs/inbox/`): 2 items reviewed — 1 delivered (RB-4 resolved), 1 partially delivered
  - All 5 in-scope PBIs trace back to refined inbox items and PRD Phase 2 FRs

---

## Observations

### OBS-1: OnboardingService Extraction is a Proven Pattern

The extraction of OnboardingService from AnalyticsService follows the same migration pattern used when Analytics was extracted from the Data Exchange Hub (Cycle 28). The pattern — read from old key, write to new key, clear old on confirmed save — has been validated in production. This reduces architectural risk for Inc 1 significantly.

### OBS-2: Onboarding PRD is the Most Thoroughly Refined New-Domain PRD

With 20 FRs across 3 phases, 17 PBIs (8 delivered, 4 planned, 5 discovery), 13 inbox items triaged, and a comprehensive data model including migration plan, the Onboarding PRD v2 is the most thoroughly prepared PRD for a domain that doesn't yet have its own service. The Phase 1 delivery (C45/C46) validates the domain model in practice before extraction.

### OBS-3: BaseHubView Extension is Low-Risk

Adding `renderOnboardingCallout()` to BaseHubView follows the established pattern of protected helpers (`addUnsubscribe`, `scheduleRender`, `navigateTo`). The base class currently has 278 LOC — adding ~40 LOC for a callout renderer keeps it well within maintainable bounds. Each subclass owns its callout content, avoiding centralised coupling.

### OBS-4: Phase 1 Provides Safety Net for Phase 2

The 9 existing onboarding tests (checklist init, persistence, merge, dismiss, reset) form a regression safety net for the migration in Inc 1. After migration, these tests should pass against the new OnboardingService with minimal changes, validating that behaviour is preserved.

### OBS-5: Inc 5 is Independently Parallelisable

Hub empty states (Inc 5) have no dependency on OnboardingService. They are pure UI changes using the established `ft-stat-card` pattern from the Analytics Hub (C45). This allows Inc 5 to start in parallel with Inc 2–4 if needed, providing schedule flexibility.

---

## Related

- [[Cycle 47 - Onboarding Phase 2]]
- [[Onboarding PRD]] (v2, FRI 24/35)
- [[Cycle 46 - Supplier Manager Onboarding II]] (previous cycle — completed)
- [[Cycle 45 - Supplier Manager Onboarding]] (Phase 1 foundation)
- [[Definition of Ready (Cycle)]] (checklist source)
- [[PBI-ONB-012 OnboardingService Extraction]]
- [[PBI-ONB-010 Contextual View Callouts]]
- [[PBI-ONB-011 Onboarding Reset from Settings]]
- [[PBI-ONB-013 Onboarding Lifecycle Events]]
- [[PBI-ONB-017 Hub Empty States]]
