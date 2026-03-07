---
type: DevelopmentCycle
feature: "[[Development/flowti/docs/features/MVP/MVP - Product Development Lifecycle|MVP - Product Development Lifecycle]]"
stage: planned
cycle: 61
release_anchor:
  - "Theme 14: Quality Management — Review Automation + TASM Scoring"
  - "Theme 15: Process→Journey Compilation Phase 1"
mvp: "[[Development/flowti/docs/features/MVP/MVP - Product Development Lifecycle|MVP - Product Development Lifecycle]]"
pbis:
  - "PBI-QA-001: Three Amigos Review Scaffolding"
  - "PBI-QA-002: Review Context Pre-fill"
  - "PBI-QA-003: TASM Scoring UI"
  - "PBI-QA-004: TASM Persistence"
  - "PBI-QA-005: Quality Dashboard"
  - "PBI-QA-006: Quality Gate Automation"
  - "PBI-QA-007: Review History"
  - "PBI-QA-008: Compliance per Feature"
  - "PBI-QA-009: Process→Journey Compilation Phase 1"
bugs: []
tech_debt: []
estimated_increments: 10
estimated_loc: 1500
estimated_tests: 100
pre_cycle_tests: 7697
pre_cycle_suites: 331
---

# Cycle 61 — Quality + Review Automation

> **MVP Cycle 4 of 5** — Close the review loop with automation, scoring, and quality dashboards.

## Release Anchor Theme

- **Theme 14: Quality Management — Review Automation + TASM Scoring** — Automate Three Amigos review creation, build TASM scoring UI, and create a cross-feature quality dashboard.
- **Theme 15: Process→Journey Compilation Phase 1** — Compile process definitions into executable journeys (happy path only).

## Situation Assessment

### Pre-Cycle State

- **Tests**: 7,697 passing (331 suites) — actual post-C60 + pre-cycle work
- **Build**: `npm run build` green
- **Previous cycles**: C59 (Process + Sessions), C60 (Process Wiring + Quality Traceability) — TASM 19/20
- **Events**: 443 total (29 EventMaps composed into FlowtiEventMap)
- **Commands**: 40 total
- **Hub Views**: 6 hubs — Event Catalog (6 tabs), Test Management (8 tabs), User Hub (5 tabs), Data Exchange, Analytics, Train
- **Feature Lifecycle**: Full — scan, gates, FRI, session-bound, test-linked
- **Process Management**: Phase 1 wired — ProcessService, canvas parser, validation (10 rules), Processes tab in Test Management Hub
- **Test Management**: Feature-centric quality view, test traceability, result history, Feature Quality tab
- **Journey Builder**: Phase 3 — lifecycle templates, executor v2 with retry/conditionals, ExecutionProgressModal
- **Journey Executor**: Complete — 34-tool dispatch, retry logic, conditional steps, report generator, main.ts wiring

### Foundation from C60 + Pre-Cycle

| Component | Status | Relevance to C61 |
|-----------|--------|-------------------|
| Feature Lifecycle | Full (C58) | Review sessions bind to features |
| Gate checks | 6 gates (C58) | Quality Gate checks TASM score |
| Test traceability | Delivered (C60) | Quality dashboard uses test data |
| Test result history | Delivered (C60) | Dashboard shows trends |
| Feature Quality tab | Delivered (C60) | Base for quality dashboard |
| Process definitions | Phase 1 wired (C59+C60) | Process→Journey compilation input |
| Processes tab | Moved to Test Management (pre-cycle) | Unified quality hub |
| Products tab | Moved to Test Management (pre-cycle) | Unified quality hub |
| Health tab | Moved to User Hub (pre-cycle) | Operational concern in personal cockpit |
| Hub tab reorganization | Complete (pre-cycle) | Event Catalog is pure architecture (6 tabs) |
| Journey Executor | Complete (C60) | Executor v2 with retry, conditionals, 34 tools |
| ExecutionProgressModal | Complete (C60) | 3-phase modal for in-app execution |
| Three Amigos template | Exists (knowledgebase) | Auto-scaffold from template |

### Pre-Cycle Work Completed

1. **Hub Tab Reorganization** — Moved Features, Processes, Products tabs from Event Catalog to Test Management Hub (8 tabs). Moved Health tab to User Hub (5 tabs). Event Catalog reduced to 6 pure architecture tabs (domains, services, events, flows, systems, actors). Cross-hub navigation via `hubRegistry.openHub()`. Tab components unchanged — each host synthesizes its own `CatalogComponentDeps`.
2. **Journey Executor Domain** — Built in C60 but not yet tested end-to-end. 6 source files (types, events, conditionEvaluator, JourneyExecutorService, toolExecutors, executionReportGenerator) + ExecutionProgressModal + 6 test files. Wired into main.ts with ToolHost bridge.

## Cycle Overview

Cycle 61 closes the **quality and review loop**. Currently, Three Amigos reviews are conducted manually using markdown templates. TASM scores are computed on paper and recorded by hand.

This cycle automates the review workflow: create review documents with pre-filled context (PRD summary, test results, coverage status), provide a TASM scoring UI that persists scores to frontmatter, and build a quality dashboard showing cross-feature quality health.

The stretch goal is Phase 1 of Process→Journey compilation: compile a process definition's happy path into an executable journey.

## Cycle Goals

1. **Automate Three Amigos Reviews** — scaffold review documents from template with pre-filled feature context (PRD summary, test results, coverage, compliance)
2. **Build TASM Scoring UI** — 4-dimension scoring panel (0–5 each) with persistence to review doc frontmatter and review history timeline
3. **Cross-Feature Quality Dashboard** — feature × quality matrix (tests, pass rate, TASM, coverage, compliance) with health indicators
4. **Quality Gate Automation** — system-checked gate (TASM ≥ 19, tests passing, docs updated) with button pre-check before advancing features

**Stretch**: Process→Journey Compilation Phase 1 — compile linear happy path to executable journey JSON.

## User Pains

1. **Reviews are manual** — Creating a Three Amigos review document requires copy-pasting context from multiple sources.
2. **TASM scores are ephemeral** — Scores are discussed but not persistently tracked or trended.
3. **No quality overview** — No single view showing quality health across all features.
4. **Quality Gate is toothless** — The gate checks for "TASM ≥ 19" but there's no UI to record the score.
5. **Process maps can't run** — Process definitions are visual but can't produce executable artifacts.

## Scope

### In Scope

**Review Automation**:
- Three Amigos review document scaffolding from template
- Pre-fill with feature context (PRD summary, test count, coverage, compliance)
- TASM scoring UI (4 dimensions: Testability, Architecture, Simplicity, Maintainability)
- Score persistence to review document frontmatter
- Review history per feature (timeline with TASM trend)

**Quality Dashboard**:
- Cross-feature quality matrix (feature × quality dimensions)
- Dimensions: test count, pass rate, TASM score, coverage, compliance
- Feature health indicators (green/yellow/red)
- Quality trends (improving/stable/declining)

**Quality Gate Automation**:
- Quality Gate (review→done) checks: TASM ≥ 19, all tests passing, docs updated
- System-assisted advancement: button pre-checks gates

**Process→Journey Compilation** (Phase 1):
- Compile process definition happy path → journey config JSON
- Start→Activity→Activity→...→End linear path only
- Decision nodes → include default/first branch only
- Output: valid journey config file

**Compliance Reporting**:
- ISO characteristic mapping per feature
- Compliance summary in quality dashboard

### Out of Scope

- Full process execution engine (Phase 2)
- Multi-path compilation (branching journeys from decisions)
- TASM trend charts (line charts)
- Quality score aggregation across product
- Automated review assignment (multi-user)

## Increments

### Inc 0: Three Amigos Review Scaffolding
**Theme**: Domain / Feature
**Effort**: Medium | **Est. LOC**: ~150 | **Est. Tests**: ~12

Auto-create review documents:
- `createReviewDoc(featureId)` — scaffold from Three Amigos Session Template
- Place in feature's backlog folder: `docs/features/{name}/reviews/`
- Frontmatter: type: ThreeAmigosReview, featureId, date, tasm_testability, tasm_architecture, tasm_simplicity, tasm_maintainability
- Sections: Product Perspective, Engineering Perspective, QA Perspective, TASM Score, Observations
- Emit `review.session.created`

**Acceptance Criteria**:
- [ ] Review doc created from template
- [ ] Placed in correct folder
- [ ] Frontmatter includes TASM fields
- [ ] Event emitted
- [ ] `npm test` green

---

### Inc 1: Review Context Pre-fill
**Theme**: Domain
**Effort**: Medium | **Est. LOC**: ~120 | **Est. Tests**: ~10

Pre-fill review document with feature context:
- PRD summary: name, stage, FRI score, readiness level
- Test summary: total tests, pass rate, last run
- Coverage: PRD requirements vs tested requirements
- Compliance: ISO characteristics mapped
- PBI status: delivered vs pending
- Process compliance: phase position, step completion

**Acceptance Criteria**:
- [ ] Context pre-filled in review doc
- [ ] All data sections populated
- [ ] Data reflects current feature state
- [ ] `npm test` green

---

### Inc 2: TASM Scoring UI
**Theme**: UI
**Effort**: Medium | **Est. LOC**: ~150 | **Est. Tests**: ~10

Build TASM scoring panel in Feature detail:
- 4 dimension sliders/inputs: Testability, Architecture, Simplicity, Maintainability (each 0-5)
- Total display: sum/20
- Save button → updates review doc frontmatter
- Emit `review.session.scored`
- Display last TASM score on feature card in pipeline

**Acceptance Criteria**:
- [ ] Scoring UI renders in feature detail
- [ ] Dimensions input 0-5
- [ ] Total computed and displayed
- [ ] Save persists to frontmatter
- [ ] `npm test` green

---

### Inc 3: TASM Persistence + Review History
**Theme**: Domain / Storage
**Effort**: Medium | **Est. LOC**: ~120 | **Est. Tests**: ~10

Persist TASM scores and build review history:
- Store TASM scores in review doc frontmatter
- `getReviewHistory(featureId)` — scan review docs in feature's reviews folder
- Return timeline: `{ date, tasm, observations_count }`
- Display in feature detail panel as review timeline
- Most recent TASM score shown on feature card

**Acceptance Criteria**:
- [ ] TASM scores persisted to frontmatter
- [ ] Review history scanned from folder
- [ ] Timeline displayed in feature detail
- [ ] Most recent score on feature card
- [ ] `npm test` green

---

### Inc 4: Quality Dashboard
**Theme**: UI
**Effort**: Large | **Est. LOC**: ~200 | **Est. Tests**: ~12

Build cross-feature quality dashboard:
- New section in Test Management Hub (or tab)
- Feature × Quality matrix table:
  - Columns: Feature, Stage, Tests, Pass Rate, TASM, Coverage, Compliance, Health
  - Health: computed from weighted dimensions (green/yellow/red)
- Sort by any column
- Filter by stage, health status
- Summary row: totals and averages

**Acceptance Criteria**:
- [ ] Quality dashboard renders in TM Hub
- [ ] Matrix table with all dimensions
- [ ] Health indicator computed
- [ ] Sort and filter work
- [ ] `npm test` green

---

### Inc 5: Quality Gate Automation
**Theme**: Domain / Integration
**Effort**: Small | **Est. LOC**: ~80 | **Est. Tests**: ~8

Enhance Quality Gate with automation:
- Quality Gate (review→done) now checks:
  - TASM score ≥ 19 (from review doc frontmatter)
  - All tests passing (from test result history)
  - Documentation updated (check for component docs)
- "Advance to Done" button shows gate status before confirming
- Emit `feature.gate.passed` or `feature.gate.failed` with details

**Acceptance Criteria**:
- [ ] Quality Gate checks TASM from review doc
- [ ] Test pass rate checked from history
- [ ] Advance button shows gate status
- [ ] `npm test` green

---

### Inc 6: Compliance per Feature
**Theme**: Domain / UI
**Effort**: Small | **Est. LOC**: ~100 | **Est. Tests**: ~8

Map ISO characteristics to features:
- Feature-level compliance: which ISO characteristics apply?
- Mapping: feature domain → relevant ISO standards
- Display in feature detail panel: compliance checklist
- Aggregate in quality dashboard compliance column

**Acceptance Criteria**:
- [ ] ISO characteristics mapped to features
- [ ] Compliance checklist in feature detail
- [ ] Compliance column in quality dashboard
- [ ] `npm test` green

---

### Inc 7: Process→Journey Compilation Phase 1
**Theme**: Domain
**Effort**: Medium | **Est. LOC**: ~150 | **Est. Tests**: ~12

Compile process happy path to journey:
- `compileProcess(definition)` → JourneyConfig JSON
- Traverse Start→...→End taking first/default branch at decisions
- Map Activity nodes to journey steps with actions
- Map Start node trigger to journey setup
- Map End node to journey teardown
- Output: valid journey config that passes `validateJourneyJSON()`

**Acceptance Criteria**:
- [ ] Linear happy path compiled to journey
- [ ] Activity nodes map to steps
- [ ] Decision default branch followed
- [ ] Output passes validation
- [ ] `npm test` green

---

### Inc 8: Integration Testing + Polish
**Theme**: Quality
**Effort**: Medium | **Est. LOC**: ~80 | **Est. Tests**: ~10

End-of-cycle quality:
- Flow test: create review → score TASM → check quality gate → advance feature
- Flow test: compile process → validate output → compare with manual journey
- Verify quality dashboard with real feature data
- Empty states (no reviews, no TASM scores, no compliance data)
- Error handling

**Acceptance Criteria**:
- [ ] Flow tests cover review and compilation workflows
- [ ] Empty states handled
- [ ] `npm test` green
- [ ] `npm run build` green

## Dependency Graph

```
Inc 0 (Review scaffold)     ──→ Inc 1 (Pre-fill)
Inc 1 (Pre-fill)            ──→ Inc 2 (TASM UI)
Inc 2 (TASM UI)             ──→ Inc 3 (Persistence + history)
Inc 3 (History)             ──→ Inc 4 (Dashboard) + Inc 5 (Gate automation)
Inc 4 (Dashboard)           ──→ Inc 6 (Compliance per feature)
Inc 5 (Gate automation)     ──→ Inc 8 (Integration)
Inc 7 (Compilation)         ──→ Independent (parallel with review work)
Inc 6 + Inc 7               ──→ Inc 8 (Integration)
```

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Review doc format doesn't match existing templates | Low | Follow existing Three Amigos Session Template structure |
| TASM frontmatter schema conflicts with existing review docs | Low | Use dedicated `tasm_*` prefixed fields |
| Quality dashboard is too slow with many features | Low | Feature count is ~41; no performance concern at this scale |
| Process compilation produces invalid journeys | Medium | Validate output with `validateJourneyJSON()`; test with reference process |

## Success Metrics

| Metric | Target |
|--------|--------|
| New tests | ~100 |
| Post-cycle tests | ~7,797 |
| New suites | ~8 |
| Source LOC | ~1,500 |
| Review automation | Create + pre-fill + TASM scoring |
| Quality dashboard | Cross-feature matrix |
| Process compilation | Happy path → journey |
| Increments | ~9 |

## Definition of Done

- [ ] Three Amigos review docs auto-scaffolded with pre-filled context
- [ ] TASM scoring UI (4 dimensions) with persistence to frontmatter
- [ ] Review history per feature with timeline
- [ ] Quality dashboard showing feature × quality matrix
- [ ] Quality Gate automation (TASM ≥ 19, tests passing, docs updated)
- [ ] ISO compliance mapped per feature
- [ ] Process→Journey compilation Phase 1 (happy path)
- [ ] Flow integration tests for review and compilation workflows
- [ ] `npm run build` green
- [ ] Three Amigos review completed

## Definition of Ready — Verification

### 1. Feature PRD Readiness

- [x] **PRD exists and is approved** — MVP - Product Development Lifecycle PRD exists, stage updated to `in-progress` (continuation cycle 4 of 5)
- [x] **PRD stage is `in-progress`** — actively building against it since C58
- [x] **FRI scored** — FRI 27/35 (referenced in PRD)
- [x] **FRI meets threshold** — 27/35 ≥ 11/35 (continuation cycle threshold)
- [x] **Technical Review passed** — implicitly passed through 3 completed cycles (C58–C60) all closing with TASM ≥ 19/20

### 2. Backlog Readiness

- [x] **PBIs defined** — 9 PBIs (PBI-QA-001 through PBI-QA-009) with problem statements and acceptance criteria
- [x] **PBIs chunked into increments** — 9 increments (Inc 0–8), each a vertical slice
- [x] **Dependencies mapped** — dependency graph documented (Inc 0→1→2→3→4/5→6/7→8)
- [x] **Priority ranked** — review automation first (Inc 0–3), dashboard (Inc 4), gate (Inc 5), compliance (Inc 6), compilation (Inc 7), integration (Inc 8)

### 3. Cycle Plan Document

- [x] **Cycle document exists** — `Cycle 61 - Quality and Review Automation.md` with full frontmatter
- [x] **Situation assessment written** — pre-cycle state with actual metrics (7,697 tests, 331 suites, 443 events, 40 commands)
- [x] **Cycle goals defined** — 4 numbered goals + 1 stretch goal
- [x] **Proposed increments specified** — 9 increments with scope, estimated LOC, estimated tests
- [x] **Dependency graph drawn** — text-based dependency graph with parallel paths identified
- [x] **Risks identified** — 4 risks with impact assessment and mitigations
- [x] **Success metrics defined** — 8 measurable targets
- [x] **Deferred items documented** — Out of Scope section (5 items)

### 4. Increment Readiness

- [x] **Scope statement defined** — each increment has clear scope description
- [x] **Acceptance criteria written** — testable checkboxes per increment
- [x] **Test intent stated** — estimated test counts per increment
- [x] **Documentation intent stated** — implicit in acceptance criteria (review docs, frontmatter schemas)
- [x] **Architecture seams confirmed** — domain/UI/storage boundaries identified per increment
- [x] **Estimated size** — LOC and test count estimates for each increment

### 5. Quality Baseline

- [x] **Build pipeline green** — `npm run build` verified 2026-03-07
- [x] **No critical bugs open** — zero bugs listed
- [x] **Previous cycle closed** — C60 closed with TASM 19/20, retrospective completed

### 6. Pre-Cycle Completion

- [x] **Pre-cycle work documented** — Hub tab reorganization and Journey Executor domain documented in situation assessment
- [x] **Inbox signals reviewed** — relevant inbox items (review automation, quality dashboards, process compilation) mapped to cycle goals; remaining items explicitly deferred

**Readiness Gate: PASS** — All 6 sections satisfied. Cycle 61 is ready to start.
