---
type: DevelopmentCycle
feature: "[[Development/flowti/docs/features/Feature Lifecycle/Feature Lifecycle PRD|Feature Lifecycle PRD]]"
stage: planned
cycle: 58
release_anchor:
  - "Theme 9: Publication Readiness"
  - "Theme 10: Feature Lifecycle Management"
  - "Theme 11: CI Pipeline"
pbis:
  - "Feature Lifecycle Hub"
  - "PBI-008: Execution Duration Tracking"
  - "PBI-010: Entity Config in DX Hub"
  - "PBI-006: Inbox Auto-Routing"
bugs: []
tech_debt:
  - TD-06
  - TD-57
  - TD-60
  - TD-132
estimated_increments: 10
estimated_loc: 1000
estimated_tests: 100
pre_cycle_tests: 7035
pre_cycle_suites: 296
---

# Cycle 58 — Publication Readiness + Feature Lifecycle + CI Pipeline

## Release Anchor Theme

- **Theme 9: Publication Readiness** — Repository restructure, marketplace README, CHANGELOG, CI/CD pipeline, and publication smoke tests.
- **Theme 10: Feature Lifecycle Management** — Feature Lifecycle Hub for managing PRD stage transitions, maturity scoring, and feature dashboards.
- **Theme 11: CI Pipeline** — GitHub Actions CI with branch protection rules.

## Situation Assessment

### Pre-Cycle State

- **Tests**: ~7,035 passing (~296 suites) — projected after C57
- **Build**: `npm run build` green
- **Open bugs**: None critical (projected)
- **Previous cycle**: C57 (Test Management Hub) — 6th Hub view, Journey Executor, dual-mode architecture, session finalization
- **Release Blockers**: 1 remaining (RB-7 deferred to v1.1)
- **Tech Debt**: ~24 open items (projected after C57 clears 5)
- **Hub Views**: 6 (Event Catalog, Data Exchange, User, Train, Analytics, Test Management)

### Foundation from C55–C57

| Component | Status | Relevance to C58 |
|-----------|--------|-------------------|
| Test Management Hub | Delivered (C57) | 7th Hub (Feature Lifecycle) follows same pattern |
| Dual-mode architecture | Proven (C57) | Reusable pattern for environment-adaptive features |
| HubDashboardProvider | 2 implementations (Analytics, Test Mgmt) | 3rd: Feature Lifecycle |
| PR workflow | Defined (C56) | CI pipeline automates the checks |
| Branch protection | Documented (C56) | CI pipeline enforces the rules |
| Report pipeline | 11 generated reports | CHANGELOG generation reuses report infrastructure |
| E2E harness | 9+ journeys | Publication smoke tests extend the harness |

### Carried Forward

| Item | Classification | Action |
|------|----------------|--------|
| Feature Lifecycle Hub | PRD approved (27/35 FRI) | Main feature this cycle |
| CI Pipeline | Deferred from C57 | GitHub Actions CI + branch protection |
| PBI-006: Inbox auto-routing | Deferred from C57 | Route typed files to correct vault folder |
| PBI-008: Execution duration tracking | Enhancement | Import/export/pipeline timing |
| PBI-010: Entity config in DX Hub | Enhancement | Unified data dictionary |
| RB-7: Pipeline multi-source merge | Deferred | v1.1 (not a publication blocker) |

## Cycle Overview

Cycle 58 is the **publication gate cycle**. By its end, the plugin should be ready for a marketplace dry-run submission. This means: a clean repository structure, automated CI, comprehensive documentation, and a Feature Lifecycle Hub for ongoing product management.

The Feature Lifecycle Hub is the 7th BaseHubView subclass — it provides PRD lifecycle management: stage transitions (idea → draft → approved → in-progress → done → delivered), maturity scoring (FRI), and a feature dashboard showing the full product pipeline.

The CI Pipeline (deferred from C57) establishes GitHub Actions running `npm test` on PRs and `npm run build` on merge to master, with branch protection rules requiring CI pass.

Publication readiness work includes repository restructure (monorepo layout, README, CHANGELOG, LICENSE), marketplace submission documentation, and smoke tests verifying install → activate → first-run → settings.

## User Pains

1. **No CI gating** — All development on master with no automated checks. Risk of broken builds reaching the vault.
2. **No feature lifecycle view** — 40 PRD features at various stages, but no visual pipeline or stage management.
3. **Repository not marketplace-ready** — No public README, no CHANGELOG, no LICENSE, no contributor guidelines.
4. **Inbox files require manual routing** — Typed files must be manually moved to the correct folder.
5. **No execution timing** — Import/export operations don't report duration, making performance invisible.

## Cycle Goals

1. **Feature Lifecycle Hub** — 7th BaseHubView subclass for PRD lifecycle management
2. **GitHub Actions CI** — `npm test` on PR, `npm run build` on merge to master
3. **Branch protection** — Require CI pass + review before merge
4. **Repository restructure** — Monorepo layout, README, CHANGELOG, LICENSE
5. **Publication smoke tests** — Install, activate, first-run, settings
6. **Inbox auto-routing** — Route typed files to correct vault folder (PBI-006)
7. **Execution timing** — Import/export/pipeline duration tracking (PBI-008)
8. **Entity config** — Unified data dictionary in DX Hub (PBI-010)

## Scope

### In Scope

**Feature Lifecycle**:
- Feature Lifecycle Hub (7th BaseHubView subclass)
- PRD stage transitions with validation
- FRI maturity scoring dashboard
- Feature pipeline visualization

**CI Pipeline**:
- GitHub Actions workflow: `npm test` on PR
- GitHub Actions workflow: `npm run build` on merge to master
- Branch protection rules (require CI pass + 1 review)

**Publication Readiness**:
- Repository restructure: monorepo layout
- Marketplace README (screenshots, features, installation)
- CHANGELOG generated from cycle history
- LICENSE file
- Publication smoke test suite (10 tests)
- Marketplace dry-run submission

**Features**:
- PBI-006: Inbox auto-routing (typed file → correct folder)
- PBI-008: Execution duration tracking (import/export/pipeline)
- PBI-010: Entity config integration in DX Hub

**Debt**:
- TD-06: Close as accepted (document read-only EventBridge bypass as ADR)
- TD-57: Hub migration smoke test suite (now covers 7 Hubs)
- TD-60: Health widget integration with Feature Lifecycle
- TD-132: Evaluate shared UI primitive extraction (ChipList, EventSuggest)

### Out of Scope

- Advanced Feature Lifecycle features (automated stage gates, approval workflows)
- CI/CD result ingestion into Test Management Hub (v1.1)
- Multi-repo attachment (v1.1)
- Marketplace publication (dry-run only this cycle)
- RB-7: Pipeline multi-source merge (v1.1)

## Increments

### Inc 0: Feature Lifecycle Domain
**Theme**: Feature / Architecture
**Effort**: Large | **Est. LOC**: ~200 | **Est. Tests**: ~25

Build the Feature Lifecycle domain:
- `FeatureLifecycleService` — scan PRD features, parse frontmatter, manage stage transitions
- Stage model: idea → draft → approved → in-progress → done → delivered (+ deferred)
- FRI score computation from frontmatter fields
- Feature pipeline aggregation (count by stage)
- Events: `feature.stage-changed`, `feature.scored`, `feature.pipeline-updated`
- Feature types and interfaces

**Acceptance Criteria**:
- [ ] Service scans PRD features from vault
- [ ] Stage transitions validate (no skip states)
- [ ] FRI scores computed from frontmatter
- [ ] Events defined and wired
- [ ] `npm test` green

### Inc 1: Feature Lifecycle Hub
**Theme**: Feature / UI
**Effort**: Large | **Est. LOC**: ~200 | **Est. Tests**: ~25

Build the 7th Hub view:
- `FeatureLifecycleHubView extends BaseHubView<FeatureLifecyclePage>`
- Tabs: Pipeline, Features, Scoring, Roadmap
- Pipeline tab: Kanban-style columns by stage with feature cards
- Features tab: master/detail with stage badges, FRI scores, related events
- Scoring tab: FRI score breakdown per feature with radar chart
- Roadmap tab: timeline view of planned stage transitions
- `FeatureLifecycleHubProvider implements HubDashboardProvider` for User Hub
- Register view type, ribbon icon, command palette

**Acceptance Criteria**:
- [ ] Hub opens from command palette and ribbon
- [ ] Pipeline shows features by stage
- [ ] FRI scores displayed per feature
- [ ] User Hub summary card works
- [ ] `npm test` green

### Inc 2: PBI-006 Inbox Auto-Routing + PBI-008 Execution Timing + PBI-010 Entity Config
**Theme**: Feature
**Effort**: Medium | **Est. LOC**: ~400 | **Est. Tests**: ~30

Three small features bundled:
- **Inbox auto-routing**: When a typed file is created in inbox, move it to the configured folder for that type (based on frontmatter `type` field). Configurable routing rules in settings.
- **Execution duration tracking**: Wrap import/export/pipeline operations with timing. Store in PerfAggregator. Show in Performance Report.
- **Entity config in DX Hub**: Integrate entity type registry into the Data Exchange Hub as a "Data Dictionary" tab, showing all 18+ entity types with their fields.

**Acceptance Criteria**:
- [ ] Inbox files auto-route on type assignment
- [ ] Import/export operations report duration
- [ ] DX Hub shows entity types
- [ ] `npm test` green

### Inc 3: GitHub Actions CI
**Theme**: Process / Infrastructure
**Effort**: Medium | **Est. LOC**: ~0 (config only) | **Est. Tests**: 0

Establish CI pipeline:
- `.github/workflows/ci.yml`: `npm test` on pull_request
- `.github/workflows/build.yml`: `npm run build` on push to master
- Branch protection rules: require CI pass + 1 review before merge
- Verify CI runs correctly on a test PR

**Acceptance Criteria**:
- [ ] `npm test` runs on PRs
- [ ] `npm run build` runs on merge to master
- [ ] Branch protection enforced
- [ ] Test PR validates the pipeline

### Inc 4: Repository Restructure
**Theme**: Publication / Documentation
**Effort**: Medium | **Est. LOC**: ~0 (docs/config) | **Est. Tests**: 0

Prepare repository for marketplace:
- Evaluate monorepo layout (plugin source vs vault content)
- Create marketplace README (features, screenshots, installation, configuration)
- Generate CHANGELOG from cycle history (C1–C58)
- Add LICENSE file (choose appropriate license)
- Add CONTRIBUTING.md with PR workflow and code conventions
- Update package.json metadata (description, keywords, repository)

**Acceptance Criteria**:
- [ ] README suitable for marketplace listing
- [ ] CHANGELOG covers all cycles
- [ ] LICENSE file present
- [ ] package.json metadata complete

### Inc 5: Hub Migration Smoke Tests (TD-57)
**Theme**: Quality / Debt
**Effort**: Medium | **Est. LOC**: ~150 | **Est. Tests**: ~10

Define Hub migration smoke test suite:
- For each of 7 Hub views: render, CRUD (where applicable), tab navigation, search
- Verify all Hubs open without errors
- Verify all HubDashboardProviders return valid summaries
- Test Hub views in sequence (no state leaks between views)

**Acceptance Criteria**:
- [ ] 7 Hub smoke tests pass
- [ ] No cross-Hub state leaks
- [ ] TD-57 resolved
- [ ] `npm test` green

### Inc 6: Publication Smoke Tests + E2E Journeys
**Theme**: Quality / E2E
**Effort**: Medium | **Est. LOC**: ~100 | **Est. Tests**: ~10

Publication verification:
- Smoke test suite: install plugin, activate, verify first-run onboarding, verify settings load, verify ribbon icons
- E2E journey: Feature Lifecycle workflow (open Hub, view pipeline, navigate to feature detail)
- E2E journey: Publication verification (install → activate → first-run → settings)

**Acceptance Criteria**:
- [ ] Publication smoke tests pass
- [ ] E2E Feature Lifecycle journey passes
- [ ] E2E Publication journey passes
- [ ] `npm test` green

### Inc 7: Shared UI Extraction (TD-132) + Debt Closure
**Theme**: Architecture / Debt
**Effort**: Small | **Est. LOC**: ~50 | **Est. Tests**: 0

Conditional extraction and debt closure:
- TD-132: If Feature Lifecycle Hub or DX Hub needs ChipList or EventSuggest → extract to `src/ui/shared/`
- TD-06: Document read-only EventBridge bypass as accepted architectural decision (ADR)
- TD-60: Evaluate health widget gap — integrate with Feature Lifecycle dashboard if applicable
- Archive 85+ resolved tech debt items to `docs/debt/archive/`

**Acceptance Criteria**:
- [ ] Shared UI extracted if warranted
- [ ] TD-06, TD-60 closed with rationale
- [ ] Resolved debt archived
- [ ] `npm test` green

### Inc 8: Documentation Polish
**Theme**: Documentation
**Effort**: Medium | **Est. LOC**: ~0 (docs only) | **Est. Tests**: 0

Final documentation pass:
- Update all reference docs (Command Reference, Event Catalog, Data Dictionary, Tool Reference)
- Final Frontend Architecture.md refresh with C58 state
- Update component docs for Feature Lifecycle Hub
- Verify all generated reports produce correct output
- Define post-release support workflow (issue templates, triage labels, release cadence)

**Acceptance Criteria**:
- [ ] All reference docs current
- [ ] Architecture doc reflects final state
- [ ] Support workflow documented
- [ ] `npm run generate:reports` clean

### Inc 9: Marketplace Dry-Run + Final Quality Gate
**Theme**: Process / Quality
**Effort**: Small | **Est. LOC**: ~0 | **Est. Tests**: 0

Marketplace submission rehearsal:
- Package plugin for distribution
- Verify `manifest.json`, `main.js`, `styles.css` are correct
- Test installation from built artifact on a fresh vault
- Review Obsidian plugin submission guidelines
- Document any remaining gaps for actual submission
- Final `npm run build` + `npm test` verification

**Acceptance Criteria**:
- [ ] Plugin installs from built artifact
- [ ] Fresh vault activation works
- [ ] Submission checklist documented
- [ ] All tests green
- [ ] `npm run build` green

## Dependency Graph

```
Inc 0 (FL Domain)          ──→ Inc 1 (FL Hub)
Inc 1 (FL Hub)             ──→ Inc 6 (E2E)
Inc 2 (Features bundle)    ──→ Independent
Inc 3 (CI)                 ──→ Independent (parallel)
Inc 4 (Repo restructure)   ──→ Inc 9 (Dry-run)
Inc 5 (Hub smoke tests)    ──→ After Inc 1 (needs all 7 Hubs)
Inc 6 (E2E)                ──→ After Inc 1 + Inc 5
Inc 7 (Debt)               ──→ After Inc 1 (evaluate extraction need)
Inc 8 (Docs)               ──→ After Inc 4 (needs README/CHANGELOG)
Inc 9 (Dry-run)            ──→ After Inc 3, Inc 4, Inc 8
```

**Parallelizable**: Inc 2 (Features), Inc 3 (CI), Inc 4 (Repo) can run in parallel. Inc 7 (Debt) and Inc 8 (Docs) can overlap.

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Marketplace submission requirements change | Medium | Check latest guidelines in Inc 9; keep packaging flexible |
| Feature Lifecycle adds yet another Hub (7th) — complexity fatigue | Medium | User Hub as single entry point; each Hub has clear icon and purpose |
| CI pipeline setup blocks on GitHub access/permissions | Low | Document pipeline config; can be wired post-cycle if access delayed |
| CHANGELOG generation from 58 cycles is large | Low | Group by theme/quarter; link to detailed cycle docs |
| Branch protection interferes with solo dev workflow | Low | Configure with escape hatch for solo dev; require for external contributions |
| Publication readiness reveals unexpected gaps | Medium | Dry-run in Inc 9 catches gaps early; document for follow-up |

## Success Metrics

| Metric | Target |
|--------|--------|
| New tests | ~100 |
| Post-cycle tests | ~7,100+ |
| New suites | ~8 |
| Source LOC | ~1,000 |
| Hub Views | 7 (+ Feature Lifecycle) |
| TD items addressed | 4 (TD-06, TD-57, TD-60, TD-132) |
| Release blockers | 0 open (RB-7 accepted as v1.1) |
| E2E Journeys | 11+ (9 existing + 2 new) |
| CI/CD | GitHub Actions running on PRs and merges |
| Marketplace Ready | Yes (dry-run complete) |
| Increments | ~10 |

## Definition of Done

- [ ] Feature Lifecycle Hub (7th BaseHubView) implemented with Pipeline + Features + Scoring + Roadmap tabs
- [ ] Feature Lifecycle HubDashboardProvider on User Hub
- [ ] GitHub Actions CI: `npm test` on PR, `npm run build` on merge
- [ ] Branch protection rules enforced
- [ ] Repository restructured: README, CHANGELOG, LICENSE, CONTRIBUTING
- [ ] Inbox auto-routing (PBI-006) working
- [ ] Execution duration tracking (PBI-008) in PerfAggregator
- [ ] Entity config in DX Hub (PBI-010)
- [ ] Hub migration smoke tests for all 7 Hubs (TD-57)
- [ ] Publication smoke tests pass (install → activate → first-run → settings)
- [ ] 2 E2E journeys pass (Feature Lifecycle + Publication)
- [ ] Marketplace dry-run completed with documented gaps
- [ ] Post-release support workflow defined
- [ ] All reference docs updated
- [ ] `npm run build` green
- [ ] Three Amigos review completed
