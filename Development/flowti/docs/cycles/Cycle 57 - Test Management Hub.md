---
type: DevelopmentCycle
feature: "[[Development/flowti/docs/features/Test Management/Test Management PRD|Test Management PRD]]"
stage: active
cycle: 57
release_anchor:
  - "Theme 7: Quality Management — Test Management Hub"
  - "Theme 8: Flowti Journeys — In-App Execution"
pbis:
  - "PBI-TM-001: Domain Core"
  - "PBI-TM-002: Hub Shell + Dashboard"
  - "PBI-TM-003: Journeys Tab"
  - "PBI-TM-004: Pyramid Visualization"
  - "PBI-TM-005: Coverage Matrix"
  - "PBI-TM-006: Compliance Tagging"
  - "PBI-TM-007: Journey Builder Integration"
  - "PBI-TM-008: Journey Executor"
  - "PBI-TM-009: Execution UI"
  - "PBI-TM-010: E2E Journey"
bugs: []
tech_debt:
  - TD-45
  - TD-58
  - TD-93
  - TD-131
  - TD-120
estimated_increments: 12
estimated_loc: 2700
estimated_tests: 335
pre_cycle_tests: 6794
pre_cycle_suites: 284
---

# Cycle 57 — Test Management Hub + Session Finalization

## Release Anchor Theme

- **Theme 7: Quality Management — Test Management Hub** — Build the 6th Hub view: a journey-centric quality cockpit with dashboard, journeys, pyramid, coverage, and compliance tabs.
- **Theme 8: Flowti Journeys — In-App Execution** — Execute journey definitions directly from the UI using the same 34-tool vocabulary as the CLI, against the user's own vault.

## Situation Assessment

### Pre-Cycle State

- **Tests**: 6,794 passing (284 suites) — actual C56 closing state
- **Build**: `npm run build` green
- **Open bugs**: None critical
- **Previous cycle**: C56 (Journey Builder Phase 2) — canvas round-trip, preview run, dual input, step background images. Closed with DoD review.
- **Release Blockers**: 2 remaining (RB-1 installer config, RB-7 deferred)
- **Tech Debt**: ~27 open items (after C56 closed 3)

### Foundation from C55/C56

| Component | Status | Relevance to C57 |
|-----------|--------|-------------------|
| JourneyDefinition | Defined type with steps, actions, actors, services | Hub reads these files |
| JourneyResult | Result JSON from E2E runner | Hub parses for run history |
| canvasSync.ts | JSON → Canvas sync (bidirectional after C56) | Executor highlights active step |
| toolSchemas.ts | 34 tool schemas | Executor implements all 34 tools |
| EventSuggest | Fuzzy autocomplete | Reusable in Hub search/filter |
| BaseHubView | Abstract Hub base (5 subclasses) | 6th subclass: TestManagementHubView |
| WorkspaceShell | Shared chrome (ribbon, tabs, content) | Reused by new Hub |
| HubDashboardProvider | Interface for User Hub summary cards | TestManagementHubProvider |
| E2E action runner | CLI-based 34-tool executor | Reference implementation for in-app executor |

### Carried Forward

| Item | Classification | Action |
|------|----------------|--------|
| Session v2 finalization | Enhancement | Complete auto-documentation + template management |
| TD-45: View state persistence | Tech debt → Feature | Save/restore active tab across reloads |
| RB-1: Installer JSON config | Release blocker | Externalize to versioned JSON schema |
| TD-131: Canvas layout deduplication | Tech debt | Extract shared constants |
| TD-120: session/types.ts size | Tech debt | Extract Zod schemas |

## Cycle Overview

Cycle 57 is the **largest single-feature cycle** since C55, delivering the Test Management Hub — a journey-centric quality management cockpit that consumes the artifacts produced by the Journey Builder and Journey Runner.

The Hub provides 5 views: **Dashboard** (KPIs, mini pyramid, recent runs, needs attention), **Journeys** (master/detail with filters, run history, traceability), **Pyramid** (3-layer test pyramid visualization), **Coverage** (PRD-to-journey matrix with gap analysis), and **Compliance** (ISO 9001/27001/25010 advisory tagging).

The **Flowti Journey Executor** brings journey execution into the UI — the same 34-tool vocabulary that the CLI uses (command, click, assert, emit, screenshot, etc.) runs directly against the user's vault with live step-by-step progress. This makes Flowti Journeys a first-class concept: portable definitions for automated testing, vault automation, and living documentation.

The Hub operates in **dual mode**: Standard (Obsidian only — full functionality except test vault targeting and full pyramid data) and Expert (vitest detected — adds test vault, CLI runs, flow/unit pyramid layers).

In parallel, Session v2 is finalized, view state persistence is added, and 5 tech debt items are addressed.

## User Pains

1. **Journeys are fire-and-forget** — Created in the Builder, run via CLI, but never managed. No dashboard, no status overview, no coverage tracking.
2. **Execution requires CLI + test vault** — Non-developers cannot run journeys at all. Developers must switch to the terminal.
3. **No PRD-to-test traceability** — Teams can't answer "Which PRD use cases are tested?" or "What domains have no coverage?"
4. **No compliance guidance** — ISO quality characteristics are abstract; no tooling helps teams tag or assess compliance.
5. **Test pyramid is invisible** — No view showing the balance between E2E journeys, flow suites, and unit tests.
6. **Hub views lose tab state on reload** — Navigating away and back resets the active tab.

## Cycle Goals

1. **Test Management Hub** — 6th BaseHubView subclass with Dashboard + 4 tabs
2. **Journey Executor** — In-app execution engine with 34-tool vocabulary, vault targeting, live progress
3. **Dual-mode architecture** — Standard (Obsidian only) and Expert (vitest + CLI) modes
4. **PRD-to-journey coverage** — Matrix linking PRD features to journeys with gap analysis
5. **ISO compliance tagging** — Advisory tags for 9001, 27001, 25010 with guidance callouts
6. **Test pyramid visualization** — 3-layer view with counts, pass rates, trends
7. **Session v2 finalization** — Auto-documentation, template management
8. **View state persistence** — Save/restore active tab across reloads (TD-45)

## Scope

### In Scope

**Test Management Hub (10 PBIs)**:
- PBI-TM-001: Domain Core — service, types, events, journey parser
- PBI-TM-002: Hub Shell + Dashboard — view registration, KPI cards, mini pyramid, recent runs
- PBI-TM-003: Journeys Tab — master/detail, filters, run history, step results, traceability
- PBI-TM-004: Pyramid Visualization — 3-layer display, drill-down, trend indicators
- PBI-TM-005: Coverage Matrix — PRD-journey linking, gap analysis, domain/actor/service coverage
- PBI-TM-006: Compliance Tagging — ISO definitions, tag management, gap analysis, report export
- PBI-TM-007: Journey Builder Integration — auto-register, "Open in Builder", "Run" from Builder
- PBI-TM-008: Journey Executor — 34-tool in-app execution, vault targeting, cancellation
- PBI-TM-009: Execution UI — live progress panel, report generation, command registration
- PBI-TM-010: E2E Journey — declarative E2E validation of the Hub and executor

**Session & Infrastructure**:
- Session v2 finalization: auto-documentation, template management
- TD-45 → Feature: View state persistence across reloads
- RB-1: Installer JSON config externalization
- TD-131: Canvas layout deduplication
- TD-120: Session types decomposition

### Out of Scope

- CI/CD pipeline (C58)
- Feature Lifecycle Hub (C58)
- CI/CD result ingestion
- Defect/bug tracking
- Visual regression / screenshot diffing
- Branching/conditional execution within journeys
- Inbox auto-routing (moved to C58)

## Increments

### Inc 0: Domain Core (PBI-TM-001)
**Theme**: Feature / Architecture
**Effort**: Large | **Est. LOC**: ~200 | **Est. Tests**: ~40

Build the Test Management domain foundation:
- `TestManagementService` with scan, parse, coverage, pyramid, and compliance methods
- `JourneyRegistryEntry`, `JourneyRunSummary`, `TestPyramidState`, `CoverageEntry`, `ComplianceTag` types
- `journeyParser.ts` — pure functions: parseJourneyFile, parseResultFile, toRegistryEntry, toRunSummary
- `pyramidCalculator.ts` — computePyramid, computeTrend
- `coverageCalculator.ts` — computeCoverage, computeDomainCoverage, findGaps
- `complianceChecker.ts` — checkCompliance, computeScore, getGaps
- `complianceDefinitions.ts` — ISO 9001 (6), 27001 (5), 25010 (8) characteristics
- `events.ts` — 9 management events defined
- Wire service start/stop in main.ts

**Test Intent**: Unit tests for all pure calculation functions (pyramidCalculator, coverageCalculator, complianceChecker, journeyParser). Domain service tested with mock file system and event bus. ~40 tests across 4-5 test files.

**Documentation Intent**: JSDoc on all public types. Update Data Dictionary with new entity types (JourneyRegistryEntry, TestPyramidState, CoverageEntry, ComplianceTag).

**Architecture Seams**: New `src/domain/testManagement/` domain folder. EventMap extension via `TestManagementEventMap`. Service lifecycle (start/stop) wired in main.ts. Pure functions isolated from service orchestration.

**Acceptance Criteria**:
- [ ] Service scans journey files and parses results
- [ ] Pure calculation functions tested with mock data
- [ ] ISO compliance definitions complete (19 characteristics)
- [ ] 9 events defined in EventMap
- [ ] `npm test` green

### Inc 1: Hub Shell + Dashboard (PBI-TM-002)
**Theme**: Feature / UI
**Effort**: Large | **Est. LOC**: ~250 | **Est. Tests**: ~30

Build the Hub view and dashboard landing:
- `TestManagementHubView extends BaseHubView<TestMgmtPage>` with 4 tabs
- Dashboard: 4 KPI stat cards (Total Journeys, Pass Rate, Coverage %, Compliance Score)
- Mini test pyramid visualization (E2E / Flow / Unit counts)
- "Recent Runs" section (last 10 results)
- "Needs Attention" section (failing, never-run, stale)
- Quick action buttons (Open Builder, View Gaps)
- `TestManagementHubProvider implements HubDashboardProvider`
- Register view type, ribbon icon (shield-check), command palette entry
- `css/19-test-management.css` — full styling layer
- Dual-mode detection: check for `node_modules/vitest` and test vault path

**Test Intent**: Hub view registration, dashboard rendering (KPI cards, mini pyramid, recent runs, needs attention). HubDashboardProvider tests. Dual-mode detection logic. ~30 tests: UI render + domain provider.

**Documentation Intent**: Create `css/19-test-management.css` layer. Component doc for TestManagementHubView. Update sitemap with new view.

**Architecture Seams**: 6th BaseHubView subclass. WorkspaceShell reuse. HubDashboardProvider interface. VIEW_TYPE constant + registerView in main.ts. CSS layer 19.

**Acceptance Criteria**:
- [ ] Hub opens from command palette, ribbon, and User Hub card
- [ ] Dashboard shows KPI cards with live data
- [ ] Mini pyramid renders
- [ ] User Hub "Test Health" card works
- [ ] Dual-mode detected correctly
- [ ] `npm test` green

### Inc 2: Journeys Tab (PBI-TM-003)
**Theme**: Feature / UI
**Effort**: Large | **Est. LOC**: ~300 | **Est. Tests**: ~25

Master/detail journey list:
- Master: journey list with name, chapter, type badge, status indicator, step count, last run date
- Filter bar: type, status (passing/failing/never-run/stale), domain, actor, compliance tag
- Search: fuzzy match on name/description
- Detail header: name, description, type, domain, chapter
- Detail "Run History" section: chronological runs with pass/fail/skip, duration, date
- Detail "Steps" section: step list with per-step status, expandable to show actions
- Detail "Traceability" section: PRD, events, commands, components, actors, services
- Detail "Improvements" section: items from journey JSON
- Detail "Review" section: Three Amigos link, TASM score
- Action bar: "Open in Builder", "Open Canvas", "Open JSON", "Request Review", "Run Journey"

**Test Intent**: Master list rendering with sort/filter. Detail panel sections (run history, steps, traceability). Filter bar logic. Search fuzzy matching. ~25 tests: UI render + filter logic.

**Documentation Intent**: Component doc for JourneysTab. Update Frontend Architecture doc with master/detail pattern usage.

**Architecture Seams**: Master/detail shared UI pattern (same as Analytics DashboardsTab). Filter bar as reusable component. Action bar callbacks via deps injection.

**Acceptance Criteria**:
- [ ] Master list shows all registered journeys
- [ ] Filters and search work
- [ ] Detail panel shows all sections
- [ ] "Open in Builder" navigates correctly
- [ ] `npm test` green

### Inc 3: Pyramid Visualization (PBI-TM-004)
**Theme**: Feature / UI
**Effort**: Medium | **Est. LOC**: ~150 | **Est. Tests**: ~20

Full test pyramid tab:
- 3-layer visualization: E2E (journeys), Flow (flow suites — Expert mode), Unit (vitest suites — Expert mode)
- Each layer: count, pass rate, trend indicator (↑ ↓ →)
- Click layer to expand (show individual suites/journeys)
- Stacked bar or layered triangle rendering
- Three Amigos badge overlay per layer
- Standard mode: E2E only at full fidelity; Flow/Unit as dimmed placeholders with guidance callout

**Test Intent**: Pyramid rendering (3-layer proportions, counts, pass rates). Trend indicator computation. Layer drill-down expand/collapse. Standard vs Expert mode display. ~20 tests: UI render + calculation logic.

**Documentation Intent**: Component doc for PyramidTab. Document dual-mode behavior (Standard: E2E only; Expert: all layers).

**Architecture Seams**: pyramidCalculator.ts (pure) drives UI. Dual-mode flag from service. Drill-down uses existing accordion/expand pattern.

**Acceptance Criteria**:
- [ ] Pyramid renders with correct proportions
- [ ] Layer drill-down works
- [ ] Trend indicators compute from baseline
- [ ] Standard mode shows guidance for missing layers
- [ ] `npm test` green

### Inc 4: Coverage Matrix (PBI-TM-005)
**Theme**: Feature / UI
**Effort**: Medium | **Est. LOC**: ~200 | **Est. Tests**: ~25

PRD-to-journey coverage tab:
- Rows = PRD features (from `docs/features/*/`), columns = coverage status
- Each PRD: name, stage, linked journeys count, coverage indicator (green/yellow/red)
- Journey-to-PRD linking: `domain` match + optional `prd` field
- Acceptance criteria sub-view (manual tag linking)
- Domain coverage summary (pie chart or stacked bar)
- "Gaps" view: in-progress/done PRDs with zero journeys
- Actor and service coverage views

**Test Intent**: Coverage matrix rendering (PRD rows, indicators). Gap analysis computation. Domain/actor/service coverage aggregation. coverageCalculator pure function tests. ~25 tests: UI render + calculation logic.

**Documentation Intent**: Component doc for CoverageTab. Document PRD-to-journey linking strategy (domain match + explicit `prd` field).

**Architecture Seams**: coverageCalculator.ts (pure) drives UI. PRD discovery via file system scan of `docs/features/`. Journey-PRD linking via domain matching + optional explicit field.

**Acceptance Criteria**:
- [ ] Matrix renders with coverage indicators
- [ ] Gap analysis highlights uncovered PRDs
- [ ] Domain coverage visualization works
- [ ] `npm test` green

### Inc 5: Compliance Tagging (PBI-TM-006)
**Theme**: Feature / UI
**Effort**: Medium | **Est. LOC**: ~200 | **Est. Tests**: ~20

ISO compliance tab:
- Accordion sections: ISO 9001, 27001, 25010
- Each characteristic: tagged journey count, coverage status
- Compliance score per standard (% of characteristics covered)
- Gap analysis: uncovered characteristics with guidance callouts
- "Guidance" callouts per characteristic (what it means, how to address)
- Tag management: add/remove compliance tags on journeys (stored in TypedStorage)
- Report export: markdown compliance summary as vault note

**Test Intent**: Compliance accordion rendering. Score computation per standard. Tag management CRUD (add/remove persists to TypedStorage). Report export markdown format. complianceChecker pure function tests. ~20 tests: UI render + calculation + persistence.

**Documentation Intent**: Component doc for ComplianceTab. Document ISO characteristic definitions and guidance text. ADR if compliance storage model warrants it.

**Architecture Seams**: complianceDefinitions.ts (static data). complianceChecker.ts (pure). Tag storage via TypedStorage (extends existing data.json schema). Report export as pure markdown generator.

**Acceptance Criteria**:
- [ ] All 19 characteristics rendered with guidance
- [ ] Compliance scores compute correctly
- [ ] Tag management persists
- [ ] Report export produces valid markdown
- [ ] `npm test` green

### Inc 6: Journey Builder Integration (PBI-TM-007)
**Theme**: Integration
**Effort**: Small | **Est. LOC**: ~100 | **Est. Tests**: ~15

Wire the Hub to the Journey Builder:
- Auto-register: `journey-builder.exported` → scan and register journey
- "Open in Builder": navigate from Hub detail to Journey Builder sidebar with journey loaded
- "Run Journey" from Builder: execute current journey after export
- "Open in Test Hub" from Builder: navigate from Builder to Hub with journey selected
- Cross-hub navigation via `hub.navigate` events
- Request review: create Three Amigos review document from template

**Test Intent**: Event-driven auto-registration on export. Cross-hub navigation (Builder→Hub, Hub→Builder). Review document creation from template. ~15 tests: integration wiring + navigation.

**Documentation Intent**: Update Journey Builder PRD with integration points. Document cross-hub navigation flow.

**Architecture Seams**: Event listener on `journey-builder.exported`. hub.navigate events for cross-hub nav. Template-based review doc creation via FileSystemClient.

**Acceptance Criteria**:
- [ ] Export triggers auto-registration
- [ ] Cross-hub navigation works both ways
- [ ] Review creation works
- [ ] `npm test` green

### Inc 7: Journey Executor (PBI-TM-008)
**Theme**: Feature / Architecture
**Effort**: X-Large | **Est. LOC**: ~400 | **Est. Tests**: ~50

Build the in-app journey execution engine:
- `JourneyExecutorService` with run(), cancel(), isRunning(), getExecutionState(), validateJourney()
- Implement all 34 tools via Obsidian plugin API:
  - Interaction: command, click, input, set-input, highlight, wait, navigate, ribbon, scroll-to, select
  - Assertion: assert (8 types), assert-text, assert-number, assert-value
  - Lifecycle: create-file, delete-file, copy-file, move-file, open-file, open-url, close-leaves, close-modals, seed
  - Feedback: screenshot, notice, theme, manual, visual-inspection, spinner, write-run-log
  - Data: emit, eval, frontmatter, query-trace
- `{{variable}}` interpolation (cross-step data passing)
- Vault targeting: user vault (default, always available) or test vault (Expert mode, via CLI bridge)
- Graceful cancellation (current action completes, remaining steps skipped)
- Dry-run mode (validate without executing)
- 4 execution events: run.started, run.step-completed, run.completed, run.failed
- Vault-modifying tools (create/delete/move file, seed) require confirmation when running on user vault

**Test Intent**: Per-tool execution (34 tool unit tests). Variable interpolation. Cancellation state machine. Dry-run mode (no side effects). Vault targeting logic. ~50 tests: unit per tool + integration for orchestration.

**Documentation Intent**: Component doc for JourneyExecutorService. Document tool parity between CLI and in-app executor. ADR-033 for executor architecture decisions.

**Architecture Seams**: New `src/domain/journeyExecutor/` domain folder. ToolExecutor interface per tool (strategy pattern). Vault targeting adapter (user vault via plugin API, test vault via CLI bridge). Cancellation via AbortController pattern. 4 execution events extend EventMap.

**Acceptance Criteria**:
- [ ] All 34 tools execute correctly via plugin API
- [ ] Variable interpolation works across steps
- [ ] Cancellation is graceful (<2s)
- [ ] Dry-run validates without side effects
- [ ] User vault confirmation dialogs for destructive tools
- [ ] Expert mode: test vault targeting works
- [ ] `npm test` green

### Inc 8: Execution UI (PBI-TM-009)
**Theme**: Feature / UI
**Effort**: Medium | **Est. LOC**: ~200 | **Est. Tests**: ~20

Build the execution user interface:
- Live progress panel (sidebar or modal): current step, N of M, action status, elapsed time, assertion failures
- Canvas highlighting: active step index during execution, green=pass, red=fail
- Manual step handling: pause + dialog for `manual` and `visual-inspection` tools
- Result writing: JourneyResult artifact after completion
- Report generation: markdown document from run results (user manual / workflow showcase)
- Command registration: `flowti:run-journey` with file picker
- "Run Journey" button wired in Hub detail panel and Builder sidebar

**Test Intent**: Progress panel rendering (step progress, action status, timing). Canvas highlighting via canvasSync stepColors. Manual step dialog. Result writing. Report markdown generation. ~20 tests: UI render + report generator.

**Documentation Intent**: Component doc for ExecutionProgressPanel. Document manual step UX flow.

**Architecture Seams**: Progress panel as standalone UI component (deps injection). Canvas highlighting reuses existing canvasSync stepColors API. Report generation as pure function (JourneyResult → markdown). Command registration in main.ts.

**Acceptance Criteria**:
- [ ] Progress panel updates in real-time
- [ ] Canvas highlights active step
- [ ] Manual steps pause and prompt
- [ ] Results written and Hub updates
- [ ] Report generation produces markdown
- [ ] `flowti:run-journey` works from command palette
- [ ] `npm test` green

### Inc 9: Session v2 + View State + Infrastructure
**Theme**: Feature / Debt
**Effort**: Medium | **Est. LOC**: ~300 | **Est. Tests**: ~50

Complete Session v2 and infrastructure items:
- Session auto-documentation: auto-link files created during sessions as artifacts
- Session template management: create/edit/delete session templates
- TD-45: View state persistence — save active tab to TypedStorage, restore on view open
- RB-1: Installer JSON config externalization (versioned schema)
- TD-131: Extract shared canvas layout constants to `src/domain/canvas/journeyLayout.ts`
- TD-120: Extract session/types.ts Zod schemas → session/schemas.ts

**Test Intent**: Session auto-documentation (file linking). View state persistence (save/restore tab). Installer JSON config parsing. Canvas layout constant deduplication. Session schema extraction. ~50 tests spread across 5 sub-features.

**Documentation Intent**: Update Session domain docs. Update Installer docs. ADR for installer config schema if needed.

**Architecture Seams**: TypedStorage extension for view state. Installer config schema (JSON file in vault). Canvas layout constants extracted to shared module. Session Zod schemas extracted to separate file.

**Acceptance Criteria**:
- [ ] Sessions auto-link created files
- [ ] Hub views remember last tab after reload
- [ ] Installer reads folder config from JSON
- [ ] Canvas layout constants shared
- [ ] Session types decomposed
- [ ] `npm test` green

### Inc 10: Quality Gate + Debt Closure
**Theme**: Quality / Debt
**Effort**: Small | **Est. LOC**: ~50 | **Est. Tests**: ~10

Close remaining debt and set baselines:
- TD-58: Define performance baseline thresholds (wildcard >100/sec, folder scan >500 entities, CSV >10K rows)
- TD-93: Document ADR-032 acceptance, close as accepted
- Verify ISO compliance characteristic definitions with team
- Document test pyramid data sourcing strategy

**Test Intent**: Performance baseline threshold assertions. Verify existing tests still pass after debt closure. ~10 tests: baseline validation.

**Documentation Intent**: Close TD-58, TD-93 debt items. Document performance baselines in PerfAggregator config. Document pyramid data sourcing strategy.

**Architecture Seams**: Performance thresholds as configuration constants. ADR-032 acceptance documented. No new domain boundaries.

**Acceptance Criteria**:
- [ ] Performance baselines documented
- [ ] TD-93, TD-58 closed
- [ ] ISO definitions reviewed
- [ ] `npm test` green

### Inc 11: E2E Journey + Final Polish (PBI-TM-010)
**Theme**: Quality / E2E
**Effort**: Medium | **Est. LOC**: ~200 | **Est. Tests**: ~15

End-to-end validation:
- E2E journey: Test Management Hub (open Hub, navigate tabs, verify dashboard data, drill into journey, check traceability)
- E2E journey: Journey Executor (create journey, run it, verify progress panel, check results)
- Component docs for all new Hub components
- Sitemap update for Test Management Hub
- Update Data Dictionary with new entity fields
- CSS polish pass from E2E screenshots

**Test Intent**: 2 E2E journey definitions (Hub walkthrough, Executor walkthrough). Flow-level regression suite for Test Management domain. ~15 tests: E2E + flow.

**Documentation Intent**: Component docs for all new Hub components. Sitemap update. Data Dictionary update with new entity types. CSS polish pass.

**Architecture Seams**: E2E journeys follow existing journey definition format. Flow tests follow established patterns (tests/flows/). Report generation reuses existing scripts.

**Acceptance Criteria**:
- [ ] E2E Hub journey passes
- [ ] E2E Executor journey passes
- [ ] Component docs created
- [ ] Data Dictionary updated
- [ ] `npm run build` green

## Inbox Signals Reviewed

| Inbox Item | Stage | Disposition |
|------------|-------|-------------|
| In order to publish, we first must establish an automated e-2-e test-suite | planned (C53) | **Already delivered** — E2E harness shipped in C53, expanded in C54. C57 adds 2 new E2E journeys (Inc 11). |
| Ingest build reports, test reports, and coverage as vault notes | promoted | **Partially addressed** — Test Management Hub (Inc 1-5) consumes existing reports. Full ingestion pipeline deferred to C58. |
| Session auto-documentation links artifacts on file events | discovery | **In scope** — Inc 9 delivers session auto-documentation. Stage will move to `planned`. |
| I want to manage and maintain my Session Templates | promoted | **In scope** — Inc 9 delivers session template management. Stage will move to `planned`. |
| I want the installer to use a versioned JSON folder config | planned | **In scope** — Inc 9 addresses RB-1 installer config externalization. |
| We need to include generated reports into reviews | discovery | **Deferred** — related to CI/CD pipeline (C58 scope). |
| Documentation must be built from source | discovery | **Deferred** — documentation pipeline already generates from source; further automation is C58+. |
| I want to trigger a process from within a Canvas document | discovery | **Deferred** — canvas process triggers are out of scope for C57. |
| How can we measure performance and impact | partially-delivered (C52) | **Not in scope** — C52 delivered PerfAggregator + perf events. UI dashboard deferred beyond C57. |
| I want to ingest a test-report, coverage-report, PRDs | discovery | **Deferred** — ingestion pipeline is C58+ scope. Hub reads existing parsed data. |

## Dependency Graph

```
Inc 0 (Domain Core)
  │
  ├── Inc 1 (Hub Shell + Dashboard)
  │     │
  │     ├── Inc 2 (Journeys Tab)        ┐
  │     ├── Inc 3 (Pyramid)              ├── parallel after Inc 1
  │     ├── Inc 4 (Coverage)             │
  │     └── Inc 5 (Compliance)           ┘
  │           │
  ├── Inc 7 (Journey Executor)    ───────┤
  │     │                                 │
  │     └── Inc 8 (Execution UI)  ───────┤
  │                                       │
  └── Inc 6 (JB Integration)     ────────┴── Inc 11 (E2E)

Inc 9 (Session + Infra) ──→ Independent (parallel with Inc 2–8)
Inc 10 (Debt Closure)   ──→ Independent (parallel)
```

**Parallelizable**: Inc 2–5 (Hub tabs) can be developed in parallel after Inc 1. Inc 9 (Session/Infra) and Inc 10 (Debt) are independent of the Test Management track.

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Journey result file format changes break parsing | High | Defensive parsing with fallback defaults; version-check result schema |
| PRD-to-journey linking via `domain` is too coarse | Medium | Support explicit `prd` field; domain match is the default heuristic |
| Compliance tagging feels like busywork | Medium | Pre-populate common tags; actionable guidance callouts; entirely optional |
| Pyramid data stale (vitest results not auto-imported) | Low | Show last known counts; "Refresh" triggers re-scan |
| In-app executor breaks user vault with destructive actions | High | Confirmation dialogs for vault-modifying tools; dry-run mode first |
| Tool parity drift between CLI and in-app executor | Medium | Share tool definitions; extract common logic to shared module |
| Execution blocks UI thread | High | setTimeout/requestAnimationFrame yielding; Web Workers for evals |
| Cycle is too large (12 increments, 10 PBIs + session + debt) | Medium | Inc 2–5 parallelizable; Inc 9–10 independent; cut scope from Hub tabs if needed |
| Hub becomes 6th view type — tab fatigue | Low | Clear shield-check icon; User Hub card as primary entry |

## Success Metrics

| Metric | Target |
|--------|--------|
| New tests | ~335 (285 TM + 30 session + 20 installer) |
| Post-cycle tests | ~7,129+ |
| New suites | ~15 |
| Source LOC | ~2,700 (2,350 TM + 350 session/infra) |
| PBIs delivered | 10 TM + Session + TD-45 |
| Hub Views | 6 (+ Test Management) |
| TD items addressed | 5 (TD-45, TD-58, TD-93, TD-131, TD-120) |
| Release blockers closed | 1 (RB-1) |
| E2E Journeys | 9+ (7 existing + 2 new) |
| ISO characteristics defined | 19 (6 + 5 + 8) |
| Dual-mode tested | Standard + Expert |
| Increments | ~12 |

## Execution Log

### Inc 0: Domain Core (PBI-TM-001) — DONE
**Date**: 2026-03-06 | **Tests**: 6,869 (288 suites) | **New**: +75 tests, +4 suites

Delivered:
- `TestManagementService` (184 LOC) — lifecycle, register/deregister, run results, compliance tags
- `journeyParser.ts` — parseJourneyDefinition, parseJourneyResult, deriveJourneyStatus, extractTools
- `pyramidCalculator.ts` — computePyramid (assigns journeys to E2E layer)
- `coverageCalculator.ts` — computeCoverage, domain-matching + explicit PRD field
- `complianceChecker.ts` — checkCompliance against 19 ISO characteristics
- `complianceDefinitions.ts` — ISO 9001 (6), 27001 (5), 25010 (8) characteristics
- `events.ts` — 9 domain events in TestManagementEventMap
- `types.ts` — JourneyRegistryEntry, JourneyRunSummary, TestPyramidState, CoverageEntry, ComplianceScore
- Service wired in registry.ts and main.ts

### Inc 1: Hub Shell + Dashboard (PBI-TM-002) — DONE
**Date**: 2026-03-06 | **Tests**: 6,911 (292 suites) | **New**: +42 tests, +3 suites

Delivered:
- `TestManagementHubView extends BaseHubView<TestMgmtPage>` — 4 tabs (journeys, pyramid, coverage, compliance)
- `TestManagementDashboard` — KPI stat cards (journeys, passing, pass rate, compliance %), mini pyramid, recent runs, needs attention
- `TestManagementHubProvider implements HubDashboardProvider` — stats, healthLevel, actionItemCount
- `css/19-test-management.css` — full styling layer (pyramid bars, status badges, run items, tab placeholder)
- View registration, ribbon icon (shield-check), command `flowti:open-test-management-hub`
- `ui.openTestManagementHub` event + UiCommandService handler
- Event catalog entry, command registry entry, UserHub domain label/icon

### Inc 2: Journeys Tab (PBI-TM-003) — DONE
**Date**: 2026-03-06 | **Tests**: 6,950 (293 suites) | **New**: +39 tests, +1 suite

Delivered:
- `JourneysTab` (270 LOC) — master/detail renderer with filters, search, selection
- Master list: journey rows with status badge, name, type badge, step count, last run date
- Detail panel: header (name, status, type, domain, chapter, steps), run history (sorted newest first), traceability (PRD, actors, services, tools, compliance chips), file links (JSON, canvas, test source)
- Filtering: text search (name + domain), type filter dropdown, status filter dropdown
- Selection: click-to-select, auto-select first, preserved across re-renders, resetSelection on tab switch
- Empty state when no journeys or all filtered out
- Top bar filter dropdowns wired in HubView (journeys tab only)
- **Scan-on-load**: `TestManagementService.setScanner()` + vault scanner callback in main.ts — automatically discovers and registers journey JSON files from the configured journey folder on startup. Preserves run history and compliance tags for existing entries. Non-fatal on failure.

### Inc 3: Pyramid Visualization (PBI-TM-004) — DONE
**Date**: 2026-03-06 | **Tests**: 6,967 (294 suites) | **New**: +17 tests, +1 suite

Delivered:
- `PyramidTab` (200 LOC) — 3-layer pyramid visualization with drill-down
- Master panel: layer cards (E2E, Flow, Unit) with icon, label, count, pass rate, progress bar, trend indicator (↑/↓/→), click-to-select, Flow/Unit dimmed in Standard mode
- Detail panel: E2E drill-down (journey list with status badge, name, type, pass/fail stats, filtered by search), Flow/Unit guidance callout ("Expert mode" message)
- "Set baseline" button — calls `service.setBaseline()`, re-renders with trend comparison
- `TestManagementService` additions: `setBaseline()`, `getBaseline()`, `getPyramidWithTrends()` — wires `applyTrends()` from pyramidCalculator
- CSS additions: pyramid cards, trend indicators, drill-down rows, guidance callout, footer
- Empty state when no journeys registered

### Inc 4: Coverage Matrix (PBI-TM-005) — DONE
**Date**: 2026-03-06 | **Tests**: 6,991 (295 suites) | **New**: +24 tests, +1 suite

Delivered:
- `CoverageTab` (230 LOC) — PRD-to-journey coverage matrix with master/detail split
- Master panel: PRD rows with coverage status badge (green/yellow/red), name, stage badge, journey count, text search filtering
- Detail panel: PRD header (name, status, stage, domain, count), linked journeys section, domain coverage summary with mini progress bars, coverage gaps section
- `TestManagementService` additions: `setPrdScanner()`, `getPrds()`, `scanVaultPrds()` — in-memory PRD discovery following journey scanner pattern
- PRD scanner wired in main.ts: reads `docs/features/*/` frontmatter via `metadataCache`, filters by `type: ProductRequirementsDocument`
- CSS additions: coverage badges, PRD rows, domain summary bars, gap rows
- Empty state when no PRDs found
- Reuses existing pure functions: `computeCoverage()`, `computeDomainCoverage()`, `findGaps()`

### Inc 5: Compliance Tagging (PBI-TM-006) — DONE
**Date**: 2026-03-06 | **Tests**: 7,010 (296 suites) | **New**: +19 tests, +1 suite

Delivered:
- `ComplianceTab` (250 LOC) — ISO compliance visualization with tag management
- Master panel: 3 standard cards (ISO 9001, 27001, 25010) with score, percentage, progress bar, click-to-select
- Detail panel: characteristic list for selected standard with covered/uncovered badges, expandable rows (description + guidance), search filtering
- Tag management: "Tag journey" button for uncovered characteristics → journey list → `addComplianceTag()`. Remove "×" buttons on tagged journeys → `removeComplianceTag()`
- All 4 tabs now fully implemented — placeholder branch removed from `onTabRender()`
- Cleaned up unused `setIcon` import and `getTabLabel` helper from HubView
- CSS additions: compliance cards, characteristic rows, guidance callouts, tag management styles, journey picker

## Definition of Done

- [ ] `TestManagementService` implemented with scan, parse, coverage, pyramid, compliance
- [ ] `TestManagementHubView` extends `BaseHubView` with Dashboard + 4 tabs
- [ ] `TestManagementHubProvider` registered, visible on User Hub
- [ ] 13 domain events defined and wired (9 management + 4 execution)
- [ ] Pure calculation functions implemented and tested
- [ ] ISO compliance definitions shipped (9001, 27001, 25010)
- [ ] Journey Builder integration: auto-register, cross-hub nav, "Run" from Builder
- [ ] `JourneyExecutorService` with 34-tool vocabulary, vault targeting, cancellation, dry-run
- [ ] Live progress panel, canvas highlighting, report generation
- [ ] `flowti:run-journey` command registered
- [ ] Dual-mode detection (Standard vs Expert) works correctly
- [ ] Session v2 finalized (auto-docs, templates)
- [ ] View state persisted (TD-45)
- [ ] Installer config externalized (RB-1)
- [ ] CSS layer `19-test-management.css` created
- [ ] Component docs, sitemap, Data Dictionary updated
- [ ] 2 E2E journeys pass (Hub + Executor)
- [ ] `npm run build` green
- [ ] Three Amigos review completed
