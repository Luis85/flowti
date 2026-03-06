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
pre_cycle_tests: 7496
pre_cycle_suites: 333
---

# Cycle 61 — Quality + Review Automation

> **MVP Cycle 4 of 5** — Close the review loop with automation, scoring, and quality dashboards.

## Release Anchor Theme

- **Theme 14: Quality Management — Review Automation + TASM Scoring** — Automate Three Amigos review creation, build TASM scoring UI, and create a cross-feature quality dashboard.
- **Theme 15: Process→Journey Compilation Phase 1** — Compile process definitions into executable journeys (happy path only).

## Situation Assessment

### Pre-Cycle State

- **Tests**: ~7,496 passing (~333 suites) — projected after C60
- **Build**: `npm run build` green
- **Previous cycles**: C58 (Feature Lifecycle), C59 (Process + Sessions), C60 (Journeys + Quality)
- **Feature Lifecycle**: Full — scan, gates, FRI, session-bound, test-linked
- **Process Management**: Phase 1 — canvas parser, validation, reference process
- **Test Management**: Feature-centric quality view, test traceability, result history
- **Journey Builder**: Phase 3 — lifecycle templates, executor v2 with retry/conditionals

### Foundation

| Component | Status | Relevance to C61 |
|-----------|--------|-------------------|
| Feature Lifecycle | Full (C58) | Review sessions bind to features |
| Gate checks | 6 gates (C58) | Quality Gate checks TASM score |
| Test traceability | Delivered (C60) | Quality dashboard uses test data |
| Test result history | Delivered (C60) | Dashboard shows trends |
| Process definitions | Phase 1 (C59) | Process→Journey compilation input |
| Three Amigos template | Exists (knowledgebase) | Auto-scaffold from template |

## Cycle Overview

Cycle 61 closes the **quality and review loop**. Currently, Three Amigos reviews are conducted manually using markdown templates. TASM scores are computed on paper and recorded by hand.

This cycle automates the review workflow: create review documents with pre-filled context (PRD summary, test results, coverage status), provide a TASM scoring UI that persists scores to frontmatter, and build a quality dashboard showing cross-feature quality health.

The stretch goal is Phase 1 of Process→Journey compilation: compile a process definition's happy path into an executable journey.

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
| Post-cycle tests | ~7,596 |
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
