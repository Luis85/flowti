---
type: ProductRequirementsDocument
domain: Flowti/MVP
stage: in-progress
version: 1
priority: 1
target_cycles: [58, 59, 60, 61, 62]
pre_mvp_tests: 7156
pre_mvp_suites: 305
actors:
  - Product Designer
  - Product Manager
  - Developer
  - Quality Engineer
tags:
  - mvp
  - lifecycle
  - product-development
---

# MVP — Product Development Lifecycle

## 1. Vision

Flowti becomes a **self-contained product development environment** where a single user or small team can take an idea from inception to tested, reviewed, documented delivery — all inside an Obsidian vault.

The MVP proves this end-to-end story by connecting six domains into one coherent lifecycle: **Capture → Design → Plan → Develop → Test → Review → Done**.

## 2. Problem Statement

Today, Flowti has strong domain verticals (Analytics, Sessions, Journeys, Data Exchange, Test Management) but **no horizontal lifecycle connecting them**. A user who wants to develop a feature must:

- Manually track PRD stages across scattered markdown files
- Remember which gates apply and check them by hand
- Start sessions without binding them to the feature they're working on
- Author test journeys without traceability to the feature being tested
- Conduct reviews using templates with no automation or scoring persistence
- Generate reports that don't roll up to a feature-level quality view

The MVP closes these gaps by investing in five areas: **Feature Lifecycle, Process Management, Test Management Hub, Sessions, and Journey Builder/Test-Runner**.

## 3. Actors

| Actor | Role in Lifecycle | Primary Hubs |
|-------|-------------------|--------------|
| **Product Designer** | Captures ideas, writes PRDs, defines scope and requirements | Inbox, Event Catalog, Quick Capture |
| **Product Manager** | Prioritizes features, scores FRI, plans cycles, tracks progress | Feature Pipeline, User Hub, Analytics |
| **Developer** | Implements features, writes tests, creates journeys | Session Workspace, Journey Builder, Code |
| **Quality Engineer** | Reviews quality, runs tests, scores TASM, validates coverage | Test Management Hub, Journey Runner |

> In practice, these may be the same person wearing different hats. The MVP supports all four perspectives.

## 4. MVP Scope — Six Domains

### 4.1 Product Design (Capture → PRD)

**Exists today:**
- Quick Capture (11 item types)
- Inbox with auto-routing
- Canvas templates (5 types: Domain Design, Sprint Planning, Retrospective, Brainstorm, Flow Design)
- Event Catalog for domain modeling

**Gaps:**
- No guided PRD creation flow from captured idea
- No FRI scoring UI
- No feature-level visibility (where are my features?)

**MVP target:**
- Scan and display PRDs with stage, FRI score, and gate readiness
- Score FRI through the Feature Pipeline UI
- Promote inbox ideas to PRD drafts with scaffolding

---

### 4.2 Product Management (Prioritize → Plan → Track)

**Exists today:**
- Session Workspaces (focus environment)
- User Hub (central dashboard)
- Nudge system (reminders)
- Inbox management

**Gaps:**
- No feature pipeline view (features grouped by stage)
- No prioritization scoring
- No cycle planning tooling
- No feature-level progress tracking

**MVP target:**
- Feature Pipeline master/detail view
- Prioritization scoring (7 dimensions)
- Stage advancement with gate validation
- Feature progress indicators (PBI completion, test count, review status)

---

### 4.3 Process Management (Lifecycle → Phases → Gates)

**Exists today:**
- Knowledgebase documentation (Development Lifecycle, Increment Lifecycle, Definition of Done/Ready)
- Cycle planning documents (manual markdown)
- Report generation pipeline (11 reports)
- **[[Process Mapping PRD]]** (features/Process Management, in-progress) — BPMN-inspired visual process language for Canvas with 9 node types, canvas sync, lint rules, process→journey compilation
- **[[Process Execution Framework PRD]]** (features/Process Management, draft) — Full execution engine with state model, metrics, dashboards, action buttons, event-driven orchestration

**Gaps:**
- No domain service
- No process visualization
- No automated gate checks
- No phase tracking
- No process compliance visibility
- Process Mapping and Execution Framework are design-level only (no implementation)

**MVP target (scoped for lifecycle):**
- ProcessService scanning lifecycle documentation and process definitions
- Phase mapping (6 stages → 10 Development Lifecycle phases)
- Automated gate readiness checks (pure functions)
- Process compliance indicators per feature
- **Phase 1 of Process Mapping**: Canvas-based process modeling (node types, edges, validation) — scoped to the Development Lifecycle as first executable process
- **Phase 1 of Process Execution**: Process state tracking (created → running → completed), step transitions, event emission — scoped to lightweight execution, not the full BPMN engine

> Full Process Mapping visual language and Process Execution Framework (simulation, metrics dashboards, swimlanes, parallel execution) are stretch goals beyond the MVP. The MVP proves the concept with the Development Lifecycle as the reference process.

---

### 4.4 Test Management (Test → Coverage → Quality)

**Exists today:**
- Test Management Hub with 5 tabs (Dashboard, Journeys, Pyramid, Coverage, Compliance)
- Journey Builder (v1.2, 34 tools, canvas sync)
- Journey Executor (dry-run, step tracking)
- ISO compliance definitions (9001, 27001, 25010)

**Gaps:**
- No feature-centric quality view (quality of Feature X?)
- No test-to-PRD traceability (which journeys test which features?)
- No test result history per feature
- No lifecycle journey templates

**MVP target:**
- Feature quality tab linking journeys to PRDs
- Test result history per feature
- Lifecycle journey templates (backlog review, planning, dev, test, review)
- Enhanced journey reporting

---

### 4.5 Feature Development Lifecycle (idea → done)

**Exists today:**
- Approved PRD (FRI 27/35) — fully designed, zero implementation
- PRDs exist as files with frontmatter but stages are unmanaged
- 10+ legacy stage values in use across PRDs

**Gaps:**
- Everything — no FeatureLifecycleService, no UI, no gate checks, no scoring

**MVP target:**
- FeatureLifecycleService (scan, stage management, gate checks, FRI scoring)
- Feature Pipeline UI (master/detail)
- 6 standardized stages with gate validation
- Stage history tracking
- Session integration (bind sessions to features)
- Review integration (Three Amigos)

---

### 4.6 Quality Management (Reviews → Scores → Compliance)

**Exists today:**
- TASM concept and scoring template
- Three Amigos session template
- Test pyramid visualization
- Compliance scoring (9 ISO characteristics)

**Gaps:**
- No review automation
- No TASM scoring UI
- No quality dashboard across features
- No review-to-feature binding

**MVP target:**
- Three Amigos review session creation from Feature Pipeline
- TASM scoring UI with persistence
- Quality overview dashboard (feature × quality matrix)
- Review history per feature

---

## 5. Gap Analysis Summary

| Domain | Current | MVP Needed | Primary Investment |
|--------|---------|------------|-------------------|
| Product Design | Capture + Inbox + Canvas | PRD scanning, FRI UI | Feature Lifecycle |
| Product Management | Sessions + User Hub | Pipeline view, prioritization | Feature Lifecycle |
| Process Management | Docs only | Service + gates + visualization | Process Management PRD |
| Test Management | Hub + Builder + Executor | Feature-centric quality, templates | Test Management Hub |
| Feature Lifecycle | PRD approved, zero code | Full domain implementation | Feature Lifecycle |
| Quality Management | Templates only | Review automation, TASM UI | Quality + Reviews |

## 6. Five-Cycle Roadmap (C58–C62)

### C58: Feature Lifecycle Core

> The backbone. Everything else connects to this.

**Investment**: Feature Lifecycle PRD → implementation

**Deliverables:**
- `FeatureLifecycleService` — scan PRDs from `docs/features/*/`, parse frontmatter, manage stages
- Gate check pure functions — 6 gates (Problem, Design, Readiness, Build, Quality, Release)
- FRI scoring — 7-dimension scoring with readiness levels
- Prioritization scoring — 7-dimension business priority
- Feature Pipeline UI — new tab in Event Catalog (master: stage-grouped pipeline, detail: feature panel with gates, scores, PBIs)
- Stage transitions — "Advance to [next stage]" with gate validation
- Events — 8 new (feature.stage.changed, feature.gate.passed/failed, feature.scored, feature.session.started/ended, review.session.created/scored)
- Legacy stage normalization — map 10+ existing values to 6 standard stages
- Feature card on User Hub dashboard

**Estimated**: ~12 increments, ~2,000 LOC, ~120 new tests

**Why first**: Feature Lifecycle is the backbone that Process, Test, Quality, and Sessions all connect to. Without it, the other investments have nothing to bind to.

---

### C59: Process Management Phase 1 + Lifecycle Sessions

> Build the process backbone and make sessions lifecycle-aware.

**Investment**: Process Mapping PRD (Phase 1), Process Execution Framework PRD (Phase 1), Session v3

**Foundation**: Two existing PRD drafts in vault inbox:
- `PRD - Process Mapping` — Canvas-based visual process language (9 node types, lint rules, compilation)
- `PRD - Process Execution Framework` — Execution engine, state model, metrics, event-driven orchestration

**Deliverables:**
- Promote both Process PRDs from inbox → `docs/features/Process Management/`
- `ProcessService` — scan process definitions, map lifecycle phases, track compliance
- Process node types (Phase 1) — Start, Activity, Decision, End (4 of 9 types; defer Fork/Join/Loop/Subprocess/Milestone)
- Canvas process parser — read process nodes from Canvas, validate structure
- Process validation (Phase 1) — core lint rules: exactly 1 Start, ≥1 End, no orphans, no dead ends
- Development Lifecycle as reference process — the 10-phase lifecycle modeled as an executable process map
- Phase-to-stage mapping — connect 10 Development Lifecycle phases to 6 feature stages
- Session v3: lifecycle-aware — bind sessions to features and phases
  - "Start session on Feature X" → tracks file changes against that feature's scope
  - Session completion updates feature progress
- Process compliance indicators — which process steps are satisfied for each feature?

**Estimated**: ~12 increments, ~2,000 LOC, ~120 new tests

**Dependencies**: C58 (FeatureLifecycleService must exist)

---

### C60: Journey Builder Phase 3 + Test-Runner

> Enhance the testing toolchain and connect it to the feature lifecycle.

**Investment**: Journey Builder, Test-Runner, Test Management Hub

**Deliverables:**
- Journey Builder Phase 3 — lifecycle journey templates (backlog review, planning, development, testing, review)
- Journey Executor v2 — retry logic, conditional steps, better error reporting
- Feature-centric test view — new tab/section in Test Management Hub showing quality per feature
- Test-to-PRD traceability — journeys declare which feature they test (via `domain` or `feature` field)
- Test result history — per-feature timeline of journey runs with pass/fail trends
- Journey templates for process validation — "Does Feature X satisfy the Design Gate?"

**Estimated**: ~10 increments, ~1,800 LOC, ~100 new tests

**Dependencies**: C58 (feature scanning), C59 (process phases)

---

### C61: Quality + Review Automation

> Close the review loop with automation, scoring UI, and quality dashboards.

**Investment**: Test Management Hub, Quality Management

**Deliverables:**
- Three Amigos review automation — create review doc from template, pre-fill feature context
- TASM scoring UI — in Feature detail panel, score 7 dimensions, persist to frontmatter
- Quality dashboard — cross-feature quality matrix (feature × dimension: tests, coverage, review, compliance)
- Feature quality gate automation — system checks if feature is ready to advance (tests pass, coverage met, review done)
- Review history per feature — timeline of reviews with TASM score trend
- Compliance reporting enhanced — map ISO characteristics to features

**Estimated**: ~10 increments, ~1,500 LOC, ~100 new tests

**Dependencies**: C58 (features), C59 (process), C60 (test traceability)

---

### C62: MVP Integration + Polish

> Wire everything together into one coherent end-to-end experience.

**Investment**: Cross-cutting integration, E2E validation

**Deliverables:**
- Full lifecycle E2E journey — from Quick Capture to Done (the MVP proof journey)
- Cross-hub navigation — Feature Pipeline → Test Management → Review → Analytics
- MVP cockpit dashboard — unified view showing lifecycle progress across all features
- Deep links — click a feature to see its tests, reviews, sessions, PBIs
- Polish and edge cases — empty states, error handling, onboarding callouts
- MVP user testing preparation — guided walkthrough journey
- Updated documentation and component docs

**Estimated**: ~8 increments, ~1,000 LOC, ~80 new tests

**Dependencies**: C58–C61

---

## 7. Roadmap Summary

| Cycle | Theme | Key Deliverable | New Tests | Cumulative |
|-------|-------|----------------|-----------|------------|
| C58 | Feature Lifecycle Core | FeatureLifecycleService + Pipeline UI | ~120 | ~7,276 |
| C59 | Process Mgmt P1 + Sessions | ProcessService + Canvas Parser + Lifecycle Sessions | ~120 | ~7,396 |
| C60 | Testing + Journeys | Journey Builder P3 + Feature Quality | ~100 | ~7,496 |
| C61 | Quality + Reviews | Review Automation + TASM UI | ~100 | ~7,596 |
| C62 | Integration + Polish | E2E Journey + MVP Cockpit | ~80 | ~7,676 |

**Total new investment**: ~52 increments, ~8,300 LOC, ~520 new tests

## 8. Success Criteria

The MVP is validated when a user can:

1. Capture an idea via Quick Capture
2. Promote it to a PRD draft with scaffolded structure
3. Score the PRD using FRI (7 dimensions)
4. See the feature in the Feature Pipeline at the correct stage
5. Verify gate readiness and advance through stages
6. Start a lifecycle-aware session bound to the feature
7. Create a test journey for the feature using Journey Builder
8. Execute the journey and see results in Test Management Hub
9. See test results linked to the feature in the quality view
10. Create a Three Amigos review session with pre-filled context
11. Score TASM and see it persisted on the feature
12. Advance the feature to "done" after all gates pass
13. View a quality dashboard showing status across all features

## 9. What the MVP is NOT

- **Not a release pipeline** — Release Preparation (CI/CD, marketplace submission) is explicitly deferred
- **Not multi-user** — designed for a single user or small team in a shared vault
- **Not a Kanban board** — the Feature Pipeline is read/advance, not drag-and-drop
- **Not a project management tool** — Flowti manages product development lifecycle, not generic project tasks
- **Not an AI agent** — the lifecycle is human-driven with system-assisted gate checks

## 10. Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Feature Lifecycle scope creep (too many gates, too complex) | Medium | High | Start with 3 simple gates (Problem, Build, Quality); add others incrementally |
| Process Management PRD takes too long to formalize | Low | Medium | Keep it thin — scan existing docs, don't build new process modeling |
| Session v3 lifecycle binding is too coupling | Medium | Medium | Use event-based binding, not hard references |
| Journey Builder Phase 3 is blocked by Phase 2 gaps | Low | Low | Phase 2 is solid (C56); Phase 3 is additive |
| MVP integration cycle (C62) discovers missing pieces | Medium | Medium | Each cycle delivers testable increments; integration issues surface early |
| 5 cycles is not enough | Medium | High | Roadmap is designed to be adaptive; C62 scope can flex |

## 11. Adaptability

The roadmap is designed for adaptation:

- **Each cycle delivers independently usable value** — Feature Lifecycle is useful even without Process Management
- **Cycles can be reordered** — C60 and C61 are somewhat independent; quality work can start alongside journey work
- **Scope within cycles can flex** — each cycle has a core deliverable and optional extensions
- **The journey file serves as living documentation** — update it as the product evolves
- **Inbox items feed forward** — 71 inbox items are candidates for future cycle inputs

## 12. Related

- [[Feature Lifecycle PRD]] — approved, ready for C58 implementation
- [[Process Mapping PRD]] — in-progress, visual process language for Canvas (features/Process Management)
- [[Process Execution Framework PRD]] — draft, execution engine with metrics (features/Process Management)
- [[Development Lifecycle]] — 10-phase process that Feature Lifecycle implements
- [[Increment Lifecycle]] — inner loop for each cycle's increments
- [[Definition of Done (Cycle)]] — quality checklist applied at each cycle boundary
- [[Testplan and Teststrategy]] — test coverage expectations
- [[Product Development Lifecycle-config.json]] — MVP journey definition
