---
domain: Flowti
plugin: "[[Development/flowti/README|README]]"
type: ProductRequirementsDocument
stage: in-progress
version: "2.0"
created: 2026-03-05
updated: 2026-03-05
maturity: L1
related_events:
  - test-mgmt.journey.registered
  - test-mgmt.journey.deregistered
  - test-mgmt.journey.status-changed
  - test-mgmt.journey.run-completed
  - test-mgmt.coverage.computed
  - test-mgmt.compliance.checked
  - test-mgmt.pyramid.updated
  - test-mgmt.review.requested
  - test-mgmt.hub.loaded
  - test-mgmt.run.started
  - test-mgmt.run.step-completed
  - test-mgmt.run.completed
  - test-mgmt.run.failed
  - journey-builder.exported
  - journey-builder.imported
  - hub.opened
  - hub.closed
  - hub.tab.changed
  - hub.navigate
maturity_score_strategy: 4
maturity_score_scope: 4
maturity_score_architecture: 3
maturity_score_event_integration: 3
maturity_score_data_model: 3
maturity_score_ui_consistency: 2
maturity_score_validation_testing: 1
business_value: 5
implementation_cost: 4
maintenance_cost: 3
discovery_cost: 2
design_cost: 4
test_cost: 3
priority: 4
tags:
  - test-management
  - quality
  - journey
  - hub
  - compliance
---

# Feature: Test Management Hub

> Supersedes v1.0 (idea-stage test-case tracker). Repositioned as a Journey-centric quality management Hub.

---

## 1. Problem Statement

Teams design solutions as PRDs, build journeys in the Journey Builder, and run E2E tests via the Journey Runner. After a journey is created and exported, there is no central place to:

- **See test status** — which journeys pass, fail, or have never been run
- **Track evolution** — how journeys grow with improvements over time
- **Link back to PRDs** — which PRD use cases are covered by which journeys
- **Monitor the test pyramid** — balance between E2E, integration, and unit tests
- **Assess compliance readiness** — whether journeys address ISO 9001, 27001, or 25010 quality characteristics
- **Execute journeys on the user vault** — run a journey's automated test actions directly against the user's own vault, not just a separate test vault via CLI

**Who is affected?** Product teams, developers, and QA leads who need a single view of quality across the product lifecycle — from requirements through verification.

**What breaks?** Journeys are "fire and forget" — authored, run, results generated, but never managed. Execution is locked to the CLI and a separate test vault. Teams cannot answer: "Which PRD use cases are tested?", "What's the test health of this domain?", "Are we ISO 25010 compliant?", "Who reviewed this journey?", or "Does this journey pass on my actual vault?"

**Why it matters:** The Journey Builder → Journey Runner pipeline produces rich test artifacts (JSON definitions, canvases, screenshots, event traces, step results). Without a management layer, these artifacts accumulate without context. Without in-app execution, the only way to run a journey is via the CLI on a dedicated test vault — creating a disconnect between what was designed and what was verified. The Test Management Hub closes both gaps: it provides a quality cockpit that reads existing artifacts, surfaces actionable insights, and lets users **execute Flowti Journeys directly on their vault** using the same 34-tool vocabulary available in the CLI.

---

## 2. Outcome

- **User can** open the Test Management Hub and see all registered journeys with their latest run status, coverage by PRD/domain, and compliance tags.
- **User can** drill into any journey to see step-level results, run history, linked PRD use case, improvements backlog, and Three Amigos review status.
- **User can** view the test pyramid visualization showing E2E journeys at the top, flow integration suites in the middle, and unit test suites at the bottom — with counts and health indicators at each level.
- **User can** tag journeys with ISO compliance categories (9001 quality management, 27001 information security, 25010 software quality characteristics) and see coverage gaps per standard.
- **User can** request a Three Amigos review for a journey, and see the TASM score reflected in the Hub.
- **User can** execute a Flowti Journey directly from the Hub or the Journey Builder, running it against the current vault with real-time step-by-step progress, the same 34 tools that the CLI uses (command, click, assert, emit, screenshot, etc.), and results written back as journey result artifacts.
- **User can** execute a journey from the command line via `flowti:run-journey` with the same toolset, enabling headless/scripted execution.
- **System can** scan journey files, parse run results, compute coverage metrics, and emit events for cross-hub consumption.

---

## 3. Envisioned Workflow

This section documents the end-to-end workflow that the Test Management Hub enables:

### 3.1 Solution Design Phase

1. **Product Team** documents personas and jobs-to-be-done as structured markdown files in the vault.
2. Team starts a **PRD Canvas Session** to brainstorm and collect first solutions, formulated as shallow **Use Case 2.0** descriptions.
3. Team enriches the PRD with **user stories**, **issues**, **risks**, **assumptions**, and **acceptance criteria** — all as markdown within the PRD note.

### 3.2 Journey Design Phase

4. When the team is satisfied with the PRD, they select a **use case** they want to design as a testable journey.
5. Selecting a use case either **creates a new Journey** or **opens an existing one** in the **Journey Builder** sidebar.
6. The team designs the journey **step by step** — defining actions, assertions, events, and UI context for each step.
7. **Ideally**, the entire team (Product, Engineering, QA — the **Three Amigos**) participates in journey design, defining tests *during* the design process rather than after.

### 3.3 Test Management Phase

8. Once a journey is **exported** from the Journey Builder, it is **automatically registered** in the Test Management Hub via the `journey-builder.exported` event.
9. The Hub shows the journey's **status and metrics** — pass rate, step coverage, last run date, linked PRD, compliance tags.
10. Team members can **work on test actions** for journey steps directly from the Hub by clicking "Open in Builder" to navigate back to the Journey Builder.
11. As journeys evolve, the team adds **Improvements** (tracked in the journey JSON and visible in the Hub's detail panel).

### 3.4 Quality Assurance Phase

12. The team can **request a Three Amigos review** for a journey from the Hub. The review document is created from a template and linked to the journey.
13. The Hub's **Compliance tab** allows the team to tag journeys with ISO compliance characteristics — not as enforcement, but as **guidance toward compliance**.
14. The **Coverage tab** reveals gaps: PRD features without journeys, domains without E2E coverage, actors or services never exercised.
15. The **Pyramid tab** ensures the test suite maintains a healthy balance across E2E, integration, and unit test layers.

### 3.5 Journey Execution Phase

19. The user selects a journey and clicks **"Run Journey"** from the Hub detail panel or the Journey Builder.
20. The **Flowti Journey Executor** runs the journey **step by step against the user's own vault** — not a test vault. Each step executes its actions (commands, clicks, assertions, screenshots) using the same 34-tool vocabulary available in the E2E CLI runner.
21. During execution, a **live progress panel** shows the current step, action-by-action status, and any assertion failures. The companion canvas highlights the active step.
22. After completion, results are written as a **journey result artifact** (JSON), and the Hub's run history and dashboard KPIs update immediately.
23. The same execution capability is available via the **command palette** (`flowti:run-journey`) for quick access, and from the **CLI** for scripted/headless execution.
24. The **Flowti Journey** is a first-class concept: a portable test definition that produces identical results whether executed from the UI, the command palette, or the CLI. The toolset is unified — one journey definition, one executor, multiple entry points.

### 3.6 Continuous Improvement

16. After each test run, results flow back to the Hub automatically (parsed from result JSON files).
17. The "Needs Attention" dashboard section surfaces failing or stale journeys for immediate action.
18. Compliance scores and coverage metrics guide the team toward their quality targets without rigid enforcement.

---

## 4. Scope

### In Scope

- **Flowti Journeys** — a first-class concept: portable journey definitions (`.journey` JSON) that can be created in the Journey Builder and executed against any vault. Journeys serve three purposes: **automated testing**, **vault automation**, and **living documentation / user manuals**.
- **Journey Executor** — in-app journey execution engine that runs journey steps against the user's current vault using the same 34-tool vocabulary as the CLI E2E runner. Available from: Hub UI ("Run Journey" button), command palette (`flowti:run-journey`), and CLI (headless/scripted mode).
- Test Management Hub — 6th `BaseHubView` subclass with 5 areas: Dashboard, Journeys, Pyramid, Coverage, Compliance
- Journey Registry — scan `.journey` files from the configured journey folder and parse their definitions
- Run History — parse existing `JourneyResult` artifacts (JSON files) to show pass/fail/skip trends per journey
- PRD-to-Journey Traceability — link journeys to PRD features via domain metadata and optional explicit `prd` field
- Test Pyramid Visualization — aggregate E2E journeys, flow integration suites, and unit test suites into a layered view
- ISO Compliance Tagging — advisory tags (not enforcement) for ISO 9001, 27001, and 25010 quality characteristics
- Three Amigos Integration — request reviews from the Hub, display TASM scores and review status
- Journey Builder Integration — auto-register on export, "Open in Builder" navigation, "Run Journey" from Builder, cross-hub linking
- HubDashboardProvider — "Test Health" summary card on the User Hub dashboard

### Out of Scope (v1)

- CI/CD result ingestion (deferred to CI pipeline cycle)
- Defect/bug tracking (separate concern — consider Inbox domain)
- Visual regression / screenshot diffing
- Standalone TestCaseDoc document type — journeys ARE the test cases
- Performance/load testing management
- Custom test case creation outside of journeys
- Branching/conditional execution within journeys (linear step execution only in v1)

---

## 5. UX Entry Points

| Entry Point | Action |
|-------------|--------|
| **Command palette** | `flowti:open-test-management-hub` opens the Hub |
| **Command palette** | `flowti:run-journey` opens a file picker to select and execute a journey on the current vault |
| **Ribbon icon** | Shield-check icon opens the Hub |
| **User Hub dashboard** | "Test Health" summary card with pass rate and coverage %, click navigates to Test Hub |
| **Journey Builder export** | After export, "Open in Test Hub" and "Run Journey" actions available |
| **Journey Builder sidebar** | "Run" button executes the current journey on the user vault |
| **Test Management Hub** | "Run Journey" button in journey detail panel |
| **Event Catalog** | "Quality" stat card navigating to Test Hub dashboard |

---

## 6. Functional Requirements

### Dashboard (FR-01 – FR-07)

- [ ] **FR-01**: Dashboard displays 4 KPI stat cards: Total Journeys, Pass Rate (last run, %), Coverage (journeys vs PRD features, %), Compliance Score (average across standards, %)
- [ ] **FR-02**: Dashboard shows a mini test pyramid visualization with layer counts (E2E / Flow / Unit) and pass rate per layer
- [ ] **FR-03**: "Recent Runs" section lists the last 10 journey run results with journey name, status badge (pass/fail/mixed), step counts, and run date
- [ ] **FR-04**: "Needs Attention" section lists journeys that are failing, have never been run, or have stale results (>30 days since last run)
- [ ] **FR-05**: Domain coverage heatmap shows which domains have E2E journey coverage and which do not
- [ ] **FR-06**: Quick action buttons: "Open Journey Builder" (creates new), "Run Test Suite" (command link to npm), "View Coverage Gaps"
- [ ] **FR-07**: Dashboard stats are exposed via `HubDashboardProvider` for the User Hub "Test Health" card

### Journeys Tab (FR-08 – FR-19)

- [ ] **FR-08**: Master panel lists all registered journeys with: name, chapter number, type badge (functional/regression/smoke/exploratory/blueprint/integration), last run status indicator (green/red/yellow/gray), step count, last run date
- [ ] **FR-09**: Filter bar supports filtering by: journey type, run status (passing/failing/never-run/stale), domain, actor, compliance tag
- [ ] **FR-10**: Search input filters journeys by name or description (fuzzy match)
- [ ] **FR-11**: Detail panel header shows: journey name, description, type badge, domain badge, chapter number
- [ ] **FR-12**: Detail panel "Run History" section displays a chronological list of runs with pass/fail/skip counts, duration, and date. Most recent run first.
- [ ] **FR-13**: Detail panel "Steps" section shows the step list with per-step last run status (green=pass, red=fail, yellow=skip, gray=never-run). Steps are expandable to show actions.
- [ ] **FR-14**: Detail panel "Traceability" section shows: linked PRD feature (clickable), linked events (aggregated from all steps), linked commands, linked UI components, linked actors and services
- [ ] **FR-15**: Detail panel "Improvements" section lists improvement items from the journey JSON with priority badges and descriptions
- [ ] **FR-16**: Detail panel "Review" section shows: linked Three Amigos review document (if any), TASM score, review date, reviewer names
- [ ] **FR-17**: Detail panel actions bar: "Open in Builder" (loads journey in Journey Builder sidebar), "Open Canvas" (opens companion canvas), "Open JSON" (opens raw JSON), "Request Review" (creates review from template)
- [ ] **FR-18**: Journey auto-registration: when `journey-builder.exported` fires, the service scans and registers the new journey automatically
- [ ] **FR-19**: Journey run status is derived from the latest result JSON file — not stored separately. Status updates when result files change.

### Pyramid Tab (FR-20 – FR-25)

> **Dual-mode note**: In **Standard mode** (Obsidian only), the Pyramid tab shows the E2E layer (journey counts and pass rates from result files) and placeholder indicators for Flow and Unit layers with a guidance callout: _"Install vitest to see full pyramid data."_ In **Expert mode** (vitest detected), all three layers are fully populated from test reports.

- [ ] **FR-20**: Full test pyramid visualization with 3 layers: E2E (journey count), Flow Integration (flow test suite count — **Expert mode**), Unit (vitest suite count minus flow suites — **Expert mode**)
- [ ] **FR-21**: Each layer shows: count of tests/suites, pass rate (%), trend indicator (improving/declining/stable based on last 3 data points). Flow and Unit trend data requires **Expert mode**.
- [ ] **FR-22**: Clicking a pyramid layer expands to show the list of suites or journeys in that layer with individual pass/fail status. In Standard mode, only the E2E layer is expandable.
- [ ] **FR-23**: Pyramid data sourced from: E2E = parsed journey result files (both modes), Flow = `tests/flows/` suite count from last test report (**Expert mode**), Unit = total vitest suites minus flow suites from last test report (**Expert mode**)
- [ ] **FR-24**: Pyramid proportions rendered as a stacked bar or layered triangle with E2E at top (narrowest) and Unit at bottom (widest). In Standard mode, only the E2E layer is rendered at full fidelity; Flow and Unit show as dimmed placeholders.
- [ ] **FR-25**: Three Amigos badge overlay indicates which pyramid layers have been covered by a Three Amigos review

### Coverage Tab (FR-26 – FR-33)

- [ ] **FR-26**: Coverage matrix with rows = PRD features (scanned from `docs/features/*/`), columns = journey coverage status
- [ ] **FR-27**: Each PRD row shows: feature name, PRD stage (idea/draft/approved/in-progress/done/delivered), number of linked journeys, coverage indicator (covered = green, partial = yellow, uncovered = red)
- [ ] **FR-28**: Journey-to-PRD linking via: (1) `domain` field match between journey definition and PRD domain, (2) optional explicit `prd` field in journey JSON for precise linking
- [ ] **FR-29**: Acceptance criteria sub-view: if a PRD has acceptance criteria, show which are addressed by journey assertions (manual linking via tags)
- [ ] **FR-30**: Domain coverage summary: pie chart or stacked bar showing percentage of domains with E2E journey coverage vs. uncovered
- [ ] **FR-31**: "Gaps" view: filtered list of PRD features at stage "in-progress" or "done" that have zero linked journeys — these are the highest-priority coverage gaps
- [ ] **FR-32**: Actor coverage: which actors (from `JourneyDefinition.actors[]`) are exercised across the test suite, and which have no coverage
- [ ] **FR-33**: Service coverage: which services (from `JourneyDefinition.services[]`) are exercised, and which have no coverage

### Compliance Tab (FR-34 – FR-40)

- [ ] **FR-34**: ISO standards list with expandable accordion sections for: ISO 9001 (Quality Management), ISO 27001 (Information Security), ISO 25010 (Software Quality Characteristics)
- [ ] **FR-35**: Each standard section shows its quality characteristics as a checklist, with each characteristic indicating: tagged journey count, coverage status (covered/uncovered)
- [ ] **FR-36**: Journey compliance tagging via optional `complianceTags` field in journey JSON (array of strings like `"iso-9001:traceability"`, `"iso-25010:usability"`, `"iso-27001:access-control"`)
- [ ] **FR-37**: Compliance score per standard: percentage of characteristics with at least one tagged journey. Displayed as score badge on the standard accordion header.
- [ ] **FR-38**: Gap analysis: list of compliance characteristics without any tagged journey, sorted by standard. Each gap includes a guidance callout.
- [ ] **FR-39**: "Guidance" callouts per characteristic explaining: what it means, why it matters, and how to address it with a journey (e.g., "Usability: Create a journey that validates the primary user flow from the user's perspective. Focus on navigation clarity and error recovery.")
- [ ] **FR-40**: Compliance report export: "Generate Report" action creates a markdown compliance summary as a vault note with per-standard scores, tagged journeys, and gaps

### Journey Execution (FR-41 – FR-52)

> **Core principle**: A Flowti Journey is a portable definition that executes identically whether triggered from the UI, the command palette, or the CLI. The same 34-tool vocabulary works in all contexts. Journeys are not just tests — they automate vault operations, showcase workflows, and generate living documentation.

- [ ] **FR-41**: "Run Journey" action available from: (1) Test Management Hub journey detail panel, (2) Journey Builder sidebar, (3) command palette `flowti:run-journey` with file picker. All three entry points invoke the same executor.
- [ ] **FR-42**: `JourneyExecutorService` executes journey steps sequentially using the same 34-tool action vocabulary as the CLI E2E runner (`actionRunner.ts`): command, click, input, set-input, highlight, wait, screenshot, navigate, assert (8 types), assert-text, assert-number, assert-value, emit, eval, frontmatter, query-trace, write-run-log, scroll-to, select, ribbon, create-file, delete-file, copy-file, move-file, open-file, open-url, close-leaves, close-modals, seed, notice, manual, visual-inspection, theme, spinner. The **target vault is configurable**: the user can run against the current (user) vault or a configured test vault. Default is the user vault. Test vault path is configurable in settings.
- [ ] **FR-43**: During execution, a **live progress panel** (sidebar or modal) shows: current step name, step N of M progress, action-by-action status (pending/running/pass/fail), elapsed time, and any assertion failure messages.
- [ ] **FR-44**: The companion canvas (if open) highlights the **active step** during execution via `activeStepIndex` on `buildJourneyCanvas()`. Steps that pass turn green, failed steps turn red.
- [ ] **FR-45**: After execution completes, a `JourneyResult` artifact (JSON) is written to the journey's results folder. The Hub's run history, dashboard KPIs, and status indicators update immediately.
- [ ] **FR-46**: `{{variable}}` interpolation works identically to the CLI runner — cross-step data passing via `eval store` and emit payload. Variables are scoped to a single execution run.
- [ ] **FR-47**: Screenshot actions capture the current Obsidian viewport and save images alongside the result artifact. Screenshots are linked in the result JSON for report generation.
- [ ] **FR-48**: Manual verification steps (`manual`, `visual-inspection` tools) pause execution and prompt the user with a dialog. The user can approve or fail the step. Execution resumes after the response.
- [ ] **FR-49**: Execution can be **cancelled** mid-run via a "Stop" button. Cancellation is graceful: the current action completes, remaining steps are marked as "skipped", and partial results are written.
- [ ] **FR-50**: After a run, the user can choose to **generate a journey report** as a vault note — a markdown document with step descriptions, screenshots, pass/fail status, and event traces. This serves as a **user manual** or **workflow showcase**.
- [ ] **FR-51**: Execution events are emitted for observability: `test-mgmt.run.started` (journey name, step count), `test-mgmt.run.step-completed` (step id, status, duration), `test-mgmt.run.completed` (summary), `test-mgmt.run.failed` (error).
- [ ] **FR-52**: The executor supports a **dry-run mode** that validates the journey definition (checks tool availability, selector existence, event names) without actually executing actions. Useful for authoring validation.

---

## 7. Data Model

### Design Decision: No New Document Types

The existing `JourneyDefinition` (`.journey` JSON file) IS the test artifact. Run results are already persisted as `JourneyResult` by the E2E report pipeline. The Test Management Hub reads existing artifacts — it does not create new document types.

### Computed Entities

```
JourneyRegistryEntry (computed from .journey files + result files)
  name: string                      # from JourneyDefinition.journey
  chapter?: number                  # from JourneyDefinition.chapter
  type: JourneyType                 # functional | regression | smoke | exploratory | blueprint | integration
  category?: string                 # from JourneyDefinition.category
  domain?: string                   # from JourneyDefinition.domain
  prd?: string                      # NEW optional field — explicit PRD link
  actors: string[]                  # from JourneyDefinition.actors
  services: string[]                # from JourneyDefinition.services
  stepCount: number                 # steps.length
  tools: ToolName[]                 # unique tools across all step actions
  jsonPath: string                  # vault-relative path to .journey file
  canvasPath?: string               # companion .canvas file
  testSourcePath?: string           # companion .test.ts file
  reportPath?: string               # generated journey report .md
  improvements: JourneyImprovement[] # from journey JSON
  complianceTags: string[]          # NEW field on JourneyDefinition
  lastRunResult?: JourneyRunSummary
  runHistory: JourneyRunSummary[]

JourneyRunSummary (parsed from existing *-results.json files)
  date: string                      # ISO date
  totalSteps: number
  passed: number
  failed: number
  skipped: number
  dev: number
  durationMs: number
  devStopped: boolean

TestPyramidState (computed from test reports + journey results)
  e2e: { count: number; passRate: number; trend: "up" | "down" | "stable" }
  flow: { count: number; passRate: number; trend: "up" | "down" | "stable" }
  unit: { count: number; passRate: number; trend: "up" | "down" | "stable" }

CoverageEntry (computed from PRD files + journey definitions)
  prdName: string
  prdStage: string
  domain: string
  journeyCount: number
  journeyNames: string[]
  status: "covered" | "partial" | "uncovered"

ComplianceCharacteristic (static definitions)
  standard: "iso-9001" | "iso-27001" | "iso-25010"
  id: string                        # e.g. "usability", "traceability", "access-control"
  label: string
  description: string
  guidance: string                  # how to address with a journey

ComplianceTag (computed from journey tags + definitions)
  standard: "iso-9001" | "iso-27001" | "iso-25010"
  characteristic: string
  journeyNames: string[]
  status: "covered" | "uncovered"

JourneyExecutionState (runtime state during execution)
  journeyName: string
  targetVault: "user" | "test"               # which vault to execute against
  status: "idle" | "running" | "completed" | "failed" | "cancelled"
  currentStepIndex: number
  totalSteps: number
  startedAt?: string                          # ISO timestamp
  stepResults: JourneyStepResult[]            # accumulated during run
  variables: Record<string, string>           # cross-step variable interpolation
  screenshots: string[]                       # captured screenshot paths
  cancelRequested: boolean
```

### Schema Extensions

**New optional field on `JourneyDefinition`** (backward-compatible):

```typescript
// In journeyTypes.ts
export interface JourneyDefinition {
  // ... existing fields ...
  prd?: string;                    // explicit PRD feature link (e.g. "Journey Builder")
  complianceTags?: string[];       // ISO compliance tags (e.g. ["iso-25010:usability"])
  targetVault?: "user" | "test";   // which vault to execute against (default: "user")
}
```

### Storage Schema

New key in TypedStorage (plugin `data.json`):

```
testManagement: {
  complianceOverrides: Record<string, string[]>;   // journeyName → tags (for tags not in JSON)
  pyramidBaseline?: TestPyramidState;               // last known pyramid for trend calculation
  lastScanDate?: string;                            // ISO date of last full scan
  testVaultPath?: string;                           // path to test vault (for targetVault: "test")
  defaultTargetVault: "user" | "test";              // default execution target (default: "user")
}
```

---

## 8. Event Impact

### Produced Events (13 new)

| Event | Payload | When |
|-------|---------|------|
| `test-mgmt.journey.registered` | `{ name, jsonPath }` | Journey file detected during scan |
| `test-mgmt.journey.deregistered` | `{ name }` | Journey file removed |
| `test-mgmt.journey.status-changed` | `{ name, previousStatus, newStatus }` | Run result changes pass/fail state |
| `test-mgmt.journey.run-completed` | `{ name, passed, failed, skipped }` | New result file detected |
| `test-mgmt.coverage.computed` | `{ totalPrds, coveredPrds, coveragePercent }` | Coverage recalculated |
| `test-mgmt.compliance.checked` | `{ standard, score, gaps }` | Compliance check completed |
| `test-mgmt.pyramid.updated` | `{ e2eCount, flowCount, unitCount }` | Pyramid recalculated |
| `test-mgmt.review.requested` | `{ journeyName }` | User requests Three Amigos review |
| `test-mgmt.hub.loaded` | `{}` | Hub view opened and data loaded |
| `test-mgmt.run.started` | `{ journeyName, targetVault, stepCount }` | Journey execution begins |
| `test-mgmt.run.step-completed` | `{ journeyName, stepId, status, durationMs }` | Single step finishes |
| `test-mgmt.run.completed` | `{ journeyName, passed, failed, skipped, durationMs }` | Journey execution completes successfully |
| `test-mgmt.run.failed` | `{ journeyName, stepId, error }` | Journey execution fails (unrecoverable) |

### Consumed Events

| Event | Purpose |
|-------|---------|
| `journey-builder.exported` | Auto-register newly exported journey |
| `journey-builder.imported` | Refresh journey state if re-imported |
| `file.created` / `file.modified` | Detect new journey result files, trigger re-scan |
| `hub.navigate` | Handle cross-hub navigation (e.g., from User Hub) |
| `settings.changed` | Respect journey folder path configuration changes |

---

## 9. UI Layout

### Hub Architecture

```
TestManagementHubView extends BaseHubView<TestMgmtPage>

  type TestMgmtPage = "journeys" | "pyramid" | "coverage" | "compliance";

  Tabs: [
    { id: "journeys",   label: "Journeys",   icon: "route",       searchPlaceholder: "Search journeys..." },
    { id: "pyramid",    label: "Pyramid",     icon: "triangle",    searchPlaceholder: "Search tests..." },  // Limited in Standard mode
    { id: "coverage",   label: "Coverage",    icon: "layout-grid", searchPlaceholder: "Search features..." },
    { id: "compliance", label: "Compliance",  icon: "shield",      searchPlaceholder: "Search standards..." },
  ]
```

**Mode-dependent tab behavior**: All 4 tabs are always visible. In **Standard mode** (no vitest), the Pyramid tab shows only the E2E journey layer with a guidance callout for Flow and Unit layers. All other tabs are fully functional in both modes. Vault targeting in the Journeys tab detail panel shows only "User vault" in Standard mode; "Test vault" option appears in Expert mode only.

### Dashboard Layout (default landing)

```
┌─────────────────────────────────────────────────────┐
│  Test Management Hub                    [+ New] [⟳]  │
├─────────────────────────────────────────────────────┤
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐ │
│  │ Journeys │ │ Pass Rate│ │ Coverage │ │Complian│ │
│  │    7     │ │   85%    │ │   60%    │ │  45%   │ │
│  └──────────┘ └──────────┘ └──────────┘ └────────┘ │
│                                                       │
│  ┌─── Test Pyramid ───┐  ┌─── Recent Runs ────────┐ │
│  │     ▲  E2E: 7      │  │ Getting Started   ✓ 2m │ │
│  │    ▲▲▲ Flow: 41    │  │ Component Lib     ✓ 5m │ │
│  │   ▲▲▲▲▲ Unit: 276  │  │ Canvas Session    ✗ 1m │ │
│  └─────────────────────┘  │ Tool Reference    ✓ 3m │ │
│                            │ ...                     │ │
│  ┌─── Needs Attention ──┐ └─────────────────────────┘ │
│  │ ⚠ Canvas Session: 2  │                             │
│  │   failures            │                             │
│  │ ⚠ Prerequisites:     │                             │
│  │   stale (35 days)    │                             │
│  └───────────────────────┘                             │
└─────────────────────────────────────────────────────┘
```

### Journeys Tab Layout (master/detail)

```
┌──────────────────────┬──────────────────────────────┐
│  [Journeys] Pyramid  │  Getting Started             │
│  Coverage Compliance │  Chapter 3 · functional       │
├──────────────────────┤  Domain: core                 │
│ 🔍 Search journeys   │                              │
│ Type: All ▾ Status: ▾│  ── Run History ──────────── │
├──────────────────────┤  2026-03-04  ✓ 8/8  2m 14s  │
│ ✓ Getting Started  8 │  2026-03-01  ✓ 8/8  2m 31s  │
│ ✓ Component Lib   35 │  2026-02-28  ✗ 7/8  3m 02s  │
│ ✗ Canvas Session  12 │                              │
│ ✓ Tool Reference  20 │  ── Steps ────────────────── │
│ ○ Prerequisites   10 │  ✓ Open User Hub             │
│ ✓ Installer       16 │  ✓ Navigate to Sessions      │
│ ✓ Journey Builder 13 │  ✓ Start New Session         │
│                       │  ✓ Capture First Thought     │
│                       │  ...                         │
│                       │                              │
│                       │  ── Traceability ─────────── │
│                       │  PRD: Hubs                   │
│                       │  Events: 12 · Commands: 3    │
│                       │  Components: WorkspaceShell,  │
│                       │    SessionsTab               │
│                       │                              │
│                       │  [Open in Builder] [Canvas]  │
│                       │  [JSON] [Request Review]     │
└──────────────────────┴──────────────────────────────┘
```

### Pyramid Tab Layout (full-width)

```
┌─────────────────────────────────────────────────────┐
│  Journeys [Pyramid] Coverage Compliance             │
├─────────────────────────────────────────────────────┤
│                                                       │
│              ┌───────────────┐                        │
│              │   E2E: 7      │  85% pass  ↑          │
│              │  journeys     │  [Three Amigos ✓]     │
│           ┌──┴───────────────┴──┐                     │
│           │   Flow: 41 suites   │  98% pass  →       │
│           │   602 tests         │  [Three Amigos ○]  │
│        ┌──┴─────────────────────┴──┐                  │
│        │   Unit: 276 suites        │  99% pass  →    │
│        │   5,992 tests             │  [Three Amigos ○]│
│        └───────────────────────────┘                  │
│                                                       │
│  ── Layer Detail (click to expand) ────────────────  │
│                                                       │
│  Total: 6,594 tests across 276 suites + 7 journeys  │
└─────────────────────────────────────────────────────┘
```

---

## 10. Adapter Impact

### New Service: TestManagementService

```
src/domain/testManagement/TestManagementService.ts

TestManagementService
├── Constructor(deps: { eventBus, fileSystem, storage, getSettings })
├── load(): Promise<void>                          # Initialize: scan journeys, parse results
├── start(): void                                  # Subscribe to events
├── stop(): void                                   # Unsubscribe
├── scanJourneys(): JourneyRegistryEntry[]         # Scan .journey files from configured path
├── getJourney(name): JourneyRegistryEntry | null  # Get single journey by name
├── getRunHistory(name): JourneyRunSummary[]       # Parse result files for a journey
├── computeCoverage(): CoverageEntry[]             # Cross-reference PRDs and journeys
├── computePyramid(): TestPyramidState             # Aggregate test counts across all layers
├── getComplianceReport(standard): ComplianceTag[] # Check journey tags against standard definitions
├── tagJourneyCompliance(name, tags): void         # Persist compliance tags in storage
├── requestReview(name): Promise<void>             # Create review doc from template, emit event
└── getRegistrySnapshot(): JourneyRegistryEntry[]  # Return cached registry for UI
```

### New Service: JourneyExecutorService

```
src/domain/testManagement/JourneyExecutorService.ts

JourneyExecutorService
├── Constructor(deps: { eventBus, fileSystem, app, storage, getSettings })
├── run(journeyPath, options?): Promise<JourneyResult>   # Execute a journey against a vault
│     options: {
│       targetVault?: "user" | "test",                    # override per-run (default from settings)
│       dryRun?: boolean,                                 # validate without executing
│       onStepProgress?: (step, status) => void,          # live progress callback
│     }
├── cancel(): void                                        # Graceful cancellation of running journey
├── isRunning(): boolean                                  # Check if a journey is currently executing
├── getExecutionState(): JourneyExecutionState | null     # Get current run state for UI
├── executeAction(action, variables, vault): Promise<void> # Single action executor (34 tools)
└── validateJourney(def): ValidationResult                # Check tools, selectors, events
```

**Execution model**: The executor reads the journey JSON, iterates steps sequentially, and for each step iterates its actions. Each action is dispatched to a tool handler that operates via the Obsidian plugin API (`app.workspace`, `app.vault`, `app.commands`, DOM queries). The tool vocabulary is identical to the CLI runner — a journey that passes in the CLI will produce the same result when run from the UI.

**Dual-mode architecture**: The Hub adapts to the user's environment:

| Mode | Environment | Capabilities |
|------|-------------|-------------|
| **Standard** | Obsidian only (no CLI, no vitest) | Create and execute journeys on the user vault. Full 34-tool vocabulary via plugin API. Results stored as vault notes. Dashboard, Journeys tab, Coverage tab, Compliance tab. |
| **Expert** | Obsidian + vitest + CLI available | Everything in Standard, plus: test vault targeting, Pyramid tab (reads vitest suite data), CLI-triggered runs, E2E report pipeline integration, flow/unit test layer counts. |

The Hub detects the environment at load time (checks for `node_modules/vitest`, test vault path in settings) and shows/hides expert features accordingly. The **Standard mode is the default** — every Obsidian user can create and run Flowti Journeys without any developer tooling.

**Vault targeting** (Expert mode only): When `targetVault` is `"test"`, the executor uses the configured `testVaultPath` from settings to operate on a separate vault (requires CLI bridge). When `targetVault` is `"user"` (default, always available), actions run against the current Obsidian vault directly. Non-developer users never see the test vault option.

### New Hub Provider: TestManagementHubProvider

```
src/domain/hub/TestManagementHubProvider.ts

TestManagementHubProvider implements HubDashboardProvider
├── getHubId(): "test-management"
├── getViewType(): VIEW_TYPE_TEST_MANAGEMENT_HUB
├── getDisplayName(): "Test Management"
├── getIcon(): "shield-check"
└── getSummary(): HubSummary                       # passRate, journeyCount, coveragePercent
```

### Pure Functions (domain logic)

```
src/domain/testManagement/journeyParser.ts
├── parseJourneyFile(content: string): JourneyDefinition     # Parse .journey JSON
├── parseResultFile(content: string): JourneyResult          # Parse *-results.json
├── toRegistryEntry(def, results): JourneyRegistryEntry     # Combine definition + results
└── toRunSummary(result: JourneyResult): JourneyRunSummary  # Extract summary from result

src/domain/testManagement/pyramidCalculator.ts
├── computePyramid(journeyCount, flowSuites, unitSuites): TestPyramidState
└── computeTrend(current, baseline): "up" | "down" | "stable"

src/domain/testManagement/coverageCalculator.ts
├── computeCoverage(prds, journeys): CoverageEntry[]
├── computeDomainCoverage(entries): Record<string, "covered" | "uncovered">
└── findGaps(entries): CoverageEntry[]               # Features without journeys

src/domain/testManagement/complianceChecker.ts
├── checkCompliance(standard, journeys): ComplianceTag[]
├── computeScore(tags: ComplianceTag[]): number       # Percentage of covered characteristics
└── getGaps(tags: ComplianceTag[]): ComplianceTag[]   # Uncovered characteristics

src/domain/testManagement/complianceDefinitions.ts
├── ISO_9001_CHARACTERISTICS: ComplianceCharacteristic[]
├── ISO_27001_CHARACTERISTICS: ComplianceCharacteristic[]
└── ISO_25010_CHARACTERISTICS: ComplianceCharacteristic[]
```

---

## 11. Non-Functional Requirements

| Requirement | Target |
|-------------|--------|
| **Scan performance** | Journey scan < 500ms for 20 journey files |
| **Pyramid computation** | < 200ms for 300 suites |
| **Coverage computation** | < 300ms for 40 PRD features × 20 journeys |
| **Purity** | All calculation functions are pure (testable with mock data, no side effects) |
| **Freshness** | Re-scan on tab activation (existing Hub pattern via `scheduleRender()`) |
| **Non-destructive (Hub)** | Hub reads but never writes to `.journey` files. Compliance tags stored in TypedStorage only. |
| **Execution safety** | Executor writes result files only. Vault-modifying tools (create-file, delete-file, seed) require user confirmation when running on user vault. |
| **Tool parity** | All 34 tools produce identical results whether invoked from CLI or in-app executor. |
| **Cancellation** | Cancel completes the current action, marks remaining steps as skipped, and writes partial results. < 2s to stop. |
| **Progressive disclosure** | Dashboard KPIs first, details on click/tab switch |
| **Backward compatible** | New `complianceTags` and `prd` fields on JourneyDefinition are optional. Existing journeys work unchanged. |

---

## 12. ISO Compliance Characteristics

### ISO 9001 — Quality Management System

| ID | Characteristic | Guidance |
|----|---------------|----------|
| `traceability` | Requirements traceability | Create journeys that validate each PRD use case. Link via `prd` field. |
| `document-control` | Document control | Verify that vault notes have correct frontmatter and are findable via the Event Catalog. |
| `continuous-improvement` | Continual improvement | Add `improvements` to journeys. Track improvement resolution over time. |
| `process-approach` | Process approach | Design journeys as end-to-end process flows with clear inputs and outputs per step. |
| `evidence-based` | Evidence-based decision making | Include `screenshot` and `assert` actions to capture evidence of correct behavior. |
| `risk-based` | Risk-based thinking | Cover high-risk flows first. Tag risk-mitigating journeys. |

### ISO 27001 — Information Security

| ID | Characteristic | Guidance |
|----|---------------|----------|
| `access-control` | Access control | Verify that protected operations require appropriate permissions. |
| `data-integrity` | Data integrity | Assert that data is not corrupted after operations (frontmatter checks, file content validation). |
| `audit-trail` | Audit trail | Verify that security-relevant events are emitted and traceable via `query-trace`. |
| `incident-response` | Incident response | Test error handling paths — verify notices, logging, and recovery flows. |
| `secure-config` | Secure configuration | Verify that default settings are secure and that sensitive config (PATs) is properly stored. |

### ISO 25010 — Software Quality

| ID | Characteristic | Guidance |
|----|---------------|----------|
| `functionality` | Functional suitability | Verify that features work as specified in the PRD. Cover all acceptance criteria. |
| `reliability` | Reliability | Test error recovery, fault tolerance. Include journeys for edge cases. |
| `usability` | Usability | Design journeys from the user's perspective. Test primary navigation flows. |
| `security` | Security | Verify authentication, authorization, and data protection mechanisms. |
| `maintainability` | Maintainability | Keep journeys modular (use journey refs). Verify that refactoring doesn't break flows. |
| `portability` | Portability | Test across themes (light/dark mode). Verify responsive behavior. |
| `performance` | Performance efficiency | Include `wait` actions with reasonable timeouts. Flag journeys that exceed time budgets. |
| `compatibility` | Compatibility | Test alongside other plugins. Verify Obsidian API compatibility. |

---

## 13. Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Journey result file format changes break parsing | Medium | High | Parse via defensive parsing with fallback defaults. Version-check result schema. |
| PRD-to-journey linking via `domain` is too coarse | Medium | Medium | Support explicit `prd` field for precise linking. Domain match is the default heuristic. |
| Compliance tagging feels like busywork | Medium | Medium | Pre-populate common tags. Provide actionable guidance callouts. Make tagging entirely optional. |
| Test pyramid data stale (vitest results not auto-imported) | High | Low | Pyramid shows last known counts from test reports. "Refresh" button triggers re-scan. |
| Hub becomes the 6th view type — tab fatigue | Low | Medium | Clear icon differentiation. User Hub card as primary entry point. |
| Three Amigos review creation requires template | Low | Low | Ship a default review template. Allow customization via settings. |
| In-app executor breaks user vault with destructive actions | Medium | High | Vault-modifying tools (create/delete/move file, seed) require confirmation dialog when running on user vault. Dry-run mode validates before executing. |
| Tool parity drift between CLI runner and in-app executor | Medium | Medium | Share tool definitions (`toolSchemas.ts`). Extract common tool logic into a shared `toolRunner` module consumed by both CLI and in-app. |
| Journey execution blocks the UI thread | Low | High | Execute actions via `setTimeout`/`requestAnimationFrame` yielding. Long-running evals use Web Workers if available. |

---

## 14. Acceptance Criteria

- [ ] Journey list shows all `.journey` files with latest run status (pass/fail/never-run/stale)
- [ ] Detail panel shows run history with step-level results and status indicators
- [ ] Test pyramid displays 3 layers with counts, pass rates, and trend indicators
- [ ] Coverage matrix links PRD features to journeys with coverage indicators (covered/partial/uncovered)
- [ ] Compliance tab shows ISO standards with tagged/untagged journey counts per characteristic
- [ ] Dashboard KPI cards display aggregate health metrics (total, pass rate, coverage %, compliance score)
- [ ] `journey-builder.exported` event triggers automatic journey registration in the Hub
- [ ] "Open in Builder" navigates to Journey Builder sidebar with the selected journey loaded
- [ ] Three Amigos review can be requested from journey detail panel
- [ ] Hub provides `HubDashboardProvider` for User Hub "Test Health" summary card
- [ ] "Run Journey" executes a journey against the user vault with live step-by-step progress
- [ ] "Run Journey" can target a configured test vault instead of the user vault
- [ ] All 34 tools work identically in the in-app executor as in the CLI runner
- [ ] Journey result artifact is written after execution and Hub updates immediately
- [ ] Generated journey report serves as living documentation / user manual
- [ ] `flowti:run-journey` command available in the command palette
- [ ] **Standard mode**: Hub functions fully without vitest/CLI — Pyramid shows E2E layer only, test vault option hidden
- [ ] **Expert mode**: vitest detected enables full Pyramid data, test vault targeting, and CLI-triggered runs

---

## 15. Definition of Done

- [ ] `TestManagementService` implemented with scan, parse, coverage, pyramid, and compliance methods
- [ ] `TestManagementHubView` extends `BaseHubView` with Dashboard + 4 tabs
- [ ] `TestManagementHubProvider` registered and visible on User Hub
- [ ] 13 domain events defined and wired (9 management + 4 execution)
- [ ] Pure calculation functions (pyramid, coverage, compliance) implemented and tested
- [ ] ISO compliance characteristic definitions shipped (9001, 27001, 25010)
- [ ] Journey Builder integration: auto-register on export, "Open in Builder" action, "Run Journey" from Builder
- [ ] `JourneyExecutorService` implemented with 34-tool vocabulary, vault targeting, dry-run, cancellation
- [ ] Live progress panel shows step-by-step execution status
- [ ] Journey report generation produces markdown documentation from run results
- [ ] `flowti:run-journey` command registered in command palette
- [ ] Dual-mode detection: Hub detects vitest presence at load time and adapts UI (Standard vs Expert)
- [ ] Standard mode tested: all tabs render correctly without vitest, Pyramid shows E2E only, no test vault option
- [ ] CSS layer file created (`css/19-test-management.css`)
- [ ] Component docs and sitemap created
- [ ] Unit tests cover service, parser, calculation logic, and executor (~285 tests)
- [ ] `npm run build` passes

---

## 16. FRI Score Breakdown

| Dimension | Score | Rationale |
|-----------|-------|-----------|
| **Strategy** | 4/5 | Strong alignment with Journey Builder pipeline. Closes a real quality management gap. Not 5/5 because the compliance model is advisory and may need iteration. |
| **Scope** | 4/5 | 52 FRs, clear in/out scope, 10 PBIs defined, dual-mode architecture (Standard/Expert), in-app executor with 34-tool vocabulary. Not 5/5 because CI/CD integration and defect tracking are deferred. |
| **Architecture** | 3/5 | Hub pattern proven (5 existing Hubs). Service/pure-function split clear. Dual-mode detection designed. Not 4/5 because no proof-of-concept for journey parsing, executor, or compliance tagging yet. |
| **Event Integration** | 3/5 | 13 events defined with payloads (9 management + 4 execution). Consumes 5 existing events. Not 4/5 because event wiring not yet implemented or tested. |
| **Data Model** | 3/5 | Entities defined, schema extension minimal (2 optional fields). Not 4/5 because journey parser not yet built and result file format assumptions untested. |
| **UI Consistency** | 2/5 | Wireframes sketched (ASCII). Follows existing Hub/master-detail pattern. Not 3/5 because no interactive prototype and pyramid/compliance UIs are novel. |
| **Validation & Testing** | 1/5 | Test strategy stated (~190 tests estimated). Not 2/5 because no test scaffolding exists yet. |
| **Total** | **20/35** | **Technically Ready** — passes Design Gate threshold (19+). Ready for development. |

---

## 17. Product Backlog Items

| PBI | Title | Status | Scope | Est. Tests |
|-----|-------|--------|-------|------------|
| PBI-TM-001 | Domain Core — service, types, events, journey parser | Planned | ~200 LOC | ~40 |
| PBI-TM-002 | Hub Shell + Dashboard — view registration, KPI cards, mini pyramid, recent runs | Planned | ~250 LOC | ~30 |
| PBI-TM-003 | Journeys Tab — master/detail, filters, run history, step results, traceability | Planned | ~300 LOC | ~25 |
| PBI-TM-004 | Pyramid Visualization — 3-layer display, drill-down, trend indicators | Planned | ~150 LOC | ~20 |
| PBI-TM-005 | Coverage Matrix — PRD-journey linking, gap analysis, domain/actor/service coverage | Planned | ~200 LOC | ~25 |
| PBI-TM-006 | Compliance Tagging — ISO definitions, tag management, gap analysis, report export | Planned | ~200 LOC | ~20 |
| PBI-TM-007 | Journey Builder Integration — auto-register, "Open in Builder", "Run" from Builder, review request, cross-hub nav | Planned | ~100 LOC | ~15 |
| PBI-TM-008 | Journey Executor — in-app execution engine with 34-tool vocabulary, vault targeting, progress, cancellation | Planned | ~400 LOC | ~50 |
| PBI-TM-009 | Execution UI — live progress panel, run history integration, report generation, command registration | Planned | ~200 LOC | ~20 |
| PBI-TM-010 | E2E Journey — declarative E2E validation of the Test Management Hub and executor | Planned | ~200 LOC | ~15 |
| | **Total** | | **~2,350 LOC** | **~285** |

### Implementation Sequencing

```
PBI-TM-001 (Domain Core)
  │
  ├── PBI-TM-002 (Hub Shell + Dashboard)
  │     │
  │     ├── PBI-TM-003 (Journeys Tab)     ┐
  │     ├── PBI-TM-004 (Pyramid)           ├── parallel after 002
  │     ├── PBI-TM-005 (Coverage)          │
  │     └── PBI-TM-006 (Compliance)        ┘
  │           │
  ├── PBI-TM-008 (Journey Executor)  ──────┤
  │     │                                    │
  │     └── PBI-TM-009 (Execution UI) ─────┤
  │                                          │
  └── PBI-TM-007 (JB Integration) ─────────┴── PBI-TM-010 (E2E)
```

---

## 18. Stage History

| Date | Transition | FRI | Notes |
|------|-----------|-----|-------|
| 2026-02-15 | → idea | — | Initial concept: test case document tracker |
| 2026-03-05 | idea → draft | 20/35 | Complete rewrite as Journey-centric Test Management Hub (v2.0). Repositioned from TestCaseDoc tracker to quality management Hub integrated with Journey Builder pipeline. 52 FRs, 10 PBIs, 5-tab Hub + in-app Journey Executor with 34-tool vocabulary, vault targeting, and living documentation generation. |

---

## Related

- Consumer: [[Journey Builder PRD]] — journeys are the primary test artifacts
- Consumer: [[Journey Runner PRD]] — E2E execution pipeline that produces the results this Hub displays
- Sibling: [[Feature Lifecycle PRD]] — PRD stage management (Coverage tab links to PRDs)
- Pattern: [[Hubs PRD]] — Hub Shell pattern (BaseHubView, WorkspaceShell, HubDashboardProvider)
- Compliance: ISO 9001:2015, ISO/IEC 27001:2022, ISO/IEC 25010:2023
- Infrastructure: [[Development/flowti/src/ui/BaseHubView.ts|BaseHubView]] — abstract base class
- Review: [[Three Amigos Review 2026-03-05 Journey Builder]] — review pattern reference
