---
type: DevelopmentCycle
feature: "[[Development/flowti/docs/features/MVP/MVP - Product Development Lifecycle|MVP - Product Development Lifecycle]]"
stage: planned
cycle: 59
release_anchor:
  - "Theme 10: Process Management — Making the Lifecycle Visible"
  - "Theme 11: Lifecycle Sessions — Binding Work to Features"
mvp: "[[Development/flowti/docs/features/MVP/MVP - Product Development Lifecycle|MVP - Product Development Lifecycle]]"
pbis:
  - "PBI-PM-001: Promote Process PRDs"
  - "PBI-PM-002: ProcessService"
  - "PBI-PM-003: Process Node Types Phase 1"
  - "PBI-PM-004: Canvas Process Parser"
  - "PBI-PM-005: Process Validation"
  - "PBI-PM-006: Development Lifecycle Reference Process"
  - "PBI-PM-007: Phase-to-Stage Mapping"
  - "PBI-PM-008: Process Compliance Indicators"
  - "PBI-SS-001: Session Feature Binding"
  - "PBI-SS-002: Session Completion Updates"
  - "PBI-PM-009: Process Events"
bugs: []
tech_debt: []
estimated_increments: 12
estimated_loc: 2000
estimated_tests: 120
pre_cycle_tests: 7386
pre_cycle_suites: 314
---

# Cycle 59 — Process Management Phase 1 + Lifecycle Sessions

> **MVP Cycle 2 of 5** — Make the Development Lifecycle visible and make sessions lifecycle-aware.

## Release Anchor Theme

- **Theme 10: Process Management — Making the Lifecycle Visible** — Build Phase 1 of the Process Management domain: canvas-based process modeling, validation, and the Development Lifecycle as reference process.
- **Theme 11: Lifecycle Sessions — Binding Work to Features** — Session v3: bind sessions to features and lifecycle phases, track file changes per feature.

## Situation Assessment

### Pre-Cycle State

- **Tests**: 7,386 passing (314 suites) — actual post-C58
- **Build**: `npm run build` green
- **Previous cycle**: C58 (Feature Lifecycle Core) — FeatureLifecycleService, gates, FRI, Pipeline UI
- **Hub Views**: 6 + FeaturesTab in Event Catalog
- **Events**: 390 total
- **Feature Lifecycle**: Operational — 41 PRDs scanned, 6 gates, FRI/prioritization scoring, pipeline UI, configurable paths. TASM 31/35.

### Foundation from C58

| Component | Status | Relevance to C59 |
|-----------|--------|-------------------|
| FeatureLifecycleService | Delivered (230 tests) | Process compliance binds to features |
| Gate check functions | 6 gates (GateContext pattern) | Process steps map to gate requirements — reuse GateContext injection pattern |
| FRI scoring | Operational (7 dimensions) | Process phase determines readiness context |
| Feature Pipeline UI | FeaturesTab in Event Catalog | Process compliance shown in feature detail |
| Feature events (6) | Wired (2 review deferred) | Process events extend the pattern |
| Feature session tracking | Basic (start/end, no file tracking) | Session v3 extends with feature binding + file change tracking |
| Configurable settings | `featuresFolder`, `testReportPath` | Pattern for process-related settings |
| Legacy stage normalization | 14 mappings | Process phases may introduce additional mapping needs |

### Foundation from Vault Inbox

Two comprehensive PRD drafts exist:
- **PRD - Process Mapping** — 9 node types, canvas sync, lint rules, visual language, process→journey compilation
- **PRD - Process Execution Framework** — Execution engine, state model, metrics, action buttons, event-driven orchestration

C59 implements **Phase 1** of both PRDs — scoped to the 4 core node types and lightweight execution.

## Cycle Overview

Cycle 59 introduces the **Process Management domain** and makes **sessions lifecycle-aware**.

The Process Management domain provides tools to model, visualize, and validate processes on Canvas. Phase 1 supports 4 node types (Start, Activity, Decision, End), structural validation, and the Development Lifecycle as the first reference process. The canvas parser reads process nodes from Obsidian Canvas files, and validation ensures structural correctness.

Session v3 adds lifecycle awareness: sessions can be bound to features, file changes during sessions are tracked against the feature's scope, and session completion updates feature progress.

## User Pains

1. **Processes are invisible** — The Development Lifecycle is a 10-phase process documented in markdown, but there's no way to visualize where a feature is in the process.
2. **No process compliance** — Gate checks verify PRD content, but don't track whether the process steps (discovery, design, review) were actually followed.
3. **Sessions float** — Sessions exist in isolation; there's no way to associate a work session with a specific feature or lifecycle phase.
4. **No process modeling** — Canvas is used for domain design and brainstorming but cannot represent structured processes.

## Cycle Goals

1. **ProcessService** — domain service for process definition scanning and management
2. **Process node types** — Start, Activity, Decision, End (Phase 1 of 9)
3. **Canvas parser** — read process definitions from Canvas files
4. **Validation** — structural lint rules (exactly 1 Start, ≥1 End, no orphans, no dead ends)
5. **Reference process** — Development Lifecycle modeled as an executable process map
6. **Phase mapping** — connect 10 lifecycle phases to 6 feature stages
7. **Session v3** — bind sessions to features and lifecycle phases
8. **Compliance indicators** — show which process steps are satisfied per feature

## Scope

### In Scope

**Domain**:
- `src/domain/process/types.ts` — ProcessDefinition, ProcessNode, ProcessEdge, ProcessNodeType
- `src/domain/process/events.ts` — ProcessEventMap (12 events)
- `src/domain/process/ProcessService.ts` — scan, parse, validate, track compliance
- `src/domain/process/canvasParser.ts` — parse Canvas JSON into ProcessDefinition
- `src/domain/process/validation.ts` — structural lint rules (pure functions)
- `src/domain/process/phaseMapping.ts` — map 10 lifecycle phases to 6 feature stages
- Process node types Phase 1: Start (`●`), Activity (`■`), Decision (`◇`), End (`⦿`)

**Session v3**:
- Feature binding — `startSession({ featureId })` links session to feature
- File change tracking — session artifacts associated with bound feature
- Session completion → emit `feature.session.ended` with artifact summary
- Feature progress update on session end

**UI**:
- Process compliance section in Feature detail panel (C58's FeaturesTab)
- Phase indicator per feature (which of 10 phases?)

**Events** (12 new process.* events):
- `process.opened`, `process.created`, `process.updated`
- `process.node.added`, `process.node.updated`, `process.node.removed`
- `process.edge.created`, `process.edge.removed`
- `process.compiled`, `process.canvas.synced`
- `process.execution.started`, `process.execution.completed`

### Out of Scope

- Fork, Join, Loop, Subprocess, Milestone node types (Phase 2)
- Process execution engine (Phase 2)
- Process→Journey compilation (C61)
- Swimlanes and parallel execution
- Process dashboards and metrics
- Process simulation
- Canvas-based process editor (edit is manual; parse is automated)

## Increments

### Inc 0: Process Domain — Types + Events
**Theme**: Domain / Architecture
**Effort**: Medium | **Est. LOC**: ~150 | **Est. Tests**: ~10

Define the Process Management domain:
- `src/domain/process/types.ts` — ProcessDefinition, ProcessNode (4 types), ProcessEdge, ValidationResult, PhaseMapping
- `src/domain/process/events.ts` — ProcessEventMap (12 events)
- Wire events into infrastructure EventMap
- Node type constants with title tokens (`●`, `■`, `◇`, `⦿`)

**Acceptance Criteria**:
- [ ] Types defined and exported
- [ ] Events defined and wired
- [ ] `npm test` green

---

### Inc 1: Canvas Process Parser
**Theme**: Domain
**Effort**: Large | **Est. LOC**: ~200 | **Est. Tests**: ~18

Parse process definitions from Canvas files:
- Read Canvas JSON (nodes array, edges array)
- Detect process nodes by title token prefix (`●`, `■`, `◇`, `⦿`)
- Parse fenced YAML metadata from node body
- Build ProcessDefinition with typed nodes and edges
- Handle malformed nodes gracefully (skip with warning)
- Extract edge labels and conditions

**Acceptance Criteria**:
- [ ] Parser reads Obsidian Canvas JSON format
- [ ] Node types detected from title tokens
- [ ] Metadata extracted from fenced YAML
- [ ] Edges connected to source/target nodes
- [ ] Malformed nodes handled gracefully
- [ ] `npm test` green

---

### Inc 2: Process Validation — Structural Rules
**Theme**: Domain
**Effort**: Medium | **Est. LOC**: ~150 | **Est. Tests**: ~15

Implement structural validation (lint rules) as pure functions:
- PM-STRUCT-001: Process must contain nodes
- PM-STRUCT-002: Exactly one Start node
- PM-STRUCT-003: At least one End node
- PM-STRUCT-004: Start must have outgoing edges
- PM-STRUCT-005: End must have no outgoing edges
- PM-STRUCT-006: No disconnected nodes
- PM-STRUCT-007: No dead ends (non-end nodes must have outgoing edges)
- PM-STRUCT-008: No orphan edges
- PM-STRUCT-009: Unique node ids
- PM-TYPE-005: Decision nodes must have ≥ 2 outgoing edges

Each rule returns `{ ruleId, severity, message, nodeId?, fix }`.

**Acceptance Criteria**:
- [ ] 10 structural rules implemented as pure functions
- [ ] Each returns structured validation result
- [ ] Tests cover pass and fail for each rule
- [ ] `npm test` green

---

### Inc 3: ProcessService — Scan + Validate
**Theme**: Domain
**Effort**: Medium | **Est. LOC**: ~150 | **Est. Tests**: ~10

Build the ProcessService:
- `scanProcesses()` — find `*.process.canvas` files in vault, parse each
- `getProcesses()` — return all scanned ProcessDefinitions
- `validateProcess(definition)` — run all validation rules, return results
- `getValidationSummary(definition)` — error/warn/info counts
- Wire into main.ts service lifecycle

**Acceptance Criteria**:
- [ ] Service scans canvas files for process definitions
- [ ] Validation runs on scanned processes
- [ ] Summary provides error/warn/info counts
- [ ] `npm test` green

---

### Inc 4: Phase-to-Stage Mapping
**Theme**: Domain
**Effort**: Small | **Est. LOC**: ~80 | **Est. Tests**: ~10

Map Development Lifecycle phases to Feature stages:
- Define phase mapping: `{ phase: number, name: string, stage: FeatureStage }`
- 10 phases → 6 stages (as defined in Feature Lifecycle PRD)
- `getPhaseForStage(stage)` — which phases correspond to this stage?
- `getStageForPhase(phase)` — which stage does this phase belong to?
- `getActivePhase(feature)` — determine current phase from feature state
- Phase descriptions with lifecycle step names

**Acceptance Criteria**:
- [ ] Phase mapping covers all 10 phases
- [ ] Bidirectional mapping (phase↔stage)
- [ ] Active phase determination works
- [ ] `npm test` green

---

### Inc 5: Development Lifecycle Reference Process
**Theme**: Content / Design
**Effort**: Medium | **Est. LOC**: ~100 | **Est. Tests**: ~5

Create the Development Lifecycle as a reference process map:
- `docs/processes/development-lifecycle.process.canvas` — Canvas file with 10 phases as Activity nodes
- Start: "Feedback & Intake" / End: "Feedback Loop"
- Decision nodes for gate checks between phases
- Edges connecting the linear flow with decision branches
- Validate the canvas passes all structural rules

**Acceptance Criteria**:
- [ ] Canvas process file created with 10 phases
- [ ] All 4 node types used (Start, Activity, Decision, End)
- [ ] Process passes validation
- [ ] `npm test` green

---

### Inc 6: Session v3 — Feature Binding
**Theme**: Domain / Session
**Effort**: Medium | **Est. LOC**: ~150 | **Est. Tests**: ~15

Add feature binding to Session domain:
- Extend session creation to accept optional `featureId`
- Store feature binding in session data
- Track file changes during session as feature artifacts
- Emit `feature.session.started` when session with feature binding starts
- Emit `feature.session.ended` when session completes, including artifact summary
- Display bound feature name in session UI

**Acceptance Criteria**:
- [ ] Sessions can be bound to features
- [ ] File changes tracked as feature artifacts
- [ ] Feature events emitted on session start/end
- [ ] Bound feature visible in session UI
- [ ] `npm test` green

---

### Inc 7: Session Completion → Feature Progress
**Theme**: Domain / Integration
**Effort**: Small | **Est. LOC**: ~80 | **Est. Tests**: ~8

Connect session completion to feature progress:
- On `feature.session.ended`, update feature session history
- Compute session metrics per feature (total sessions, total time, artifacts)
- Display session summary in feature detail panel
- If session had file changes, check if any gate requirements improved

**Acceptance Criteria**:
- [ ] Session history updated on completion
- [ ] Session metrics computed per feature
- [ ] Summary visible in feature detail
- [ ] `npm test` green

---

### Inc 8: Process Compliance Indicators
**Theme**: UI / Integration
**Effort**: Medium | **Est. LOC**: ~120 | **Est. Tests**: ~10

Show process compliance in Feature Pipeline:
- Add "Process" section to feature detail panel
- Show current phase indicator (which of 10 phases)
- Show process step checklist (which steps have evidence)
- Compliance percentage per feature
- Color coding: green (≥80%), yellow (50-79%), red (<50%)

**Acceptance Criteria**:
- [ ] Process section in feature detail panel
- [ ] Phase indicator shows current position
- [ ] Step checklist shows completion
- [ ] Color-coded compliance percentage
- [ ] `npm test` green

---

### Inc 9: Promote Process PRDs
**Theme**: Documentation
**Effort**: Small | **Est. LOC**: ~0 | **Est. Tests**: ~0

Move Process PRDs from vault inbox to features directory:
- Move `PRD - Process Mapping.md` → `docs/features/Process Management/Process Mapping PRD.md`
- Move `PRD - Process Execution Framework.md` → `docs/features/Process Management/Process Execution Framework PRD.md`
- Update frontmatter: stage: in-progress, add PBI references
- Update MVP document with new file locations

**Acceptance Criteria**:
- [ ] PRDs moved to features directory
- [ ] Frontmatter updated
- [ ] Links updated in MVP document

---

### Inc 10: Integration Testing + Polish
**Theme**: Quality
**Effort**: Medium | **Est. LOC**: ~120 | **Est. Tests**: ~12

End-of-cycle quality:
- Flow test: parse canvas → validate → check compliance → session lifecycle
- Verify compliance indicators render with real process data
- Verify session feature binding with actual session lifecycle
- Empty state handling (no processes, no sessions on feature)
- Error handling (malformed canvas, missing nodes)

**Acceptance Criteria**:
- [ ] Flow test covers parse → validate → compliance → session
- [ ] Empty states handled
- [ ] Error cases don't crash
- [ ] `npm test` green
- [ ] `npm run build` green

## Dependency Graph

```
Inc 0 (Types + Events)       ──→ Inc 1 (Parser) + Inc 4 (Phase mapping)
Inc 1 (Parser)               ──→ Inc 2 (Validation) + Inc 3 (Service)
Inc 2 (Validation)           ──→ Inc 3 (Service) + Inc 5 (Reference process)
Inc 3 (Service)              ──→ Inc 8 (Compliance UI)
Inc 4 (Phase mapping)        ──→ Inc 8 (Compliance UI)
Inc 5 (Reference process)    ──→ Inc 8 (Compliance UI)
Inc 6 (Session binding)      ──→ Inc 7 (Session → progress)
Inc 7 (Session → progress)   ──→ Inc 10 (Integration)
Inc 8 (Compliance)           ──→ Inc 10 (Integration)
Inc 9 (PRD move)             ──→ Independent
```

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Canvas process parser is fragile (Canvas format changes) | Medium | Use same parsing approach as Journey Builder canvas sync; version-detect format |
| Process validation rules are too strict for first use | Low | Ship with "Normal" mode (errors only); strict mode optional |
| Session feature binding creates tight coupling | Medium | Event-based: session emits event, feature service listens; no direct dependency |
| Development Lifecycle canvas is complex (10 phases) | Low | Linear happy path first; decision branches are optional |
| Process PRDs are very ambitious — scope creep risk | High | Strict Phase 1 scope: 4 node types, structural validation only |

## Success Metrics

| Metric | Target |
|--------|--------|
| New tests | ~120 |
| Post-cycle tests | ~7,506 |
| New suites | ~10 |
| Source LOC | ~2,000 |
| Process node types | 4 (Start, Activity, Decision, End) |
| Validation rules | 10 structural rules |
| Events | 12 new process.* (402 total) |
| Reference processes | 1 (Development Lifecycle) |
| Increments | ~11 |

## Definition of Done

- [ ] `ProcessService` scans canvas files, parses process definitions
- [ ] Canvas parser extracts 4 node types from Canvas JSON
- [ ] 10 structural validation rules implemented as pure functions
- [ ] Phase-to-stage mapping covers 10 phases → 6 stages
- [ ] Development Lifecycle canvas created and passes validation
- [ ] Session v3: feature binding with artifact tracking
- [ ] Session completion updates feature progress
- [ ] Process compliance indicators in feature detail panel
- [ ] 12 process events defined and wired
- [ ] Process PRDs promoted to features directory
- [ ] Flow integration test for full lifecycle
- [ ] `npm run build` green
- [ ] Three Amigos review completed

## Definition of Ready — Verification

| § | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | PRD exists and approved | PASS | Process Mapping PRD at `approved`, FRI 22 (≥11 for continuation cycle) |
| 1 | FRI meets threshold | PASS | FRI 22/35 (Technically Ready) — exceeds ≥11 continuation threshold |
| 2 | PBIs defined with AC | PASS | 11 PBIs (PBI-PM-001–009, PBI-SS-001–002), each with acceptance criteria |
| 2 | PBIs chunked into increments | PASS | 11 increments (Inc 0–10), vertical slices |
| 2 | Dependencies mapped | PASS | Dependency graph with parallelism identified |
| 3 | Cycle document exists | PASS | This document with full frontmatter |
| 3 | Situation assessment | PASS | Pre-cycle state documented with C58 actuals |
| 3 | Goals defined | PASS | 8 numbered goals |
| 3 | Increments specified | PASS | 11 increments with LOC/test estimates |
| 3 | Risks identified | PASS | 5 risks with mitigations |
| 3 | Success metrics | PASS | 9 measurable targets |
| 4 | Increment readiness | PASS | Each has scope, AC, test intent, size estimate |
| 5 | Build pipeline green | PASS | `npm run build` verified 2026-03-06 |
| 5 | No critical bugs | PASS | 0 open bugs |
| 5 | Previous cycle closed | PASS | C58 done, retrospective complete, TASM 31/35 |
| 6 | Pre-cycle work documented | PASS | Process Mapping PRD scored (FRI 22), plan updated with C58 actuals |
| 6 | Inbox signals reviewed | PASS | C58 retrospective captured next cycle inputs |

**Result: READY** — All 6 sections satisfied. Cycle 59 may begin.
