---
type: DevelopmentCycle
feature: "[[Development/flowti/docs/features/MVP/MVP - Product Development Lifecycle|MVP - Product Development Lifecycle]]"
stage: planned
cycle: 60
release_anchor:
  - "Theme 12: Process Wiring — Bringing Process Management to Life"
  - "Theme 13: Quality Traceability — Connecting Tests to Features"
mvp: "[[Development/flowti/docs/features/MVP/MVP - Product Development Lifecycle|MVP - Product Development Lifecycle]]"
pbis:
  - "PBI-PW-001: Wire ProcessService into main.ts"
  - "PBI-PW-002: Processes tab in Event Catalog"
  - "PBI-PW-003: Wire process compliance into FeatureDetailPanel"
  - "PBI-SS-003: Feature binding dropdown in NewSessionModal"
  - "PBI-JE-001: Journey Executor retry logic"
  - "PBI-JE-002: Conditional step support"
  - "PBI-JE-003: Enhanced error reporting"
  - "PBI-JT-001: Journey feature field + parser"
  - "PBI-JT-002: Feature Quality tab in Test Management Hub"
  - "PBI-JT-003: Per-feature test result history"
  - "PBI-LT-001: Lifecycle journey templates"
bugs: []
tech_debt: []
estimated_increments: 12
estimated_loc: 2200
estimated_tests: 170
pre_cycle_tests: 7559
pre_cycle_suites: 323
---

# Cycle 60 — Process Wiring + Quality Traceability

> **MVP Cycle 3 of 5** — Wire Process Management into the plugin lifecycle, make sessions feature-aware in the UI, and establish feature-centric quality traceability.

## Release Anchor Themes

- **Theme 12: Process Wiring — Bringing Process Management to Life** — C59 built the domain layer. C60 wires it: ProcessService gets a scanner callback in main.ts, process definitions become visible in a new Processes tab, compliance data flows to FeatureDetailPanel, and sessions can be bound to features from the creation modal.
- **Theme 13: Quality Traceability — Connecting Tests to Features** — Journeys gain a `feature` field for explicit test-to-feature linkage. Test Management Hub adds a Feature Quality tab. Journey Executor gains retry logic and conditional steps. 5 lifecycle journey templates provide starters for common development phases.

## Situation Assessment

### Pre-Cycle State

- **Tests**: 7,559 passing (323 suites) — actual post-C59
- **Build**: `npm run build` green
- **Previous cycle**: C59 (Process Management Phase 1 + Lifecycle Sessions) — TASM 19/20
- **Events**: 406 total (16 new in C59: 12 process + 4 session.feature)
- **Commands**: 40 total
- **Hub Views**: 6 + FeaturesTab in Event Catalog
- **Process domain**: Domain-layer only — ProcessService, canvasParser, validation (10 rules), phaseMapping, referenceProcess. Not yet wired into main.ts.
- **Session v3**: Feature binding handlers exist, `session.create` accepts `featureName`, but no UI entry point.
- **Feature detail panel**: `getProcessCompliance` callback exists but is never wired — always returns undefined.

### Foundation from C59

| Component | Status | Relevance to C60 |
|-----------|--------|-------------------|
| ProcessService | Delivered (scanner pattern) | Wire into main.ts with vault scanner callback |
| ProcessEventMap (12 events) | Composed into EventMap | Already wired — no additional event work |
| Process validation (10 rules) | Pure functions | Process tab displays validation status |
| Phase-to-stage mapping | 10 phases, 6 stages | Compliance indicators use this mapping |
| FeatureDetailPanel compliance | UI renders but no data | Wire getProcessCompliance from ProcessService |
| Session featureBindingHandlers | bind/unbind ready | Need UI dropdown in NewSessionModal |
| handleCreate accepts featureName | Payload field exists | Modal needs to pass featureName on submit |
| JourneyExecutorService | 34-tool dispatch, AbortController | Add retry + conditional step logic |
| TestManagementService | Journey registry, run history, coverage | Add feature-centric quality view |

### C59 Improvement Backlog (targeted for C60)

| Item | C60 Increment |
|------|---------------|
| Wire ProcessService into main.ts with scan command | Inc 0 |
| Add process list view in a Hub tab | Inc 2 |
| Wire feature binding UI (command + session create modal) | Inc 3 |
| Connect compliance indicators to live process data | Inc 4 |

## User Pains

1. **Process domain invisible** — ProcessService built in C59 but no scanner, no UI, no compliance data flowing
2. **Sessions can't bind to features from UI** — `featureName` field exists on Session but no dropdown in NewSessionModal
3. **Tests not linked to features** — No way to see quality per feature; journeys lack explicit feature association
4. **Journey execution fragile** — No retry on transient failures, no conditional steps, poor error context

## Cycle Goals

1. **Wire ProcessService** — scanner callback in main.ts, `processesFolder` setting, `flowti:scan-processes` command
2. **Processes tab** — 10th tab in Event Catalog: master/detail with validation badges
3. **Feature binding UI** — dropdown in NewSessionModal + display bound feature in session detail
4. **Wire compliance indicators** — pass getProcessCompliance callback with live data into FeatureDetailPanel
5. **Journey Executor v2** — retry logic, conditional steps (skipIf/runIf), enhanced error reporting
6. **Feature-test traceability** — `feature` field on journeys, Feature Quality tab in Test Management Hub
7. **Per-feature test history** — timeline of journey runs grouped by feature, health trend
8. **Lifecycle templates** — 5 starter templates (backlog-review, planning, development, testing, review)

## Scope

### In Scope

**Process Wiring (Inc 0–4)**:
- `src/main.ts` — wire ProcessService with scanner callback, register scan command
- `src/domain/settings/settings.ts` — add `processesFolder` to FlowtiSettingsSchema (default: `"docs/processes"`)
- `src/ui/catalog/ProcessesTab.ts` — new master/detail component for process list
- `src/ui/catalog/EventCatalogView.ts` — register ProcessesTab, wire getProcessCompliance
- `src/domain/process/complianceCalculator.ts` — pure function computing ProcessCompliance
- `src/ui/modals.ts` — add feature dropdown in NewSessionModal
- `src/ui/userHub/SessionDetailPanel.ts` — show bound feature name

**Journey Executor v2 (Inc 5–7)**:
- `src/domain/journeyExecutor/types.ts` — RetryConfig, ConditionalConfig, retryAttempts on StepResult
- `src/domain/journeyExecutor/JourneyExecutorService.ts` — retry loop, conditional evaluation
- `src/domain/journeyExecutor/conditionEvaluator.ts` — pure function for skipIf/runIf expressions
- `src/domain/journeyExecutor/toolExecutors.ts` — contextual error wrapping
- `src/domain/journeyExecutor/events.ts` — `run.step-retried` event

**Quality Traceability (Inc 8–10)**:
- `src/domain/testManagement/types.ts` — `feature` field on JourneyRegistryEntry
- `src/domain/testManagement/journeyParser.ts` — parse `feature` field
- `src/domain/testManagement/featureQualityCalculator.ts` — aggregate run data per feature
- `src/ui/testManagement/FeatureQualityTab.ts` — 5th tab in Test Management Hub
- `src/domain/journeyBuilder/lifecycleTemplates.ts` — 5 template generator functions

### Out of Scope

- Phase 2 node types (Fork, Join, Loop, Subprocess, Milestone — C61)
- Process execution engine (C61+)
- Process→Journey compilation (C62+)
- Three Amigos review automation (C61)
- TASM scoring UI (C61)
- AI-assisted test generation
- E2E journeys (deferred to C61)

## Increments

### Inc 0: ProcessService Wiring + Settings
**Theme**: Process Wiring
**Effort**: Medium | **Est. LOC**: ~120 | **Est. Tests**: ~10

Wire ProcessService into main.ts:
- Get ProcessService from service container
- Create scanner callback: find `*.process.canvas` in `processesFolder` setting, read content
- Add `processesFolder` to FlowtiSettingsSchema (default: `"docs/processes"`)
- Call `setScanner()` + `scanProcesses()` in `onLayoutReady`
- Register `flowti:scan-processes` command
- Add notice: "Found N process definitions"

**Acceptance Criteria**:
- [ ] ProcessService receives scanner callback in main.ts
- [ ] `processesFolder` setting exists with default value
- [ ] `flowti:scan-processes` command triggers rescan
- [ ] Scanner reads `*.process.canvas` files from configured folder
- [ ] `npm test` green

---

### Inc 1: Process Auto-Rescan + Event Wiring
**Theme**: Process Wiring
**Effort**: Small | **Est. LOC**: ~60 | **Est. Tests**: ~8

- Listen for file changes on `*.process.canvas` paths to auto-rescan
- Wire ProcessService into disposable chain
- Test scanner callback integration patterns

**Acceptance Criteria**:
- [ ] Auto-rescan on process canvas file changes
- [ ] Notice shows scan results
- [ ] Service properly disposed on unload
- [ ] `npm test` green

---

### Inc 2: Processes Tab in Event Catalog
**Theme**: Process Wiring / UI
**Effort**: Large | **Est. LOC**: ~250 | **Est. Tests**: ~15

New `ProcessesTab` component following FeaturesTab pattern:
- Master list: process name, node count, validation badge (green/yellow/red)
- Detail panel: process info, node list with types, validation findings with severity icons
- 10th tab in EventCatalogView: `{ id: "processes", label: "Processes", icon: "waypoints" }`
- Filter by name and validation status
- Empty state when no processes scanned

**Acceptance Criteria**:
- [ ] Processes tab appears in Event Catalog
- [ ] Master list shows all scanned processes
- [ ] Detail panel shows validation findings
- [ ] Filter by name works
- [ ] Empty state handles no processes
- [ ] `npm test` green

---

### Inc 3: Session Feature Binding UI
**Theme**: Session Binding / UI
**Effort**: Medium | **Est. LOC**: ~180 | **Est. Tests**: ~12

- Add feature dropdown to `NewSessionModal` between "Focus file" and "Goals"
- NewSessionModal accepts optional `getFeatures` callback
- Dropdown: "-- none --" + feature names from FeatureLifecycleService
- Pass `featureName` in `session.create` event on submit
- Show bound feature name in SessionDetailPanel info section
- Wire getFeatures callback in UserHubView

**Acceptance Criteria**:
- [ ] Feature dropdown appears in NewSessionModal
- [ ] Selected feature name passed to session.create event
- [ ] Feature name displayed in session detail
- [ ] `npm test` green

---

### Inc 4: Wire Process Compliance Indicators
**Theme**: Process Wiring / Integration
**Effort**: Medium | **Est. LOC**: ~150 | **Est. Tests**: ~10

- Create `complianceCalculator.ts` — pure function computing ProcessCompliance from feature + phase data
- In EventCatalogView, pass `getProcessCompliance` callback to FeaturesTab deps
- Callback uses ProcessService (Development Lifecycle process) + phase mapping + feature stage
- FeatureDetailPanel already renders via `renderProcessCompliance()` — just needs the data

**Acceptance Criteria**:
- [ ] getProcessCompliance callback wired in EventCatalogView
- [ ] complianceCalculator returns meaningful compliance data
- [ ] Feature detail panel shows phase checklist with satisfaction status
- [ ] `npm test` green

---

### Inc 5: Journey Executor — Retry Logic
**Theme**: Executor v2
**Effort**: Medium | **Est. LOC**: ~200 | **Est. Tests**: ~18

- `RetryConfig`: `{ maxRetries: number; delayMs: number; backoff?: "linear" | "exponential" }`
- Optional `retry` field on `ExecutableStep`
- `retryCount` in `ExecutionOptions` as global default (default: 0 = no retry)
- Retry loop in `JourneyExecutorService.run()` with backoff delay
- New event: `run.step-retried` with attempt/maxRetries/error
- `retryAttempts` field on StepResult

**Acceptance Criteria**:
- [ ] Steps retry on failure up to maxRetries
- [ ] Configurable delay with linear/exponential backoff
- [ ] step-retried event emitted on each retry
- [ ] StepResult tracks retry attempts
- [ ] `npm test` green

---

### Inc 6: Journey Executor — Conditional Steps
**Theme**: Executor v2
**Effort**: Medium | **Est. LOC**: ~150 | **Est. Tests**: ~12

- `ConditionalConfig`: `{ skipIf?: string; runIf?: string }`
- Simple expressions: `{{var}}` (truthy), `!{{var}}` (falsy), `{{var}} == "value"` (equality)
- New `conditionEvaluator.ts` pure function module
- Before step execution, evaluate condition → skip with reason if not met
- Skipped steps show condition reason in result

**Acceptance Criteria**:
- [ ] skipIf causes step to be skipped when condition is true
- [ ] runIf causes step to be skipped when condition is false
- [ ] Simple expression evaluation works
- [ ] Skipped steps show condition reason
- [ ] `npm test` green

---

### Inc 7: Journey Executor — Enhanced Error Reporting
**Theme**: Executor v2 / Quality
**Effort**: Small | **Est. LOC**: ~100 | **Est. Tests**: ~8

- Wrap action execution with contextual error info: tool name, action index, key params
- `failedAction` field on StepResult: `{ tool: string; actionIndex: number }`
- ExecutionProgressModal shows which tool/action failed
- Execution report includes action context in error column

**Acceptance Criteria**:
- [ ] Error messages include tool name and key parameters
- [ ] Failed action index tracked in StepResult
- [ ] ExecutionProgressModal shows which action failed
- [ ] `npm test` green

---

### Inc 8: Journey Feature Field + Parser
**Theme**: Quality Traceability
**Effort**: Small | **Est. LOC**: ~80 | **Est. Tests**: ~10

- Add `feature?: string` to JourneyRegistryEntry
- Parse `feature` field in journeyParser
- Add `feature` text input in JourneyBuilderSidebar metadata section
- Export includes feature field
- coverageCalculator links by feature field (alongside existing domain/prd matching)

**Acceptance Criteria**:
- [ ] `feature` field parsed from journey JSON
- [ ] JourneyBuilderSidebar has Feature input in metadata
- [ ] Coverage calculator links by feature field
- [ ] Exported journeys include feature field
- [ ] `npm test` green

---

### Inc 9: Feature Quality Tab + Lifecycle Templates
**Theme**: Quality Traceability / UI + Templates
**Effort**: Large | **Est. LOC**: ~300 | **Est. Tests**: ~22

**Feature Quality Tab** (5th tab in Test Management Hub):
- Master: features with quality badges (journey count, pass/fail, coverage)
- Detail: linked journeys with run status, recent runs timeline
- `featureQualityCalculator.ts` — aggregate run data per feature

**Lifecycle Templates** (5 generator functions):
- `backlog-review`, `planning`, `development`, `testing`, `review`
- Each returns valid ExecutableJourney JSON
- Templates use: command, assert, navigate, screenshot, manual tools
- Exposed in JourneyBuilder sidebar

**Acceptance Criteria**:
- [ ] Feature Quality tab appears as 5th tab in Test Management Hub
- [ ] Master list shows features with quality indicators
- [ ] 5 lifecycle journey templates created
- [ ] Templates visible in Journey Builder
- [ ] `npm test` green

---

### Inc 10: Per-Feature Test History
**Theme**: Quality Traceability / Integration
**Effort**: Medium | **Est. LOC**: ~150 | **Est. Tests**: ~15

- `computeFeatureTestHistory()` in featureQualityCalculator
- Aggregates runs from all linked journeys (by feature, prd, or domain)
- Timeline view in FeatureQualityTab detail panel with date grouping
- Health trend: improving/degrading/stable (last 5 runs comparison)

**Acceptance Criteria**:
- [ ] Test history aggregated per feature
- [ ] Timeline renders in detail panel
- [ ] Health trend computed (improving/degrading/stable)
- [ ] `npm test` green

---

### Inc 11: Integration Testing + Polish
**Theme**: Quality
**Effort**: Medium | **Est. LOC**: ~160 | **Est. Tests**: ~15

- Flow test: ProcessService → scan → validate → compliance → feature detail
- Flow test: session create with feature binding → verify featureName
- Flow test: journey with feature → quality calculator → feature quality tab
- Flow test: executor retry + conditional steps
- Empty state testing, error handling, event catalog updates
- `npm run build` green

**Acceptance Criteria**:
- [ ] All flow tests pass
- [ ] Empty states handled gracefully
- [ ] Error cases do not crash
- [ ] `npm test` green
- [ ] `npm run build` green

## Dependency Graph

```
Inc 0 (ProcessService wiring) ──→ Inc 1 (Auto-rescan)
Inc 0                         ──→ Inc 2 (Processes tab)
Inc 0                         ──→ Inc 4 (Compliance indicators)
Inc 3 (Feature binding UI)    ──→ Independent of Inc 0-2
Inc 5 (Retry logic)           ──→ Inc 7 (Error reporting)
Inc 6 (Conditional steps)     ──→ Inc 7 (Error reporting)  [Independent of Inc 5]
Inc 8 (Feature field)         ──→ Inc 9 (Feature Quality tab + templates)
Inc 9                         ──→ Inc 10 (Per-feature history)
All                           ──→ Inc 11 (Integration)
```

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| ProcessService scanner slow on large vaults | Medium | Limit scan to processesFolder only (not whole vault) |
| Feature dropdown stale if features change | Low | Fetch lazily on modal open |
| Retry masks genuine failures | Medium | Default retries = 0 (off). Must be explicitly enabled |
| Conditional expressions become complex | Low | Phase 1: simple expressions only (truthy, equality) |
| Feature Quality tab is large (~300 LOC) | Medium | Split if needed: tab structure in Inc 9, history in Inc 10 |
| EventCatalog has 9 tabs → 10th may feel crowded | Low | Same master/detail pattern. Tabs scroll naturally |
| Lifecycle templates may not fit all projects | Low | Templates are starting points. Users modify exported JSON |

## Success Metrics

| Metric | Target |
|--------|--------|
| New tests | ~170 |
| Post-cycle tests | ~7,729 |
| New suites | ~10 |
| Source LOC | ~2,200 |
| New UI tabs | 2 (Processes in Event Catalog, Feature Quality in Test Management Hub) |
| Lifecycle templates | 5 |
| Increments | ~12 |
| PBIs | 11 |

## Definition of Done

- [ ] ProcessService wired into main.ts with scanner callback
- [ ] `processesFolder` setting added to schema
- [ ] Processes tab in Event Catalog shows scanned processes with validation
- [ ] Feature binding dropdown in NewSessionModal
- [ ] Feature name visible in session detail panel
- [ ] Process compliance indicators render with live data in FeatureDetailPanel
- [ ] Journey Executor supports step-level retry with configurable delay
- [ ] Journey Executor supports conditional steps (skipIf/runIf)
- [ ] Error messages include tool name and action context
- [ ] `feature` field on journey JSON and JourneyRegistryEntry
- [ ] Feature Quality tab in Test Management Hub with quality badges
- [ ] Per-feature test history timeline
- [ ] 5 lifecycle journey templates
- [ ] Flow integration tests for process wiring, feature binding, executor v2, feature quality
- [ ] `npm run build` green
- [ ] Three Amigos review completed

## Definition of Ready — Verification

| § | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | PRD exists and approved | PASS | MVP PRD at approved, Process Mapping PRD at in-progress |
| 1 | FRI meets threshold | PASS | FRI 22/35 (≥ 11 continuation threshold) |
| 2 | PBIs defined with AC | PASS | 11 PBIs with acceptance criteria |
| 2 | PBIs chunked into increments | PASS | 12 increments, vertical slices |
| 2 | Dependencies mapped | PASS | Dependency graph with parallelism opportunities |
| 3 | Cycle document exists | PASS | This document with full frontmatter |
| 3 | Situation assessment | PASS | Pre-cycle state documented with C59 actuals |
| 3 | Goals defined | PASS | 8 numbered goals |
| 3 | Increments specified | PASS | 12 increments with LOC/test estimates |
| 3 | Risks identified | PASS | 7 risks with mitigations |
| 3 | Success metrics | PASS | 8 measurable targets |
| 4 | Increment readiness | PASS | Each has scope, AC, test intent, size estimate |
| 5 | Build pipeline green | PASS | `npm run build` verified post-C59 |
| 5 | No critical bugs | PASS | 0 open bugs |
| 5 | Previous cycle closed | PASS | C59 done, retrospective complete, TASM 19/20 |
| 6 | Pre-cycle work documented | PASS | C59 improvement backlog mapped to C60 increments |
| 6 | Inbox signals reviewed | PASS | C59 retrospective captured next cycle inputs |

**Result: READY** — All 6 sections satisfied. Cycle 60 may begin.
