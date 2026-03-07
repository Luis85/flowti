---
domain: Flowti
plugin: "[[Development/flowti/README|README]]"
type: ProductRequirementsDocument
stage: development_ready
version: 2
maturity: L1
created: 2026-03-07
updated: 2026-03-07
supplier_prd: "[[Developer Experience PRD]]"
related_events: []
maturity_score_strategy: 3
maturity_score_scope: 3
maturity_score_architecture: 3
maturity_score_event_integration: 1
maturity_score_data_model: 2
maturity_score_ui_consistency: 3
maturity_score_validation_testing: 2
business_value: 4
implementation_cost: 2
maintenance_cost: 2
discovery_cost: 1
design_cost: 2
test_cost: 2
priority: 1
tags:
  - cli
  - developer-experience
  - onboarding
  - automation
  - ai-agent
---

# PRD: Flowti CLI

---

## 1. Problem Statement

Managing multiple development projects across an Obsidian vault involves:

- **Discovery friction** — no single entry point to understand available commands, pipelines, and scaffolding tools across projects.
- **Script sprawl** — each project has its own npm scripts with overlapping names that are difficult to navigate without tribal knowledge.
- **No scaffolding** — creating a new Hub, Plugin, or Component requires copy-pasting from existing code and manually wiring domain events, tests, CSS layers, and documentation.
- **Per-project configuration** — each project has different build commands, test runners, publish endpoints, and review workflows, but no unified way to manage them.
- **AI Agent gap** — LLM-based coding agents cannot explore interactive menus; they need deterministic, non-interactive commands with predictable output and exit codes.
- **Stale documentation** — CLI capabilities change with every cycle, but manual documentation drifts out of sync.

---

## 2. Outcome

After implementation, developers and AI agents will have:

- A single entry point (`./flowti.cmd` or `npm run dev`) with a two-stage interactive menu: project selection → project detail.
- Per-project configuration via `configs/flowti.config.json` with auto-scaffolding from `package.json` on first selection.
- 7 project tools: Make, Build, Review, Publish, Reports, Dev Tools, Npm Scripts — some always available, some config-mapped.
- Hub, Plugin, and Component scaffolding that generates production-ready boilerplate following Flowti's DDD, EventBus, and BaseHubView patterns.
- A gated publish pipeline that enforces build → test → distribute sequencing per project.
- E2E review with test vault isolation (created outside the git repository).
- Non-interactive commands for AI agent tool use with deterministic exit codes.
- Auto-generated reports (test, coverage, codebase, complexity) per project.

---

## 3. Scope

### In Scope

- Two-stage interactive menu (project selection → project detail with 7 tools)
- Project discovery from two directories (`01 - Projects/` and `Development/`)
- Per-project configuration via `configs/flowti.config.json` with auto-scaffolding
- Hub, Plugin, and Component scaffolding
- Gated publish pipeline with per-project endpoints
- E2E review with test vault isolation (outside git repository)
- Report generation (test, coverage, codebase, complexity)
- Man-page system with contextual help
- Info command with live project diagnostics
- Non-interactive command dispatch for AI agent tool use
- Persistent state (selected project, project source) via `.flowti-state.json`

### Out of Scope

- GUI-based CLI (electron/web)
- Remote CLI execution (SSH, CI/CD integration)
- Plugin marketplace publishing (BRAT/community plugins)
- Watching for CLI source changes (self-rebuilding CLI)
- Interactive prompts for AI agents (agents use non-interactive mode exclusively)

---

## 4. UX Entry Points

### Human Developer

| Entry Point | Command | Context |
|-------------|---------|---------|
| Interactive menu | `./flowti.cmd` or `npm run dev` | Two-stage menu: select project → project tools |
| Quick build | Select project → key `2` | Run the project's configured build command |
| Scaffold | Select project → key `1` | Generate hub, plugin, component, or journey files |
| Review | Select project → key `3` | E2E journey review with test vault management |
| Publish | Select project → key `4` | Gated pipeline: build → test → distribute |
| Reports | Select project → key `5` | Run the project's configured reports command |
| Npm scripts | Select project → key `7` | Browse and run any script from package.json |
| In-menu help | Press `?` in any menu | Contextual help for the current menu |

### AI Agent (Tool Use)

| Capability | Command | Expected Output |
|-----------|---------|----------------|
| Discover commands | `npm run flowti -- help` | Structured help text (parseable) |
| Build project | `npm run flowti -- build` | Exit 0 on success, non-zero on failure |
| Run tests | `npm run flowti -- test` | Exit 0 if all tests pass |
| Scaffold code | `npm run flowti -- make:hub --name=X --tabs=a,b` | File list output, exit 0 |
| Check project | `npm run flowti -- info` | Structured project metadata |
| Generate reports | `npm run flowti -- reports` | Generated report files |

---

## 5. Functional Requirements

### FR-01: Interactive Menu System

- [x] FR-01.1: Start menu listing projects from `01 - Projects/` and `Development/` directories
- [x] FR-01.2: Project detail menu with 7 tools (Make, Build, Review, Publish, Reports, Dev Tools, Npm Scripts)
- [x] FR-01.3: Sub-menus with numbered options and separator support
- [x] FR-01.4: ANSI color output (cyan options, green success, red errors, dim hints)
- [x] FR-01.5: Quit with `q` from any menu, return to start menu with `b`
- [x] FR-01.6: Help with `?` in any menu showing contextual man-page
- [x] FR-01.7: Command execution with timing display
- [x] FR-01.8: Persistent state — selected project remembered across sessions via `.flowti-state.json`

### FR-02: Non-Interactive Commands

- [x] FR-02.1: All interactive actions available as `npm run flowti -- <command>` with `--flag=value` syntax
- [x] FR-02.2: Deterministic exit codes (0=success, non-zero=failure)
- [x] FR-02.3: Build commands: `build`, `build:full`, `build:increment`, `build:watch`, `build:distribute`
- [x] FR-02.4: Test commands: `test`, `test:increment`, `test:e2e`
- [x] FR-02.5: Publish commands: `publish`, `publish:all`
- [x] FR-02.6: Report commands: `reports`, `report:{id}`, `reports:audit`
- [x] FR-02.7: Dev tool commands: `dev:reload`, `dev:console`, `dev:errors`, `dev:check`, `dev:lint`, `dev:fix-frontmatter`, `dev:testdata`
- [x] FR-02.8: Make commands: `make:hub --name=X`, `make:plugin --name=X`
- [x] FR-02.9: Info and help: `info`, `help [section]`

### FR-03: Hub Scaffolding

- [x] FR-03.1: Prompt for hub name, icon, hub type (domain/utility/analytics), initial tabs
- [x] FR-03.2: Generate BaseHubView subclass with TabDef[], onTabRender, constructor
- [x] FR-03.3: Generate domain types (page union, tab definitions)
- [x] FR-03.4: Generate domain events (EventMap interface with hub lifecycle events)
- [x] FR-03.5: Generate domain service stub (EventBus constructor, dispose pattern)
- [x] FR-03.6: Generate HubDashboardProvider (cross-hub summary integration)
- [x] FR-03.7: Generate vitest test file (happy-dom, BaseHubView mock patterns)
- [x] FR-03.8: Generate CSS layer file (auto-numbered based on existing layers)
- [x] FR-03.9: Generate feature PRD stub document
- [x] FR-03.10: Generate E2E journey stub JSON
- [x] FR-03.11: Skip existing files without overwriting

### FR-04: Plugin Scaffolding

- [x] FR-04.1: Prompt for plugin name, plugin ID, author
- [x] FR-04.2: Generate DDD folder structure (infrastructure, domain, ui, utils)
- [x] FR-04.3: Generate manifest.json with Obsidian plugin metadata
- [x] FR-04.4: Generate package.json with npm scripts following Flowti patterns
- [x] FR-04.5: Generate tsconfig.json with strict TypeScript settings
- [x] FR-04.6: Generate esbuild.config.mjs with CSS pipeline
- [x] FR-04.7: Generate main.ts with EventBus backbone
- [x] FR-04.8: Generate .gitignore with standard exclusions
- [x] FR-04.9: Abort if output directory already exists

### FR-05: Man-Page System

- [x] FR-05.1: 8 help sections (main, make, build, review, publish, reports, devtools, info)
- [x] FR-05.2: Accessible via `npm run flowti -- help [section]`
- [x] FR-05.3: Accessible via `?` in interactive menu context
- [x] FR-05.4: Each section documents options, commands, flags, and typical usage

### FR-06: Gated Publish Pipeline

- [x] FR-06.1: Three-stage pipeline: Build -> Test -> Publish
- [x] FR-06.2: Session-scoped state (build pass unlocks test, test pass unlocks publish)
- [x] FR-06.3: "Run all" option that executes stages sequentially, stopping on failure
- [x] FR-06.4: Visual pipeline state indicator (checkmark/circle per stage)

### FR-07: Auto-Generated CLI Documentation

- [x] FR-07.1: Generator script (`generate-cli-reference.mjs`) that parses CLI source
- [x] FR-07.2: Strips ANSI codes, extracts HELP sections, maps command descriptions
- [x] FR-07.3: Outputs vault note with YAML frontmatter (`type: CLIReference`)
- [x] FR-07.4: Includes tables: non-interactive commands, npm scripts, report generators, make config
- [x] FR-07.5: Runs automatically as part of `npm run generate:reports` and increment builds
- [x] FR-07.6: Registered in `flowti.config.json` as report `cli-ref`

### FR-08: Info Command

- [x] FR-08.1: Display plugin metadata (name, version, ID, author)
- [x] FR-08.2: Display source statistics (TS files, test files, CSS layers, scripts)
- [x] FR-08.3: Display dependency counts (production, development, npm scripts)
- [x] FR-08.4: Display git status (branch, commit, clean/dirty)
- [x] FR-08.5: Display config health (report count, endpoints file, config file)

### FR-09: Per-Project Configuration

- [x] FR-09.1: Each project configured via `configs/flowti.config.json`
- [x] FR-09.2: Auto-scaffolding — config created from `package.json` on first project selection
- [x] FR-09.3: Mappable tools (`tools.build`, `tools.reports`, `tools.devtools`) enable/disable menu items per project
- [x] FR-09.4: Publish config (`publish.build`, `publish.test`, `publish.outDir`, `publish.artifacts`, `publish.endpoints[]`)
- [x] FR-09.5: Review config (`review.journeysDir`, `review.runner`, `review.build`, `review.test`)
- [x] FR-09.6: CLI kernel config in `flowti-cli.config.json` — subsystem mappings, projects folder, capture directories

### FR-10: Developer Onboarding Journey

- [ ] FR-10.1: E2E journey testing the full onboarding flow: clone -> install -> build -> activate -> explore
- [ ] FR-10.2: Verify CLI help output is accessible and correct
- [ ] FR-10.3: Verify non-interactive build completes successfully
- [ ] FR-10.4: Verify Info command returns valid project data
- [ ] FR-10.5: Verify plugin activates and shows installer wizard

---

## 6. Data Model Impact

No runtime data model changes. The CLI operates at build-time only.

**Project location:** `01 - Projects/Flowti CLI/` (see [Architecture](docs/Architecture.md))

**Configuration files:**

| File | Location | Purpose |
|------|----------|---------|
| `flowti-cli.config.json` | `01 - Projects/Flowti CLI/configs/` | Kernel config: projects folder, subsystem mappings, capture dirs |
| `.flowti-state.json` | `01 - Projects/Flowti CLI/configs/` | Persistent state: selected project, project source |
| `flowti.config.json` | `<project>/configs/` | Per-project config: tool mappings, publish, review settings |
| `package.json` | `<project>/` | npm scripts (consumed by auto-scaffolding, info, npm scripts menu) |

**Generated artifacts:**

| Artifact | Path | Trigger |
|----------|------|---------|
| Hub boilerplate | `<project>/src/ui/<hub>/`, `src/domain/<hub>/` | `make:hub` command |
| Plugin boilerplate | `Development/<plugin-id>/` | `make:plugin` command |
| Component boilerplate | `<project>/src/ui/components/<name>/` | `make:component` command |
| Reports | `<cli>/docs/reports/{complexity,tests,coverage,codebase}/` | `npm run reports` |
| Test vault | `C:\Projects\<project>-e2e\` | Review → Create test vault |

---

## 7. Event Impact

**Produced**: None (build-time tooling, not runtime plugin code)

**Consumed**: None

**Note**: The CLI documentation generator reads the event catalog source to count events. The generated hub boilerplate includes domain event stubs that integrate with the EventBus at runtime.

---

## 8. UI Layout Impact

None. The CLI is a terminal application. Generated hub boilerplate produces BaseHubView subclasses that follow the existing Hub Shell pattern (ADR-024).

---

## 9. Adapter Impact

No adapter changes. The CLI uses Node.js built-ins exclusively (readline, child_process, fs, path). No external dependencies.

---

## 10. Non-Functional Requirements

| Requirement | Target |
|-------------|--------|
| CLI startup time | < 100ms |
| Fast build (`npm run flowti -- build`) | < 3s |
| No production dependencies | Dev tooling only (TypeScript, Vitest, tsx, ESLint); runtime uses Node.js built-ins |
| Cross-platform | Windows, macOS, Linux |
| AI Agent compatibility | Deterministic exit codes, no interactive prompts in non-interactive mode |
| Generated docs accuracy | Auto-generated from source; always reflects current CLI state |
| Scaffolding safety | Never overwrite existing files; abort on name collision |
| Zero runtime footprint | CLI is build-time only; not bundled into the plugin |

---

## 11. Risks

| Risk | Mitigation |
|------|------------|
| CLI source grows beyond maintainability | Modular domain structure (make/, publish/, review/, reports/) keeps cognitive load low |
| Per-project config divergence | Auto-scaffolding from package.json ensures consistent defaults |
| Hub template drift from BaseHubView API | Templates reference stable patterns from ADR-024; test validates compilation |
| AI agent cannot parse CLI output | Non-interactive mode returns clean stdout; exit codes are deterministic |
| Scaffolded code doesn't compile | E2E journey validates build after scaffold |
| Test vault accumulation on disk | Test vaults outside git; user manages lifecycle via Review menu |
| Node.js readline quirks on Windows | Tested on Windows; ANSI colors gracefully degrade |

---

## 12. Acceptance Criteria

- [x] `npm run dev` starts interactive menu with project selection and quits cleanly with `q`
- [x] Selecting a project shows detail menu with 7 tools (Make, Build, Review, Publish, Reports, Dev Tools, Npm Scripts)
- [x] Projects without `flowti.config.json` get auto-scaffolded config on first selection
- [x] Mappable tools (Build, Reports, Dev Tools) disabled when not configured
- [x] Review creates test vault outside git repository
- [x] Publish pipeline enforces build → test → distribute gating
- [x] `npm run build` compiles TypeScript to `bin/` without errors
- [x] `npm test` passes with all 51 tests green
- [x] Pressing `?` in any menu shows contextual help
- [ ] Developer onboarding E2E journey passes against live Obsidian instance
- [ ] AI agent can use non-interactive commands to build, test, and scaffold without human intervention

---

## 13. Definition of Done

- [x] All FR-01 through FR-09 implemented and manually verified
- [ ] FR-10 (E2E journey) implemented and passing
- [x] Two-stage menu (start → project detail) working for both project directories
- [x] Per-project auto-scaffolding generates valid `flowti.config.json`
- [x] Man-pages cover all tool menus with accurate descriptions
- [x] TypeScript strict mode with Vitest test suite (51 tests)
- [x] No production dependencies — dev tooling only
- [x] README, Architecture, and PRD updated to reflect project-centric architecture
- [ ] Developer onboarding scenario tested end-to-end

---

## 14. Improvements

Planned improvements to evolve the CLI beyond its current state:

### Short-Term

| ID | Improvement | Description |
|----|-------------|-------------|
| IMP-01 | **Non-interactive command dispatch** | Add `--project=<name>` flag to all commands so AI agents and scripts can target a specific project without interactive selection |
| IMP-02 | **Component scaffolding** | Extend Make tool with component templates (UI component, service, event handler) following established DDD patterns |
| IMP-03 | **Journey scaffolding** | Extend Make tool with E2E journey templates that generate test files, config JSON, and canvas stubs |
| IMP-04 | **Report archive navigation** | Reports menu should list past reports from `docs/reports/` subdirectories with timestamps |

### Medium-Term

| ID | Improvement | Description |
|----|-------------|-------------|
| IMP-05 | **Project health dashboard** | Aggregate project stats (test count, coverage, build status, last activity) into a summary view |
| IMP-06 | **Config validation** | Validate `flowti.config.json` against a schema with helpful error messages for misconfigured projects |
| IMP-07 | **Review pipeline gating** | Add build → test gating to Review (like Publish) before running E2E journeys |
| IMP-08 | **Capture integration** | Idea capture from CLI — quick-add notes to vault inbox or project-specific inbox |

### Long-Term

| ID | Improvement | Description |
|----|-------------|-------------|
| IMP-09 | **Plugin marketplace publishing** | Extend Publish with BRAT/community plugin release workflow |
| IMP-10 | **Cross-project dependencies** | Detect and visualize dependencies between projects (e.g., CLI depends on plugin patterns) |
| IMP-11 | **CI/CD integration** | Generate GitHub Actions workflows from project config for automated build/test/publish |
| IMP-12 | **Self-update mechanism** | CLI checks for updates and can rebuild itself when source changes are detected |
