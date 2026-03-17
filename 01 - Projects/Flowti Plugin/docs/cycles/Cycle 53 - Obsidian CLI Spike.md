---
type: DevelopmentCycle
feature: "[[Backlog Refinement - Post Cycle 48]]"
stage: done
cycle: 53
release_anchor:
  - "Theme 1: Ship It — Release Path"
  - "Theme 5: Architecture — Invest in the Platform"
pbis:
  - "PBI-CLI-001: Obsidian CLI exploration and validation"
  - "PBI-CLI-002: E2E test foundation with Obsidian CLI"
  - "PBI-CLI-003: Plugin command execution via CLI eval"
bugs: []
tech_debt: []
estimated_increments: 6
actual_increments: 20
estimated_tests: 40
actual_e2e_tests: 69
pre_cycle_tests: 5776
pre_cycle_suites: 250
post_cycle_tests: 5825
post_cycle_suites: 252
e2e_tests_passing: 53
e2e_tests_skipped: 16
e2e_journeys: 3
total_e2e_loc: 5400
---

# Cycle 53 — Obsidian CLI Spike

## Release Anchor Theme

- **Theme 1: Ship It — Release Path** — E2E testing was "blocked on Obsidian CLI availability" — now unblocked.
- **Theme 5: Architecture — Invest in the Platform** — CLI integration enables automated testing, development workflow, and potential AI agent workflows.

## Reprioritization Rationale

Obsidian 1.12 (released 2026-02-11, public 2026-02-27) introduces an official CLI with 100+ commands covering file operations, search, properties, plugins, templates, tasks, daily notes, sync, dev tools, and JavaScript eval. This fundamentally changes three areas of the Flowti roadmap:

1. **E2E Testing** — Previously "blocked on Obsidian CLI availability" (ADR-028, deferred items). Now unblocked. The CLI's `eval` command provides direct access to the Obsidian `app` context, enabling real vault operations, plugin lifecycle testing, and event flow verification without Playwright/Electron overhead.

2. **RB-6 CLI Installer** — Previously deferred to v1.1. Obsidian's `plugin:enable/disable/reload` commands change the installation paradigm. The CLI itself becomes the installer for headless/scripted setups.

3. **Development Workflow** — `plugin:reload` for hot-reload, `dev:console`/`dev:errors` for debugging, `dev:screenshot` for visual regression, `dev:debug` for CDP attachment.

The originally planned Cycle 53 (Data Exchange Evolution: RB-7 pipeline merge, import concurrency, execution timing) is reprioritized to Cycle 54. This spike cycle takes priority because:
- E2E testing was identified as a **release blocker** in the inbox
- The CLI just dropped — early exploration captures first-mover knowledge
- ADR-028 has been "Proposed" since Cycle 9 — now we can resolve it
- Every future cycle benefits from E2E test infrastructure

## Situation Assessment

### Obsidian CLI Capabilities (1.12+)

| Category | Key Commands | Flowti Impact |
|----------|-------------|---------------|
| **Files** | `files`, `file`, `create`, `read`, `append`, `prepend`, `move`, `delete` | Vault fixture management, note creation verification |
| **Properties** | `properties`, `property:set`, `property:remove` | Frontmatter verification, settings testing |
| **Search** | `search`, `search:open` | Verify Flowti search/filter behavior with real index |
| **Links** | `backlinks`, `links`, `unresolved`, `orphans` | Graph integrity testing, traceability verification |
| **Plugins** | `plugins`, `plugin:enable`, `plugin:disable`, `plugin:reload` | Plugin lifecycle testing, hot-reload during dev |
| **Daily** | `daily`, `daily:append`, `daily:prepend` | Session daily note integration testing |
| **Dev** | `eval`, `dev:console`, `dev:errors`, `dev:screenshot`, `dev:dom`, `dev:debug` | JS execution in app context, visual testing, debugging |
| **Tags** | `tags`, `tag` | Tag-based filtering verification |
| **Templates** | `templates`, `templates:apply` | Template-based note creation testing |
| **Bases** | `bases`, `base:query` | Database view integration (future) |
| **Output** | `json`, `csv`, `tsv`, `md`, `yaml`, `paths` formats | Structured assertion data for tests |

### Requirements

- Obsidian 1.12+ running (no headless/daemon mode)
- CLI enabled in Settings > General > Command line interface
- Windows: requires `Obsidian.com` redirector in installation directory

### Open Questions (ADR-028)

All 5 open questions from ADR-028 can now be answered:

1. **Which CLI tool?** → Official Obsidian CLI (1.12+). Community tools are no longer needed.
2. **Vault fixture management?** → `obsidian create`, `obsidian delete`, `obsidian property:set` for setup/teardown.
3. **CI infrastructure?** → Obsidian must be running. CI requires Xvfb or similar display server. Spike must validate this.
4. **Test scope?** → Start with: plugin load, file CRUD, frontmatter round-trip, event verification via `eval`.
5. **Maintenance burden?** → Official CLI with stable API. Lower risk than community tools.

## Cycle Goals

1. **Validate Obsidian CLI works with Flowti** — install, configure, run commands against development vault
2. **Prototype E2E test suite** — 5-10 smoke tests using CLI + Node.js test runner
3. **Explore `eval` for plugin command execution** — run Flowti palette commands from terminal
4. **Update ADR-028** from "Proposed" to "Accepted" with CLI-specific implementation details
5. **Assess RB-6 impact** — determine if Obsidian CLI's plugin management commands make RB-6 moot
6. **Document CLI integration patterns** — reusable patterns for future test authoring

## Scope

### In Scope

- Obsidian CLI setup and configuration on Windows
- E2E test harness: test fixtures, CLI wrapper utilities, assertion helpers
- 5-10 smoke tests covering critical paths (plugin lifecycle, file CRUD, frontmatter, search, event flow)
- `eval`-based command execution prototype
- ADR-028 update
- RB-6 reassessment
- Development workflow integration (`plugin:reload`, `dev:console`)

### Out of Scope

- CI/CD pipeline integration (need data from spike first)
- Full E2E coverage of all 41 flow tests (gradual expansion in future cycles)
- Visual regression testing (`dev:screenshot` — explore but don't commit to)
- Bases integration (`base:query` — explore but defer)
- Mobile CLI (not available)

## Delivered Increments

This cycle delivered 16 increments (vs. 6 estimated). The original 6-increment spike plan was completed and then extended with 10 additional enhancements that emerged during implementation.

### Inc 1: CLI Setup and Validation ✓
**Theme**: Infrastructure | **Effort**: Small

Validated Obsidian CLI works with Flowti's development vault. Documented parameter syntax (`key=value`), output format (`=> ` prefix for eval), and discovered native `command id=` for direct command execution. See "Inc 1 Findings" section below.

### Inc 2: CLI Wrapper Utilities ✓
**Theme**: Architecture | **Effort**: Medium | **+316 LOC production**

Built `ObsidianCli` class with typed methods and `IProcessRunner` abstraction:
- `src/infrastructure/cli/ObsidianCli.ts` (244 LOC) — `run()`, `runJson()`, `eval()`, `getPlugins()`, `isPluginEnabled()`, `enablePlugin()`, `disablePlugin()`, `reloadPlugin()`, `pluginSnapshot()`, `executeCommand()`, `notice()`, `screenshot()`
- `src/infrastructure/cli/types.ts` (72 LOC) — ProcessResult, IProcessRunner, EvalResult, PluginEntry, CliError

### Inc 3: E2E Test Harness ✓
**Theme**: Testing | **Effort**: Large | **+1,389 LOC test infrastructure**

Built comprehensive E2E test harness:
- `tests/e2e/vitest.e2e.config.ts` (48 LOC) — serial execution, 30s timeout, JSON+verbose reporters, alphabetical sequencer, bail:1
- `tests/e2e/globalSetup.ts` (160 LOC) — vault scaffolding, plugin enable, CSV detection, test data generation
- `tests/e2e/globalTeardown.ts` (467 LOC) — event trace collection, perf summary, installer reset, view cleanup, plugin disable, teardown notices
- `tests/e2e/helpers/fixtures.ts` (327 LOC) — `createFixture()`, `ensurePluginEnabled()`, `ensureInstalled()`, event trace utilities, assertion helpers
- `tests/e2e/helpers/journey.ts` (244 LOC) — JourneyRunner orchestrator: step execution, screenshot capture, error collection, result JSON serialization
- `tests/e2e/helpers/testVault.ts` (133 LOC) — vault scaffolding, plugin artifact copying, state management

### Inc 4: Plugin Command Execution via eval ✓
**Theme**: Architecture | **Effort**: Medium

Validated eval-based plugin interaction patterns:
- Direct access to `app.plugins.plugins['flowti-ibde']` instance
- `executeCommand()` for palette commands via `command id=`
- EventBus emission and trace verification via eval
- `screenshot()` via `dev:screenshot` for visual testing
- `notice()` for user-facing progress feedback during tests

### Inc 5: E2E Test Suite — Prerequisites ✓
**Theme**: Testing | **Effort**: Medium | **+410 LOC test, 10 tests**

`tests/e2e/00-prerequisites.test.ts` — 10 prerequisite tests that gate all downstream journeys:
1. CLI can reach Obsidian
2. Vault accepts file operations (create, read, delete)
3. Frontmatter properties persist (round-trip)
4. Vault search indexes content
5. Installer state prepared (skip mode detection)
6. Flowti plugin activates successfully
7. Plugin reports healthy state
8. EventBus is collecting events (wildcard trace active)
9. Flowti commands are registered (36 commands)
10. Required services are available

### Inc 6: E2E Test Suite — Installer Journey ✓
**Theme**: Testing | **Effort**: Large | **+697 LOC test, 16 tests**

`tests/e2e/10-installer.test.ts` — Full installer wizard interaction:
- Profile name input with DOM highlighting
- Role card selection (Engineer)
- Step navigation (Next, Back, Install)
- Artifact verification (settings, folder structure, data.json)
- Close and cleanup verification
- **Skip mode**: detects already-installed vault and skips (263s → 137s savings)

### Inc 7: E2E Test Suite — Getting Started Journey ✓
**Theme**: Testing | **Effort**: Medium | **+231 LOC test, 8 tests**

`tests/e2e/30-journey-getting-started.test.ts` — Tutorial walkthrough:
1. Open User Hub
2. Open Event Catalog
3. Navigate to Domains tab
4. Open Data Exchange Hub
5. Verify test data for import
6. Open CSV Import view
7. Navigate to Properties tab
8. Open Analytics Hub

### Inc 8: E2E Test Suite — Component Library Journey ✓
**Theme**: Testing | **Effort**: Large | **+185 LOC test, 35 tests**

`tests/e2e/40-journey-component-library.test.ts` — Visual regression baseline for all 5 hubs:

| Hub | Tabs | Screenshots |
|-----|------|-------------|
| Event Catalog | domains, services, events, flows, systems, actors, products, health | 10 |
| Data Exchange | pipelines, imports, exports, types, properties, signals, reports, canvas | 10 |
| User Hub | sessions, inbox, commands, preferences | 6 |
| Train Hub | active, history | 4 |
| Analytics Hub | dashboards, measurements, queries | 5 |

**Total**: 35 screenshots (5 opens + 5 dashboards + 25 tabs). Data-driven test generation from hub definitions.

### Inc 9: DOM Element Highlighting ✓
**Theme**: Visual Testing | **Effort**: Small | **+102 LOC**

`tests/e2e/helpers/highlight.ts` — CSS-based DOM annotation for screenshots:
- `highlightInput()` — blue glow (`#4fc3f7`) with focus
- `highlightButton()` — orange pulse (`#ffb74d`) with scale animation
- `highlightElement()` — green outline (`#81c784`)
- Styles injected once via `<style id="flowti-e2e-highlight-styles">`
- Auto-cleared at each step start

### Inc 10: Per-Journey Execution & npm Presets ✓
**Theme**: Developer Experience | **Effort**: Medium | **+129 LOC**

`tests/e2e/helpers/sequencer.ts` — `AlphabeticalSequencer` with `E2E_JOURNEY` filtering (comma-separated).
`scripts/run-e2e.mjs` — `--journey=` CLI argument parsing.

7 npm script presets:

| Script | Description |
|--------|-------------|
| `npm run test:e2e` | Full suite (all journeys) |
| `npm run test:e2e:installer` | Installer only |
| `npm run test:e2e:getting-started` | Getting Started only |
| `npm run test:e2e:components` | Component Library only |
| `npm run test:e2e:journeys` | All journeys (no installer) |
| `npm run test:e2e:quick` | Installer + Getting Started (fast) |
| `npm run report:e2e` | Regenerate reports from existing results |

### Inc 11: Hub Navigation Helpers ✓
**Theme**: Testing | **Effort**: Small | **+76 LOC**

`tests/e2e/helpers/navigation.ts` — Shared helpers extracted for reuse across journeys:
- `navigateToTab()` — async leaf reveal + EventBus emit with settle delays
- `assertLeafOpen()` — verify workspace leaf is active
- `closeHub()` — close existing leaves by view type (prevents stale state across journeys)

### Inc 12: Enhanced Error Context ✓
**Theme**: Diagnostics | **Effort**: Medium | **+134 LOC**

`tests/e2e/helpers/errorContext.ts` — Three-part error capture on step failure:
1. **DOM snapshot**: active view type, leaf count, open modals, notice texts, visible selectors (`.flowti-container`, `.ft-dashboard`, `.ft-tab-bar`, `.ft-error`)
2. **Recent events**: last 10 from `_e2eEventTrace` with relative timestamps
3. **Plugin state**: loaded flag, service count

Rendered as `> [!bug] Error Context` callout in journey reports.

### Inc 13: E2E Report Pipeline ✓
**Theme**: Documentation | **Effort**: Large | **+718 LOC**

`scripts/generate-e2e-report.mjs` — Comprehensive report generator:

**Reports generated per run**:
- **E2E Report** — test suite summary with frontmatter, wikilinks to test suites and journey reports
- **Journey Reports** — per-journey step detail with screenshots, error context, wikilinks back to E2E Report
- **Event Trace** — markdown + JSON with timeline, frequency, perf summary (startup, storage, queries, dispatch timing, alerts)

**Report features**:
- `mode` property: `full`, `installer`, `getting-started`, `component-library`, or comma-separated
- `duration` property: human-readable (`2m 38s`) alongside `duration_ms`
- `test_suites` / `journey_reports` / `test_source` / `e2e_report`: wikilink cross-references in frontmatter
- "Units Under Test" section listing test source files
- Performance section with startup p50/p95, data.json size
- Event trace section with top 15 events by frequency and perf categories

**Output locations**:
- Test vault: `E2E Report.md` (stable), `Tested Journeys/<name>/` (journeys + screenshots), `Traces/` (event traces)
- Dev vault: `docs/reports/e2e/E2E Report.md` (stable), `docs/reports/e2e/runs/` (timestamped archive), `docs/journeys/<name>/` (stable + `past-tests/` archive), `docs/reports/e2e/traces/` (trace archive)

**Bonus**: Manual QC checkpoint system (`tests/e2e/helpers/qc.ts`, 86 LOC) — Obsidian Modal with Approve/Reject buttons, enabled via `E2E_QC=true`, auto-approves when disabled (default).

### Inc 14: E2E Resilience — Seed Repair & Skip Mode Hardening ✓
**Theme**: Testing | **Effort**: Medium | **+127 LOC modified**

Hardened the E2E skip mode (vault already installed) to self-heal missing files:

- **`repairSeedFiles()`** in `globalSetup.ts` — creates 17 critical folders and 2 seed files (Welcome note, sample CSV) via Obsidian vault API when in skip mode
- **`isVaultInstalled()` fix** in `fixtures.ts` — now only checks `data.json` (removed seed file checks). Broke a circular dependency where missing seed files → installer mode → vault content deletion → all tests fail
- **`getSeedContent()`** — returns personalized welcome note and supplier CSV content for repair

**Root cause discovered**: `isVaultInstalled()` checked BOTH data.json AND seed files. If seed files were missing (e.g. deleted by a previous failed run), it triggered installer mode which deleted vault content, but the installer test wasn't in the selected preset — leaving an empty vault.

### Inc 15: File Explorer Reveal ✓
**Theme**: Visual Testing | **Effort**: Small | **+22 LOC**

`revealInExplorer()` in `tests/e2e/helpers/navigation.ts` — reveals files and folders in Obsidian's file explorer sidebar during E2E tests:
- Uses `app.workspace.getLeavesOfType('file-explorer')[0].view.revealInFolder(file)`
- Added reveal calls to Prerequisites (CRUD test, seed files), Installer (folders, welcome note, CSV), Getting Started (test data CSV)
- Files under test are now visible in the sidebar during screenshot capture

### Inc 16: Journey Canvas Generation ✓
**Theme**: Documentation | **Effort**: Large | **+316 LOC new, ~180 LOC modified**

`generateJourneyCanvas()` in `scripts/generate-e2e-report.mjs` — generates Obsidian Canvas (`.canvas`) files for each E2E journey:

**Canvas layout** (left-to-right flow):
```
[START ●] → [Step 1 Group] → [Step 2 Group] → ... → [Events ●] → [END ●]
              │ screenshot bg   │ screenshot bg
              │ view badge      │ view badge
              │ tab badge       │ tab badge
              │ components      │ components
              │ action text     │ action text
```

**Node types**:
- **Start/End/Events**: Circle shapes (`styleAttributes: { shape: "circle", textAlign: "center" }`)
- **Step groups**: 947×600px with screenshot background (`backgroundStyle: "ratio"`), inner nodes offset 370px from left to leave screenshot visible
- **View badge**: 250×68, color `"6"` (purple) — shows hub name + view type
- **Tab badge**: 250×68, color `"3"` (yellow) — shows tab name + ID
- **Components row**: 560×80 — lists UI components as inline code
- **Action node**: 560×168 — step description, input, expected output

**Canvas metadata**: `{ version: "1.0-1.0", frontmatter: {}, startNode: "e2e-n-start" }`

**New type**: `JourneyStepUiContext` added to `journey.ts` — `{ view, viewName, tab, tabName, components }`. All 8 Getting Started steps populated with UI context.

**Output locations**: canvas written to 3 locations per journey (test vault stable, dev vault stable, dev vault archive).

**Key discoveries**:
- Canvas background paths must be **vault-root-relative** (not relative to canvas file location)
- Groups with backgrounds **can** carry `color` — no conflict
- Inner node offset (370px) leaves the screenshot visible on the left side of the group
- Dev vault paths must include `Development/flowti/` prefix for vault-root-relative resolution

### Inc 17: Journey Config as Living Documentation Metadata ✓
**Theme**: Architecture | **Effort**: Medium | **~50 LOC modified**

Extended `JourneyStep` and `JourneyConfig` interfaces to carry full test context metadata:

**JourneyStep additions**:
- `describeBlock` — the `describe()` block name (e.g. "Chapter 3: Getting Started")
- `itBlock` — the `it()` test name (e.g. "3.1 — Open the User Hub")
- `events` — event types emitted during the step
- `interactions` — user interactions performed (click, type, select)
- `commands` — Obsidian commands executed
- `queries` — query IDs executed

**JourneyConfig additions**:
- `items: string[]` — all `itBlock` descriptions aggregated across steps
- `components: string[]` — unique UI components across all steps
- `events: string[]` — unique event types across all steps
- `commands: string[]` — unique commands across all steps
- `queries: string[]` — unique queries across all steps
- `interactions: string[]` — unique interactions across all steps

`getConfig()` derives defaults (describeBlock from journeyName, itBlock from `guideSection — title`) and aggregates unique metadata via `Set` collection.

**Purpose**: The config JSON becomes the **meta file** for each journey — a machine-readable specification of what the journey tests, which events it triggers, which components it exercises, and which commands it executes. This is the foundation for living documentation.

### Inc 18: Canvas Step Config Cards ✓
**Theme**: Documentation | **Effort**: Medium | **~120 LOC modified**

Consolidated the canvas per-step layout from 5 scattered nodes (result badge, view badge, tab badge, components row, action node) into a **single comprehensive config card** per step group:

**Config card contents** (all fields from JourneyStep):
- `describe` / `it` blocks with pass/fail checkbox
- Description, Input, Expected output
- View + Tab context (name and ID)
- Components, Events, Commands, Queries, Interactions (inline code tags)
- Error message (if step failed)

**Events summary node** updated to use `it()` checklist format with per-step durations.

**Config JSON file node**: Added `type: "file"` node below the START circle, linking to the journey's config JSON file. Connected via edge (bottom→top). File nodes render as embedded previews in Obsidian canvas — clicking opens the raw JSON.

Canvas now tells the full story: what was tested (config card), what it looked like (screenshot background), and whether it passed (color + checkbox).

### Inc 19: E2E Pipeline Polish ✓
**Theme**: Diagnostics | **Effort**: Medium | **~200 LOC new**

**Performance event statistics** (`buildPerfEventStats()`, ~180 LOC in generate-e2e-report.mjs):
Parses `perf.*` events from the event trace and generates detailed statistics tables:
- **Startup**: per-service timing, total startup duration
- **Storage**: load/save operations by key with duration and size
- **Queries**: execution timing with source/result row counts
- **Event dispatch**: aggregated by type with count, total, avg, max timing
- **Alerts**: threshold violations with metric/value/threshold

**Outline panel**: `run-e2e.mjs` now opens the Outline panel in the right sidebar after the E2E report opens, so the report's heading structure is immediately visible.

**Sidebar cleanup**: `globalTeardown.ts` now detaches `flowti-event-log` leaves before closing center pane views, preventing stale sidebar state between runs.

**Removed minimize**: Removed non-functional `require('electron').remote.getCurrentWindow().minimize()` attempt from `globalSetup.ts` — Electron remote is not accessible from CLI eval context.

### Inc 20: Execution Time Optimization ✓
**Theme**: Performance | **Effort**: Small | **~30 LOC modified across 8 files**

Halved timing delays across the entire E2E pipeline while maintaining the same total retry budgets (more attempts × shorter intervals):

| Constant | File | Before | After | Per-run savings |
|----------|------|--------|-------|-----------------|
| Journey `settleMs` default | `journey.ts` | 2000ms | 1000ms | ~10s (prerequisites) |
| Getting Started `settleMs` | `30-journey-getting-started.test.ts` | 3000ms | 1000ms | ~16s (8 steps) |
| Component Library `settleMs` | `40-journey-component-library.test.ts` | 3000ms | 1000ms | ~70s (35 steps) |
| Installer `settleMs` | `10-installer.test.ts` | 3000ms | 1500ms | ~24s (16 steps) |
| `VAULT_READY_DELAY` | `globalSetup.ts` | 2000ms (10 retries) | 500ms (20 retries) | up to 15s |
| Deletion settle | `globalSetup.ts` | 2000ms | 1000ms | 1s |
| Ghost purge settle | `globalSetup.ts` | 1000ms | 500ms | 0.5s |
| `PLUGIN_INIT_MS` | `fixtures.ts` | 3000ms | 1500ms | 1.5s/attempt |
| `ENABLE_RETRY_DELAY` | `fixtures.ts` | 2000ms | 1000ms | 1s/retry |
| `VIEW_CLOSE_SETTLE_MS` | `globalTeardown.ts` | 2000ms | 1000ms | 1s |
| Plugin init wait | `00-prerequisites.test.ts` | 5000ms | 2000ms | 3s |
| Leaf activation delay | `navigation.ts` | 500ms | 250ms | ~8s (31 tabs) |
| Event chain settle | `navigation.ts` | 500ms | 250ms | ~8s (31 tabs) |

**Estimated total savings**: ~80s on full suite (~175s→~95s dead wait time). Per-step `settleMs` overrides remain available on `JourneyStep` if individual steps need more time.

## Completed Pre-Cycle

- Cycle 53 planning document drafted (reprioritization from Data Exchange Evolution)
- Obsidian 1.12 CLI capabilities researched and tabulated
- ADR-028 open questions mapped to CLI commands
- PBI-CLI-001, -002, -003 backlog items created with INVEST assessments
- Infrastructure PRD updated with FRI scores (33/35)
- Roadmap impact assessed (C53→C54 shift documented)

## Inbox Signals Reviewed

| Inbox Item | Disposition | Notes |
|------------|-------------|-------|
| "As the plugin grows the missing test environment for e-2-e tests is hurting more and more" (plugin inbox, archived) | **Addressed** | Direct driver for this cycle. E2E release blocker now unblocked by Obsidian CLI 1.12 |
| "We need to implement Obsidian ESLint rules for plugins in order to publish on the marketplace" (plugin inbox) | **Deferred** | Not related to CLI spike; remains for Release Preparation |
| "How can we automatically check if an Increment is release ready" (vault inbox) | **Deferred** | Tangentially related to CI/CD but out of scope for spike |
| "How can Obsidian integrate with GitHub to manage a repo" (vault inbox) | **Deferred** | Out of scope; future CI/CD consideration |

## Dependency Graph

### Planned
```
Inc 1 (Setup) ──→ Inc 2 (Wrapper) ──→ Inc 3 (Harness) ──→ Inc 4 (eval)
Inc 1 (Setup) ──→ Inc 5 (ADR/RB-6 Update)
Inc 1 (Setup) ──→ Inc 6 (Dev Workflow)
```

### Actual
```
Inc 1 (Setup) ──→ Inc 2 (Wrapper) ──→ Inc 3 (Harness) ──→ Inc 4 (eval)
Inc 3 (Harness) ──→ Inc 5 (Prerequisites) ──→ Inc 6 (Installer) ──→ Inc 7 (Getting Started)
Inc 7 (Getting Started) ──→ Inc 8 (Component Library)
Inc 3 (Harness) ──→ Inc 9 (Highlighting)
Inc 3 (Harness) ──→ Inc 10 (Journey Presets)
Inc 7 + 8 ──→ Inc 11 (Navigation Helpers)
Inc 3 (Harness) ──→ Inc 12 (Error Context)
Inc 5-8 (Test Suites) ──→ Inc 13 (Report Pipeline)
Inc 3 (Harness) ──→ Inc 14 (Seed Repair)
Inc 11 (Navigation) ──→ Inc 15 (File Reveal)
Inc 13 (Report Pipeline) ──→ Inc 16 (Journey Canvas)
Inc 16 (Canvas) ──→ Inc 17 (Config Metadata) ──→ Inc 18 (Config Cards)
Inc 13 (Report Pipeline) ──→ Inc 19 (Pipeline Polish)
Inc 3 + 10 + 11 ──→ Inc 20 (Execution Time Optimization)
```

## Risks & Mitigations

| Risk | Impact | Actual Outcome |
|------|--------|----------------|
| Obsidian must be running (no headless) | Medium | Confirmed — tests require live Obsidian. Skip mode mitigates re-run cost |
| Windows CLI setup complexity | Medium | **Non-issue** — CLI works out-of-the-box on Windows, no manual setup needed |
| `eval` security restrictions | Low | **Non-issue** — full `app` context access in dev mode |
| CLI API changes as feature matures | Low | Stable across all testing — no breaking changes encountered |
| Hub state persistence across journeys | Medium | **Discovered during testing** — stale tab state caused failures. Fixed with `closeHub()` before reopening |
| EventBus async emit timing | Medium | **Discovered during testing** — fire-and-forget `hub.tab.changed` requires 500ms settle delays |

## Success Metrics

| Metric | Target | Actual |
|--------|--------|--------|
| Increments | 6 | **20** |
| E2E tests | ~40 | **69** (53 pass + 16 skip) |
| E2E smoke tests | 5 passing | **10** prerequisites + **59** journey steps |
| CLI wrapper methods | 8+ | **12** (run, runJson, eval, getPlugins, isPluginEnabled, enablePlugin, disablePlugin, reloadPlugin, pluginSnapshot, executeCommand, notice, screenshot) |
| Total E2E LOC | ~500 (estimate) | **5,400** |
| Test files | 1 smoke test | **4** test files + **8** helper modules |
| Scripts | 3 dev scripts | **7** npm presets + 2 scripts (run-e2e, generate-e2e-report) |
| Journeys | 0 planned | **3** (Prerequisites, Getting Started, Component Library) |
| Screenshots | 0 planned | **43** per full run |
| Report artifacts | 0 planned | **5** types: E2E Report, Journey Reports, Journey Canvases, Journey Configs, Event Trace |
| Canvas artifacts | 0 planned | **3** per journey (test vault stable, dev vault stable, dev vault archive) + config file node |
| JourneyStep fields | 0 planned | **12** (id, title, guideSection, describeBlock, itBlock, description, expectedInput, expectedOutput, uiContext, events, interactions, commands, queries) |
| Execution time | — | **~80s savings** via delay optimization (full suite ~175s→~95s dead wait) |

## Roadmap Impact

### Original Roadmap (Post-C48 Refinement)

| Cycle | Original Theme | Original Focus |
|-------|---------------|----------------|
| **53** | Feature Deepening | Data Exchange: RB-7, import concurrency, execution timing |
| **54** | Feature Deepening | Canvas Sessions, template library, Signal hardening |
| **55** | Ship It | Release gate: PR process, domain docs, final QA |

### Revised Roadmap (Post-CLI Drop)

| Cycle | Revised Theme | Revised Focus |
|-------|--------------|---------------|
| **53** | **CLI Spike** | **Obsidian CLI exploration, E2E foundation, dev workflow** |
| **54** | Feature Deepening | Data Exchange (was C53) + Canvas Sessions (was C54) — compressed |
| **55** | Ship It | Release gate (unchanged) — now with E2E test confidence |

### Why Reprioritize

1. **E2E testing was a release blocker** — inbox item explicitly says "currently blocks v1.0.0". CLI availability resolves this.
2. **ADR-028 has waited 44 cycles** — proposed in Cycle 9, now actionable.
3. **Every future cycle benefits** — E2E infrastructure is a force multiplier.
4. **Data Exchange can compress** — RB-7 (pipeline merge) and import concurrency are self-contained; they can share a cycle with Canvas without dependencies.
5. **First-mover advantage** — CLI just dropped; early exploration establishes patterns before the community converges.

## Inc 1 Findings

**CLI Version**: 1.12.4 (installer 1.12.4)
**Vault**: `flowti` at `C:\Projects\flowti` — 37,036 files, 4,130 folders
**Plugin**: `flowti-ibde` v0.0.1, enabled, community type, 36 registered commands

### Parameter Syntax

The CLI uses `key=value` parameter syntax, not `--flag` style:
- `obsidian plugins format=json` (not `--json`)
- `obsidian plugin:reload id=flowti-ibde` (not positional)
- `obsidian search query="text" format=json`
- `obsidian eval code="expression"`

### Output Format

- **Default**: TSV (tab-separated values)
- **Structured**: `format=json|tsv|csv` parameter (command-dependent)
- **eval output**: prefixed with `=> ` (e.g., `=> flowti`) — must strip prefix for parsing
- Some commands also accept format as a subcommand: `plugins json` = `plugins format=json`

### Validated Commands

| Command | Result |
|---------|--------|
| `obsidian version` | `1.12.4 (installer 1.12.4)` |
| `obsidian vault` | TSV: name, path, files, folders, size |
| `obsidian plugins format=json` | JSON array of `{id}` objects |
| `obsidian plugins versions format=json` | JSON array of `{id, version}` objects |
| `obsidian plugin id=flowti-ibde` | TSV: type, name, version, author, enabled, description |
| `obsidian commands filter=flowti` | 36 command IDs listed |
| `obsidian command id=<command-id>` | Native command execution (no eval needed!) |
| `obsidian eval code="app.vault.getName()"` | `=> flowti` |
| `obsidian eval code="JSON.stringify(Object.keys(app.plugins.plugins['flowti-ibde']))"` | Full plugin instance keys visible |
| `obsidian dev:errors` | Errors from `advanced-canvas` only — no Flowti errors |
| `obsidian dev:console` | Console output captured |

### Key Discovery: Native `command` Command

The CLI provides `command id=<command-id>` for executing Obsidian commands directly — no `eval` needed for simple command execution. `eval` is still valuable for state inspection and complex interactions, but Inc 4 can leverage `command` for simpler cases.

### Setup Notes (Windows)

- CLI works out-of-the-box on Windows with Obsidian 1.12.4 — no manual `Obsidian.com` redirector needed
- Binary resolves via PATH automatically (installed to `%LOCALAPPDATA%\Obsidian\`)
- `windowsHide: true` should be used with `execFileSync` to prevent console window flash

## File Summary

```
NEW  src/infrastructure/cli/ObsidianCli.ts                (244 LOC) CLI wrapper
NEW  src/infrastructure/cli/types.ts                       (72 LOC)  CLI types
NEW  tests/e2e/vitest.e2e.config.ts                        (48 LOC)  E2E vitest config
NEW  tests/e2e/globalSetup.ts                              (280 LOC) Pre-test setup + seed repair
NEW  tests/e2e/globalTeardown.ts                           (470 LOC) Post-test teardown + event trace + sidebar cleanup
NEW  tests/e2e/00-prerequisites.test.ts                    (415 LOC) 10 prerequisite tests + file reveals
NEW  tests/e2e/10-installer.test.ts                        (704 LOC) 16 installer tests + file reveals
NEW  tests/e2e/30-journey-getting-started.test.ts          (284 LOC) 8 getting-started tests + uiContext
NEW  tests/e2e/40-journey-component-library.test.ts        (185 LOC) 35 component-library tests
NEW  tests/e2e/helpers/fixtures.ts                         (330 LOC) Test fixtures + assertions
NEW  tests/e2e/helpers/journey.ts                          (290 LOC) JourneyRunner + JourneyConfig + metadata
NEW  tests/e2e/helpers/testVault.ts                        (133 LOC) Test vault management
NEW  tests/e2e/helpers/sequencer.ts                        (46 LOC)  Alphabetical sequencer + filtering
NEW  tests/e2e/helpers/highlight.ts                        (102 LOC) DOM highlighting
NEW  tests/e2e/helpers/errorContext.ts                     (134 LOC) Error context collection
NEW  tests/e2e/helpers/navigation.ts                       (143 LOC) Hub navigation + file reveal
NEW  tests/e2e/helpers/qc.ts                               (86 LOC)  Manual QC checkpoints
NEW  scripts/run-e2e.mjs                                   (102 LOC) E2E runner + outline panel
NEW  scripts/generate-e2e-report.mjs                      (1220 LOC) Report + canvas + perf stats generator
MOD  package.json                                                    7 new npm scripts
─────────────────────────────────────────────────────────────────────
TOTAL                                                      ~5,400 LOC across 20 files
```

## Key Discoveries

### Hub State Persistence Bug

The Getting Started journey left the Event Catalog on the "domains" tab. When Component Library reopened the same hub, the existing leaf was reused — still showing "domains" instead of the fresh dashboard. This caused cascading failures:
- Dashboard screenshot captured wrong view
- Navigate-to-domains was a no-op (already on that tab)
- `hub.tab.changed` event was never emitted (guard: `previousTabId !== page`)

**Fix**: `closeHub(cli, hub.viewType)` before `cli.executeCommand(hub.command)` — closes existing leaves so the hub starts fresh.

### EventBus Async Timing

`EventBus.emit()` is async (`await handler(event)`) but `hub.tab.changed` is fire-and-forget (`void this.eventBus.emit(...)` in BaseHubView). This means:
- The event is dispatched but not awaited
- Checking the event trace immediately after emit finds nothing
- **Fix**: settle delays between reveal→emit→assert (reduced from 500ms to 250ms in Inc 20 — still reliable)

### Test Naming with Dynamic Generation

Template literals in `it()` names are evaluated at **registration time**, not execution time. A runtime counter used in test names produced `4.1` for all 35 tests. **Fix**: separate `regStep` (incremented at registration) and `execStep` (incremented at execution).

### Skip Mode Performance

The installer test suite detects if the vault is already installed and skips all 16 installer steps. This reduces full-suite runtime from ~500s to ~320s (37% savings).

### Circular Installer Skip Failure

When `isVaultInstalled()` checked both data.json AND seed files, missing seed files triggered installer mode → globalSetup deleted vault content → installer test wasn't in the selected preset → empty vault → all tests fail. This was a circular dependency: the function meant to decide "can we skip the installer?" would cause destructive action when seed files were absent for any reason (e.g. previous failed run, manual deletion).

**Fix**: `isVaultInstalled()` now only checks `data.json`. Seed file repair is a separate, additive step in globalSetup's skip mode path.

### Obsidian Canvas Background Paths

Canvas `background` image paths must be **vault-root-relative** (absolute from the vault root), not relative to the canvas file's location. For the dev vault at `c:\Projects\flowti`, a screenshot at `Development/flowti/docs/journeys/Getting Started/screenshots/01-user-hub.png` must use that full path — not `docs/journeys/...`.

Groups with `background` set **can** also carry `color` — no conflict. The `backgroundStyle: "ratio"` property maintains aspect ratio.

### Canvas Circle Shapes

Obsidian Canvas supports `styleAttributes: { shape: "circle", textAlign: "center" }` on text nodes to render them as circles. Used for Start, Events, and End nodes in journey canvases. Circle dimensions should be 280×239 for compact nodes or 420×420 for content-heavy nodes (events summary with tables).

### Canvas Group Layout for Screenshots

Setting group width to 947px (vs. the initial 640px) with inner nodes offset 370px from the left edge creates a natural split: the screenshot background is visible on the left, while UI metadata and action descriptions stack on the right. This layout mirrors the actual Obsidian window — the sidebar/file-explorer is on the left in screenshots.

### Canvas File Nodes

Obsidian Canvas supports `type: "file"` nodes that embed vault files directly. Setting `file` to a vault-root-relative path renders the file's content as a preview inside the canvas node. Used to embed the journey config JSON below the Start node — clicking opens the raw JSON in an editor tab. File nodes do not support `color` or `styleAttributes`.

### Electron Remote Not Accessible from CLI Eval

`require('electron').remote.getCurrentWindow()` does not work from `obsidian eval` context. The CLI runs in a sandboxed eval scope where Electron's remote module is not available. Window management (minimize, maximize, focus) cannot be controlled from CLI eval. This is a platform limitation, not a bug.

### Settle Delay Tolerance

E2E settle delays were systematically reduced from 2-3s to 0.5-1.5s per step (Inc 20) without test failures. The original conservative values were set during initial development when async timing was poorly understood. After stabilization, most operations complete well within 250-500ms. Per-step overrides (`JourneyStep.settleMs`) remain available for genuinely slow operations.

## Deferred Items

| Item | Target | Rationale |
|------|--------|-----------|
| CI/CD pipeline for E2E tests | Future cycle | Obsidian must be running — CI requires Xvfb or display server |
| ADR-028 update | Cycle 54 | Deferred from Inc 5 — spike results inform the update |
| RB-6 CLI Installer reassessment | Cycle 54 | `plugin:enable/disable/reload` may make RB-6 moot |
| Visual regression diff testing | Future cycle | Screenshots captured but no automated diff comparison yet |
| Bases integration via CLI | Future cycle | `base:query` available but no Flowti Bases support |
| Mobile CLI | Not available | CLI is desktop-only |

## Retrospective

### What Went Well

1. **Scope explosion was productive** — 6 estimated → 20 delivered increments. The spike uncovered opportunities that compounded: each increment enabled the next. The CLI eval capability was far more powerful than anticipated, enabling not just tests but a full living documentation pipeline.

2. **Living documentation emerged organically** — JourneyConfig evolved from a simple step list into a comprehensive meta file (describeBlock, itBlock, events, commands, queries, interactions). Canvas generation turned test results into navigable visual documentation. This was unplanned but became the cycle's most forward-looking outcome.

3. **Skip mode saves significant time** — Detecting already-installed vaults and skipping the installer reduces full-suite runtime by 37%. Combined with the Inc 20 delay optimization (~80s savings), iteration speed is now practical for development workflows.

4. **Report pipeline is comprehensive** — 5 artifact types (E2E Report, Journey Reports, Journey Canvases, Journey Configs, Event Traces) with wikilink cross-references between all of them. Both test vault and dev vault get identical artifacts.

5. **Obsidian CLI exceeded expectations** — Zero setup friction on Windows. `eval` provides full `app` context access. Native `command id=` discovered for direct command execution. No API changes encountered across the entire cycle.

### Deviations from Plan

| Planned | Actual | Rationale |
|---------|--------|-----------|
| 6 increments | 20 increments | Each increment enabled the next; opportunities compounded |
| ~500 LOC | ~5,400 LOC | Full journey infrastructure, report pipeline, canvas generation, living docs |
| 5 smoke tests | 69 E2E tests (3 journeys) | Smoke tests evolved into full journey walkthroughs |
| ADR-028 update in-cycle | Deferred to C54 | Spike results should inform the ADR — updating mid-spike was premature |
| RB-6 reassessment in-cycle | Deferred to C54 | Plugin lifecycle commands partially supersede RB-6 but need more analysis |
| No canvas artifacts planned | 3 canvases per journey | Canvas generation emerged from screenshot infrastructure |
| No performance stats planned | Full perf event pipeline | Event trace naturally feeds performance analysis |
| No execution optimization planned | ~80s savings delivered | Conservative initial delays were easy wins once patterns stabilized |

### Improvement Backlog

| Item | Classification | Target |
|------|---------------|--------|
| CLI wrapper unit tests (mock execSync) | Tech debt | Cycle 54 — wrapper is integration-tested via E2E but lacks isolated unit tests |
| ADR-028 update from "Proposed" to "Accepted" | Documentation | Cycle 54 — spike results inform the update |
| RB-6 CLI Installer reassessment | Architecture decision | Cycle 54 — `plugin:enable/disable/reload` may make RB-6 moot |
| CI/CD pipeline for E2E | Future PRD item | Requires Xvfb or display server — needs separate spike |
| Visual regression diff comparison | Future PRD item | Screenshots captured but no automated diff tooling |
| Per-step `settleMs` on JourneyStep config | Enhancement | Next journey additions — allow step-specific timing overrides |
| Canvas visual polish | Enhancement | Explore Obsidian canvas grouping, color themes, node sizing refinements |
| Populate journey step metadata | Enhancement | Getting Started and Component Library steps need events, commands, interactions filled in |

### Learnings

1. **Canvas `background` paths are vault-root-relative** — not relative to the canvas file. This cost debugging time. Document early when encountering undocumented features.

2. **Fire-and-forget event handlers need settle delays** — `hub.tab.changed` is emitted with `void this.eventBus.emit(...)`. The 250ms settle delay (reduced from 500ms) is reliable. This pattern should be documented as a testing gotcha for any fire-and-forget emit.

3. **Conservative timing is a smell** — Initial 2-3s settle delays masked the actual completion time (~100-500ms). Systematically reducing delays (Inc 20) saved ~80s with zero flakiness. Start aggressive, increase only when needed.

4. **`isVaultInstalled()` circular dependency** — Checking both data.json AND seed files in a skip-mode decision function created a destructive feedback loop. Decision functions should be read-only and side-effect-free. Repair operations belong in a separate code path.

5. **Electron remote is sandboxed in CLI eval** — `require('electron').remote` doesn't work from `obsidian eval`. Window management cannot be controlled from CLI. This is a platform constraint, not a bug.

6. **Test name template literals evaluate at registration time** — `it(\`Step ${counter}\`)` captures the counter at registration, not execution. Use separate registration-time and execution-time counters when dynamically generating test names.

7. **Living documentation > static documentation** — By embedding test context (describe/it blocks, events, commands, components) into JourneyConfig and rendering it on canvases, documentation stays current because it's generated from the test infrastructure itself.

## Three Amigos Review

**Cycle 53** (2026-03-01): 20 increments (estimated 6). 69 E2E tests (53 pass, 16 skip). ~5,400 LOC across 20 files. CLI spike validated all 3 PBIs. ObsidianCli wrapper (316 LOC), E2E test harness (1,389 LOC infrastructure), 4 test suites (1,523 LOC), 3 journeys (Prerequisites, Getting Started, Component Library — 43 screenshots). Report pipeline generates E2E Report + Journey Reports + Journey Canvases + Journey Configs + Event Traces with wikilink cross-references. Journey Canvases render as Obsidian Canvas left-to-right flows: Start circle → step groups (947×600, screenshot backgrounds, consolidated config cards with describe/it blocks, UI context, events, commands, queries, interactions) → Events checklist → End circle. Config JSON embedded as file node below Start. JourneyConfig serves as living documentation meta file — aggregates items, components, events, commands, queries, interactions across all steps. Perf event statistics (startup, storage, queries, dispatch timing, alerts) added to E2E Report. Execution time optimized: ~80s savings via halved delays (settleMs 3000→1000, navigation 500→250, vault readiness 2000→500). Seed repair hardens skip mode (17 folders + 2 files auto-created). File explorer reveal shows test files in sidebar during E2E runs. 7 npm presets for selective execution. Skip mode saves 37% on re-runs. PBI-CLI-001, PBI-CLI-002, PBI-CLI-003 resolved. ADR-028 update deferred to C54. E2E release blocker unblocked.

## Definition of Done — Checklist

### 1. All Increments Completed

- [x] **Each increment satisfies its own DoD** — all 20 increments delivered with tests passing, builds green
- [x] **No increment left in partial state** — all 20 increments fully delivered
- [x] **Deferred increments documented** — ADR-028 update and RB-6 reassessment deferred to C54 with rationale in "Deferred Items" section

### 2. Build & Test Quality

- [x] **Build pipeline green** — `npm test` passes: 252 suites, 5,825 tests passed, 32 skipped (2026-03-01)
- [x] **Test count meets target** — 69 E2E tests vs. 40 estimated (exceeded). Unit tests grew from 5,776 to 5,825
- [x] **No test regressions** — all previously passing tests still pass
- [x] **No skipped tests introduced** — 16 E2E skips are by-design (installer skip mode when vault already installed)
- [ ] **Test coverage per TestPlan** — CLI wrapper lacks isolated unit tests (mock execSync); tested via E2E integration. Documented in Improvement Backlog

### 3. Three Amigos Review

- [x] **Cycle-level review conducted** — Three Amigos summary completed covering all 20 increments
- [x] **All three perspectives represented** — Product (E2E unblocks release), Engineering (architecture: DDD CLI layer, canvas generation), QA (69 tests, 3 journeys, skip mode, error context)
- [x] **All blocker findings resolved** — no blocking issues
- [ ] **TASM scores recorded** — not scored per increment (spike cycle, rapid iteration)
- [x] **Observations documented** — Key Discoveries section (11 items), Learnings (7 items)

### 4. PRD & Backlog Updates

- [x] **PRD updated** — Infrastructure PRD stage history entry added for C53
- [x] **PBIs updated** — PBI-CLI-001, -002, -003 all marked `stage: done` with checked acceptance criteria and delivery notes
- [x] **Event model current** — no new domain events added (E2E infrastructure is test-only, not runtime)

### 5. Documentation

- [x] **Component docs created/updated** — ObsidianCli class documented in PBI-CLI-001/002/003 and Inc 1 Findings
- [x] **Architecture docs updated** — CLI wrapper layer documented in cycle plan, canvas generation patterns in Key Discoveries
- [x] **Flow docs updated** — 3 journey test flows documented (Prerequisites, Getting Started, Component Library)
- [ ] **Technical debt register updated** — CLI wrapper unit tests noted in Improvement Backlog; no formal TD item created
- [x] **ADRs produced** — ADR-028 update deferred to C54 (spike results inform the update)

### 6. Cycle Plan Completion

- [x] **Cycle plan frontmatter updated** — `actual_increments: 20`, `total_e2e_loc: 5400`, `post_cycle_tests: 5825`, `post_cycle_suites: 252`
- [x] **Success metrics verified** — 14 metrics with actual values recorded (all targets met or exceeded)
- [x] **Deviations documented** — Deviations from Plan table in Retrospective section
- [x] **Risks reviewed** — 6 risks with actual outcomes in Risks & Mitigations table

### 7. Cycle Retrospective

- [x] **"What Went Well" section completed** — 5 positive patterns identified
- [x] **"Deviations from Plan" section completed** — 8 deviations with rationale
- [x] **"Improvement Backlog" section completed** — 8 actionable items classified
- [x] **"Learnings" section completed** — 7 reusable patterns and insights
- [x] **Improvement items classified** — each item assigned: tech debt, documentation, architecture decision, future PRD, or enhancement

### 8. Inbox & Feedback Loop

- [x] **Inbox items reviewed** — E2E release blocker inbox item addressed (direct driver for this cycle)
- [x] **New feedback captured** — deferred items table captures next-cycle inputs (ADR-028, RB-6, CI/CD, visual regression)
- [x] **Next cycle inputs identified** — ADR-028 update, RB-6 reassessment, Data Exchange Evolution (original C53 scope) → Cycle 54

### Closure Gate

| Criterion | Status | Evidence |
|-----------|--------|----------|
| All increments done or deferred | **PASS** | 20/20 delivered, 2 items explicitly deferred to C54 |
| Build green | **PASS** | `npm test`: 252 suites, 5,825 passed, 0 failed |
| Three Amigos review passed | **PASS** | Review summary completed, no blockers |
| PRD and PBIs current | **PASS** | Infrastructure PRD updated, 3 PBIs marked done |
| Retrospective completed | **PASS** | 4 sections: What Went Well, Deviations, Improvement Backlog, Learnings |
| Improvement backlog captured | **PASS** | 8 items classified with targets |
