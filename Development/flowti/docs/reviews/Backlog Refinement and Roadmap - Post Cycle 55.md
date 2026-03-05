---
type: BacklogRefinement
date: 2026-03-05
stage: done
description: "Post-Cycle 55 backlog refinement, product & architecture review, and 3-cycle roadmap (C56–C58)"
pre_review_tests: 6594
pre_review_suites: 276
open_tech_debt: 30
inbox_items_plugin: 80
release_blockers_open: 3
prd_count: 40
cycles_planned: 3
---

# Backlog Refinement & Roadmap — Post Cycle 55

## Session Summary

Strategic review conducted after Cycle 55 (Journey Builder Phase 1). This review analyzed **30 open/mitigated tech debt items**, **80 plugin inbox items**, **40 PRD features**, and the full project trajectory across 55 cycles to establish the next 3-cycle roadmap (C56–C58).

**Key Decision**: Each cycle addresses improvements across **all six dimensions** — Features, Architecture, Quality, Debt, Documentation, and Process — to avoid accumulating imbalances.

**Strategic Direction**: Consolidate Journey Builder with canvas round-trip, harden architecture for publication, and advance release readiness through E2E coverage and documentation completeness.

---

## Part 1: Backlog Refinement

### 1.1 Current State Snapshot

| Metric | Value | Change from C48 |
|--------|-------|-----------------|
| Tests | 6,594 passing (276 suites) | +1,279 tests, +54 suites |
| Source files | ~260 | +30 |
| Open Tech Debt | 30 items (3 high, 10 medium, 7 low, 10 resolved since C48) | -2 net |
| Inbox Items | 80 plugin | +16 |
| Release Blockers | 3 open (RB-1, RB-2, RB-7) | +3 |
| PRD Features | 40 (14 delivered/done, 3 in-progress, 2 approved, 7 draft, 7 idea, 1 deferred) | +5 |
| TASM Score | 34.7/35 (C55 average) | +0.7 |
| Domains | 22 (journey-builder added) | +1 |

### 1.2 Release Blockers

| ID | Item | Status | Domain | Roadmap Slot |
|----|------|--------|--------|-------------|
| **RB-1** | Installer JSON config externalization | Planned | installer | C57 |
| **RB-2** | Obsidian ESLint rules compliance | In Progress | developer-experience | C56 |
| **RB-7** | Pipeline multi-source merge | Planned | data-exchange | Deferred (v1.1) |

**Assessment**: RB-2 is actively in progress and should land in C56. RB-1 requires installer refactoring — schedule for C57. RB-7 is a feature extension, not a true publication blocker — defer to v1.1.

### 1.3 Inbox Triage

80 items triaged across 4 priority tiers:

| Priority | Count | Action |
|----------|-------|--------|
| P0 (Critical) | 2 | RB-1 installer config, RB-2 ESLint — schedule C56–C57 |
| P1 (High) | 33 | 8 promoted to PBI, 12 discovery, 13 deferred |
| P2 (Medium) | 21 | 4 promoted, 17 discovery |
| P3 (Low) | 24 | Parked — revisit post-v1.0 |

**Promoted to Active Backlog (C56–C58)**:
1. **JB Phase 2** — Canvas round-trip (PBI-JB-008), preview run (PBI-JB-011), dual input (PBI-JB-012)
2. **Test Management Hub + Flowti Journey Executor** — Journey-centric quality management Hub with 5 tabs + in-app journey execution engine (34 tools, vault targeting, living docs). 10 PBIs, ~2,350 LOC, ~285 tests. PRD v2.0 (idea → draft). Scheduled C57.
3. **Session auto-documentation** — Auto-link files created during sessions as artifacts
4. **View state persistence** — Save/restore active tab and selection across reloads (TD-45)
5. **Entity config in DX Hub** — Unified data dictionary (PBI-010)
6. **Execution duration tracking** — Import/export/pipeline timing (PBI-008)

**Deferred from Active to C58/v1.1**:
- **Inbox auto-routing rules** (PBI-006) — moved from C57 to C58/v1.1 to make room for Test Management Hub

**Deferred to v1.1**:
- Meeting notes / AI transcription (discovery needed)
- Supplier management, EDI integration (domain-specific features)
- Multi-repo attachment, git integration (infrastructure exploration)
- Process simulation, conversational vault queries (AI/experimental)

### 1.4 Tech Debt Triage

30 open/mitigated items across 4 severity levels:

**High Severity (3)** — Schedule in C56–C57:

| TD | Item | Action |
|----|------|--------|
| TD-30 | Untested domain logic | Low ROI remaining — mark mitigated with 6,594 tests |
| TD-85 | ~40% docs lack type frontmatter | Batch fix in C56 (documentation dimension) |
| TD-92 | No PR process | Define lightweight PR workflow + branch protection in C56 |

**Medium Severity (10)** — Prioritize by impact:

| TD | Item | Cycle |
|----|------|-------|
| TD-01 | UI files exceed size convention | C56 (TD-130 is a sub-item) |
| TD-06 | UI bypasses EventBridge (read-only) | Accept — document as architectural decision |
| TD-24 | AGENTS.md outdated | C56 (documentation dimension) |
| TD-45 | View state not persisted | C57 |
| TD-57 | Migration test strategy for Hubs | C58 |
| TD-58 | Performance baseline thresholds | C57 |
| TD-93 | Duplicate data (plugin ↔ vault) | Mitigated — ADR-032 in place |
| TD-130 | JourneyBuilderSidebar 1,026 LOC | C56 (architecture dimension) |

**Low Severity (7)** — Monitor, do not actively schedule:
- TD-12 (wildcard listeners), TD-44 (list virtualization), TD-60 (health widget gap), TD-120 (session/types.ts size), TD-131 (canvas layout duplication), TD-132 (shared UI primitives)

**Resolved since C48** (10 items): TD-102 through TD-117 — error handling, resource leaks, initialization, tooling. All confirmed resolved with tests.

---

## Part 2: Product & Architecture Review

### 2.1 Product Maturity Assessment

**40 features** across 8 stages:

| Stage | Count | Features |
|-------|-------|----------|
| Delivered | 3 | Azure DevOps, Train of Thoughts, Train Branch Merge |
| Done | 9 | Command Bus, Event Bridge, Event Files, Event System, File Events, File System, Settings, Data Exchange Hub, Hubs |
| In-Progress | 3 | Journey Builder (C55), Session Workspaces v2, Hubs (continued) |
| Approved | 2 | Feature Lifecycle, Prioritization Hub |
| Draft | 7 | UX Guided Tours, Component Library, Data Governance, Vault Health Dashboard, Self-Documenting Frontend, Developer Experience, **Test Management (↑ v2.0)** |
| Idea | 7 | Story Mapping, Prototype Builder, Requirements Engineering, The Designer, Tracking, Multiplayer, Automation |
| Deferred | 1 | Release Preparation |

**Key Observations**:
- **Infrastructure is mature**: All core infrastructure features (Event System, File System, Command Bus) are L4–L5 maturity. This is the stable foundation.
- **Journey Builder closed a critical gap**: Phase 1 (C55) delivered 9/9 PBIs with 399 new tests. Phase 2 (canvas round-trip) is the natural continuation.
- **Session Workspaces v2 is in progress**: 6-state lifecycle machine, handler extraction complete. Needs finalization.
- **Two approved features ready for development**: Feature Lifecycle (27/35 FRI) and Prioritization Hub (23/35 FRI). Both serve dogfooding needs.
- **Release Preparation deferred but critical**: Repo restructure, ESLint compliance, and CI/CD must happen before marketplace publication.

### 2.2 Architecture Health

**Strengths**:
1. **EventBus-first architecture** — 360+ events, typed EventMap, event catalog as self-documentation. Clean separation of concerns.
2. **Hub Shell Pattern (ADR-024)** — 5 Hub subclasses, shared chrome, consistent UX. Proven extensible in C52.
3. **Orchestrator + Component pattern** — Clean delegation from state management to rendering. Successfully applied in Journey Builder (13 UI files).
4. **DDD boundaries** — 22 domains with per-domain events.ts. Cross-domain communication via EventBus only.
5. **Test infrastructure** — 6,594 tests, shared mock factories, E2E harness (ObsidianCli), flow integration suites.
6. **Report pipeline** — 11 generated reports from source, covering tests, coverage, codebase, cycles, traceability, performance.

**Weaknesses**:
1. **Orchestrator size creep** — JourneyBuilderSidebar (1,026 LOC) exceeds 500–800 convention. Pattern: organic growth across increments without extraction checkpoints.
2. **Documentation gaps** — ~40% of docs lack type frontmatter (TD-85). AGENTS.md outdated (TD-24). Frontend Architecture.md references stale metrics.
3. **No PR/CI process** — All development happens on master with no branch protection or CI gating (TD-92). Acceptable for solo development but blocks publication.
4. **View state not persisted** — Hub views lose tab selection on reload (TD-45). Minor UX friction but noticeable during dogfooding.
5. **Canvas layout duplication** — canvasSync.ts and generate-e2e-report.mjs produce similar layouts independently (TD-131). Divergence risk as both evolve.

### 2.3 Architecture Trajectory

The architecture is in a **consolidation phase**. Core patterns are proven and stable. The main risks are:
- **Size creep** in orchestrators (pattern: each increment adds ~50 LOC to the orchestrator instead of extracting to sub-components)
- **Documentation staleness** (pattern: code evolves faster than docs; automated generation helps but doesn't cover architecture docs)
- **Publication readiness** (pattern: solo-dev workflow lacks the guardrails needed for external contribution and marketplace submission)

**Recommendation**: C56–C58 should prioritize **hardening** over **new domains**. New features should extend existing domains (Journey Builder Phase 2, Test Management Hub as a natural downstream of journeys, Session improvements) rather than opening unrelated fronts. The Test Management Hub is explicitly designed as a consumer of the Journey Builder pipeline — not a new standalone domain.

---

## Part 3: Three-Cycle Roadmap (C56–C58)

### Design Principles

Each cycle addresses all six dimensions:

| Dimension | Purpose | Minimum per Cycle |
|-----------|---------|-------------------|
| **Features** | User-visible functionality | 1 major feature or 2–3 PBIs |
| **Architecture** | Structural improvements | 1 TD resolved or 1 extraction |
| **Quality** | Test coverage and reliability | +50 tests minimum, 0 regressions |
| **Debt** | Tech debt reduction | 2–3 TD items addressed |
| **Documentation** | Docs accuracy and completeness | 1 batch update or 1 new reference doc |
| **Process** | Development workflow improvements | 1 workflow enhancement |

---

### Cycle 56 — Journey Builder Phase 2 + Architecture Hardening

**Theme**: Extend Journey Builder with canvas round-trip while hardening the orchestrator pattern and publication readiness.

**Duration**: ~10 increments

#### Features (40%)
| PBI | Description | Est. LOC |
|-----|-------------|----------|
| PBI-JB-008 | Canvas → JSON: Parse companion canvas back to journey definition | ~200 |
| PBI-JB-011 | Preview Run: Dry-run a journey step sequence with simulated output | ~150 |
| PBI-JB-012 | Dual Input: Support both JSON editing and canvas editing as entry points | ~120 |
| PBI-JB-013 | Step Background Image: Attach wireframes/mockups to steps, render on canvas group nodes | ~80 |

**Acceptance**: Bidirectional sync between sidebar and canvas. User can edit in either place. Preview run shows step sequence with simulated pass/fail. Steps can have background images (wireframes/mockups) visible on the canvas.

#### Architecture (20%)
| TD | Action |
|----|--------|
| TD-130 | Extract WelcomeScreen, SetupForm, CanvasSyncController from JourneyBuilderSidebar (target: <600 LOC) |
| TD-01 | Update orchestrator convention documentation with extraction checkpoint guidance |

**Outcome**: JourneyBuilderSidebar reduced to pure state + coordination. Extraction pattern documented for future cycles.

#### Quality (15%)
| Action | Target |
|--------|--------|
| Journey Builder Phase 2 tests | +90 tests (incl. background image) |
| E2E journey: Journey Builder canvas round-trip | 1 new E2E journey |
| Regression suite for canvas sync | 10 tests for bidirectional consistency |

**Target**: 6,700+ tests after C56.

#### Debt (10%)
| TD | Action |
|----|--------|
| TD-85 | Batch-add type frontmatter to remaining ~40% of docs |
| TD-24 | Update AGENTS.md with current stats (260 files, 50K LOC, 276 suites) |
| TD-30 | Reclassify as mitigated — remaining untested areas are bootstrap/wiring with low ROI |

#### Documentation (10%)
| Action |
|--------|
| Update Frontend Architecture.md with C55/C56 metrics and Journey Builder domain |
| Create component docs for any new C56 components |
| Update sitemap for canvas round-trip flow |

#### Process (5%)
| TD | Action |
|----|--------|
| TD-92 | Define PR workflow: branch naming, draft→review→merge, branch protection on master |
| RB-2 | Complete ESLint Obsidian rules compliance (in progress) |

---

### Cycle 57 — Test Management Hub + Session Finalization

**Theme**: Build the Test Management Hub as the 6th Hub view, finalizing the Journey Builder → Test Management pipeline. Finalize Session Workspaces v2 and continue release infrastructure.

**Duration**: ~10 increments

#### Features (45%)
| PBI | Description | Est. LOC |
|-----|-------------|----------|
| PBI-TM-001 | Test Management domain core — service, types, events, journey parser | ~200 |
| PBI-TM-002 | Hub shell + Dashboard — view registration, KPI cards, mini pyramid, recent runs | ~250 |
| PBI-TM-003 | Journeys tab — master/detail, filters, run history, step results, traceability | ~300 |
| PBI-TM-004 | Pyramid visualization — 3-layer display, drill-down, trend indicators | ~150 |
| PBI-TM-005 | Coverage matrix — PRD-journey linking, gap analysis, domain/actor/service coverage | ~200 |
| PBI-TM-006 | Compliance tagging — ISO definitions, tag management, gap analysis, report export | ~200 |
| PBI-TM-007 | Journey Builder integration — auto-register, "Open in Builder", "Run" from Builder, review request | ~100 |
| PBI-TM-008 | Journey Executor — in-app execution engine with 34-tool vocabulary, vault targeting, cancellation | ~400 |
| PBI-TM-009 | Execution UI — live progress panel, report generation, command registration | ~200 |
| PBI-TM-010 | E2E journey — declarative E2E validation of the Test Management Hub and executor | ~200 |
| Session v2 finalization | Complete remaining session workspace features (auto-documentation, template management) | ~200 |
| TD-45 → Feature | View state persistence: save/restore active tab across reloads | ~100 |

**Acceptance**: Test Management Hub shows all journeys with status, pyramid, coverage matrix, and compliance tags. Sessions auto-link artifacts. Hub views remember last tab.

#### Architecture (20%)
| Item | Action |
|------|--------|
| TestManagementService + JourneyExecutorService | New domain services + 13 events + `TestManagementHubProvider` + 34-tool in-app executor |
| RB-1 | Externalize installer folder config to versioned JSON schema |
| TD-131 | Extract shared canvas layout constants to `src/domain/canvas/journeyLayout.ts` |
| TD-120 | Extract session/types.ts Zod schemas → session/schemas.ts |

**Outcome**: Test Management Hub as 6th BaseHubView subclass with journey-centric quality management. Installer is config-driven. Canvas layout constants shared. Session types decomposed.

#### Quality (15%)
| Action | Target |
|--------|--------|
| Test Management domain + UI + executor tests | +285 tests |
| Session v2 integration tests | +30 tests |
| Installer config tests | +20 tests |
| E2E journey: Test Management Hub | 1 new E2E journey |
| E2E journey: Installation fresh vault | 1 updated E2E journey |

**Target**: 6,850+ tests after C57.

#### Debt (10%)
| TD | Action |
|----|--------|
| TD-45 | Resolved via feature implementation |
| TD-58 | Define performance baseline thresholds (wildcard >100/sec, folder scan >500 entities, CSV >10K rows) |
| TD-93 | Document ADR-032 acceptance in TD item, close as accepted |

#### Documentation (10%)
| Action |
|--------|
| Test Management PRD advanced to approved (draft → approved via Design Gate) |
| Test Management Hub component docs and sitemap |
| Update Session domain component docs |
| Document installer config schema (JSON spec + migration guide) |
| Update Data Dictionary with new entity fields |

#### Process (5%)
| Action |
|--------|
| ISO compliance characteristic definitions reviewed and finalized |
| Test pyramid data sourcing strategy documented |

---

### Cycle 58 — Publication Readiness + Feature Lifecycle + CI Pipeline

**Theme**: Prepare for marketplace publication with repository restructure, CI/CD pipeline, documentation polish, and the Feature Lifecycle meta-feature for ongoing product management.

**Duration**: ~10 increments

#### Features (35%)
| PBI | Description | Est. LOC |
|-----|-------------|----------|
| Feature Lifecycle | PRD lifecycle management: stage transitions, maturity scoring, feature dashboard | ~300 |
| PBI-008 | Execution duration tracking for import/export/pipeline | ~100 |
| PBI-010 | Entity config integration in DX Hub (unified data dictionary) | ~150 |
| PBI-006 | Inbox auto-routing: route typed files to correct vault folder | ~150 |

**Acceptance**: Feature Lifecycle provides a Hub view for managing PRDs with stage gates. Import/export operations report execution time. Entity configuration lives alongside data exchange for a unified workflow. Inbox files route automatically on type assignment.

#### Architecture (20%)
| Item | Action |
|------|--------|
| Release Preparation | Repository restructure: monorepo layout, README, CHANGELOG, LICENSE |
| TD-57 | Define Hub migration smoke test suite (render, CRUD, navigation per tab) — now covers 7 Hubs |
| TD-132 | Evaluate: if Feature Lifecycle, DX Hub, or Test Hub needs ChipList/EventSuggest, extract to src/ui/shared/ |

**Outcome**: Repository is marketplace-ready. Hub migration has a test strategy covering all 7 Hub views. Shared UI primitives extracted if a second consumer emerges.

#### Quality (15%)
| Action | Target |
|--------|--------|
| Feature Lifecycle tests | +60 tests |
| DX Hub integration tests | +30 tests |
| E2E journey: Feature lifecycle workflow | 1 new E2E journey |
| Publication smoke test suite | 10 tests (install, activate, first-run, settings) |

**Target**: 7,000+ tests after C58.

#### Debt (10%)
| TD | Action |
|----|--------|
| TD-06 | Close as accepted — document read-only EventBridge bypass as architectural decision in ADR |
| TD-57 | Resolved via smoke test implementation |
| TD-60 | Evaluate health widget integration with Feature Lifecycle dashboard |

#### Documentation (10%)
| Action |
|--------|
| Write marketplace README (screenshots, features, installation) |
| Generate CHANGELOG from cycle history |
| Update all reference docs (Command Reference, Event Catalog, Data Dictionary, Tool Reference) |
| Final Frontend Architecture.md refresh |

#### Process (5%)
| Action |
|--------|
| Implement GitHub Actions CI pipeline: `npm test` on PR, `npm run build` on merge to master |
| Add branch protection rules (require CI pass + 1 review) |
| Dry-run marketplace submission process |
| Define post-release support workflow (issue templates, triage labels, release cadence) |
| Archive resolved tech debt items (85+ resolved) to `docs/debt/archive/` |

---

## Roadmap Summary

```
C56: Journey Builder Phase 2 + Architecture Hardening
  Features ─── Canvas round-trip, Preview Run, Dual Input, Step Background Images
  Arch ─────── JB Sidebar extraction (TD-130), orchestrator convention
  Quality ──── +80 tests, 1 E2E journey, canvas regression suite
  Debt ─────── TD-85, TD-24, TD-30 → 3 items cleared
  Docs ─────── Frontend Architecture refresh, JB component docs
  Process ──── PR workflow (TD-92), ESLint compliance (RB-2)

C57: Test Management Hub + Flowti Journey Executor + Session Finalization
  Features ─── Test Management Hub (10 PBIs, 5 tabs + executor), Session auto-docs, View state
  Arch ─────── TestMgmtService + JourneyExecutorService + HubView, Installer config, Canvas layout
  Quality ──── +335 tests, 2 E2E journeys (Test Mgmt + Installer update)
  Debt ─────── TD-45, TD-58, TD-93 → 3 items cleared
  Docs ─────── Test Management PRD (draft→approved), component docs, Data Dictionary
  Process ──── ISO compliance definitions, Pyramid data sourcing

C58: Publication Readiness + Feature Lifecycle + CI Pipeline
  Features ─── Feature Lifecycle Hub, Execution timing, DX Hub entity config, Inbox routing
  Arch ─────── Repo restructure, Hub migration tests (7 Hubs), Shared UI extraction
  Quality ──── +100 tests, 2 E2E journeys, Publication smoke tests
  Debt ─────── TD-06, TD-57, TD-60 → 3 items cleared
  Docs ─────── Marketplace README, CHANGELOG, Reference docs, Architecture refresh
  Process ──── GitHub Actions CI, Branch protection, Marketplace dry-run, Support workflow
```

### Projected Metrics After C58

| Metric | Current (C55) | After C57 | After C58 |
|--------|---------------|-----------|-----------|
| Tests | 6,594 | ~6,850+ | ~7,000+ |
| Suites | 276 | ~295+ | ~310+ |
| Hub Views | 5 | 6 (+ Test Mgmt) | 7 (+ Feature Lifecycle) |
| Open Tech Debt | 30 | ~24 | ~18 |
| PRD Features Done | 14 | 16+ | 18+ |
| E2E Journeys | 7 | 9+ | 11+ |
| Release Blockers | 3 | 2 | 0 |
| CI/CD | None | None | GitHub Actions |
| Marketplace Ready | No | No | Yes (dry-run complete) |

---

## Appendix A: Inbox Items Deferred to v1.1+

| Item | Priority | Reason |
|------|----------|--------|
| Meeting notes / AI transcription | P1 | Requires external dependencies (Whisper), needs design spike |
| Supplier Management | P2 | Domain-specific; not core platform |
| EDI Integration | P2 | Requires EDIFACT/X12 parser; external library evaluation |
| Multi-repo attachment | P3 | Infrastructure exploration; blocked by git integration decisions |
| Conversational vault queries | P3 | AI/experimental; needs LLM integration design |
| Process simulation | P3 | AI/experimental; needs workflow engine |
| Prototype Builder | Idea | L0 maturity; needs full PRD |
| Multiplayer | Idea | L0 maturity; fundamental architecture implications |

## Appendix B: Tech Debt Register — Open Items

| TD | Severity | Domain | Status | Scheduled |
|----|----------|--------|--------|-----------|
| TD-01 | Medium | Architecture | Mitigated | C56 (convention update) |
| TD-06 | Medium | Architecture | Open | C58 (accept + document) |
| TD-12 | Low | Performance | Open | Monitor |
| TD-24 | Medium | Documentation | Open | C56 |
| TD-30 | High | Testing | Open | C56 (reclassify) |
| TD-44 | Low | Performance | Open | Monitor |
| TD-45 | Medium | UX | Open | C57 |
| TD-57 | Medium | Testing | Open | C58 |
| TD-58 | Medium | Observability | Open | C57 |
| TD-60 | Low | Feature-gap | Open | C58 |
| TD-85 | High | Documentation | Partially-resolved | C56 |
| TD-92 | High | Process | Open | C56 |
| TD-93 | Medium | Architecture | Mitigated | C57 (close) |
| TD-120 | Low | Architecture | Open | C57 |
| TD-130 | Medium | Architecture | Open | C56 |
| TD-131 | Low | Duplication | Open | C57 |
| TD-132 | Low | Architecture | Open | C58 (conditional) |

## Appendix C: PRD Feature Pipeline

```
                    Delivered (3)
                         ↑
                    Done (9)
                         ↑
                In-Progress (3) ← C55 closed JB Phase 1
                         ↑
                  Approved (2) ← Feature Lifecycle, Prioritization Hub
                         ↑
                    Draft (7) ← UX, Component Library, Data Governance, Test Management (↑ from idea)...
                         ↑
                    Idea (7) ← Story Mapping, Prototype Builder, Requirements Eng, Designer...
```

**C56–C58 pipeline movement**: Journey Builder → Done, Test Management → Draft → In-Progress → Done (C57), Feature Lifecycle → In-Progress → Done (C58), Session v2 → Done. Target: 18 features at Done/Delivered by end of C58.
