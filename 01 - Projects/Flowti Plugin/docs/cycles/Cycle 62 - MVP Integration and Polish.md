---
type: DevelopmentCycle
feature: "[[Development/flowti/docs/features/MVP/MVP - Product Development Lifecycle|MVP - Product Development Lifecycle]]"
stage: planned
cycle: 62
release_anchor:
  - "Theme 16: MVP Integration — End-to-End Product Development Lifecycle"
mvp: "[[Development/flowti/docs/features/MVP/MVP - Product Development Lifecycle|MVP - Product Development Lifecycle]]"
pbis:
  - "PBI-MVP-001: Full Lifecycle E2E Journey"
  - "PBI-MVP-002: Cross-Hub Navigation"
  - "PBI-MVP-003: MVP Cockpit Dashboard"
  - "PBI-MVP-004: Deep Links"
  - "PBI-MVP-005: Empty States + Onboarding Callouts"
  - "PBI-MVP-006: TD-58 Performance Baselines"
  - "PBI-MVP-007: TD-93 ADR-032"
  - "PBI-MVP-008: TD-132 Shared UI Primitives"
  - "PBI-MVP-009: Component Docs Update"
  - "PBI-MVP-010: MVP User Testing Prep"
bugs: []
tech_debt:
  - TD-132
estimated_increments: 8
estimated_loc: 1000
estimated_tests: 80
pre_cycle_tests: 7596
pre_cycle_suites: 341
---

# Cycle 62 — MVP Integration + Polish

> **MVP Cycle 5 of 5** — Wire everything together into one coherent end-to-end experience.

## Release Anchor Theme

- **Theme 16: MVP Integration — End-to-End Product Development Lifecycle** — Connect all MVP domains into a seamless lifecycle experience, validate with the full E2E journey, and polish for user testing.

## Situation Assessment

### Pre-Cycle State

- **Tests**: ~7,596 passing (~341 suites) — projected after C61
- **Build**: `npm run build` green
- **Previous cycles**: C58 (Feature Lifecycle), C59 (Process + Sessions), C60 (Journeys + Quality), C61 (Reviews + Compilation)
- **Feature Lifecycle**: Full — scan, gates, FRI, session-bound, test-linked, review-scored
- **Process Management**: Phase 1 — canvas parser, validation, reference process, process→journey compilation
- **Test Management**: Feature quality view, traceability, result history, quality dashboard
- **Session v3**: Lifecycle-aware — bound to features, progress tracking
- **Quality**: Review automation, TASM scoring, quality gate automation, compliance per feature

### What's Connected (post-C61)

| Flow | Status |
|------|--------|
| Capture → Inbox → PRD | Exists (Quick Capture + Inbox) |
| PRD → Feature Pipeline | Delivered (C58) |
| Feature → FRI Score | Delivered (C58) |
| Feature → Gate Check | Delivered (C58) |
| Feature → Session | Delivered (C59) |
| Feature → Process Phase | Delivered (C59) |
| Feature → Test Journeys | Delivered (C60) |
| Feature → Test Results | Delivered (C60) |
| Feature → Review | Delivered (C61) |
| Feature → TASM Score | Delivered (C61) |
| Feature → Quality Dashboard | Delivered (C61) |
| Process → Journey | Delivered (C61) |

### What's Missing (C62 fills)

| Gap | Solution |
|-----|----------|
| No end-to-end path through all domains | Full lifecycle E2E journey |
| Hub-to-hub navigation is manual | Cross-hub deep links |
| No unified lifecycle view | MVP cockpit dashboard |
| New domains lack onboarding | Empty states + callouts |
| Documentation stale | Component docs refresh |

## Cycle Overview

Cycle 62 is the **integration and polish cycle**. All MVP domains are delivered (C58–C61); now they need to work together as one coherent experience.

The primary deliverable is the **full lifecycle E2E journey** — a 15-step journey that walks from idea capture to cycle closure, validating every MVP domain along the way. This is the proof that the MVP works.

Secondary work includes cross-hub navigation (click a feature to jump to its tests, reviews, or sessions), a unified MVP cockpit dashboard, and empty state/onboarding work for the new domains.

## User Pains

1. **No guided path** — All domains work independently but there's no guided flow connecting them.
2. **Hub hopping** — Navigating from Feature Pipeline to Test Management to Reviews requires manual command palette usage.
3. **No unified view** — No single dashboard showing "where is the product overall?"
4. **New features are discoverable** — Feature Lifecycle, Process, and Quality domains need onboarding callouts.
5. **Documentation is outdated** — Component docs, sitemap, and references don't reflect C58–C61 additions.

## Scope

### In Scope

**E2E Journey**:
- Full lifecycle E2E journey: 15 steps from idea capture to cycle closure
- Validates all MVP domains: Capture, Feature Pipeline, FRI, Gates, Sessions, Journey Builder, Executor, TM Hub, Reviews, TASM, Quality Dashboard
- Journey config JSON + test file + canvas

**Cross-Hub Navigation**:
- Feature Pipeline → Test Management Hub (feature's tests)
- Feature Pipeline → Reviews folder (feature's reviews)
- Test Management Hub → Feature Pipeline (journey's feature)
- Quality Dashboard → Feature detail
- User Hub → Feature Pipeline (via dashboard card)

**MVP Cockpit Dashboard**:
- Unified view in User Hub or standalone
- Feature stage distribution chart
- Quality health overview (features by health status)
- Active sessions summary
- Recent reviews and TASM scores
- Process compliance summary

**Polish**:
- Empty states for Feature Pipeline, Process, Quality Dashboard, Review History
- Onboarding callouts explaining each new domain
- Error handling edge cases

**Documentation**:
- Component docs for all C58–C61 components
- Updated sitemap
- Updated Frontend Architecture doc
- Updated Data Dictionary (new entity types)

**Tech Debt**:
- TD-132: Evaluate and extract shared UI primitives (ChipList, EventSuggest, StatusBadge)

### Out of Scope

- Publication readiness (deferred to post-MVP)
- Full process execution engine (Phase 2)
- Multi-user features
- AI-assisted features
- Performance optimization beyond baseline

## Increments

### Inc 0: Cross-Hub Navigation
**Theme**: UI / Integration
**Effort**: Medium | **Est. LOC**: ~150 | **Est. Tests**: ~10

Wire cross-hub navigation links:
- Feature detail → "View Tests" button → opens TM Hub filtered to feature
- Feature detail → "View Reviews" button → opens review folder
- TM Hub journey detail → "View Feature" link → navigates to Feature Pipeline
- Quality Dashboard row → click → navigate to feature detail
- Use existing `navigateTo` and command patterns

**Acceptance Criteria**:
- [ ] Feature → TM Hub navigation works
- [ ] Feature → Reviews navigation works
- [ ] TM Hub → Feature navigation works
- [ ] Dashboard → Feature navigation works
- [ ] `npm test` green

---

### Inc 1: MVP Cockpit Dashboard
**Theme**: UI
**Effort**: Large | **Est. LOC**: ~200 | **Est. Tests**: ~12

Build unified MVP cockpit:
- Add "Lifecycle" section to User Hub dashboard (or new tab)
- Feature stage distribution: count per stage as horizontal bar or cards
- Quality health: features by health status (green/yellow/red counts)
- Active sessions: currently running sessions with feature bindings
- Recent reviews: last 5 reviews with TASM scores
- Process compliance: overall compliance percentage
- "Open Feature Pipeline" quick action

**Acceptance Criteria**:
- [ ] Cockpit section renders on User Hub
- [ ] Stage distribution shown
- [ ] Quality health summary shown
- [ ] Active sessions listed
- [ ] Recent reviews displayed
- [ ] `npm test` green

---

### Inc 2: Full Lifecycle E2E Journey Config
**Theme**: Quality / E2E
**Effort**: Large | **Est. LOC**: ~200 | **Est. Tests**: ~15

Create the MVP proof journey — 15 steps from idea to cycle closure:
- Update existing `Product Development Lifecycle-config.json` with executable actions
- Add e2e test actions for each step (commands, assertions, waits, screenshots)
- Create companion test file
- Validate journey passes `validateJourneyJSON()`

Steps:
1. Capture idea (Quick Capture command)
2. Review inbox (User Hub → Inbox tab)
3. Create PRD (file creation + frontmatter)
4. Score FRI (Feature Pipeline → scoring)
5. Advance gates (stage transitions)
6. Plan cycle (file creation)
7. Start session (session creation with feature binding)
8. Implement feature (simulate file creation)
9. Create journey (Journey Builder → new journey)
10. Run tests (execute journey)
11. Review results (TM Hub → quality view)
12. Create review (Three Amigos scaffold)
13. Score TASM (scoring UI)
14. Advance to Done (final gate)
15. Close cycle (file update)

**Acceptance Criteria**:
- [ ] Journey config with 15 executable steps
- [ ] Companion test file created
- [ ] Journey passes validation
- [ ] `npm test` green

---

### Inc 3: Deep Links + Feature Navigation
**Theme**: UI
**Effort**: Small | **Est. LOC**: ~80 | **Est. Tests**: ~8

Add deep linking support:
- Click feature name anywhere → navigate to Feature Pipeline detail
- Click test journey name → navigate to TM Hub journey detail
- Click TASM score → navigate to review document
- Click session → navigate to session workspace
- Use consistent link styling (underline, hover effect)

**Acceptance Criteria**:
- [ ] Feature name links work across hubs
- [ ] Journey name links work
- [ ] TASM score links work
- [ ] Session links work
- [ ] `npm test` green

---

### Inc 4: Empty States + Onboarding Callouts
**Theme**: UX
**Effort**: Medium | **Est. LOC**: ~100 | **Est. Tests**: ~5

Add empty states and onboarding for new domains:
- Feature Pipeline: "No features found. PRDs in docs/features/ will appear here once scanned."
- Process compliance: "No process defined. Create a .process.canvas to track lifecycle phases."
- Quality Dashboard: "No quality data yet. Link test journeys to features to see quality metrics."
- Review History: "No reviews yet. Create a Three Amigos review from the Feature detail panel."
- Onboarding callout on first use of Feature Pipeline explaining the lifecycle

**Acceptance Criteria**:
- [ ] All new views have meaningful empty states
- [ ] Onboarding callout appears on first visit
- [ ] Callouts dismissible
- [ ] `npm test` green

---

### Inc 5: TD-132 — Shared UI Primitives
**Theme**: Architecture / Debt
**Effort**: Small | **Est. LOC**: ~80 | **Est. Tests**: ~5

Extract shared UI components used across multiple hubs:
- Identify repeated patterns: StatusBadge, ScoreBar, DimensionSlider, StageIndicator
- Extract to `src/ui/shared/` if used in 3+ locations
- Update consumers to use shared components
- Skip extraction for components used in only 1-2 places

**Acceptance Criteria**:
- [ ] Shared components identified and extracted where warranted
- [ ] Consumers updated
- [ ] No regressions
- [ ] `npm test` green

---

### Inc 6: Documentation Update
**Theme**: Documentation
**Effort**: Medium | **Est. LOC**: ~0 (docs) | **Est. Tests**: ~0

Refresh all documentation:
- Component docs for Feature Lifecycle, Process Management, Quality Management
- Updated sitemap with new views and tabs
- Updated Frontend Architecture with C58–C62 additions
- Updated Data Dictionary with new entity types (FeatureEntry, ProcessDefinition, ReviewRecord)
- Verify `npm run generate:reports` produces correct output

**Acceptance Criteria**:
- [ ] Component docs created for all new domains
- [ ] Sitemap updated
- [ ] Architecture doc current
- [ ] Data Dictionary updated
- [ ] Reports generate correctly

---

### Inc 7: MVP User Testing Prep + Final Quality Gate
**Theme**: Quality / Process
**Effort**: Medium | **Est. LOC**: ~120 | **Est. Tests**: ~15

Final MVP validation:
- Run the full lifecycle E2E journey
- Verify all cross-hub navigation paths
- Create a "Getting Started with the Lifecycle" guide note
- Final `npm run build` + `npm test`
- Update MVP document with actual metrics
- MVP retrospective preparation

**Acceptance Criteria**:
- [ ] E2E journey passes
- [ ] All navigation paths verified
- [ ] Getting started guide created
- [ ] `npm test` green
- [ ] `npm run build` green
- [ ] MVP document updated with actuals

## Dependency Graph

```
Inc 0 (Navigation)          ──→ Inc 3 (Deep links)
Inc 1 (Cockpit)             ──→ Inc 7 (Final validation)
Inc 2 (E2E Journey)         ──→ Inc 7 (Final validation)
Inc 3 (Deep links)          ──→ Inc 7 (Final validation)
Inc 4 (Empty states)        ──→ Independent (parallel)
Inc 5 (TD-132)              ──→ Independent (parallel)
Inc 6 (Docs)                ──→ Inc 7 (Final validation)
```

**Parallelizable**: Inc 0, Inc 4, Inc 5, Inc 6 can start immediately. Inc 1 and Inc 2 can run in parallel.

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| E2E journey is flaky due to multi-hub navigation | Medium | Use established settle delays; test in isolation first |
| Cross-hub navigation breaks on view state persistence | Low | View state persistence proven in C57; follow same pattern |
| Integration reveals missing pieces from C58–C61 | Medium | Each cycle delivered testable increments; issues should be minor |
| Documentation effort is larger than estimated | Low | Auto-generated docs reduce manual effort; focus on new domains only |
| MVP cockpit dashboard is too cluttered | Low | Start with 5 key sections; remove or collapse based on feedback |

## Success Metrics

| Metric | Target |
|--------|--------|
| New tests | ~80 |
| Post-cycle tests | ~7,676 |
| New suites | ~6 |
| Source LOC | ~1,000 |
| E2E journey steps | 15 (full lifecycle) |
| Cross-hub links | 8+ navigation paths |
| Empty states | 4+ new domains covered |
| TD resolved | 1 (TD-132) |
| Increments | ~8 |

## Definition of Done

- [ ] Full lifecycle E2E journey (15 steps, idea→done) passes
- [ ] Cross-hub navigation links work (Feature ↔ TM Hub ↔ Reviews ↔ Analytics)
- [ ] MVP cockpit dashboard on User Hub
- [ ] Deep links for features, journeys, reviews, sessions
- [ ] Empty states and onboarding callouts for all new domains
- [ ] TD-132 resolved (shared UI primitives)
- [ ] Component docs, sitemap, architecture, data dictionary updated
- [ ] Getting Started guide for the lifecycle
- [ ] MVP document updated with actual metrics
- [ ] `npm run build` green
- [ ] Three Amigos review completed

## MVP Closure Gate

When C62 is complete, the MVP is validated if:

| Criterion | Evidence |
|-----------|----------|
| Full lifecycle works end-to-end | E2E journey passes all 15 steps |
| All 6 domains connected | Cross-hub navigation verified |
| Quality is measurable | Quality dashboard populated with real data |
| Process is visible | Development Lifecycle canvas validates |
| Reviews are structured | TASM scores persisted, review history available |
| User can self-serve | Getting Started guide + onboarding callouts |
| Build is green | `npm run build` passes |
| Tests exceed baseline | 7,676+ tests (520+ new from MVP cycles) |
