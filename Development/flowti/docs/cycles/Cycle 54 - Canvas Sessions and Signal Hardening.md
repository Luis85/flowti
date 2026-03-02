---
type: DevelopmentCycle
feature: "[[Backlog Refinement - Post Cycle 48]]"
stage: done
cycle: 54
release_anchor:
  - "Theme 4: Feature Deepening — Competitive Moat"
pbis:
  - "PBI-CAN-003: Canvas Sessions"
  - "PBI-CAN-002: Canvas template library"
  - "PBI-SIG-008: Signal Azure DevOps hardening"
  - "PBI-006: Auto-route inbox files"
bugs: []
tech_debt:
  - CLI wrapper unit tests (C53 backlog)
  - RB-6 CLI Installer reassessment (C53 backlog)
estimated_increments: 8
actual_increments: 15
estimated_loc: 1490
estimated_tests: 135
pre_cycle_tests: 5825
pre_cycle_suites: 252
current_tests: 6119
current_suites: 263
---

# Cycle 54 — Canvas Sessions and Signal Hardening

## Release Anchor Theme

- **Theme 4: Feature Deepening — Competitive Moat** — Visual workflows and integration reliability.

## Situation Assessment

### Pre-Cycle State

- **Tests**: 5,825 passing (252 suites) — all green
- **E2E**: 69 tests (53 pass, 16 skip) — established in C53
- **Build**: `npm run build` green
- **Open bugs**: None critical (TD-123/124/125 are medium severity)
- **Previous cycle**: C53 (Obsidian CLI Spike) closed — DoD satisfied, retrospective complete
- **ADR-028**: Updated to Accepted (resolved in C53)
- **Data Exchange Evolution**: Deferred from C53 → C55 (RB-7 target updated)

### C53 Improvement Backlog Items Carried Forward

| Item | Classification | Action |
|------|----------------|--------|
| CLI wrapper unit tests (mock execSync) | Tech debt | Inc 0 — isolated unit tests for ObsidianCli wrapper |
| RB-6 CLI Installer reassessment | Architecture decision | Inc 0 — formal analysis: does Obsidian 1.12 CLI supersede RB-6? |
| ADR-028 update to Accepted | Documentation | Already completed during C53 DoD — no action needed |
| Per-step `settleMs` on JourneyStep config | Enhancement | Deferred — apply when adding new journeys |
| Canvas visual polish | Enhancement | Deferred — separate cycle or organic improvement |
| Populate journey step metadata | Enhancement | Deferred — Getting Started and Component Library steps |
| CI/CD pipeline for E2E | Future PRD | Deferred — requires Xvfb spike (PBI-RP-003) |
| Visual regression diff comparison | Future PRD | Deferred — screenshot diffing tooling |

## Cycle Overview

Cycle 54 invests in two differentiators: **Canvas Sessions** (visual-first domain modeling) and **Signal hardening** (reliable Azure DevOps integration). Canvas is Flowti's most visually distinctive feature — Train of Thought already uses it extensively (349 domain tests, 15 UI files). Canvas Sessions extend this to guided, structured visual workflows. Signal hardening ensures the existing Azure DevOps adapter is production-reliable before we ever consider adding Jira or GitHub.

Additionally, auto-routing inbox files by type (PBI-006) transforms the inbox from a dumping ground into a true triage zone.

## User Pains

1. **No guided Canvas workflows** — Canvas is powerful for freeform thinking (Train) but has no structured session mode. Users can't start a "Domain Design Session" or "Sprint Planning Session" with preconfigured areas (PBI-CAN-003).
2. **No Canvas templates** — Each canvas starts blank. No domain-specific starter templates (PBI-CAN-002).
3. **Signal Azure DevOps has no error recovery** — Network failures, token expiry, and API rate limits are not handled gracefully. No retry logic, no diagnostics, no connection health monitoring (PBI-SIG-008).
4. **Inbox files stay in inbox forever** — Once a note is typed (e.g., `type: Idea` → `type: Feature`), it should auto-route to the appropriate vault folder. Currently, typed notes rot in inbox (PBI-006).

## Cycle Goals

1. **Close C53 housekeeping** — CLI wrapper unit tests and RB-6 reassessment
2. **Implement Canvas Sessions** with sidebar monitor and preconfigured canvas areas
3. **Build Canvas template library** with 5 starter templates
4. **Harden Signal Azure DevOps adapter** with retry, diagnostics, and health monitoring
5. **Implement inbox auto-routing** by type

## Scope

### In Scope
- PBI-CAN-003: Canvas Sessions (sidebar monitor, preconfigured areas, guided flow)
- PBI-CAN-002: Canvas template library (5 templates: Domain Design, Sprint Planning, Retrospective, Brainstorm, Flow Design)
- PBI-SIG-008: Signal ADO hardening (retry with backoff, token refresh detection, rate limit handling, connection health, diagnostics panel)
- PBI-006: Auto-route inbox files by type (configurable routing rules)

### Out of Scope
- Signal v2 (Jira, GitHub adapters) — explicitly deferred beyond C55
- Signal push/write-back — deferred to Signal v2
- Signal auto-sync scheduling — deferred to Signal v2
- Canvas import from external sources — existing CanvasImporter sufficient
- Canvas round-trip sync — deferred

## Increments

### Inc 0: C53 Housekeeping
**Theme**: Quality
**Effort**: Small | **Est. LOC**: ~80 | **Est. Tests**: ~20

Close improvement backlog items carried forward from Cycle 53:

**CLI Wrapper Unit Tests**:
- Add isolated unit tests for `ObsidianCli` class with mocked `execSync`/`exec`
- Test: `run()`, `eval()`, `createFile()`, `readFile()`, `deleteFile()`, `setProperty()`, `search()`, `getPlugins()`, `reloadPlugin()`, `executeCommand()`, `getPluginState()`, `evalJson()`
- Test error paths: CLI not running, timeout, syntax errors, plugin not loaded
- File: `tests/infrastructure/cli/ObsidianCli.test.ts` (extend or create)

**RB-6 CLI Installer Reassessment**:
- Obsidian 1.12 CLI provides `plugin:enable`, `plugin:disable`, `plugin:reload` natively
- Analyze: does this supersede the need for a CLI-based installer (RB-6)?
- Decision: update RB-6 status (close as superseded, or refine scope to what CLI doesn't cover)
- Document decision in RB-6 file with rationale

**Acceptance Criteria**:
- [ ] CLI wrapper has isolated unit tests (mock execSync)
- [ ] Error scenarios tested (timeout, not running, syntax error)
- [ ] RB-6 decision documented with rationale
- [ ] `npm test` green

### Inc 1: Canvas Template Library (PBI-CAN-002)
**Theme**: Feature Deepening
**Effort**: Medium | **Est. LOC**: ~200 | **Est. Tests**: ~15

Create preconfigured canvas templates for structured sessions:
- Template storage: `templates/canvas/` folder with `.canvas` files
- 5 starter templates:
  - **Domain Design**: groups for Actors, Events, Services, Flows with connection guides
  - **Sprint Planning**: backlog, sprint goal, capacity, commitment areas
  - **Retrospective**: went-well, improve, action-items columns
  - **Brainstorm**: central topic node with radial idea zones
  - **Flow Design**: start, steps, decision points, end zones
- Template picker UI in Train Hub
- Each template includes color-coded groups and placeholder cards

**Acceptance Criteria**:
- [ ] 5 canvas templates created and stored
- [ ] Template picker UI in Train Hub
- [ ] Templates load correctly into Obsidian Canvas
- [ ] Placeholder cards and groups render as designed
- [ ] Unit tests for template loading and validation
- [ ] `npm test` green

### Inc 2: Canvas Session — Sidebar Monitor (PBI-CAN-003a)
**Theme**: Feature Deepening
**Effort**: Medium | **Est. LOC**: ~250 | **Est. Tests**: ~20

Build the canvas session sidebar that monitors active canvas work:
- Sidebar leaf (Obsidian right sidebar) shows session state
- Tracks: session goal, active template, nodes added/modified/connected
- Timer: session duration with pause/resume
- Activity feed: real-time list of canvas operations (node added, connected, moved to group)
- Integrates with existing SessionService for lifecycle management

**Acceptance Criteria**:
- [ ] Sidebar opens alongside active canvas
- [ ] Session goal displayed and editable
- [ ] Node tracking (added, modified, connected)
- [ ] Timer with pause/resume
- [ ] Activity feed updates in real-time
- [ ] Unit tests for sidebar state management
- [ ] `npm test` green

### Inc 3: Canvas Session — Guided Flow (PBI-CAN-003b)
**Theme**: Feature Deepening
**Effort**: Large | **Est. LOC**: ~350 | **Est. Tests**: ~25

Implement guided canvas session workflow:
- "Start Canvas Session" command: select template → set goal → open canvas + sidebar
- Canvas opens with selected template applied
- Groups in template map to session phases (e.g., "Actors" phase → "Events" phase → "Flows" phase)
- Phase progression: sidebar highlights current phase, suggests next steps
- Session close: generate summary note from canvas content (reuse TrainSummaryWriter pattern)
- Emit canvas session events (session.canvas.started, session.canvas.phase.changed, session.canvas.completed)

**Acceptance Criteria**:
- [ ] "Start Canvas Session" command works end-to-end
- [ ] Template applied to new canvas
- [ ] Phase progression tracked in sidebar
- [ ] Summary note generated on session close
- [ ] Canvas session events emitted
- [ ] Unit tests for session lifecycle and phase progression
- [ ] `npm test` green

### Inc 4: Signal Azure DevOps — Retry and Error Handling (PBI-SIG-008a)
**Theme**: Feature Deepening
**Effort**: Medium | **Est. LOC**: ~150 | **Est. Tests**: ~20

Harden AzureDevOpsAdapter with robust error handling:
- Exponential backoff retry (3 attempts, 1s/2s/4s delays)
- Token expiry detection: catch 401 responses, emit `signal.auth.expired` event
- Rate limit handling: detect 429 responses, respect `Retry-After` header
- Network failure handling: catch ECONNREFUSED/ETIMEDOUT, emit `signal.connection.failed`
- All errors logged with context (operation, URL, attempt number)

**Acceptance Criteria**:
- [ ] Retry with exponential backoff on transient failures
- [ ] 401 detected and `signal.auth.expired` emitted
- [ ] 429 detected with Retry-After respected
- [ ] Network failures caught and reported
- [ ] All errors logged with context
- [ ] Unit tests for each error scenario (mocked HTTP responses)
- [ ] `npm test` green

### Inc 5: Signal Azure DevOps — Diagnostics and Health (PBI-SIG-008b)
**Theme**: Feature Deepening
**Effort**: Medium | **Est. LOC**: ~200 | **Est. Tests**: ~15

Add connection health monitoring and diagnostics:
- Connection health check: periodic ping (configurable: every 5 min when active)
- Health status: healthy/degraded/unreachable with last-check timestamp
- Diagnostics panel in Signal tab: connection status, last sync time, error history (last 10)
- "Test Connection" button with detailed result (latency, API version, permissions)
- Health status visible in Signal tab header (green/yellow/red indicator)

**Acceptance Criteria**:
- [ ] Health check runs periodically
- [ ] Status tracked: healthy/degraded/unreachable
- [ ] Diagnostics panel shows connection details and error history
- [ ] "Test Connection" returns detailed diagnostics
- [ ] Health indicator visible in Signal tab
- [ ] Unit tests for health check logic and status transitions
- [ ] `npm test` green

### Inc 6: Inbox Auto-Routing (PBI-006)
**Theme**: Feature Deepening
**Effort**: Medium | **Est. LOC**: ~180 | **Est. Tests**: ~15

Auto-route inbox files to appropriate folders based on type:
- Routing rules: `{ type: string, targetFolder: string }[]` in settings
- Default rules: `Idea → inbox/`, `Feature → features/`, `Bug → bugs/`, `Learning → learnings/`
- Trigger: when `type` frontmatter changes on an inbox file
- Move file to target folder, update internal links
- Emit `inbox.file.routed` event with source, target, type
- Opt-in: disabled by default, enable in settings

**Acceptance Criteria**:
- [ ] Routing rules configurable in settings
- [ ] File moves to target folder on type change
- [ ] Internal links updated after move
- [ ] Event emitted with routing details
- [ ] Disabled by default (opt-in)
- [ ] Unit tests for routing logic and link updates
- [ ] `npm test` green

### Inc 7: Integration and Polish
**Theme**: Feature Deepening
**Effort**: Small | **Est. LOC**: ~80 | **Est. Tests**: ~5

Wire everything together and verify cross-feature interactions:
- Canvas Sessions visible in session history (reuse existing session list)
- Signal health visible on User Hub dashboard (health widget)
- Inbox routing status visible in inbox view (routed count)
- Update onboarding callouts for new features

**Acceptance Criteria**:
- [ ] Canvas sessions appear in session history
- [ ] Signal health visible on User Hub
- [ ] Inbox routing status displayed
- [ ] Onboarding callouts updated
- [ ] Manual end-to-end verification
- [ ] `npm test` green

## Dependency Graph

```
Inc 0 (Housekeeping)        ──→ Independent (first increment)
Inc 1 (Templates)           ──→ Inc 3 (Guided Flow)
Inc 2 (Sidebar Monitor)     ──→ Inc 3 (Guided Flow)
Inc 4 (Signal Retry)        ──→ Inc 5 (Signal Diagnostics)
Inc 6 (Inbox Routing)       ──→ Independent
Inc 7 (Integration)         ──→ Depends on Inc 1–6
```

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Canvas Session scope is large (sidebar + guided flow + summary) | High | Inc 1-2 are independently valuable; Inc 3 can be reduced to MVP |
| Obsidian Canvas API limitations for programmatic node creation | Medium | CanvasWriter (548 LOC) already handles this; extend as needed |
| Signal health check adds background network traffic | Low | Only when signal is configured; configurable interval |
| Inbox file moves break existing links | Medium | Use Obsidian's vault.rename() which updates links automatically |

## Success Metrics

| Metric | Target |
|--------|--------|
| New tests | ~130 |
| Post-cycle tests | ~5,955 |
| Canvas templates | 5 |
| Signal error scenarios covered | 4 (401, 429, network, timeout) |
| Routing rules | 4+ default types |
| CLI wrapper unit tests | ~20 |
| RB-6 decision | Documented |
| Increments | 8 |

## Deferred Items

- **Data Exchange Evolution** → C55 (RB-7 multi-source merge, TD-69 import concurrency, PBI-008 execution timing, PBI-DX-001 step preview)
- Signal v2 (Jira, GitHub adapters) → beyond C55 (strategic decision)
- Signal push/write-back → beyond C55
- Signal auto-sync scheduling → beyond C55
- Canvas round-trip sync → future cycle
- Canvas import from external formats → existing importer sufficient
- Per-step settleMs on JourneyStep config → next journey additions
- CI/CD pipeline for E2E → PBI-RP-003, requires Xvfb spike
- Visual regression diff comparison → future tooling cycle

## Actual Results

| Metric | Target | Actual |
|--------|--------|--------|
| New tests | ~130 | 294 (6,119 − 5,825) |
| Post-cycle tests | ~5,955 | 6,119 |
| Post-cycle suites | ~255 | 263 |
| Canvas templates | 5 | 5 |
| Signal error scenarios | 4 | 4 (401, 429, network, timeout) |
| Routing rules | 4+ default | 4 (idea, feature, bug, learning) |
| CLI wrapper unit tests | ~20 | 66 (40 from C53 + 12 Inc 0 + 14 Inc 12) |
| RB-6 decision | Documented | Closed as superseded |
| Eval calls eliminated | — | 28 (88→60, 32% reduction) |
| New ObsidianCli methods | — | 16 (9 native CLI + 7 eval wrappers) |
| New journey tools | — | 3 (set-input, frontmatter, query-trace) |
| New events | — | 24 (18 planned + 6 journey-builder) |
| Increments | 8 | 15 (8 planned + 7 bonus) |

### Increment Summary

| Inc | Theme | New Tests | New Files | Key Deliverables |
|-----|-------|-----------|-----------|-----------------|
| 0 | Housekeeping | 6 | 0 | CLI edge tests, RB-6 closed |
| 1 | Canvas Templates | 54 | 4 | 5 templates, CanvasTemplateService, CanvasTemplatePickerModal |
| 2 | Canvas Sidebar | 24 | 3 | CanvasSessionMonitor, CanvasSessionSidebar, session types |
| 3 | Canvas Guided Flow | 18 | 1 | CanvasSessionService, summary writer, command registration |
| 4 | Signal Retry | 22 | 1 | Exponential backoff, error classification, retry helpers |
| 5 | Signal Diagnostics | 28 | 2 | SignalHealthMonitor, SignalDiagnosticsService, health events |
| 6 | Inbox Routing | 20 | 1 | InboxAutoRouter, routing rules, settings, inbox.file.routed |
| 7 | Integration | 12 | 1 | SESSION_TYPE_LABELS fix, callout updates, integration tests |
| 8 | E2E Observability | 7 | 0 | E2E-aware Activity Log, event trace CSV, report enrichment |
| 9 | Journey Runner Hardening | 7 | 0 | Tool-showcase journey, setup/teardown lifecycle, bug fixes |
| 10 | E2E UX & Reporting | 0 | 0 | close-modals tool, assert/wait feedback, failure reporting, interactive mode redesign, retry dedup |
| 11 | Frontend Refactor | 77 | 4 | NoticeService (179 LOC), ModalService (543 LOC), 11 events, main.ts −530 LOC |
| 12 | E2E Eval Reduction | 14 | 0 | 16 CLI methods, 28 evals eliminated (88→60), 3 journey tools, 2 assert subtypes |
| 13 | Tool Reference Journey | 0 | 2 | Chapter 8 journey (26 tools), WebViewer interactions, CSS selector fixes |
| 14 | Journey Builder Spike | 0 | 3 | JourneyBuilderService wired, EventBridge adapter fallback, canvas improvement cards |

### Inc 8: E2E Observability (Bonus)
**Theme**: Testing Infrastructure | **+~250 LOC across 11 files**

Comprehensive E2E observability improvements:

**E2E-Aware Activity Log** (`EventLogView.ts`):
- `detectE2eMode()` checks `_e2eEventTrace` existence (not length) — works when log opens before events fire
- E2E mode bypasses all 3 filter layers: `isSkippedEvent`, `excludedTypes`, `hiddenCategories`
- Asserted events highlighted with green left border (`ft-log-asserted` CSS class)
- "E2E Trace" badge in header, mode toggle hidden
- Window snapshot (`_e2eEventTraceSnapshot`, `_e2eAssertedEventsSnapshot`) survives plugin disable

**Activity Log Opens at E2E Start** (`fixtures.ts`, `journeyExecutor.ts`, `00-prerequisites.test.ts`):
- New `openActivityLog(cli)` helper — opens in right sidebar immediately after `startEventTrace()`
- Events captured live via wildcard subscription from the start of every test run
- Sidebar leaf recycling: reuse existing leaf instead of creating duplicates

**Event Trace CSV** (`globalTeardown.ts`):
- CSV output alongside existing .md and .json formats
- Enriched with perf metrics: `handler_count`, `dispatch_ms` joined from `perf.event.dispatched`
- Flattened perf columns: `duration_ms`, `size_bytes`, `row_count`, `service`, `metric`, `threshold`
- Proper RFC 4180 escaping via `csvRow()`/`csvField()` helpers
- Stable files alongside E2E Report in dev vault; timestamped archives in `traces/`

**Report Improvements** (`generate-e2e-report.mjs`, `run-e2e.mjs`):
- E2E Report frontmatter: `event_trace_json` and `event_trace_csv` wikilinks
- Canvas action group spacing: 3× node height between actions, 4× from step group to first action
- Outline panel leaf recycling (no duplicate sidebar entries)
- Console progress logging throughout report generation pipeline

### Inc 9: Journey Runner Hardening (Bonus)
**Theme**: Testing Infrastructure | **+~130 LOC across 5 files**

Bug fixes and tool improvements discovered through tool-showcase journey execution:

**Bug Fixes**:
- **Theme switching**: `app.customCss.setTheme()` → 3-step Obsidian API (`app.setTheme()` + `app.vault.setConfig('theme')` + `app.workspace.trigger('css-change')`)
- **create-file async race**: sync IIFE → async/await (`await app.vault.create()`)
- **Dangling markdown leaf**: teardown now closes editor tabs before deleting files (`close-leaves` tool)
- **executeCommand prefix**: `includes(":")` → `startsWith(PLUGIN_ID + ":")` to avoid prefixing non-plugin commands
- **Activity Log command ID**: `open-activity-log` → `flowti:open-event-log` (never actually opened before)

**Asserted Event Tracking** (`actionRunner.ts`):
- `executeAssert` event case pushes asserted types to `plugin._e2eAssertedEvents`
- Activity Log reads these to highlight asserted events with green accent

**Test Vault Alignment**:
- All test vault paths changed from `03 - Resources/Tested Journeys/` to `docs/journeys/` (matches dev vault structure)
- Traces path: `03 - Resources/Traces/` → `docs/reports/e2e/traces/`

### Inc 10: E2E UX and Reporting (Bonus)
**Theme**: Testing Infrastructure | **+~830 LOC across 11 files**

Major UX and reporting improvements to the E2E journey runner and interactive mode:

**New E2E Tool — `close-modals`** (`journeyTypes.ts`, `actionRunner.ts`, `toolCatalog.ts`):
- Removes all `.modal-container` elements from DOM
- Lifecycle tag — designed for teardown use
- Added automatic modal close as safety net in `journeyExecutor.ts afterAll` before teardown steps
- Added to tool-showcase and canvas-session journey teardown sections

**Visual Feedback for Assertions** (`highlight.ts`, `actionRunner.ts`):
- Gold outline (`#ffd54f`) for passing DOM assertions, red outline (`#ef5350`) with pulse for failures
- `highlightAssert(cli, selector, passed, label)` for DOM-based assertions (visible, text)
- `notifyAssert(cli, passed, label)` for non-DOM assertions (event, leaf, eval) — checkmark/cross notice
- All 6 assertion types now provide immediate visual feedback

**Visual Feedback for Wait Tool** (`actionRunner.ts`):
- Hourglass notice shown during wait: `⏳ ${description} (${ms}ms)` or `⏳ Waiting ${ms}ms…`
- Notice auto-dismisses when wait completes (duration matches ms)

**Activity Log E2E Filter Bypass** (`EventLogView.ts`):
- E2E mode now only filters `log.*` events (prevents infinite recursion)
- Normal mode continues using `isSkippedEvent()` + `excludedTypes` + `hiddenCategories`
- All infrastructure events (`error.*`, `plugin.*`, `service.*`, `command.*`, etc.) visible in E2E mode

**E2E Report Failure Surfacing** (`generate-e2e-report.mjs`):
- New `## Failures (N)` section at top of E2E Report (right after Summary)
- Each failed step shows: error message, DOM trace, recent events, console errors, plugin state
- Wikilinks to detailed step in Journey Report: `[[Journey#Step X: Title FAIL]]`
- Failed step titles in Journey Reports use `FAIL` suffix matching wikilink anchors

**Retry Deduplication** (`journey.ts`):
- New `recordResult()` method replaces existing entry with same step ID
- Prevents duplicate step entries when vitest `retry: 1` re-runs a failed test
- Applied to pass, fail, and skip result recording

**Template Variable Resolution Fix** (`generate-e2e-report.mjs`):
- Unresolved `{{variables}}` now render as `—` (em dash) instead of literal template syntax
- Fixes skipped step notices showing raw `{{tabChangeCount}}` in reports

**Report Section Separators** (`generate-e2e-report.mjs`, `run-e2e.mjs`):
- `---` horizontal rules between all major sections in Journey Reports, E2E Reports, Session Notes, Audit Reports

**Interactive Mode Redesign** (`run-e2e.mjs`):
- Post-run session view: re-run, build+re-run, edit selection, generate audit, back to menu, quit
- All-numeric main menu (1-5 + q): Start session → Build increment → Generate audit → Teardown → Rebuild
- Setup/teardown steps shown grayed out (dim ANSI) with `[setup]`/`[teardown]` labels, not selectable
- Journey number prompt shows single/multi examples: `(e.g. "2" or "1 3 4")`
- Teardown collapses all file navigator folders via file-explorer leaf API

### Inc 11: Frontend Refactor — Notice and Modal Services (Bonus)
**Theme**: Architecture / Quality | **+~1,200 LOC across 47 files (net −530 in main.ts)**

Extracted two infrastructure services from main.ts, reducing the monolith from ~960 LOC to ~430 LOC:

**NoticeService** (`src/infrastructure/ui/NoticeService.ts`, 179 LOC):
- Event-driven: listens for `notice.show`, `notice.success`, `notice.error`, `notice.throttled`, `notice.prompt`
- Throttle/batch deduplication (2s window per key) — previously inline in main.ts
- Interactive prompts with configurable buttons, emits `notice.prompt.responded`
- Implements `IDisposable` for cleanup

**ModalService** (`src/infrastructure/ui/ModalService.ts`, 543 LOC):
- Centralizes lifecycle for 7 modal types: QuickCapture, TrainResume, TrainTypePicker, TrainCapture, CanvasTemplatePicker, Input, SubscriptionManager
- Emits `modal.opened` / `modal.closed` for observability
- Text prompt support: `ui.openTextPrompt` → `modal.textPrompt.submitted` / `modal.textPrompt.cancelled`
- Domain services injected via setters (following UiCommandService pattern)

**Additional Changes**:
- 2 new event categories in catalog: "Notification", "Modal"
- 1 new command: `flowti:open-installer` (domain: "installer", category: "action")
- Inline styles refactored to CSS classes (`css/02-components.css`)
- Visual inspection warnings surfaced in E2E Report
- Rebuild bug fix in journey runner (stale module cache)
- E2E tools: `set-input`, `visual-inspection`, seed enhancements across all 7 journey JSONs

### Inc 12: E2E Eval Reduction — Native CLI Migration (Bonus)
**Theme**: Testing Infrastructure | **+~850 LOC across 11 files**

Systematic replacement of `cli.eval()` calls with dedicated ObsidianCli methods and native CLI commands:

**9 New Methods (native CLI wrappers)**:
- `enablePlugin()` refactored to use `plugin:enable` (was eval)
- `disablePlugin(id)` — `plugin:disable`
- `openFile(path, newTab?)` — `open path=... newtab`
- `appendFile(path, content)` — `append path=... content=...`
- `createFileOverwrite(path, content)` — `create path=... content=... overwrite`
- `setTheme(name)` — `theme:set name=...`
- `fileExists(path)` — `file path=...` (try/catch)
- `domCount(selector)` — `dev:dom selector=... total`
- `domText(selector)` — `dev:dom selector=... text`

**7 New Methods (eval wrappers + JSON commands)**:
- `domAttr(selector, attr)` — `dev:dom selector=... attr=...`
- `prependFile(path, content)` — `prepend path=... content=...`
- `moveFile(from, to)` — `move path=... to=...`
- `getTabs()` — `tabs format=json`
- `createFolder(folderPath)` — encapsulated `vault.createFolder()` eval
- `dismissNotices()` — encapsulated DOM eval to remove `.notice` elements
- `getNotices()` — encapsulated DOM eval to read notice text content

**3 New Journey Tools**: `set-input` (React-safe native property setter), `frontmatter` (property:set CLI + metadataCache eval), `query-trace` (getEventsSince with store)

**2 New Assert Subtypes**: `count` (exact element counting via domCount), `attr` (attribute value checking via domAttr)

**Refactored Files**: actionRunner.ts (27→12 evals), globalSetup.ts (10→5), globalTeardown.ts, fixtures.ts, navigation.ts, journey.ts, journeyExecutor.ts

**Result**: 88→60 eval calls (28 eliminated, 32% reduction). 66 total CLI unit tests.

### Inc 13: Tool Reference Journey (Bonus)
**Theme**: Testing Infrastructure / Documentation | **+~400 LOC across 3 files**

New Chapter 8 journey demonstrating all 26 E2E runner tools in a compact reference format:

**Journey Structure** (7 steps + setup + teardown):
- **Setup**: write-run-log, seed (folders + files), create-file, open-file, wait
- **Step 1**: Core interaction — command, click, input, set-input
- **Step 2**: Visual annotations — highlight (3 styles), notice, screenshot, wait, manual
- **Step 3**: Navigation, events, assertions — navigate, emit, assert (all 8 subtypes), query-trace, eval
- **Step 4**: File operations — create-file, open-file, frontmatter (set + read), delete-file
- **Step 5**: Theme and workspace — theme (light/dark), close-leaves, ribbon
- **Step 6**: WebViewer — open-url, scroll via executeJavaScript, click link, read page title
- **Teardown**: close-modals, close-leaves, delete-file, notice, screenshot, write-run-log, wait

**CSS Selector Fixes**: Corrected `.ft-tab-item` → `.ft-catalog-tab` and `.is-active` → `.ft-catalog-tab-active` in both tool-reference and tool-showcase journeys (matched WorkspaceShell.ts class names).

**New Files**: `tool-reference.journey.json`, `80-journey-tool-reference.test.ts`
**New npm Script**: `test:e2e:tool-reference`

### Inc 14: Journey Builder Spike (Bonus)
**Theme**: Feature Discovery | **+~350 LOC across 8 files**

Foundational spike for the Journey Builder feature — creating and editing E2E journeys from within Obsidian:

**EventBridge Adapter Fallback** (`EventBridge.ts`):
- `VAULT_MANAGED_EXTENSIONS` set (md, canvas, images, audio, video, pdf)
- `isVaultManaged()` checks file extension against known set
- `createViaAdapter()` helper for `adapter.write()` with folder creation
- All 4 file handlers (`file.create/read/update/delete.request`) auto-detect non-vault extensions and route through adapter API
- JSON files now work through the event-driven file system pipeline

**JourneyBuilderService Wiring** (`main.ts`, `JourneyBuilderService.ts`):
- Service instantiated with FileSystemClient + EventBus after canvas session service
- Listens for `journey-builder.exported`, builds JSON via `buildDefinitionJSON()`, writes via `IFileSystemClient.createFile()`
- Full lifecycle: `.start()` in onLayoutReady, `.stop()` in onunload
- View detach registered for `flowti-journey-builder`

**Sidebar Export Cleanup** (`JourneyBuilderSidebar.ts`):
- Removed direct file write — sidebar only emits `journey-builder.exported` event
- File write delegated to JourneyBuilderService through the event pipeline

**Canvas Improvement Cards** (`generate-e2e-report.mjs`):
- New constants: `IMPROVEMENT_WIDTH` (2× node), `IMPROVEMENT_HEIGHT` (3× node), `IMPROVEMENT_GAP` (2× node)
- Yellow (`color: "3"`) text nodes stacked above step groups
- Markdown content: title, description, priority
- `improvements` field added to `JourneyStep` interface and passed through `toJourneyStep()`

**Journey Builder Blueprint** (`journey-builder.journey.json`):
- 9 total improvements mapped to steps: R1-R6 from recommendations + 3 existing
- Step 03: Event Autocomplete (must-have)
- Step 04: Action Templates, Command Picker, Live JSON Preview, Assert Builder
- Step 05: Auto-generate test file, companion canvas

**obsidian-stub updates** (`obsidian-stub.ts`):
- Added `adapter` stub to `App.vault` mock (exists, read, write, mkdir, remove)

### New Events (24)
- `canvas.template.created`, `canvas.session.started`, `canvas.session.activity`, `canvas.session.completed`
- `signal.health.checked`, `signal.health.changed`
- `inbox.file.routed`
- `notice.show`, `notice.success`, `notice.error`, `notice.throttled`, `notice.prompt`, `notice.prompt.responded`
- `modal.opened`, `modal.closed`, `ui.openTextPrompt`, `modal.textPrompt.submitted`, `modal.textPrompt.cancelled`
- `journey-builder.opened`, `journey-builder.create-new`, `journey-builder.metadata.updated`, `journey-builder.step.added`, `journey-builder.exported`, `journey-builder.open-existing`

### New Settings (2)
- `inboxAutoRoutingEnabled` (boolean, default false)
- `inboxRoutingRules` (array, 4 default rules)

### New Commands (1)
- `flowti:open-installer` (domain: "installer", category: "action")

### Key Learnings

**Obsidian Theme API**: `app.customCss.setTheme()` sets community CSS themes, NOT dark/light mode. The correct API requires three calls: `app.setTheme('obsidian'|'moonstone')`, `app.vault.setConfig('theme', ...)`, and `app.workspace.trigger('css-change')` (discovered via [obsidian-system-dark-mode](https://github.com/kepano/obsidian-system-dark-mode) plugin source).

**Sidebar Leaf Management**: `app.workspace.getRightLeaf(false)` always creates a new leaf — repeated calls clutter the sidebar. Pattern: check `getLeavesOfType()` first, `revealLeaf()` if found, only `getRightLeaf(false)` as fallback.

**E2E Activity Log Timing**: The Activity Log opens AFTER `startEventTrace()` when the trace array exists but is empty. Checking `trace.length === 0` was wrong — must check array existence (`!== undefined`) to detect E2E mode when no events have fired yet.

**CSV Escaping**: Manual string concatenation with commas is fragile for JSON payloads. Always use a proper `csvField()` helper that quotes fields containing commas, double-quotes, or newlines (RFC 4180).

**perf.event.dispatched Correlation**: Each domain event has a matching `perf.event.dispatched` entry with `{ eventType, handlerCount, durationMs }`. These can be joined by event type (consuming in order) to enrich trace data with dispatch performance metrics.

**Vitest Retry and Result Accumulation**: With `retry: 1`, vitest re-runs the `it()` callback but `beforeAll` doesn't re-run — shared state (like `JourneyRunner.results[]`) accumulates both attempts. Must deduplicate by step ID to avoid duplicate entries in reports.

**Obsidian File Explorer API**: `app.workspace.getLeavesOfType('file-explorer')[0].view.fileItems` gives access to all folder items. Each has `setCollapsed(true)` for programmatic folder collapse. Useful for resetting visual state after teardown.

**E2E Filter Layering**: The Activity Log has 3 filter layers: `isSkippedEvent()` (infrastructure prefixes), `excludedTypes` (user-configured), `hiddenCategories` (UI toggles). In E2E mode, only `log.*` must be filtered (prevents infinite recursion from logging the log event); all other infrastructure events are valuable for debugging.

**Service Extraction from main.ts**: When extracting services from a monolithic plugin entry point, use the event-driven pattern: services subscribe to events and emit results, avoiding direct coupling. Domain services can be injected via setters when they're registered later in the boot sequence. This allowed main.ts to shrink from ~960 LOC to ~430 LOC while improving testability.

**React-Safe Input Setting**: When testing applications that use React-style state management, `el.value = x` doesn't trigger change handlers. Use `Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set?.call(el, value)` followed by dispatching `input` and `change` events. This pattern also applies to Obsidian's Preact-based UI components.

**WorkspaceShell CSS Classes**: Tab items use `ft-catalog-tab` (not `ft-tab-item`) and active state uses `ft-catalog-tab-active` (not `.is-active`). Always verify selectors against actual source code (WorkspaceShell.ts) rather than assuming common naming conventions.

**Native CLI vs Eval Trade-offs**: Obsidian 1.12+ CLI commands (`dev:dom`, `file`, `plugin:enable`, `theme:set`) are more reliable than `cli.eval()` — no string escaping issues, no async race conditions, deterministic output format. Reserve eval for operations without CLI equivalents: DOM manipulation (`.click()`, `.insertText()`), EventBus access, window properties, complex Obsidian API chains.

## Remaining Work

The cycle is complete. All 8 planned PBI increments (0–7) delivered. Seven bonus increments (8–14) significantly hardened testing infrastructure, extracted services from main.ts, eliminated 32% of E2E eval calls, created a comprehensive Tool Reference journey, and laid the foundation for the Journey Builder feature. Remaining items for cycle close:

- [x] DoD checklist: Final review, retrospective, cycle doc finalization
- [x] Memory update: Sync MEMORY.md with new patterns and learnings
- [x] Journey Builder PRD created (core feature, Cycle 55 anchor)
- [x] Backlog refinement and Cycle 55 planning

### Deferred to Future Cycles (Cycle 55+)
- **Journey Builder** — Full feature (PRD-JB, anchor for Cycle 55). See [[Journey Builder PRD]]
- Journey step metadata population for existing journeys (Getting Started, Component Library)
- Per-step `settleMs` configuration on JourneyStep
- WebViewer highlight injection (target: "webview" on highlight tool — prototype exists but untested in journey)
- Remaining 60 eval calls — irreducible set (DOM manipulation, EventBus, workspace API, window flags)
